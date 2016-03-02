/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farsad.ahmadi.gh@gmail.com>
 */

var needle = require("needle");
var fs = require("fs.extra");
var request = require("request");
var express = require("express");
var app = express();
var deviceManagerUrl = "http://130.230.142.101:3000/";
var backendUrl = "https://farshadahmadi:4liquidIoTProject@my.iot-ticket.com/api/v1/devices"



fs.readFile("./config.txt", "utf8", function(err, data){
    if(err){
        console.log(err.toString());
    } else {
        var deviceInfo = JSON.parse(data);
	registerToDeviceManager(deviceInfo, function(err){
            if(err){
                console.log(err.toString());
            } else {
                registerToBackend(deviceInfo, function(err){
                    if(err){
                        console.log(err.toString());
                    } else {
                        start(deviceInfo);
                    }
                });
            }
        });
    }
});


function registerToDeviceManager(deviceInfo, callback){
        if(deviceInfo.idFromDM){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            console.log("already registered to DM");
            callback(null)
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.

            //console.log(data);
            //var deviceManagerUrl = "http://localhost:3000/";
            
            var options = {
                uri: deviceManagerUrl,
                method: 'POST',
                json: deviceInfo
            };

            request(options, function(err, res, body){
                if(!err && res.statusCode == 200) {
                    console.log(body);
                    deviceInfo.idFromDM = body.toString();
                    fs.writeFile("./config.txt", JSON.stringify(deviceInfo), function(err){
                        if(err){
                            console.log(err.toString());
                            callback(err);
                        } else {
                            console.log("now registered to DM");
                            callback(null);
                            //require("./router/main")(app, deviceManagerUrl, deviceInfo);

                            //var server = app.listen(8000, function(){
                              //console.log("server started");  
                            //});

                        }
                    });
                } else {
                    console.log(err.toString());
                    callback(err);
                }
            });
        }
}

function registerToBackend(deviceInfo, callback){
        if(deviceInfo.idFromBackend){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            console.log("already registered to Backend");
            callback(null);
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.
            var reqContent = {"name":deviceInfo.name,"manufacturer":deviceInfo.manufacturer};
            //var reqContent = {"name":"RPi","manufacturer":"RPi"};

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
                  
                    //var response = JSON.parse(body);
                    deviceInfo.idFromBackend = body.deviceId;
                    fs.writeFile("./config.txt", JSON.stringify(deviceInfo), function(err){
                        if(err){
                            console.log(err.toString());
                            callback(err);
                        } else {
                            //console.log("config file updated.");
                            callback(null);
                            //require("./router/main")(app, deviceManagerUrl, deviceInfo);

                            //var server = app.listen(8000, function(){
                              //console.log("server started");  
                            //});

                        }
                    });
                } else {
                    console.log(err.toString());
                    callback(err);
                }
            });
        }
}

function start(deviceInfo){
  require("./router/main")(app, deviceManagerUrl, deviceInfo);
  var server = app.listen(8000, function(){
    console.log("server started");  
  });
}




