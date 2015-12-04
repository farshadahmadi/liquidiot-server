var Router = require('../../../../node_modules/routes');
var router = new Router();
var http = require('http');
var url = require('url');
var handlers = require('./agentserver_handlers');
var util = require("util");
var fs = require("fs");

//var test = require('./files/75216/test');

//var log_file = fs.createWriteStream(__dirname + "/debug.log", {flag : "w"});
var log_file = fs.createWriteStream("./debug.log", {flag : "w"});

console.log("cwd: " +process.cwd());

process.on("uncaughtException", function(error){
  console.err(error.toString());
  //var instanceLog = fs.readFileSync( __dirname + "/debug.log", "utf8");
  var instanceLog = fs.readFileSync("./debug.log", "utf8");
  throw new Error(instanceLog);
  //console.error("Uncaught exception: " + err.toString());
  //throw err;
});

var log_stdout = process.stdout;
var log_stderr = process.stderr;


console.log = function(d){
  log_file.write(util.format(d) + "\n");
  log_stdout.write(util.format(d) + "\n");
}

console.err = function(d){
  log_file.write(util.format(d) + "\n");
  log_stderr.write(util.format(d) + "\n");
}

router.addRoute('/:n', handlers.main);
router.addRoute('/', handlers.getInstanceStatus);

//router.addRoute('/installdeps', handlers.installDeps);
//router.addRoute('/:n/stop', handlers.main);
//router.addRoute('/uploaddep', handlers.upload);
//router.addRoute('/apps', handlers.pushapp);
//router.addRoute('/apps/:n', handlers.instanciate);
//router.addRoute('/:n/upload', handlers.update);
//router.addRoute('/:n/start', handlers.start);
//router.addRoute('/:n/stop', handlers.stop);
//router.addRoute('/:n/delete', handlers.remove);
//router.addRoute('/test', test.test1);

var server = http.createServer(function(req, res){
  var path = url.parse(req.url).pathname;
  var match = router.match(path);
  console.log(match);
  if(match) {
    match.fn(req, res, match);
  } else {
    console.log("inja");
    res.writeHead(405, {"Content-Type" : "text/plain"});
    res.write("Not Handled");
    res.end();
  }
});

server.listen(process.argv[2]);

handlers.startForFirstTime(process.argv[3]);

//console.log("Server at port " + process.argv[2] + " started");