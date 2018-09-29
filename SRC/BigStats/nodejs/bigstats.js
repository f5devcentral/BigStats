/*
*   BigStats:
*     iControl LX Stats Exporter for BIG-IP
*
*   N. Pearce, June 2018
*   http://github.com/npearce
*
*/
'use strict';

const logger = require('f5-logger').getInstance();
const bigStatsSettingsPath = '/shared/bigstats_settings';
const bigStatsExporterPath = '/shared/bigstats_exporter';

var DEBUG = false;

function BigStats () {
  this.config = {};
  this.stats = {};
}

BigStats.prototype.WORKER_URI_PATH = 'shared/bigstats';
BigStats.prototype.isPublic = true;
BigStats.prototype.isSingleton = true;

/**
 * handle onStart
 */
BigStats.prototype.onStart = function (success, error) {
  logger.info('[BigStats] Starting...');

  try {
    // Make the BigStats_Settings (persisted state) worker a dependency.
    var bigStatsSettingsUrl = this.restHelper.makeRestnodedUri(bigStatsSettingsPath);
    let bigStatsExporterUrl = this.restHelper.makeRestnodedUri(bigStatsExporterPath);
    this.dependencies.push(bigStatsSettingsUrl);
//    this.dependencies.push(bigStatsExporterUrl);
    success();
  } catch (err) {
    logger.info(`[BigStats - ERROR] onStart() - Error starting worker: ${err}`);
    error(err);
  }
};

/**
 * handle onStartCompleted
 */
BigStats.prototype.onStartCompleted = function (success, error) {
  // Fetch state (configuration data) from persisted worker /bigstats_settings
  this.getSettings()
    .then(() => {
      // Setup Task-Scheduler to poll this worker via onPost()
      return this.createScheduler();
    })
    .then((statusCode) => {
      if (DEBUG === true) { logger.info(`[BigStats] onStartCompleted() - Scheduler response code: ${statusCode}`); }
      success();
    })
    .catch((err) => {
      logger.info(`[BigStats - ERROR] onStartCompleted() - Error starting worker: ${err}`);
      error(err);
    });
};

/**
 * handle HTTP POST request
 */
BigStats.prototype.onPost = function (restOperation) {
  var onPostdata = restOperation.getBody();

  if (DEBUG === true) { logger.info(`[BigStats] onPost receved data: ${JSON.stringify(onPostdata)}`); }

  this.getSettings()
    .then(() => {
      if (this.config.enabled === false) {
        logger.info('[BigStats] onPost() - config.enabled is set to \'false\'');
        return;
      }
      // Execute stats collection
      this.pullStats();
    })
    .catch((err) => {
      logger.info(`[BigStats - ERROR] onPost() - Error handling POST: ${err}`);
    });

  // Acknowledge the Scheduler Task
  restOperation.setBody('BigStats says, Thanks!!');
  this.completeRestOperation(restOperation);
};

/**
 * Creates an iControl 'task-scheduler' task to poke onPost every 'n' seconds
 * Executed by onStartCompleted()
 * Interval configuration managed by BigStatsSettings: this.config.interval
 *
 * @return {Promise} Promise Object representing HTTP Status code
 */
BigStats.prototype.createScheduler = function () {
  return new Promise((resolve, reject) => {
    var body = {
      'interval': this.config.interval,
      'intervalUnit': 'SECOND',
      'scheduleType': 'BASIC_WITH_INTERVAL',
      'deviceGroupName': 'tm-shared-all-big-ips',
      'taskReferenceToRun': 'http://localhost:8100/mgmt/shared/bigstats',
      'name': 'n8-BigStats',
      'taskBodyToRun': {
        'polling': 'BigStats'
      },
      'taskRestMethodToRun': 'POST',
      'maxTaskHistoryToKeep': 3
    };

    var path = '/mgmt/shared/task-scheduler/scheduler';
    var uri = this.restHelper.makeRestnodedUri(path);
    var restOp = this.createRestOperation(uri, body);

    this.restRequestSender.sendPost(restOp)
      .then((resp) => {
        if (DEBUG === true) {
          logger.info(`[BigStats - DEBUG] createScheduler() - resp.statusCode: ${JSON.stringify(resp.statusCode)}`);
          logger.info(`[BigStats - DEBUG] createScheduler() - resp.body: ${JSON.stringify(resp.body, '', '\t')}`);
        }

        resolve(resp.statusCode);
      })
      .catch((err) => {
        var errorStatusCode = err.getResponseOperation().getStatusCode();
        var errorBody = err.getResponseOperation().getBody();

        if (errorBody.message.startsWith('Duplicate item')) {
          logger.info(`[BigStats - ERROR] createScheduler() - Status Code: ${errorStatusCode} Message: ${errorBody.message}`);
          resolve(errorStatusCode + ' - Scheduler entry exists.');
        } else {
          logger.info(`[BigStats - ERROR] createScheduler() - Status Code: ${errorStatusCode} Message: ${errorBody.message}`);
          reject(errorStatusCode);
        }
      });
  });
};

