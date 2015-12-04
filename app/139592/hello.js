
var Agent = require('./agent');

//inherit from Agent
function MainClass(){
  Agent.call(this);
}

var counter = 0;

MainClass.prototype = Object.create(Agent.prototype);
MainClass.prototype.constructor = MainClass;

MainClass.prototype.preStopFunction = function(){
}


MainClass.prototype.mainFunction = function(callback) {
  try {
    //application specific part - start
    console.log("helloOoOo!");
    //application specific part - end
    if(counter === 0) {
      callback(null);
    }
    counter++;
    //console.log("N: " + counter);
  } catch(err) {
    callback(err);
  }
}

function createAgentObject() {
  var obj = new MainClass();
  obj.setWork(obj.mainFunction);
  obj.setPreStopWork(obj.preStopFunction);
  return obj;
}
