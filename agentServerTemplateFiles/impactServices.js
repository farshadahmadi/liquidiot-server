
"use stricts"

module.exports  = function(deviceManagerUrl, appId, deviceInfo){

  var requestP = require("request-promise");

  var urlJoin = require('url-join');
  var queryString = require('querystring');
  
  //const token = "ZmFyc2hhZGFobWFkaWdob2hhbmRpemk6RmFyc2hhZEA3MSE=";
  const token = "QWhtYWRpZ2hvaGFuZGl6aTpOb2tpYUA5MSE=" 

  function CustomError(msg, reason){
    this.message = msg;
    this.reason = reason;
  }
  CustomError.prototype = new Error();
  
  var impactServices = {};
  //const impactHost = "http://api.iot.nokia.com:9090/";
  const impactHost = "http://api.impact.nokia-innovation.io:9090/";

  //impactServices.listEndpoints = function(groupName, startOffset, endOffset){
  impactServices.listEndpoints = function(queryObject){
    
    /*if( typeof startOffset === 'undefined' && typeof endOffset === 'undefined' ) {
      startOffset = 0;
      endOffset = 0;
    }*/

    var path = '/m2m/endpoints';
    //var qs = '?' + queryString.stringify({groupName: groupName, startOffset: startOffset, endOffset: endOffset});
    var qs = '?' + queryString.stringify(queryObject);
    var url = urlJoin(impactHost, path, qs);

    var options = {
      url: url,
      //json: true,
      headers: {
        accept: "application/json",
        Authorization: "Basic " + token
      }
    }

    return requestP(options);
  }

  impactServices.getEndpointDetails = function(pathObject){

    var dispatcher = {
       //url: "http://dispatcher-node-mongo2.paas.msv-project.com/register",
      url: "http://130.230.142.100:8090/register",
      method: "POST",
      json: true
    };
    
    return Promise.resolve().then(function(){


      var serialNumber = pathObject.serialNumber;
      var path = '/m2m/endpoints';
      var url = urlJoin(impactHost, path, serialNumber);

      var options = {
        url: url,
        //json: true,
        headers: {
          accept: "application/json",
          Authorization: "Basic " + token
        }
      }
      return options;
    })
    .then(function(options){
      return requestP(options);
    })
    .then(function(resOfImpact){
      console.log(resOfImpact);
      var obj = JSON.stringify(resOfImpact);
      //if(obj.requestId || obj.subscriptionId){
      dispatcher.body = {
        id: obj.requestId, //|| obj.subscriptionId,
        url: deviceInfo.url + "/app/" + appId + "/api"
      }
  
      console.log(dispatcher);

        //var waitTill = new Date(new Date().getTime() + 5 * 1000);
        //while(waitTill > new Date()){};

      return requestP(dispatcher)
        .then(function(resOfDispatcher){
          return resOfImpact;
        });
    });
  }

  return impactServices;
}