/**
 * Updates the iControl 'task-scheduler' job if interval has changed
 * Executed with every onPost poll.
 * 'interval' is a persisted setting managed by BigStatsSettings. See bigstats-schema.json
 *
 * @param {Integer} interval used for task-scheduler task interval
 *
 * @returns {String} HTTP Status code
 */
BigStats.prototype.updateScheduler = function (interval) {
  logger.info('[BigStats] updateScheduler() - New Settings detected, Updating Scheduler.');

  // Execute update to the Task Shceduler interval
  this.getSchedulerId()
    .then((id) => {
      if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getSchedulerId() - Scheduler Task id: ${id}`); }
      return this.patchScheduler(id, interval);
    })
    .then((statusCode) => {
      if (DEBUG === true) { logger.info(`[BigStats - DEBUG] updateScheduler() results: ${statusCode}`); }
      return statusCode;
    })
    .catch((err) => {
      logger.info(`[BigStats - ERROR] updateScheduler() - Error updating Task Scheduler: ${err}`);
    });
};

/**
 * Retreives the Unique Id of the workers 'task-scheduler'
 *
 * @returns {Promise} Promise Object representing the Unique Id for the BigStats task-scheduler task
 */
BigStats.prototype.getSchedulerId = function () {
  return new Promise((resolve, reject) => {
    var path = '/mgmt/shared/task-scheduler/scheduler';
    let uri = this.restHelper.makeRestnodedUri(path);
    let restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
      .then(function (resp) {
        resp.body.items.map((schedulerTask) => {
          if (schedulerTask.name === 'n8-BigStats') {
            resolve(schedulerTask.id);
          }
        });
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] getSchedulerId() - Error retrieving Task Scheduler ID: ${err}`);
        reject(err);
      });
  });
};

/**
 * Patches the 'interval' value of a task-shceduler job
 *
 * @param {String} id Unique identifier of existing task-scheduler task
 * @param {Integer} interval Stat exporting interval
 *
 * @returns {Promise} Promise Object representing HTTP Status Code
 */
