/*
*   BigStats:
*     iControl LX Stats Exporter for BIG-IP 
*
*   N. Pearce, May 2018
*   http://github.com/npearce
*
*/
"use strict";

const logger = require('f5-logger').getInstance();
const host = 'localhost';
const bigStatsSettingsPath = '/shared/n8/bigstats_settings';
const vipUri = '/mgmt/tm/ltm/virtual/';
const poolUri = '/mgmt/tm/ltm/pool/';

var DEBUG = false;

function BigStats() {
  this.config = {};
  this.stats = {};
}

BigStats.prototype.WORKER_URI_PATH = "shared/n8/bigstats";
BigStats.prototype.isPublic = true;
BigStats.prototype.isSingleton = true;

/**
 * handle onStart
 */
BigStats.prototype.onStart = function(success, error) {

  logger.info("[BigStats] Starting...");

  // Make BigStats_Settings worker a dependency.
  var bigStatsSettingsUrl = this.restHelper.makeRestnodedUri(bigStatsSettingsPath);
  this.dependencies.push(bigStatsSettingsUrl);
  success();

};

/**
 * handle onStartCompleted
 */
BigStats.prototype.onStartCompleted = function(success, error) {

  //Fetch state (configuration data) from persisted worker /bigstats_settings
  this.getSettings()
  .then(()=> {
    //Setup Task-Scheduler to poll this worker via onPost()
    return this.createScheduler();
  })
  .then((res) => {
    if (DEBUG === true) { logger.info('[BigStats] Scheduler response: '+JSON.stringify(res,'','\t')); }
    success();

  });

};

/**
 * handle HTTP POST request
 */
BigStats.prototype.onPost = function (restOperation) {

  var data = restOperation.getBody();
  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - onPost receved data: ' +JSON.stringify(data)); }
  
  if (typeof data.enabled !== 'undefined' && data.enabled === true) {

    this.getSettings()
    .then(() => {
      this.pullStats();
    });

  }

  restOperation.setBody("BigStats says, Thanks!!");
  this.completeRestOperation(restOperation);

};

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

      logger.info('[BigStats] - Error: Status Code: ' +errorStatusCode+ ' Message: ' +errorBody.message);

      if (errorBody.message.startsWith("Duplicate item")) {
        resolve('Scheduler entry exists.');
      }
      else{
        reject(errorBody);
      }
    });

  });

};

BigStats.prototype.getSettings = function () {

  var that = this;
  
  return new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getSettings()'); }

    let uri = that.generateURI(host, '/mgmt' +bigStatsSettingsPath);
    let restOp = that.createRestOperation(uri);

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSettings() Attemtping to fetch config...'); }

    that.restRequestSender.sendGet(restOp)
    .then (function (resp) {
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSettings() Response: ' +JSON.stringify(resp.body.config,'', '\t')); }
      if (resp.body.config.debug === true) {
        logger.info('debug is true');
        DEBUG = true;
      }
      else {
        DEBUG = false;
      }

      if (resp.body.config.interval !== that.config.interval) {
        logger.info('Interval changed... ' +resp.body.config.interval);
        that.updateScheduler(resp.body.config.interval);
      }
      
      that.config = resp.body.config;

      resolve(resp.body.config);

    })
    .catch (function (error) {

      logger.info('[BigStats] - Error retrieving settings: ' +error);
      reject(error);

    });

  });
};

