'use strict';

var proxyquire = require('proxyquire').noCallThru();

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();

const EventEmitter = require('events').EventEmitter;
const http = require('http');
const https = require('https');
const kafka = require('kafka-node');
const util = require('./util-fake');

let moduleUnderTest = '../../SRC/BigStats/nodejs/bigstats-exporter';
let utilStub;
let httpStub;
let httpsStub;
let StatsD;
let kafkaStub;
let producerStub;
let gaugeStub;
let requestStub;
let bigStatsExporter;
let httpPost;
let testProtocol;
let completeRestOperationStub;

const producer = function () { return { on: function () { }, send: function () { } }; };

function convertStatsToExportFormat (stats, config) {
  return {
    config: config,
    stats: stats
  };
}

describe('BigStatsExporter', function () {
  // runs before all tests in this block
  beforeEach(function (done) {
    requestStub = sinon.stub();
    requestStub.write = sinon.stub();
    requestStub.on = sinon.stub();
    requestStub.end = sinon.stub();

    httpStub = sinon.stub(http);
    httpStub.request = function () { return requestStub; };

    httpsStub = sinon.stub(https);
    httpsStub.request = function () { return requestStub; };

    utilStub = sinon.createStubInstance(util);

    const BigStatsExporter = proxyquire(moduleUnderTest,
      {
        './util': utilStub
      });

    bigStatsExporter = new BigStatsExporter();

    httpPost = {
      getBody: function () {
        return {
          config: {
            destination: {
              protocol: testProtocol,
              address: '127.0.0.1',
              port: 8080,
              kafka: {
                topic: 'all'
              }
            },
            hostname: 'hostname'
          },
          stats: {
            device: {
              tenants: [
                { 
                  id: 'tenant1',
                  services: [
                    {
                      id: 'service1'
                    }
                  ]
                }
              ],
              global: {
                memory: 'device1',
                cpus: [
                  { cpu0: 'cpu0'}
                ]
              }
            }
          }
        };
      },
      setBody: function () { }
    };

    done();
  });

  afterEach(function (done) {
    // reset stub behavior and history
    sinon.restore();
    // delete cached json test files that were imported using 'require'
    Object.keys(require.cache).forEach(function (key) {
      if (key.endsWith('.json')) {
        delete require.cache[key];
      }
    });
    done();
  });

  describe('replaceDotsSlashesColons', function () {
    it('should replace . / : with -', function () {
      const input = 'https://support.f5.com:80/kb/en-us/products/big-ip_apm/manuals/product/apm-visual-policy-editor-13-1-0/3.html#guid-bb209ab6-68ab-4bf0-9c82-ac5e767f5816';
      bigStatsExporter.replaceDotsSlashesColons(input).should.be.equal('https---support-f5-com-80-kb-en-us-products-big-ip_apm-manuals-product-apm-visual-policy-editor-13-1-0-3-html#guid-bb209ab6-68ab-4bf0-9c82-ac5e767f5816');
    });
  });

  describe('onPost', function () {
    describe('http/s exporter dispatch', function () {
      beforeEach(function (done) {
        const BigStatsExporter = proxyquire(moduleUnderTest,
          {
            './util': utilStub,
            'http': httpStub,
            'https': httpsStub
          });

        bigStatsExporter = new BigStatsExporter();

        bigStatsExporter.completeRestOperation = function () { };
        completeRestOperationStub = sinon.stub(bigStatsExporter, 'completeRestOperation');

        done();
      });

      it('should call httpExporter when called with protocol "http"', function () {
        testProtocol = 'http';
        bigStatsExporter.onPost(httpPost);
        sinon.assert.calledOnce(completeRestOperationStub);
      });

      it('should call httpExporter when called with protocol "https"', function () {
        testProtocol = 'https';
        bigStatsExporter.onPost(httpPost);
        sinon.assert.calledOnce(completeRestOperationStub);
      });

      afterEach(function (done) {
        sinon.assert.calledWith(utilStub.logDebug, 'onPost received data: ' + httpPost.getBody());
        done();
      });
    });

    describe('statsd exporter dispatch', function () {
      // runs before all tests in this block
      beforeEach(function (done) {
        StatsD = sinon.stub();
        gaugeStub = sinon.stub();
        StatsD.prototype.gauge = gaugeStub;

        const BigStatsExporter = proxyquire(moduleUnderTest,
          {
            './util': utilStub,
            'node-statsd': StatsD
          });

        bigStatsExporter = new BigStatsExporter();

        bigStatsExporter.completeRestOperation = function () { };
        completeRestOperationStub = sinon.stub(bigStatsExporter, 'completeRestOperation');

        testProtocol = 'statsd';
        done();
      });

      it('should call statsdExporter when called with protocol "statsd"', function () {
        bigStatsExporter.onPost(httpPost);
        sinon.assert.calledOnce(completeRestOperationStub);
      });
    });

    describe('kafka exporter dispatch', function () {
      // runs before all tests in this block
      beforeEach(function (done) {
        kafkaStub = sinon.stub(kafka);
        producerStub = sinon.spy(producer);
        kafkaStub.Producer = producerStub;

        const BigStatsExporter = proxyquire(moduleUnderTest,
          {
            './util': utilStub,
            'kafka-node': kafkaStub
          });

        bigStatsExporter = new BigStatsExporter();

        bigStatsExporter.completeRestOperation = function () { };
        completeRestOperationStub = sinon.stub(bigStatsExporter, 'completeRestOperation');

        testProtocol = 'kafka';
        done();
      });

      it('should call kafkaExporter when called with protocol "kafka"', function () {
        bigStatsExporter.onPost(httpPost);
        sinon.assert.calledOnce(completeRestOperationStub);
      });
    });

    describe('unknown or undefined exporter', function () {
      // runs before all tests in this block
      beforeEach(function (done) {
        const BigStatsExporter = proxyquire(moduleUnderTest,
          {
            './util': utilStub
          });

        bigStatsExporter = new BigStatsExporter();

        bigStatsExporter.completeRestOperation = function () { };
        completeRestOperationStub = sinon.stub(bigStatsExporter, 'completeRestOperation');
        done();
      });

      it('should call logger info method when called with unknown protocol', function () {
        testProtocol = 'somethingwrong';
        bigStatsExporter.onPost(httpPost);
        sinon.assert.calledWith(utilStub.logDebug, `polling mode enabled. Fetch stats with: 'GET /mgmt/shared/bigstats_exporter'`);
      });

      it('should call logger info method when called with undefined protocol', function () {
        testProtocol = undefined;
        bigStatsExporter.onPost(httpPost);
        sinon.assert.calledWith(utilStub.logDebug, `polling mode enabled. Fetch stats with: 'GET /mgmt/shared/bigstats_exporter'`);
      });
    });
  });

  describe('http/s Exporters', function () {
    // runs before all tests in this block
    beforeEach(function (done) {
      const BigStatsExporter = proxyquire(moduleUnderTest,
        {
          './util': utilStub,
          'http': httpStub,
          'https': httpsStub
        });
      bigStatsExporter = new BigStatsExporter();
      done();
    });

    it('httpExporter sends a request', function () {
      const config = {
        'hostname': 'myhostname',
        'destination': {
          'protocol': 'http',
          'address': '192.168.1.42',
          'port': 8080,
          'uri': '/stats'
        },
        'size': 'small',
        'interval': 10,
        'enabled': true,
        'debug': false
      };

      let testData = convertStatsToExportFormat(require('./data/expected-small-stats.json'), config);
      bigStatsExporter.httpExporter(testData);
      sinon.assert.calledWith(requestStub.write, JSON.stringify(testData.stats));
      sinon.assert.calledOnce(requestStub.end);
    });

    it('httpsExporter sends a request', function () {
      const config = {
        'hostname': 'myhostname',
        'destination': {
          'protocol': 'https',
          'address': '192.168.1.42',
          'port': 8080,
          'uri': '/stats'
        },
        'size': 'small',
        'interval': 10,
        'enabled': true,
        'debug': false
      };

      let testData = convertStatsToExportFormat(require('./data/expected-small-stats.json'), config);
      bigStatsExporter.httpExporter(testData);
      sinon.assert.calledWith(requestStub.write, JSON.stringify(testData.stats));
      sinon.assert.calledOnce(requestStub.end);
    });
  });

  describe('statsd Exporter', function () {
    // runs before all tests in this block
    beforeEach(function (done) {
      StatsD = sinon.stub();
      gaugeStub = sinon.stub();
      StatsD.prototype.gauge = gaugeStub;

      const BigStatsExporter = proxyquire(moduleUnderTest,
        {
          './util': utilStub,
          'node-statsd': StatsD
        });

      bigStatsExporter = new BigStatsExporter();

      done();
    });

    it('exports stats to statsd', function () {
      const config = {
        'destination': {
          'protocol': 'statsd',
          'address': '192.168.1.42',
          'port': 8080
        },
        'size': 'small',
        'interval': 10,
        'enabled': true,
        'debug': false
      };

      let testData = convertStatsToExportFormat(require('./data/expected-small-stats.json'), config);
      bigStatsExporter.statsdExporter(testData);
      sinon.assert.callCount(gaugeStub, 50);
//      sinon.assert.calledWith(gaugeStub, 'myhostname.device.0.0', 'd');  //FIXME: Dan, what is this?
      sinon.assert.callCount(utilStub.logDebug, 93);
    });
  });

  describe.skip('kafka Exporter', function () {
    // runs before all tests in this block
    beforeEach(function (done) {
      kafkaStub = sinon.stub(kafka);

      producerStub = sinon.stub();
      producerStub.prototype.send = sinon.stub();
      producerStub.prototype.on = sinon.stub();
      producerStub.prototype.ready = sinon.stub();

      let kafkaClientStub = sinon.stub();

      const BigStatsExporter = proxyquire(moduleUnderTest,
        {
          './util': utilStub,
          'kafka-node': {
            Producer: producerStub,
            KafkaClient: kafkaClientStub
          }
        });

      bigStatsExporter = new BigStatsExporter();

      done();
    });

    it('exports stats to kafka topic all', function () {
      const config = {
        'hostname': 'myhostname',
        'destination': {
          'protocol': 'kafka',
          'address': '192.168.1.42',
          'port': 8080,
          'kafka': {
            'topic': 'all'
          }
        },
        'size': 'small',
        'interval': 10,
        'enabled': true,
        'debug': false
      };

      let testData = convertStatsToExportFormat(require('./data/expected-small-stats.json'), config);
      bigStatsExporter.kafkaExporter(testData);

      var emitter = new EventEmitter();


      emitter.on('ready', producerStub);
      emitter.emit('ready');

      sinon.assert.callCount(producerStub.prototype.send, 1);
      sinon.assert.calledWith(producerStub.prototype.send, '1');
    });
  });
});