BigStats.prototype.patchScheduler = function (id, interval) {
  // Using the task-scheduler unique id, Patch the 'interval' of the scheduler task with the new value.
  return new Promise((resolve, reject) => {
    var body = {
      'interval': interval,
      'taskBodyToRun': {
        'polling': 'BigStats'
      }
    };

    let path = '/mgmt/shared/task-scheduler/scheduler/' + id;
    let uri = this.restHelper.makeRestnodedUri(path);
    let restOp = this.createRestOperation(uri, body);

    this.restRequestSender.sendPatch(restOp)
      .then(function (resp) {
        if (DEBUG === true) { logger.info(`[BigStats - DEBUG] patchScheduler() - Response Code: ${resp.statusCode}`); }
        resolve(resp.statusCode);
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] patchScheduler() - Error patching scheduler interval: ${err}`);
        reject(err);
      });
  });
};

/**
 * Fetches operational settings from persisted state worker, BigStatsSettings
 *
 * @returns {Promise} Promise Object representing operating settings retreived from BigStatsSettings (persisted state) worker
 */
BigStats.prototype.getSettings = function () {
  return new Promise((resolve, reject) => {
    let path = '/mgmt' + bigStatsSettingsPath;
    let uri = this.restHelper.makeRestnodedUri(path);
    let restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getSettings() - Response from BigStatsSettings worker: ${JSON.stringify(resp.body.config, '', '\t')}`); }

        // Is DEBUG enabled?
        if (resp.body.config.debug === true) {
          logger.info('[BigStats] DEBUG ENABLED');
          DEBUG = true;
        } else {
          DEBUG = false;
        }

        // If 'interval' has changed, update the task-scheduler task
        if (this.config.interval !== resp.body.config.interval || this.config.enabled !== resp.body.config.enabled) {
          this.updateScheduler(resp.body.config.interval, resp.body.config.enabled);
        }

        // Apply new config retreived from BigStatsSettings work to the BigStats running state
        this.config = resp.body.config;
        resolve(this.config);
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] getSettings() - Error retrieving settings from BigStatsSettings worker: ${err}`);
        reject(err);
      });
  });
};

/**
 * Collect the required statistics from the appropriate BIG-IP Objects
 */
BigStats.prototype.pullStats = function () {
  // Execute the BIG-IP stats-scraping workflow
  this.getSettings()
    .then(() => {
      return this.getDeviceStats();
    })
    .then(() => {
      return this.getVipResourceList();
    })
    .then((vipResourceList) => {
      switch (this.config.size) {
        case 'medium':
          return this.buildMediumStatsObject(vipResourceList);
        case 'large':
          logger.info('[BigStats - ERROR] - largeStats not yet implemented');
          break;
        default:
          return this.buildSmallStatsObject(vipResourceList);
      }
    })
    .then(() => {
      // Ready the stats for export - Apply stats prefix: 'hostname.services.stats'
      let statsExpObj = {
        [this.config.hostname]: {
          services: this.stats.services,
          device: this.stats.device
        }
      };

      if (DEBUG === true) {
        // TODO: Refactor this to somehow use the util formatting function
        logger.info('\n\n*******************************************\n* [BigStats - DEBUG] - BEGIN Stats Object *\n*******************************************\n\n');
        logger.info(JSON.stringify(statsExpObj, '', '\t'));
        logger.info('\n\n*******************************************\n*  [BigStats - DEBUG] - END Stats Object  *\n*******************************************\n\n');
      }

      this.exportStats(statsExpObj, this.config.destination.protocol);
    })
    .catch((err) => {
      logger.info(`[BigStats - ERROR] pullStats() - Promise Chain Error: ${err}`);
    });
};

/**
* Fetch device statistics - CPU, RAM
*
*/
BigStats.prototype.getDeviceStats = function () {
  return new Promise((resolve, reject) => {
    var path = '/mgmt/tm/sys/hostInfo/';
    var uri = this.restHelper.makeRestnodedUri(path);
    var restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        if (DEBUG === true) {
          logger.info(`[BigStats - DEBUG] getDeviceStats() - resp.statusCode: ${JSON.stringify(resp.statusCode)}`);
          //        logger.info(util.formatLogMessage(`getDeviceStats() - resp.body: ${JSON.stringify(resp.body, '', '\t')}`));   // This is a little too verbose
        }

        this.stats.device = {
          memory: {
            memoryTotal: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries.memoryTotal.value,
            memoryUsed: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries.memoryUsed.value
          }
        };

        // Iterate through the BIG-IP CPU's
        Object.keys(resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries).map((cpu) => {
          let cpuStats = {
            fiveSecAvgIdle: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgIdle.value,
            fiveSecAvgIowait: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgIowait.value,
            fiveSecAvgIrq: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgIrq.value,
            fiveSecAvgNiced: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgNiced.value,
            fiveSecAvgRatio: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgRatio.value,
            fiveSecAvgSoftirq: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgSoftirq.value,
            fiveSecAvgStolen: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgStolen.value,
            fiveSecAvgSystem: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgSystem.value,
            fiveSecAvgUser: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgUser.value
          };

          let cpuId = resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.cpuId.value;

          let cpuNum = 'cpu' + cpuId;
          this.stats.device[cpuNum] = cpuStats;
        });

        resolve();
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] getDeviceStats(): ${JSON.stringify(err)}`);
        reject(err);
      });
  });
};

