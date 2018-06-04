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
      this.getStats();
    });

  }

  restOperation.setBody("BigStats says, Thanks!!");
  this.completeRestOperation(restOperation);

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
