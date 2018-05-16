/*
*   Statsd:
*     iControl LX StatsD Client for UDP Streaming BIG-IP Stats to Statsd/Graphite
*
*   N. Pearce, May 2018
*   http://github.com/npearce
*
*/
"use strict";

const logger = require('f5-logger').getInstance();
const http = require('http');
var SDC = require('statsd-client');
var os = require('os');
const host = 'localhost';
const statsdSettingsPath = '/shared/n8/statsd_settings';
const vipUri = '/mgmt/tm/ltm/virtual/';
const poolUri = '/mgmt/tm/ltm/pool/';
const vipStatKeys = [
  "clientside.curConns",
  "clientside.maxConns",
  "clientside.bitsIn",
  "clientside.bitsOut",
  "clientside.pktsIn",
  "clientside.pktsout"
];
const poolStatKeys = [
  "serverside.curConns",
  "serverside.maxConns",
  "serverside.pktsIn",
  "serverside.pktsOut",
  "serverside.bitsIn",
  "serverside.bitsOut"
];
var DEBUG = true;
var vipStatValues = [];
var poolStatValues = [];

function Statsd() {
  this.config = {};
  this.stats = {};
}

Statsd.prototype.WORKER_URI_PATH = "shared/n8/statsd";
Statsd.prototype.isPublic = true;
Statsd.prototype.isSingleton = true;

/**
 * handle onStart
 */
Statsd.prototype.onStart = function(success, error) {

  logger.info("[Statsd] Starting...");

  //Load state (configuration data) from persisted storage.
  success('[Statsd] State loaded...');  

};

/**
 * handle HTTP POST request
 */
Statsd.prototype.onPost = function (restOperation) {

  var data = restOperation.getBody();
  logger.info("data: " +JSON.stringify(data));

  if (typeof data.enable !== 'undefined' && data.enable === true) {
    this.pullStats.call(this);

  }

  restOperation.setBody(data);
  this.completeRestOperation(restOperation);

};

