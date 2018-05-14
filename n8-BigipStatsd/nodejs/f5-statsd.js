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

    let uri = that.generateURI('127.0.0.1', '/mgmt' +statsdSettingsPath);
    let restOp = that.createRestOperation(uri);

    if (DEBUG === true) { logger.info('[Statsd - DEBUG] - getSettings() Attemtped to fetch config...'); }

    that.restRequestSender.sendGet(restOp)
    .then (function (resp) {
      if (DEBUG === true) { logger.info('[Statsd - DEBUG] - getSettings() Response: ' +JSON.stringify(resp.body.config,'', '\t')); }
      resolve(resp.body.config);
    })
    .catch (function (error) {
      logger.info('[Statsd] - Error retrieving settings: ' +error);
      reject(error);
    });

  });

  var getResourceList = ((config) => {
    return new Promise((resolve,reject) => {

      logger.info('IN getResourceList with config: ' +JSON.stringify(config));

      var path = '/mgmt/tm/ltm/virtual/';
      var query = '$select=subPath,fullPath,selfLink,pool';
      
      var uri = that.restHelper.makeRestnodedUri(path, query);
      var restOp = that.createRestOperation(uri);
    
      that.restRequestSender.sendGet(restOp)
      .then((resp) => {
  //      TODO: Make this 'debug mode' logger.info('[Statsd] - resp.statusCode: ' +JSON.stringify(resp.statusCode));
  //      TODO: Make this 'debug mode' logger.info('[Statsd] - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
        resolve(resp.body);
  
      })
      .catch((error) => {
        logger.info('[Statsd] - Error: ' +JSON.stringify(error));
        reject(error);
      });
  
    });
  }); 
  
  var getVipStats = ((resource_list) => {
    return new Promise((resolve,reject) => {

      var that = this;
      var stats = {
        apps: []
      };

      logger.info('IN getResourceStats wit resource_list: ' +JSON.stringify(resource_list));

      resource_list.items.forEach(element => {
        logger.info('[Statsd] - element.subPath: ' +element.subPath);
        logger.info('[Statsd] - element.fullPath: ' +element.fullPath);
        logger.info('[Statsd] - element.selfLink: ' +element.selfLink);
        logger.info('[Statsd] - element.poolReference.link: ' +element.poolReference.link);

        var path = ""; 
        var PREFIX = "https://localhost";
        if (element.selfLink.indexOf(PREFIX) === 0) {
          // PREFIX is exactly at the beginning
          path = element.selfLink.slice(PREFIX.length).split("?").shift();
        }
        logger.info('[Statsd] - Sliced Path: '+path);
        var uri = path+'/stats';
        logger.info('[Statsd] - Stats URI: '+uri);

        var url = that.restHelper.makeRestnodedUri(uri);
        var restOp = that.createRestOperation(url);
      
        that.restRequestSender.sendGet(restOp)
        .then((resp) => {

          let name = path.split("/").slice(-1)[0];
          let entry_uri = path+'/'+name+'/stats';
          let entry_url ="https://localhost" +entry_uri;

          //Assign the values to something sane... 
          let clientside_curConns = resp.body.entries[entry_url].nestedStats.entries["clientside.curConns"].value;
          let clientside_maxConns = resp.body.entries[entry_url].nestedStats.entries["clientside.maxConns"].value;
          let clientside_bitsIn = resp.body.entries[entry_url].nestedStats.entries["clientside.bitsIn"].value;
          let clientside_bitsOut = resp.body.entries[entry_url].nestedStats.entries["clientside.bitsOut"].value;
          let clientside_pktsIn = resp.body.entries[entry_url].nestedStats.entries["clientside.pktsIn"].value;
          let clientside_pktsOut = resp.body.entries[entry_url].nestedStats.entries["clientside.pktsOut"].value;
          
          let app_name = element.subPath;
          let obj = { 
            [app_name]: {
              clientside_curConns: clientside_curConns,
              clientside_maxConns: clientside_maxConns,
              clientside_bitsIn: clientside_bitsIn,
              clientside_bitsOut: clientside_bitsOut,
              clientside_pktsIn: clientside_pktsIn,
              clientside_pktsOut: clientside_pktsOut  
            }
          };

          stats.apps.push(obj);
          logger.info('stats.apps: ' +JSON.stringify(stats.apps, '', '\t') );

          resolve(stats);
        })
        .catch((error) => {
          logger.info('[Statsd] - Error: ' +JSON.stringify(error));
          reject(error);
        });
      });
    });
  });

  var getPoolStats = ((resource_list) => {
    return new Promise((resolve,reject) => {

      var that = this;
      var stats = {
        apps: []
      };

      logger.info('IN getResourceStats wit resource_list: ' +JSON.stringify(resource_list));

      resource_list.items.forEach(element => {
        logger.info('[Statsd] - element.subPath: ' +element.subPath);
        logger.info('[Statsd] - element.fullPath: ' +element.fullPath);
        logger.info('[Statsd] - element.selfLink: ' +element.selfLink);
        logger.info('[Statsd] - element.poolReference.link: ' +element.poolReference.link);

        var path = ""; 
        var PREFIX = "https://localhost";

        if (element.poolReference.link.indexOf(PREFIX) === 0) {
          // PREFIX is exactly at the beginning
          path = element.poolReference.link.slice(PREFIX.length).split("?").shift();
        }
        logger.info('[Statsd] - Sliced Path: '+path);
        var uri = path+'/stats';
        logger.info('[Statsd] - Stats URI: '+uri);

        var url = that.restHelper.makeRestnodedUri(uri);
        var restOp = that.createRestOperation(url);
      
        that.restRequestSender.sendGet(restOp)
        .then((resp) => {
          logger.info('Pool Stats resp.body: ' +JSON.stringify(resp.body));
        })
        .catch((error) => {
          logger.info('pool_stats error: '+error);
        });

      });
    });
  });


  getSettings.then((config) => {

    logger.info('[Statsd] - config.statsd: ' +config.statsd);
    return getResourceList(config);

  })
  .then((resource_list) => {

    logger.info('[Statsd] - resource_list: ' +JSON.stringify(resource_list));
    return getVipStats(resource_list);

  })
  .then((vipStats, resource_list) => {
    logger.info('vipStats: '+JSON.stringify(theStats));
    logger.info('resource_list: '+JSON.stringify(resource_list));
    return getPoolList(resource_list);

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

//    });
    //    sdc.gauge('myApp1.bigip1.vip1', val);
//    logger.info('[Statsd] Sent stats val: ' +val);
//    that.pullStats();


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
//      .setBody();

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
