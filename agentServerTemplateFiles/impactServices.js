
"use stricts"

module.exports  = function(deviceManagerUrl, appId, deviceInfo){

  var requestP = require("request-promise");

  var urlJoin = require('url-join');
  var queryString = require('querystring');
  
  const token = "ZmFyc2hhZGFobWFkaWdob2hhbmRpemk6RmFyc2hhZEA3MSE=";
  //const token = "QWhtYWRpZ2hvaGFuZGl6aTpOb2tpYUA5MSE=" 

  function CustomError(msg, reason){
    this.message = msg;
    this.reason = reason;
  }
  CustomError.prototype = new Error();
  
  var impactServices = {};
  const impactHost = "http://api.iot.nokia.com:9090/";
  //const impactHost = "http://api.impact.nokia-innovation:9090/";

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

  return impactServices;
}
