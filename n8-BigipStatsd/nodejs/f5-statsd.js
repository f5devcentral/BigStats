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
const statsdSettingsPath = 'shared/n8/statsd_settings';
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

  if (data.stats.enable === true) {
//    this.pullStats.call(this);
    var that = this;
    var path = '/mgmt/tm/ltm/virtual/';
    var query = '$select=partition,subPath,fullPath,selfLink,pool';
//    var query = '';

    logger.info('path: '+path);

//    var uri = that.restHelper.makeRestjavadUri(path, query);
    var uri = that.restHelper.makeRestnodedUri(path, query);
//    logger.info('uri: '+JSON.stringify(uri, '', '\t'));
    var restOp = that.createRestOperation(uri);
    logger.info('uri: '+JSON.stringify(restOp, '', '\t'));

    that.restRequestSender.sendGet(restOp)
    .then((resp) => {
      logger.info('resp.statusCode: ' +JSON.stringify(resp.statusCode));
      logger.info('resp.body: ' +JSON.stringify(resp.body, '', '\t'));

    })
    .catch((error) => {
      logger.info('error: ' +JSON.stringify(error));
    });

  }

  restOperation.setBody(data);
  this.completeRestOperation(restOperation);

};

Statsd.prototype.pullStats = function () {

  var that = this;
  var path = '/mgmt/tm/ltm/virtual/';
  var query = '$select=partition,subPath,fullPath,selfLink,pool';
//  var query = '';

  logger.info('path: '+path);

  var uri = that.restHelper.makeRestjavadUri(path, query);
  logger.info('uri: '+JSON.stringify(uri, '', '\t'));
  var restOp = that.createRestOperation(uri);

  that.restRequestSender.sendGet(restOp)
  .then((data) => {
    logger.info('data: ' +JSON.stringify(data));
  })
  .catch((error) => {
    logger.info('error: ' +JSON.stringify(error));
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
 * handle /example HTTP request
 */
Statsd.prototype.getExampleState = function () {
  
  return {
// whats this now?
  };

};

module.exports = Statsd;
