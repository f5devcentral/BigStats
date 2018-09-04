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
const bigStatsSettingsPath = '/shared/bigstats_settings';
var StatsD = require('node-statsd');
var kafka = require('kafka-node');
var Producer = kafka.Producer;

var DEBUG = false;

function BigStats() {
  this.config = {};
  this.stats = {};
}

BigStats.prototype.WORKER_URI_PATH = "shared/bigstats";
BigStats.prototype.isPublic = true;
BigStats.prototype.isSingleton = true;

/**
 * handle onStart
 */
BigStats.prototype.onStart = function(success, error) {

  logger.info("[BigStats] Starting...");

  try {
    // Make the BigStats_Settings (persisted state) worker a dependency.
    var bigStatsSettingsUrl = this.restHelper.makeRestnodedUri(bigStatsSettingsPath);
    this.dependencies.push(bigStatsSettingsUrl);
    success();
    
  } catch (err) {

    logger.info('[BigStats - ERROR] - onStart() - Error starting worker: ' +err);
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

  .then((statusCode) => {

    if (DEBUG === true) { logger.info('[BigStats] - onStartCompleted() - Scheduler response code: ' +statusCode); }
    success();

  })
  .catch((err) => {

    logger.info('[BigStats - ERROR] - onStartCompleted() - Error starting worker: ' +err);
    error(err);

  });

};

/**
 * handle HTTP POST request
 */
BigStats.prototype.onPost = function (restOperation) {

  var onPostdata = restOperation.getBody();

  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - onPost receved data: ' +JSON.stringify(onPostdata)); }
  
  this.getSettings()
  .then(() => {

    if (this.config.enabled === false) {

      logger.info('[BigStats] onPost() - config.enabled is set to \'false\'');
      return;

    }
    // Execute stats collection
    this.pullStats();

  })
  .catch((err) => {

    logger.info('[BigStats - ERROR] - onPost() - Error handling POST: ' +err);

  });

  // Acknowledge the Scheduler Task
  restOperation.setBody("BigStats says, Thanks!!");
  this.completeRestOperation(restOperation);

};

/**
 * Creates an iControl 'task-scheduler' task to poke onPost every 'n' seconds
 * Executed by onStartCompleted()
 * Interval configuration managed by BigStatsSettings: this.config.interval
 * 
 * @return {Promise} Promise Object representing HTTP Status code
 */
BigStats.prototype.createScheduler = function () {

  return new Promise((resolve,reject) => {

    var body = {
      "interval": this.config.interval,
      "intervalUnit":"SECOND",
      "scheduleType":"BASIC_WITH_INTERVAL",
      "deviceGroupName":"tm-shared-all-big-ips",
      "taskReferenceToRun":"http://localhost:8100/mgmt/shared/bigstats",
      "name":"n8-BigStats",
      "taskBodyToRun":{
        "polling": "BigStats"
      },
      "taskRestMethodToRun":"POST",
      "maxTaskHistoryToKeep": 3
    };

    var path = '/mgmt/shared/task-scheduler/scheduler'; 
    var uri = this.restHelper.makeRestnodedUri(path);
    var restOp = this.createRestOperation(uri, body);
    
    this.restRequestSender.sendPost(restOp)
    .then((resp) => {

      if (DEBUG === true) {
        logger.info('[BigStats - DEBUG] - createScheduler() - resp.statusCode: ' +JSON.stringify(resp.statusCode));
        logger.info('[BigStats - DEBUG] - createScheduler() - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
      }

      resolve(resp.statusCode);

    })
    .catch((error) => {

      let errorStatusCode = error.getResponseOperation().getStatusCode();
      var errorBody = error.getResponseOperation().getBody();

      if (errorBody.message.startsWith("Duplicate item")) {

        logger.info('[BigStats] - createScheduler() - Status Code: ' +errorStatusCode+ ' Message: ' +errorBody.message);
        resolve(errorStatusCode+ ' - Scheduler entry exists.');

      }
      else {

        logger.info('[BigStats - ERROR] createScheduler() - Status Code: ' +errorStatusCode+ ' Message: ' +errorBody.message);
        reject(errorStatusCode);

      }

    });

  });

};

/**
 * Updates the iControl 'task-scheduler' job if interval has changed
 * Executed with every onPost poll.
 * 'interval' is a persisted setting managed by BigStatsSettings. See bigstats-schema.json
 * 
 * @param {Integer} interval used for task-scheduler task interval
 * 
 * @returns {String} HTTP Status code 
 */
BigStats.prototype.updateScheduler = function (interval) {
  
  logger.info('[BigStats] - updateScheduler() - New Settings detected, Updating Scheduler.');

  // Execute update to the Task Shceduler interval 
  this.getSchedulerId()
  .then((id) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSchedulerId() - Scheduler Task id: ' +id); }
    return this.patchScheduler(id, interval);

  })
  .then((statusCode) => {
    
    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - updateScheduler() results: ' +statusCode); }
    return statusCode;

  })
  .catch((err) => {

    logger.info('[BigStats - ERROR] - updateScheduler() - Error updating Task Scheduler:' +err);

  });

};

/**
 * Retreives the Unique Id of the workers 'task-scheduler'
 * 
 * @returns {Promise} Promise Object representing the Unique Id for the BigStats task-scheduler task
 */
BigStats.prototype.getSchedulerId = function () {
  
  return new Promise((resolve, reject) => {

    var path = '/mgmt/shared/task-scheduler/scheduler'; 
    let uri = this.restHelper.makeRestnodedUri(path);
    let restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
    .then (function (resp) {
      
      resp.body.items.map((schedulerTask) => {
        if (schedulerTask.name === "n8-BigStats") {

          resolve(schedulerTask.id);

        }
      }); 

    })
    .catch((err) => {

      logger.info('[BigStats - ERROR] - getSchedulerId() - Error retrieving Task Scheduler ID: ' +err);
      reject(err);

    });

  });

};

/**
 * Patches the 'interval' value of a task-shceduler job
 * 
 * @param {String} id Unique identifier of existing task-scheduler task
 * @param {Integer} interval Stat exporting interval
 * 
 * @returns {Promise} Promise Object representing HTTP Status Code
 */
BigStats.prototype.patchScheduler = function (id, interval) {

  // Using the task-scheduler unique id, Patch the "interval" of the scheduler task with the new value.
    return new Promise((resolve, reject) => {

      var body = {
        "interval": interval,
        "taskBodyToRun": {
          "polling": "BigStats"
        }
      };
  
      let path = '/mgmt/shared/task-scheduler/scheduler/'+id; 
      let uri = this.restHelper.makeRestnodedUri(path);
      let restOp = this.createRestOperation(uri, body);
      
      this.restRequestSender.sendPatch(restOp)
      .then (function (resp) {

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - patchScheduler() - Response Code: ' +resp.statusCode); }
        resolve(resp.statusCode);

      })
      .catch((err) => {

        logger.info('[BigStats - ERROR] - patchScheduler() - Error patching scheduler interval: ' +err);
        reject(err);

      });
    });
  
};

/**
 * Fetches operational settings from persisted state worker, BigStatsSettings
 * 
 * @returns {Promise} Promise Object representing operating settings retreived from BigStatsSettings (persisted state) worker
 */
BigStats.prototype.getSettings = function () {
  
  return new Promise((resolve, reject) => {

    let path = '/mgmt' +bigStatsSettingsPath;
    let uri = this.restHelper.makeRestnodedUri(path);
    let restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
    .then ((resp) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSettings() - Response from BigStatsSettings worker: ' +JSON.stringify(resp.body.config,'', '\t')); }

      // Is DEBUG enabled?
      if (typeof resp.body.config.debug !== 'undefined' && resp.body.config.debug === true) {

        logger.info('\n\n[BigStats] - DEBUG ENABLED\n\n');
        DEBUG = true;

      }
      else {

        DEBUG = false;

      }
      
      // Ensure we have both 'interval' and 'enabled' options
      if (typeof resp.body.config.interval !== 'undefined' && typeof resp.body.config.enabled !== 'undefined' && typeof this.config.interval !== 'undefined' && typeof this.config.enabled !== 'undefined') {

        // If 'interval' has changed, update the task-scheduler task
        if (this.config.interval !== resp.body.config.interval || this.config.enabled !== resp.body.config.enabled) {

          this.updateScheduler(resp.body.config.interval, resp.body.config.enabled);

        }

      }

      // Apply new config retreived from BigStatsSettings work to the BigStats running state
      this.config = resp.body.config;
      resolve(this.config);

    })
    .catch ((err) => {

      logger.info('[BigStats - ERROR] - getSettings() - Error retrieving settings from BigStatsSettings worker: ' +err);
      reject(err);

    });

  });
};

