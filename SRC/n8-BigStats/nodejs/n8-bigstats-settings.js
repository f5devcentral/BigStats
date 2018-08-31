/*
*   BigStatsSettings:
*     Persisted State worker for storing settings.
*
*   N. Pearce, April 2018
*   http://github.com/npearce
*
*/
"use strict";

const logger = require('f5-logger').getInstance();
const os = require("os");

function BigStatsSettings() {
  this.state = {};
}

BigStatsSettings.prototype.WORKER_URI_PATH = "shared/bigstats_settings";
BigStatsSettings.prototype.isPublic = true;
BigStatsSettings.prototype.isSingleton = true;
BigStatsSettings.prototype.isPersisted = true;

/**
 * handle onStart
 */
BigStatsSettings.prototype.onStart = function(success, error) {

    var that = this;
    this.loadState(null,

        function (err, state) {
            if (err) {

                error('[BigStatsSettings] - Error loading state:' +err);
                return;

            }
            else {

                logger.info('[BigStatsSettings] - State loaded.');
                that.state = state;
    
            }

        }

    );
    success();

};

/**
 * handle onGet HTTP request
 */
BigStatsSettings.prototype.onGet = function(restOperation) {

    let hostname = os.hostname();
    let safeHostname = hostname.replace(/\./g, '-');
    this.state.config.hostname = safeHostname;

    // Respond with the persisted state (config)
    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
  
};

/**
 * handle onPost HTTP request
 */
BigStatsSettings.prototype.onPost = function(restOperation) {

    let input = restOperation.getBody();

    let newState = this.validateConfiguration(input);

    if (newState) {

        this.state = newState;

        logger.info('[BigStatsSettings] - Settings updated.');

        restOperation.setBody(this.state);
        this.completeRestOperation(restOperation);
    
    }
    else {

        // Invlid input
        restOperation.fail(new Error("[BigStatsSettings] - Invalid/No state provided..."));
        return;

    }
      
};

/**
 * Check for some values, enforce some defaults
 * 
 * @param {(object|string)} input
 * 
 * @return {boolean} 
 */
BigStatsSettings.prototype.validateConfiguration = function(input) {

    let jsonInput = this.isJson(input);

    logger.info('\n\n this.isJson() returned: ' +JSON.stringify(jsonInput)+ ' \n\n');

    if (jsonInput && typeof jsonInput.config !== 'undefined') {

        // Check if interval exists, or is less than the minimum
        if (typeof jsonInput.config.interval === 'undefined' || jsonInput.config.interval < 10) {

            //Enforce minimum interval
            jsonInput.config.interval = 10;

        }

        // Enable by default
        if (typeof jsonInput.config.enabled === 'undefined') {

            jsonInput.config.enabled = true;

        }

        if (typeof jsonInput.config.destination === 'undefined') {

            logger.info('[BigStatsSettings - ERROR] - Must provide \'destination: \'.');
            return false;

        }

        return jsonInput;

    }
    else {

        // isJson() returned false. Is ths even valid JSON??
        return false;

    }
        

};

/**
 * If not an Object, can we parse it?
 * 
 * @param {(object|string)} input
 * 
 * @return {object}
 */
BigStatsSettings.prototype.isJson = function(input) {

    if (input && typeof input !== 'object') {

        try {

            input = JSON.parse(input);
    
        } catch (err) {
    
            logger.info('[BigStatsSettings - ERROR] Unable to parse input: ' +err);
    
            return;
            
        }

    }

    return input;

};

/**
 * handle /example HTTP request
 */
BigStatsSettings.prototype.getExampleState = function () {
  
    return {
        "config": {
            "desintation": {
              "protocol": "[http|https|statsd|kafka]",
              "address": "[ip_address]",
              "port": "[tcp_port]",
              "uri": "[uri]"
            },
            "interval": "[seconds]",
            "enabled": true,
            "debug": false
          }
    };
  
  };

module.exports = BigStatsSettings;