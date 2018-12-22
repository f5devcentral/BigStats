/*
*   BigStats:
*     iControl LX Stats Exporter for BIG-IP
*
*   N. Pearce, June 2018
*   http://github.com/npearce
*
*/
'use strict';

const bigStatsSettingsPath = '/shared/bigstats_settings';
const bigStatsExporterPath = '/shared/bigstats_exporter';
const util = require('./util');

function BigStats () {
  this.config = {};
  this.stats = {};
  util.init('BigStats');
}

BigStats.prototype.WORKER_URI_PATH = 'shared/bigstats';
BigStats.prototype.isPublic = true;
BigStats.prototype.isSingleton = true;

/**
 * handle onStart
 */
BigStats.prototype.onStart = function (success, error) {
  util.logInfo('Starting...');

  try {
    // Make the BigStats_Settings (persisted state) worker a dependency.
    var bigStatsSettingsUrl = this.restHelper.makeRestnodedUri(bigStatsSettingsPath);
    let bigStatsExporterUrl = this.restHelper.makeRestnodedUri(bigStatsExporterPath);
    this.dependencies.push(bigStatsSettingsUrl);
    this.dependencies.push(bigStatsExporterUrl);
    success();
  } catch (err) {
    util.logError(`onStart() - Error starting worker: ${err}`);
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
      util.logDebug(`onStartCompleted() - Scheduler response code: ${statusCode}`);
      success();
    })
    .catch((err) => {
      util.logError(`onStartCompleted() - Error starting worker: ${err}`);
      error(err);
    });
};

/**
 * handle HTTP POST request
 */
BigStats.prototype.onPost = function (restOperation) {
  var onPostdata = restOperation.getBody();

  util.logDebug(`onPost received data: ${JSON.stringify(onPostdata)}`);

  this.getSettings()
    .then(() => {
      if (this.config.enabled === false) {
        util.logInfo('onPost() - config.enabled is set to \'false\'');
        return;
      }
      // Execute stats collection
      return this.pullStats();
    })
    .then((statsObj) => {
      return this.exportStats(statsObj);

    })
    .catch((err) => {
      util.logError(`onPost() - Error handling POST: ${err}`);
    });

  // Acknowledge the Scheduler Task
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
        util.logDebug(`createScheduler() - resp.statusCode: ${JSON.stringify(resp.statusCode)}`);
        util.logDebug(`createScheduler() - resp.body: ${JSON.stringify(resp.body, '', '\t')}`);

        resolve(resp.statusCode);
      })
      .catch((err) => {
        var errorStatusCode = err.getResponseOperation().getStatusCode();
        var errorBody = err.getResponseOperation().getBody();

        if (errorBody.message.startsWith('Duplicate item')) {
          util.logError(`createScheduler() - Status Code: ${errorStatusCode} Message: ${errorBody.message}`);
          resolve(errorStatusCode + ' - Scheduler entry exists.');
        } else {
          util.logError(`createScheduler() - Status Code: ${errorStatusCode} Message: ${errorBody.message}`);
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
  util.logInfo('updateScheduler() - New Settings detected, Updating Scheduler.');

  // Execute update to the Task Shceduler interval
  this.getSchedulerId()
    .then((id) => {
      util.logDebug(`getSchedulerId() - Scheduler Task id: ${id}`);
      return this.patchScheduler(id, interval);
    })
    .then((statusCode) => {
      util.logDebug(`updateScheduler() results: ${statusCode}`);
      return statusCode;
    })
    .catch((err) => {
      util.logError(`updateScheduler() - Error updating Task Scheduler: ${err}`);
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
        util.logError(`getSchedulerId() - Error retrieving Task Scheduler ID: ${err}`);
        reject(err);
      });
  });
};

/**
 * Patches the 'interval' value of a task-scheduler job
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
        util.logDebug(`patchScheduler() - Response Code: ${resp.statusCode}`);
        resolve(resp.statusCode);
      })
      .catch((err) => {
        util.logError(`patchScheduler() - Error patching scheduler interval: ${err}`);
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
        util.logDebug(`getSettings() - Response from BigStatsSettings worker: ${JSON.stringify(resp.body.config, '', '\t')}`);

        // Is DEBUG enabled?
        if (resp.body.config.debug === true) {
          util.logInfo('DEBUG ENABLED');
          util.debugEnabled = true;
        } else {
          util.debugEnabled = false;
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
        util.logError(`getSettings() - Error retrieving settings from BigStatsSettings worker: ${err}`);
        reject(err);
      });
  });
};

/**
 * Collect the required statistics from the appropriate BIG-IP Objects
 */
