'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('assert');
const mocha = require('mocha');
const moment = require('moment');
const logger = require('./f5-logger-fake');

let util;
let loggerStub;
let f5LoggerInfoSpy;

describe('Util', function () {
  // runs once before all tests in this block
  mocha.before(function (done) {
    // create stub for f5-logger dependency since it isn't available to the tests
    let moduleUnderTest = '../../SRC/BigStats/nodejs/util';

    loggerStub = sinon.stub(logger);
    f5LoggerInfoSpy = sinon.spy();

    util = proxyquire(moduleUnderTest, { 'f5-logger': loggerStub });
    loggerStub.getInstance.returns({ info: f5LoggerInfoSpy });

    util.init('TestModule');
    done();
  });

  describe('formatMessage', function () {
    it('should emit expected string', function () {
      assert.strictEqual(util.formatMessage('something happened'), '[TestModule] - something happened');
    });
  });

  describe('transformTemplateString', function () {
    it('should transform data and template into expected string', function () {
      const data = {
        name: 'picard',
        hostname: 'localhost',
        metric: 'assimilations',
        value: 42,
        dateFormat: 'YYYYMMDD'
      };
      const template = 'vs_stats,VIP={{name}},Device={{hostname}},[{{metric}}={{value}}],Date: {{format_date dateFormat}}';

      assert.strictEqual(util.transformTemplateString(data, template), `vs_stats,VIP=picard,Device=localhost,[assimilations=42],Date: ${moment().format('YYYYMMDD')}`);
    });

    it('should attempt to transform if an invalid property is referenced in the template', function () {
      const data = {
        rightName: 'picard'
      };
      const template = 'VIP={{wrongName}},otherstuff';

      assert.strictEqual(util.transformTemplateString(data, template), `VIP=,otherstuff`);
    });

    it('should log an error and return undefined when the template contains syntax errors', function () {
      const data = {
        name: 'picard',
        dateFormat: 'YYYYMMDD'
      };
      const template = 'vs_stats,VIP={{name} Date: {{format_date dateFormat}}';

      assert.strictEqual(util.transformTemplateString(data, template), undefined);
      sinon.assert.calledWith(f5LoggerInfoSpy, '[TestModule - ERROR] - Error while transforming template string');
    });
  });

  describe('logInfo', function () {
    it('should emit expected info string', function () {
      util.logInfo('something else happened');
      sinon.assert.calledWith(f5LoggerInfoSpy, '[TestModule] - something else happened');
    });
  });

  describe('logDebug', function () {
    it('should emit expected debug string', function () {
      util.logDebug('something really detailed happened');
      sinon.assert.calledWith(f5LoggerInfoSpy, '[TestModule - DEBUG] - something really detailed happened');
    });
  });

  describe('logError', function () {
    it('should emit expected error string', function () {
      util.logError('something really bad happened');
      sinon.assert.calledWith(f5LoggerInfoSpy, '[TestModule - ERROR] - something really bad happened');
    });
  });
});
