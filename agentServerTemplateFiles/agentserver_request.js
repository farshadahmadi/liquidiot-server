
"use stricts"

module.exports  = function(deviceManagerUrl){

  //var $request = {};

  var request = require("request");
  var slick = require("slick");

  var $request = function(options, cb){

    if(typeof options !== 'object'){
      cb(new Error("The first argument of request function must be an opject"));
    } else if(options.hasOwnProperty("url")){
      request(options, cb);
    } else if(options.hasOwnProperty("app")){

    try{
      checkAppQuery(options.app);


      var opt = {
        url: deviceManagerUrl, // url of the Resource Registry (AKA device manager)
        qs: {
          app: options.app, 
          device: options.device, 
          operation:'and'
        }
      };

      request(opt, function(err, res, body){
        if(err){
          console.log(err);
          cb(err);
        } else {
          var devices = JSON.parse(body);
          if(!devices || devices.length == 0){
            cb(new Error("No app is found with the given app query."));
            return;
          }
          var orgOpt = JSON.parse(JSON.stringify(options));
          delete orgOpt.app;
          delete orgOpt.device;
          delete orgOpt.path;
          var url = devices[0].url+"/app/"+devices[0].matchedApps[0].id+"/api";
          if(options.path){
            url += options.path;
          }
          var opt1 = {
            url: url,
            method: options.method
	  }
          if(!options.method){
            opt1.method = "GET";
          }
          request(opt1, cb);
        }
      });
    } catch(e){
      cb(e);
    }
    } else {
      cb(new Error("the options argument (first argument) of request must have either url or app property"));
    }
  }

  function checkAppQuery(appQuery){

    var s = slick.parse(appQuery);

    if(typeof appQuery !== 'string'){
      throw new Error("'app' property of 'options' object (used in request function) must be of type string");
    }

    if(s.length != 1){
      throw new Error("Write only one query as 'app' property of 'options' obejct (used in request function)");
    }
        
    if(s[0].length != 1){
      throw new Error("Do not use combinator in 'app' property of 'options' obejct (used in request function)");
    }

    if(!s[0][0].classList || s[0][0].classList.length != 1){
      throw new Error("'app' property of 'options' object (used in request function) must contain one API");
    }
  }

  return $request;
}
