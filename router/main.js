/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 */


"use strict"

module.exports = function(app) {

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

///////////////////////////////////////////////////////////////////
////////////// app Related Functions - START //////////////////////
///////////////////////////////////////////////////////////////////

  app.post("/app", upload.single("filekey"), function(req, res) {
    var aid = ((new Date()).getTime()) % 1000000;
    installApp(req, aid, function(err, appDescr){
      if(err) {
        res.status(500).send(err.toString());
      } else {
        //var aid = appDescr.id;
        appDescr.id = aid;
        appDescr.instances = [];
        apps.push(appDescr);
        //appIds.push(aid);
        //instancesOfApp[aid] = [];
        //npmInstallInfoOfApp[aid] = {status:"finished"};
        res.status(200).send(aid.toString());
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
            callback(null, err);
          } else {
            extractTarFile(aid, function(err){
              if(err){
                callback(null, err);
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
          return (fs.statSync(file).isDirectory() && file !== "instance");
        }).forEach(function(file){

          fs.readFile(file + "/package.json", "utf8", function(err, src){
            if(err) {
                callback(err);
            } else {
                var appDescr = JSON.parse(src);
                //appDescription.id = parseInt(aid);
                //console.log("app Description: " + JSON.stringify(appDescription));
                
                if(appDescr.main) {
                    fs.stat(file + "/" + appDescr.main, function(err, stat){
                        if(err){
                            callback(err);
                        } else {
                            callback(null, appDescr);
                        }
                    });

                } else {
                    callback(new Error("Package.json format is incorrect. No Main entry."));
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
        deleteApp(apps[i].id, function(err){
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

  app.delete("/app/:aid", function(req, res){
    var aid = parseInt(req.params.aid);
    //if(isApp(aid)) {
      deleteApp(aid, function(err){
        if(err) {
          res.status(500).send(err.toString());
        } else {
          res.status(200).send("app is deleted.");
        }
      });
  });

  function deleteApp(aid, callback) {
    var appDir = "./app/" + aid + "/";

    getAppDescr(aid, function(err, appDescr){
        if(err){
            callback(err);
        } else {
            getInstancesOfApp(aid, function(err, instances){
                if(err){
                    callback(err);
                } else {
                    if(instances.length == 0) {
                          rimraf(appDir, function(err){
                            if(err) {
                              callback(err);
                            } else {
                                apps.splice(apps.indexOf(appDescr), 1);
                              //appIds.splice(appIds.indexOf(aid), 1);
                              //delete instancesOfApp[aid];
                                callback();
                            }
                          });
                    } else {
                          for(var i in instances) {
                            deleteInstanceServer(aid, instances[i].id, instances[i], function(err){
                              if(err) {
                                callback(err);
                              } else {
                                if(instances.length === 0) {
                                  rimraf(appDir, function(err){
                                    if(err) {
                                      callback(err);
                                    } else {
                                      apps.splice(apps.indexOf(appDescr), 1);
                                      //delete instancesOfApp[aid];
                                      callback();
                                    }
                                  });
                                }
                              }
                            });
                          }
                   }
                }
            });
        }
    });
  }


  app.post("/app/:aid", upload.single("filekey"), function(req, res){    
    var aid = parseInt(req.params.aid);
    console.log(aid);
    getAppDescr(aid, function(err, appDescr){
        if(err){
            res.status(404).send(err.toString());
        } else {
            updateApp(req, appDescr, function(err, newAppDescr){
                if(err){
                    res.status(500).send(err.toString());
                } else {
                    //console.log("app descr: " + JSON.stringify(apps[apps.indexOf(appDescr)]));
                    //console.log("index: " + apps.indexOf(appDescr));
                    newAppDescr.id = aid;
                    newAppDescr.instances = appDescr.instances;
                    apps[apps.indexOf(appDescr)] = newAppDescr;
                    //console.log("new app descr: " + JSON.stringify(apps[apps.indexOf(newAppDescr)]));
                    res.status(200).send("App is updated.");
                }
            });
        }
    });
  });

  function updateApp(req, appDescr, callback){
    var aid = appDescr.id;
    var appFile = aid + ".js";
    var appDir = "./app/" + aid + "/";

    cleanAppDir(aid, function(err){
        if(err){
            callback(err);
        } else {
            installApp(req, aid, function(err, newAppDescr){
              if(err) {
                callback(err);
              } else {
                callback(null, newAppDescr);
              }
            });
        }
    });
  }

  function cleanAppDir(aid, callback){
      var appDir = "./app/" + aid + "/";
      var flags = [];
      var length = 0;
      var ctr = 0;
      fs.readdir(appDir, function(err, files){
          if(err){
              callback(err);
          } else {
              files.filter(function(file){
                  return (file !== "instance");
              }).map(function(file){
                  flags[length++] = false;
                  console.log("flags: " + JSON.stringify(flags));
                  return path.join(appDir, file);
              }).forEach(function(file){
                  console.log(file);
                  rimraf(file, function(err){
                      if(err){
                          callback(err);
                      } else {
                          flags[ctr++] = true;
                          console.log("length of files: " + length);
                          console.log("ctr: " + ctr);
                          if(ctr == length) {
                              console.log("yes");
                              var flag = true;
                              for(var i in flags){
                                  if(!flags[i]){
                                      flag = false;
                                  }
                              }
                              if(flag){
                                  callback();
                              } else {
                                  callback(new Error("Can not update"));

                              }
                          }
                      }
                  });

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

  app.post("/app/:aid/instance", function(req, res){
    var aid = parseInt(req.params.aid);
    getAppDescr(aid, function(err, appDescr){
        if(err){
            res.status(404).send(err.toString());
        } else {
            console.log("1.appDescr: " + JSON.stringify(appDescr));

            //if(!isNaN(aid)) {
              instanciate(appDescr, function(err, iid){
                if(err) {
                  // we should delete the initializing instace from the app instances list
                  res.status(500).send(err.toString());
                } else {
                  res.status(200).send(iid.toString());
                }
              });
        }
    });
  });

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
        if (reservedPorts[port] === undefined) {
          var iid = ((new Date()).getTime()) % 1000000;
          reservedPorts[port] = true;
          ports[iid] = port;

          console.log("after: " + reservedPorts[port]);

          //var iid = port;
          var instanceDir = "./app/" + aid + "/instance/" + iid + "/";

          // performing a deep copy of the appDescr object (otherwise JSON.stringify throws an error)
          // instance description is almost he same as app description, except some items (id and instaces)
          var instanceDescr = JSON.parse(JSON.stringify(appDescr));
          // changing the id of instanse to iid
          instanceDescr.id = iid;
          // instance object does not have instaces array, so it should be removed
          delete instanceDescr.instances;
          // the instance automatically run after creation, so the status should be initializing
          instanceDescr.status = "initializing";
          console.log("instace: " + JSON.stringify(instanceDescr));
          apps[apps.indexOf(appDescr)].instances.push(instanceDescr);


          console.log("2.port:" + port);
  
          createInstanceDir(appDescr, iid, function(err) {
            if(err) {
              //delete reservedPorts[iid];
              delete reservedPorts[port];
              delete ports[iid];
              callback(err);
            } else {
                createInstanceFiles(aid, instanceDescr, iid, function(err){
                    if(err){
                        delete reserevedPorts[port];
                        delete ports[iid];
                        callback(err);
                    } else {
                        //callback(null, iid.toString());
                        
                          createInstanceServerFiles(appDescr, iid, function(err){
                            if(err) {
                              rimraf(instanceDir, function(error){
                                if(error) {
                                  callback(error);
                                } else {
                                  callback(err);
                                }
                                delete reservedPorts[port];
                                delete ports[iid];
                              });
                            } else {
                              createInstanceServer(aid, iid, instanceDescr, port);
                              //instancesOfApp[aid].push(iid);
                              callback(null, iid.toString());
                            }
                          });
                    }
                });
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

  function createInstanceDir(appDescr, iid, callback){
    var aid = appDescr.id;
    var instancesDir = "./app/" + aid + "/instance/";
    var instanceDir = "./app/" + aid + "/instance/" + iid + "/";
    var appDir = "./app/" + aid + "/";
    //var appName = aid + ".js";
    var appName = appDescr.main;

    var files = [{srcFolder:appDir, srcFile:appName, desFolder:instanceDir, desFile:"start_agent_test.js"},
                 {srcFolder:templatesDir, srcFile:"agent.js", desFolder:instanceDir, desFile:"agent.js"}];

    fs.mkdir(instancesDir , function(err){
      if(!err || (err && err.code === "EEXIST")) {
        fs.mkdir(instanceDir, function(err){
          if(err){
            callback(err);
          } else {
             callback(); 
          }
        });
      } else {
        callback(err);
      }
    });
  }

  function createInstanceFiles(aid, instanceDescr, iid, callback){
      var appDir = "./app/" + aid + "/";
      var instanceDir = "./app/" + aid + "/instance/" + iid + "/";
      var instanceMainFile = instanceDescr.main;

      var flags = [];
      var length = 0;
      var ctr = 0;
      var ctr1 = 0;
      fs.readdir(appDir, function(err, files){
          if(err){
              callback(err);
          } else {

              ncp(appDir, instanceDir, {
                                           filter : function(file){ 
                                                       if(file.indexOf("instance") < 0) {
                                                           console.log(file);
                                                           return true; 
                                                       } else if (fs.statSync(file).isDirectory()) { 
                                                           return false;
                                                       } else {
                                                           return true;
                                                       }
                                                   }
                }, function(err){
                  if(err){
                      callback(err);
                  } else {
                      fs.rename(instanceDir + instanceMainFile, instanceDir + iid + ".js", function(err){
                          if(err){
                              callback(err);
                          } else {
                              callback();
                          }
                      });
                  }
              });
          }
      });
  }
  
  function copyFiles(files, callback){
    var counter = 0;
    for(var i in files){
      var rd = fs.createReadStream(files[i].srcFolder + files[i].srcFile);
      rd.on("error", function(err){
        callback(err);
      });
      var wr = fs.createWriteStream(files[i].desFolder + files[i].desFile);
      wr.on("error", function(err){
        callback(err);
      });
      wr.on("finish", function(){
        counter++;
        if(counter === files.length)
          callback();
      });
      rd.pipe(wr);
    } 
  }

  function createInstanceServerFiles(appDescr, iid, callback) {

    var aid = appDescr.id;
    var instanceDir = "./app/" + aid + "/instance/" + iid + "/";
    var appDir = "./app/" + aid + "/";
    var appName = appDescr.main;
    var instanceName = iid + ".js";
  
    var files = [//{srcFolder:appDir, srcFile:appName, desFolder:instanceDir, desFile:instanceName},
                 {srcFolder:templatesDir, srcFile:"agentserver_router.js", desFolder:instanceDir, desFile:"agentserver_router.js"},
                 {srcFolder:templatesDir, srcFile:"agentserver_handlers.js", desFolder:instanceDir, desFile:"agentserver_handlers.js"}];

    copyFiles(files, function(err){
      if(err) {
        callback(err);
      } else {
        callback();
      }
    });
  }

  function createInstanceServer(aid, iid, instanceDescr, port){
    var instanceDir = "./app/" + aid + "/instance/" + iid + "/";
    var startServerFile = "agentserver_router.js";
    //var port = iid;
    console.log("availabe port at: " + port);
    //var spawn = require("child_process").spawn;
    //var child = spawn("node", [instanceDir + startServerFile, port], {cwd : instanceDir});
    var child = spawn("node", ["./" + startServerFile, port, iid], {cwd : instanceDir});
    //var execForCreateServer = require("child_process").exec;
    //var child = execForCreateServer("node " + instanceDir + "agentserver_router.js " + portt.toString(), 
    //                                         function(err, stdout, stderr){
    //                                           console.log("baste shod");
    //                                         });  
    //allInstances[portt] = child;
    
    //var child = execForCreateServer("node " + instanceDir + "agentserver_router.js " + portt.toString());  
    allInstances[iid] = child;

    child.stdout.on("data", function(data){
        instanceDescr.status = "running";
        console.log("stdout: " + data);
    });
  
    child.stderr.on("data", function(data){
      console.log("stderr: " + data);
    });
  

    child.on("exit", function(code, signal){
        if(code != 0 && code != null){
            console.log("aid: " + aid);
            console.log("iid: " + iid );
                    instanceDescr.status = "crashed";
                    delete reservedPorts[port];
        }
          console.log("exit code: " + code);
          console.log("signal " + signal);
    });

    
  }

  app.get("/app/:aid/instance", function(req, res){

    var aid = parseInt(req.params.aid);
    getInstancesOfApp(aid, function(err, instances){
        if(err){
            res.status(404).send(err.toString());
        } else {
            res.status(200).send(JSON.stringify(instances));
        }
    });
  });

  function getInstancesOfApp(aid, callback){
    getAppDescr(aid, function(err, appDescr){
        if(err){
            callback(err);
        } else {
            callback(null, apps[apps.indexOf(appDescr)].instances);
        }
    });

  }

///////////////////////////////////////////////////////////////////
////////////// Instance Related Functions - END ///////////////////
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
//////// Specific Instance Related Functions - START //////////////
///////////////////////////////////////////////////////////////////

  app.delete("/app/:aid/instance/:iid", function(req, res){
    var aid = parseInt(req.params.aid);
    var iid = parseInt(req.params.iid);

    getInstanceDescr(aid, iid, function(err, instanceDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {

          deleteInstanceServer(aid, iid, instanceDescr, function(err){
            if(err) {
              res.status(500).send(err.toString());
            } else {
              res.status(200).send("Instance is deleted.");
            }
          });

        }
    });
  });

  function deleteInstanceServer(aid, iid, instanceDescr, callback){
    var instanceDir = "./app/" + aid + "/instance/" + iid;
  
    rimraf(instanceDir, function(err){
      if(err) {
        callback(err);
      } else {
          //if(allInstances[iid].pid){
              //console.log("instance is alive");
              killer(allInstances[iid].pid);
              delete reservedPorts[iid];
          //} else {
              //conosle.log("instance is dead");
          //}
        //allInstances[iid].kill();
        //delete reservedPorts[iid];
        delete allInstances[iid];
        getInstancesOfApp(aid, function(err, instances){
            if(err){
                callback(err);
            } else {
                instances.splice(instances.indexOf(instanceDescr), 1);
                callback();
            }
        });
      }
    });
  }

  app.get("/app/:aid/instance/:iid", function(req, res){
    var aid = parseInt(req.params.aid);
    var iid = parseInt(req.params.iid);

    getInstanceDescr(aid, iid, function(err, instanceDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
            if(instanceDescr.status == "crashed" || instanceDescr.status == "initializing"){
                res.status(200).send(JSON.stringify(instanceDescr));
            } else {
                getInstanceStatus(iid, function(err, status){
                    if(err){
                        res.status(404).send(err.toString());
                    } else {
                        instanceDescr.status = status;
                        res.status(200).send(JSON.stringify(instanceDescr));
                    }
                }); 
            }
        }
    });
  });


  function getInstanceDescr(aid, iid, callback){
      getAppDescr(aid, function(err, appDescr){
          if(err){
              callback(err);
          } else {
              var instances = apps[apps.indexOf(appDescr)].instances;
              for(var i in instances){
                  if(instances[i].id == iid){
                      console.log("peida kard");
                      callback(null, instances[i]);
                      return;
                  }
              }
              callback(new Error("Instance not Found."));
          }
      });
  }

  function getInstanceStatus(iid, callback) {
    var url = "http://localhost:" + iid + "/";
    request.get(url, function(err, res, body){
        if(err) {
            callback(err);
        } else if(res.statusCode == 200){
            console.log(JSON.parse(body).status);
            callback(null, JSON.parse(body).status);
        } else {
            callback(new Error("error"))
        }
    });
  }


  app.get("/app/:aid/instance/:iid/log", function(req, res){
    var aid = parseInt(req.params.aid);
    var iid = parseInt(req.params.iid);
    var instanceDir = "./app/" + aid + "/instance/" + iid + "/";

    getInstanceDescr(aid, iid, function(err, instanceDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
            fs.readFile(instanceDir + "debug.log", "utf8", function(err, data){
                if(err){
                    res.status(500).send(err.toString());
                } else {
                    res.status(200).send(data);
                }
            });
        }
    });
  });


  app.put("/app/:aid/instance/:iid", function(req, res){
    var aid = parseInt(req.params.aid);
    var iid = parseInt(req.params.iid);

    getInstanceDescr(aid, iid, function(err, instanceDescr){
        if(err) {
            res.status(404).send(err.toString());
        } else {
            if(instanceDescr.status == "crashed" || instanceDescr.status == "initializing"){
                res.status(500).send(JSON.stringify(instanceDescr));
            } else {
                startOrStopInstance(req, res, iid, aid, function(err, instanceStatus){
                    if(err){
                        res.status(500).send(err.toString());
                    } else {
                        instanceDescr.status = instanceStatus;
                        res.status(200).send(JSON.stringify(instanceDescr));
                    }
                });
            }
        }
    });
  });

  function startOrStopInstance(req, res, iid, aid, callback){
    var data = "";
    req.on("data", function(chunk){
      data += chunk;
    });
    req.on("end", function(){
      try {
        var targetState = JSON.parse(data);
        var url = "http://localhost:" + ports[iid] + "/" + iid;
        if(targetState.status === "running") {

            request.get(url, function(err, res, body){
                if(err) {
                    callback(err);
                } else if(res.statusCode == 200){
                    callback(null, JSON.parse(body).status);
                } else if(res.statusCode == 204) {
                    callback(null, "running");
                } else {
                    callback(new Error("error"))
                }
            });
        } else if(targetState.status === "paused") {

            console.log("111");
            request.del(url, function(err, res, body){
                if(err) {
                    callback(err);
                } else if(res.statusCode == 200){
                    callback(null, JSON.parse(body).status);
                } else if(res.statusCode == 204) {
                    callback(null, "paused");
                } else {
                    callback(new Error("error"))
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


















