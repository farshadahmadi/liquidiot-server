'use strict'

module.exports = function(exApp, port, appDescr, RRUrl, cwd, emitter){

var fs = require("fs");
var util = require("util");

var express = require('express');
//var app = express();

var log_file = fs.createWriteStream(cwd + "debug.log", {flags : "a"});


/*process.on("uncaughtException", function(error){
  fs.appendFileSync("./debug.log", error.stack, "utf8");
  error.appDescription = appDescr;
  throw error;
});*/

//var log_stdout = process.stdout;
//var log_stderr = process.stderr;

var logger = {};

logger.log = function(d){
  console.log(d);
  log_file.write(util.format(d) + "\n");
  //log_stdout.write(util.format(d) + "\n");
}

//console.err = function(d){
  //log_file.write(util.format(d) + "\n");
  //log_stderr.write(util.format(d) + "\n");
//}

var exAppServer = exApp.listen(port, function(){

  exApp.server = exAppServer;
  
  var iotApp = {};
  //iotApp.internal = {};

  var $router = express.Router();

  //iotApp.$router = express.Router();

  var $request = require("./agentserver_request")(RRUrl);

  require("./agent")(iotApp, emitter);
  
  require("./" + appDescr.main)(iotApp, $router, $request, logger);
  
  exApp.use("/api", $router);

  require("./agentserver_handlers")(exApp, exAppServer, iotApp);




  //server.close();
  
 /* var iotApp = {};
  iotApp.internal = {};

  iotApp.internal.router = express.Router();

  require("./agentserver_request")(iotApp.internal, process.argv[4]);

  require("./agent")(iotApp.internal);
  
  require("./" + process.argv[3])(iotApp);

  require("./agentserver_handlers")(app, iotApp.internal);

  app.use("/api", iotApp.internal.router);*/

});

//return exAppServer;

}