/**
* For 'small' stats size (config.size: small), fetch:
*   - Virtual IP in/out data
*
* @param {Object} vipResourceList representing an individual vip resource
*
* @returns {Promise} Object representing the collected stats
*
*/
BigStats.prototype.buildSmallStatsObject = function (vipResourceList) {
  // Initialize services object
  this.stats.services = {};

  return new Promise((resolve, reject) => {
    // Fetch list of deployed services
    vipResourceList.items.map((element, index) => {
      // Collect Stats for each service
      this.getVipStats(element)
        .then((values) => {
          var servicePath;

          // Check if subPath is un use.
          if ('subPath' in element) {
            // Merge 'tenant' name and 'subPath' name as '/' delimited string.
            servicePath = element.partition + '/' + element.subPath;
          } else {
            // 'subPath' is NOT used, use 'tenant' name on its own.
            servicePath = element.partition;
          }

          // Initialize object on first run
          if (typeof this.stats.services[servicePath] === 'undefined') {
            this.stats.services[servicePath] = {};
          }

          // Build JavaScript object of stats for each service
          this.stats.services[servicePath][element.destination] = values;

          if (DEBUG === true) { logger.info(`[BigStats - DEBUG] buildSmallStatsObject() - Processing: ${index} of: ${(vipResourceList.items.length - 1)}`); }

          if (index === (vipResourceList.items.length - 1)) {
            resolve();
          }
        })
        .catch((err) => {
          logger.info(`[BigStats - ERROR] buildSmallStatsObject(): ${JSON.stringify(err)}`);
          reject(err);
        });
    });
  });
};

/**
* For 'medium' stats size (config.size: medium), fetch:
*   - Virtual IP in/out data
*   - Individual Pool Member data
*
* @param {Object} vipResourceList representing an individual vip resource
*
* @returns {Promise} Object representing the collected stats
*
*/
BigStats.prototype.buildMediumStatsObject = function (vipResourceList) {
  // Initialize services object
  this.stats.services = {};

  return new Promise((resolve, reject) => {
    // Fetch stats from each resource, based on config.size
    vipResourceList.items.map((vipResource, vipResourceListIndex) => {
      Promise.all([this.getVipStats(vipResource), this.getPoolResourceList(vipResource)])
        .then((values) => {
          var servicePath;

          // Check if subPath is un use.
          if ('subPath' in vipResource) {
            // Merge 'tenant' name and 'subPath' name as '/' delimited string.
            servicePath = vipResource.partition + '/' + vipResource.subPath;
          } else {
            // 'subPath' is NOT used, use 'tenant' name on its own.
            servicePath = vipResource.partition;
          }

          // Initialize object on first run
          if (typeof this.stats.services[servicePath] === 'undefined') {
            this.stats.services[servicePath] = {};
          }

          // Adding VIP data to the 'medium' stats object
          this.stats.services[servicePath][vipResource.destination] = values[0];
          this.stats.services[servicePath][vipResource.destination][vipResource.pool] = [];

          values[1].map((poolMemberResource, poolMemberResourceIndex) => {
            this.getPoolMemberStats(poolMemberResource)
              .then((stats) => {
                // Adding Pool data to the 'medium' stats object
                this.stats.services[servicePath][vipResource.destination][vipResource.pool].push(stats);

                if (vipResourceListIndex === (vipResourceList.items.length - 1)) {
                  if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getPoolMemberStats() - Processing: ${vipResourceListIndex} of: ${(vipResourceList.items.length - 1)}`); }
                  if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getPoolMemberStats() - Processing: ${poolMemberResourceIndex} of: ${(values[1].length - 1)}`); }

                  if (poolMemberResourceIndex === (values[1].length - 1)) {
                    resolve();
                  }
                }
              })
              .catch((err) => {
                logger.info(`[BigStats - ERROR] buildSmallStatsObject(): ${JSON.stringify(err)}`);
                reject(err);
              });
          });
        })
        .catch((err) => {
          logger.info(`[BigStats - ERROR] buildMediumStatsObject(): ${JSON.stringify(err)}`);
          reject(err);
        });
    });
  });
};

/**
* For 'large' stats size (config.size: large), fetch:
*   - Virtual IP in/out data
*   - Individual Pool Member data
*   - // TODO: Some HTTP stats, maybe??
*
* @param {Object} vipResourceList representing an individual vip resource
*
* @returns {null} Absolutely nothing....
*
*/
BigStats.prototype.buildLargeStatsObject = function (vipResourceList) {
  // Not yet implemented
  if (DEBUG === true) { logger.info(`[BigStats - DEBUG] buildLargeStatsObject() with vipResourceList: ${vipResourceList}`); }
  logger.info('[BigStats - DEBUG] buildLargeStatsObject() is not yet implemented.');
};

