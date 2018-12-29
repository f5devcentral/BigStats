/*
*   BigStatsExporter:
*     iControl LX Stats Exporter for BIG-IP
*
*   N. Pearce, June 2018
*   http://github.com/npearce
*
*/
'use strict';

const StatsD = require('node-statsd');
const kafka = require('kafka-node');
const util = require('./util');
const Producer = kafka.Producer;

function BigStatsExporter () {
  util.init('BigStatsExporter');
  util.debugEnabled = false;
  this.data = {};
}

BigStatsExporter.prototype.WORKER_URI_PATH = 'shared/bigstats_exporter';
BigStatsExporter.prototype.isPublic = true;
BigStatsExporter.prototype.isSingleton = true;

/**
 * handle HTTP GET request
 */
BigStatsExporter.prototype.onGet = function (restOperation) {
  restOperation.setBody(this.data.stats);
  this.completeRestOperation(restOperation);
};

/**
 * handle HTTP POST request
 */
BigStatsExporter.prototype.onPost = function (restOperation) {
  this.data = restOperation.getBody();
  if (this.data.config.debug === true) {
    util.debugEnabled = true;
  }

  util.logDebug(`onPost received data: ${this.data}`);

  const protocol = this.data.config.destination.protocol;

  switch (protocol) {
    // If the destination is 'http' OR 'https'
    case 'http':
    case 'https':
      this.httpExporter(this.data);
      break;
    // If the destination is StatsD
    case 'statsd':
      this.statsdExporter(this.data);
      break;
    // If the destination is an Apache Kafka Broker
    case 'kafka':
      this.kafkaExporter(this.data);
      break;
    default:
      util.logDebug(`polling mode enabled. Fetch stats with: 'GET /mgmt/${BigStatsExporter.prototype.WORKER_URI_PATH}'`);
  }

  // Acknowledge the Scheduler Task
  this.completeRestOperation(restOperation);
};

