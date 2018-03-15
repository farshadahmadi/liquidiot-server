'use strict'

module.exports = function(exApp, port, appDescr, RRUrl, cwd, emitter, deviceInfo){

  var EventEmitter = require('events').EventEmitter;
  var impactEvents = new EventEmitter();

  var fs = require("fs");
  var util = require("util");
  var bodyParser = require("body-parser");
  var rp = require("request-promise");
  var express = require('express');
  var _ = require('lodash');

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
    var cachedIotApp = {};
    var last_update = 0;
    
    // This function polls the state of the app every 100ms.
    setInterval(function(){
      // Check if the app is synchronized to some other device.
      if(appDescr.syncID != -1){
        var changes = {};
        for(var key in iotApp){
          // Compare to cache.
	  if(cachedIotApp[key] != iotApp[key]){
	    cachedIotApp[key] = iotApp[key];
            changes[key] = cachedIotApp[key];
	  }
        }
        // Delete from cache if variable is deleted.
        // This does not get synced yet.
        for(var key in cachedIotApp){
          if(typeof iotApp[key] == 'undefined'){
            delete cachedIotApp[key];
          }
        }
        if(!_.isEmpty(changes)){
          getSyncDevices().then(function(res){
            console.log(res);
            var promises = [];
            last_update = Date.now();
            // Send the updates to all devices.
            res.forEach(function(row){
              var url = row.deviceURL + "/sync/";
              var data = {};
              data["aid"] = row.appId;
              data["time"] = last_update;
              for(var key in changes){
                data[key] = changes[key];
              }
              console.log("URL ---- " + url);
              console.log("DATA ---- " + data);
              promises.push(sendSync(url, data));
            });
            Promise.all(promises).then(function(){
              console.log("SEND ALL SYNC");
            });
          });
        }
      }
    },100);
    
    // Returns all deviceURLs and appIDs of the apps that are synchronized.
    function getSyncDevices(){
      var options = {};
      options.url = RRUrl + "?device=FOR+device+IN+devices+FOR+app+IN+device.apps[*]+FILTER+app.syncID==\""+appDescr.syncID+"\"+FILTER+app.id!="+appDescr.id+"+RETURN+{\"deviceURL\":device.url,\"appId\":app.id}";
      options.method = "GET";
      return rp(options).then(function(res){
        return JSON.parse(res);
      });
    }

    // Sends the syncing data to the device. The appID is attached.
    function sendSync(url, data){
      var options = {};
      options.method = 'POST';
      options.body = data;
      options.json = true;
      options.uri = url;
      return rp(options);
    }

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
  
    // This function is used when the syncdata has been received.
    $router.post("/sync/", function(req, res){
      console.log("IK KREEG EM HAHAHAHAHA " + JSON.stringify(req.body));
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
	  res.status(200).send("-1");
	  return;
	}
	options = JSON.parse(data);
	if(options.hasOwnProperty('syncID')){
	  res.status(200).send(options['syncID']);
	  return;
	}
	res.status(200).send("-1");
      });
      
    });
    
    $router.post("/saveSyncId/", function(req, res){
      var fs = require('fs');
      var path = require('path');
      console.log(req.body);
      res.send(true);
      console.log("Saving syncId " + req.body.syncId + " to file.");
      fs.writeFile(path.resolve(__dirname, 'liquid-options.json'),JSON.stringify(req.body), function(err){
	if(err){
	  console.log(err);
	}
      });
    });
    
    exApp.use("/api", $router);

    require("./agentserver_handlers")(exApp, exAppServer, iotApp, emitter);

  });

}
