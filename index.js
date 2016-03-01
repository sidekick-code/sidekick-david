'use strict';

var sidekickAnalyser = require("sidekick-analyser");
var MESSAGE_TYPE = sidekickAnalyser.MESSAGE_TYPE;
var david = require('david');
var Promise = require('bluebird');

var fs = require('fs');

var location = require('./src/locationInFile');

if(require.main === module) {
  execute();
}
module.exports = exports = execute;

var setup;

/**
 * Entry function for every analyser. Use sidekickAnalyser to provide input and output functions.
 */
function execute() {
  sidekickAnalyser(function(analyserSetup) {
    var fileRegex = setup.fileRegex;  //you can override the package.json re in the analyser config
    var filePath = setup.filePath;  //the path to the current file that is being analysed
    setup = analyserSetup;

    if(isManifest(fileRegex)){
      fs.readFile(filePath, function(err, fileContents){
        var manifest = JSON.parse(fileContents);
        exports.run(manifest, setup.content).then(function(results){
          console.log(JSON.stringify({ meta: results }));
        });
      });
    }
  });
}

/**
 * Check that the file being analysed is a package.json file
 * @param fileRegex (optional) will default to os specific re for package.json
 * @returns {*}
 */
function isManifest(fileRegex){
  var posixFileRegex = /\/package\.json$/i;
  var win32FileRegex = /\\package\.json$/i;
  var regex = process.platform === 'win32' ? win32FileRegex : posixFileRegex;  //use platform specific regex
  var fileRe = fileRegex || regex; //you can override with a regex in the analyser config

  var matches = fileRe.exec(setup.filePath);
  return matches[0];
}

module.exports._testRun = run;  //exposed to tests
function run(manifest, fileContent) {
  if(!fileContent){
    console.error("failed to analyse - no fileContent");
    console.log({ error: err });
    process.exit(1);
  }

  return scan(manifest)
    .then(
      function(deps){
        return convertToAnnotations(deps, fileContent);
      },
      function(err){
        console.error("failed to analyse");
        console.log({ error: err });
        process.exit(1);
      }
    );
};

function scan(manifest) {
  var opts = {stable: true};  //for now, only flag if there are updated stable dependencies
  var devOpts = {stable: true, dev: true};
  var optOpts = {stable: true, optional: true};

  var getDeps = Promise.promisify(david.getUpdatedDependencies);
  //david treats deps, devDeps and optDeps separately, so fetch all together
  return Promise.all([
    getDeps(manifest, opts),
    getDeps(manifest, devOpts),
    getDeps(manifest, optOpts)
  ]).then(function(deps){
    return deps;
  }, function(err){
    throw new Error('Unable to get deps: ' + err.getMessage());
  });
}

function convertToAnnotations(data, fileContents){
  var deps = data[0], devDeps = data[1], optDeps = data[2];
  var results = [], prop;

  //trying to reduce required modules so no lodash
  for(prop in deps){
    if(deps.hasOwnProperty(prop)){
      it(prop, deps[prop]);
    }
  }

  for(prop in devDeps){
    if(devDeps.hasOwnProperty(prop)){
      it(prop, devDeps[prop], true);
    }
  }

  for(prop in optDeps){
    if(optDeps.hasOwnProperty(prop)){
      it(prop, optDeps[prop], false, true);
    }
  }
  return results;

  function it(depName, dep, isDev, isOpt){
    var location = getPositionInPackageJson(depName, isDev, isOpt);
    var message = getMessage(depName, dep);
    var kind = getKind(isDev, isOpt);

    results.push(formatAsAnnotation({location: location, message: message, kind: kind}));
  }

  //TODO - better find in package.json (uses indexOf currently)
  function getPositionInPackageJson(depName, isDev, isOpt){
    return location('"' + depName + '"', fileContents);
  }

  function getKind(isDev, isOpt){
    if(isDev){
      return 'dev_dependency_outdated';
    } else if(isOpt){
      return 'optional_dependency_outdated';
    } else {
      return 'dependency_outdated';
    }
  }

  function getMessage(depName, dep) {
    var required = dep.required || '*';
    var stable = dep.stable || 'None';
    var latest = dep.latest || 'None';
    return 'Dependency \'' + depName + '\' is out of date. You have \''
        + required + '\'. Latest stable is \'' + stable + '\'. (Latest: \'' + latest + '\').';
  }
}

