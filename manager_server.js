/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farsad.ahmadi.gh@gmail.com>
 */


var fs = require("fs.extra");
var request = require("request");
var express = require("express");
var app = express();

/*<<<<<<< HEAD
var deviceManagerUrl = "http://192.168.1.10:3000/";
var backendUrl = "https://farshadahmadi:4liquidIoTProject@my.iot-ticket.com/api/v1/devices"

=======
>>>>>>> dev*/

getDeviceInfo(function(err, deviceInfo){
    if(err){
        console.log(err.toString());
    } else {
        //console.log(deviceInfo);
        getDeviceManagerInfo(function(err, deviceManagerInfo){
            if(err){
                console.log(err.toString());
            } else {
                //console.log(deviceManagerInfo);

		registerToDeviceManager(deviceInfo, deviceManagerInfo, function(err){
	            if(err){
	                console.log(err.toString());
	            } else {
                        
                        getBackendInfo(function(err, backendInfo){
                            if(err){
                                console.log(err.toString());
                            } else {
                                //console.log(backendInfo);
	                        registerToBackend(deviceInfo, backendInfo, function(err){
	                            if(err){
	                                console.log(err.toString());
	                            } else {
        	                        start(deviceInfo, deviceManagerInfo);
	                            }
	                        });
                            }
                        });
	            }
        	});
            }
        });
    }
});

function getDeviceInfo(callback){
    fs.readFile("./config.txt", "utf8", function(err, deviceData){
        if(err){
            callback(err);
        } else {
            var deviceInfo = JSON.parse(deviceData);
            callback(null, deviceInfo)
        }
    });
}

function getDeviceManagerInfo(callback){
    fs.readFile("./dm-config.txt", "utf8", function(err, deviceManagerData){
        if(err){
            callback(err);
        } else {
            var deviceManagerInfo = JSON.parse(deviceManagerData);
            callback(null, deviceManagerInfo);
        }
    });
}

function getBackendInfo(callback){
    fs.readFile("./backend-config.txt", "utf8", function(err, backendData){
        if(err){
            callback(err);
        } else {
            var backendInfo = JSON.parse(backendData);
            callback(null, backendInfo);
        }
    });
}

function registerToDeviceManager(deviceInfo, deviceManagerInfo, callback){
        if(deviceInfo.idFromDM){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            console.log("already registered to DM");
            callback(null)
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.
            
            var options = {
                uri: deviceManagerInfo.url,
                method: 'POST',
                json: deviceInfo
            };

            request(options, function(err, res, body){
                if(!err && res.statusCode == 200) {
                    //console.log(body);
                    deviceInfo.idFromDM = body.toString();
                    fs.writeFile("./config.txt", JSON.stringify(deviceInfo), function(err){
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

function registerToBackend(deviceInfo, backendInfo, callback){
        if(deviceInfo.idFromBackend){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            console.log("already registered to Backend");
            callback(null);
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.
            var reqContent = {"name":deviceInfo.name,"manufacturer":deviceInfo.manufacturer};
            var backendUrl = backendInfo.url;

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
                  
                    deviceInfo.idFromBackend = body.deviceId;
                    fs.writeFile("./config.txt", JSON.stringify(deviceInfo), function(err){
                        if(err){
                            console.log(err.toString());
                            callback(err);
                        } else {
                            console.log("now registered to backend");
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

function start(deviceInfo, deviceManagerInfo){
  require("./router/main")(app, deviceManagerInfo.url, deviceInfo);
  console.log(deviceManagerInfo.url);
  var server = app.listen(deviceInfo.port, function(){
    console.log("server started");  
  });
}




