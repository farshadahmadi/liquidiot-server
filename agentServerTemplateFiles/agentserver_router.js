'use strict'

//module.exports = function(exApp, port, appDescr, RRUrl, cwd, emitter, deviceInfo, impact){

  var impact = {};
  var emitter = {};
  //var impactEvents = {};
  
  var exApp = require('express')();

  var port = process.argv[2];
  var appDescr = JSON.parse(process.argv[3]);
  var RRUrl = process.argv[4];
  var cwd = process.argv[5];
  var deviceInfo = JSON.parse(process.argv[6]);

  process.on('uncaughtException', function(error){
    fs.appendFileSync("../debug.log", error.stack, "utf8");
    throw error;
  });

  var EventEmitter = require('events').EventEmitter;
  impact.event = new EventEmitter();

  var fs = require("fs");
  var util = require("util");
  var bodyParser = require("body-parser");

  var express = require('express');

  //var log_file = fs.createWriteStream(cwd + "debug.log", {flags : "a"});

  var logger = {};

  logger.log = function(d){
    console.log(d);
    //fs.appendFileSync(cwd + "debug.log", util.format(d) + "\n", "utf8");
    fs.appendFileSync("../debug.log", util.format(d) + "\n", "utf8");
    //log_file.write(util.format(d) + "\n");
  }

  var exAppServer = exApp.listen(port, function(){
  //exApp.listen(port, function(){

    /*try {
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
    }*/

    exApp.server = exAppServer;
    
    var iotApp = {};

    var $router = express.Router();
    $router.use(bodyParser.json());

    var $request = require("./agentserver_request")(RRUrl, appDescr.id, deviceInfo);
    
    require("./impactServices")(RRUrl, appDescr.id, deviceInfo, impact);

    require("./agent")(iotApp, emitter);
    
    //require("./" + appDescr.main)(iotApp, $router, $request, logger, $impactServices.listEndpoints, $impactServices.getEndpointDetails, impactEvents, $impactServices.getNumberOfEndpoints, $impactServices.createLifecycleEventSubscription);
    require("./" + appDescr.main)(iotApp, $router, $request, logger, impact);

    console.log(impact);

    $router.post("/", function(req, res){
      //console.log(req.body.responses[0].resources[0].value);
      //console.log(JSON.stringify(req.body.directEndPoints[0]));
      //var body = JSON.parse(req.body);
      //logger.log(JSON.stringify(req.body));
      impact.event.emit(req.body.id, JSON.stringify(req.body.data));
      res.status(200).send("hello dispatcher!");
    });
    
    exApp.use("/api", $router);

    require("./agentserver_handlers")(exApp, exAppServer, iotApp, emitter);

  });

//}