BigStats.prototype.pullStats = function () {

  var that = this;

  var getResourceList = (() => {
    return new Promise((resolve,reject) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getResourceList() with config: ' +JSON.stringify(this.config)); }

      var path = '/mgmt/tm/ltm/virtual/';
      var query = '$select=subPath,fullPath,selfLink,pool';
      
      var uri = that.restHelper.makeRestnodedUri(path, query);
      var restOp = that.createRestOperation(uri);
    
      that.restRequestSender.sendGet(restOp)
      .then((resp) => {
        if (DEBUG === true) {
          logger.info('[BigStats - DEBUG] - getResourceList - resp.statusCode: ' +JSON.stringify(resp.statusCode));
          logger.info('[BigStats - DEBUG] - getResourceList - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
        }

        resolve(resp.body);
  
      })
      .catch((error) => {
        logger.info('[BigStats] - Error: ' +JSON.stringify(error));
        reject(error);
      });
  
    });
  }); 

  var parseResources = ((list) => {
    return new Promise((resolve,reject) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN parseResources() with list: ' +JSON.stringify(list)); }

      list.items.map((element, index) => {

        Promise.all([getVipStats(element), getPoolStats(element)])
        .then((values) => {
          if (DEBUG === true) { 
            logger.info('[BigStats - DEBUG] - Index:' +index+ ', values[0]: ' +JSON.stringify(values[0],'','\t'));
            logger.info('[BigStats - DEBUG] - Index:' +index+ ', values[1]: ' +JSON.stringify(values[1],'','\t'));
          }

          if (typeof that.stats[element.subPath] === 'undefined') {
            that.stats[element.subPath] = {};
          }
          that.stats[element.subPath].vip = values[0];
          that.stats[element.subPath].pool = values[1];

          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(list.items.length - 1)+ '  index: ' +index); }
          if (index === (list.items.length - 1)) {
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - End of resource list (index === (list.items.length - 1))'); }
            resolve(that.stats);
          }
        });
      });
    });
  });
  
  var getVipStats = ((resource) => {
    return new Promise((resolve,reject) => {

      var that = this;
    
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipStats with resource_list: ' +JSON.stringify(resource)); }

      var path = ""; 
      var PREFIX = "https://localhost";
      if (resource.selfLink.indexOf(PREFIX) === 0) {
        path = resource.selfLink.slice(PREFIX.length).split("?").shift();
      }
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+path); }
      var uri = path+'/stats';
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Stats URI: '+uri); }

      var url = that.restHelper.makeRestnodedUri(uri);
      var restOp = that.createRestOperation(url);
    
      that.restRequestSender.sendGet(restOp)
      .then((resp) => {

        let name = path.split("/").slice(-1)[0];
        let entry_uri = path+'/'+name+'/stats';
        let entry_url ="https://localhost" +entry_uri;

        let vipStats = { 
          clientside_curConns: resp.body.entries[entry_url].nestedStats.entries["clientside.curConns"].value,
          clientside_maxConns: resp.body.entries[entry_url].nestedStats.entries["clientside.maxConns"].value,
          clientside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsIn"].value,
          clientside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsOut"].value,
          clientside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsIn"].value,
          clientside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsOut"].value  
        };

        resolve(vipStats);

      })
      .catch((error) => {
        logger.info('[BigStats] - Error: ' +error);
        reject(error);
      });
    });
  });

  var getPoolStats = ((resource) => {
    return new Promise((resolve,reject) => {

      var that = this;
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getPoolStats with resource_list: ' +JSON.stringify(resource)); }

      var path = ""; 
      var PREFIX = "https://localhost";

      if (resource.poolReference.link.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        path = resource.poolReference.link.slice(PREFIX.length).split("?").shift();
      }
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+path); }
      var uri = path+'/stats';
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Stats URI: '+uri); }

      var url = that.restHelper.makeRestnodedUri(uri);
      var restOp = that.createRestOperation(url);
    
      that.restRequestSender.sendGet(restOp)
      .then((resp) => {

        let name = path.split("/").slice(-1)[0];
        let entry_uri = path+'/'+name+'/stats';
        let entry_url ="https://localhost" +entry_uri;

        let poolStats = { 
          serverside_curConns: resp.body.entries[entry_url].nestedStats.entries["serverside.curConns"].value,
          serverside_maxConns: resp.body.entries[entry_url].nestedStats.entries["serverside.maxConns"].value,
          serverside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsIn"].value,
          serverside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsOut"].value,
          serverside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsIn"].value,
          serverside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsOut"].value  
        };

        resolve(poolStats);

      })
      .catch((error) => {
        logger.info('[BigStats - Error] pool_stats error: '+error);
      });
    });
  });

  this.getSettings()
  .then((config) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - config.destination: ' +JSON.stringify(config.destination)); }
    return getResourceList();

  })    
  .then((resource_list) => {

    return parseResources(resource_list);

  })
  .then((stats) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Pushing stats: ' +JSON.stringify(stats, '', '\t')); }
    that.pushStats(stats);

  })
  .catch((error) => {

    logger.info('Promise Chain Error: ' +error);

  });

};


//Push stats to a remote destination
BigStats.prototype.pushStats = function (body) {

  //If the destination is 'http' or 'https'
  if (typeof this.config.destination.proto !== 'undefined' && this.config.destination.proto.startsWith('http')) {

    if (this.config.destination.proto === 'https') {
      var http = require("https");
    }
    else {
      var http = require("http");
    }
  
    var options = {
      "method": "POST",
      "hostname": this.config.destination.address,
      "port": this.config.destination.port,
      "path": this.config.destination.uri,
      "headers": {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    };
    
    var req = http.request(options, function (res) {
      var chunks = [];
    
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });
    
      res.on('end', function () {
        var body = Buffer.concat(chunks);
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats(): ' +body.toString()); }
      });
  
    });
    
    req.write(JSON.stringify(body));
    req.on('error', ((error) => {
      logger.info('[BigStats] - ***************Error pushing stats): ' +error);
    }));
    req.end();
  }

  //If the proto is statsd
  else if (this.config.destination.proto === "statsd") {

    //we're using the statsd client
    var StatsD = require('node-statsd'),
    sdc = new StatsD(this.config.destination.address, 8125);

    Object.keys(body).map((level1) => {
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd: level1: ' +level1); }
      Object.keys(body[level1]).map((level2) => {
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd - level1+2: ' +level1+'.'+level2); }
        Object.keys(body[level1][level2]).map((level3) => {
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd - level1+2+3: ' +level1+'.'+level2+'.'+level3); }

          let namespace = level1+'.'+level2+'.'+level3;
          let value = body[level1][level2][level3]

          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd - namespace: ' +namespace+ ' value: ' +value); }
          sdc.gauge(namespace, value);

        });
      });      
    });

  } else if (this.config.destination.proto === "kafka") {
    //TODO: publish to Kafka Topic
    logger.info('[BigStats] Proto not yet implemented: \'kafka\'');
  }
  else {
    logger.info('[BigStats] - Unrecognized \'proto\'');
  }

};


/**
* Creates a new rest operation instance. Sets the target uri and body
*
* @param {url} uri Target URI
* @param {Object} body Request body
*
* @returns {RestOperation}
*/
BigStats.prototype.createRestOperation = function (uri, body) {

  var restOp = this.restOperationFactory.createRestOperationInstance()
      .setUri(uri)
      .setContentType("application/json")
      .setIdentifiedDeviceRequest(true);

      if (body) {
        restOp.setBody(body);
      }

return restOp;

};

/**
 * Generate URI based on individual elements (host, path).
 *
 * @param {string} host IP address or FQDN of a target host
 * @param {string} path Path on a target host
 *
 * @returns {url} Object representing resulting URI.
 */
BigStats.prototype.generateURI = function (host, path) {

  return this.restHelper.buildUri({
      protocol: 'http',
      port: '8100',
      hostname: host,
      path: path
  });
};

/**
 * handle /example HTTP request
 */
BigStats.prototype.getExampleState = function () {
  
  return {
    // redirce to /bigstats_settings
  };

};

module.exports = BigStats;
