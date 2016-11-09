'use strict'

module.exports = function(exApp, port, appDescr, RRUrl, cwd, emitter){

  var fs = require("fs");
  var util = require("util");

  var express = require('express');

  var log_file = fs.createWriteStream(cwd + "debug.log", {flags : "a"});

  var logger = {};

  logger.log = function(d){
    console.log(d);
    log_file.write(util.format(d) + "\n");
  }

  var exAppServer = exApp.listen(port, function(){

    exApp.server = exAppServer;
    
    var iotApp = {};

    var $router = express.Router();

    var $request = require("./agentserver_request")(RRUrl);

    require("./agent")(iotApp, emitter);
    
    require("./" + appDescr.main)(iotApp, $router, $request, logger);
    
    exApp.use("/api", $router);

    require("./agentserver_handlers")(exApp, exAppServer, iotApp);

  });

}

