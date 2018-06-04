
//Push stats to a remote destination
BigStats.prototype.statsExporter = function (body) {

    //If the destination is 'http' or 'https'
    if (typeof this.config.destination.proto !== 'undefined' && this.config.destination.proto.startsWith('http')) {
  
      var http;
  
      if (this.config.destination.proto === 'https') {
        http = require("https");
      }
      else {
        http = require("http");
      }
    
      var options = {
        "method": "POST",
        "hostname": this.config.destination.address,
        "port": this.config.destination.port,
        "path": this.config.destination.uri,
        "headers": {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      };
      
      var req = http.request(options, function (res) {
        var chunks = [];
      
        res.on('data', function (chunk) {
          chunks.push(chunk);
        });
      
        res.on('end', function () {
          var body = Buffer.concat(chunks);
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter(): ' +body.toString()); }
        });
    
      });
      
      req.write(JSON.stringify(body));
      req.on('error', ((error) => {
        logger.info('[BigStats] - ***************Error pushing stats): ' +error);
      }));
      req.end();
    }
  
    //If the proto is statsd
    else if (typeof this.config.destination.proto !== 'undefined' && this.config.destination.proto === "statsd") {
  
      //we're using the statsd client
      var sdc = new StatsD(this.config.destination.address, 8125);
  
      Object.keys(body).map((level1) => {
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter() - statsd: level1: ' +level1); }
        Object.keys(body[level1]).map((level2) => {
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter() - statsd - level1+2: ' +level1+'.'+level2); }
          Object.keys(body[level1][level2]).map((level3) => {
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter() - statsd - level1+2+3: ' +level1+'.'+level2+'.'+level3); }
  
            let namespace = level1+'.'+level2+'.'+level3;
            let value = body[level1][level2][level3];
  
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter() - statsd - namespace: ' +namespace+ ' value: ' +value); }
            sdc.gauge(namespace, value);
  
          });
        });      
      });
  
    } 
    
    else if (typeof this.config.destination.proto !== 'undefined' && this.config.destination.proto === "kafka") {
  
      const client = new kafka.KafkaClient ( 
        {
          kafkaHost: this.config.destination.address+':'+this.config.destination.port
        } 
      );
      var producer = new Producer(client);
  
      producer.on('ready', function () {
  
        Object.keys(body).map((level1) => {
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter() - kafka: topic: ' +level1); }
          if (DEBUG === true) { logger.info('[BigStats - DEBUG] - statsExporter() - kafka: message: ' +JSON.stringify(body[level1])); }
  
          var payload = [
                  { topic: level1, messages: JSON.stringify(body[level1]) }
          ];
          producer.send(payload, function (err, data) {
            if (DEBUG === true) { logger.info('kafka producer response: ' +JSON.stringify(data)); }
          });
        });
                      
      });
  
      producer.on('error', function (err) {
        logger.info('Kafka Producer error: ' +err);
      });
  
    }
    else {
      logger.info('[BigStats] - Unrecognized \'proto\'');
    }
  
};

module.exports = BigStats;