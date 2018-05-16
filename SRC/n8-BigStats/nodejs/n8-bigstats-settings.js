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

function BigStatsSettings() {
  this.state = {};
}

BigStatsSettings.prototype.WORKER_URI_PATH = "shared/n8/bigstats_settings";
BigStatsSettings.prototype.isPublic = true;
BigStatsSettings.prototype.isSingleton = true;
BigStatsSettings.prototype.isPersisted = true;

/**
 * handle onStart
 */
BigStatsSettings.prototype.onStart = function(success, error) {

    var me = this;
    this.loadState(null,

        function (err, state) {
            if (err) {

                error('[BigStatsSettings] - Error loading state:' +err);
                return;

            }

            logger.info('[BigStatsSettings] - State loaded.');
            me.state = state;
        }

    );
    success();

};

/**
 * handle onGet HTTP request
 */
BigStatsSettings.prototype.onGet = function(restOperation) {

    // Respond with the persisted state (config)
    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
  
};

/**
 * handle onPost HTTP request
 */
BigStatsSettings.prototype.onPost = function(restOperation) {

    var newState = restOperation.getBody();

    // If there's no 
    if (!newState) {

        restOperation.fail(new Error("[BigStatsSettings] - No state provided..."));
        return;

    }
    else {

        logger.info('[BigStatsSettings] - Settings updated.');
        this.state = newState;

    }

    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
      
};

/**
 * handle /example HTTP request
 */
BigStatsSettings.prototype.getExampleState = function () {
  
    return {
      "config": {
        "interval":"[seconds]",
        "destination": {
            "[ip|url]": "[Refer to documentation]"
        },
        "debug": "[true|false]"
      }
    };
  
  };

module.exports = BigStatsSettings;