'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('assert');
const mocha = require('mocha');
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
