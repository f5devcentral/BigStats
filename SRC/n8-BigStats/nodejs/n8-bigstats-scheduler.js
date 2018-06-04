/*
* Create task-scheduler on first run
*/

BigStats.prototype.createScheduler = function () {
  
    var that = this;
  
    return new Promise((resolve,reject) => {
  
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getResourceList() with config: ' +JSON.stringify(this.config)); }
  
      var body = {
        "interval": this.config.interval,
        "intervalUnit":"SECOND",
        "scheduleType":"BASIC_WITH_INTERVAL",
        "deviceGroupName":"tm-shared-all-big-ips",
        "taskReferenceToRun":"http://localhost:8100/mgmt/shared/n8/bigstats",
        "name":"n8-BigStats",
        "taskBodyToRun":{
          "enabled": true
        },
        "taskRestMethodToRun":"POST"
      };
  
      var path = '/mgmt/shared/task-scheduler/scheduler'; 
      var uri = that.restHelper.makeRestnodedUri(path);
      var restOp = that.createRestOperation(uri, body);
      
      that.restRequestSender.sendPost(restOp)
      .then((resp) => {
        if (DEBUG === true) {
          logger.info('[BigStats - DEBUG] - createScheduler() - resp.statusCode: ' +JSON.stringify(resp.statusCode));
          logger.info('[BigStats - DEBUG] - createScheduler() - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
        }
  
        resolve(resp.body);
  
      })
      .catch((error) => {
        let errorStatusCode = error.getResponseOperation().getStatusCode();
        var errorBody = error.getResponseOperation().getBody();
  
        logger.info('[BigStats] Scheduler - Error: Status Code: ' +errorStatusCode+ ' Message: ' +errorBody.message);
  
        if (errorBody.message.startsWith("Duplicate item")) {
          resolve('Scheduler entry exists.');
        }
        else{
          reject(errorBody);
        }
      });
  
    });
  
};


/*
* Update task-scheduler interval
*/

BigStats.prototype.updateScheduler = function (interval) {
  
    var that = this;
  
    // Get the unique identifier for the scheduler task
    var getSchedulerId = (() => {
      return new Promise((resolve,reject) => {
  
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN updateScheduler() with config: ' +JSON.stringify(this.config)); }
  
        var path = '/mgmt/shared/task-scheduler/scheduler'; 
        let uri = that.generateURI(host, path);
        let restOp = that.createRestOperation(uri);
    
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - updateScheduler() Attemtping to fetch config...'); }
    
        that.restRequestSender.sendGet(restOp)
        .then (function (resp) {
          
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - updateScheduler() Response: ' +JSON.stringify(resp.body,'', '\t')); }
  
          resp.body.items.map((element, index) => {
            if (element.name === "n8-BigStats") {
              resolve(element.id);
            }
          }); 
  
        })
        .catch((error) => {
  
          //TODO: handle this error
          reject(error);
  
        });
    
  
      });
    });
  
    //Patch the "interval" of the scheduler task with the new value.
    var patchScheduler = ((id) => {
      return new Promise((resolve,reject) => {
  
        var body = {
          "interval": interval
        };
    
        var path = '/mgmt/shared/task-scheduler/scheduler/'+id; 
        let uri = that.generateURI(host, path);
        let restOp = that.createRestOperation(uri, body);
  
   
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - patchScheduler() restOp...' +restOp); }
        
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - patchScheduler() Attemtping to patch interval...'); }
    
        that.restRequestSender.sendPatch(restOp)
        .then (function (resp) {
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - patchScheduler() Response: ' +JSON.stringify(resp.body,'', '\t')); }
          resolve(resp.body);
        });
        //TODO: catch error
      });
    });
  
    getSchedulerId()
    .then((id) => {
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Scheduler Task id: ' +id); }
      return patchScheduler(id);
    })
    .then((results) => {
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Patch Scheduler results: ' +JSON.stringify(results)); }
    });
  
  };
  
module.exports = BigStats;
