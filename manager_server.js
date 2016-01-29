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


fs.readFile("./config.txt", "utf8", function(err, data){
    if(err){
        console.log(err.toString());
    } else {
        var deviceInfo = JSON.parse(data);

        if(deviceInfo.id){
            // If the device info has an id, it means that it has been already added to device manager server.
            // The device info should be checked on the server, may be, there is a need to update the info.
            require("./router/main")(app);
            var server = app.listen(8000, function(){
              console.log("server started");  
            });
        } else {
            // The device info should be added to the device manager server. Server will create an ID.
            // Then the id will be added to the device info file.

            console.log(data);
            //var deviceManagerUrl = "http://localhost:3000/";
            var deviceManagerUrl = "http://130.230.142.101:3000/";
            var options = {
                uri: deviceManagerUrl,
                method: 'POST',
                json: deviceInfo
            };

            request(options, function(err, res, body){
                if(!err && res.statusCode == 200) {
                    console.log(body);
                    deviceInfo.id = body.toString();
                    fs.writeFile("./config.txt", JSON.stringify(deviceInfo), function(err){
                        if(err){
                            console.log(err.toString());
                        } else {
                            //console.log("config file updated.");
                            require("./router/main")(app);

                            var server = app.listen(8000, function(){
                              console.log("server started");  
                            });

                        }
                    });
                } else {
                    console.log(err.toString())
                }
            });
        }
    }
});

