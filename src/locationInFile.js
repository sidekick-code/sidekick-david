"use strict";

module.exports = function placeInFile(needle, haystack){
  var index = haystack.indexOf(needle),
      line = 0,
      match,
      re = /(^)[\S\s]/gm;
  while (match = re.exec(haystack)) {
    if(match.index > index)
      break;
    line++;
  }
  return {
    "line": line - 1, //0 based
    "col": colInLine(line, needle)
  };

  function colInLine(line, needle){
    return 0; //gui shows annoatations at the start of a line so we dont need this yet.
  }
};