BigStats.prototype.pullStats = function () {
  return new Promise((resolve, reject) => {

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
            return this.buildLargeStatsObject(vipResourceList);
          default:
            return this.buildSmallStatsObject(vipResourceList);
        }
      })
      .then(() => {
        // Ready the stats for export - Apply stats prefix: 'hostname.services.stats'
        let statsExpObj = {
          device: {
            id: this.config.hostname,
            tenants: this.stats.device.tenants,
            global: this.stats.device.global
          }
        };

        util.logDebug('\n\n*******************************************\n* BEGIN Stats Object *\n*******************************************\n\n');
        util.logDebug(JSON.stringify(statsExpObj, '', '\t'));
        util.logDebug('\n\n*******************************************\n* END Stats Object  *\n*******************************************\n\n');

        resolve(statsExpObj);
      })
      .catch((err) => {
        util.logError(`pullStats() - Promise Chain Error: ${err}`);
      });
  });
};

/**
* Fetch device statistics - CPU, RAM
*
*/
BigStats.prototype.getDeviceStats = function () {
  this.stats.device = {};

  return new Promise((resolve, reject) => {
    var path = '/mgmt/tm/sys/hostInfo/';
    var uri = this.restHelper.makeRestnodedUri(path);
    var restOp = this.createRestOperation(uri);

    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        util.logDebug(`getDeviceStats() - resp.statusCode: ${JSON.stringify(resp.statusCode)}`);

        this.stats.device.global = {
          memory: {
            memoryTotal: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries.memoryTotal.value,
            memoryUsed: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries.memoryUsed.value
          }
        };

        this.stats.device.global.cpus = [];

        // Iterate through the BIG-IP CPU's
        Object.keys(resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries).map((cpu) => {
          let cpuId = `cpu${resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.cpuId.value}`;
          this.stats.device.global.cpus.push({
            id: cpuId,
            fiveSecAvgIdle: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgIdle.value,
            fiveSecAvgIowait: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgIowait.value,
            fiveSecAvgIrq: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgIrq.value,
            fiveSecAvgNiced: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgNiced.value,
            fiveSecAvgRatio: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgRatio.value,
            fiveSecAvgSoftirq: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgSoftirq.value,
            fiveSecAvgStolen: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgStolen.value,
            fiveSecAvgSystem: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgSystem.value,
            fiveSecAvgUser: resp.body.entries['https://localhost/mgmt/tm/sys/host-info/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/hostInfo/0/cpuInfo'].nestedStats.entries[cpu].nestedStats.entries.fiveSecAvgUser.value
          });
        });

        resolve();
      })
      .catch((err) => {
        util.logError(`getDeviceStats(): ${JSON.stringify(err)}`);
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
  this.stats.device.tenants = [];

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

          // Check if a tenant entry for this VIP already exists 
          const tenantIndex = this.stats.device.tenants.findIndex(tenant => tenant.id === servicePath);

          if (tenantIndex === -1) {
            // Tenant doesn't exist, push to array
            this.stats.device.tenants.push({
              id: servicePath,
              services: [values]
            });  
          }
          else {
            // Tenant does exist, splice into Tenant array entry
            this.stats.device.tenants[tenantIndex].services.splice(tenantIndex, 0, values); 
          }

          util.logDebug(`buildSmallStatsObject() - Processing: ${index} of: ${(vipResourceList.items.length - 1)}`);

          if (index === (vipResourceList.items.length - 1)) {
            resolve();
          }
        })
        .catch((err) => {
          util.logError(`buildSmallStatsObject(): ${err}`);
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
  this.stats.device.tenants = [];

  return new Promise((resolve, reject) => {
    // Fetch stats from each resource, based on config.size
    vipResourceList.items.map((vipResource, vipResourceListIndex) => {
      this.getVipStats(vipResource)
        .then((results) => {
          let servicePath;
          var tenantIndex;
          var serviceIndex;
          // Check if subPath is un use.
          if ('subPath' in vipResource) {
            // Merge 'tenant' name and 'subPath' name as '/' delimited string.
            servicePath = vipResource.partition + '/' + vipResource.subPath;
          } else {
            // 'subPath' is NOT used, use 'tenant' name on its own.
            servicePath = vipResource.partition;
          }
          util.logDebug(`buildMediumStatsObject() - Processing VIP: ${vipResourceListIndex} of: ${(vipResourceList.items.length - 1)}`);

          // Check if the tenant and service entries exist 
          tenantIndex = this.stats.device.tenants.findIndex(tenant => tenant.id === servicePath);
          if (tenantIndex === -1) {
            // Tenant & Service don't exist, creating.
            this.stats.device.tenants.push({
              id: servicePath,
              services: [results]
            });
            // Update tenantIndex & serviceIndex for newly created objects.
            tenantIndex = this.stats.device.tenants.findIndex(tenant => tenant.id === servicePath);
            serviceIndex = this.stats.device.tenants[tenantIndex].services.findIndex(service => service.id === vipResource.destination);
          }
          else {
            // Tenant exists, check if service exists 
            serviceIndex = this.stats.device.tenants[tenantIndex].services.findIndex(service => service.id === vipResource.destination);
            if (serviceIndex === -1) {
              // Service does not exist, creating.
              this.stats.device.tenants[tenantIndex].services.push(results);
              serviceIndex = this.stats.device.tenants[tenantIndex].services.findIndex(service => service.id === vipResource.destination);
            }
          }
          util.logDebug(`this.stats.device.tenants.length: ${this.stats.device.tenants.length}, tenantIndex: ${tenantIndex}, serviceIndex: ${serviceIndex}, this.stats.device.tenants[tenantIndex]: ${JSON.stringify(this.stats.device.tenants[tenantIndex])}`);

          // Verify VIP has a pool attached
          if (typeof vipResource.poolReference !== 'undefined') {
            // initialize objects on first run
            if (typeof this.stats.device.tenants[tenantIndex].services[serviceIndex].pool === 'undefined') {
              this.stats.device.tenants[tenantIndex].services[serviceIndex].pool = {};
              this.stats.device.tenants[tenantIndex].services[serviceIndex].pool.id = vipResource.pool;
              this.stats.device.tenants[tenantIndex].services[serviceIndex].pool.members = [];
            }
            
            this.getPoolResourceList(vipResource)
            .then((poolResourceList) => {
              poolResourceList.map((poolMemberResource, poolMemberResourceIndex) => {
                this.getPoolMemberStats(poolMemberResource)
                  .then((stats) => {
                    this.stats.device.tenants[tenantIndex].services[serviceIndex].pool.members.push(stats);

                    if (vipResourceListIndex === (vipResourceList.items.length - 1)) {
                      util.logDebug(`getPoolMemberStats() - Processing: ${vipResourceListIndex} of: ${(vipResourceList.items.length - 1)}`);
                      util.logDebug(`getPoolMemberStats() - Processing: ${poolMemberResourceIndex} of: ${(poolResourceList.length - 1)}`);

                      if (poolMemberResourceIndex === (poolResourceList.length - 1)) {
                        util.logDebug('VIP & POOL ARRAYs Complete');
                        resolve();
                      }
                    }
                  })
                  .catch((err) => {
                    util.logError(`buildMediumStatsObject(): ${err}`);
                    reject(err);
                  });
              });
            });
          }
        })
        .catch((err) => {
          util.logError(`buildMediumStatsObject(): ${err}`);
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
  // Initialize services object
  this.stats.device.tenants = [];

  return new Promise((resolve, reject) => {
    // Fetch stats from each resource, based on config.size
    vipResourceList.items.map((vipResource, vipResourceListIndex) => {
      this.getVipStats(vipResource)
        .then((results) => {
          let servicePath;
          var tenantIndex;
          var serviceIndex;
          // Check if subPath is un use.
          if ('subPath' in vipResource) {
            // Merge 'tenant' name and 'subPath' name as '/' delimited string.
            servicePath = vipResource.partition + '/' + vipResource.subPath;
          } else {
            // 'subPath' is NOT used, use 'tenant' name on its own.
            servicePath = vipResource.partition;
          }
          util.logDebug(`buildlargeStatsObject() - Processing VIP: ${vipResourceListIndex} of: ${(vipResourceList.items.length - 1)}`);

          // Check if the tenant and service entries exist 
          tenantIndex = this.stats.device.tenants.findIndex(tenant => tenant.id === servicePath);
          if (tenantIndex === -1) {
            // Tenant & Service don't exist, creating.
            this.stats.device.tenants.push({
              id: servicePath,
              services: [results]
            });
            // Update tenantIndex & serviceIndex for newly created objects.
            tenantIndex = this.stats.device.tenants.findIndex(tenant => tenant.id === servicePath);
            serviceIndex = this.stats.device.tenants[tenantIndex].services.findIndex(service => service.id === vipResource.destination);
          }
          else {
            // Tenant exists, check if service exists 
            serviceIndex = this.stats.device.tenants[tenantIndex].services.findIndex(service => service.id === vipResource.destination);
            if (serviceIndex === -1) {
              // Service does not exist, creating.
              this.stats.device.tenants[tenantIndex].services.push(results);
              serviceIndex = this.stats.device.tenants[tenantIndex].services.findIndex(service => service.id === vipResource.destination);
            }
          }
          util.logDebug(`this.stats.device.tenants.length: ${this.stats.device.tenants.length}, tenantIndex: ${tenantIndex}, serviceIndex: ${serviceIndex}, this.stats.device.tenants[tenantIndex]: ${JSON.stringify(this.stats.device.tenants[tenantIndex])}`);

          this.getSslStats(vipResource)
          .then((sslStats) => {
            if (Object.keys(sslStats).length !== 0) {
              this.stats.device.tenants[tenantIndex].services[serviceIndex].ssl = sslStats;
            }
          });

          // Verify VIP has a pool attached
          if (typeof vipResource.poolReference !== 'undefined') {
            // initialize objects on first run
            if (typeof this.stats.device.tenants[tenantIndex].services[serviceIndex].pool === 'undefined') {
              this.stats.device.tenants[tenantIndex].services[serviceIndex].pool = {};
              this.stats.device.tenants[tenantIndex].services[serviceIndex].pool.id = vipResource.pool;
              this.stats.device.tenants[tenantIndex].services[serviceIndex].pool.members = [];
            }
            
            this.getPoolResourceList(vipResource)
            .then((poolResourceList) => {
              poolResourceList.map((poolMemberResource, poolMemberResourceIndex) => {
                this.getPoolMemberStats(poolMemberResource)
                  .then((stats) => {
                    this.stats.device.tenants[tenantIndex].services[serviceIndex].pool.members.push(stats);

                    if (vipResourceListIndex === (vipResourceList.items.length - 1)) {
                      util.logDebug(`getPoolMemberStats() - Processing: ${vipResourceListIndex} of: ${(vipResourceList.items.length - 1)}`);
                      util.logDebug(`getPoolMemberStats() - Processing: ${poolMemberResourceIndex} of: ${(poolResourceList.length - 1)}`);

                      if (poolMemberResourceIndex === (poolResourceList.length - 1)) {
                        util.logDebug('VIP & POOL ARRAYs Complete');
                        resolve();
                      }
                    }
                  })
                  .catch((err) => {
                    util.logError(`buildLargeStatsObject(): ${err}`);
                    reject(err);
                  });
              });
            });
          }
        })
        .catch((err) => {
          util.logError(`buildLargeStatsObject(): ${err}`);
          reject(err);
        });
    });
  });
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
        util.logDebug(`getVipResourceList - resp.statusCode: ${JSON.stringify(resp.statusCode)}`);
        util.logDebug(`getVipResourceList - resp.body: ${JSON.stringify(resp.body, '', '\t')}`);
        resolve(resp.body);
      })
      .catch((err) => {
        util.logError(`getVipResourceList(): ${err}`);
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
    util.logDebug(`getVipStats() - Stats URI: ${uri}`);
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
          id: vipResource.destination,
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
        util.logError(`getVipStats() - Error retrieving vipResourceStats: ${err}`);
        reject(err);
      });
  });
};

/**
 * Fetches list of Pool Members attached to vipResource BIG-IP Services
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

      if (vipResource.poolReference.link.indexOf(PREFIX) === 0) {
        // PREFIX is exactly at the beginning
        cleanPath = vipResource.poolReference.link.slice(PREFIX.length).split('?').shift();
      }

      var query = '$select=name,selfLink';
      var path = `${cleanPath}/members`;
      util.logDebug(`getPoolResourceList() - Pool Members URI: ${path}`);
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

            util.logDebug(`getPoolResourceList() - Processing: ${index} of: ${(resp.body.items.length - 1)}`);

            if (index === (resp.body.items.length - 1)) {
              resolve(poolMemberListObj);
            }
          });
        })
        .catch((err) => {
          util.logError(`getPoolResourceList(): ${err}`);
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
      // Remove any trailing querystrings
      path = poolMemberResource.path.slice(PREFIX.length).split('?').shift();
    }

    var uri = `${path}/stats`;
    util.logDebug(`getPoolMemberStats() - Stats URI: ${uri}`);
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

        let poolMemberStats = {
          id: poolMemberResource.name,
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
        util.logError(`getPoolMemberStats(): ${err}`);
        reject(err);
      });
  });
};

/**
 * Fetches SSL stats
 *
 * @returns {Promise} Promise Object representing individual pool member stats
 */
BigStats.prototype.getSslStats = function (vipResource) {

  // 1. It gets the list off SSL profile names.
  // 2. It gets the profile names attached to each VIP.
  // 3. It compares the lists to find the SSL VIPs.
  return new Promise((resolve, reject) => {

    var servicePath;
    // Check if subPath is un use.
    if ('subPath' in vipResource) {
      // Merge 'tenant' name and 'subPath' name as '/' delimited string.
      servicePath = vipResource.partition + '/' + vipResource.subPath;
    } else {
      // 'subPath' is NOT used, use 'tenant' name on its own.
      servicePath = vipResource.partition;
    }

    Promise.all([this.getVipProfileList(vipResource), this.getSslProfileList()])
    .then((values) => {
      const vipProfileList = JSON.stringify(values[0]);
      let sslProfileList = [];
      values[1].map((element) => sslProfileList.push(element.name));
      util.logDebug(`### vipProfileList: ${vipProfileList}`);
      util.logDebug(`### sslProfileList: ${sslProfileList}`);
      // Compare a VIP's profile list with the 'client-ssl' profile list
      const match = values[1].filter(element => vipProfileList.includes(element.name));
      
      if (Object.keys(match).length === 0) {
        // This vipResource doesn't have a matching client-ssl profile
        const DO_NOTHING = `No SSL profiles associated with: ${servicePath} `;
        throw DO_NOTHING;
      }
      else {
        util.logDebug(`### Matched: SSL profile. Name: ${match[0].name}, FullPath: ${match[0].fullPath}`);
        return match[0].fullPath;
      }
    })
    .then((matchedSslProfileFullPath) => {
      util.logDebug(`### matchedSslProfileFullPath: ${matchedSslProfileFullPath}\n`);
      return this.getSslProfileStats(matchedSslProfileFullPath);
    })
    .then((sslProfileStats) => {
      util.logDebug(`### sslProfileStats: ${JSON.stringify(sslProfileStats)}`);
      resolve(sslProfileStats);
    })
    .catch((err) => {
      util.logError(`err: ${err}`);
    });
  });
};

/**
 * Fetches a VIP's profile list
 *
 * @returns {Promise} Promise Object representing individual pool member stats
 */
BigStats.prototype.getVipProfileList = function (vipResource) {

  return new Promise((resolve, reject) => {

    var slicedPath = '';
    var PREFIX = 'https://localhost';
    if (vipResource.selfLink.indexOf(PREFIX) === 0) {
      slicedPath = vipResource.selfLink.slice(PREFIX.length).split('?').shift();
    }
    var uri = slicedPath + '/profiles';
    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    this.restRequestSender.sendGet(restOp)
    .then((resp) => {
      let vip_profile_names = [];
      resp.body.items.map((item) => {
        vip_profile_names.push(item.name);
      });
      resolve(vip_profile_names);
    });
  });

};

/**
 * Fetches SSL profile list
 *
 * @returns {Promise} Promise Object representing individual pool member stats
 */
BigStats.prototype.getSslProfileList = function () {
  return new Promise((resolve, reject) => {

    var uri = '/mgmt/tm/ltm/profile/client-ssl';
    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    this.restRequestSender.sendGet(restOp)
    .then((resp) => {
      let ssl_profile_names = [];
      resp.body.items.map((item) => {
        ssl_profile_names.push({ name: item.name, fullPath: item.fullPath });
      });
      resolve(ssl_profile_names);
    });
  });
};

//       return this.getSslProfileStats(servicePath, matchedSslProfileName);
BigStats.prototype.getSslProfileStats = function (sslProfileFullPath) {

  return new Promise((resolve, reject) => {

    let fullPath = sslProfileFullPath.replace(/\//g, '~');
    var uri = `/mgmt/tm/ltm/profile/client-ssl/${fullPath}/stats`;
    var url = this.restHelper.makeRestnodedUri(uri);
    var restOp = this.createRestOperation(url);

    this.restRequestSender.sendGet(restOp)
    .then((resp) => {

      let path = `https://localhost/mgmt/tm/ltm/profile/client-ssl/${fullPath}/${fullPath}/stats`;
      let sslStats = {
        id: sslProfileFullPath,
        common_activeHandshakeRejected: resp.body.entries[path].nestedStats.entries['common.activeHandshakeRejected'].value,
        common_aggregateRenegotiationsRejected: resp.body.entries[path].nestedStats.entries['common.aggregateRenegotiationsRejected'].value,
        common_badRecords: resp.body.entries[path].nestedStats.entries['common.badRecords'].value,
        common_c3dUses_conns: resp.body.entries[path].nestedStats.entries['common.c3dUses.conns'].value,
        common_cipherUses_adhKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.adhKeyxchg'].value,
        common_cipherUses_aesBulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.aesBulk'].value,
        common_cipherUses_aesGcmBulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.aesGcmBulk'].value,
        common_cipherUses_camelliaBulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.camelliaBulk'].value,
        common_cipherUses_desBulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.desBulk'].value,
        common_cipherUses_dhRsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.dhRsaKeyxchg'].value,
        common_cipherUses_dheDssKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.dheDssKeyxchg'].value,
        common_cipherUses_ecdhEcdsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.ecdhEcdsaKeyxchg'].value,
        common_cipherUses_ecdhRsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.ecdhRsaKeyxchg'].value,
        common_cipherUses_ecdheEcdsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.ecdheEcdsaKeyxchg'].value,
        common_cipherUses_ecdheRsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.ecdheRsaKeyxchg'].value,
        common_cipherUses_edhRsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.edhRsaKeyxchg'].value,
        common_cipherUses_ideaBulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.ideaBulk'].value,
        common_cipherUses_md5Digest: resp.body.entries[path].nestedStats.entries['common.cipherUses.md5Digest'].value,
        common_cipherUses_nullBulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.nullBulk'].value,
        common_cipherUses_nullDigest: resp.body.entries[path].nestedStats.entries['common.cipherUses.nullDigest'].value,
        common_cipherUses_rc2Bulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.rc2Bulk'].value,
        common_cipherUses_rc4Bulk: resp.body.entries[path].nestedStats.entries['common.cipherUses.rc4Bulk'].value,
        common_cipherUses_rsaKeyxchg: resp.body.entries[path].nestedStats.entries['common.cipherUses.rsaKeyxchg'].value,
        common_cipherUses_shaDigest: resp.body.entries[path].nestedStats.entries['common.cipherUses.shaDigest'].value,
        common_connectionMirroring_haCtxRecv: resp.body.entries[path].nestedStats.entries['common.connectionMirroring.haCtxRecv'].value,
        common_connectionMirroring_haCtxSent: resp.body.entries[path].nestedStats.entries['common.connectionMirroring.haCtxSent'].value,
        common_connectionMirroring_haFailure: resp.body.entries[path].nestedStats.entries['common.connectionMirroring.haFailure'].value,
        common_connectionMirroring_haHsSuccess: resp.body.entries[path].nestedStats.entries['common.connectionMirroring.haHsSuccess'].value,
        common_connectionMirroring_haPeerReady: resp.body.entries[path].nestedStats.entries['common.connectionMirroring.haPeerReady'].value,
        common_connectionMirroring_haTimeout: resp.body.entries[path].nestedStats.entries['common.connectionMirroring.haTimeout'].value,
        common_curCompatConns: resp.body.entries[path].nestedStats.entries['common.curCompatConns'].value,
        common_curConns: resp.body.entries[path].nestedStats.entries['common.curConns'].value,
        common_curNativeConns: resp.body.entries[path].nestedStats.entries['common.curNativeConns'].value,
        common_currentActiveHandshakes: resp.body.entries[path].nestedStats.entries['common.currentActiveHandshakes'].value,
        common_decryptedBytesIn: resp.body.entries[path].nestedStats.entries['common.decryptedBytesIn'].value,
        common_decryptedBytesOut: resp.body.entries[path].nestedStats.entries['common.decryptedBytesOut'].value,
        common_dtlsTxPushbacks: resp.body.entries[path].nestedStats.entries['common.dtlsTxPushbacks'].value,
        common_encryptedBytesIn: resp.body.entries[path].nestedStats.entries['common.encryptedBytesIn'].value,
        common_encryptedBytesOut: resp.body.entries[path].nestedStats.entries['common.encryptedBytesOut'].value,
        common_extendedMasterSecrets: resp.body.entries[path].nestedStats.entries['common.extendedMasterSecrets'].value,
        common_fatalAlerts: resp.body.entries[path].nestedStats.entries['common.fatalAlerts'].value,
        common_fullyHwAcceleratedConns: resp.body.entries[path].nestedStats.entries['common.fullyHwAcceleratedConns'].value,
        common_fwdpUses_alertBypasses: resp.body.entries[path].nestedStats.entries['common.fwdpUses.alertBypasses'].value,
        common_fwdpUses_cachedCerts: resp.body.entries[path].nestedStats.entries['common.fwdpUses.cachedCerts'].value,
        common_fwdpUses_clicertFailBypasses: resp.body.entries[path].nestedStats.entries['common.fwdpUses.clicertFailBypasses'].value,
        common_fwdpUses_conns: resp.body.entries[path].nestedStats.entries['common.fwdpUses.conns'].value,
        common_fwdpUses_dipBypasses: resp.body.entries[path].nestedStats.entries['common.fwdpUses.dipBypasses'].value,
        common_fwdpUses_hnBypasses: resp.body.entries[path].nestedStats.entries['common.fwdpUses.hnBypasses'].value,
        common_fwdpUses_sipBypasses: resp.body.entries[path].nestedStats.entries['common.fwdpUses.sipBypasses'].value,
        common_handshakeFailures: resp.body.entries[path].nestedStats.entries['common.handshakeFailures'].value,
        common_insecureHandshakeAccepts: resp.body.entries[path].nestedStats.entries['common.insecureHandshakeAccepts'].value,
        common_insecureHandshakeRejects: resp.body.entries[path].nestedStats.entries['common.insecureHandshakeRejects'].value,
        common_insecureRenegotiationRejects: resp.body.entries[path].nestedStats.entries['common.insecureRenegotiationRejects'].value,
        common_maxCompatConns: resp.body.entries[path].nestedStats.entries['common.maxCompatConns'].value,
        common_maxConns: resp.body.entries[path].nestedStats.entries['common.maxConns'].value,
        common_maxNativeConns: resp.body.entries[path].nestedStats.entries['common.maxNativeConns'].value,
        common_midstreamRenegotiations: resp.body.entries[path].nestedStats.entries['common.midstreamRenegotiations'].value,
        common_nonHwAcceleratedConns: resp.body.entries[path].nestedStats.entries['common.nonHwAcceleratedConns'].value,
        common_ocspFwdpClientssl_cachedResp: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.cachedResp'].value,
        common_ocspFwdpClientssl_certStatusReq: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.certStatusReq'].value,
        common_ocspFwdpClientssl_invalidCertResp: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.invalidCertResp'].value,
        common_ocspFwdpClientssl_respstatusErrResp: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.respstatusErrResp'].value,
        common_ocspFwdpClientssl_revokedResp: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.revokedResp'].value,
        common_ocspFwdpClientssl_stapledResp: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.stapledResp'].value,
        common_ocspFwdpClientssl_unknownResp: resp.body.entries[path].nestedStats.entries['common.ocspFwdpClientssl.unknownResp'].value,
        common_partiallyHwAcceleratedConns: resp.body.entries[path].nestedStats.entries['common.partiallyHwAcceleratedConns'].value,
        common_peercertInvalid: resp.body.entries[path].nestedStats.entries['common.peercertInvalid'].value,
        common_peercertNone: resp.body.entries[path].nestedStats.entries['common.peercertNone'].value,
        common_peercertValid: resp.body.entries[path].nestedStats.entries['common.peercertValid'].value,
        common_prematureDisconnects: resp.body.entries[path].nestedStats.entries['common.prematureDisconnects'].value,
        common_protocolUses_dtlsv1: resp.body.entries[path].nestedStats.entries['common.protocolUses.dtlsv1'].value,
        common_protocolUses_sslv2: resp.body.entries[path].nestedStats.entries['common.protocolUses.sslv2'].value,
        common_protocolUses_sslv3: resp.body.entries[path].nestedStats.entries['common.protocolUses.sslv3'].value,
        common_protocolUses_tlsv1: resp.body.entries[path].nestedStats.entries['common.protocolUses.tlsv1'].value,
        common_protocolUses_tlsv1_1: resp.body.entries[path].nestedStats.entries['common.protocolUses.tlsv1_1'].value,
        common_protocolUses_tlsv1_2: resp.body.entries[path].nestedStats.entries['common.protocolUses.tlsv1_2'].value,
        common_recordsIn: resp.body.entries[path].nestedStats.entries['common.recordsIn'].value,
        common_recordsOut: resp.body.entries[path].nestedStats.entries['common.recordsOut'].value,
        common_renegotiationsRejected: resp.body.entries[path].nestedStats.entries['common.renegotiationsRejected'].value,
        common_secureHandshakes: resp.body.entries[path].nestedStats.entries['common.secureHandshakes'].value,
        common_sessCacheCurEntries: resp.body.entries[path].nestedStats.entries['common.sessCacheCurEntries'].value,
        common_sessCacheHits: resp.body.entries[path].nestedStats.entries['common.sessCacheHits'].value,
        common_sessCacheInvalidations: resp.body.entries[path].nestedStats.entries['common.sessCacheInvalidations'].value,
        common_sessCacheLookups: resp.body.entries[path].nestedStats.entries['common.sessCacheLookups'].value,
        common_sessCacheOverflows: resp.body.entries[path].nestedStats.entries['common.sessCacheOverflows'].value,
        common_sessionMirroring_failure: resp.body.entries[path].nestedStats.entries['common.sessionMirroring.failure'].value,
        common_sessionMirroring_success: resp.body.entries[path].nestedStats.entries['common.sessionMirroring.success'].value,
        common_sesstickUses_reuseFailed: resp.body.entries[path].nestedStats.entries['common.sesstickUses.reuseFailed'].value,
        common_sesstickUses_reused: resp.body.entries[path].nestedStats.entries['common.sesstickUses.reused'].value,
        common_sniRejects: resp.body.entries[path].nestedStats.entries['common.sniRejects'].value,
        common_totCompatConns: resp.body.entries[path].nestedStats.entries['common.totCompatConns'].value,
        common_totNativeConns: resp.body.entries[path].nestedStats.entries['common.totNativeConns'].value,
        dynamicRecord_x1: resp.body.entries[path].nestedStats.entries['dynamicRecord.x1'].value,
        dynamicRecord_x10: resp.body.entries[path].nestedStats.entries['dynamicRecord.x10'].value,
        dynamicRecord_x11: resp.body.entries[path].nestedStats.entries['dynamicRecord.x11'].value,
        dynamicRecord_x12: resp.body.entries[path].nestedStats.entries['dynamicRecord.x12'].value,
        dynamicRecord_x13: resp.body.entries[path].nestedStats.entries['dynamicRecord.x13'].value,
        dynamicRecord_x14: resp.body.entries[path].nestedStats.entries['dynamicRecord.x14'].value,
        dynamicRecord_x15: resp.body.entries[path].nestedStats.entries['dynamicRecord.x15'].value,
        dynamicRecord_x16: resp.body.entries[path].nestedStats.entries['dynamicRecord.x16'].value,
        dynamicRecord_x2: resp.body.entries[path].nestedStats.entries['dynamicRecord.x2'].value,
        dynamicRecord_x3: resp.body.entries[path].nestedStats.entries['dynamicRecord.x3'].value,
        dynamicRecord_x4: resp.body.entries[path].nestedStats.entries['dynamicRecord.x4'].value,
        dynamicRecord_x5: resp.body.entries[path].nestedStats.entries['dynamicRecord.x5'].value,
        dynamicRecord_x6: resp.body.entries[path].nestedStats.entries['dynamicRecord.x6'].value,
        dynamicRecord_x7: resp.body.entries[path].nestedStats.entries['dynamicRecord.x7'].value,
        dynamicRecord_x8: resp.body.entries[path].nestedStats.entries['dynamicRecord.x8'].value,
        dynamicRecord_x9: resp.body.entries[path].nestedStats.entries['dynamicRecord.x9'].value,
      };

      resolve(sslStats);
    });
  });
};

/**
 * Push the stats object to the desired destinations
 *
 * @param {Object} statsObj representing the collected statistics
 */
// Push stats to a remote destination
BigStats.prototype.exportStats = function (statsObj) {
  var data = { config: this.config, stats: statsObj };

  util.logDebug(`exportStats() w/:  ${JSON.stringify(data, '', '\t')}`);

  var uri = '/mgmt/shared/bigstats_exporter';
  var url = this.restHelper.makeRestnodedUri(uri);
  var restOp = this.createRestOperation(url, data);

  this.restRequestSender.sendPost(restOp)
    .then((resp) => {
      util.logDebug(`exportStats() response: ${JSON.stringify(resp.body)}`);
    })
    .catch((err) => {
      util.logError(`exportStats() err: ${err}`);
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
