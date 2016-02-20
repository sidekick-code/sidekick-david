var sd = require("../../sidekick-david");

describe("Dependency checker", function() {
  it("copes with empty manifests", function(done) {
    var blankManifest = {
      "name": "blank",
      "version": "1.0.0",
      "description": "s",
      "main": "index.js",
      "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
      },
      "author": "",
      "license": "©",
      "dependencies": {}
    };

    getDeps(blankManifest, function(er, data){
      if(er){
        expect(er).to.equal(null);
      } else {
        console.log(JSON.stringify(data));
        expect(data.name).to.equal('blank');
        expect(data.deps).to.have.length(0);
        expect(data.devDeps).to.have.length(0);
      }
      done();
    });
  });

  it("copes with empty dev dependencies", function(done) {
    var manifest = {
      "name": "test",
      "version": "1.0.0",
      "description": "s",
      "main": "index.js",
      "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
      },
      "author": "",
      "license": "©",
      "dependencies": {
        "easy-stdin": "0.0.1",
        "js-todos": "0.0.1"
      }
    };
    getDeps(manifest, function(er, data){
      if(er){
        expect(er).to.equal(null);
      } else {
        console.log(JSON.stringify(data));
        expect(data.name).to.equal('test');
        expect(data.deps).to.have.length(2);
        expect(data.devDeps).to.have.length(0);
      }
      done();
    });
  });

  it("copes with manifests", function(done) {
    var ownManifest = {
      "name": "dependencies",
      "version": "0.0.1",
      "description": "Checks node deps to see if any are out of date.",
      "main": "index.js",
      "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
      },
      "author": "",
      "license": "©",
      "dependencies": {
        "david": "5.0.0",
        "easy-stdin": "0.6.0"
      },
      "devDependencies": {
        "chai": "^0.0.1",
        "mocha": "0.0.1"
      }
    };

    getDeps(ownManifest, function (er, data) {
      if (er) {
        expect(er).to.equal(null);
      } else {
        console.log(JSON.stringify(data));
        expect(data.name).to.equal('dependencies');
        expect(data.deps).to.have.length(2);
        expect(data.devDeps).to.have.length(2);
      }
      done();
    });
  });

  function getDeps(manifest, cb){
    sd.runCliReport(manifest).then(function(data){
      cb(null, data);
    });
  }

});
