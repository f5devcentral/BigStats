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
  .then((resp) => {

    if (DEBUG === true) { logger.info('[BigStats] Scheduler response code: ' +JSON.stringify(resp,'','\t')); }
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

      resolve(resp.statusCode);

    })
    .catch((error) => {

      let errorStatusCode = error.getResponseOperation().getStatusCode();
      var errorBody = error.getResponseOperation().getBody();

      if (errorBody.message.startsWith("Duplicate item")) {

        logger.info('[BigStats] Scheduler - Status Code: ' +errorStatusCode+ ' Message: ' +errorBody.message);
        resolve(errorStatusCode+ 'Scheduler entry exists.');

      }
      else {

        logger.info('[BigStats] createScheduler() - Error: Status Code: ' +errorStatusCode+ ' Message: ' +errorBody.message);
        reject(errorStatusCode);

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
  
  // Execute update to the Task Shceduler interval 
  this.getSchedulerId()
  .then((id) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Scheduler Task id: ' +id); }
    return this.patchScheduler(id, interval);

  })
  .then((results) => {
    
    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Patch Scheduler results: ' +JSON.stringify(results)); }

  })
  .catch((err) => {

    logger.info('[BigStats] Error updating Task Scheduler:' +err);

  });

};

/**
 * Retreives the Unique Id of the workers 'task-scheduler'
 * 
 * @returns id
 */
BigStats.prototype.getSchedulerId = function () {
  
  var that = this;

  return new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN updateScheduler() with config: ' +JSON.stringify(this.config)); }

    var path = '/mgmt/shared/task-scheduler/scheduler'; 
    let uri = that.generateURI(host, path);
    let restOp = that.createRestOperation(uri);

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - updateScheduler() Attemtping to fetch config...'); }

    that.restRequestSender.sendGet(restOp)
    .then (function (resp) {
      
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - updateScheduler() Response: ' +JSON.stringify(resp.body,'', '\t')); }

      resp.body.items.map((element) => {
        if (element.name === "n8-BigStats") {
          resolve(element.id);
        }
      }); 

    })
    .catch((error) => {

      logger.info('[BigStats] - Error retrieving Task Scheduler ID: ' +error);
      reject(error);

    });

  });

};

/**
 * Patches the 'interval' value of a task-shceduler job
 * 
 * @param {String} id Unique identifier of existing task-scheduler task
 * @param {integer} interval Stat exporting interval
 */
BigStats.prototype.patchScheduler = function (id, interval) {

  // Using the task-scheduler unique id, Patch the "interval" of the scheduler task with the new value.
    return new Promise((resolve, reject) => {

      var body = {
        "interval": interval
      };
  
      var path = '/mgmt/shared/task-scheduler/scheduler/'+id; 
      let uri = this.generateURI(host, path);
      let restOp = this.createRestOperation(uri, body);

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - patchScheduler() restOp...' +restOp); }
      
      this.restRequestSender.sendPatch(restOp)
      .then (function (resp) {

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - patchScheduler() Response: ' +JSON.stringify(resp.body,'', '\t')); }
        resolve(resp.body);

      })
      .catch((error) => {

        logger.info('[BigStats] - Error patching scheduler interval: ' +error);
        reject(error);

      });
    });
  
};

/**
 * Fetches operational settings from persisted state worker, BigStatsSettings
 * 
 * @returns {Object} Operating settings
 */
BigStats.prototype.getSettings = function () {

  var that = this;
  
  return new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getSettings()'); }

    let uri = that.generateURI(host, '/mgmt' +bigStatsSettingsPath);
    let restOp = that.createRestOperation(uri);

    that.restRequestSender.sendGet(restOp)
    .then (function (resp) {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSettings() Response: ' +JSON.stringify(resp.body.config,'', '\t')); }

      // Did we just enable debug?
      if (resp.body.config.debug === true) {

        logger.info('debug is true');
        DEBUG = true;

      }
      else {

        DEBUG = false;

      }

      // Check if interval has actually changed
      if (typeof that.config.interval !== 'undefined' && that.config.interval !== resp.body.config.interval) {

        that.updateScheduler(resp.body.config.interval);

      }

      that.config = resp.body.config;
      resolve(that.config);

    })
    .catch (function (error) {

      logger.info('[BigStats] - Error retrieving settings from BigStatsSettings worker: ' +error);
      reject(error);

    });

  });
};

