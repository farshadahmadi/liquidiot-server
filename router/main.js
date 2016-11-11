  /**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 */


"use strict"

module.exports = function(app, deviceManagerUrl, deviceInfo) {

  var fs = require("fs.extra");
  var rimraf = require("rimraf");
  var portscanner = require("portscanner");
  var request = require("request");
  var multer = require("multer");
  var ncp = require("ncp").ncp;
  var path = require("path");
  var tar = require("tar");
  var zlib = require("zlib");
  var targz = require("tar.gz");
  var upload = multer({dest:'./uploads/'});
  var dm = require("./dm")(deviceManagerUrl, deviceInfo);
  var errParser = require('stacktrace-parser');

  var reservedPorts = [];
  var allInstances = [];
  var apps = [];
  var ports = [];

  var templatesDir = "./agentServerTemplateFiles/";


  var deviceUp = false;

  fs.readFile("./config.txt", "utf8", function(err, data){
    if(err){
      console.log(err.toString());
    } else {
      var device = JSON.parse(data);
      var deviceId = device.idFromDM;
      console.log(deviceId);

      request.get(deviceManagerUrl + 'devices/id/' + deviceId, function(err, res, body){
        console.log("body " + body);
        if(err) {
          console.log(err.toString());
        } else if(res.statusCode == 200){
          var deviceApps = JSON.parse(body).apps;
          console.log('deviceApps: ' + deviceApps);

          var appsProcessed = 0;

          if(!deviceApps || deviceApps.length == 0){
            deviceUp = true;
          } else {

            deviceApps.forEach(function(appDescr, index, array){

              appDescr.targetStatus = appDescr.status;
              appDescr.status = "initializing";

              apps.push(appDescr);
              
              instanciate(appDescr, function(err, appStatus){
                console.log("555555555555555:" + appStatus);
                if(err) {
                  console.log(err.toString());
                  apps.splice(apps.indexOf(appDescr), 1);
                } else {
                  if(appStatus === "running" && appDescr.targetStatus === "paused"){
                    var targetState = { status: appDescr.targetStatus};
                    startOrStopInstance(targetState, appDescr.id, function(err, appStatus){
                      if(err){
                        console.log(err.toString());
                      } else {
                        console.log("app went to paused status");
                      }
                      //apps.push(appDescr);
                      appDescr.status = appDescr.targetStatus;
                      delete appDescr.targetStatus;
                      console.log(JSON.stringify(appDescr));
                      appsProcessed++;
                      if(appsProcessed === array.length){
                        deviceUp = true;
                      }
                    });
                  } else {
                    appDescr.status = appStatus;
                    delete appDescr.targetStatus;
                    dm.updateAppInfo(appDescr, function(err, ress){
                      if(err) {
                        console.log(err.toString());
                      } else {
                        console.log("ADD to dm response: " + ress);
                      }
                      console.log("444444: " + appStatus);
                      console.log("33333333333: " + JSON.stringify(appDescr));
                      appsProcessed++;
                      if(appsProcessed === array.length){
                        deviceUp = true;
                      }
                    });
                  }
                }
              });
            });
          }
        }
      });
    }
  });

  app.use(function(req, res, next){
    var flag = false;
    //if(req.headers.origin === "http://koodain.herokuapp.com"){
    if(req.headers.origin){
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      flag = true;
    }
    if(req.headers['access-control-request-method']) {
        res.header('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
        flag = true;
    }
    if(req.headers['access-control-request-headers']) {
        res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
        flag = true;
    }
    if(flag) {
        res.header('Access-Control-Max-Age', 60 * 60 * 24 * 365);
    }

    if(!deviceUp){
      res.status(500).send("Device is not yet up and running");
    } else{ 
      if(flag && req.method === "OPTIONS"){
        res.sendStatus(200);
      } else {
        next();
      }
    }

  });
  app.use("/app/:aid/api", function(req, res){

    var aid = parseInt(req.params.aid);
    // Here "/api" is added to the request base path url.
    // For example if "/app/<aid>/api/sayHello" is called, the request will be redirected to
    // "http://localhost:<app-port>/api/sayHello"
    var appBasePath = "/api";
    getAppDescr(aid, function(err, appDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
            if(appDescr.status === "running"){
                console.log("reqUrl " + req.url);
                var url = "http://localhost:" + ports[aid] + "/api" + req.url;
                console.log(url);
                req.pipe(request(url))
                .on('error', function(err){
                  console.log(err.toString());
                  res.status(500).send(err.toString());
                })
                .pipe(res);
            } else {
                var message = {"message":"application is not running"};
                res.status(404).send(JSON.stringify(message));
            }
        }
    });
  });

///////////////////////////////////////////////////////////////////
////////////// app Related Functions - START //////////////////////
///////////////////////////////////////////////////////////////////


  function sendAppInfoToDeviceManafer(appDescr, callback){

        var url = deviceManagerUrl + deviceInfo.id + "/apps";
        var options = {
          uri: url,
          method: 'POST',
          json: appDescr
        };

        request(options, function(err, res, body){
            if(err) {
                callback(err);
            } else if(res.statusCode == 200){
                console.log(body + " : " + typeof(body));
                callback(null, body);
                //callback(null, JSON.parse(body).status);
            }
        });
  }

  app.delete("/", function(req, res){
    spawn("shutdown", ["now"]);
    spawn("sudo", ["shutdown", "now"]);
  });


  // This method is called for deployment of application. The application should be packed
  // in tarball in .tgz format.
  app.post("/app", upload.single("filekey"), function(req, res) {
    // creating the specific id for application
    //var aid = ((new Date()).getTime()) % 1000000;
    var aid = Math.floor(Math.random() * 1000000);
    installApp(req, aid, function(err, appDescr){
      if(err) {
        res.status(500).send(err.toString());
      } else {
        appDescr.id = aid;
        appDescr.status = "initializing";
        apps.push(appDescr);

        instanciate(appDescr, function(err, appStatus){
          if(err) {
            res.status(500).send(err.toString());
          } else {
            appDescr.status = appStatus;
            dm.addAppInfo(appDescr, function(err, ress){
              if(err) {
                console.log(err.toString());
              } else {
                console.log("ADD to dm response: " + ress);
              }
	      if(appStatus == "crashed"){
                res.status(500).send(JSON.stringify(appDescr));
	      } else {
                res.status(200).send(JSON.stringify(appDescr));
	      }
            });
          }
        });
      }
    });
  });


  function installApp(req, aid, callback) {

    createAppDir(aid, function(err){
      if(err) {
        callback(err);
      } else {
        uploadApp(req, aid, function(err){
          if(err){
            callback(err);
          } else {
            extractTarFile(aid, function(err){
              if(err){
                callback(err);
              } else {
                extractAppDescription(aid, function(err, appDescription){
                    if(err){
                        callback(err);
                    } else {
                        copyFilesToAppDir(aid, function(err){
                          if(err){
                            callback(err);
                          } else {
          		    createAppServerFiles(aid, function(err){
                              if(err) {
                                callback(err);
                              } else {
                                callback(null, appDescription);
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
      }
    });
  }

  function createAppDir(aid, callback) {
    var appDir = "./app/" + aid + "/";
    var appFile = aid + ".js";

    fs.mkdir("./app", function(err){
      if(!err || (err && err.code === "EEXIST")) {
        fs.mkdir(appDir, function(err){
          if(!err || (err && err.code === "EEXIST")){
            callback();
          } else {
            callback(err);
          }
        });
      } else if (err) {
        callback(err);
      }
    });
  }

  function uploadApp(req, aid, callback) {

    if(req.file) {
      var tmpPath = req.file.path;
      var targetPath = "./app/" + aid + "/" + aid + ".tgz";
      fs.rename(tmpPath, targetPath, function(err){
        if(err) {
          callback(err)
        } else {
          callback();
        }
      });
      
    } else {
      callback(new Error("File is empty"));
    }
  }

  function extractTarFile(aid, callback) {
    var tarFile = "./app/" + aid + "/" + aid + ".tgz";
    var target = "./app/" + aid;

    fs.createReadStream(tarFile)
                 .on("error", function(err){ callback(err); })
                 .pipe(zlib.Gunzip())
                 .pipe(tar.Extract({ path : target }))
                 .on("end", function(){ callback(); });
  }

  function extractAppDescription(aid, callback) {
    var appDir = "./app/" + aid + "/";
    fs.readdir(appDir, function(err, files){
      if(err){
            callback(err);
      } else {
        files.map(function(file){
          return path.join(appDir, file);
        }).filter(function(file){
          return (fs.statSync(file).isDirectory());
        }).forEach(function(file){
          fs.readFile(file + "/package.json", "utf8", function(err, src){
            if(err) {
                callback(err);
            } else {
              try{
                var appDescr = JSON.parse(src);
                if(appDescr.main) {
                    fs.stat(file + "/" + appDescr.main, function(err, stat){
                        if(err){
                            callback(err);
                        } else {
                            fs.readFile(file + "/liquidiot.json", "utf8", function(err, src){
                                if(err){
                                  callback(err);
                                } else {
                                  try{
                                    var liquidiotJson = JSON.parse(src);
				    console.log("liquidiotJson: " + liquidiotJson);
                                    if(liquidiotJson.applicationInterfaces) {
                                      appDescr.applicationInterfaces = liquidiotJson.applicationInterfaces;
                                      callback(null, appDescr);
                                    } else {
                                      callback(new Error("Package.json format is incorrect. No Main entry."));
                                    }
                                  } catch(error){
                                    callback(error);
                                  }
                                }
                            });
                            //callback(null, appDescr);
                        }
                    });

                } else {
                    callback(new Error("Package.json format is incorrect. No Main entry."));
                }
              } catch(e){
                callback(e);
              }
            }
          });
        });
      }
    });
  }

  function copyFilesToAppDir(aid, callback){
    var appDir = "./app/" + aid + "/";
    var appTarFile = aid + ".tgz";
    
    fs.readdir(appDir, function(err, files){
      if(err){
            callback(err);
      } else {
        files.map(function(file){
          return path.join(appDir, file);
        }).filter(function(file){
          return (fs.statSync(file).isDirectory() && file !== "instance");
        }).forEach(function(file){
          ncp(file, appDir, function(err){
            if(err){
              callback(err);
            } else {
              rimraf(file, function(err){
                if(err){
                  callback(err);
                } else {
                  rimraf(appDir + appTarFile, function(err){
                    if(err){
                      callback(err);
                    } else {
                      callback(null);
                    }
                  });
                }
              });
            }
          });
        });
      }
    });
  }

  function createAppServerFiles(appId, callback) {

    var aid = appId;
    var appDir = "./app/" + aid + "/";

    ncp(templatesDir, appDir, function(err){
        if(err){
            callback(err)
        } else {
            callback();
        }
    }); 
  }

  app.get("/app", function(req, res) {
    var resString = JSON.stringify(apps);
    res.status(200).send(resString);
  });

  app.delete("/app", function(req, res) {
    deleteApps(function(err){
      if(err){
        res.status(500).send(err.toString());
      } else {
        res.status(200).send("all apps deleted.");
      }
    });
  });

  function deleteApps(callback) {
    console.log("deletapps is called");
    if(apps.length == 0) {
      callback();
    } else {
      for(var i in apps) {
        //console.log(apps[i].id);
        deleteApp(apps[i], function(err){
          if(err) {
           callback(err);
          } else {
            console.log("length: " + apps.length);
            if(apps.length == 0) {
              console.log("length: " + apps.length);
              callback();
            }
          }
        });
      }
    }
  }


///////////////////////////////////////////////////////////////////
////////////// app Related Functions - END ////////////////////////
///////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////
////////////// Specific app Related Functions - START /////////////
///////////////////////////////////////////////////////////////////

  app.post("/app/:aid", upload.single("filekey"), function(req, res){    
    var aid = parseInt(req.params.aid);
    //console.log(aid);
    getAppDescr(aid, function(err, appDescr){
        if(err){
            res.status(404).send(err.toString());
        } else {

            deleteApp(appDescr, function(err){
              if(err) {
                callback(err);
              } else {

                    installApp(req, aid, function(err, appDescr){
                      if(err) {
                        res.status(500).send(err.toString());
                      } else {
                        appDescr.id = aid;
                        //appDescr.instances = [];
                        apps.push(appDescr);
                        console.log("1.appDescr: " + JSON.stringify(appDescr));
                          instanciate(appDescr, function(err){
                            if(err) {
                              // we should delete the initializing instace from the app instances list
                              res.status(500).send(err.toString());
                            } else {
                              //res.status(200).send(iid.toString());
                              res.status(200).send(JSON.stringify(appDescr));

                            }
                          });
                      }
                    });
              }
            });
        }
    });
  });

///////////////////////////////////////////////////////////////////
////////////// Specific app Related Functions - END ///////////////
///////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////
////////////// Instance Related Functions - START /////////////////
///////////////////////////////////////////////////////////////////

  function getAppDescr(aid, callback){
      //for(var i in apps){
      for(var i = 0; i < apps.length; i++){
          if(apps[i].id === aid){
              callback(null, apps[i]);
              return;
          }
      }
      callback(new Error("App not found."));
  }

  function appIndexOf(searchTerm, property){
      for(var i = 0; i < apps.length; i++){
          if(apps[i][property] === searchTerm){
              return i;
          }
      }
      return -1;
  }

  function instanciate(appDescr, callback) {
    var aid = appDescr.id;
    portscanner.findAPortNotInUse(deviceInfo.startportrange, deviceInfo.endportrange, "127.0.0.1", function(err, port){
      if(!err) {
        console.log("before:" + reservedPorts[port]);
        console.log("port: " + port);
        var appDir = "./app/" + aid + "/";
        if (reservedPorts[port] === undefined) {
          reservedPorts[port] = true;
          ports[aid] = port;

          console.log("after: " + reservedPorts[port]);
          
          console.log("instace: " + JSON.stringify(appDescr));

          console.log("2.port:" + port);
          createAppServer(aid, appDescr, port, function(err, appStatus, deploymentErr){
	    //if(err){
	      //callback(err, appStatus);
	    //} else {
              callback(null, appStatus, deploymentErr);
	    //}
          });
        } else {
          instanciate(appDescr, callback);
        }
      } else {
        callback(err);
      }
    });
  }
    
  process.on("uncaughtException", function(error){
    console.log("One Error is thrown."); 
    var appErr = errParser.parse(error.stack);
    if(appErr[0].file.indexOf('/app/') != -1 && appErr[0].file.indexOf('/main.js') != -1){
      
      var fileName = appErr[0].file;
      var start = fileName.indexOf('/app/') + 5;
      var end = fileName.indexOf('/main.js');
      var idOfApp = Number(fileName.substring(start, end));
      
      var appDir1 = "./app/" + idOfApp + "/";
      console.log(idOfApp + ":::" + error.stack);
      
      getAppDescr(idOfApp, function(err, appDescr){
          if(err) {
              console.log(error.toString());
          } else {

            if(appDescr.status == "initializing"){
              fs.appendFileSync(appDir1 + "debug.log", error.stack + "\n", "utf8");
              console.log("aid from initializing: " + idOfApp);
              appDescr.status = "crashed";
              allInstances[idOfApp].server.close();
              delete allInstances[idOfApp];
              delete reservedPorts[ports[idOfApp]];
              callbacks[idOfApp](null, "crashed", err);
            } else if(appDescr.status == "running") {

              fs.appendFileSync(appDir1 + "debug.log", error.stack + "\n", "utf8");
              fs.appendFileSync(appDir1 + "debug.log", "stopping the application due to error ...\n", "utf8");
              
              startOrStopInstance({status: "paused"}, idOfApp, function(err){
                if(err){
                  console.log(err);
                } else {
                  console.log("aid from runtime: " + idOfApp);
                  appDescr.status = "crashed";
                  dm.updateAppInfo(appDescr, function(err, response){
                    if(err){
                      console.log(err.toString());
                    } else {
                      console.log("update on dm response: " + response);
                    }
                  });
                  allInstances[idOfApp].server.close();
                  delete allInstances[idOfApp];
                  delete reservedPorts[ports[idOfApp]];
                }
              });
            } else if(appDescr.status == "crashed") {
              fs.appendFileSync(appDir1 + "debug.log", error.stack + "\n", "utf8");
            }
          }
      });
    } else {
      console.log("Error not regarding apps is thrown:");
      throw error;
    }
  });

  // This array will store callbacks sent to createAppServer function.
  // The callbacks will be used when error thrown to process.on("uncaughtException")
  // not at all a good idea. But since all apps are running in one thread error handling is an issue.
  // TO DO: to come up with a better idea for error handling
  var callbacks = [];

  function createAppServer(aid, appDescr, port, callback){

    callbacks[aid] = callback;

    var appDirForRequire = "../app/" + aid + "/";
    var appDir = "./app/" + aid + "/";
    var startServerFile = "agentserver_router.js";

    console.log("availabe port at: " + port);
    
    var ex = require('express');
    var app1 = ex();

    var EventEmitter = require('events').EventEmitter;
    var emitter = new EventEmitter();

    require(appDirForRequire + startServerFile)(app1, port, appDescr, deviceManagerUrl, appDir, emitter);

    allInstances[aid] = app1;
    
    emitter.on('started', function(){
      if(appDescr.status == "initializing"){
        appDescr.status = "running";
        console.log("from init to running");
        callback(null, "running");
      }
    });
  }
  

///////////////////////////////////////////////////////////////////
////////////// Instance Related Functions - END ///////////////////
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
//////// Specific Instance Related Functions - START //////////////
///////////////////////////////////////////////////////////////////

  app.delete("/app/:aid", function(req, res){
    var aid = parseInt(req.params.aid);

    getAppDescr(aid, function(err, appDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {

          deleteApp(appDescr, function(err){
            if(err) {
              res.status(500).send(err.toString());
            } else {
              dm.removeAppInfo(appDescr, function(err, response){
                if(err){
                  console.log(err.toString());
                } else {
                  console.log("RAMOVE from dm response: " + response);
                }
		            res.status(200).send("App is deleted.");
              });
            }
          });

        }
    });
  });

  function deleteApp(appDescr, callback){

    var aid = appDescr.id;
    var appDir = "./app/" + aid;
    
    rimraf(appDir, function(err){
      if(err) {
        console.log(err.toString());
        callback(err);
      } else {
        if(appDescr.status == "crashed") {
          apps.splice(apps.indexOf(appDescr), 1);
          callback(null);
        } else {
          startOrStopInstance({status: "paused"}, aid, function(err){
            if(err){
              callback(err);
            } else {
           // if(appDescr.status !== "crashed"){
              allInstances[aid].server.close();
              delete allInstances[aid];
              delete reservedPorts[ports[aid]];
            //}
              apps.splice(apps.indexOf(appDescr), 1);
              callback(null);
            }
          });
        }
      }
    });
  }

  app.get("/app/:aid", function(req, res){
    var aid = parseInt(req.params.aid);

    getAppDescr(aid, function(err, appDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
            console.log("appDescr: " + JSON.stringify(appDescr));
            if(appDescr.status == "crashed" || appDescr.status == "initializing"){
                res.status(200).send(JSON.stringify(appDescr));
            } else {
                getAppStatus(aid, function(err, appStatus){
                    if(err){
                        res.status(404).send(err.toString());
                    } else {
                        appDescr.status = appStatus;
                        console.log("appStatus: " + appStatus);
                        console.log("2nd appDescr: " + JSON.stringify(appDescr));
                        res.status(200).send(JSON.stringify(appDescr));
                    }
                }); 
            }
        }
    });
  });

  function getAppStatus(aid, callback) {
    var url = "http://localhost:" + ports[aid] + "/";
    console.log("url: " + url);
    request.get(url, function(err, res, body){
      if(err) {
          callback(err);
      } else if(res.statusCode == 200){
          //console.log(JSON.parse(body).status);
          callback(null, JSON.parse(body).status);
      } else {
          callback(new Error("statusCode error"))
      }
    });
  }


  app.get("/app/:aid/log", function(req, res){
    var aid = parseInt(req.params.aid);
    var appDir = "./app/" + aid + "/";

    getAppDescr(aid, function(err, appDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
            fs.readFile(appDir + "debug.log", "utf8", function(err, data){
                if(err){
                    res.status(500).send(err.toString());
                } else {
                    var mes = {message: data};
                    //res.status(200).send(data);
                    res.status(200).send(JSON.stringify(mes));
                }
            });
        }
    });
  });


  app.put("/app/:aid", function(req, res){
    var aid = parseInt(req.params.aid);

    getAppDescr(aid, function(err, appDescr){
        if(err){
            res.status(404).send(err.toString());
        } else {
            if(appDescr.status == "crashed" || appDescr.status == "initializing"){
                res.status(500).send(JSON.stringify(appDescr))
            } else {
              var data = "";

              req.on("data", function(chunk){
                data += chunk;
              });

              req.on("end", function(){
                var targetState = JSON.parse(data);
                startOrStopInstance(targetState, aid, function(err, appStatus){
                  if(err){
                    res.status(500).send(err.toString());
                  } else {
                    appDescr.status = appStatus;
                    //var appIndex = appIndexOf(aid, "id");
                    dm.updateAppInfo(appDescr, function(err, response){
                      if(err){
                        console.log("update erro: " + err.toString());
                      } else {
                        console.log("update on dm response: " + response);
                      }
	                res.status(200).send(JSON.stringify(appDescr));
                    });
                  }
                });
              });
           }
        }
    });
  });

  function startOrStopInstance(targetState, aid, callback){

        var url = "http://localhost:" + ports[aid] + "/";

        var options = {
          uri: url,
          method: 'PUT',
          json: targetState
        };

        if(targetState.status === "running" || targetState.status === "paused") {
            request(options, function(err, ress, body){
                if(err) {
                    callback(err);
                } else if(ress.statusCode == 200){
                    console.log(body + typeof(body));
                    callback(null, body.status);
                    //callback(null, JSON.parse(body).status);
                } else if(ress.statusCode == 204) {
                    callback(null, "running");
                } else {
                    callback(new Error("error"));
                }
            });
        } else {
            callback(new Error("The content of request should be running or paused"));
        }
  }

///////////////////////////////////////////////////////////////////
//////// Specific Instance Related Functions - END ////////////////
///////////////////////////////////////////////////////////////////

}