/**
 * Fetches list of deployed BIG-IP Application Services
 *
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getVipResourceList = function () {
  return new Promise((resolve, reject) => {
    var path = '/mgmt/tm/ltm/virtual/';
    var query = '$select=partition,subPath,fullPath,destination,selfLink,pool';

    var uri = this.restHelper.makeRestnodedUri(path, query);
    var restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        if (DEBUG === true) {
          logger.info(`[BigStats - DEBUG] getVipResourceList - resp.statusCode: ${JSON.stringify(resp.statusCode)}`);
          logger.info(`[BigStats - DEBUG] getVipResourceList - resp.body: ${JSON.stringify(resp.body, '', '\t')}`);
        }

        resolve(resp.body);
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] getVipResourceList(): ${JSON.stringify(err)}`);
        reject(err);
      });
  });
};

/**
 * Fetches list of deployed BIG-IP Services
 *
 * @param {Object} vipResource representing an individual vip resource
 *
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getVipStats = function (vipResource) {
  return new Promise((resolve, reject) => {
    var slicedPath = '';
    var PREFIX = 'https://localhost';

    if (vipResource.selfLink.indexOf(PREFIX) === 0) {
      slicedPath = vipResource.selfLink.slice(PREFIX.length).split('?').shift();
    }

    var uri = slicedPath + '/stats';

    if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getVipStats() - Stats URI: ${uri}`); }

    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        let ver = this.config.hostVersion.split('.');
        let majorVer = ver[0];
        let entryUrl = '';

        // Object structure changed in v14
        if (majorVer > 13) {
          // Crafting PRE-v14 url like this: https://localhost/mgmt/tm/ltm/virtual/~Common~myVip/stats
          entryUrl = vipResource.selfLink.split('?').shift() + '/stats';
        } else {
          // Crafting POST-v14 url like this:https://localhost/mgmt/tm/ltm/virtual/~Common~noAS3_VIP/~Common~noAS3_VIP/stats
          let name = slicedPath.split('/').slice(-1)[0];
          let entryUri = `${slicedPath}/${name}/stats`;
          entryUrl = `https://localhost${entryUri}`;
        }

        let vipResourceStats = {
          clientside_curConns: resp.body.entries[entryUrl].nestedStats.entries['clientside.curConns'].value,
          clientside_maxConns: resp.body.entries[entryUrl].nestedStats.entries['clientside.maxConns'].value,
          clientside_bitsIn: resp.body.entries[entryUrl].nestedStats.entries['clientside.bitsIn'].value,
          clientside_bitsOut: resp.body.entries[entryUrl].nestedStats.entries['clientside.bitsOut'].value,
          clientside_pktsIn: resp.body.entries[entryUrl].nestedStats.entries['clientside.pktsIn'].value,
          clientside_pktsOut: resp.body.entries[entryUrl].nestedStats.entries['clientside.pktsOut'].value
        };

        resolve(vipResourceStats);
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] getVipStats() - Error retrieving vipResourceStats: ${err}`);
        reject(err);
      });
  });
};

/**
 * Fetches list of Pools attached to vipResource (see getResource) BIG-IP Services
 *
 * @param {Object} vipResource representing an individual vip resource
 *
 * @returns {Object} List of deployed BIG-IP objects
 */
BigStats.prototype.getPoolResourceList = function (vipResource) {
  return new Promise((resolve, reject) => {
    // If the VIP has an associated pool
    if (typeof vipResource.poolReference !== 'undefined') {
      var cleanPath = '';
      var PREFIX = 'https://localhost';

      // TODO: isn't it always at the beginning? What are we testing?
      if (vipResource.poolReference.link.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        cleanPath = vipResource.poolReference.link.slice(PREFIX.length).split('?').shift();
      }

      var query = '$select=name,selfLink';
      var path = `${cleanPath}/members`;

      if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getPoolResourceList() - Pool Members URI: ${path}`); }

      var uri = this.restHelper.makeRestnodedUri(path, query);
      var restOp = this.createRestOperation(uri);
      var poolMemberListObj = [];

      this.restRequestSender.sendGet(restOp)
        .then((resp) => {
          resp.body.items.map((element, index) => {
            poolMemberListObj.push(
              {
                name: element.name,
                path: element.selfLink
              }
            );

            if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getPoolResourceList() - Processing: ${index} of: ${(resp.body.items.length - 1)}`); }

            if (index === (resp.body.items.length - 1)) {
              resolve(poolMemberListObj);
            }
          });
        })
        .catch((err) => {
          logger.info(`[BigStats - ERROR] getPoolResourceList(): ${err}`);
          reject(err);
        });
    }
  });
};