BigStats.prototype.pullStats = function () {

  // Execute the BIG-IP stats-scraping workflow
  this.getSettings()
  .then((config) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - config.destination: ' +JSON.stringify(config.destination)); }
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
  
      logger.info('largeStats not yet imlemented');
      return;
  
    }

  })
  .then(() => {

    if (DEBUG === true) { logger.info('\n\n***************************\n\n[BigStats - DEBUG] - BEGIN Pushing stats:\n\n***************************\n\n' +JSON.stringify(this.stats, '', '\t')+ '\n\n***************************\n\n[BigStats - DEBUG] - END Pushing stats:\n\n***************************\n\n'); }
    this.pushStats(this.stats);

  })
  .catch((err) => {

    logger.info('Promise Chain Error: ' +err);

  });

};


/*************************************************/
BigStats.prototype.buildSmallStatsObject = function (vipResourceList) {

  return new Promise((resolve, reject) => {
  
    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN buildSmallStatsObject() with vipResourceList: ' +JSON.stringify(vipResourceList)); }

    // Fetch list of deployed services
    vipResourceList.items.map((element, index) => {

      // Collect Stats for each service
      this.getVipStats(element)
      .then((values) => {

        if (DEBUG === true) { 
          logger.info('[BigStats - DEBUG] - Index:' +index+ ', values: ' +JSON.stringify(values,'','\t'));
        }

        // Initialize object on first run
        if (typeof this.stats[element.subPath] === 'undefined') {
          this.stats[element.subPath] = {};
        }

        // Build JavaScript object of stats for each service
        this.stats[element.subPath].vip = values;

        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(vipResourceList.items.length - 1)+ '  index: ' +index); }

        if (index === (vipResourceList.items.length - 1)) {

          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - End of resource list (index === (list.items.length - 1))'); }
          resolve();

        }

      })
      .catch((err) => {

        logger.info('[BigStats] - Error: ' +JSON.stringify(err));
        reject(err);

      });
    });
  });

};
/*************************************************/

/*************************************************/

