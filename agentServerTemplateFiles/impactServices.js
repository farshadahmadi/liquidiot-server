
"use stricts"

module.exports  = function(deviceManagerUrl, appId, deviceInfo, impact){

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
  
  impact.services = {};
  /*var impact = {
    services: {}
  };*/

  const impactHost = "http://api.iot.nokia.com:9090/";
  //const impactHost = "http://api.impact.nokia-innovation.io:9090/";
  //const dispatcherUrl = "http://dispatcher-node-mongo2.paas.msv-project.com/register";
  const dispatcherUrl = "http://130.230.142.100:8082/register";
  //const dispatcherUrl = "http://130.230.142.100:8090/register";
  
  impact.services.getNumberOfEndpoints = function(queryObject){

   queryObject.startOffset = 0;
   queryObject.endOffset = 0;
   

    var path = '/m2m/endpoints';
    var qs = '?' + queryString.stringify(queryObject);
    var url = urlJoin(impactHost, path, qs);

    var options = {
      url: url,
      json: true,
      headers: {
        accept: "application/json",
        Authorization: "Basic " + token
      }
    }

    return requestP(options);
      /*.then(function(res){
        return res.totalDevices;
      });*/
  }

  //impactServices.listEndpoints = function(groupName, startOffset, endOffset){
  impact.services.listEndpoints = function(queryObject){
    
    /*if( typeof startOffset === 'undefined' && typeof endOffset === 'undefined' ) {
      startOffset = 0;
      endOffset = 0;
    }*/

    return Promise.resolve().then(function(){
      if(queryObject && (queryObject.startOffset === 0)){
        throw new CustomError('startOffset must start from 1', 'startOffset must start from 1'); 
      } else{

        var path = '/m2m/endpoints';
        //var qs = '?' + queryString.stringify({groupName: groupName, startOffset: startOffset, endOffset: endOffset});
        var qs = '?' + queryString.stringify(queryObject);
        var url = urlJoin(impactHost, path, qs);

        var options = {
          url: url,
          json: true,
          headers: {
            accept: "application/json",
            Authorization: "Basic " + token
          }
        }
        return options;
      }
    }).then(function(options){

      return requestP(options);
        /*.then(function(res){
          return res.directEndPoints;
        });*/
    });
  }

  impact.services.getEndpointDetails = function(pathObject){

    var dispatcher = {
      url: dispatcherUrl,
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
      var obj = JSON.parse(resOfImpact);
      //if(obj.requestId || obj.subscriptionId){
      dispatcher.body = {
        id: obj.requestId, //|| obj.subscriptionId,
        url: deviceInfo.url + "/app/" + appId + "/api"
        //url: deviceInfo.url + "/app/" + appId + "/cb"
      }
  
      console.log(dispatcher);

        //var waitTill = new Date(new Date().getTime() + 5 * 1000);
        //while(waitTill > new Date()){};

      return requestP(dispatcher)
        .then(function(resOfDispatcher){
          //return resOfImpact;
          //return obj.requestId;
          return obj;
        });
    });
  }

  impact.services.createLifecycleEventSubscription = function(bodyObject){

    var dispatcher = {
      url: dispatcherUrl,
      method: "POST",
      json: true
    };
    
    return Promise.resolve().then(function(){

      //var serialNumber = pathObject.serialNumber;
      var path = '/m2m/subscriptions?type=lifecycleEvents';
      var url = urlJoin(impactHost, path);

      var options = {
        url: url,
        method: 'POST',
        json: true,
        body: bodyObject,
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
      //var obj = JSON.parse(resOfImpact);
      //if(obj.requestId || obj.subscriptionId){
      dispatcher.body = {
        id: resOfImpact.subscriptionId, //|| obj.subscriptionId,
        url: deviceInfo.url + "/app/" + appId + "/api"
        //url: deviceInfo.url + "/app/" + appId + "/cb"
      }
  
      console.log(dispatcher);

        //var waitTill = new Date(new Date().getTime() + 5 * 1000);
        //while(waitTill > new Date()){};

      return requestP(dispatcher)
        .then(function(resOfDispatcher){
          //return resOfImpact;
          //return obj.requestId;
          return resOfImpact;
        });
    });
  }

  impact.services.deleteSubscription = function(pathObject){

    return Promise.resolve().then(function(){
      var path = '/m2m/subscriptions';
      var subscriptionId = pathObject.subscriptionId;
      var url = urlJoin(impactHost, path, subscriptionId);

      var options = {
        url: url,
        method: "DELETE",
        json: true,
        headers: {
          accept: "application/json",
          Authorization: "Basic " + token
        }
      }
      return options;
    })
    .then(function(options){
      return requestP(options);
    });
  }

  return impact;
}
