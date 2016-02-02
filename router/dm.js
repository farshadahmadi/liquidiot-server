/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 */

module.exports = function(deviceManagerUrl, deviceInfo) {
  

  var request = require("request");

  module.addAppInfo = function(appDescr, callback) {
      var url = deviceManagerUrl + deviceInfo.id + "/apps";
      console.log("This is the url" + url);
      var options = {
          uri: url,
          method: 'POST',
          json: appDescr
      };

      request(options, function(err, res, body){
          if(err) {
              callback(err);
          } else if(res.statusCode == 200){
              console.log(body + " : " + typeof(body));
              callback(null, body);
              //callback(null, JSON.parse(body).status);
          }
      });
  };

  module.removeAppInfo = function(appDescr, callback){
      var aid = appDescr.id;
      var url = deviceManagerUrl + deviceInfo.id + "/apps/" + aid;
      console.log("This is the url" + url);
      var options = {
          uri: url,
          method: 'DELETE'
      };

      request(options, function(err, res, body){
          if(err) {
              callback(err);
          } else if(res.statusCode == 200){
              console.log(body + " : " + typeof(body));
              callback(null, body);
              //callback(null, JSON.parse(body).status);
          }
      });
  }

  return module;
}