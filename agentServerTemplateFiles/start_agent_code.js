
var agent = createAgentObject();

agent.start(function(err){
  if(err){
    console.log("Agent can not start:" + err.toString());
    throw  err;
    //agent.stop();
  } else {
    console.log("Agent Started without error. ");
    agent.stop();
  }
});

process.on("uncaughtException", function(error){
  console.log("inside uncaught: " + error.toString());
  //var instanceLog = fs.readFileSync( __dirname + "/debug.log", "utf8");
  //throw new Error(instanceLog);
  //console.error("Uncaught exception: " + err.toString());
  throw error;
});