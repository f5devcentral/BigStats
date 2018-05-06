/*
*   StatsD-Settings:
*     Persisted State worker for storing settings.
*
*   N. Pearce, April 2018
*   http://github.com/npearce
*
*/
"use strict";

const logger = require('f5-logger').getInstance();

function StatsDSettings() {
  this.state = {};
}

StatsDSettings.prototype.WORKER_URI_PATH = "shared/n8/statsd_settings";
StatsDSettings.prototype.isPublic = true;
StatsDSettings.prototype.isSingleton = true;
StatsDSettings.prototype.isPersisted = true;

/**
 * handle onStart
 */
StatsDSettings.prototype.onStart = function(success, error) {

    var me = this;
    this.loadState(null,

        function (err, state) {
            if (err) {

                error('[StatsDSettings] - Error loading state:' +err);
                return;

            }

            logger.info('[StatsDSettings] - State loaded.');
            me.state = state;
        }

    );
    success();

};

/**
 * handle onGet HTTP request
 */
StatsDSettings.prototype.onGet = function(restOperation) {

    // Respond with the persisted state (config)
    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
  
};

/**
 * handle onPost HTTP request
 */
StatsDSettings.prototype.onPost = function(restOperation) {

    var newState = restOperation.getBody();

    // If there's no 
    if (!newState) {

        restOperation.fail(new Error("[StatsDSettings] - No state provided..."));
        return;

    }
    else {

        logger.info('[StatsDSettings] - Settings updated.');
        this.state = newState;

    }

    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
      
};

module.exports = StatsDSettings;