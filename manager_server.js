/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farsad.ahmadi.gh@gmail.com>
 */

/*if (!process.env.NODE_ENV) {
  console.log("\n*****************************************");
  console.log("No NODE_ENV environment variable defined!");
  console.log("Please define it. Exiting now...");
  console.log("*****************************************\n");
  process.exit(1);
}*/

var path = require("path");
var fs = require("fs.extra");
var request = require("request");
var express = require("express");
var app = express();

//var configFile = path.resolve("./config", process.env.NODE_ENV);
var configFile = path.resolve("./config/config.json");

getConfig(function(err, config){
  if(err){
      console.log(err.toString());
  } else {
    console.log(config);
    console.log(process.env.DEVICE_URL);
    config.device.url = process.env.DEVICE_URL;
    config.device.name = process.env.DEVICE_NAME;
    console.log(config);
		registerToDeviceManager(config, function(err){
      if(err){
          console.log(err.toString());
      } else {
        registerToBackend(config, function(err){
            if(err){
                console.log(err.toString());
            } else {
                start(config);
            }
        });
      }
    });

    }
});

function getConfig(callback){
    fs.readFile(configFile, "utf8", function(err, configData){
        if(err){
            callback(err);
        } else {
            var config = JSON.parse(configData);
            callback(null, config)
        }
    });
}

function registerToDeviceManager(config, callback){
        if(config.device.idFromDM){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            console.log("already registered to DM");
            callback(null)
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.
            
            var options = {
                uri: config.deviceManager.url,
                method: 'POST',
                json: config.device
            };

            console.log("before registration");

            request(options, function(err, res, body){
              console.log("after registration");
                if(!err && res.statusCode == 200) {
                    //console.log(body);
                    config.device.idFromDM = body.toString();
                    console.log(config);
                    fs.writeFile(configFile, JSON.stringify(config, null, 4), function(err){
                        if(err){
                            console.log(err.toString());
                            callback(err);
                        } else {
                            console.log("now registered to DM");
                            callback(null);
                        }
                    });
                } else {
                    console.log(err.toString());
                    callback(err);
                }
            });
        }
}

function registerToBackend(config, callback){
        if(config.device.idFromBackend){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            console.log("already registered to Backend");
            callback(null);
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.
            var reqContent = {"name":config.device.name,"manufacturer":config.device.manufacturer};
            var backendUrl = config.backend.url;

            var options = {
                uri: backendUrl,
                method: 'POST',
                json: reqContent
            };

            request(options, function(err, res, body){
                console.log("satatus code" + res.statusCode);
                if(!err && res.statusCode == 201) {
                    console.log("body: " + body);
                    console.log(typeof(body));
                  
                    config.device.idFromBackend = body.deviceId;
                    fs.writeFile(configFile, JSON.stringify(config, null, 4), function(err){
                        if(err){
                            console.log(err.toString());
                            callback(err);
                        } else {
                            console.log("now registered to backend");
                            callback(null);
                        }
                    });
                } else {
                    //console.log(err.toString());
                    callback(err);
                }
            });
        }
}

function start(config, deviceInfo, deviceManagerInfo){
  require("./router/main")(app, config.deviceManager.url, config.device);
  console.log(config.deviceManager.url);
  var server = app.listen(config.device.port, function(){
    console.log("server started");  
  });
}

