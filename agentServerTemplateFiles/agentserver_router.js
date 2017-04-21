'use strict'

module.exports = function(exApp, port, appDescr, RRUrl, cwd, emitter){

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
    }catch(error){
      console.log(error);
    }

    exApp.server = exAppServer;
    
    var iotApp = {};

    var $router = express.Router();
    $router.use(bodyParser.json());

    var $request = require("./agentserver_request")(RRUrl, appDescr.id);

    require("./agent")(iotApp, emitter);
    
    require("./" + appDescr.main)(iotApp, $router, $request, logger);
    
    exApp.use("/api", $router);

    require("./agentserver_handlers")(exApp, exAppServer, iotApp, emitter);

  });

}

