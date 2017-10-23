'use strict'

module.exports = function(exApp, port, appDescr, RRUrl, cwd, emitter, deviceInfo){

  var EventEmitter = require('events').EventEmitter;
  var impactEvents = new EventEmitter();

  var fs = require("fs");
  var util = require("util");
  var bodyParser = require("body-parser");

  var express = require('express');

  var log_file = fs.createWriteStream(cwd + "debug.log", {flags : "a"});

  var logger = {};

  logger.log = function(d){
    console.log(d);
    log_file.write(util.format(d) + "\n");
  }

  var exAppServer = exApp.listen(port, function(){

    try {
      if (require.cache[require.resolve("./agentserver_handlers.js")]){
        delete require.cache[require.resolve("./agentserver_handlers.js")];
      }
      if (require.cache[require.resolve("./agentserver_request.js")]){
        delete require.cache[require.resolve("./agentserver_request.js")];
      }
      if (require.cache[require.resolve("./main.js")]){
        delete require.cache[require.resolve("./main.js")];
      }
      if (require.cache[require.resolve("./agent.js")]){
        delete require.cache[require.resolve("./agent.js")];
      }
      if (require.cache[require.resolve("./impactServices.js")]){
        delete require.cache[require.resolve("./impactServices.js")];
      }
    }catch(error){
      console.log(error);
    }

    exApp.server = exAppServer;
    
    var iotApp = {};

    var $router = express.Router();
    $router.use(bodyParser.json());

    var $request = require("./agentserver_request")(RRUrl, appDescr.id, deviceInfo);
    
    var $impactServices = require("./impactServices")(RRUrl, appDescr.id, deviceInfo);

    require("./agent")(iotApp, emitter);
    
    require("./" + appDescr.main)(iotApp, $router, $request, logger, $impactServices.listEndpoints, $impactServices.getEndpointDetails, impactEvents, $impactServices.getNumberOfEndpoints);

    $router.post("/", function(req, res){
      //console.log(req.body.responses[0].resources[0].value);
      //console.log(JSON.stringify(req.body.directEndPoints[0]));
      //var body = JSON.parse(req.body);
      //logger.log(JSON.stringify(req.body));
      impactEvents.emit(req.body.id, JSON.stringify(req.body.data));
      res.status(200).send("hello dispatcher!");
    });
    
    exApp.use("/api", $router);

    require("./agentserver_handlers")(exApp, exAppServer, iotApp, emitter);

  });

}

