
"use strict"

module.exports = function(app, agent) {

  var fs = require("fs");
	
  //var agent = null;
  var status = {status : ""};
  	
  function respond(res, code, body){
    res.writeHead(code, {"Content-Type" : "text/plain"});
    res.end(body);
  }
	
  status.status = "running";
  agent.start(function(err){
    if(err){
      console.log("(server) Agent can not start: " + err.toString());
      status.status = "paused";
      throw err;
    } else {
      console.log("(server) Agent Started without error. ");
    }
  });

  app.put("/", function(req, res){
    var data = "";
    req.on("data", function(chunk){
      data += chunk;
    });
    req.on("end", function(){
      var targetState = JSON.parse(data);
      if(targetState.status === "running") {
        start(res);
      } else {
        stop(res);
      }
    });
  });

  function start(res) {
    if(status.status === "running") {
      respond(res, 204, JSON.stringify(status));
    } else {
      status.status = "running";
      agent.start(function(err){
          if(err){
              console.log("Agent can not start:" + err.toString());
              status.status = "paused";
              throw err;
              respond(res, 500, err.toString());
          }
      });
      respond(res, 200, JSON.stringify(status));
    }
  }

  function stop(res) {
    if(agent && status.status === "running") {
      agent.stop();
      status.status = "paused";
      respond(res, 200, JSON.stringify(status));
    } else {
      respond(res, 204);
    }
  }

  app.get("/", function(req, res) {
    respond(res, 200, JSON.stringify(status));
  });

}