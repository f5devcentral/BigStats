/*
*   BigStatsExporter:
*     iControl LX Stats Exporter for BIG-IP 
*
*   N. Pearce, June 2018
*   http://github.com/npearce
*
*/
'use strict';

const logger = require('f5-logger').getInstance();
var StatsD = require('node-statsd');
var kafka = require('kafka-node');
var Producer = kafka.Producer;

var DEBUG = false;

function BigStatsExporter() {
  this.data = {};
}

BigStatsExporter.prototype.WORKER_URI_PATH = "shared/bigstats_exporter";
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
    DEBUG = true;
  }

  if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - onPost receved data: ' +JSON.stringify(this.data)); }

  var protocol = this.data.config.destination.protocol;

  switch (protocol) {
    case 'http':
    case 'https':
      this.httpExporter(this.data);
      break;

    case 'statsd':
      this.statsdExporter(this.data);
      break;

    case 'kafka':
      this.kafkaExporter(this.data);
      break;

    default:
      if (DEBUG === true) { logger.info(`[BigStatsExporter - DEBUG] - polling mode enabled. Fetch stats with: \'GET /mgmt/${BigStatsExporter.prototype.WORKER_URI_PATH}\'`); }

  }

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
      http = require("https");
    }
    else {
      http = require("http");
    }

    var options = {
      "method": "POST",
      "hostname": dest.address,
      "port": dest.port,
      "path": dest.uri,
      "headers": {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    };
    
    var req = http.request(options, function (res) {
  
      var chunks = [];
    
      res.on('data', ((chunk) => {
        chunks.push(chunk);
      }));
    
      res.on('end', (() => {
        var body = Buffer.concat(chunks);
        logger.info('[BigStatsExporter - DEBUG] - httpExporter() resp: ' +body.toString());
        if (data.config.debug === true) { logger.info('[BigStatsExporter - DEBUG] - httpExporter() resp: ' +body.toString()); }
      }));
  
    });
    
    req.write(JSON.stringify(data.stats));
  
    req.on('error', ((err) => {
      logger.info('[BigStatsExporter] - ***************error pushing stats: ' +err);
    }));

    req.on('uncaughtException', ((err) => {
      logger.info('[BigStatsExporter] - ***************uncaughtException pushing stats: ' +err);
    }));
  
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
  
        if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd: Device Mtric Category: ' +level1); }
  
        Object.keys(deviceData[level1]).map((level2) => {
  
          if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd: Device Metric Sub-Category: ' +level1+ '.' +level2); }
  
          let namespace = data.config.hostname+'.device.'+level1+'.'+level2;
          let value = deviceData[level1][level2];
  
          if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd - Device Sub-Category Stats: ' +namespace+ ' value: ' +value); }
          sdc.gauge(namespace, value);
  
        });
  
    });

    // Export services data
    Object.keys(servicesData).map((level1) => {
  
        var l1 = this.replaceDotsSlashesColons(level1);
  
        if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd: Administrative Partition: ' +l1); }
  
        Object.keys(servicesData[level1]).map((level2) => {
  
          var l2 = this.replaceDotsSlashesColons(level2);
  
          if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd - Virtual Server: ' +l1+'.'+l2); }
  
          Object.keys(servicesData[level1][level2]).map((level3) => {
  
            var l3 = this.replaceDotsSlashesColons(level3);
  
            // If the value is a number, send it to statsd.
            if (typeof servicesData[level1][level2][level3] === 'number') {
    
              let namespace = data.config.hostname+'.services.'+l1+'.'+l2+'.'+l3;
              let value = servicesData[level1][level2][level3];
    
              if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd - Virtual Server Stats: ' +namespace+ ' value: ' +value); }
              sdc.gauge(namespace, value);
  
            }
  
            // If the value is an object, process the child object..
            else if (typeof servicesData[level1][level2][level3] === 'object') {
  
              if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd: Pool: ' +l3); }
  
              Object.keys(servicesData[level1][level2][level3]).map((level4) => {
    
                Object.keys(servicesData[level1][level2][level3][level4]).map((level5) => {
    
                  var l5 = this.replaceDotsSlashesColons(level5);
                  if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd: Pool Member: ' +l5); }
    
                  Object.keys(servicesData[level1][level2][level3][level4][level5]).map((level6) => {
  
                    var l6 = this.replaceDotsSlashesColons(level6);
    
                    let namespace = data.config.hostname+'.services.'+l1+'.'+l2+'.'+l3+'.'+l5+'.'+l6;
                    let value = servicesData[level1][level2][level3][level4][level5][level6];
                  
                    if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - exportStats() - statsd - Pool Member Stats: ' +namespace+ ' value: ' +value); }
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
  
    var client = new kafka.KafkaClient ( 
      {
        kafkaHost: data.config.destination.address+':'+data.config.destination.port
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
  
          if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - Kafka producer response: ' +JSON.stringify(resp)); }
          if (err) { logger.info('[BigStatsExporter - ERROR] - Kafka producer response:' +err); }
  
        });
  
      });
  
    }
    else if (typeof data.config.destination.kafka === 'undefined' || data.config.destination.kafka.topic === 'partition') {
  
      var that = this;
      var stats = data.stats[hostname];
      var message;
      var safeTopic;
          
      producer.on('ready', function () {
  
        Object.keys(stats).map((level1) => {
  
          // Build 'device' stats message and send
          if (level1 === 'device') {
  
            safeTopic = hostname+ '-device_stats';
  
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
  
            if (DEBUG === true) {
              logger.info('[BigStatsExporter - DEBUG] - exportStats() - kafka: topic: ' +safeTopic);
              logger.info('[BigStatsExporter - DEBUG] - exportStats() - kafka: message: ' +JSON.stringify(message));
            }

            producer.send(payload, function (err, resp) {
    
              if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - Kafka producer response: ' +JSON.stringify(resp)); }
              if (err) { logger.info('[BigStatsExporter - ERROR] - Kafka producer response:' +err); }
    
            });

          }
          // Iterate through 'services' building service messages and sending.
          else {
    
            Object.keys(stats[level1]).map((level2) => {
      
              let safePartitionName = that.replaceDotsSlashesColons(level2);
              safeTopic = hostname+'-'+safePartitionName;
    
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
  
              if (DEBUG === true) {
                logger.info('[BigStatsExporter - DEBUG] - exportStats() - kafka: topic: ' +safeTopic);
                logger.info('[BigStatsExporter - DEBUG] - exportStats() - kafka: message: ' +JSON.stringify(message));
              }

              producer.send(payload, function (err, resp) {
      
                if (DEBUG === true) { logger.info('[BigStatsExporter - DEBUG] - Kafka producer response: ' +JSON.stringify(resp)); }
                if (err) { logger.info('[BigStatsExporter - ERROR] - Kafka producer response:' +err); }

              });
            });
          }
  
        });
      });
  
    }

    producer.on('error', function (err) {
        logger.info('Kafka Producer error: ' +err);
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

    let str_noDots = notReplaced.replace(/\./g, '-');
    let str_noSlashes = str_noDots.replace(/\//g, '-');
    let str_noColon = str_noSlashes.replace(/\:/g, '_');
  
    return str_noColon;
  
};

module.exports = BigStatsExporter;