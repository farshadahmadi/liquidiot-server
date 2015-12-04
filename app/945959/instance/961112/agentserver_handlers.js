
var fs = require("fs");

//var npm = require("/usr/local/lib/node_modules/npm");
//var rimraf = require("rimraf");
//var Agent = require('./Agent');
//var server = require("./agentserver");

//console.log()

var agent = null;
//var status = false;
var status = {status : ""};

function respond(res, code, body){
  res.writeHead(code, {"Content-Type" : "text/plain"});
  res.end(body);
}

function startForFirstTime(id){
  //fs.readFile( __dirname + "/" + id.toString() + ".js", "utf8", function(err, src){
  fs.readFile( "./" + id.toString() + ".js", "utf8", function(err, src){
    eval(src);
    agent = createAgentObject();
    agent.id = id
    //status = true;
    //status.status = "running";
    agent.start(function(err){
      if(err){
        console.log("(server) Agent can not start: " + err.toString());
        status.status = "paused";
        throw err;
        //agent.stop();
        //status = false;
      } else {
        console.log("(server) Agent Started without error. ");
      }
    });
  });
}

function start(req, res, match) {
  //console.log('start is called');
    //console.log(match.params.n);
    var id = parseInt(match.params.n);
    //if(agent && agent.status) {
    if(agent && status.status === "running") {
      //console.log(agent.status);
      //respond(res, 204, "Agent is ALREADY started");
      respond(res, 204, JSON.stringify(status));
    } else {
      //fs.readFile( __dirname + "/" + id.toString() + ".js", "utf8", function(err, src){
      fs.readFile("./" + id.toString() + ".js", "utf8", function(err, src){
        if(err && err.code === "ENOENT") {
          respond(res, 404, "File not found.");
        } else if (err){
          respond(res, 500, err.toString());
        } else {
          //console.log(src);
          var result = eval(src);
          //console.log("1");
          agent = createAgentObject();
          agent.id = id
          //agent.status = true;
          status.status = "running";
          //activeAgents[agent.id] = agent;
          //console.log("3");
          agent.start(function(err){
            if(err){
              console.log("Agent can not start:" + err.toString());
              agent.stop();
              //agent.status = false;
              status.status = "paused";
              //delete agent;
              //delete activeAgents[agent.id];
              respond(res, 500, err.toString());
              //respond(res, 500, JSON.stringify(err));
            } else {
              console.log("Agent Started without error. ");
              respond(res, 200, JSON.stringify(status));
              //respond(res, 200, id.toString());
            }
          });
        }
      });
    }
}

function stop(req, res, match) {
  //console.log('stop is called');
    //console.log(match.params.n);
    var id = parseInt(match.params.n);
    //if(agent && agent.status) {
    if(agent && status.status === "running") {
      //var agent = activeAgents[id];
      agent.stop();
      //agent.status = false;
      status.status = "paused";
      //delete agent;
      //delete activeAgents[id];
      respond(res, 200, JSON.stringify(status));
    } else {
      //respond(res, 404, "No agent or No active agent");
      respond(res, 204);
    }
}

function main(req, res, match) {
  if(req.method === "GET") {
    start(req, res, match);
  } else if(req.method === "DELETE"){
    stop(req, res, match);
  } else {
    respond(res, 405, "Not Handled");
  }
}

function getInstanceStatus(req, res, match) {
  if(req.method === "GET") {
    //if(agent && agent.status) {
    //if(status.status === "running") {
      //var resp = { status : "running" };
    //} else if(agent && !agent.status)  {
    //} else {
      //var resp = { status : "paused" };
    //} else {
      //var resp = { status : "No agent" };
    //}
    respond(res, 200, JSON.stringify(status));
  //} else if (req.method === "POST") {
    //installDeps(req, res, match);
  } else {
    respond(res, 405, "Not Handled");
  }
}


exports.main = main;
exports.getInstanceStatus = getInstanceStatus;
exports.startForFirstTime = startForFirstTime;

//exports.start = start;
//exports.stop = stop;
//exports.installDeps = installDeps;


