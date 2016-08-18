
"use strict"

module.exports = function(server, iotApp) {

  var fs = require("fs");
	
  //var agent = null;
  var status = {status : ""};
  	
  function respond(res, code, body){
    res.writeHead(code, {"Content-Type" : "text/plain"});
    res.end(body);
  }
	
  status.status = "running";
  iotApp.start();
  //console.log("ejra mishe");

  server.put("/", function(req, res){
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
      iotApp.stop();
      respond(res, 200, JSON.stringify(status));
    } else {
      respond(res, 204);
    }
  }

  server.get("/", function(req, res) {
    respond(res, 200, JSON.stringify(status));
  });

}