function formatAsAnnotation(dep) {
  var analyserName, displayName, location = {startCol: 0, endCol: 0};

  if(setup){
    analyserName = setup.analyser;
    displayName = setup.displayName;
  } else {
    analyserName = 'sidekick-david';
    displayName = 'dependencies';
  }
  location.startLine = dep.location.line;
  location.endLine = dep.location.line;

  return {
    analyser: analyserName,
    displayName: displayName,
    location: location,
    message: dep.message,
    kind: dep.kind
  };
}

/**
 * Run analysis and return a cliReport object. CliReport's can be printed to stdout by running through outputCliReport
 * @param manifest
 * @param data
 * @returns {{
 * deps: [any dependencies that are out of date],
 * devDeps: [any dev dependencies that are out of date],
 * optDeps: [any optional dependencies that are out of date],
 * cliReport: [lines to output to stdout]
 * }}
 */
function packageDependenciesAsCliReport(manifest, data){
  var ret = {name: manifest.name};
  var deps = data[0], devDeps = data[1], optDeps = data[2];
  var cliReport = sidekickAnalyser.getCliReportTemplate('Dependencies');

  //get the deps and npm install strings for each of the dep types
  ret.deps = prettify(deps);
  ret.depInstallStr = getInstallStr(deps);
  ret.devDeps = prettify(devDeps);
  ret.devDepInstallStr = getInstallStr(devDeps);
  ret.optDeps = prettify(optDeps);
  ret.optDepInstallStr = getInstallStr(optDeps);

  var header = '';
  var total = ret.deps.length + ret.devDeps.length + ret.optDeps.length;
  if(total > 0){
    var depStr = total === 1 ? 'dependency' : 'dependencies';
    header = cliLine(total + ' ' + depStr + ' could be updated:', MESSAGE_TYPE.ERROR);
  } else {
    header = cliLine(sidekickAnalyser.SUCCESS_TICK + ' All dependencies are up to date!', MESSAGE_TYPE.OK);
  }
  cliReport.push(header);

  addDepUpdatedLine(ret.deps);
  addDepUpdatedLine(ret.devDeps, 'dev');
  addDepUpdatedLine(ret.optDeps, 'opt');
  cliReport.push(cliLine(''));
  ret.cliOutput = cliReport;
  return ret;

  function addDepUpdatedLine(deps, type){
    var depType = '[Dependencies]';
    var tabs = '          ';

    if(type === 'dev'){
      depType = '[Dev dependencies]';
      tabs = '      ';
    } else if(type === 'opt'){
      depType = '[Optional dependencies]';
      tabs = ' ';
    }

    if(deps.length > 0){
      var depStr = deps.length === 1 ? 'dependency' : 'dependencies';
      cliReport.push(cliLine(depType + tabs + deps.length + ' ' + depStr + ' could be updated', MESSAGE_TYPE.ERROR));
      cliReport.push(cliLine(deps.join('\n')));
    } else {
      cliReport.push(cliLine(depType + tabs + 'up to date', MESSAGE_TYPE.OK));
    }
  }

  function prettify(arr){
    var ret = [];
    Object.keys(arr).forEach(function(depName) {
      var required = arr[depName].required || '*';
      var stable = arr[depName].stable || 'None';
      var latest = arr[depName].latest;
      //ret.push('\'%s\' - Required: %s Stable: %s Latest: %s', depName, required, stable, latest);
      ret.push('\'' + depName + '\' - you use: ' + required + ', which can be updated to stable: '
          + stable + ' (latest: ' + latest + ')');
    });
    return ret;
  }

  function getInstallStr(deps){
    var str = 'npm install ';
    Object.keys(deps).forEach(function(depName) {
      str += depName + '@' + deps[depName].stable + ' ';
    });
    return str;
  }

  function cliLine(message, colour){
    return {"colour": colour, "message": message};
  }
}
