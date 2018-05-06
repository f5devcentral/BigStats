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
const statsdSettingsPath = 'shared/n8/statsd_settings';
var DEBUG = true;

function Statsd() {
  this.options = {};
}

Statsd.prototype.WORKER_URI_PATH = "shared/n8/statsd";
Statsd.prototype.isPublic = true;
Statsd.prototype.isPersisted = true;
Statsd.prototype.isSingleton = true;

/**
 * handle onStart
 */
Statsd.prototype.onStart = function(success, error) {

  logger.info("[Statsd] Starting...");

  //Load state (configuration data) from persisted storage.
  var that = this;  
  this.loadState(null, function (err, options) {
    if (err) {
      error('[Statsd] Error loading state: ' +err);
    }
    else {
      if (typeof options !== 'undefined' && options !== null) {
        logger.info('options: ' +options);
        that.options = options;
        if (typeof that.options.debug !== 'undefined' && that.options.debug !== null) {
          logger.info('[Statsd] DEBUG enabled...');
          DEBUG = true;
        }
      }
      success('[Statsd] State loaded...');  
    }
  });

};

Statsd.prototype.onStartCompleted = function(error, success) {

  logger.info("[Statsd] Started.");

  setTimeout( function () {

    try {
      logger.info('[Statsd] Sending stats...');

      // Replace this with 'options'
      var sdc = new SDC({host: '172.31.1.79', port: 8125, debug: true});
      var val = getRandomArbitrary(20, 300);
      // Iterate through the list of interesting stats...
      sdc.gauge('myApp1.bigip1.vip1', val);

      logger.info('[Statsd] Sent stats val: ' +val);

        
    } catch (error) {
      logger.info('[Statsd] Error: ' +error);
      error();
    }  
  
  }, 3000);

  success();

};

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

Statsd.prototype.pullStats = function (theStats) {

  theStats.map(stat => {
    // Replace this with 'options'
    var sdc = new SDC({host: '172.31.1.79', port: 8125, debug: true});
    // Iterate through the list of interesting stats...
    sdc.gauge('myApp1.bigip1.vip1', 120);

  });
  
};

/**
 * handle HTTP POST request
 */
Statsd.prototype.onPost = function (restOperation) {

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
