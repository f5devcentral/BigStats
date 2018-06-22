/*
*   BigStats:
*     iControl LX Stats Exporter for BIG-IP 
*
*   N. Pearce, June 2018
*   http://github.com/npearce
*
*/
"use strict";

const logger = require('f5-logger').getInstance();
const host = 'localhost';
const bigStatsSettingsPath = '/shared/n8/bigstats_settings';
var StatsD = require('node-statsd');
var kafka = require('kafka-node');
var Producer = kafka.Producer;

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

  try {
    // Make BigStats_Settings worker a dependency.
    var bigStatsSettingsUrl = this.restHelper.makeRestnodedUri(bigStatsSettingsPath);
    this.dependencies.push(bigStatsSettingsUrl);
    success();
    
  } catch (err) {
    error(err);    
  }

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

    if (DEBUG === true) { logger.info('[BigStats] Scheduler response: ' +JSON.stringify(res,'','\t')); }
    success();

  })
  .catch((err) => {

    error(err);

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

/**
 * Creates an iControl 'task-scheduler' job to poke onPost every 'n' seconds
 * Executed by onStartCompleted()
 * Interval configuration managed by BigStatsSettings: this.config.interval
 */
BigStats.prototype.createScheduler = function () {

  var that = this;

  return new Promise((resolve,reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN createScheduler() with config: ' +JSON.stringify(this.config)); }

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

/**
 * Updates the iControl 'task-scheduler' job if interval has changed
 * Executed with every onPost poll.
 * 'interval' is a persisted setting managed by BigStatsSettings. See bigstats-schema.json
 */
BigStats.prototype.updateScheduler = function (interval) {
  
  var that = this;

  // Fetch task-cheduler's unique identifier for the BigStats scheduler task
  var getSchedulerId = (() => {
    return new Promise((resolve, reject) => {

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

  // Using the task-scheduler unique id, Patch the "interval" of the scheduler task with the new value.
  var patchScheduler = ((id) => {
    return new Promise((resolve, reject) => {

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
      })
      .catch((error) => {

        //TODO: handle this error
        reject(error);

      });
    });
  });

  // Execute the shceduler interval update 
  getSchedulerId()
  .then((id) => {
    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Scheduler Task id: ' +id); }
    return patchScheduler(id);
  })
  .then((results) => {
    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Patch Scheduler results: ' +JSON.stringify(results)); }
  })
  .catch((err) => {
    logger.info('[BigStats] Error updating Task Scheduler:' +err);
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

      //Check if interval changed
      if (typeof that.config.interval !== 'undefined' && that.config.interval !== resp.body.config.interval) {

        that.updateScheduler(resp.body.config.interval);

      }

      that.config = resp.body.config;      

      resolve(that.config);

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
    return new Promise((resolve, reject) => {

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

//TODO: implement sizing: 
  var parseResources = ((list) => {
    return new Promise((resolve, reject) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN parseResources() with list: ' +JSON.stringify(list)); }

      // Fetch stats from each resource, based on config.size
      list.items.map((element, index) => {

        /*
        * For 'small' stats size (config.size: small), fetch only Virtual IP in/out data
        */ 
        if (typeof this.config.size === 'undefined' || this.config.size === 'small') {

          getVipStats(element)
          .then((values) => {
            if (DEBUG === true) { 
              logger.info('[BigStats - DEBUG] - Index:' +index+ ', values: ' +JSON.stringify(values,'','\t'));
            }
  
            if (typeof that.stats[element.subPath] === 'undefined') {
              that.stats[element.subPath] = {};
            }
            that.stats[element.subPath].vip = values;
  
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(list.items.length - 1)+ '  index: ' +index); }
            if (index === (list.items.length - 1)) {
  
              if (DEBUG === true) { logger.info('[BigStats - DEBUG] - End of resource list (index === (list.items.length - 1))'); }
              resolve(that.stats);
            }
  
          })
          .catch((err) => {
  
            logger.info('[BigStats] - Error: ' +JSON.stringify(err));
            reject(err);
  
          });
  
        }

        /*
        * For 'medium' stats size (config.size: medium), fetch:
        *   - Virtual IP in/out data
        *   - Individual Pool Member data
        */ 
        else if (this.config.size === 'medium') {

          Promise.all([getVipStats(element), getPoolMemberList(element)])  //TODO: add getPoolMemberStats(element)
          .then((values) => {
            if (DEBUG === true) { 
              logger.info('[BigStats - DEBUG] - Index:' +index+ ', getVipStats() values[0]: ' +JSON.stringify(values[0],'','\t'));
              logger.info('[BigStats - DEBUG] - Index:' +index+ ', getPoolMemberList() values[1]: ' +JSON.stringify(values[1],'','\t'));
            }

            // Initialize object on first run

            if (typeof that.stats[element.subPath] === 'undefined') {
              that.stats[element.subPath] = {};
            }

            if (typeof that.stats[element.subPath][element.pool] === 'undefined') {
//              logger.info('initializing object array: ' +that.stats[element.subPath][element.pool]);
              that.stats[element.subPath][element.pool] = [];
            }

            that.stats[element.subPath].vip = values[0];

            values[1].map((item, index) => {
              getPoolMemberStats(item)
              .then((stats) => {
                logger.info('getPoolMemberStats(values[1]) returned:' +JSON.stringify(stats));
                that.stats[element.subPath][element.pool].push(stats);
                logger.info('getPoolMemberStats(values[1]) that.stats:' +JSON.stringify(that.stats, '', '\t'));

                if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(item.length - 1)+ '  index: ' +index); }
                if (index === (item.length - 1)) {
      
                  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - End of getPoolMemberList (index === (list.items.length - 1))'); }
                  resolve(that.stats);
    
                }
    

              })
              .catch((err) => {
                reject(err);
              });
            });
  
  
          })
          .catch((err) => {
  
            logger.info('[BigStats] - Error: ' +JSON.stringify(err));
            reject(err);
  
          });
  
        }

        /*
        * For 'large' stats size (config.size: large), fetch:
        *   - Virtual IP in/out data
        *   - Individual Pool Member data
        *   - //TODO: What else should we share?
        */ 
        else if (this.config.size === 'large') {
          logger.info('[BigStats] Not implemented');
        }

      });
    });
  });
  
  var getVipStats = ((resource) => {
    return new Promise((resolve, reject) => {

//      var that = this;
    
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
      .catch((err) => {

        logger.info('[BigStats] - Error: ' +err);
        reject(err);

      });
    });
  });

  var getPoolMemberList = ((resource) => {
    return new Promise((resolve, reject) => {

//      var that = this;
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getPoolMemberList with resource list: ' +JSON.stringify(resource)); }

      var cleanPath = ""; 
      var PREFIX = "https://localhost";

      //TODO: isn't it always at the begining? What are we testing?
      if (resource.poolReference.link.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        cleanPath = resource.poolReference.link.slice(PREFIX.length).split("?").shift();
      }

      var query = '$select=name,selfLink';    

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+cleanPath); }
      var path = cleanPath+'/members';
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Members URI: '+path); }

      var uri = that.restHelper.makeRestnodedUri(path, query);
      var restOp = that.createRestOperation(uri);
    
      that.restRequestSender.sendGet(restOp)
      .then((resp) => {

        var poolMemberListObj = [];

        resp.body.items.map((element, index) => {
          logger.info('\n\ngetPoolMemberList = element.selfLink:' +element.selfLink);
          logger.info('\n\ngetPoolMemberList = element.name:' +element.name);
          poolMemberListObj.push(
            {
              name: element.name,
              path: element.selfLink
            }
          );

          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(resp.body.items.length - 1)+ '  index: ' +index); }
          if (index === (resp.body.items.length - 1)) {

            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - End of resource list (index === (list.items.length - 1))'); }
            resolve(poolMemberListObj);

          }
  
        });

      })
      .catch((err) => {

        logger.info('[BigStats - Error] getPoolMemberList() error: ' +err);
        reject(err);

      });
    });
  });

  var getPoolMemberStats = ((poolMemberObj) => {
    return new Promise((resolve, reject) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getPoolMemberStats with resource: ' +JSON.stringify(poolMemberObj)); }

      var path = ""; 
      var PREFIX = "https://localhost";

      if (poolMemberObj.path.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        // Remove any trailing querstrings
        path = poolMemberObj.path.slice(PREFIX.length).split("?").shift();
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

        let poolMemberStats = {};
        poolMemberStats[poolMemberObj.name] = { 
          serverside_curConns: resp.body.entries[entry_url].nestedStats.entries["serverside.curConns"].value,
          serverside_maxConns: resp.body.entries[entry_url].nestedStats.entries["serverside.maxConns"].value,
          serverside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsIn"].value,
          monitorStatus: resp.body.entries[entry_url].nestedStats.entries["monitorStatus"].description,
          serverside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsOut"].value,
          serverside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsIn"].value,
          serverside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsOut"].value  
        };

        resolve(poolMemberStats);

      })
      .catch((err) => {

        logger.info('[BigStats - Error] getPoolMemberStats(): ' +err);
        reject(err);

      });
    });
  });

  // Execute the BIG-IP stats scraping workflow
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
  .catch((err) => {

    logger.info('Promise Chain Error: ' +err);

  });

};