/**
 * Collect the required statistics from the appropriate BIG-IP Objects
 */
BigStats.prototype.pullStats = function () {

  // Execute the BIG-IP stats-scraping workflow
  this.getSettings()
  .then(() => {

    return this.getDeviceStats();

  })
  .then(() => {

    return this.getVipResourceList();

  })
  .then((vipResourceList) => {

    if (typeof this.config.size === 'undefined' || this.config.size === 'small') {

      return this.buildSmallStatsObject(vipResourceList);
  
    }
  
    else if (this.config.size === 'medium') {
  
      return this.buildMediumStatsObject(vipResourceList);
  
    }
  
    else if (this.config.size === 'large') {
  
      logger.info('[BigStats - ERROR] - largeStats not yet imlemented');
      return;
  
    }

  })
  .then(() => {

    // Ready the stats for export - Apply stats prefix: 'hostname.services.stats'
    let statsExpObj = {
      [this.config.hostname]: {
        services: this.stats.services,
        device: this.stats.device
      }
    };

    if (DEBUG === true) { 
      logger.info('\n\n*******************************************\n* [BigStats - DEBUG] - BEGIN Stats Object *\n*******************************************\n\n');
      logger.info(JSON.stringify(statsExpObj, '', '\t'));
      logger.info('\n\n*******************************************\n*  [BigStats - DEBUG] - END Stats Object  *\n*******************************************\n\n'); 
    }

    this.exportStats(statsExpObj);

  })
  .catch((err) => {

    logger.info('[BigStats - ERROR] - pullStats() - Promise Chain Error: ' +err);

  });

};

