'use strict';

var proxyquire = require('proxyquire').noCallThru();

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();

const util = require('../FAKES/util-fake');

let moduleUnderTest = '../../SRC/BigStats/nodejs/bigstats';
let utilStub;
let sendGetStub;
let bigStats;
let config;
let getVipResourceListStub;
let getDeviceStatsStub;
let buildSmallStatsObjectStub;
let exportStatsStub;
let getVipStatsStub;
let getPoolResourceListStub;
let getPoolResourceStub;
let getPoolMemberStatsStub;
let vipInfoStats = require('./data/vs-stats.json');
let hostInfoStats = require('./data/host-info-stats.json');
let vipResourceList = require('./data/filtered-vip-resource-list.json');
let vipProfileList = require('./data/vip-profile-list.json');
let poolMemberStats = require('./data/pool-member-stats.json');
let clientSslProfileList = require('./data/client-ssl_profile_list.json');

describe('BigStats', function () {
  beforeEach(function (done) {
    utilStub = sinon.createStubInstance(util);
    const BigStats = proxyquire(moduleUnderTest,
      {
        './util': utilStub
      });
    bigStats = new BigStats();
    bigStats.restHelper = {};
    bigStats.restHelper.makeRestnodedUri = sinon.spy();
    bigStats.createRestOperation = sinon.spy();
    bigStats.restRequestSender = { sendGet: function () { }, sendPost: function () { } };
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

  describe('pullStats', function () {
    // runs once before each test in this block
    beforeEach(function (done) {
      getDeviceStatsStub = sinon.stub(bigStats, 'getDeviceStats').resolves();
      buildSmallStatsObjectStub = sinon.stub(bigStats, 'buildSmallStatsObject').resolves();
      exportStatsStub = sinon.stub(bigStats, 'exportStats').returns();

      getVipResourceListStub = sinon.stub(bigStats, 'getVipResourceList').resolves(vipResourceList);

      config = {
        'hostname': 'server.f5.com',
        'destination': {
          'protocol': 'kafka',
          'kafka': {
            'topic': 'bob'
          },
          'address': '192.168.1.42',
          'port': 8080,
          'uri': '/stats'
        },
        'size': 'small',
        'interval': 10,
        'enabled': true,
        'debug': false
      };

      done();
    });

    it('should return formatted device statistics in a small size', function () {
      bigStats.config = config;
      let getSettingsStub = sinon.stub(bigStats, 'getSettings').resolves(config);

      bigStats.pullStats();

      // TODO: This may reveal a limitation with the current design. pullStats is synchronous, but calls underlying functions that are async. When it completes, the promises underneath it are not resolved. Promises never resolve in the same tick they are created.
      setImmediate(() => {
        sinon.assert.calledOnce(getSettingsStub);
        sinon.assert.calledOnce(getDeviceStatsStub);
        sinon.assert.calledOnce(getVipResourceListStub);
        sinon.assert.calledOnce(buildSmallStatsObjectStub);
        sinon.assert.calledThrice(utilStub.logDebug);
      });
    });

    it('should return formatted device statistics in a medium size', function () {
      config.size = 'medium';
      bigStats.config = config;
      let getSettingsStub = sinon.stub(bigStats, 'getSettings').resolves(config);

      let buildMediumStatsObject = sinon.stub(bigStats, 'buildMediumStatsObject').resolves();

      bigStats.pullStats();

      // TODO: This may reveal a limitation with the current design. pullStats is synchronous, but calls underlying functions that are async. When it completes, the promises underneath it are not resolved. Promises never resolve in the same tick they are created.
      setImmediate(() => {
        sinon.assert.calledOnce(getSettingsStub);
        sinon.assert.calledOnce(getDeviceStatsStub);
        sinon.assert.calledOnce(getVipResourceListStub);
        sinon.assert.calledOnce(buildMediumStatsObject);
        sinon.assert.calledThrice(utilStub.logDebug);
      });
    });

    it('should return formatted device statistics in a large size', function () {
      config.size = 'large';
      bigStats.config = config;
      let getSettingsStub = sinon.stub(bigStats, 'getSettings').resolves(config);

      let buildLargeStatsObject = sinon.stub(bigStats, 'buildLargeStatsObject').resolves();

      bigStats.pullStats();

      // TODO: This may reveal a limitation with the current design. pullStats is synchronous, but calls underlying functions that are async. When it completes, the promises underneath it are not resolved. Promises never resolve in the same tick they are created.
      setImmediate(() => {
        sinon.assert.calledOnce(getSettingsStub);
        sinon.assert.calledOnce(getDeviceStatsStub);
        sinon.assert.calledOnce(getVipResourceListStub);
        sinon.assert.calledOnce(buildLargeStatsObject);
        sinon.assert.calledThrice(utilStub.logDebug);
      });
    });

    it('should not return when error occurs', function () {
      config.size = 'medium';
      bigStats.config = config;
      let getSettingsStub = sinon.stub(bigStats, 'getSettings').rejects('problem getting settings');

      bigStats.pullStats();

      // TODO: Fix this. pullStats is synchronous, but calls underlying functions that are async. When it completes, the promises underneath it are not resolved. Have to put in an artificial wait before checking if the underlying stubs have been called.
      setImmediate(() => {
        sinon.assert.calledOnce(getSettingsStub);
        sinon.assert.calledWith(utilStub.logError, 'pullStats() - Promise Chain Error: problem getting settings');
      });
    });
  });

  describe('getDeviceStats', function () {
    
    // runs once before all tests in this block
    before(function (done) {
      utilStub = sinon.createStubInstance(util);

      const BigStats = proxyquire(moduleUnderTest,
        {
          './util': utilStub
        });

      bigStats = new BigStats();
      bigStats.restHelper = {};
      bigStats.restHelper.makeRestnodedUri = sinon.spy();
      bigStats.createRestOperation = sinon.spy();
      bigStats.restRequestSender = { sendGet: function () { } };
      done();
    });

    afterEach(function (done) {
      // reset stub behavior and history
      sinon.reset();
      bigStats.restRequestSender.sendGet.restore();
      done();
    });

    it('should return formatted device statistics', function (done) {
      const expectedStats = JSON.parse('{"cpus":[{"fiveSecAvgIdle": 92,"fiveSecAvgIowait": 0,"fiveSecAvgIrq": 0,"fiveSecAvgNiced": 0,"fiveSecAvgRatio": 7,"fiveSecAvgSoftirq": 0,"fiveSecAvgStolen": 0,"fiveSecAvgSystem": 2,"fiveSecAvgUser": 5,"id": "cpu0"},{"fiveSecAvgIdle": 93,"fiveSecAvgIowait": 0,"fiveSecAvgIrq": 0,"fiveSecAvgNiced": 0,"fiveSecAvgRatio": 7,"fiveSecAvgSoftirq": 0,"fiveSecAvgStolen": 0,"fiveSecAvgSystem": 1,"fiveSecAvgUser": 5,"id": "cpu1"}],"memory": {"memoryTotal": 8063369216,"memoryUsed": 2178806560}}');
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(hostInfoStats);

      const promise = bigStats.getDeviceStats();
      promise.should.be.fulfilled.then((deviceStats) => {
        deviceStats.should.be.deep.equal(expectedStats);
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects();

      const promise = bigStats.getDeviceStats();
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getDeviceStats(): {}');
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });
  });

  describe('buildSmallStatsObject', function () {

    it('should return formatted service statistics', function (done) {
      const expectedStats = require('./data/expected-small-stats.json');
      const arg1 = JSON.parse('{ "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }');
      const arg1Res = JSON.parse('{ "id": "/Common/192.1.0.1:80", "clientside_curConns": 0, "clientside_maxConns": 0, "clientside_bitsIn": 0, "clientside_bitsOut": 0, "clientside_pktsIn": 0, "clientside_pktsOut": 0 }');
      const arg2 = JSON.parse('{ "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain-Redirect", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain-Redirect?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:80" }');
      const arg2Res = JSON.parse('{ "id": "/Sample_01/192.0.0.1:80", "clientside_curConns": 0, "clientside_maxConns": 0, "clientside_bitsIn": 0, "clientside_bitsOut": 0, "clientside_pktsIn": 0, "clientside_pktsOut": 0 }');
      const arg3 = JSON.parse('{ "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }');
      const arg3Res = JSON.parse('{ "id": "/Sample_01/192.0.0.1:443", "clientside_curConns": 0, "clientside_maxConns": 0, "clientside_bitsIn": 0, "clientside_bitsOut": 0, "clientside_pktsIn": 0, "clientside_pktsOut": 0 }');
      const arg4 = JSON.parse(' { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain-Redirect", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain-Redirect?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:80" }');
      const arg4Res = JSON.parse('{ "id": "/Sample_02/192.0.1.2:80", "clientside_curConns": 0, "clientside_maxConns": 0, "clientside_bitsIn": 0, "clientside_bitsOut": 0, "clientside_pktsIn": 0, "clientside_pktsOut": 0 }');
      const arg5 = JSON.parse('{ "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }');
      const arg5Res = JSON.parse('{ "id": "/Sample_02/192.0.1.2:443", "clientside_curConns": 0, "clientside_maxConns": 0, "clientside_bitsIn": 0, "clientside_bitsOut": 0, "clientside_pktsIn": 0, "clientside_pktsOut": 0 }');
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats');
      getVipStatsStub.withArgs(arg1).resolves(arg1Res);
      getVipStatsStub.withArgs(arg2).resolves(arg2Res);
      getVipStatsStub.withArgs(arg3).resolves(arg3Res);
      getVipStatsStub.withArgs(arg4).resolves(arg4Res);
      getVipStatsStub.withArgs(arg5).resolves(arg5Res);
      
      const promise = bigStats.buildSmallStatsObject(vipResourceList.body);
      promise.should.be.fulfilled.then((smallStatsObj) => {
        smallStatsObj.should.be.deep.equal(expectedStats.device.tenants);
        sinon.assert.callCount(getVipStatsStub, 5);
        sinon.assert.callCount(utilStub.logDebug, 5);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').rejects('something bad happened');
      const promise = bigStats.buildSmallStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildSmallStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 5);
      }).should.notify(done);
    });
  });

  describe('buildMediumStatsObject', function () {

    it('should return formatted service statistics', function (done) {
      const expectedSmallStats = require('./data/expected-small-stats.json');
      const expectedMediumStats = require('./data/expected-medium-stats.json');
      const getSmallStatsObj = sinon.stub(bigStats, 'buildSmallStatsObject').resolves(expectedSmallStats.device.tenants);

      const poolResListArg1 = JSON.parse('{ "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }');
      const poolResListArg1Res = JSON.parse('[{ "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "name": "192.1.0.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1/members/~Common~192.1.0.1:80?ver=13.1.1" }, { "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "name": "192.1.0.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1/members/~Common~192.1.0.2:80?ver=13.1.1" }]');
      const poolResListArg2 = JSON.parse('{ "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }');
      const poolResListArg2Res = JSON.parse('[{ "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "name": "192.0.1.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01/members/~Sample_01~192.0.1.1:80?ver=13.1.1" }, { "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "name": "192.0.1.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01/members/~Sample_01~192.0.1.2:80?ver=13.1.1" }]');
      const poolResListArg3 = JSON.parse('{ "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }');
      const poolResListArg3Res = JSON.parse('[{ "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "name": "192.0.2.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02/members/~Sample_02~192.0.2.1:80?ver=13.1.1" }, { "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "name": "192.0.2.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02/members/~Sample_02~192.0.2.2:80?ver=13.1.1" }]');
      getPoolResourceListStub = sinon.stub(bigStats, 'getPoolResourceList')
        .withArgs(poolResListArg1).resolves(poolResListArg1Res)
        .withArgs(poolResListArg2).resolves(poolResListArg2Res)
        .withArgs(poolResListArg3).resolves(poolResListArg3Res);

      const poolMemStatArg1 = JSON.parse('{ "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "name": "192.1.0.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1/members/~Common~192.1.0.1:80?ver=13.1.1" }');
      const poolMemStatArg1Res = JSON.parse('{ "poolMemberResource": { "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "name": "192.1.0.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1/members/~Common~192.1.0.1:80?ver=13.1.1" }, "poolMemberStats": { "id": "192.1.0.1:80", "serverside_curConns": 0, "serverside_maxConns": 0, "serverside_bitsIn": 0, "serverside_bitsOut": 0, "serverside_pktsIn": 0, "serverside_pktsOut": 0, "monitorStatus": 0 } }');
      const poolMemStatArg2 = JSON.parse('{ "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "name": "192.1.0.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1/members/~Common~192.1.0.2:80?ver=13.1.1" }');
      const poolMemStatArg2Res = JSON.parse('{ "poolMemberResource": { "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "name": "192.1.0.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1/members/~Common~192.1.0.2:80?ver=13.1.1" }, "poolMemberStats": { "id": "192.1.0.2:80", "serverside_curConns": 0, "serverside_maxConns": 0, "serverside_bitsIn": 0, "serverside_bitsOut": 0, "serverside_pktsIn": 0, "serverside_pktsOut": 0, "monitorStatus": 0 } }');
      const poolMemStatArg3 = JSON.parse('{ "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "name": "192.0.1.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01/members/~Sample_01~192.0.1.1:80?ver=13.1.1" }');
      const poolMemStatArg3Res = JSON.parse('{ "poolMemberResource": { "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "name": "192.0.1.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01/members/~Sample_01~192.0.1.1:80?ver=13.1.1" }, "poolMemberStats": { "id": "192.0.1.1:80", "serverside_curConns": 0, "serverside_maxConns": 0, "serverside_bitsIn": 0, "serverside_bitsOut": 0, "serverside_pktsIn": 0, "serverside_pktsOut": 0, "monitorStatus": 0 } }');
      const poolMemStatArg4 = JSON.parse('{ "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "name": "192.0.1.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01/members/~Sample_01~192.0.1.2:80?ver=13.1.1" }');
      const poolMemStatArg4Res = JSON.parse('{ "poolMemberResource": { "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "name": "192.0.1.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01/members/~Sample_01~192.0.1.2:80?ver=13.1.1" }, "poolMemberStats": { "id": "192.0.1.2:80", "serverside_curConns": 0, "serverside_maxConns": 0, "serverside_bitsIn": 0, "serverside_bitsOut": 0, "serverside_pktsIn": 0, "serverside_pktsOut": 0, "monitorStatus": 0 } }');
      const poolMemStatArg5 = JSON.parse('{ "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "name": "192.0.2.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02/members/~Sample_02~192.0.2.1:80?ver=13.1.1" }');
      const poolMemStatArg5Res = JSON.parse('{ "poolMemberResource": { "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "name": "192.0.2.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02/members/~Sample_02~192.0.2.1:80?ver=13.1.1" }, "poolMemberStats": { "id": "192.0.2.1:80", "serverside_curConns": 0, "serverside_maxConns": 0, "serverside_bitsIn": 0, "serverside_bitsOut": 0, "serverside_pktsIn": 0, "serverside_pktsOut": 0, "monitorStatus": 0 } }');
      const poolMemStatArg6 = JSON.parse('{ "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "name": "192.0.2.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02/members/~Sample_02~192.0.2.2:80?ver=13.1.1" }');
      const poolMemStatArg6Res = JSON.parse('{ "poolMemberResource": { "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "name": "192.0.2.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02/members/~Sample_02~192.0.2.2:80?ver=13.1.1" }, "poolMemberStats": { "id": "192.0.2.2:80", "serverside_curConns": 0, "serverside_maxConns": 0, "serverside_bitsIn": 0, "serverside_bitsOut": 0, "serverside_pktsIn": 0, "serverside_pktsOut": 0, "monitorStatus": 0 } }');

      getPoolMemberStatsStub = sinon.stub(bigStats, 'getPoolMemberStats')
        .withArgs(poolMemStatArg1).resolves(poolMemStatArg1Res)
        .withArgs(poolMemStatArg2).resolves(poolMemStatArg2Res)
        .withArgs(poolMemStatArg3).resolves(poolMemStatArg3Res)
        .withArgs(poolMemStatArg4).resolves(poolMemStatArg4Res)
        .withArgs(poolMemStatArg5).resolves(poolMemStatArg5Res)
        .withArgs(poolMemStatArg6).resolves(poolMemStatArg6Res);

      const promise = bigStats.buildMediumStatsObject(vipResourceList.body);
      promise.should.be.fulfilled.then((mediumStatsObj) => {
        mediumStatsObj.should.be.deep.equal(expectedMediumStats.device.tenants);
        sinon.assert.callCount(utilStub.logDebug, 3);
        sinon.assert.callCount(getSmallStatsObj, 1);
        sinon.assert.callCount(getPoolResourceListStub, 1);
        sinon.assert.callCount(getPoolMemberStatsStub, 1);
      }).should.notify(done);
    });
  });

  describe('buildLargeStatsObject', function () {
    // runs once before each test in this block

    it('should return formatted device statistics', function (done) {
      const expectedMediumStats = require('./data/expected-medium-stats.json');
      const expectedLargeStats = require('./data/expected-large-stats.json');
      const getMediumStatsObjStub = sinon.stub(bigStats, 'buildMediumStatsObject').resolves(expectedMediumStats.device.tenants);
      const sslStatsArg1 = JSON.parse('{ "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }');
      const sslStatsArg1Res = JSON.parse('{ "vip": { "partition": "Common", "fullPath": "/Common/myApp1", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1", "destination": "/Common/192.1.0.1:80", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" } }, "stats": { "id": "/Common/clientssl", "common_activeHandshakeRejected": 0, "common_aggregateRenegotiationsRejected": 0, "common_badRecords": 0, "common_c3dUses_conns": 0, "common_cipherUses_adhKeyxchg": 0, "common_cipherUses_aesBulk": 0, "common_cipherUses_aesGcmBulk": 0, "common_cipherUses_camelliaBulk": 0, "common_cipherUses_desBulk": 0, "common_cipherUses_dhRsaKeyxchg": 0, "common_cipherUses_dheDssKeyxchg": 0, "common_cipherUses_ecdhEcdsaKeyxchg": 0, "common_cipherUses_ecdhRsaKeyxchg": 0, "common_cipherUses_ecdheEcdsaKeyxchg": 0, "common_cipherUses_ecdheRsaKeyxchg": 0, "common_cipherUses_edhRsaKeyxchg": 0, "common_cipherUses_ideaBulk": 0, "common_cipherUses_md5Digest": 0, "common_cipherUses_nullBulk": 0, "common_cipherUses_nullDigest": 0, "common_cipherUses_rc2Bulk": 0, "common_cipherUses_rc4Bulk": 0, "common_cipherUses_rsaKeyxchg": 0, "common_cipherUses_shaDigest": 0, "common_connectionMirroring_haCtxRecv": 0, "common_connectionMirroring_haCtxSent": 0, "common_connectionMirroring_haFailure": 0, "common_connectionMirroring_haHsSuccess": 0, "common_connectionMirroring_haPeerReady": 0, "common_connectionMirroring_haTimeout": 0, "common_curCompatConns": 0, "common_curConns": 0, "common_curNativeConns": 0, "common_currentActiveHandshakes": 0, "common_decryptedBytesIn": 0, "common_decryptedBytesOut": 0, "common_dtlsTxPushbacks": 0, "common_encryptedBytesIn": 975357, "common_encryptedBytesOut": 0, "common_extendedMasterSecrets": 0, "common_fatalAlerts": 0, "common_fullyHwAcceleratedConns": 0, "common_fwdpUses_alertBypasses": 0, "common_fwdpUses_cachedCerts": 0, "common_fwdpUses_clicertFailBypasses": 0, "common_fwdpUses_conns": 0, "common_fwdpUses_dipBypasses": 0, "common_fwdpUses_hnBypasses": 0, "common_fwdpUses_sipBypasses": 0, "common_handshakeFailures": 0, "common_insecureHandshakeAccepts": 0, "common_insecureHandshakeRejects": 0, "common_insecureRenegotiationRejects": 0, "common_maxCompatConns": 0, "common_maxConns": 2, "common_maxNativeConns": 0, "common_midstreamRenegotiations": 0, "common_nonHwAcceleratedConns": 0, "common_ocspFwdpClientssl_cachedResp": 0, "common_ocspFwdpClientssl_certStatusReq": 0, "common_ocspFwdpClientssl_invalidCertResp": 0, "common_ocspFwdpClientssl_respstatusErrResp": 0, "common_ocspFwdpClientssl_revokedResp": 0, "common_ocspFwdpClientssl_stapledResp": 0, "common_ocspFwdpClientssl_unknownResp": 0, "common_partiallyHwAcceleratedConns": 0, "common_peercertInvalid": 0, "common_peercertNone": 0, "common_peercertValid": 0, "common_prematureDisconnects": 0, "common_protocolUses_dtlsv1": 0, "common_protocolUses_sslv2": 0, "common_protocolUses_sslv3": 0, "common_protocolUses_tlsv1": 0, "common_protocolUses_tlsv1_1": 0, "common_protocolUses_tlsv1_2": 0, "common_recordsIn": 0, "common_recordsOut": 0, "common_renegotiationsRejected": 0, "common_secureHandshakes": 0, "common_sessCacheCurEntries": 0, "common_sessCacheHits": 0, "common_sessCacheInvalidations": 0, "common_sessCacheLookups": 0, "common_sessCacheOverflows": 0, "common_sessionMirroring_failure": 0, "common_sessionMirroring_success": 0, "common_sesstickUses_reuseFailed": 0, "common_sesstickUses_reused": 0, "common_sniRejects": 0, "common_totCompatConns": 0, "common_totNativeConns": 0, "dynamicRecord_x1": 0, "dynamicRecord_x10": 0, "dynamicRecord_x11": 0, "dynamicRecord_x12": 0, "dynamicRecord_x13": 0, "dynamicRecord_x14": 0, "dynamicRecord_x15": 0, "dynamicRecord_x16": 0, "dynamicRecord_x2": 0, "dynamicRecord_x3": 0, "dynamicRecord_x4": 0, "dynamicRecord_x5": 0, "dynamicRecord_x6": 0, "dynamicRecord_x7": 0, "dynamicRecord_x8": 0, "dynamicRecord_x9": 0 } }');
      const sslStatsArg2 = JSON.parse('{ "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }');
      const sslStatsArg2Res = JSON.parse('{ "vip": { "partition": "Sample_01", "subPath": "A01", "fullPath": "/Sample_01/A01/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_01~A01~serviceMain?ver=13.1.1", "destination": "/Sample_01/192.0.0.1:443", "pool": "/Sample_01/A01/web_pool01", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_01~A01~web_pool01?ver=13.1.1" } }, "stats": { "id": "/Sample_01/A01/webtls01", "common_activeHandshakeRejected": 0, "common_aggregateRenegotiationsRejected": 0, "common_badRecords": 0, "common_c3dUses_conns": 0, "common_cipherUses_adhKeyxchg": 0, "common_cipherUses_aesBulk": 0, "common_cipherUses_aesGcmBulk": 0, "common_cipherUses_camelliaBulk": 0, "common_cipherUses_desBulk": 0, "common_cipherUses_dhRsaKeyxchg": 0, "common_cipherUses_dheDssKeyxchg": 0, "common_cipherUses_ecdhEcdsaKeyxchg": 0, "common_cipherUses_ecdhRsaKeyxchg": 0, "common_cipherUses_ecdheEcdsaKeyxchg": 0, "common_cipherUses_ecdheRsaKeyxchg": 0, "common_cipherUses_edhRsaKeyxchg": 0, "common_cipherUses_ideaBulk": 0, "common_cipherUses_md5Digest": 0, "common_cipherUses_nullBulk": 0, "common_cipherUses_nullDigest": 0, "common_cipherUses_rc2Bulk": 0, "common_cipherUses_rc4Bulk": 0, "common_cipherUses_rsaKeyxchg": 0, "common_cipherUses_shaDigest": 0, "common_connectionMirroring_haCtxRecv": 0, "common_connectionMirroring_haCtxSent": 0, "common_connectionMirroring_haFailure": 0, "common_connectionMirroring_haHsSuccess": 0, "common_connectionMirroring_haPeerReady": 0, "common_connectionMirroring_haTimeout": 0, "common_curCompatConns": 0, "common_curConns": 0, "common_curNativeConns": 0, "common_currentActiveHandshakes": 0, "common_decryptedBytesIn": 0, "common_decryptedBytesOut": 0, "common_dtlsTxPushbacks": 0, "common_encryptedBytesIn": 0, "common_encryptedBytesOut": 0, "common_extendedMasterSecrets": 0, "common_fatalAlerts": 0, "common_fullyHwAcceleratedConns": 0, "common_fwdpUses_alertBypasses": 0, "common_fwdpUses_cachedCerts": 0, "common_fwdpUses_clicertFailBypasses": 0, "common_fwdpUses_conns": 0, "common_fwdpUses_dipBypasses": 0, "common_fwdpUses_hnBypasses": 0, "common_fwdpUses_sipBypasses": 0, "common_handshakeFailures": 0, "common_insecureHandshakeAccepts": 0, "common_insecureHandshakeRejects": 0, "common_insecureRenegotiationRejects": 0, "common_maxCompatConns": 0, "common_maxConns": 0, "common_maxNativeConns": 0, "common_midstreamRenegotiations": 0, "common_nonHwAcceleratedConns": 0, "common_ocspFwdpClientssl_cachedResp": 0, "common_ocspFwdpClientssl_certStatusReq": 0, "common_ocspFwdpClientssl_invalidCertResp": 0, "common_ocspFwdpClientssl_respstatusErrResp": 0, "common_ocspFwdpClientssl_revokedResp": 0, "common_ocspFwdpClientssl_stapledResp": 0, "common_ocspFwdpClientssl_unknownResp": 0, "common_partiallyHwAcceleratedConns": 0, "common_peercertInvalid": 0, "common_peercertNone": 0, "common_peercertValid": 0, "common_prematureDisconnects": 0, "common_protocolUses_dtlsv1": 0, "common_protocolUses_sslv2": 0, "common_protocolUses_sslv3": 0, "common_protocolUses_tlsv1": 0, "common_protocolUses_tlsv1_1": 0, "common_protocolUses_tlsv1_2": 0, "common_recordsIn": 0, "common_recordsOut": 0, "common_renegotiationsRejected": 0, "common_secureHandshakes": 0, "common_sessCacheCurEntries": 0, "common_sessCacheHits": 0, "common_sessCacheInvalidations": 0, "common_sessCacheLookups": 0, "common_sessCacheOverflows": 0, "common_sessionMirroring_failure": 0, "common_sessionMirroring_success": 0, "common_sesstickUses_reuseFailed": 0, "common_sesstickUses_reused": 0, "common_sniRejects": 0, "common_totCompatConns": 0, "common_totNativeConns": 0, "dynamicRecord_x1": 0, "dynamicRecord_x10": 0, "dynamicRecord_x11": 0, "dynamicRecord_x12": 0, "dynamicRecord_x13": 0, "dynamicRecord_x14": 0, "dynamicRecord_x15": 0, "dynamicRecord_x16": 0, "dynamicRecord_x2": 0, "dynamicRecord_x3": 0, "dynamicRecord_x4": 0, "dynamicRecord_x5": 0, "dynamicRecord_x6": 0, "dynamicRecord_x7": 0, "dynamicRecord_x8": 0, "dynamicRecord_x9": 0 } }');
      const sslStatsArg3 = JSON.parse('{ "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }');
      const sslStatsArg3Res = JSON.parse('{ "vip": { "partition": "Sample_02", "subPath": "A02", "fullPath": "/Sample_02/A02/serviceMain", "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Sample_02~A02~serviceMain?ver=13.1.1", "destination": "/Sample_02/192.0.1.2:443", "pool": "/Sample_02/A02/web_pool02", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Sample_02~A02~web_pool02?ver=13.1.1" } }, "stats": { "id": "/Sample_02/A02/webtls02", "common_activeHandshakeRejected": 0, "common_aggregateRenegotiationsRejected": 0, "common_badRecords": 0, "common_c3dUses_conns": 0, "common_cipherUses_adhKeyxchg": 0, "common_cipherUses_aesBulk": 0, "common_cipherUses_aesGcmBulk": 0, "common_cipherUses_camelliaBulk": 0, "common_cipherUses_desBulk": 0, "common_cipherUses_dhRsaKeyxchg": 0, "common_cipherUses_dheDssKeyxchg": 0, "common_cipherUses_ecdhEcdsaKeyxchg": 0, "common_cipherUses_ecdhRsaKeyxchg": 0, "common_cipherUses_ecdheEcdsaKeyxchg": 0, "common_cipherUses_ecdheRsaKeyxchg": 0, "common_cipherUses_edhRsaKeyxchg": 0, "common_cipherUses_ideaBulk": 0, "common_cipherUses_md5Digest": 0, "common_cipherUses_nullBulk": 0, "common_cipherUses_nullDigest": 0, "common_cipherUses_rc2Bulk": 0, "common_cipherUses_rc4Bulk": 0, "common_cipherUses_rsaKeyxchg": 0, "common_cipherUses_shaDigest": 0, "common_connectionMirroring_haCtxRecv": 0, "common_connectionMirroring_haCtxSent": 0, "common_connectionMirroring_haFailure": 0, "common_connectionMirroring_haHsSuccess": 0, "common_connectionMirroring_haPeerReady": 0, "common_connectionMirroring_haTimeout": 0, "common_curCompatConns": 0, "common_curConns": 0, "common_curNativeConns": 0, "common_currentActiveHandshakes": 0, "common_decryptedBytesIn": 0, "common_decryptedBytesOut": 0, "common_dtlsTxPushbacks": 0, "common_encryptedBytesIn": 0, "common_encryptedBytesOut": 0, "common_extendedMasterSecrets": 0, "common_fatalAlerts": 0, "common_fullyHwAcceleratedConns": 0, "common_fwdpUses_alertBypasses": 0, "common_fwdpUses_cachedCerts": 0, "common_fwdpUses_clicertFailBypasses": 0, "common_fwdpUses_conns": 0, "common_fwdpUses_dipBypasses": 0, "common_fwdpUses_hnBypasses": 0, "common_fwdpUses_sipBypasses": 0, "common_handshakeFailures": 0, "common_insecureHandshakeAccepts": 0, "common_insecureHandshakeRejects": 0, "common_insecureRenegotiationRejects": 0, "common_maxCompatConns": 0, "common_maxConns": 0, "common_maxNativeConns": 0, "common_midstreamRenegotiations": 0, "common_nonHwAcceleratedConns": 0, "common_ocspFwdpClientssl_cachedResp": 0, "common_ocspFwdpClientssl_certStatusReq": 0, "common_ocspFwdpClientssl_invalidCertResp": 0, "common_ocspFwdpClientssl_respstatusErrResp": 0, "common_ocspFwdpClientssl_revokedResp": 0, "common_ocspFwdpClientssl_stapledResp": 0, "common_ocspFwdpClientssl_unknownResp": 0, "common_partiallyHwAcceleratedConns": 0, "common_peercertInvalid": 0, "common_peercertNone": 0, "common_peercertValid": 0, "common_prematureDisconnects": 0, "common_protocolUses_dtlsv1": 0, "common_protocolUses_sslv2": 0, "common_protocolUses_sslv3": 0, "common_protocolUses_tlsv1": 0, "common_protocolUses_tlsv1_1": 0, "common_protocolUses_tlsv1_2": 0, "common_recordsIn": 0, "common_recordsOut": 0, "common_renegotiationsRejected": 0, "common_secureHandshakes": 0, "common_sessCacheCurEntries": 0, "common_sessCacheHits": 0, "common_sessCacheInvalidations": 0, "common_sessCacheLookups": 0, "common_sessCacheOverflows": 0, "common_sessionMirroring_failure": 0, "common_sessionMirroring_success": 0, "common_sesstickUses_reuseFailed": 0, "common_sesstickUses_reused": 0, "common_sniRejects": 0, "common_totCompatConns": 0, "common_totNativeConns": 0, "dynamicRecord_x1": 0, "dynamicRecord_x10": 0, "dynamicRecord_x11": 0, "dynamicRecord_x12": 0, "dynamicRecord_x13": 0, "dynamicRecord_x14": 0, "dynamicRecord_x15": 0, "dynamicRecord_x16": 0, "dynamicRecord_x2": 0, "dynamicRecord_x3": 0, "dynamicRecord_x4": 0, "dynamicRecord_x5": 0, "dynamicRecord_x6": 0, "dynamicRecord_x7": 0, "dynamicRecord_x8": 0, "dynamicRecord_x9": 0 } }');

      const getSslStatsStub = sinon.stub(bigStats, 'getSslStats')
        .withArgs(sslStatsArg1).resolves(sslStatsArg1Res)
        .withArgs(sslStatsArg2).resolves(sslStatsArg2Res)
        .withArgs(sslStatsArg3).resolves(sslStatsArg3Res);

      const promise = bigStats.buildLargeStatsObject(vipResourceList.body);
      promise.should.be.fulfilled.then((largeStatsObject) => {
        largeStatsObject.should.be.deep.equal(expectedLargeStats.device.tenants);
        sinon.assert.callCount(getMediumStatsObjStub, 1);
        sinon.assert.callCount(getSslStatsStub, 1);
        sinon.assert.callCount(utilStub.logDebug, 5);
      }).should.notify(done);
    });
  });

  describe('getPoolMemberStats', function () {
    it('should return stats for a specific pool member', function (done) {
      const expectedStats = JSON.parse('{"poolMemberResource": {"name": "10.1.20.17:80","path": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool/members/~Common~10.1.20.17:80?ver=13.1.1"},"poolMemberStats":{"id": "10.1.20.17:80","monitorStatus": 0,"serverside_bitsIn": 0,"serverside_bitsOut": 0,"serverside_curConns": 0,"serverside_maxConns": 0,"serverside_pktsIn": 0,"serverside_pktsOut": 0}}');
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(poolMemberStats);

      const promise = bigStats.getPoolMemberStats(JSON.parse('{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~Common~myPool/members/~Common~10.1.20.17:80?ver=13.1.1"}'));
      promise.should.be.fulfilled.then((poolMemberStats) => {
        poolMemberStats.should.be.deep.equal(expectedStats);
        sinon.assert.calledOnce(utilStub.logDebug);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');
      const promise = bigStats.getPoolMemberStats(JSON.parse('{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~Common~myPool/members/~Common~10.1.20.17:80?ver=13.1.1"}'));
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getPoolMemberStats(): something bad happened');
      }).should.notify(done);
    });
  });

  describe('getPoolResourceList', function () {
    it('should return a list of pool members', function (done) {
      const expectedStats = JSON.parse('[{ "name": "192.1.0.1:80", "path": "https://localhost/mgmt/tm/ltm/pool/myPool1/members/~Common~192.1.0.1:80?ver=13.1.1", "vip": { "destination": "/Common/192.1.0.1:80", "fullPath": "/Common/myApp1", "partition": "Common", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" }, "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1" } }, { "name": "192.1.0.2:80", "path": "https://localhost/mgmt/tm/ltm/pool/myPool1/members/~Common~192.1.0.2:80?ver=13.1.1", "vip": { "destination": "/Common/192.1.0.1:80", "fullPath": "/Common/myApp1", "partition": "Common", "pool": "/Common/myPool1", "poolReference": { "link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool1?ver=13.1.1" }, "selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myApp1?ver=13.1.1" } }]');
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(JSON.parse('{"body":{ "kind": "tm:ltm:pool:members:memberscollectionstate", "selfLink": "https://localhost/mgmt/tm/ltm/pool/myPool1/members?$select=name%2CselfLink&ver=13.1.1", "items": [{ "name": "192.1.0.1:80", "selfLink": "https://localhost/mgmt/tm/ltm/pool/myPool1/members/~Common~192.1.0.1:80?ver=13.1.1" }, { "name": "192.1.0.2:80", "selfLink": "https://localhost/mgmt/tm/ltm/pool/myPool1/members/~Common~192.1.0.2:80?ver=13.1.1" } ] }}'));
      const promise = bigStats.getPoolResourceList(vipResourceList.body.items[0]);
      promise.should.be.fulfilled.then((poolMemberList) => {
        poolMemberList.should.be.deep.equal(expectedStats);
        sinon.assert.calledThrice(utilStub.logDebug);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');
      const promise = bigStats.getPoolResourceList(vipResourceList.body.items[0]);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getPoolResourceList(): something bad happened');
      }).should.notify(done);
    });
  });

  describe('getVipResourceList', function () {
    it('should return a list of vip resources', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(vipResourceList);

      const promise = bigStats.getVipResourceList();
      promise.should.be.fulfilled.then((poolMemberList) => {
        poolMemberList.should.be.deep.equal(vipResourceList.body);
        sinon.assert.calledTwice(utilStub.logDebug);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');
      const promise = bigStats.getVipResourceList();
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getVipResourceList(): something bad happened');
      }).should.notify(done);
    });
  });

  describe('getVipStats', function () {
    // runs before each test in this block
    beforeEach(function (done) {
      config = {
        'hostVersion': '13.1.1',
        'hostname': 'server.f5.com',
        'destination': {
          'protocol': 'kafka',
          'kafka': {
            'topic': 'bob'
          },
          'address': '192.168.1.42',
          'port': 8080,
          'uri': '/stats'
        },
        'size': 'small',
        'interval': 10,
        'enabled': true,
        'debug': false
      };

      done();
    });

    it('should return formatted vip statistics', function (done) {
      const expectedStats = JSON.parse('{"id":"/Common/192.1.0.1:80","clientside_curConns":0,"clientside_maxConns":3,"clientside_bitsIn":8087416,"clientside_bitsOut":7753536,"clientside_pktsIn":17974,"clientside_pktsOut":17948}');
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(vipInfoStats);
      bigStats.config = config;

      const promise = bigStats.getVipStats(vipResourceList.body.items[0]);
      promise.should.be.fulfilled.then((stats) => {
        stats.should.be.deep.equal(expectedStats);
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');

      const promise = bigStats.getVipStats(vipResourceList.body.items[0]);

      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getVipStats() - Error retrieving vipResourceStats: something bad happened');
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });
  });

  describe('getVipProfileList', function () {
    it('should return a list of vips profiles', function (done) {
      const expectedList = ["f5-tcp-progressive", "http", "webtls01"];
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(vipProfileList);

      const promise = bigStats.getVipProfileList(vipResourceList.body.items[0]);
      promise.should.be.fulfilled.then((profileList) => {
        profileList.should.be.deep.equal(expectedList);
        sinon.assert.notCalled(utilStub.logDebug);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');

      const promise = bigStats.getVipProfileList(vipResourceList.body.items[0]);

      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getVipProfileList(): - Error retrieving VIP Profile List: something bad happened');
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });
  });

  describe('getSslProfileList', function () {
    it('should return a list of SSL profiles', function (done) {
      const expectedList = [{"name":"clientssl","fullPath":"/Common/clientssl"},{"name":"clientssl-insecure-compatible","fullPath":"/Common/clientssl-insecure-compatible"},{"name":"clientssl-secure","fullPath":"/Common/clientssl-secure"},{"name":"crypto-server-default-clientssl","fullPath":"/Common/crypto-server-default-clientssl"},{"name":"splitsession-default-clientssl","fullPath":"/Common/splitsession-default-clientssl"},{"name":"wom-default-clientssl","fullPath":"/Common/wom-default-clientssl"},{"name":"webtls01","fullPath":"/Sample_01/A01/webtls01"},{"name":"webtls02","fullPath":"/Sample_02/A02/webtls02"},{"name":"webtls03","fullPath":"/Sample_03/A03/webtls03"},{"name":"webtls04","fullPath":"/Sample_04/A04/webtls04"},{"name":"webtls05","fullPath":"/Sample_05/A05/webtls05"}];
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(clientSslProfileList);

      const promise = bigStats.getSslProfileList();
      promise.should.be.fulfilled.then((profileList) => {
        profileList.should.be.deep.equal(expectedList);
        sinon.assert.notCalled(utilStub.logDebug);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');

      const promise = bigStats.getSslProfileList();

      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getSslProfileList(): - Error retrieving SSL Profile List: something bad happened');
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });
  });
});
