'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();

const moment = require('moment');
const logger = require('./f5-logger-fake');

let util;
let loggerStub;
let f5LoggerInfoSpy;

describe('Util', function () {
  // runs once before all tests in this block
  before(function (done) {
    // create stub for f5-logger dependency since it isn't available to the tests
    let moduleUnderTest = '../../SRC/BigStats/nodejs/util';

    loggerStub = sinon.stub(logger);
    f5LoggerInfoSpy = sinon.spy();

    util = proxyquire(moduleUnderTest, { 'f5-logger': loggerStub });
    loggerStub.getInstance.returns({ info: f5LoggerInfoSpy });

    util.init('TestModule');
    done();
  });

  describe('safeAccess', function () {
    it('should return value if interrogated property is defined', function () {
      let testValue = { };
      testValue.childValue = 'has a value';
      util.safeAccess(() => testValue.childValue, 'interesting').should.be.equal('has a value');
    });

    it('should return default value if interrogated property is undefined', function () {
      let testValue = { };
      testValue.childValue = undefined;
      util.safeAccess(() => testValue.childValue, 'interesting').should.be.equal('interesting');
    });

    it('when called without a default value, should return value if interrogated property is defined', function () {
      let testValue = { };
      testValue.childValue = 'has a value';
      util.safeAccess(() => testValue.childValue).should.be.equal('has a value');
    });

    it('when called without a default value, should return undefined if interrogated property is undefined', function () {
      let testValue = { };
      testValue.childValue = undefined;
      should.not.exist(util.safeAccess(() => testValue.childValue));
    });
  });

  describe('formatMessage', function () {
    it('should emit expected string', function () {
      util.formatMessage('something happened').should.be.equal('[TestModule] - something happened');
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

      util.transformTemplateString(data, template).should.be.equal(`vs_stats,VIP=picard,Device=localhost,[assimilations=42],Date: ${moment().format('YYYYMMDD')}`);
    });

    it('should transform data and template into expected string when date format is undefined', function () {
      const data = {
        name: 'picard',
        hostname: 'localhost',
        metric: 'assimilations',
        value: 42
      };
      const template = 'vs_stats,VIP={{name}},Device={{hostname}},[{{metric}}={{value}}],Date: {{format_date dateFormat}}';

      util.transformTemplateString(data, template).should.be.equal(`vs_stats,VIP=picard,Device=localhost,[assimilations=42],Date: ${moment().format(undefined)}`);
    });

    it('should attempt to transform if an invalid property is referenced in the template', function () {
      const data = {
        rightName: 'picard'
      };
      const template = 'VIP={{wrongName}},otherstuff';

      util.transformTemplateString(data, template).should.be.equal(`VIP=,otherstuff`);
    });

    it('should log an error and return undefined when the template contains syntax errors', function () {
      const data = {
        name: 'picard',
        dateFormat: 'YYYYMMDD'
      };
      const template = 'vs_stats,VIP={{name} Date: {{format_date dateFormat}}';

      should.not.exist(util.transformTemplateString(data, template));
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