/**
* Fetch device statistics - CPU, RAM
*
*/ 
BigStats.prototype.getDeviceStats = function () {

  return new Promise((resolve, reject) => {

    var path = '/mgmt/tm/sys/hostInfo/';    
    var uri = this.restHelper.makeRestnodedUri(path);
    var restOp = this.createRestOperation(uri);
  
    this.restRequestSender.sendGet(restOp)
    .then((resp) => {

      if (DEBUG === true) {
        logger.info('[BigStats - DEBUG] - getDeviceStats() - resp.statusCode: ' +JSON.stringify(resp.statusCode));
//        logger.info('[BigStats - DEBUG] - getDeviceStats() - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
      }

      this.stats.device = {
        memory: {
          memoryTotal: resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries.memoryTotal.value,
          memoryUsed: resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries.memoryUsed.value
        }
      };

      // Iterate through the BIG-IP CPU's 
      Object.keys(resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries["https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo"].nestedStats.entries).map((cpu) => {

        // For each CPU, grab the following stats.
        let cpuStats = {
          cpuIdle: resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries["https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo"].nestedStats.entries[cpu].nestedStats.entries.idle.value,
          cpuIowait: resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries["https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo"].nestedStats.entries[cpu].nestedStats.entries.iowait.value,
          cpuSystem: resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries["https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo"].nestedStats.entries[cpu].nestedStats.entries.system.value,
          cpuUser: resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries["https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo"].nestedStats.entries[cpu].nestedStats.entries.user.value
        }; 

        let cpuId = resp.body.entries["https://localhost/mgmt/tm/sys/host-info/0"].nestedStats.entries["https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo"].nestedStats.entries[cpu].nestedStats.entries.cpuId.value;

        let cpuNum = 'cpu'+cpuId;
        this.stats.device[cpuNum] = cpuStats;
  
      });

      resolve();

    })
    .catch((err) => {

      logger.info('[BigStats - ERROR] - getDeviceStats(): ' +JSON.stringify(err));
      reject(err);

    });

  });
};

