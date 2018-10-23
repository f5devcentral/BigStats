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
const kafka = require('kafka-node'); // FIXME: this is causing errors
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
  util.logInfo('\n\n\n**************************\n\n[BigStatsExporter] got some data.....\n\n**************************\n\n');
  this.data = restOperation.getBody();
  if (this.data.config.debug === true) {
    util.debugEnabled = true;
  }

  util.logDebug('onPost received data: ' + this.data);

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
  var servicesData = data.stats[data.config.hostname].services;
  var deviceData = data.stats[data.config.hostname].device;

  // Export device data
  Object.keys(deviceData).map((level1) => {
    util.logDebug('exportStats() - statsd: Device Metric Category: ' + level1);

    Object.keys(deviceData[level1]).map((level2) => {
      util.logDebug('exportStats() - statsd: Device Metric Sub-Category: ' + level1 + '.' + level2);

      let namespace = data.config.hostname + '.device.' + level1 + '.' + level2;
      let value = deviceData[level1][level2];

      util.logDebug('exportStats() - statsd - Device Sub-Category Stats: ' + namespace + ' value: ' + value);
      sdc.gauge(namespace, value);
    });
  });

  // Export services data
  Object.keys(servicesData).map((level1) => {
    var l1 = this.replaceDotsSlashesColons(level1);

    util.logDebug('exportStats() - statsd: Administrative Partition: ' + l1);

    Object.keys(servicesData[level1]).map((level2) => {
      var l2 = this.replaceDotsSlashesColons(level2);

      util.logDebug('exportStats() - statsd - Virtual Server: ' + l1 + '.' + l2);

      Object.keys(servicesData[level1][level2]).map((level3) => {
        var l3 = this.replaceDotsSlashesColons(level3);

        // If the value is a number, send it to statsd.
        if (typeof servicesData[level1][level2][level3] === 'number') {
          let namespace = data.config.hostname + '.services.' + l1 + '.' + l2 + '.' + l3;
          let value = servicesData[level1][level2][level3];

          util.logDebug('exportStats() - statsd - Virtual Server Stats: ' + namespace + ' value: ' + value);
          sdc.gauge(namespace, value);
        } else if (typeof servicesData[level1][level2][level3] === 'object') {
          // If the value is an object, process the child object...
          util.logDebug('exportStats() - statsd: Pool: ' + l3);

          Object.keys(servicesData[level1][level2][level3]).map((level4) => {
            Object.keys(servicesData[level1][level2][level3][level4]).map((level5) => {
              var l5 = this.replaceDotsSlashesColons(level5);
              util.logDebug('exportStats() - statsd: Pool Member: ' + l5);

              Object.keys(servicesData[level1][level2][level3][level4][level5]).map((level6) => {
                var l6 = this.replaceDotsSlashesColons(level6);

                let namespace = data.config.hostname + '.services.' + l1 + '.' + l2 + '.' + l3 + '.' + l5 + '.' + l6;
                let value = servicesData[level1][level2][level3][level4][level5][level6];

                util.logDebug('exportStats() - statsd - Pool Member Stats: ' + namespace + ' value: ' + value);
                sdc.gauge(namespace, value);
              });
            });
          });
        }
      });
    });
  });
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
      kafkaHost: data.config.destination.address + ':' + data.config.destination.port
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
          safeTopic = hostname + '-device_stats';

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

          util.logDebug('exportStats() - kafka: topic: ' + safeTopic);
          util.logDebug('exportStats() - kafka: message: ' + JSON.stringify(message));

          producer.send(payload, function (err, resp) {
            util.logDebug('Kafka producer response: ' + JSON.stringify(resp));
            if (err) { util.logError('Kafka producer response:' + err); }
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
