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
  var spawn = require("child_process").spawn;
  var execForInstalDeps = require("child_process").exec;
  var execForStartAgent = require("child_process").exec;
  var portscanner = require("portscanner");
  var killer = require("tree-kill");
  var request = require("request");
  //var execForCreateServer = require("child_process").exec;
  var multer = require("multer");
  var ncp = require("ncp").ncp;
  var path = require("path");
  var tar = require("tar");
  var zlib = require("zlib");
  var targz = require("tar.gz");
  var upload = multer({dest:'./uploads/'});
  var dm = require("./dm")(deviceManagerUrl, deviceInfo);

  var reservedPorts = [];
  var allInstances = [];
  var apps = [];
  var ports = [];

  var templatesDir = "./agentServerTemplateFiles/";

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

    if(flag && req.method === "OPTIONS"){
      res.sendStatus(200);
    } else {
      next();
    }

  });

  app.use("/app/:aid/instance/:iid/api", function(req, res){
    var aid = parseInt(req.params.aid);
    var iid = parseInt(req.params.iid);
    console.log("reqUrl " + req.url);
    var url = "http://localhost:" + ports[iid] + req.url;
    console.log(url);
    req.pipe(request(url)).pipe(res);
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
 

  // This method is called for deployment of application. The application should be packed
  // in tarball in .tgz format.
  app.post("/app", upload.single("filekey"), function(req, res) {
    // creating the specific id for application
    var aid = ((new Date()).getTime()) % 1000000;
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
            dm.addAppInfo(appDescr, function(err, res){
              if(err) {
                conosle.log(err.toString());
              } else {
                console.log("ADD to dm response: " + res);
              }
            });
            res.status(200).send(JSON.stringify(appDescr));
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
                //appDescription.id = parseInt(aid);
                //console.log("app Description: " + JSON.stringify(appDescription));
                
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
                                    if(liquidiotJson.classes) {
                                      appDescr.classes = liquidiotJson.classes;
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

/*
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
        //}).filter(function(file){
          //return (fs.statSync(file).isDirectory() && file !== "instance");
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
                                    if(liquidiotJson.classes) {
                                      appDescr.classes = liquidiotJson.classes;
                                      callback(null, appDescr);
                                    } else {
                                      callback(new Error("Package.json format is incorrect. No Main entry."));
                                    }
                                  } catch(error){
                                    callback(error);
                                  }
                                }
                            });
                        }
                    });
                } else {
                    callback(new Error("Package.json format is incorrect. No Main entry."));
                }
              } catch(error){
                callback(error);
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
        //}).filter(function(file){
          //return (fs.statSync(file).isDirectory() && file !== "instance");
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
*/

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
      for(var i in apps){
          if(apps[i].id === aid){
              callback(null, apps[i]);
              return;
          }
      }
      callback(new Error("App not found."));
  }

  function instanciate(appDescr, callback) {
    var aid = appDescr.id;
    portscanner.findAPortNotInUse(8001, 9000, "127.0.0.1", function(err, port){
      if(!err) {
        console.log("before:" + reservedPorts[port]);
        console.log("port: " + port);
        var appDir = "./app/" + aid + "/";
        if (reservedPorts[port] === undefined) {
          ////var iid = ((new Date()).getTime()) % 1000000;
          reservedPorts[port] = true;
          ports[aid] = port;

          console.log("after: " + reservedPorts[port]);
          
          //appDescr.status = "initializing";
          console.log("instace: " + JSON.stringify(appDescr));


          console.log("2.port:" + port);
          createAppServerFiles(appDescr, function(err){
            if(err) {
              delete reservedPorts[port];
              delete ports[aid];
              apps.splice(apps.indexOf(appDescr), 1);
              rimraf(appDir, function(error){
                if(error) {
                  callback(error);
                } else {
                  callback(err);
                }
              });
            } else {
              createAppServer(aid, appDescr, port, function(err, appStatus){
                callback(null, appStatus);
              });
              //callback(null);
            }
          });
        } else {
          instanciate(appDescr, callback);
        }
      } else {
        callback(err);
      }
    });
  }

  function createAppServerFiles(appDescr, callback) {

    var aid = appDescr.id;
    var appDir = "./app/" + aid + "/";

    ncp(templatesDir, appDir, function(err){
        if(err){
            callback(err)
        } else {
            callback();
        }
    }); 
  }

  function createAppServer(aid, appDescr, port, callback){
    var appDir = "./app/" + aid + "/";
    var startServerFile = "agentserver_router.js";
    console.log("availabe port at: " + port);
    //var spawn = require("child_process").spawn;
    //var child = spawn("node", [instanceDir + startServerFile, port], {cwd : instanceDir});
    var child = spawn("node", ["./" + startServerFile, port, appDescr.main], {cwd : appDir});
    //var execForCreateServer = require("child_process").exec;
    //var child = execForCreateServer("node " + instanceDir + "agentserver_router.js " + portt.toString(), 
    //                                         function(err, stdout, stderr){
    //                                           console.log("baste shod");
    //                                         });  
    //allInstances[portt] = child;
    
    //var child = execForCreateServer("node " + instanceDir + "agentserver_router.js " + portt.toString());  
    allInstances[aid] = child;

    child.stdout.on("data", function(data){
      console.log("stdout: " + data);
      
      if(appDescr.status == "initializing"){
        appDescr.status = "running";
        callback(null, "running");
      } else {
        appDescr.status = "running";
      }
    });
  
    child.stderr.on("data", function(data){
      console.log("stderr: " + data);
    });
  

    child.on("exit", function(code, signal){
        if(code != 0 && code != null){
          if(appDescr.status == "initializing"){
            console.log("aid: " + aid);
            appDescr.status = "crashed";
            delete reservedPorts[port];
            callback(null, "crashed");
          } else {
            appDescr.status = "crashed";
            dm.updateAppInfo(appDescr, function(err, response){
              if(err){
                console.log(err.toString());
              } else {
                console.log("update on dm response: " + response);
              }
            });
            delete reservedPorts[port];
          }
        }
          console.log("exit code: " + code);
          console.log("signal " + signal);
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
              });
              res.status(200).send("Instance is deleted.");
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
        callback(err);
      } else {
          //if(allInstances[iid].pid){
              //console.log("instance is alive");
              killer(allInstances[aid].pid);
              delete reservedPorts[ports[aid]];
          //} else {
              //conosle.log("instance is dead");
          //}
        //allInstances[iid].kill();
        //delete reservedPorts[iid];
        delete allInstances[aid];
        //getInstancesOfApp(aid, function(err, instances){
            //if(err){
                //callback(err);
            //} else {
                apps.splice(apps.indexOf(appDescr), 1);
                callback();
            //}
        //});
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
    console.log("body " + body);
    console.log(res.statusCode);
        if(err) {
            callback(err);
        } else if(res.statusCode == 200){
            //console.log(JSON.parse(body).status);
            callback(null, JSON.parse(body).status);
        } else {
            callback(new Error("error"))
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
                    res.status(200).send(data);
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
                startOrStopInstance(req, res, aid, function(err, appStatus){
                    if(err){
                        res.status(500).send(err.toString());
                    } else {
                        appDescr.status = appStatus;
                        dm.updateAppInfo(appDescr, function(err, response){
                          if(err){
                            console.log("update erro: " + err.toString());
                          } else {
                            console.log("update on dm response: " + response);
                          }
                        });
                        res.status(200).send(JSON.stringify(appDescr));
                    }
                });
            }
        }
    });
  });

  function startOrStopInstance(req, res, aid, callback){
    var data = "";
    req.on("data", function(chunk){
      data += chunk;
    });
    req.on("end", function(){
      try {
        var targetState = JSON.parse(data);
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
      } catch(e) {
          callback(e);
      }
    });
  }


///////////////////////////////////////////////////////////////////
//////// Specific Instance Related Functions - END ////////////////
///////////////////////////////////////////////////////////////////

}