Statsd.prototype.pullStats = function () {

  var that = this;

  var getSettings = new Promise((resolve, reject) => {

    if (DEBUG === true) { logger.info('[Statsd - DEBUG] - ***************IN getSettings()'); }

    let uri = that.generateURI('127.0.0.1', '/mgmt' +statsdSettingsPath);
    let restOp = that.createRestOperation(uri);

    if (DEBUG === true) { logger.info('[Statsd - DEBUG] - getSettings() Attemtped to fetch config...'); }

    that.restRequestSender.sendGet(restOp)
    .then (function (resp) {
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - getSettings() Response: ' +JSON.stringify(resp.body.config,'', '\t')); }
      that.config = resp.body.config;
      resolve(resp.body.config);
    })
    .catch (function (error) {
      logger.info('[Statsd] - Error retrieving settings: ' +error);
      reject(error);
    });

  });

  var getResourceList = ((config) => {
    return new Promise((resolve,reject) => {

      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - ***************IN getResourceList() with config: ' +JSON.stringify(this.config)); }

      var path = '/mgmt/tm/ltm/virtual/';
      var query = '$select=subPath,fullPath,selfLink,pool';
      
      var uri = that.restHelper.makeRestnodedUri(path, query);
      var restOp = that.createRestOperation(uri);
    
      that.restRequestSender.sendGet(restOp)
      .then((resp) => {
        if (DEBUG === true) {
          logger.info('[Statsd - DEBUG] - getResourceList - resp.statusCode: ' +JSON.stringify(resp.statusCode));
          logger.info('[Statsd - DEBUG] - getResourceList - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
        }
        resolve(resp.body);
  
      })
      .catch((error) => {
        logger.info('[Statsd] - Error: ' +JSON.stringify(error));
        reject(error);
      });
  
    });
  }); 

  var parseResources = ((list) => {
    return new Promise((resolve,reject) => {

      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - ***************IN parseResources() with list: ' +JSON.stringify(list)); }

      list.items.map((element, index) => {

        Promise.all([getVipStats(element), getPoolStats(element)])
        .then((values) => {
          if (DEBUG === true) { 
            logger.info('[Statsd - DEBUG] - Index:' +index+ ', values[0]: ' +JSON.stringify(values[0],'','\t'));
            logger.info('[Statsd - DEBUG] - Index:' +index+ ', values[1]: ' +JSON.stringify(values[1],'','\t'));
          }

          if (typeof that.stats[element.subPath] === 'undefined') {
            that.stats[element.subPath] = {};
          }
          that.stats[element.subPath].vip = values[0];
          that.stats[element.subPath].pool = values[1];

          if (DEBUG === true) { logger.info('[Statsd - DEBUG] - list.items.length - 1: ' +(list.items.length - 1)+ '  index: ' +index); }
          if (index === (list.items.length - 1)) {
            if (DEBUG === true) { logger.info('[Statsd - DEBUG] - End of resource list (index === (list.items.length - 1))'); }
            resolve(that.stats);
          }          
        });
      });
    });
  });
  
  var getVipStats = ((resource) => {
    return new Promise((resolve,reject) => {

      var that = this;
    
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - ***************IN getVipStats with resource_list: ' +JSON.stringify(resource)); }

      var path = ""; 
      var PREFIX = "https://localhost";
      if (resource.selfLink.indexOf(PREFIX) === 0) {
        path = resource.selfLink.slice(PREFIX.length).split("?").shift();
      }
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - Sliced Path: '+path); }
      var uri = path+'/stats';
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - Stats URI: '+uri); }

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
        logger.info('[Statsd] - Error: ' +error);
        reject(error);
      });
    });
  });

  var getPoolStats = ((resource) => {
    return new Promise((resolve,reject) => {

      var that = this;
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - ***************IN getPoolStats with resource_list: ' +JSON.stringify(resource)); }

      var path = ""; 
      var PREFIX = "https://localhost";

      if (resource.poolReference.link.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        path = resource.poolReference.link.slice(PREFIX.length).split("?").shift();
      }
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - Sliced Path: '+path); }
      var uri = path+'/stats';
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - Stats URI: '+uri); }

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
        logger.info('pool_stats error: '+error);
      });
    });
  });

  getSettings.then((config) => {

    logger.info('[Statsd] - config.statsd: ' +config.statsd);
    return getResourceList(config);

  })
  .then((resource_list) => {

    return parseResources(resource_list);

  })
  .then((stats) => {
    logger.info('All the stats: ' +JSON.stringify(stats, '', '\t'));

    //TODO: return fireWebhook(stats);

  })
  .catch((error) => {
    logger.info('Promise Chain Error: ' +error);
  });


//    .then(function (values) {
//      logger.info('values: ' +values);      
//      logger.info('values: ' +JSON.stringify(values));
      // Replace this with 'options'
//      var sdc = new SDC({host: '172.31.1.79', port: 8125, debug: true});
//      var val = getRandomArbitrary(20, 300);
/*
      values.map(stat => {
        // Replace this with 'options'
        var sdc = new SDC({host: '172.31.1.79', port: 8125, debug: true});
        // Iterate through the list of interesting stats...
        sdc.gauge('myApp1.bigip1.vip1', 120);

      });
      
*/

};


/**
* Creates a new rest operation instance. Sets the target uri and body
*
* @param {url} uri Target URI
* @param {Object} body Request body
*
* @returns {RestOperation}
*/
Statsd.prototype.createRestOperation = function (uri) {

  var restOp = this.restOperationFactory.createRestOperationInstance()
      .setUri(uri)
      .setContentType("application/json")
      .setIdentifiedDeviceRequest(true);

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
Statsd.prototype.generateURI = function (host, path) {

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
Statsd.prototype.getExampleState = function () {
  
  return {
// whats this now?
  };

};

module.exports = Statsd;
