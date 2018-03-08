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
  var fsExtra = require('fs-extra');
  var rp = require('request-promise');
  var npm = require('npm');
  var fsp = require('fs-extra-promise');
  var _ = require('lodash');
  var tmp = require('tmp');
  var rimraf = require('rimraf');
  var mkdirp = require('mkdirp');

  var reservedPorts = [];
  var allInstances = [];
  //var apps = [];
  var apps = {};
  var ports = [];

  var templatesDir = "./agentServerTemplateFiles/";


  var deviceUp = false;

  fs.readFile("./device.txt", "utf8", function(err, devApps){
    console.log("body " + devApps);
    var env = {blue: "blue", green: "green"};
    if(!err){
      if(devApps == "{}"){
        deviceUp = true;
      } else {
        var deviceApps = JSON.parse(devApps);
        console.log('deviceApps: ' + deviceApps);
        var appsProcessed = 0;

        var appIds = Object.keys(deviceApps);
        appIds.forEach(function(appId, index){
          var appDescr = deviceApps[appId].blue;
          if(appDescr.status == "crashed"){
            apps[appId] = apps[appId] || {};
            apps[appId][env.blue] = appDescr;

            allInstances[appId] = allInstances[appId] || {};
            allInstances[appId][env.blue] = {};
            appsProcessed++;
          } else if (appDescr.status == "paused"){
            appDescr.firstStartAfterCrash = true;
            //appDescr.firstDeleteAfterCrash = true;
            
            apps[appId] = apps[appId] || {};
            apps[appId][env.blue] = appDescr;
            
            allInstances[appId] = allInstances[appId] || {};
            allInstances[appId][env.blue] = {};
            appsProcessed++;
          } else if (appDescr.status == "running"){
            appDescr.status = "installed";
            instanciate(appDescr, env.blue, function(err, appStatus, deploymentErr){
              if(err) {
                console.log(err.toString());
              } else {
                appDescr.status = appStatus;
                apps[appId] = apps[appId] || {};
                apps[appId][env.blue] = appDescr;
              }
              appsProcessed++;
            });
          }
          var greenAppDescr = deviceApps[appId].green;
          if(greenAppDescr){
            if(greenAppDescr.status == "crashed"){
              apps[appId] = apps[appId] || {};
              apps[appId][env.green] = greenAppDescr;
            } else if (greenAppDescr.status == "paused"){
              greenAppDescr.firstStartAfterCrash = true;
              apps[appId] = apps[appId] || {};
              apps[appId][env.green] = greenAppDescr;
            }
          }
        });
        var timer = setInterval(function(){
          if(appsProcessed === appIds.length){
            deviceUp = true;
            clearInterval(timer);
          }
        });
      }
    } else if(err.code == "ENOENT"){
      console.log(err.toString());
      deviceUp = true;
    } else {
      console.log(err.toString());
    }
  });

  app.use(function(req, res, next){
    console.log('origin');
    console.log(req.get('host'));
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

  var bodyParser = require('body-parser');
  app.use(bodyParser.json());

  app.use("/app/:aid/api", function(req, res){

    //console.log("bodyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy");
    //console.log(req.body)

    //var data = "";
    
    //req.on("data", function(chunk){
      //data += chunk;
    //});

    //req.on("end", function(){

    //var d =  JSON.parse(data);
    //console.log("bodyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy");
    //console.log(d);

    var aid = parseInt(req.params.aid);
    var env = "blue";
    // Here "/api" is added to the request base path url.
    // For example if "/app/<aid>/api/sayHello" is called, the request will be redirected to
    // "http://localhost:<app-port>/api/sayHello"
    var appBasePath = "/api";
    getAppDescr(aid, function(err, appDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
          var blueAppDescr = appDescr.blue;
            if(blueAppDescr.status === "running"){
                console.log("reqUrl " + req.url);
                var url = "http://localhost:" + ports[aid][env] + "/api" + req.url;
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

    //});

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
    console.log("deploy is called");
    console.log(JSON.stringify(req.body));
    // creating the specific id for application
    var environment = "blue";
    var aid = Math.floor(Math.random() * 1000000);
    installApp_P(req, aid, environment)
      .then(function(appDescr){
        appDescr.id = aid;
        appDescr.status = "installed";
        appDescr.canRollback = false;
        apps[aid] = {};
        apps[aid][environment] = appDescr;

        dm.addAppInfo(appDescr, function(err, ress){ //
          if(err) { //
            console.log(err.toString()); //
          } else { //
            console.log("ADD to dm response: " + ress); //
          } //
          fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8"); //
          instanciate(appDescr, environment, function(err, appStatus, deploymentErr){
            if(err) {
              res.status(500).send(err.toString());
            } else {
              if(appStatus == "installed"){
                res.status(500).send(JSON.stringify(appDescr));
              } else {
                appDescr.status = appStatus;
                dm.updateAppInfo(appDescr, function(err, ress){
                  if(err) {
                    console.log(err.toString());
                  } else {
                    console.log("ADD to dm response: " + ress);
                  }
                  fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
                  if(appStatus == "crashed"){
                    // We can also sent back deployment error (deploymentErr) here.
                    res.status(500).send(JSON.stringify(appDescr));
                  } else {
                    res.status(200).send(JSON.stringify(appDescr));
                  }
                });
              }
            }
          });
        });
      })
      .catch(function(err){
        console.log(err.toString());
        res.status(500).send(err.toString());
      });
  });

  function installApp_P(req, aid, environment) {

    function onCopyFilesToAppDir(appDescription){
      return createAppServerFiles_P(aid, environment)
                .then(function(res){
                  console.log(res);
                  return appDescription;
                });
    }

    function onGetAppDescr(appDescription){
      return copyFilesToAppDir_P(aid, environment)
                .then(function(res){
                  console.log(res);
                  return onCopyFilesToAppDir(appDescription);
                });
    }
    
    function onAddSyncId(appDescription, aid, env){
      var options = "./app/" + aid + "/" + env + "/package/liquid-options.json";
      fs.readFile(options, 'utf8', function(err, data){
	if(err) console.log("Error at reading syncID: " + err);
	var jsondata = JSON.parse(data);
	appDescription["syncID"] = jsondata["syncID"];
      });
      return appDescription;
    }
    
    return createAppDir_P(aid, environment)
      .then(function(res){
        console.log(res);
        return uploadApp_P(req, aid, environment);
      })
      .then(function(res){
        console.log(res);
        return extractTarFile_P(aid, environment);
      })
      .then(function(res){
        console.log(res);
        return extractAppDescription_P(aid, environment);
      })
      .then(function(appDescription){
	console.log("Description before syncID: " + appDescription);
	return onAddSyncId(appDescription, aid, environment);
      })
      .then(onGetAppDescr);
  }

  function createAppDir_P(aid, environment) {
    var blueGreenAppDir = "./app/" + aid + "/";
    var appDir = "./app/" + aid + "/" + environment + "/";

    return fsExtra.ensureDir(appDir);

  }
  
  function uploadApp_P(req, aid, environment) {

    if(req.file) {
      var tmpPath = req.file.path;
      var targetPath = "./app/" + aid + "/" + environment + "/" + aid + ".tgz";
      return fsExtra.rename(tmpPath, targetPath);
    } else {
      throw new Error("File is empty");
    }
  }
  
  function extractTarFile_P(aid, environment) {
    return new Promise(function(resolve, reject){
      var tarFile = "./app/" + aid + "/" + environment + "/" + aid + ".tgz";
      var target = "./app/" + aid + "/" + environment;

      fs.createReadStream(tarFile)
                   .on("error", function(err){ reject(err); })
                   .pipe(zlib.Gunzip())
                   .pipe(tar.Extract({ path : target }))
                   .on("end", function(){ resolve(); });
    });
  }

  function onReadLiquidIoT (appDescr, src){
    var liquidiotJson = JSON.parse(src);
    console.log("liquidiotJson: " + src);
    if(liquidiotJson.applicationInterfaces) {
      appDescr.applicationInterfaces = liquidiotJson.applicationInterfaces;
      return appDescr;
    } else {
      throw new Error("Package.json format is incorrect. No Main entry.");
    }
  }

  function onReadPackage(dir, src){
    var appDescr = JSON.parse(src);
    if(appDescr.main){
      return fsExtra.readFile(dir + "/liquidiot.json", "utf8")
        .then(function(lsrc){
          return onReadLiquidIoT(appDescr, lsrc);
          //console.log('s1: ' + JSON.stringify(s));
          //return s;
        });
    } else {
      throw new Error("Package.json format is incorrect. No Main entry.");
    }
  }

  function onGetExtractedTarFile(dir){
    console.log('dir: ' + dir);
    return fsExtra.readFile(dir + "/package.json", "utf8")
              .then(function(src){
                return onReadPackage(dir, src);
                //console.log('s2: ' + JSON.stringify(s));
                //return s;
              });
  }

  function extractAppDescription_P(aid, environment) {
    var appDir = "./app/" + aid + "/" + environment + "/";
    
    return fsExtra.readdir(appDir)
      .then(function(files){
        return files.map(function(file){
          return path.join(appDir, file);
        }).filter(function(file){
          return (fs.statSync(file).isDirectory());
        })[0];
      })
      .then(onGetExtractedTarFile)
      .then(function(res){
        console.log('res: ' + JSON.stringify(res));
        return res;
      });
  }

  function copyFilesToAppDir_P(aid, environment){
    var appDir = "./app/" + aid + "/" + environment + "/";
    var appTarFile = aid + ".tgz";

    console.log('appDir: ' + appDir);
    
    return fsExtra.remove(appDir + appTarFile)
      .then(function(){
        return fsExtra.readdir(appDir);
      }).then(function(files){
        //console.log('extractedTarfile :' + path.join( appDir,files[0]));
        return path.join(appDir,files[0]);
      }).then(function(extractedTarFile){
        console.log('extractedTarfile: ' + extractedTarFile);
        return fsExtra.copy(extractedTarFile, appDir)
          .then(function(){
            return fsExtra.remove(extractedTarFile);
          });
      });
  }

  function createAppServerFiles_P(appId, environment) {

    var aid = appId;
    var appDir = "./app/" + aid + "/" + environment + "/";
    
    return fsExtra.copy(templatesDir,appDir);
  }

  app.get("/app", function(req, res) {
    var resString = JSON.stringify(apps);
    res.status(200).send(resString);
  });

///////////////////////////////////////////////////////////////////
////////////// app Related Functions - END ////////////////////////
///////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////
////////////// Specific app Related Functions - START /////////////
///////////////////////////////////////////////////////////////////

  app.post("/app/:aid/rollback", upload.single("filekey"), function(req, res){
    console.log("rollback is called");
    var aid = parseInt(req.params.aid);
    var env = {blue: "blue", green: "green"};
    //console.log(aid);
    
    getAppDescr(aid, function(err, appDescr){
      if(err){
        res.status(404).send(err.toString());
      } else {

        rollbackApp(aid, appDescr, function(err, updatedAppDescr){
          if(err){
            res.status(500).send(err.toString());
          } else {

            dm.updateAppInfo(updatedAppDescr, function(err, ress){
              if(err) {
                console.log(err.toString());
              } else {
                console.log("ADD to dm response: " + ress);
              }
              fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
              if(updatedAppDescr.status == "crashed"){
                // We can also sent back deployment error (deploymentErr) here.
                res.status(500).send(JSON.stringify(updatedAppDescr));
              } else {
                res.status(200).send(JSON.stringify(updatedAppDescr));
              }
            });
          }
        });
      }
    });
  });


  function rollbackApp(aid, appDescr, callback){

    var env = {blue: "blue", green: "green"};
    var blueAppDescr = appDescr.blue;
    console.log(" app description before rollback: " + JSON.stringify(appDescr));

    if(!blueAppDescr.canRollback){
      callback(new Error('There is no previous deployed version to rollback or the previous version is crashed'));
    } else {

      startOrStopInstance({status: "paused"}, aid, env.blue, function(err, blueAppStatus){
        if(err){
          //res.status(500).send(err.toString());
          callback(err);
        } else {
          /*console.log("result of stop status: " + blueAppStatus);
          blueAppDescr.status = blueAppStatus;
          console.log("bbbbbbbbbbbbbbbbbbb:" + JSON.stringify(blueAppDescr));
          var greenAppDescr = appDescr.green;
          if(greenAppDescr.status == "crashed"){
            console.log("greeeeeen apppp isss crashed");
            greenAppDescr.canRollback = false;

            exchangeBlueGreen(aid, blueAppStatus, function(err){
              if(err){
                //res.status(500).send(err.toString());
                callback(err);
              } else {
                callback(null, greenAppDescr);
              }
            });
          } else {*/
            blueAppDescr.status = blueAppStatus;
            var greenAppDescr = appDescr.green;
            if(greenAppDescr.firstStartAfterCrash){
              delete greenAppDescr.firstStartAfterCrash;
              greenAppDescr.status = "installed";
              instanciate(greenAppDescr, env.green, function(err, greenAppStatus, deploymentErr){
                if(err) {
                  console.log(err.toString());
                } else {
                  greenAppDescr.status = greenAppStatus;
                  greenAppDescr.canRollback = false;

                  exchangeBlueGreen(aid, blueAppStatus, function(err){
                    if(err){
                      //res.status(500).send(err.toString());
                      callback(err);
                    } else {
                      callback(null, greenAppDescr);
                    }
                  });
                }
              });
            } else {
              startOrStopInstance({status: "running"}, aid, env.green, function(err, greenAppStatus){
                if(err){
                  //res.status(500).send(err.toString());
                  callback(err);
                } else {
                  greenAppDescr.status = greenAppStatus;
                  greenAppDescr.canRollback = false;

                  exchangeBlueGreen(aid, blueAppStatus, function(err){
                    if(err){
                      //res.status(500).send(err.toString());
                      callback(err);
                    } else {
                      callback(null, greenAppDescr);
                    }
                  });
                }
              });
            }
         // }
        }
      });
    }
    //var greenAppDescr = appDescr.green;
  }

  app.post("/app/:aid", upload.single("filekey"), function(req, res){
    console.log("update is called");
    var aid = parseInt(req.params.aid);
    var env = {blue: "blue", green: "green"};
    //console.log(aid);
    
    getAppDescr(aid, function(err, appDescr){
      if(err){
        res.status(404).send(err.toString());
      } else {
        console.log("first blue app Description: " + JSON.stringify(appDescr.blue));
        updateApp(req, aid, appDescr, function(err, updatedAppDescr){
          if(err){
            res.status(500).send(err.toString());
          } else {

            dm.updateAppInfo(updatedAppDescr, function(err, ress){
              if(err) {
                console.log(err.toString());
              } else {
                console.log("ADD to dm response: " + ress);
              }
              fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
              if(updatedAppDescr.status == "crashed"){
                // We can also sent back deployment error (deploymentErr) here.
                res.status(500).send(JSON.stringify(updatedAppDescr));
              } else {
                res.status(200).send(JSON.stringify(updatedAppDescr));
              }
            });
          }
        });
/*        var blueAppDescr = appDescr.blue;
        var greenAppDescr = appDescr.green;
        if(!greenAppDescr){
          startOrStopInstance({status: "paused"}, aid, env.blue, function(err){
            if(err){
              res.status(500).send(err.toString());
            } else {
              installApp(req, aid, env.green, function(err, greenAppDescr){
                if(err) {
                  res.status(500).send(err.toString());
                } else {
                  greenAppDescr.id = aid;
                  greenAppDescr.status = "installed";
                  apps[aid][env.green] = greenAppDescr;

                  instanciate(greenAppDescr, env.green, function(err, appStatus, deploymentErr){
                    if(err) {
                      res.status(500).send(err.toString());
                    } else {
                      greenAppDescr.status = appStatus;

                      //if(appStatus == "running"){
                      exchangeBlueGreen(aid, function(err){
                        if(err){
                          res.status(500).send(err.toString());
                        } else {
                          dm.updateAppInfo(greenAppDescr, function(err, ress){
                            if(err) {
                              console.log(err.toString());
                            } else {
                              console.log("ADD to dm response: " + ress);
                            }
                            if(appStatus == "crashed"){
                              // We can also sent back deployment error (deploymentErr) here.
                              res.status(500).send(JSON.stringify(appDescr));
                            } else {
                              res.status(200).send(JSON.stringify(appDescr));
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
        }*/
      }
    });
  });

  function updateApp(req, aid, appDescr, callback){

    var env = {blue: "blue", green: "green"};
    var blueAppDescr = appDescr.blue;
    console.log(" app description before: " + JSON.stringify(appDescr));
    //var greenAppDescr = appDescr.green;

    deleteApp(aid, appDescr, env.green, function(err){
      if(err){
        callback(err);
      } else {
        console.log("allinstances: " + JSON.stringify(allInstances[aid]));
        console.log("apps: " + JSON.stringify(apps[aid]));
        console.log("ports: " + JSON.stringify(ports[aid]));
        console.log("appDescr: " + JSON.stringify(appDescr));
        //if(!appDescr.green){
        console.log("Third blue app description: " + JSON.stringify(appDescr.blue));
        console.log("Third blue app description: " + JSON.stringify(blueAppDescr));

        //if(!blueAppDescr.firstStartAfterCrash){
          startOrStopInstance({status: "paused"}, aid, env.blue, function(err, blueAppStatus){
            if(err){
              //res.status(500).send(err.toString());
              callback(err);
            } else {
              console.log("result of stop status: " + blueAppStatus);
              blueAppDescr.status = blueAppStatus;
              console.log("bbbbbbbbbbbbbbbbbbb:" + JSON.stringify(blueAppDescr));
              
              installApp_P(req, aid, env.green).then(function(greenAppDescr){
                  greenAppDescr.id = aid;
                  greenAppDescr.status = "installed";
                  apps[aid][env.green] = greenAppDescr;
                  
                  if(blueAppStatus == "crashed"){
                    greenAppDescr.canRollback = false;
                  } else {
                    greenAppDescr.canRollback = true;
                  }
                  
                  dm.updateAppInfo(greenAppDescr, function(err, ress){ //
                    if(err) { //
                      console.log(err.toString()); //
                    } else { //
                      console.log("ADD to dm response: " + ress); //
                    } //
                    fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8"); //
                  
                    instanciate(greenAppDescr, env.green, function(err, greenAppStatus, deploymentErr){
                      if(err) {
                        callback(err);
                      } else {
                        greenAppDescr.status = greenAppStatus;
                        /*if(blueAppStatus == "crashed"){
                          greenAppDescr.canRollback = false;
                        } else {
                          greenAppDescr.canRollback = true;
                        }*/

                        console.log("gggggggggggggg:" + JSON.stringify(greenAppDescr));
                        
                        exchangeBlueGreen(aid, blueAppStatus, function(err){
                          if(err){
                            callback(err);
                          } else {
                            callback(null, greenAppDescr);
                          }
                        });
                      }
                    }); 
                  });
              }).catch(function(err){
                callback(err);
              });
            }
          });
        /*} else {
          installApp(req, aid, env.green, function(err, greenAppDescr){
            if(err) {
              //res.status(500).send(err.toString());
              callback(err);
            } else {
              greenAppDescr.id = aid;
              greenAppDescr.status = "installed";
              apps[aid][env.green] = greenAppDescr;

              instanciate(greenAppDescr, env.green, function(err, greenAppStatus, deploymentErr){
                if(err) {
                  //res.status(500).send(err.toString());
                  callback(err);
                } else {
                  greenAppDescr.status = greenAppStatus;
                  greenAppDescr.canRollback = true;

                  console.log("gggggggggggggg:" + JSON.stringify(greenAppDescr));
                  
                  //callback(null, blueAppDescr);
                  //if(appStatus == "running"){
                  exchangeBlueGreen(aid, "", function(err){
                    if(err){
                      //res.status(500).send(err.toString());
                      callback(err);
                    } else {
                      callback(null, greenAppDescr);
                    }
                  });
                }
              });
            }
          });
        }*/
      }
    });
    /*if(!greenAppDescr){
      startOrStopInstance({status: "paused"}, aid, env.blue, function(err){
        if(err){
          res.status(500).send(err.toString());
        } else {
          installApp(req, aid, env.green, function(err, greenAppDescr){
            if(err) {
              res.status(500).send(err.toString());
            } else {
              greenAppDescr.id = aid;
              greenAppDescr.status = "installed";
              apps[aid][env.green] = greenAppDescr;

              instanciate(greenAppDescr, env.green, function(err, appStatus, deploymentErr){
                if(err) {
                  res.status(500).send(err.toString());
                } else {
                  greenAppDescr.status = appStatus;

                  //if(appStatus == "running"){
                  exchangeBlueGreen(aid, function(err){
                    if(err){
                      res.status(500).send(err.toString());
                    } else {
                      dm.updateAppInfo(greenAppDescr, function(err, ress){
                        if(err) {
                          console.log(err.toString());
                        } else {
                          console.log("ADD to dm response: " + ress);
                        }
                        if(appStatus == "crashed"){
                          // We can also sent back deployment error (deploymentErr) here.
                          res.status(500).send(JSON.stringify(appDescr));
                        } else {
                          res.status(200).send(JSON.stringify(appDescr));
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
    }*/
  }

/*  function deleteGreen(aid, appDescr, callback){

    var env = {blue: "blue", green: "green"};

    deleteApp(aid, appDescr, env.green, function(err){
      if(err){
        callback(err);
      } else {
        callback(null);
      }
    });
  }*/

  function exchangeBlueGreen(aid, blueAppDescr, callback){
    var env = {blue: "blue", green: "green"};
    var blueAppDir = "./app/" + aid + "/" + env.blue;
    var greenAppDir = "./app/" + aid + "/" + env.green;
    var tempAppDir = "./app/" + aid + "/temp";

    fs.rename(blueAppDir, tempAppDir, function(err){
      if(err){
        callback(err);
      } else {
        fs.rename(greenAppDir, blueAppDir, function(err){
          if(err){
            callback(err);
          } else {
            fs.rename(tempAppDir, greenAppDir, function(err){
              if(err){
                callback(err);
              } else {
                var appTemp = apps[aid][env.green];
                apps[aid][env.green] = apps[aid][env.blue];
                apps[aid][env.blue] = appTemp;

                var portTemp = ports[aid][env.green];
                ports[aid][env.green] = ports[aid][env.blue];
                ports[aid][env.blue] = portTemp;

                var appServerTemp = allInstances[aid][env.green];
                allInstances[aid][env.green] = allInstances[aid][env.blue];
                allInstances[aid][env.blue] = appServerTemp;

                callback(null);
              }
            });
          }
        });
      }
    });
  }

///////////////////////////////////////////////////////////////////
////////////// Specific app Related Functions - END ///////////////
///////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////
////////////// Instance Related Functions - START /////////////////
///////////////////////////////////////////////////////////////////

  var errCodes = {envNotExist: "ENVNOTEXIT", appNotExist: "APPNOTEXIST", appEnvNotExist: "APPENVNOTEXIST"};

  function GetAppDescrError(msg, code){
    this.message = msg;
    this.code = code;
  }
  GetAppDescrError.prototype = new Error();

  function getAppDescr(aid, callback){
    if(apps[aid]){
      callback(null, apps[aid]);
    } else {
      callback(new GetAppDescrError("App with id " + aid + " not found.", errCodes.appNotExist));
    }
  }
  
  function getAppDescrP(aid){
    return new Promise(function(resolve, reject){
      if(apps[aid]){
        resolve(apps[aid]);
      } else {
        reject(new GetAppDescrError("App with id " + aid + " not found.", errCodes.appNotExist));
      }
    });
  }
/*  function getAppDescr(aid, env, callback){

    if(env != "blue" && env != "green"){
      //callback(new Error("Environment must be either blue or green"));
      callback(new GetAppDescrError("Environment must be either blue or green", errCodes.envNotExist));
    } else {
      if(apps[aid]){
        if(apps[aid][env]){
          callback(null, apps[aid][env]);
        } else {
          //callback(new Error("App is not running in environment " + env));
          callback(new GetAppDescrError("App is not running in environment " + env, errCodes.appEnvNotExist));
        }
      } else {
        //callback(new Error("App with id " + aid + " not found."));
        callback(new GetAppDescrError("App with id " + aid + " not found.", errCodes.appNotExist));
      }
    }
  }*/

/*  function appIndexOf(searchTerm, property){
      for(var i = 0; i < apps.length; i++){
          if(apps[i][property] === searchTerm){
              return i;
          }
      }
      return -1;
  }*/

  function instanciate(appDescr, env, callback) {
    var aid = appDescr.id;
    //var environment = appDescr.environment;
    portscanner.findAPortNotInUse(deviceInfo.startportrange, deviceInfo.endportrange, "127.0.0.1", function(err, port){
      if(!err) {
        console.log("before:" + reservedPorts[port]);
        console.log("port: " + port);
        var appDir = "./app/" + aid + "/" + env + "/";
        if (reservedPorts[port] === undefined) {
          reservedPorts[port] = true;
          //ports[aid] = port;
          ports[aid] = ports[aid] || {};
          ports[aid][env] = port;

          console.log("after: " + reservedPorts[port]);
          
          console.log("instace: " + JSON.stringify(appDescr));

          console.log("2.port:" + port);
          createAppServer(aid, appDescr, env, port, function(err, appStatus, deploymentErr){
            //if(err){
              //callback(err, appStatus);
            //} else {
            callback(null, appStatus, deploymentErr);
            //}
          });
        } else {
          instanciate(appDescr, env, callback);
        }
      } else {
        callback(err);
      }
    });
  }
    
  process.on("uncaughtException", function(error){
    //var env = "blue";
    console.log("One Error is thrown."); 
    var appErr = errParser.parse(error.stack);
    var appInBlue = appErr[0].file.indexOf('/blue/main.js');
    var appInGreen = appErr[0].file.indexOf('/green/main.js');
    var app = appErr[0].file.indexOf('/app/');
    //if(appErr[0].file.indexOf('/app/') != -1 && appErr[0].file.indexOf('/main.js') != -1){
    if((appInBlue != -1 || appInGreen != -1) && app != -1){
      
      var start = (appInBlue != -1) ? appInBlue : appInGreen;
      var end = app + 5;
      var fileName = appErr[0].file;
      //var start = fileName.indexOf('/app/') + 5;
      //var end = fileName.indexOf('/main.js');
      var idOfApp = Number(fileName.substring(start, end));
      
      //var appDir1 = "./app/" + idOfApp + "/";
      console.log(idOfApp + ":::" + error.stack);
      
      getAppDescr(idOfApp, function(err, appDescription){
          if(err) {
              console.log(error.toString());
          } else {

            //var appDir1 = "./app/" + idOfApp + "/" + appDescr.environment + "/";
            var appDir1 = "./app/" + idOfApp + "/";
            var env = (appInBlue != -1) ? "blue" : "green";
            var appDescr = appDescription[env];

            if(appDescr.status == "installed"){
              fs.appendFileSync(appDir1 + "debug.log", error.stack + "\n", "utf8");
              console.log("aid from installed: " + idOfApp);
              appDescr.status = "crashed";
              allInstances[idOfApp][env].server.close();
              //delete allInstances[idOfApp][env];
              delete reservedPorts[ports[idOfApp][env]];
              callbacks[idOfApp](null, "crashed", err);
            } else if(appDescr.status == "running") {

              fs.appendFileSync(appDir1 + "debug.log", error.stack + "\n", "utf8");
              fs.appendFileSync(appDir1 + "debug.log", "stopping the application due to error ...\n", "utf8");
              
              startOrStopInstance({status: "paused"}, idOfApp, env, function(err){
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
                  fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
                  allInstances[idOfApp][env].server.close();
                  //delete allInstances[idOfApp][env];
                  delete reservedPorts[ports[idOfApp][env]];
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

  function createAppServer(aid, appDescr, env, port, callback){

    callbacks[aid] = callback;

    //var environment = appDescr.environment;
    var appDirForRequire = "../app/" + aid + "/" + env + "/";
    //var appDir = "./app/" + aid + "/" + env + "/";
    var appDir = "./app/" + aid + "/";
    var startServerFile = "agentserver_router.js";

    console.log("availabe port at: " + port);
    
    var ex = require('express');
    var app1 = ex();

    var EventEmitter = require('events').EventEmitter;
    var emitter = new EventEmitter();
    //app1.$emitter = emitter;

    require(appDirForRequire + startServerFile)(app1, port, appDescr, deviceManagerUrl, appDir, emitter, deviceInfo);
    
    var time = setTimeout(function(){
      fs.appendFileSync(appDir + "debug.log", 'app did not specify when either initialize or task function should end' + "\n", "utf8");
      appDescr.status = "crashed";
      allInstances[aid][env].server.close();
      delete reservedPorts[ports[aid][env]];
      callback(null, "crashed", new Error('app did not specify when either initialize or task function should end'));
    }, 10000);

    //allInstances[aid] = app1;
    allInstances[aid] = allInstances[aid] || {};
    allInstances[aid][env] = app1;
    
    emitter.on('started', function(){
      if(appDescr.status == "installed"){
        clearTimeout(time);
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
    
    initiateDelete(aid, res);

  });
  
  function initiateDelete(aid, res){
    var env = {blue: "blue", green: "green"};

    getAppDescr(aid, function(err, appDescr){
      if(err){
        if(res!=null) res.status(404).send(err.toString());
      } else {
        var blueAppDescr = appDescr.blue;
        deleteApp(aid, appDescr, env.blue, function(err){
          if(err){
            if(res!=null) res.status(500).send(err.toString());
          } else {
            console.log("blue app description: " + blueAppDescr);
            dm.removeAppInfo(blueAppDescr, function(err, response){
              if(err){
                console.log(err.toString());
              } else {
                console.log("RAMOVE from dm response: " + response);
              }
              fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
              if(res!=null)res.status(200).send("App is deleted.");
	      return true;
            });
          }
        });
      }
    });
    return false;
     /*       var greenAppDescr = appDescr.green;
        var blueAppDescr = appDescr.blue;
        if(!greenAppDescr) {
          deleteAppEnv(aid, blueAppDescr, env.blue,  function(err){
            if(err) {
              res.status(500).send(err.toString());
            } else {
              dm.removeAppInfo(blueAppDescr, function(err, response){
                if(err){
                  console.log(err.toString());
                } else {
                  console.log("RAMOVE from dm response: " + response);
                }
                res.status(200).send("App is deleted.");
              });
            }
          });
        } else {
          deleteAppEnv(aid, greenAppDescr, env.green,  function(err){
            if(err) {
              res.status(500).send(err.toString());
            } else {
              deleteAppEnv(aid, blueAppDescr, env.blue,  function(err){
                if(err) {
                  res.status(500).send(err.toString());
                } else {
                  dm.removeAppInfo(blueAppDescr, function(err, response){
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
        }
      }
    });*/
  }

  function deleteApp(aid, appDescr, environment, callback){

    var env = {blue: "blue", green: "green"};
    var greenAppDescr = appDescr.green;
    var blueAppDescr = appDescr.blue;

    if(environment != env.blue && environment != env.green){
      callback(new Error('Environment should be either blue or green'));
    } else if(environment == "green"){
      console.log("first");
      if(greenAppDescr){
        console.log("Second");
        deleteAppEnv(greenAppDescr, env.green,  function(err){
          if(err) {
            callback(err);
          } else {
            console.log("third");
            callback(null);
          }
        });
      } else {
        callback(null);
      }
    } else {

      console.log("First step");
      deleteAppEnv(blueAppDescr, env.blue,  function(err){
        if(err) {
          //res.status(500).send(err.toString());
          callback(err);
        } else {
          if(greenAppDescr) {
            deleteAppEnv(greenAppDescr, env.green,  function(err){
              if(err) {
                //res.status(500).send(err.toString());
                callback(err);
              } else {
                delete apps[aid];
                callback(null);
              }
            });
          } else {
            console.log("Blue is deleted");
            console.log("Fourth Step");
            delete apps[aid];
            callback(null);
          }
        }
      });
    }
  }

  function deleteAppEnv(appDescr, env, callback){

    var aid = appDescr.id;
    var appDir = (env == "green") ? "./app/" + aid + "/green/" : "./app/" + aid + "/";
    //var appDir = "./app/" + aid + "/" + env + "/";
    
    rimraf(appDir, function(err){
      if(err) {
        console.log(err.toString());
        callback(err);
      } else {
        try {
          if(env == "green"){
            delete require.cache[require.resolve("../app/" + aid + "/green/agentserver_router.js")];
          } else {
            delete require.cache[require.resolve("../app/" + aid + "/blue/agentserver_router.js")];
          }
        } catch(e){
          console.log(e.toString());
        }

        if(appDescr.status == "crashed" || appDescr.firstStartAfterCrash) {
          delete allInstances[aid][env];
          delete apps[aid][env];
          /*if(env == "blue"){
            delete apps[aid];
          }*/
          //apps.splice(apps.indexOf(appDescr), 1);
          callback(null);
        } else {
          console.log("Second Step");
          startOrStopInstance({status: "paused"}, aid, env, function(err){
            if(err){
              callback(err);
            } else {
              console.log("Third Step");
           // if(appDescr.status !== "crashed"){
              allInstances[aid][env].server.close();
              delete allInstances[aid][env];
              delete reservedPorts[ports[aid][env]];
            //}
              delete apps[aid][env];
              /*if(env == "blue"){
                //delete apps[aid];
              }*/
              //apps.splice(apps.indexOf(appDescr), 1);
              callback(null);
            }
          });
        }
      }
    });
  }

  app.get("/app/:aid", function(req, res){
    var aid = parseInt(req.params.aid);
    var env = "blue";

    getAppDescr(aid, function(err, appDescr){
      if(err) {
        res.status(404).send(err.toString());
      } else {
        var blueAppDescr = appDescr.blue;
        console.log("appDescr: " + JSON.stringify(appDescr));
        if(blueAppDescr.status == "crashed" || blueAppDescr.status == "installed"){
          res.status(200).send(JSON.stringify(blueAppDescr));
        } else {
          getAppStatus(aid, env, function(err, appStatus){
            if(err){
              res.status(404).send(err.toString());
            } else {
              blueAppDescr.status = appStatus;
              console.log("appStatus: " + appStatus);
              console.log("2nd appDescr: " + JSON.stringify(blueAppDescr));
              res.status(200).send(JSON.stringify(blueAppDescr));
            }
          }); 
        }
      }
    });
  });

  function getAppStatus(aid, env, callback) {
    var url = "http://localhost:" + ports[aid][env] + "/";
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
    var env = "blue";
    //var appDir = "./app/" + aid + "/";

    getAppDescr(aid, function(err, appDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
          var blueAppDescr = appDescr.blue;
            //var appDir = "./app/" + aid + "/" + env + "/";
            var appDir = "./app/" + aid + "/";
         
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
    var env = "blue";
    var appDir = "./app/" + aid + "/";

    getAppDescr(aid, function(err, appDescr){
        if(err){
            res.status(404).send(err.toString());
        } else {
          var blueAppDescr = appDescr.blue;
            if(blueAppDescr.status == "crashed" || blueAppDescr.status == "installed"){
                res.status(500).send(JSON.stringify(blueAppDescr))
            } else if(/*blueAppDescr.status == "installed" ||*/ blueAppDescr.firstStartAfterCrash) {
              delete blueAppDescr.firstStartAfterCrash;
              //delete blueAppDescr.firstDeleteAfterCrash;
              blueAppDescr.status = "installed";
              instanciate(blueAppDescr, env, function(err, blueAppStatus, deploymentErr){
                if(err) {
                  res.status(500).send(err.toString());
                } else {
                  blueAppDescr.status = blueAppStatus;

                  dm.updateAppInfo(blueAppDescr, function(err, response){
                    if(err){
                      console.log("update erro: " + err.toString());
                    } else {
                      console.log("update on dm response: " + response);
                    }
                    fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
                    if(blueAppDescr.status == "crashed"){
                      res.status(500).send(JSON.stringify(blueAppDescr))
                    } else {
                      res.status(200).send(JSON.stringify(blueAppDescr));
                    }
                  });
                }
              });
            } else {
              var data = "";

              req.on("data", function(chunk){
                data += chunk;
              });

              req.on("end", function(){
                var targetState = JSON.parse(data);
                startOrStopInstance(targetState, aid, env, function(err, appStatus){
                  var code = null;
                  if(err){
                    console.log("error from stop: " + err.toString());
                    fs.appendFileSync(appDir + "debug.log", 'app did not specify when terminate function should end' + "\n", "utf8");
                    blueAppDescr.status = "crashed";
                    allInstances[aid][env].server.close();
                    delete reservedPorts[ports[aid][env]];
                    code = 500;
                  } else {
                    code = 200;
                    blueAppDescr.status = appStatus;
                  }
                    //var appIndex = appIndexOf(aid, "id");
                    dm.updateAppInfo(blueAppDescr, function(err, response){
                      if(err){
                        console.log("update erro: " + err.toString());
                      } else {
                        console.log("update on dm response: " + response);
                      }
                      fs.writeFileSync("./device.txt", JSON.stringify(apps, null, 2), "utf8");
                      res.status(code).send(JSON.stringify(blueAppDescr));
                    });
                  
                });
              });
           }
        }
    });
  });

  function startOrStopInstance(targetState, aid, env, callback){

	console.log(apps[aid][env].status);

	// This is used when application is installed but can not start running, For example,
	// developer forgot to write "tastComplete" function in the "task" utility function of the app.
	if(targetState.status == "paused" && apps[aid][env].status == "installed"){
	  callbacks[aid](null, "installed", null);
	  callback(null, "paused");
	} else if (targetState.status == "paused" && apps[aid][env].status == "crashed") {
          callback(null, "crashed");
        } else if (targetState.status == "paused" && apps[aid][env].status == "paused") {
          callback(null, "paused");
        } else if (targetState.status == "running" && apps[aid][env].status == "running") {
          callback(null, "running");
        } else if(targetState.status === "running" || targetState.status === "paused") {
          var url = "http://localhost:" + ports[aid][env] + "/";

          var options = {
            uri: url,
            method: 'PUT',
            json: targetState
          };

          //if(targetState.status === "running" || targetState.status === "paused") {
            request(options, function(err, ress, body){
                if(err) {
                    callback(err);
                //} else if (targetState.status == "running") {
                  } else if(ress.statusCode == 200){
                    console.log(body + typeof(body));
                    callback(null, body.status);
                    //callback(null, JSON.parse(body).status);
                  //} else if(ress.statusCode == 204) {
                    //callback(null, "running");
                  //  callback(null, targetState.status);
                  } else {
                    callback(new Error("error"));
                  }
                //}
            });
          } else {
            callback(new Error("The content of request should be running or paused"));
          }
        //}
  }
  
  // This method is called when a sequential liquid transfer should be initiated.
  app.post("/transfer", function(req, res1){
    
    console.log(req.body.del);
    
    var url = "http://localhost:" + ports[req.body.id]["blue"] + "/api/savestate/"; // URL of the application that should be transferred.
    
    // Create a savefile at the application.
    request.get(url, function(err, res2, body){
      if(err) {
          console.log(err);
	  res1.send(false);
      } else if(res2.statusCode == 200){
          if(body=="true"){
	    // Everything ok, proceed.
	    doTransfer(req.body.id, req.body.url, res1, req.body.del, false);
	  } else{
	    res1.send(false);
	  }
      } else {
          console.log(res2.statuscode);
	  res1.send(false);
      }
    });
    
  });
  
  app.post("/clone", function(req, res){
    
    var sourceAppUrl = "http://localhost:" + ports[req.body.id]["blue"] + "/api";
    console.log(req.body);    
    // 1. Does the application already have a syncID?
    
    console.log("Cloning started.");
    
    request.get(sourceAppUrl+"/savestate/", function(err, resSave, body){
      if(err){
	console.log(err);
	res.send(false);
      } else if(resSave.statusCode == 200){
	if(body == "true"){
	  console.log("do sync");
          doSync(sourceAppUrl,req);
	}else{
          console.log("body is not true");
	  res.send(false);
	}
      } else{
	console.log(resSave.statuscode);
	res.send(false);
      }
    });
  });
    
  function doSync(sourceAppUrl,req){
    var syncId; 
    request.get(sourceAppUrl+"/syncId/", function(err, resSyncId, body){
      
      console.log("Requesting syncID from application.");
      
      if(err){
	console.log(err);
	res.send(false);
	return;
      }
      syncId = body;
      console.log(syncId);
      
      // Yes - Fork application.
      if(syncId!="-1"){
	console.log("Sending application to targets.");
	doTransfer(req.body.id, req.body.url, res, false, true);
	return;
      }
      
      // No - 1) Ask RR for new syncID
      console.log("Request syncID from RR.");
      request.get(deviceManagerUrl+"generateSyncid",function(err, resRR, body){
	console.log(body);
	// No - 2) Set MY applications syncID
	var devId = deviceInfo.id;
	var aId = req.body.id;
	request.post({"url":sourceAppUrl+"/saveSyncId/", "body":{"devId":devId, "aid":aId}}, function(err, resRR, body){
	  console.log(res.body);
	});
	
	// No - 3) Fork application
      });
      
      // 2. Respond to IDE.
      
    });
  }

///////////////////////////////////////////////////////////////////
//////// Specific Instance Related Functions - END ////////////////
///////////////////////////////////////////////////////////////////
  
///////////////////////////////////////////////////////////////////
///////// Liquid Transfer Related Functions  - START //////////////
///////////////////////////////////////////////////////////////////
  
  // Do the liquid transfer.
  // aid = application ID
  // url = target urls
  // res = respond for ide
  // del = delete the current application
  // sync = synchronize transffered application
  function doTransfer(aid, url, res, del, sync){
    var appDir = "../app/" + aid + "/blue/";
    var targetDir = "../liquid";
    
    // Empty the folder in which the transferrable files will be packed.
    rimraf(path.resolve(__dirname,targetDir), function(){
      mkdirp(path.resolve(__dirname,targetDir),function(err){
	if(err) console.log(err);
	else{
	  var files = ["/agent.js","/liquidiot.json","/main.js","/package.json","/state.json"]; // The files that should be transferred.
	  // Copy all files into the correct directory.
	  return Promise.all(files.map(function (file){
	    console.log("Copying file.");
	    return copyFile((path.resolve(__dirname,appDir)+file),(path.resolve(__dirname,targetDir)+file),function(){});
	  })).then(function(promise){
	    if(sync) return copyFile((path.resolve(__dirname,appDir)+"/liquid-options.json"),(path.resolve(__dirname,targetDir)+"/liquid-options.json"),function(){});
	    else return createFile((path.resolve(__dirname,targetDir)+"/liquid-options.json"),JSON.stringify({"syncID":"-1"}),function(){});
	  }).then(function(){
	    return copyResources((path.resolve(__dirname,appDir)+"/resources"),(path.resolve(__dirname,targetDir)+"/resources"));
	  }).then(function(){
	    // Pack the tarball.
	    console.log("Packing promsie.");
	    return npmPackPromise(path.resolve(__dirname,targetDir));
	  }).then(function(pkgFilename){
	    console.log("File packed.");
	    // Read the tarball.
	    return fsp.readFileAsync(path.resolve(__dirname,pkgFilename));
	  }).then(function(pkgBuffer){
	    console.log("Sending package");
	    // Send the tarball.
	    return sendPackage(pkgBuffer,url);
	  }).then(function(){
	    console.log("Package sent.");
	    if(del == false){
	      res.send(true);
	      return true;
	    } else{
	      initiateDelete(aid,null)
	      res.send(true);
	      return true;
	    }
	  })
	  .catch(function(){
	    console.log("Error.");
	    res.send(false);
	    return false;
	  });
	}
      });
    });
  }
  
  function createFile(target, data, callback){
    return fs.appendFile(target, data,function(err){
      if(err) console.log("Couldn't create file.");
      callback();
    });
  }
  
  // Copy a file.
  function copyFile(source, target, callback){
    var read = fs.createReadStream(source);
    read.on("error", function(err){
      console.log("Error reading file.");
      return err;
    });
    var write = fs.createWriteStream(target);
    write.on("error", function(err){
      console.log("Error writing to file.");
      return err;
    });
    write.on("close", function(ex){
      callback();
    });
    read.pipe(write);
    return true;
  }
  
  // Copy the resources folder.
  function copyResources(source, target){
    return fsExtra.copy(source, target, function(err){
      if(err){
	console.log("No resources folder.");
      }
    });
  }
  
  // Pack a tarball.
  // https://github.com/npm/npm/issues/4074
  function npmPackPromise(dir) {
    return new Promise(function(resolve, reject) {
      npm.load({}, function(err) {
	if (err) {
	  console.log("Error on load.")
	  return reject(err);
	}
	console.log("Loaded");
	console.log(npm.commands.cache);
	npm.commands.cache.add(dir, null, false, null, function(err, data) {
	  console.log("Cached.");
	  if (err) {
	    console.log("Error on cache.");
	    return reject(err);
	  }
	  var cached;
	  cached = path.resolve(npm.cache, data.name, data.version, "package.tgz");
	  resolve(cached);
	});
      });
    });
  }
  
  // Send a tarball.
  function sendPackage(pkgBuffer, urls) {
  var formData = {
    'filekey': {
      value: pkgBuffer,
      options: {
        filename: 'package.tgz',
        knownLength: pkgBuffer.length,
      }
    }
  };
  Promise.all(urls.map(function(url){
    return rp.post({url: url+"/app", formData: formData, timeout: 5000});
  }));
}
  
///////////////////////////////////////////////////////////////////
///////// Liquid Transfer Related Functions  - END ////////////////
///////////////////////////////////////////////////////////////////
  
}

