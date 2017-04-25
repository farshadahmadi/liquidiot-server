
"use stricts"

module.exports  = function(deviceManagerUrl, appId){

  var requestP = require("request-promise");
  var slick = require("slick");
  var $request = require("request-promise");
  const token = "ZmFyc2hhZGFobWFkaWdob2hhbmRpemk6RmFyc2hhZEA3MSE=";

  function CustomError(msg, reason){
    this.message = msg;
    this.reason = reason;
  }
  CustomError.prototype = new Error();

  function reqPromise(devUrl, app, options){

    var url = devUrl + "/app/" + app.id + "/api";
    if(options.path){
      url += options.path;
    }

    options.url = url;
    options.timeout = options.timeout || 5000;
    
    return requestP(options)
          .then(function(response){
            return response;
          })
          .catch(function(err){

            if(!options.successCriteria || options.successCriteria === "all" ){
              throw err;
            } else if (options.successCriteria === "some") {
              return err;
            } else {
              throw new Error( options.successCriteria + " is not a valid value for options.mode");
            }
          });
  }

  $request.toImpact = function(options){
    
    var dispatcher = {
      url: "http://dispatcher-node-mongo2.paas.msv-project.com/register",
      method: "POST",
      json: true
    };

    const impactUrl = "http://api.iot.nokia.com:9090/m2m";
    options.url = impactUrl + (options.path || "/");
    options.headers = {
      accept: "application/json",
      Authorization: "Basic " + token
    };

    return requestP(options)
      .then(function(resOfImpact){
        var obj = JSON.parse(resOfImpact);
        if(resOfImpact.requestId){
          dispatcher.body = {
            requestId: obj.requestId,
            url: process.env.DEVICE_URL + "/app/" + appId + "/api"
          }
          console.log(dispatcher);

	  var waitTill = new Date(new Date().getTime() + 5 * 1000);
	  while(waitTill > new Date()){};

          return requestP(dispatcher)
            .then(function(resOfDispatcher){
              return obj;
            });
        } else {
          return obj;
        }
      });
  }

  $request.toApp = function(options) {
    
    if(typeof options == 'object' && options.hasOwnProperty("app")){
      
      var opt = {
        url: deviceManagerUrl, // url of the Resource Registry (AKA device manager)
        qs: {
          app: options.app, 
          device: options.device, 
          operation:'and'
        }
      };

      return requestP(opt).
        then(function(res){

          checkAppQuery(options.app);
          
          var devices = JSON.parse(res);
          if(!devices || devices.length == 0){
            throw new Error("No app was found with " + options.app + " as options.app value.");
          }
          
          var reqPromises = [];

          for(var i = 0; i < devices.length; i++){
            for(var j = 0; j < devices[i].matchedApps.length; j++){
              reqPromises.push(reqPromise(devices[i].url, devices[i].matchedApps[j], options));
            }
          }

          return Promise.all(reqPromises)
            .then(function(response){

              var res = {
                successes: [],
                failures: []
              };

              response.forEach(function(value){
                if(value instanceof Error){
                  res.failures.push(value);
                } else {
                  res.successes.push(value);
                }
              });

              if(res.successes.length == 0){
                throw new CustomError("None of requests were succeeded", res);
              }

              return res;
            });
        });
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
      throw new Error("app property of options object (used in request function) must contain one API");
    }
  }

  return $request;
}
