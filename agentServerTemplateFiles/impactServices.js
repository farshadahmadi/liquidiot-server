
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
  //const dispatcherUrl = "http://130.230.142.100:8082/register";
  const dispatcherHost = "http://130.230.142.100:8082/";
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

   const dispatcherUrl = urlJoin(dispatcherHost, "register");

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
        url: deviceInfo.url + "/app/" + appId + "/api",
        mode: "once"
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
    var path = '/m2m/subscriptions?type=lifecycleEvents';
    return createEventSubscription(bodyObject, path);
  }

  impact.services.createResourceEventSubscription = function(bodyObject){
    var path = '/m2m/subscriptions?type=resources';
    return createEventSubscription(bodyObject, path);
  }

  //impact.services.createLifecycleEventSubscription = function(bodyObject){
  function createEventSubscription(bodyObject, path){

   const dispatcherUrl = urlJoin(dispatcherHost, "register");

    var dispatcher = {
      url: dispatcherUrl,
      method: "POST",
      json: true
    };
    
    return Promise.resolve().then(function(){

      //var path = '/m2m/subscriptions?type=lifecycleEvents';
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
        url: deviceInfo.url + "/app/" + appId + "/api",
        appId: appId,
        mode: "subscription"
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

  // get all events subscriptions (both lifecycle and resource)
  impact.services.getAllEventSubscriptions = function(pathObject){
    
   // get lifecycle event subscription
    return impact.services.getLifecycleEventSubscriptions(pathObject)
             // successsull means there are lifecycle events subscription 
             .then(function(lifecycleSubs){
               // get resource event subscription
               return impact.services.getResourceEventSubscriptions(pathObject)
                        // successful means there are resource event subscription
                        .then(function(resourceSubs){
                          var ls = lifecycleSubs.subscriptions;
                          var rs = resourceSubs.subscriptions;
                          // concat the event resources to lifecycle esources
                          ls.push.apply(ls, rs);
                          return {subscriptions: ls};
                        })
                        // error means either there are not resource event (with status code 404) or there are other kind of errors
                        .catch(function(err){
                          // in case of 404, the list of all events will be the list of lifecycle events (since there are no resource events)
                          if(err.statusCode === 404){
                            return lifecycleSubs;
                          } else {
                            throw err;
                          }
                        });
             })
             // error means either there are not lifecycle events (with status code 404) or there are other kind of errors
             // in case of 404, the list of all events will be the list of resource events (since there are no lifecycle events)
             .catch(function(err){
               if(err.statusCode === 404){
                 // get resource event subscription
                 return impact.services.getResourceEventSubscriptions(pathObject)
                          // successsull means there are resource event subscriptions 
                          .then(function(resourceSubs){
                            return resourceSubs; 
                          })
                 
               } else {
                 throw err;
               }
             });
  }

  impact.services.getLifecycleEventSubscriptions = function(pathObject){
    pathObject.type = 'lifecycleEvents';
    return getEventSubscriptions(pathObject);
  }

  impact.services.getResourceEventSubscriptions = function(pathObject){
    pathObject.type = 'resources';
    return getEventSubscriptions(pathObject);
  }

  function getEventSubscriptions(pathObject){
  //impact.services.getLifecycleEventSubscriptions = function(pathObject){
  
    return Promise.resolve().then(function(){


      var path = '/m2m/subscriptions';
      if(pathObject.groupName === ''){
        delete pathObject.groupName;
      }
      //pathObject.type = 'lifecycleEvents';
      var qs = '?' + queryString.stringify(pathObject);
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
    })
    .then(function(options){
      return requestP(options);
    })
     // resOfImpact is the list all lifecycle subscriptions this USER created so far
    .then(function(resOfImpact){
      console.log(resOfImpact);

      const dispatcherUrl = urlJoin(dispatcherHost, appId, "subscriptions");

      var dispatcher = {
        url: dispatcherUrl,
        method: "GET",
        json: true
      };
  
      console.log(dispatcher);

      // resOfDispatcher is the list of all subscriptions this APP has created so far
      return requestP(dispatcher)
        .then(function(resOfDispatcher){
          console.log(resOfDispatcher);
          // the list of all lifecycle subscriptions created by USER must be filtered by (narrowed down to) the ones created by this APP
          var listOfSubs = resOfImpact.subscriptions.filter(function(sub){
            return (resOfDispatcher.indexOf(sub.subscriptionId) !== -1)
          });
          return {subscriptions: listOfSubs};
        });
    });
  }

  impact.services.deleteAllSubscriptions = function(){

    return impact.services.getAllEventSubscriptions({groupName:''})
      .then(function(listOfSubs){
        console.log(listOfSubs);
        return listOfSubs.subscriptions.map(sub => sub.subscriptionId);
      })
      .then(function(listOfSubIds){
        console.log(listOfSubIds);
        return listOfSubIds.map(function(subId){
          return impact.services.deleteSubscription({subscriptionId: subId});
        });
      })
      .then(function(promises){
        return Promise.all(promises);
      })
      // Following API documentation design, if all subscriptions are deleted successfully, just says successfull 
      .then(function(){
        return {msg: "Success"};
      });

  }

  return impact;
}
