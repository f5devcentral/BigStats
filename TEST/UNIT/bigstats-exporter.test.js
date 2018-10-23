'use strict';

var proxyquire = require('proxyquire').noCallThru();

const assert = require('assert');
const mocha = require('mocha');
const sinon = require('sinon');

const http = require('http');
const kafka = require('kafka-node');
const util = require('./util-fake');

let moduleUnderTest = '../../SRC/BigStats/nodejs/bigstats-exporter';
let utilStub;
let httpStub;
let bigStatsExporter;
let httpPost;
let testProtocol;
let completeRestOperationStub;

describe('BigStatsExporter', function () {
  // runs once before all tests in this block
  mocha.before(function (done) {
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
            hostname: {
              services: 'service1',
              device: 'device1'
            }
          }
        };
      },
      setBody: function () { }
    };

    done();
  });

  mocha.afterEach(function (done) {
    // reset stub behavior and history
    sinon.resetHistory();
    done();
  });

  describe('replaceDotsSlashesColons', function () {
    it('should replace . / : with -', function () {
      const input = 'https://support.f5.com:80/kb/en-us/products/big-ip_apm/manuals/product/apm-visual-policy-editor-13-1-0/3.html#guid-bb209ab6-68ab-4bf0-9c82-ac5e767f5816';
      assert.strictEqual(bigStatsExporter.replaceDotsSlashesColons(input), 'https---support-f5-com-80-kb-en-us-products-big-ip_apm-manuals-product-apm-visual-policy-editor-13-1-0-3-html#guid-bb209ab6-68ab-4bf0-9c82-ac5e767f5816');
    });
  });

  describe('onPost', function () {
    describe('http-based exporters', function () {
      mocha.before(function (done) {
        httpStub = sinon.stub(http);
        httpStub.request.returns({ write: function () { }, on: function () { }, end: function () { } });

        const BigStatsExporter = proxyquire(moduleUnderTest,
          {
            './util': utilStub,
            'http': httpStub,
            'https': httpStub
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

      mocha.afterEach(function (done) {
        sinon.assert.calledWith(utilStub.logDebug, 'onPost received data: ' + httpPost.getBody());
        done();
      });
    });

    describe('statsd exporter', function () {
      // runs once before all tests in this block
      mocha.before(function (done) {
        const StatsD = function () { return { gauge: function () { } }; };
        const statsdSpy = sinon.spy(StatsD);

        const BigStatsExporter = proxyquire(moduleUnderTest,
          {
            './util': utilStub,
            'node-statsd': statsdSpy
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

    describe('kafka exporter', function () {
      // runs once before all tests in this block
      mocha.before(function (done) {
        const producer = function () { return { on: function () { } }; };
        const kafkaStub = sinon.stub(kafka);
        const producerSpy = sinon.spy(producer);
        kafkaStub.Producer = producerSpy;

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
      mocha.before(function (done) {
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
});