/*

function installDeps(req, res, match) {
  console.log("in npm installation function");
  if(req.method === "POST" ) {
    req.on("data", function(src){
        try {
        var packageJSON = JSON.parse(src);
        dependencies = packageJSON.dependencies;
        for(i in dependencies){
          console.log(i);
          console.log(dependencies[i]);
          npm.load(function(err){
            npm.commands.install([i, ""], function(err, data){
            //npm.commands.install(["glob", ""], function(err, data){
              if(err){
                console.log(err.toString());
                respond(res, 500, err.toString());
              } else {
                console.log(data);
                respond(res, 200, "Modules installed.");
              }
            });
            npm.on("log", function(message){
              console.log(message);
            });
          });
        }
      } catch(e) {
        respond(res, 500, e.toString())
      }
    });
  } else {
    console.log("inja");
    respond(res, 405, "Not Handled");
  }
}


function pushapp(req, res, match) {
  console.log('upload is called');
  if(req.method === "POST" ) {
    var id = ((new Date()).getTime()) % 1000000;
    fs.mkdir("./apps", function(err){
      if(!err || (err && err.code === "EEXIST")) {
        fs.mkdir("./apps/" + id.toString(), function(err){
          if(!err){
            //var fileName = (match.route === "/upload") ? (id.toString() + ".js") : "package.json";
            var fileName = id.toString() + ".js";
            var outStream = fs.createWriteStream("./apps/" + id + "/" + fileName);
            outStream.on("error", function(err){
              respond(res, 500, err.toString());
            });
            outStream.on('finish', function(){
              respond(res, 200, id.toString());
            });
            req.pipe(outStream);
          }
        });
      } else if (err) {
        respond(res, 500, err.toString());
      }
    });
  } else {
    respond(res, 405, "Not Handled");
  }
}

function instanciate(req, res, match) {
  console.log('instanciate is called');
  if(req.method === "POST" ) {
    var aip = match.params.n;
    var iid = ((new Date()).getTime()) % 1000000;
    iid = iid.toString();
    fs.mkdir("./apps/" + aip + "/instances" , function(err){
      if(!err || (err && err.code === "EEXIST")) {
        fs.mkdir("./apps/" + aip + "/instances/" + iid, function(err){
          if(!err){
            var fileName = iid + ".js";
            var writeStream = fs.createWriteStream("./apps/" + aip + "/instances/" + iid + "/" + fileName);
            var readStream = fs.createReadStream("./apps/" + aip + "/" + aip + ".js");
            readStream.on("error", function(err){
              respond(res, 500, err.toString());
            });
            writeStream.on("error", function(err){
              respond(res, 500, err.toString());
            });
            writeStream.on('finish', function(){
              fs.mkdir("./apps/" + aip + "/instances/" + iid + "/" + "Node_modules", function(err){
                if(!err){
                  respond(res, 200, iid);
                }
              });
            });
            readStream.pipe(writeStream);
          }
        });
      }
    });
  }
}

exports.pushapp = pushapp;
exports.instanciate = instanciate;
*/

/*function remove(req, res, match) {
  console.log("delete is called");
  if(req.method === "DELETE") {
    id = match.params.n.toString();
    if(activeAgents[id]) {
      respond(res, 500, "Agent is in running mode. Stop it and then delete it.");
    } else {
      rimraf("./files/" + id, function(err){
        if(err && err.code === "ENOENT") {
          respond(res, 404, "Agent not found.");
        } else if (err){
          respond(res, 500, err.toString());
        } else {
          respond(res, 204);
        }
      });
    }
  } else {
    respond(res, 500, "Not Handled");
  }
}

function installDeps(req, res, match) {
  if(req.method === "PUT" ) {
    req.on("data", function(src){
        try {
        var packageJSON = JSON.parse(src);
        dependencies = packageJSON.dependencies;
        for(i in dependencies){
          console.log(i);
          console.log(dependencies[i]);
          npm.load(function(err){
            npm.commands.install([i, ""], function(err, data){
            //npm.commands.install(["glob", ""], function(err, data){
              if(err){
                console.log(err.toString());
                respond(res, 500, err.toString());
              } else {
                console.log(data);
                respond(res, 200, "Modules installed.");
              }
            });
            npm.on("log", function(message){
              console.log(message);
            });
          });
        }
      } catch(e) {
        respond(res, 500, e.toString())
      }
    });
  } else {
    respond(res, 405, "Not Handled");
  }
}

function update(req, res, match) {
  console.log('update');
  if(req.method === "POST" ) {
    var id = match.params.n;
    var fileName = id.toString() + ".js";
    var outStream = fs.createWriteStream("./files/" + id + "/" + fileName);
    outStream.on("error", function(err){
      respond(res, 500, err.toString());
    });
    outStream.on('finish', function(){
      respond(res, 204);
    });
    req.pipe(outStream);
  } else {
    respond(res, 405, "Not Handled");
  }
}*/


/*
exports.installDeps = installDeps;
exports.remove = remove;
exports.update = update;
*/