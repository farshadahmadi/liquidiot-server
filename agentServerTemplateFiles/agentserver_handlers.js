
//"use strict"

module.exports = function(exApp, exAppServer, iotApp) {

  var fs = require("fs");
	
  //var agent = null;
  var status = {status : ""};
  	
  function respond(res, code, body){
    //res.writeHead(code, {"Content-Type" : "text/plain"});
    res.writeHead(code, {"Content-Type" : "application/json"});
    res.end(body);
  }
	
  status.status = "running";
  iotApp.start();
  //console.log("ejra mishe");

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
      iotApp.stop();
      respond(res, 200, JSON.stringify(status));
    } else {
      respond(res, 204);
    }
  }

  exApp.get("/", function(req, res) {
    respond(res, 200, JSON.stringify(status));
  });

  exApp.delete("/", function(req, res){
    exAppServer.close();
    //if(iotApp) {
      iotApp.stop();
      delete iotApp;
    //}
    respond(res, 204);
  });

}
