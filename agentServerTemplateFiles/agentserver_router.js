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
  var exclude_var_array = ["$task","$initialize","$terminate","$configureInterval","start","stop"]; //Exclude from liquid savefile.

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
    
    $router.get("/savestate/", function(req, res){
      // SAVE THE VARIABLE
      
      var fs = require('fs');
      var path = require('path');
      
      // Compose the JSON-file.
      var state = {};
      for(var key in iotApp){
	state[key] = iotApp[key];
      }
      
      
      fs.writeFile(path.resolve(__dirname, 'state.json'),JSON.stringify(state),function(err){
	if(err){
	  console.log(err);
	}
	res.status(200).send("true");
      });
    });
    
    $router.get("/syncId/", function(req, res){
      
      var fs = require('fs');
      var path = require('path');
      
      var options;

      fs.readFile(path.resolve(__dirname, 'liquid-options.json'),'utf8', function(err, data) {
	if(err) {
	  // No file included.
	  res.status(200).send("-3");
	  return;
	}
	options = JSON.parse(data);
	if(options.hasOwnProperty('syncID')){
	  res.status(200).send(options['syncID']);
	  return;
	}
	res.status(200).send("-4");
      });
      
    });
    
    exApp.use("/api", $router);

    require("./agentserver_handlers")(exApp, exAppServer, iotApp, emitter);

  });

}
