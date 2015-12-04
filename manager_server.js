/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farsad.ahmadi.gh@gmail.com>
 */

var express = require("express");
var app = express();

require("./router/main")(app);


var server = app.listen(8000, function(){
  console.log("server started");  
});
