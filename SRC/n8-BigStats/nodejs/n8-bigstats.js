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
const http = require('http');
const host = 'localhost';
const BigStatsSettingsPath = '/shared/n8/bigstats_settings';
const vipUri = '/mgmt/tm/ltm/virtual/';
const poolUri = '/mgmt/tm/ltm/pool/';

var DEBUG = true;
var vipStatValues = [];
var poolStatValues = [];

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

  //Load state (configuration data) from persisted storage.
  this.statScheduler()
  .then((res) => {
    logger.info('[BigStats] Scheduler response: '+JSON.stringify(res,'','\t'));
    success('[BigStats] Scheduler started...');

  });  

};

/**
 * handle HTTP POST request
 */
BigStats.prototype.onPost = function (restOperation) {

  var data = restOperation.getBody();
  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - onPost receved data: ' +JSON.stringify(data)); }

  if (DEBUG === true) { logger.info('[BigStats - DEBUG] - IN onPost with this.config: ' +JSON.stringify(this.config)); }
  
  if (typeof data.enabled !== 'undefined' && data.enabled === true) {
    logger.info('calling pullStats');
    this.pullStats();
  }

  restOperation.setBody(data);
  logger.info('\n\nResponding to scheduler now\n\n');
  this.completeRestOperation(restOperation);

};

BigStats.prototype.statScheduler = function () {

  var that = this;

  return new Promise((resolve,reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getResourceList() with config: ' +JSON.stringify(this.config)); }

    var body = {
      "interval":10,
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
  
    logger.info('statScheduler.restOp: ' +JSON.stringify(restOp));
    that.restRequestSender.sendPost(restOp)
    .then((resp) => {
      if (DEBUG === true) {
        logger.info('[BigStats - DEBUG] - statScheduler - resp.statusCode: ' +JSON.stringify(resp.statusCode));
        logger.info('[BigStats - DEBUG] - statScheduler - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
      }

      resolve(resp.body);

    })
    .catch((error) => {
      let errorStatusCode = error.getResponseOperation().getStatusCode();
      var errorBody = error.getResponseOperation().getBody();

      logger.info('[BigStats] - Error: Status Code ' +errorStatusCode);
      logger.info('[BigStats] - Error: Message' +errorBody.message);

      if (errorBody.message.startsWith("Duplicate item")) {
        resolve('Scheduler entry exists.');
      }
      else{
        reject(errorBody);
      }
    });

  });

};


BigStats.prototype.pullStats = function () {

  var that = this;

  var getSettings = new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getSettings()'); }

    let uri = that.generateURI(host, '/mgmt' +BigStatsSettingsPath);
    let restOp = that.createRestOperation(uri);

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSettings() Attemtped to fetch config...'); }

    that.restRequestSender.sendGet(restOp)
    .then (function (resp) {
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - getSettings() Response: ' +JSON.stringify(resp.body.config,'', '\t')); }
      that.config = resp.body.config;

      resolve(resp.body.config);

    })
    .catch (function (error) {
      logger.info('[BigStats] - Error retrieving settings: ' +error);
      reject(error);
    });

  });

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

  var pushStats = ((stats) => {

    var path = '/somepath'; 
  
    var http = require("http");

    logger.info('IN pushStats w/ config: '+JSON.stringify(this.config));

    var options = {
      "method": "POST",
      "hostname": "172.31.1.79",
      "port": "8080",
      "path": path,
      "headers": {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    };
    
    var req = http.request(options, function (res) {
      var chunks = [];
    
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });
    
      res.on('end', function () {
        var body = Buffer.concat(chunks);
        logger.info(body.toString());
      });

    });
    
    req.write(JSON.stringify(stats));
    req.on('error', ((e) => {
      logger.info('[BigStats] - ***************Error pushing stats): ' +e);
    }));
    req.end();

    if (DEBUG === true) {
//      logger.info('[BigStats - DEBUG] - statScheduler - resp.statusCode: ' +JSON.stringify(resp.statusCode));
//      logger.info('[BigStats - DEBUG] - statScheduler - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
    }

  });


  getSettings.then((config) => {

    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - config.BigStats: ' +config.destination); }
    return getResourceList();

  })    
  .then((resource_list) => {

    return parseResources(resource_list);

  })
  .then((stats) => {
    if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Pushing stats: ' +JSON.stringify(stats, '', '\t')); }

    pushStats(stats);

  })
  .catch((error) => {
    logger.info('Promise Chain Error: ' +error);
  });

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
// whats this now?
  };

};

module.exports = BigStats;
