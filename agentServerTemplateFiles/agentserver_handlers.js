"use strict"

module.exports = function(exApp, exAppServer, iotApp, emitter) {

  var fs = require("fs");
	
  var status = {status : ""};
  	
  function respond(res, code, body){
    res.writeHead(code, {"Content-Type" : "application/json"});
    res.end(body);
  }
	
  status.status = "running";
  iotApp.start();

  exApp.put("/", function(req, res){
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
      iotApp.start();
      respond(res, 200, JSON.stringify(status));
    }
  }

  function stop(res) {
    if(iotApp && status.status === "running") {
      status.status = "paused";
      emitter.once('paused', function(){
        console.log('pausedeeeeeeeeeeeeeee');
        respond(res, 200, JSON.stringify(status));
      });
      iotApp.stop();
      //respond(res, 200, JSON.stringify(status));
    } else {
      respond(res, 204);
    }
  }

  exApp.get("/", function(req, res) {
    respond(res, 200, JSON.stringify(status));
  });

}
