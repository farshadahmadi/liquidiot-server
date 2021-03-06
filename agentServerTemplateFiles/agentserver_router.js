var fs = require("fs");
var util = require("util");

var express = require('express');
var app = express();

var log_file = fs.createWriteStream("./debug.log", {flags : "a"});

//console.log("cwd: " +process.cwd());

process.on("uncaughtException", function(error){
  ////console.err(error.toString());
  //console.err(error.stack);
  fs.appendFileSync("./debug.log", error.stack, "utf8");
  ////var instanceLog = fs.readFileSync("./debug.log", "utf8");
  ///throw new Error(instanceLog);
  throw error;
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

app.listen(process.argv[2], function(){

  var iotApp = {};
  iotApp.internal = {};

  iotApp.internal.router = express.Router();

  require("./agentserver_request")(iotApp.internal, process.argv[4]);

  require("./agent")(iotApp.internal);
  
  require("./" + process.argv[3])(iotApp);

  require("./agentserver_handlers")(app, iotApp.internal);

  app.use("/api", iotApp.internal.router);

});