/**
 * Fetches stats from deployed BIG-IP Pool Member resources
 *
 * @param {Object} poolMemberResource representing an individual pool member selfLink
 *
 * @returns {Promise} Promise Object representing individual pool member stats
 */
BigStats.prototype.getPoolMemberStats = function (poolMemberResource) {
  return new Promise((resolve, reject) => {
    var path = '';
    var PREFIX = 'https://localhost';

    if (poolMemberResource.path.indexOf(PREFIX) === 0) {
      // PREFIX is exactly at the beginning
      // Remove any trailing querstrings
      path = poolMemberResource.path.slice(PREFIX.length).split('?').shift();
    }

    var uri = `${path}/stats`;
    if (DEBUG === true) { logger.info(`[BigStats - DEBUG] getPoolMemberStats() - Stats URI: ${uri}`); }

    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        let name = path.split('/').slice(-1)[0];
        let entryUri = `${path}/${name}/stats`;
        let entryUrl = `https://localhost${entryUri}`;
        let serverStatus = 0;

        // Change Pool Member status from string to 1 (up) or 0 (down)
        if (resp.body.entries[entryUrl].nestedStats.entries.monitorStatus.description === 'up') {
          serverStatus = 1;
        } else {
          serverStatus = 0;
        }

        let poolMemberStats = {};
        poolMemberStats[poolMemberResource.name] = {
          serverside_curConns: resp.body.entries[entryUrl].nestedStats.entries['serverside.curConns'].value,
          serverside_maxConns: resp.body.entries[entryUrl].nestedStats.entries['serverside.maxConns'].value,
          serverside_bitsIn: resp.body.entries[entryUrl].nestedStats.entries['serverside.bitsIn'].value,
          serverside_bitsOut: resp.body.entries[entryUrl].nestedStats.entries['serverside.bitsOut'].value,
          serverside_pktsIn: resp.body.entries[entryUrl].nestedStats.entries['serverside.pktsIn'].value,
          serverside_pktsOut: resp.body.entries[entryUrl].nestedStats.entries['serverside.pktsOut'].value,
          monitorStatus: serverStatus
        };

        resolve(poolMemberStats);
      })
      .catch((err) => {
        logger.info(`[BigStats - ERROR] getPoolMemberStats(): ${err}`);
        reject(err);
      });
  });
};

/**
 * Push the stats object to the desired destinations
 * 
 * @param {Object} statsObj representing the collected statistics 
 */
//Push stats to a remote destination
BigStats.prototype.exportStats = function (statsObj) {

//  if (DEBUG === true) { logger.info('[BigStats - DEBUG] exportStats():'); }
  logger.info('[BigStats - DEBUG] exportStats():'); 

  var data = { config: this.config, stats: statsObj };

//  if (DEBUG === true) { logger.info(`[BigStats - DEBUG] exportStats() w/:  ${JSON.stringify(data, '', '\t')}`); }
  logger.info(`[BigStats - DEBUG] exportStats() w/:  ${JSON.stringify(data, '', '\t')}`);

  var uri = '/mgmt/shared/bigstats_exporter';
  var url = this.restHelper.makeRestnodedUri(uri);
  var restOp = this.createRestOperation(url, data);

  this.restRequestSender.sendPost(restOp)
  .then((resp) => {
    logger.info('[BigStats] exportStats(): Got a response!!!');
    logger.info(`[BigStats] exportStats():  ${JSON.stringify(resp.body)}`);
  })
  .catch((err) => {
    logger.info(`[BigStats - ERROR] - Exporter: err: ${err}`);
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
    .setContentType('application/json')
    .setIdentifiedDeviceRequest(true);

  if (body) {
    restOp.setBody(body);
  }

  return restOp;
};

module.exports = BigStats;
