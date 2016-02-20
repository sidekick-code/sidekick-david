var stdin = process.stdin;

module.exports = function easyStdin(cb) {
  var called;
  var buf = "";

  stdin.once("error", function(err) {
    if(called) return;
    cb(err);
    cleanup();
  });

  stdin.once("end", function(data) {
    if(called) return;
    cb(null, buf);
    cleanup();
  });

  stdin.on("data", concat);

  function concat(data) {
    buf += data;
  }

  function cleanup() {
    called = true;
    stdin.removeListener("data", concat);
  }
}


