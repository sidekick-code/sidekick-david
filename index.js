'use strict';

const sidekickAnalyser = require("sidekick-analyser");
const david = require('david');
const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');

const location = require('./src/locationInFile');

if(require.main === module) {
  execute();
}
module.exports = exports = execute;

var annotationDefaults = {analyserName: 'sidekick-david'};

var LOG_FILE =  path.join(__dirname, '/debug.log');

//log to file as any stdout will be reported to the analyser runner
function logger(message) {
  fs.appendFile(LOG_FILE, message + '\n');
}

/**
 * Entry function for every analyser. Use sidekickAnalyser to provide input function.
 */
function execute() {
  sidekickAnalyser(function(setup) {
    var fileRegex = setup.fileRegex;  //you can override the package.json re in the analyser config

    annotationDefaults = {analyserName: setup.analyser};

    if(isManifest(setup.path, fileRegex)){
      run(JSON.parse(setup.content), setup.content).then(function(results){
        console.log(JSON.stringify({ meta: results }));
      });
    }
  });

  /**
   * Check that the file being analysed is a package.json file
   * @param fileRegex (optional) will default to os specific re for package.json
   * @returns {*}
   */
  function isManifest(filePath, fileRegex){
    var posixFileRegex = /(\/package\.json$|^package\.json$)/i;
    var win32FileRegex = /(\\package\.json$|^package\.json$)/i;
    var regex = process.platform === 'win32' ? win32FileRegex : posixFileRegex;  //use platform specific regex
    var fileRe = fileRegex || regex; //you can override with a regex in the analyser config

    return fileRe.test(filePath);
  }
}

module.exports._testRun = run;  //exposed to tests
//need the manifest as an object (for david) and the raw file contents (not stringified obj) so we can find line no.s
function run(manifestObj, manifestContent) {
  if(!manifestContent){
    console.error("failed to analyse - no manifest content");
    console.log({ error: err });
    process.exit(1);
  }

  return scan(manifestObj)
    .then(
      function(deps){
        return convertToAnnotations(deps, manifestContent);
      },
      function(err){
        console.error("failed to analyse");
        console.log({ error: err });
        process.exit(1);
      }
    );
}

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

function convertToAnnotations(data, manifestContent){
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
    var location = getPositionInPackageJson(manifestContent, depName, isDev, isOpt);
    var message = getMessage(depName, dep);
    var kind = getKind(isDev, isOpt);
    var category = getCategory(isDev, isOpt);

    results.push(formatAsAnnotation({
      location: location,
      message: message,
      kind: kind,
      category: category}));
  }

  //TODO - better find in package.json (uses indexOf currently)
  function getPositionInPackageJson(manifestContent, depName, isDev, isOpt){
    return location('"' + depName + '"', manifestContent);
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

  function getCategory(isDev, isOpt){
    if(isDev){
      return 'Dev dependencies';
    } else if(isOpt){
      return 'Optional dependencies';
    } else {
      return 'Dependencies';
    }
  }

  function getMessage(depName, dep) {
    var required = dep.required || '*';
    var stable = dep.stable || 'None';
    var latest = dep.latest || 'None';
    return `Dependency '${depName}' is out of date. You use '${required}', which could be updated to stable: '${stable}'. (latest: '${latest}').`;
  }
}

function formatAsAnnotation(dep) {
  var location = {startCol: 0, endCol: 0};
  location.startLine = dep.location.line;
  location.endLine = dep.location.line;

  return {
    analyser: annotationDefaults.analyserName,
    location: location,
    message: dep.message,
    kind: dep.kind,
    category: dep.category,
  };
}