/**
* For 'small' stats size (config.size: small), fetch:
*   - Virtual IP in/out data
*
* @param {Object} vipResourceList representing an individual vip resource
*
* @returns {Promise} Object representing the collected stats
*
*/ 
BigStats.prototype.buildSmallStatsObject = function (vipResourceList) {

  // Initialize services object
  this.stats.services = {};

  return new Promise((resolve, reject) => {
  
    // Fetch list of deployed services
    vipResourceList.items.map((element, index) => {

      // Collect Stats for each service
      this.getVipStats(element)
      .then((values) => {

        var servicePath;

        // Check if subPath is un use.
        if ('subPath' in element) {

          // Merge 'tenant' name and 'subPath' name as '/' delimited string.
          servicePath = element.partition+'/'+element.subPath;

        } else {

          // 'subPath' is NOT used, use 'tenant' name on its own.
          servicePath = element.partition;

        }

        // Initialize object on first run
        if (typeof this.stats.services[servicePath] === 'undefined') {
          this.stats.services[servicePath] = {};
        }

        // Build JavaScript object of stats for each service
        this.stats.services[servicePath][element.destination] = values;

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - buildSmallStatsObject() - Processing: ' +index+ ' of: ' +(vipResourceList.items.length - 1)); }

        if (index === (vipResourceList.items.length - 1)) {

          resolve();

        }

      })
      .catch((err) => {

        logger.info('[BigStats - ERROR] - buildSmallStatsObject(): ' +JSON.stringify(err));
        reject(err);

      });
    });
  });

};

/**
* For 'medium' stats size (config.size: medium), fetch:
*   - Virtual IP in/out data
*   - Individual Pool Member data
*
* @param {Object} vipResourceList representing an individual vip resource
*
* @returns {Promise} Object representing the collected stats
*
*/ 
BigStats.prototype.buildMediumStatsObject = function (vipResourceList) {

  // Initialize services object
  this.stats.services = {};

  return new Promise((resolve, reject) => {

    // Fetch stats from each resource, based on config.size
    vipResourceList.items.map((vipResource, vipResourceListIndex) => {

      Promise.all([this.getVipStats(vipResource), this.getPoolResourceList(vipResource)])
      .then((values) => {

        var servicePath;

        // Check if subPath is un use.
        if ('subPath' in vipResource) {

          // Merge 'tenant' name and 'subPath' name as '/' delimited string.
          servicePath = vipResource.partition+'/'+vipResource.subPath;

        } else {

          // 'subPath' is NOT used, use 'tenant' name on its own.
          servicePath = vipResource.partition;

        }

        // Initialize object on first run
        if (typeof this.stats.services[servicePath] === 'undefined') {
          this.stats.services[servicePath] = {};
        }

        // Adding VIP data to the 'medium' stats object
        this.stats.services[servicePath][vipResource.destination] = values[0];
        this.stats.services[servicePath][vipResource.destination][vipResource.pool] = [];

        values[1].map((poolMemberResource, poolMemberResourceIndex) => {

          this.getPoolMemberStats(poolMemberResource)
          .then((stats) => {

            // Adding Pool data to the 'medium' stats object
            this.stats.services[servicePath][vipResource.destination][vipResource.pool].push(stats);
 
            if (vipResourceListIndex === (vipResourceList.items.length - 1)) {  

              if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getPoolMemberStats() - Processing: '+vipResourceListIndex+ ' of: ' +(vipResourceList.items.length - 1)); }
              if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getPoolMemberStats() - Processing: '+poolMemberResourceIndex+ ' of: ' +(values[1].length - 1)); }

              if (poolMemberResourceIndex === (values[1].length - 1)) {
  
                resolve();

              }

            }

          })
          .catch((err) => {

            logger.info('[BigStats - ERROR] - buildSmallStatsObject(): ' +JSON.stringify(err));
            reject(err);

          });
        });


      })
      .catch((err) => {

        logger.info('[BigStats - ERROR] - buildMediumStatsObject(): ' +JSON.stringify(err));
        reject(err);

      });
    });
  });

};

/**
* For 'large' stats size (config.size: large), fetch:
*   - Virtual IP in/out data
*   - Individual Pool Member data
*   - //TODO: Some HTTP stats, maybe??
*
* @param {Object} vipResourceList representing an individual vip resource
*
* @returns {null} Absolutely nothing.... 
*
*/
BigStats.prototype.buildLargeStatsObject = function (vipResourceList) {

  // Not yet implemented
  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - buildLargeStatsObject() with vipResourceList: ' +vipResourceList); }
  logger.info('[BigStats] - buildLargeStatsObject() is not yet impelmented.');

};

