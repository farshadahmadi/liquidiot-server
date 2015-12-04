var express = require("express");
var app = express();

require("./router/main")(app);


var server = app.listen(8000, function(){
  console.log("server started");  
});