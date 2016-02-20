#!/usr/bin/env node

var stdin = require("easy-stdin");
var dc = require("../dependency_checker.js");

stdin(function(err, src) {
  if(err) {
    return console.error("Couldn't read from stdin '%s'", err);
  }
  run(src);
});

function run(src) {
  //we should be passed the contents of the manifest file in JSON
  var output = dc.scan(src);
  console.log(output);
  //send output to stdout?
}