/**
 * Fetches list of deployed BIG-IP Application Services
 * 
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getVipResourceList = function () {

  return new Promise((resolve, reject) => {

    var path = '/mgmt/tm/ltm/virtual/';
    var query = '$select=partition,subPath,fullPath,destination,selfLink,pool';
    
    var uri = this.restHelper.makeRestnodedUri(path, query);
    var restOp = this.createRestOperation(uri);
  
    this.restRequestSender.sendGet(restOp)
    .then((resp) => {

      if (DEBUG === true) {
        logger.info('[BigStats - DEBUG] - getVipResourceList - resp.statusCode: ' +JSON.stringify(resp.statusCode));
        logger.info('[BigStats - DEBUG] - getVipResourceList - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
      }

      resolve(resp.body);

    })
    .catch((err) => {

      logger.info('[BigStats - ERROR] - getVipResourceList(): ' +JSON.stringify(err));
      reject(err);

    });

  });
}; 

/**
 * Fetches list of deployed BIG-IP Services
 * 
 * @param {Object} vipResource representing an individual vip resource
 * 
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getVipStats = function (vipResource) {

  return new Promise((resolve, reject) => {

    var slicedPath = ""; 
    var PREFIX = "https://localhost";

    if (vipResource.selfLink.indexOf(PREFIX) === 0) {
      slicedPath = vipResource.selfLink.slice(PREFIX.length).split("?").shift();
    }

    var uri = slicedPath+'/stats';

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getVipStats() - Stats URI: '+uri); }

    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    this.restRequestSender.sendGet(restOp)
    .then((resp) => {

      let name = slicedPath.split("/").slice(-1)[0];
      let entry_uri = slicedPath+'/'+name+'/stats';
      let entry_url ="https://localhost" +entry_uri;

      let vipResourceStats = {
        clientside_curConns: resp.body.entries[entry_url].nestedStats.entries["clientside.curConns"].value,
        clientside_maxConns: resp.body.entries[entry_url].nestedStats.entries["clientside.maxConns"].value,
        clientside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsIn"].value,
        clientside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsOut"].value,
        clientside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsIn"].value,
        clientside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsOut"].value  
      };

      resolve(vipResourceStats);

    })
    .catch((err) => {

      logger.info('[BigStats - ERROR] - getVipStats() - Error retrieving vipResrouceStats: ' +err);
      reject(err);

    });
  });
};

/**
 * Fetches list of Pools attached to vipResource (see getResource) BIG-IP Services
 * 
 * @param {Object} vipResource representing an individual vip resource
 * 
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getPoolResourceList = function (vipResource) {

    return new Promise((resolve, reject) => {

      // If the VIP has an associated pool
      if (typeof vipResource.poolReference !== 'undefined') {

        var cleanPath = ""; 
        var PREFIX = "https://localhost";
  
        //TODO: isn't it always at the begining? What are we testing?
        if (vipResource.poolReference.link.indexOf(PREFIX) === 0) {
          // PREFIX is exactly at the beginning
          cleanPath = vipResource.poolReference.link.slice(PREFIX.length).split("?").shift();
        }
  
        var query = '$select=name,selfLink';    
        var path = cleanPath+'/members';
   
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getPoolResourceList() - Pool Members URI: '+path); }
  
        var uri = this.restHelper.makeRestnodedUri(path, query);
        var restOp = this.createRestOperation(uri);
        var poolMemberListObj = [];
      
        this.restRequestSender.sendGet(restOp)
        .then((resp) => {
    
          resp.body.items.map((element, index) => {
  
            poolMemberListObj.push(
              {
                name: element.name,
                path: element.selfLink
              }
            );
  
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getPoolResourceList() - Processing: ' +index+ ' of: ' +(resp.body.items.length - 1)); }
  
            if (index === (resp.body.items.length - 1)) {
  
              resolve(poolMemberListObj);
  
            }
    
          });
  
        })
        .catch((err) => {
  
          logger.info('[BigStats - Error] getPoolResourceList(): ' +err);
          reject(err);
  
        });

      }

    });
};

/**
 * Fetches stats from deployed BIG-IP Pool Member resources
 *  
 * @param {Object} poolMemberResource representing an individual pool member selfLink
 * 
 * @returns {Promise} Promise Object representing individual pool member stats
 */
