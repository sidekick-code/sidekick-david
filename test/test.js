var assert = require('chai').assert;
var expect = require('chai').expect;

var sd = require('../../sidekick-david');

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

describe('dependency analyser', function() {

  describe('config', function() {

    before(function() {
      var configPath = path.join(__dirname, "/../config.json");
      var content = fs.readFileSync(configPath, { encoding: "utf8" });
      this.config = JSON.parse(content);
    });

    it('config exists for analyser', function() {
      assert.isObject(this.config, 'analyser config is an object');
    });

    it('executes as analyser', function(done) {
      var manifest = require('../package.json');
      manifest.dependencies.david = "0.0.1";  //put back deps

      fs.readFile(path.join(__dirname, '/../package.json'), "utf-8", function(err, data){
        sd.run(manifest, data).then(function(results){
          var badDavidDep = {
            analyser: 'sidekick-david',
            kind: 'dependency_outdated',
            displayName: 'dependencies',
            location: {
              startCol: 0,
              endCol: 0,
              startLine: 27,
              endLine: 27
            }
          };

          expect(results.length).to.equal(1);
          var returnedDavidDep = results[0];
          expect(returnedDavidDep.analyser).to.equal(badDavidDep.analyser);
          expect(returnedDavidDep.kind).to.equal(badDavidDep.kind);
          expect(returnedDavidDep.displayName).to.equal(badDavidDep.displayName);

          expect(returnedDavidDep).to.have.deep.property('location.startLine', badDavidDep.location.startLine);
          expect(returnedDavidDep).to.have.deep.property('location.endLine', badDavidDep.location.endLine);
          expect(returnedDavidDep).to.have.deep.property('location.startCol', badDavidDep.location.startCol);
          expect(returnedDavidDep).to.have.deep.property('location.endCol', badDavidDep.location.endCol);

          var messageRe = /Dependency \'david\' is out of date. You have \'0\.0\.1\'./;
          expect(returnedDavidDep.message).to.match(messageRe);
          done();
        });
      });
    });

    it('executes as cli', function(done) {
      var manifest = require('../package.json');
      manifest.dependencies.david = "0.0.1";  //put back deps
      manifest.dependencies.bluebird = "0.0.1";  //put back deps
      manifest.devDependencies.chai = "0.0.1";  //put back deps
      manifest.optionalDependencies = {"jscs":  "0.0.1"};  //put back deps

      fs.readFile(path.join(__dirname, '/../package.json'), "utf-8", function(err, data) {
        sd.run(manifest, data).then(function (results) {
          expect(results.length).to.equal(4);
          expect(_.filter(results, {'kind': 'dependency_outdated'}).length).to.equal(2);
          expect(_.filter(results, {'kind': 'dev_dependency_outdated'}).length).to.equal(1);
          expect(_.filter(results, {'kind': 'optional_dependency_outdated'}).length).to.equal(1);
          done();
        });
      });
    });

    it('executes as cli - no deps', function(done) {
      delete require.cache[require.resolve('../package.json')];
      var manifest = require('../package.json');
      manifest.devDependencies.chai = "0.0.1";  //put back deps

      fs.readFile(path.join(__dirname, '/../package.json'), "utf-8", function(err, data) {
        sd.run(manifest, data).then(function(results){
          expect(results.length).to.equal(1);
          expect(_.filter(results, {'kind': 'dependency_outdated'}).length).to.equal(0);
          expect(_.filter(results, {'kind': 'dev_dependency_outdated'}).length).to.equal(1);
          expect(_.filter(results, {'kind': 'optional_dependency_outdated'}).length).to.equal(0);
          done();
        });
      });
    });

    it('executes as cli - no dev deps', function(done) {
      delete require.cache[require.resolve('../package.json')];
      var manifest = require('../package.json');
      manifest.dependencies.david = "0.0.1";  //put back deps

      fs.readFile(path.join(__dirname, '/../package.json'), "utf-8", function(err, data) {
        sd.run(manifest, data).then(function(results){
          expect(results.length).to.equal(1);
          expect(_.filter(results, {'kind': 'dependency_outdated'}).length).to.equal(1);
          expect(_.filter(results, {'kind': 'dev_dependency_outdated'}).length).to.equal(0);
          expect(_.filter(results, {'kind': 'optional_dependency_outdated'}).length).to.equal(0);
          done();
        });
      });
    });

    it('executes as cli - with only optional deps', function(done) {
      delete require.cache[require.resolve('../package.json')];
      var manifest = require('../package.json');
      manifest.optionalDependencies = {"jscs":  "0.0.1"};  //put back deps

      fs.readFile(path.join(__dirname, '/../package.json'), "utf-8", function(err, data) {
        sd.run(manifest, data).then(function(results){
          expect(results.length).to.equal(1);
          expect(_.filter(results, {'kind': 'dependency_outdated'}).length).to.equal(0);
          expect(_.filter(results, {'kind': 'dev_dependency_outdated'}).length).to.equal(0);
          expect(_.filter(results, {'kind': 'optional_dependency_outdated'}).length).to.equal(1);
          done();
        });
      });
    });

    it('executes as cli - all deps up to date', function(done) {
      delete require.cache[require.resolve('../package.json')];
      var manifest = require('../package.json');

      fs.readFile(path.join(__dirname, '/../package.json'), "utf-8", function(err, data) {
        sd.run(manifest, data).then(function(results){
          expect(results.length).to.equal(0);
          done();
        });
      });
    });
  })
});