/**
* Exports data to http/https destinations
*
* @param {Object} data to be exported
*
*/
BigStatsExporter.prototype.httpExporter = function (data) {
  var dest = data.config.destination;
  var http;

  if (dest.protocol === 'https') {
    http = require('https');
  } else {
    http = require('http');
  }

  var options = {
    'method': 'POST',
    'hostname': dest.address,
    'port': dest.port,
    'path': dest.uri,
    'headers': {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  };

  var req = http.request(options, function (res) {
    var chunks = [];

    res.on('data', (chunk) => {
      chunks.push(chunk);
    });

    res.on('end', () => {
      var body = Buffer.concat(chunks);
      util.logDebug(`httpExporter() resp: ${body.toString()}`);
    });
  });

  req.write(JSON.stringify(data.stats));

  req.on('error', (err) => {
    util.logError(`***************error pushing stats: ${err}`);
  });

  req.on('uncaughtException', (err) => {
    util.logError(`***************uncaughtException pushing stats: ${err}`);
  });

  req.end();
};

/**
 * Exports data to StatsD destinations
 *
 * @param {String} data to be exported
 *
 */
BigStatsExporter.prototype.statsdExporter = function (data) {
  var sdc = new StatsD(data.config.destination.address, data.config.destination.port);
  var servicesData = data.stats.device.tenants;
  var deviceData = data.stats.device.global;

  // Export device memory data
  Object.keys(deviceData.memory).map((metric) => {
    util.logDebug(`exportStats() - statsd: Device Memory Topic: ${metric}`);
    let namespace = `device.${data.config.hostname}.global.memory.${metric}`;
    let value = deviceData.memory[metric];
    util.logDebug(`exportStats() - statsd - Device Memory Metric: ${namespace} value: ${value}`);
    sdc.gauge(namespace, value);
  });

  // Export device cpu data
  Object.keys(deviceData.cpus).map((cpuIdx) => {
    util.logDebug(`exportStats() - statsd: CPU: ${cpuIdx}`);
    Object.keys(deviceData.cpus[cpuIdx]).map((metric) => {
      if (metric !== 'id') {
        let namespace = `device.${data.config.hostname}.global.cpus.${deviceData.cpus[cpuIdx].id}.${metric}`;
        let value = deviceData.cpus[cpuIdx][metric];
        util.logDebug(`exportStats() - statsd - Device CPU Metric: ${namespace} value: ${value}`);
        sdc.gauge(namespace, value);
      }
    });
  });

  // Export services data
  Object.keys(servicesData).map((tenantIdx) => {
    util.logDebug(`exportStats() - Tenant Index: ${tenantIdx}, Tenant Id: ${servicesData[tenantIdx].id}`);
    Object.keys(servicesData[tenantIdx].services).map((serviceIdx) => {
      let tenantId = this.replaceDotsSlashesColons(servicesData[tenantIdx].id);
      let serviceId = this.replaceDotsSlashesColons(servicesData[tenantIdx].services[serviceIdx].id);
      util.logDebug(`exportStats() - Service Index: ${serviceIdx}, Service Id: ${servicesData[tenantIdx].services[serviceIdx].id}`);
      Object.keys(servicesData[tenantIdx].services[serviceIdx]).map((metric) => {
        if (metric !== 'id' && metric !== 'pool' && metric !== 'ssl') {
          util.logDebug(`exportStats() - statsd: Service: ${servicesData[tenantIdx].services[serviceIdx].id} - ${metric} = ${servicesData[tenantIdx].services[serviceIdx][metric]}`);
          let namespace = `device.${data.config.hostname}.tenant.${tenantId}.services.${serviceId}.${metric}`;
          let value = servicesData[tenantIdx].services[serviceIdx][metric];
          util.logDebug(`exportStats() - statsd - Service '${servicesData[tenantIdx].id}' Metric: ${namespace} value: ${value}`);
          sdc.gauge(namespace, value);
        } else if (metric === 'pool') {
          util.logDebug(`servicesData[tenantIdx].services[serviceIdx].pool.id: ${servicesData[tenantIdx].services[serviceIdx].pool.id}`);
          Object.keys(servicesData[tenantIdx].services[serviceIdx].pool.members).map((memberIdx) => {
            Object.keys(servicesData[tenantIdx].services[serviceIdx].pool.members[memberIdx]).map((metric) => {
              if (metric !== 'id') {
                let poolId = this.replaceDotsSlashesColons(servicesData[tenantIdx].services[serviceIdx].pool.id);
                let poolMemberId = this.replaceDotsSlashesColons(servicesData[tenantIdx].services[serviceIdx].pool.members[memberIdx].id);
                util.logDebug(`pool member: ${poolMemberId} - metric: ${metric} = ${servicesData[tenantIdx].services[serviceIdx].pool.members[memberIdx][metric]}`);
                let namespace = `device.${data.config.hostname}.tenant.${tenantId}.services.${serviceId}.pool.${poolId}.members.${poolMemberId}.${metric}`;
                let value = servicesData[tenantIdx].services[serviceIdx].pool.members[memberIdx][metric];
                sdc.gauge(namespace, value);
              }
            });
          });
        } else if (metric === 'ssl') {
          util.logDebug(`servicesData[tenantIdx].services[serviceIdx].ssl.id: ${servicesData[tenantIdx].services[serviceIdx].ssl.id}`);
          Object.keys(servicesData[tenantIdx].services[serviceIdx].ssl).map((metric) => {
            if (metric !== 'id') {
              let sslId = this.replaceDotsSlashesColons(servicesData[tenantIdx].services[serviceIdx].ssl.id);
              util.logDebug(`ssl metric: ${sslId} - metric: ${metric} = ${servicesData[tenantIdx].services[serviceIdx].ssl[metric]}`);
              let namespace = `device.${data.config.hostname}.tenant.${tenantId}.services.${serviceId}.ssl.${sslId}.${metric}`;
              let value = servicesData[tenantIdx].services[serviceIdx].ssl[metric];
              sdc.gauge(namespace, value);
            }
          });
        }
      });
    });
  });

/*
    var l1 = this.replaceDotsSlashesColons(level1);

    Object.keys(servicesData[level1]).map((level2) => {
      var l2 = this.replaceDotsSlashesColons(level2);

      util.logDebug(`exportStats() - statsd - Virtual Server: ${l1}.${l2}`);

      Object.keys(servicesData[level1][level2]).map((level3) => {
        var l3 = this.replaceDotsSlashesColons(level3);

        // If the value is a number, send it to statsd.
        if (typeof servicesData[level1][level2][level3] === 'number') {
          let namespace = `${data.config.hostname}.services.${l1}.${l2}.${l3}`;
          let value = servicesData[level1][level2][level3];

          util.logDebug(`exportStats() - statsd - Virtual Server Stats: ${namespace} value: ${value}`);
          sdc.gauge(namespace, value);
        } else if (typeof servicesData[level1][level2][level3] === 'object') {
          // If the value is an object, process the child object...
          util.logDebug(`exportStats() - statsd: Pool: ${l3}`);

          Object.keys(servicesData[level1][level2][level3]).map((level4) => {
            Object.keys(servicesData[level1][level2][level3][level4]).map((level5) => {
              var l5 = this.replaceDotsSlashesColons(level5);
              util.logDebug(`exportStats() - statsd: Pool Member: ${l5}`);

              Object.keys(servicesData[level1][level2][level3][level4][level5]).map((level6) => {
                var l6 = this.replaceDotsSlashesColons(level6);

                let namespace = `${data.config.hostname}.services.${l1}.${l2}.${l3}.${l5}.${l6}`;
                let value = servicesData[level1][level2][level3][level4][level5][level6];

                util.logDebug(`exportStats() - statsd - Pool Member Stats: ${namespace} value: ${value}`);
                sdc.gauge(namespace, value);
              });
            });
          });
        }
      });
    });
  });
  */
};

/**
 * Exports data to Apache Kafka Broker destinations
 *
 * @param {Object} statsObj to be exported
 *
 */
BigStatsExporter.prototype.kafkaExporter = function (data) {
  var hostname = data.config.hostname;

  var client = new kafka.KafkaClient(
    {
      kafkaHost: `${data.config.destination.address}:${data.config.destination.port}`
    }
  );

  var producer = new Producer(client);

  if (typeof data.config.destination.kafka === 'undefined' || data.config.destination.kafka.topic === 'all') {
    producer.on('ready', function () {
      var payload = [
        {
          topic: hostname,
          messages: JSON.stringify(data.stats)
        }
      ];

      producer.send(payload, function (err, resp) {
        util.logDebug(`Kafka producer response: ${JSON.stringify(resp)}`);
        if (err) { util.logError(`Kafka producer response: ${err}`); }
      });
    });
  } else if (typeof data.config.destination.kafka === 'undefined' || data.config.destination.kafka.topic === 'partition') {
    const stats = data.stats[hostname];
    let message;
    let safeTopic;

    producer.on('ready', function () {
      Object.keys(stats).map((level1) => {
        // Build 'device' stats message and send
        if (level1 === 'device') {
          safeTopic = `${hostname}-device_stats`;
          message = {
            [hostname]: {
              device: stats[level1]
            }
          };

          var payload = [
            {
              topic: safeTopic,
              messages: JSON.stringify(message)
            }
          ];

          util.logDebug(`exportStats() - kafka: topic: ${safeTopic}`);
          util.logDebug(`exportStats() - kafka: message: ${JSON.stringify(message)}`);

          producer.send(payload, function (err, resp) {
            util.logDebug(`Kafka producer response: ${JSON.stringify(resp)}`);
            if (err) { util.logError(`Kafka producer response: ${err}`); }
          });
        } else { // Iterate through 'services' building service messages and sending.
          Object.keys(stats[level1]).map((level2) => {
            let safePartitionName = this.replaceDotsSlashesColons(level2);
            safeTopic = hostname + '-' + safePartitionName;

            // Ready the stats for topic-based export - Apply stats prefix: 'hostname.services.data[level1]'

            message = {
              [hostname]: {
                service: stats[level1][level2]
              }
            };

            var payload = [
              {
                topic: safeTopic,
                messages: JSON.stringify(message)
              }
            ];

            util.logDebug(`exportStats() - kafka: topic: ${safeTopic}`);
            util.logDebug(`exportStats() - kafka: message: ${JSON.stringify(message)}`);

            producer.send(payload, function (err, resp) {
              util.logDebug(`Kafka producer response: ${JSON.stringify(resp)}`);
              if (err) { util.logError(`Kafka producer response: ${err}`); }
            });
          });
        }
      });
    });
  }

  producer.on('error', function (err) {
    util.logInfo('Kafka Producer error: ' + err);
  });
};

/**
 * Escapes Slashes and Colons
 *
 * @param {String} notReplaced string that needs
 *
 * @returns {String} without slashes or colons
 */
BigStatsExporter.prototype.replaceDotsSlashesColons = function (notReplaced) {
  return notReplaced.replace(/[.|/|:]/g, '-');
};

module.exports = BigStatsExporter;