BigStats.prototype.getPoolMemberStats = function (poolMemberResource) {

    return new Promise((resolve, reject) => {

      var path = ""; 
      var PREFIX = "https://localhost";

      if (poolMemberResource.path.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        // Remove any trailing querstrings
        path = poolMemberResource.path.slice(PREFIX.length).split("?").shift();
      }

      var uri = path+'/stats';
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getPoolMemberStats() - Stats URI: '+uri); }

      var url = this.restHelper.makeRestnodedUri(uri);
      var restOp = this.createRestOperation(url);
    
      this.restRequestSender.sendGet(restOp)
      .then((resp) => {

        let name = path.split("/").slice(-1)[0];
        let entry_uri = path+'/'+name+'/stats';
        let entry_url ="https://localhost" +entry_uri;

        let poolMemberStats = {};
        poolMemberStats[poolMemberResource.name] = {
          serverside_curConns: resp.body.entries[entry_url].nestedStats.entries["serverside.curConns"].value,
          serverside_maxConns: resp.body.entries[entry_url].nestedStats.entries["serverside.maxConns"].value,
          serverside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsIn"].value,
          serverside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsOut"].value,
          serverside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsIn"].value,
          serverside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsOut"].value,
          monitorStatus: resp.body.entries[entry_url].nestedStats.entries.monitorStatus.description
        };

        resolve(poolMemberStats);

      })
      .catch((err) => {

        logger.info('[BigStats - Error] getPoolMemberStats(): ' +err);
        reject(err);

      });
    });

};

/**
 * Push the stats object to the desired destinations
 * 
 * @param {Object} statsObj representing the collected statistics 
 */
//Push stats to a remote destination
BigStats.prototype.exportStats = function (statsObj) {

  if (typeof this.config.destination.protocol !== 'undefined') {

    // If the destination is 'http' OR 'https'
    if (this.config.destination.protocol.startsWith('http')) {

      this.httpExporter(statsObj);
  
    }
  
    // If the destination is StatsD
    else if (this.config.destination.protocol === "statsd") {
  
      this.statsdExporter(statsObj);
  
    } 
  
    // If the destination is an Apache Kafka Broker  
    else if (this.config.destination.protocol === "kafka") {
  
      this.kafkaExporter(statsObj);
  
    }
    else {

      logger.info('[BigStats] - Unrecognized \'protocol\'');

    }
  
  } 

  // If the desintation protocol is unrecognized
  else {

    logger.info('[BigStats - ERROR] - A destination \'protocol\' must be defined');

  }

};

/**
* Exports data to http/https destinations
*
* @param {Object} statsObj to be exported
*
*/
BigStats.prototype.httpExporter = function (statsObj) {

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

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - httpExporter() resp: ' +body.toString()); }

    });

  });
  
  req.write(JSON.stringify(statsObj));

  req.on('error', ((error) => {

    logger.info('[BigStats] - ***************Error pushing stats): ' +error);

  }));

  req.end();

};

/**
* Exports data to StatsD destinations
*
* @param {String} data to be exported
*
*/
BigStats.prototype.statsdExporter = function (statsObj) {

    var sdc = new StatsD(this.config.destination.address, this.config.destination.port);
    var servicesData = statsObj[this.config.hostname].services;
    var deviceData = statsObj[this.config.hostname].device;

    // Export device data
    Object.keys(deviceData).map((level1) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd: Device Mtric Category: ' +level1); }

      Object.keys(deviceData[level1]).map((level2) => {

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd: Device Metric Sub-Category: ' +level1+ '.' +level2); }

        let namespace = this.config.hostname+'.device.'+level1+'.'+level2;
        let value = deviceData[level1][level2];

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd - Device Sub-Category Stats: ' +namespace+ ' value: ' +value); }
        sdc.gauge(namespace, value);

      });

    });

    // Export services data
    Object.keys(servicesData).map((level1) => {

      var l1 = this.replaceDotsSlashesColons(level1);

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd: Administrative Partition: ' +l1); }

      Object.keys(servicesData[level1]).map((level2) => {

        var l2 = this.replaceDotsSlashesColons(level2);

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd - Virtual Server: ' +l1+'.'+l2); }

        Object.keys(servicesData[level1][level2]).map((level3) => {

          var l3 = this.replaceDotsSlashesColons(level3);

          // If the value is a number, send it to statsd.
          if (typeof servicesData[level1][level2][level3] === 'number') {
  
            let namespace = this.config.hostname+'.services.'+l1+'.'+l2+'.'+l3;
            let value = servicesData[level1][level2][level3];
  
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd - Virtual Server Stats: ' +namespace+ ' value: ' +value); }
            sdc.gauge(namespace, value);

          }

          // If the value is an object, process the child object..
          else if (typeof servicesData[level1][level2][level3] === 'object') {

            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd: Pool: ' +l3); }

            Object.keys(servicesData[level1][level2][level3]).map((level4) => {
  
              Object.keys(servicesData[level1][level2][level3][level4]).map((level5) => {
  
                var l5 = this.replaceDotsSlashesColons(level5);
                if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd: Pool Member: ' +l5); }
  
                Object.keys(servicesData[level1][level2][level3][level4][level5]).map((level6) => {

                  var l6 = this.replaceDotsSlashesColons(level6);
  
                  let namespace = this.config.hostname+'.services.'+l1+'.'+l2+'.'+l3+'.'+l5+'.'+l6;
                  let value = servicesData[level1][level2][level3][level4][level5][level6];
                
                  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - statsd - l6 namespace: ' +namespace+ ' value: ' +value); }
                  sdc.gauge(namespace, value);
        
                });        
  
              });   
                    
            });

          }

        });

      });

    });

};

