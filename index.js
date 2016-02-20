'use strict';

var sidekickAnalyser = require("sidekick-analyser");
var david = require('david');
var Promise = require('bluebird');

var fs = require('fs');

var location = require('./src/locationInFile');

if(require.main === module) {
  execute();
}
module.exports = exports = execute;

/**
 * Entry function for every analyser. Use sidekickAnalyser to provide input and output functions.
 */
function execute() {
  sidekickAnalyser(function(setup) {
    var fileRegex = setup.fileRegex;  //you can override the package.json re in the analyser config
    var filePath = setup.filePath;  //the path to the current file that is being analysed

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

module.exports.run = function(manifest, fileContent) {
  return scan(manifest)
    .then(
      function(deps){
        return convertToErrors(deps, fileContent);
      },
      function(err){
        console.error("failed to analyse");
        console.log({ error: err });
        process.exit(1);
      }
    );
};

module.exports.runCliReport = function(manifest){
  return scan(manifest)
    .then(
      function(deps){
        return packageDependenciesAsCliReport(manifest, deps);
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

function convertToErrors(data, fileContents){
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
    results.push(formatAsError({location: location, message: message}));
  }

  //TODO - better find in package.json (uses indexOf currently)
  function getPositionInPackageJson(depName, isDev, isOpt){
    return location('"' + depName + '"', fileContents);
  }

  function getMessage(depName, dep) {
    var required = dep.required || '*';
    var stable = dep.stable || 'None';
    var latest = dep.latest || 'None';
    return 'Dependency \'' + depName + '\' is out of date. You have \''
	+ required + '\'. Latest stable is \'' + stable + '\'. (Latest: \'' + latest + '\').';
  }
}

function formatAsError(dep) {
  var data = {
    analyser: 'sidekick-david',
    location: dep.location,
    message: dep.message,
    kind: 'dependency_outdated'
  };
  return sidekickAnalyser.createAnnotation(data);
}

function packageDependenciesAsCliReport(manifest, data){
  var ret = {name: manifest.name};
  var deps = data[0], devDeps = data[1], optDeps = data[2];

  ret.deps = prettify(deps);
  ret.depInstallStr = getInstallStr(deps);
  ret.devDeps = prettify(devDeps);
  ret.devDepInstallStr = getInstallStr(devDeps);
  ret.optDeps = prettify(optDeps);
  ret.optDepInstallStr = getInstallStr(optDeps);

  var total = ret.deps.length + ret.devDeps.length + ret.optDeps.length;
  var header, body = '';
  if(total > 0){
    var depStr = total === 1 ? 'dependency' : 'dependencies';
    header = total + ' ' + depStr + ' could be updated:\n';
  } else {
    header = 'All dependencies are up to date!\n';
  }

  if(ret.deps.length > 0){
    body = 'Dependencies:\n' + ret.deps.join('\n') + '\n'
  } else {
    body = 'All dependencies up to date.\n';
  }
  if(ret.devDeps.length > 0){
    body += 'Dev dependencies:\n' + ret.devDeps.join('\n') + '\n'
  } else {
    body += 'All dev dependencies up to date.\n';
  }
  if(ret.optDeps.length > 0){
    body += 'Optional dependencies:\n' + ret.optDeps.join('\n') + '\n'
  } else {
    body += 'All optional dependencies up to date.\n';
  }
  ret.cliOutput = header + body;
  return ret;

  function prettify(arr){
    var ret = [];
    Object.keys(arr).forEach(function(depName) {
      var required = arr[depName].required || '*';
      var stable = arr[depName].stable || 'None';
      var latest = arr[depName].latest;
      //ret.push('\'%s\' - Required: %s Stable: %s Latest: %s', depName, required, stable, latest);
      ret.push('\'' + depName + '\' - Required: ' + required + ', stable: ' + stable + ' (latest: ' + latest + ')');
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
}
