
"use stricts"

module.exports  = function(deviceManagerUrl){

  var request = require("request-promise");
  var slick = require("slick");

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
    
    return request(options)
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

  var $request = function(options) {
    
    if(typeof options == 'object' && options.hasOwnProperty("app")){
      
      var opt = {
        url: deviceManagerUrl, // url of the Resource Registry (AKA device manager)
        qs: {
          app: options.app, 
          device: options.device, 
          operation:'and'
        }
      };

      return request(opt).
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
    } else {
      return request(options);
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
