'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();

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
      let testValue = {};
      testValue.childValue = 'has a value';
      util.safeAccess(() => testValue.childValue, 'interesting').should.be.equal('has a value');
    });

    it('should return default value if interrogated property is undefined', function () {
      let testValue = {};
      testValue.childValue = undefined;
      util.safeAccess(() => testValue.childValue, 'interesting').should.be.equal('interesting');
    });

    it('when called without a default value, should return value if interrogated property is defined', function () {
      let testValue = {};
      testValue.childValue = 'has a value';
      util.safeAccess(() => testValue.childValue).should.be.equal('has a value');
    });

    it('when called without a default value, should return undefined if interrogated property is undefined', function () {
      let testValue = {};
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
    it('should successfully output expected data when valid JSON and a valid Handlebars template are passed in', function () {
      const inputData = { 'device': { 'id': 'ip-172-31-1-20-us-west-1-compute-internal', 'tenants': [{ 'id': 'Tenant_01/App1', 'services': [{ 'id': '/Tenant_01/App3/172.31.4.11:80', 'clientside_curConns': 0, 'clientside_maxConns': 0, 'clientside_bitsIn': 0, 'clientside_bitsOut': 0, 'clientside_pktsIn': 0, 'clientside_pktsOut': 0, 'pool': { 'id': '/Tenant_01/App1/web_pool1', 'members': [{ 'id': '172.31.10.112:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.111:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.113:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.114:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }] } }] }, { 'id': 'Common', 'services': [{ 'id': '/Common/172.31.4.200:80', 'clientside_curConns': 0, 'clientside_maxConns': 0, 'clientside_bitsIn': 0, 'clientside_bitsOut': 0, 'clientside_pktsIn': 0, 'clientside_pktsOut': 0, 'pool': { 'id': '/Common/web_pool1', 'members': [{ 'id': '172.31.10.200:8080', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.201:8080', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.202:8080', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }] } }] }], 'global': { 'memory': { 'memoryTotal': 7574732800, 'memoryUsed': 1525312880 }, 'cpu0': { 'cpuIdle': 161495459, 'cpuIowait': 169763, 'cpuSystem': 292088, 'cpuUser': 973939 }, 'cpu1': { 'cpuIdle': 160343033, 'cpuIowait': 68690, 'cpuSystem': 426881, 'cpuUser': 992052 } } } };
      const template = '[{{#each device.tenants}}"{{#each services}}Service{{@id}}={{id}},Pools={{#each pool.members}}{{monitorStatus}}{{#unless @last}},{{/unless}}{{/each}}{{#unless @last}},{{/unless}}{{#unless @last}};{{/unless}}{{/each}}"{{#unless @last}},{{/unless}}{{/each}}]';
      const result = util.transformTemplateString(inputData, template);
      result.should.be.equal('["Service=/Tenant_01/App3/172.31.4.11:80,Pools=down,down,down,down","Service=/Common/172.31.4.200:80,Pools=down,down,down"]');
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

    it('should log an error and return undefined when valid JSON and an invalid Handlebars template are passed in', function () {
      const inputData = { 'device': { 'id': 'ip-172-31-1-20-us-west-1-compute-internal', 'tenants': [{ 'id': 'Tenant_01/App1', 'services': [{ 'id': '/Tenant_01/App3/172.31.4.11:80', 'clientside_curConns': 0, 'clientside_maxConns': 0, 'clientside_bitsIn': 0, 'clientside_bitsOut': 0, 'clientside_pktsIn': 0, 'clientside_pktsOut': 0, 'pool': { 'id': '/Tenant_01/App1/web_pool1', 'members': [{ 'id': '172.31.10.112:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.111:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.113:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.114:80', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }] } }] }, { 'id': 'Common', 'services': [{ 'id': '/Common/172.31.4.200:80', 'clientside_curConns': 0, 'clientside_maxConns': 0, 'clientside_bitsIn': 0, 'clientside_bitsOut': 0, 'clientside_pktsIn': 0, 'clientside_pktsOut': 0, 'pool': { 'id': '/Common/web_pool1', 'members': [{ 'id': '172.31.10.200:8080', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.201:8080', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }, { 'id': '172.31.10.202:8080', 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 'down' }] } }] }], 'global': { 'memory': { 'memoryTotal': 7574732800, 'memoryUsed': 1525312880 }, 'cpu0': { 'cpuIdle': 161495459, 'cpuIowait': 169763, 'cpuSystem': 292088, 'cpuUser': 973939 }, 'cpu1': { 'cpuIdle': 160343033, 'cpuIowait': 68690, 'cpuSystem': 426881, 'cpuUser': 992052 } } } };
      const template = '{{{#each device.tenants}}';

      should.not.exist(util.transformTemplateString(inputData, template));
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