/*
* For 'medium' stats size (config.size: medium), fetch:
*   - Virtual IP in/out data
*   - Individual Pool Member data
*/ 
BigStats.prototype.buildMediumStatsObject = function (vipResourceList) {

  return new Promise((resolve, reject) => {

    // Fetch stats from each resource, based on config.size
    vipResourceList.items.map((vipResource, vipResourceListIndex) => {

      Promise.all([this.getVipStats(vipResource), this.getPoolResourceList(vipResource)])
      .then((values) => {

        if (DEBUG === true) { 
          logger.info('[BigStats - DEBUG] - Index:' +vipResourceListIndex+ ', getVipStats() values[0]: ' +JSON.stringify(values[0],'','\t'));
          logger.info('[BigStats - DEBUG] - Index:' +vipResourceListIndex+ ', getPoolResourceList() values[1]: ' +JSON.stringify(values[1],'','\t'));
        }

        // Initialize object on first run
        if (typeof this.stats[vipResource.subPath] === 'undefined') {
          this.stats[vipResource.subPath] = { "class": "app" };
        }

        this.stats[vipResource.subPath][vipResource.destination] = values[0];
        this.stats[vipResource.subPath][vipResource.destination][vipResource.pool] = [];

        values[1].map((poolMemberResource, poolMemberResourceIndex) => {

          this.getPoolMemberStats(poolMemberResource)
          .then((stats) => {
            
            this.stats[vipResource.subPath][vipResource.destination][vipResource.pool].push(stats);
 
            if (vipResourceListIndex === (vipResourceList.items.length - 1)) {  

              if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(values[1].length - 1)+ '  index: ' +vipResourceListIndex); }
              if (poolMemberResourceIndex === (values[1].length - 1)) {
  
                resolve(this.stats);
              }

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
    });
  });

};
/*************************************************/

/*************************************************/
BigStats.prototype.buildLargeStatsObject = function () {
  // Not yet implemented

};
/*************************************************/


/**
 * Fetches list of deployed BIG-IP Application Services
 * 
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getVipResourceList = function () {

  return new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipResourceList() with config: ' +JSON.stringify(this.config)); }

    var path = '/mgmt/tm/ltm/virtual/';
    var query = '$select=subPath,fullPath,destination,selfLink,pool';
    
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
    .catch((error) => {

      logger.info('[BigStats] - Error: ' +JSON.stringify(error));
      reject(error);

    });

  });
}; 

/**
 * Fetches list of deployed BIG-IP Services
 * 
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getVipStats = function (vipResource) {

  return new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipStats with vipResource: ' +JSON.stringify(vipResource)); }

    var slicedPath = ""; 
    var PREFIX = "https://localhost";

    if (vipResource.selfLink.indexOf(PREFIX) === 0) {
      slicedPath = vipResource.selfLink.slice(PREFIX.length).split("?").shift();
    }

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+slicedPath); }

    var uri = slicedPath+'/stats';

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Stats URI: '+uri); }

    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipStats and performing get with restOp: ' +JSON.stringify(restOp, '','\t')); }

    this.restRequestSender.sendGet(restOp)
    .then((resp) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipStats and got a response from restOp: ' +JSON.stringify(resp.body)); }

      let name = slicedPath.split("/").slice(-1)[0];
      let entry_uri = slicedPath+'/'+name+'/stats';
      let entry_url ="https://localhost" +entry_uri;

      let vipResourceStats = {
        class: "service",
        clientside_curConns: resp.body.entries[entry_url].nestedStats.entries["clientside.curConns"].value,
        clientside_maxConns: resp.body.entries[entry_url].nestedStats.entries["clientside.maxConns"].value,
        clientside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsIn"].value,
        clientside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsOut"].value,
        clientside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsIn"].value,
        clientside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsOut"].value  
      };

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipStats returning vipResourceStats: ' +JSON.stringify(vipResourceStats)); }

      resolve(vipResourceStats);

    })
    .catch((err) => {

      logger.info('[BigStats] - Error retrieving vipResrouceStats: ' +err);
      reject(err);

    });
  });
};

/**
 * Fetches list of Pools attached to vipResource (see getResource) BIG-IP Services
 * 
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getPoolResourceList = function (vipResource) {

    return new Promise((resolve, reject) => {

//      var that = this;
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getPoolResourceList with resource list: ' +JSON.stringify(vipResource)); }

      var cleanPath = ""; 
      var PREFIX = "https://localhost";

      //TODO: isn't it always at the begining? What are we testing?
      if (vipResource.poolReference.link.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        cleanPath = vipResource.poolReference.link.slice(PREFIX.length).split("?").shift();
      }

      var query = '$select=name,selfLink';    

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+cleanPath); }
      var path = cleanPath+'/members';
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Members URI: '+path); }

      var uri = this.restHelper.makeRestnodedUri(path, query);
      var restOp = this.createRestOperation(uri);
    
      this.restRequestSender.sendGet(restOp)
      .then((resp) => {

        var poolMemberListObj = [];

        resp.body.items.map((element, index) => {
          logger.info('\n\ngetPoolResourceList = element.selfLink:' +element.selfLink);
          logger.info('\n\ngetPoolResourceList = element.name:' +element.name);
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

        logger.info('[BigStats - Error] getPoolResourceList() error: ' +err);
        reject(err);

      });
    });
};

/**
 * Fetches stats from deployed BIG-IP Pool Member resources 
 * @param {object} poolMemberResource
 * @returns {Promise} poolMemberState - List of deployed BIG-IP objects
 */
BigStats.prototype.getPoolMemberStats = function (poolMemberResource) {

    return new Promise((resolve, reject) => {

      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getPoolMemberStats with resource: ' +JSON.stringify(poolMemberResource)); }

      var path = ""; 
      var PREFIX = "https://localhost";

      if (poolMemberResource.path.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        // Remove any trailing querstrings
        path = poolMemberResource.path.slice(PREFIX.length).split("?").shift();
      }
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+path); }
      var uri = path+'/stats';
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Stats URI: '+uri); }

      var url = this.restHelper.makeRestnodedUri(uri);
      var restOp = this.createRestOperation(url);
    
      this.restRequestSender.sendGet(restOp)
      .then((resp) => {

        let name = path.split("/").slice(-1)[0];
        let entry_uri = path+'/'+name+'/stats';
        let entry_url ="https://localhost" +entry_uri;

        let poolMemberStats = {};
        poolMemberStats[poolMemberResource.name] = {
          class: "pool",
          serverside_curConns: resp.body.entries[entry_url].nestedStats.entries["serverside.curConns"].value,
          serverside_maxConns: resp.body.entries[entry_url].nestedStats.entries["serverside.maxConns"].value,
          serverside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsIn"].value,
          monitorStatus: resp.body.entries[entry_url].nestedStats.entries.monitorStatus.description,
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
