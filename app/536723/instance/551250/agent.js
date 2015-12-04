
function Agent() {
  this.work = "";
  this.preStopWork = "";
  this.timerObj = "";
}

Agent.prototype.setWork = function(mainFunc) {
  this.work = mainFunc;
}

Agent.prototype.createInterval = function(f, param, interval) {
  this.timerObj = setInterval( function() {f(param);}, interval );
}

Agent.prototype.start = function(callback) {
  this.createInterval(this.work, callback, 1000);
}

Agent.prototype.setPreStopWork = function(preStopFunc) {
  this.preStopWork = preStopFunc;
}

Agent.prototype.stop = function() {
  this.preStopWork();
  clearInterval(this.timerObj);
}

module.exports = Agent;