/**
* Exports data to Apache Kafka Broker destinations
*
* @param {Object} statsObj to be exported
*
*/
BigStats.prototype.kafkaExporter = function (statsObj) {

  var hostname = this.config.hostname;

  var client = new kafka.KafkaClient ( 
    {
      kafkaHost: this.config.destination.address+':'+this.config.destination.port
    } 
  );

  var producer = new Producer(client);

  if (typeof this.config.destination.kafka.topic === 'undefined' || this.config.destination.kafka.topic === 'all') {

    logger.info('The topic is all!!!\n\n');

    producer.on('ready', function () {

      var payload = [
        {
          topic: hostname,
          messages: JSON.stringify(statsObj)
        }
      ];

      producer.send(payload, function (err, resp) {

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Kafka producer response: ' +JSON.stringify(resp)); }
        if (err) { logger.info('[BigStats - ERROR] - Kafka producer response:' +err); }

      });

    });

  }
  else if (typeof this.config.destination.kafka.topic !== 'undefined' && this.config.destination.kafka.topic === 'partition') {

    logger.info('The topic is parittion!!!\n\n');

    var that = this;
    var data = statsObj[hostname];
    var message;
    var safeTopic;
        
    producer.on('ready', function () {

      logger.info('PRODUCER READY....');

      Object.keys(data).map((level1) => {

        // Build 'device' stats message and send
        if (level1 === 'device') {

          safeTopic = hostname+ '-device_stats';

          message = {
            [hostname]: {
              device: data[level1]
            }
          };

          var payload = [
            {
              topic: safeTopic,
              messages: JSON.stringify(message)
            }
          ];

          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - kafka: topic: ' +safeTopic); }
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - kafka: message: ' +JSON.stringify(message)); }  
          
          producer.send(payload, function (err, resp) {
  
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Kafka producer response: ' +JSON.stringify(resp)); }
            if (err) { logger.info('[BigStats - ERROR] - Kafka producer response:' +err); }
  
          });
  
        }
        // Iterate through 'services' building service messages and sending.
        else {
  
          Object.keys(data[level1]).map((level2) => {
    
            let safePartitionName = that.replaceDotsSlashesColons(level2);
            safeTopic = hostname+'-'+safePartitionName;
  
            // Ready the stats for topic-based export - Apply stats prefix: 'hostname.services.data[level1]'
  
            message = {
              [hostname]: {
                service: data[level1][level2]
              }
            };

            var payload = [
              {
                topic: safeTopic,
                messages: JSON.stringify(message)
              }
            ];

            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - kafka: topic: ' +safeTopic); }
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - exportStats() - kafka: message: ' +JSON.stringify(message)); }
    
            producer.send(payload, function (err, resp) {
    
              if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Kafka producer response: ' +JSON.stringify(resp)); }
              if (err) { logger.info('[BigStats - ERROR] - Kafka producer response:' +err); }
    
            });
                

          });
  
        }

      });
    });

  }

  producer.on('error', function (err) {

    logger.info('Kafka Producer error: ' +err);

  });

};

/**
* Escapes Slashes and Colons
*
* @param {String} notReplaced string that needs
*
* @returns {String} without slashes or colons
*/
BigStats.prototype.replaceDotsSlashesColons = function (notReplaced) {

  let str_noDots = notReplaced.replace(/\./g, '-');
  let str_noSlashes = str_noDots.replace(/\//g, '-');
  let str_noColon = str_noSlashes.replace(/\:/g, '_');

  return str_noColon;

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
 * handle /example HTTP request
 */
BigStats.prototype.getExampleState = function () {
  
  return {
    // redirct to /bigstats_settings
  };

};

module.exports = BigStats;