//Push stats to a remote destination
BigStats.prototype.pushStats = function (body) {

  //If the destination is 'http' or 'https'
  if (typeof this.config.destination.protocol !== 'undefined' && this.config.destination.protocol.startsWith('http')) {

    var http;

    if (this.config.destination.protocol === 'https') {
      http = require("https");
    }
    else {
      http = require("http");
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

  // If the protocol is statsd
  else if (typeof this.config.destination.protocol !== 'undefined' && this.config.destination.protocol === "statsd") {

    // we're using the statsd client
    var sdc = new StatsD(this.config.destination.address, 8125);

    Object.keys(body).map((level1) => {
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd: level1: ' +level1); }
      Object.keys(body[level1]).map((level2) => {
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd - level1+2: ' +level1+'.'+level2); }
        Object.keys(body[level1][level2]).map((level3) => {
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd - level1+2+3: ' +level1+'.'+level2+'.'+level3); }

          let namespace = level1+'.'+level2+'.'+level3;
          let value = body[level1][level2][level3];

          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - statsd - namespace: ' +namespace+ ' value: ' +value); }
          sdc.gauge(namespace, value);

        });
      });      
    });

  } 
  
  else if (typeof this.config.destination.protocol !== 'undefined' && this.config.destination.protocol === "kafka") {

    const client = new kafka.KafkaClient ( 
      {
        kafkaHost: this.config.destination.address+':'+this.config.destination.port
      } 
    );
    var producer = new Producer(client);

    producer.on('ready', function () {

      Object.keys(body).map((level1) => {
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - kafka: topic: ' +level1); }
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - pushStats() - kafka: message: ' +JSON.stringify(body[level1])); }

        var payload = [
                { topic: level1, messages: JSON.stringify(body[level1]) }
        ];
        producer.send(payload, function (err, data) {
          if (DEBUG === true) { logger.info('kafka producer response: ' +JSON.stringify(data)); }
        });
      });
                    
    });

    producer.on('error', function (err) {
      logger.info('Kafka Producer error: ' +err);
    });

  }
  else {
    logger.info('[BigStats] - Unrecognized \'protocol\'');
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
