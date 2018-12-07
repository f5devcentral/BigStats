'use strict';

var proxyquire = require('proxyquire').noCallThru();

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();

const util = require('./util-fake');

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
let getPoolResourceStub;
let getPoolMemberStatsStub;
let vipInfoStats = require('./data/vs-stats.json');
let hostInfoStats = require('./data/host-info-stats.json');
let vipResourceList = require('./data/filtered-vip-resource-list.json');
let poolMemberStats = require('./data/pool-member-stats.json');

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
        sinon.assert.calledOnce(exportStatsStub);
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
        sinon.assert.calledOnce(exportStatsStub);
      });
    });

    it('should error when requesting a large size', function () {
      config.size = 'large';
      bigStats.config = config;
      let getSettingsStub = sinon.stub(bigStats, 'getSettings').resolves(config);

      bigStats.pullStats();

      // TODO: This may reveal a limitation with the current design. pullStats is synchronous, but calls underlying functions that are async. When it completes, the promises underneath it are not resolved. Promises never resolve in the same tick they are created.
      setImmediate(() => {
        sinon.assert.calledOnce(getSettingsStub);
        sinon.assert.calledOnce(getDeviceStatsStub);
        sinon.assert.calledOnce(getVipResourceListStub);
        sinon.assert.calledWith(utilStub.logError, 'pullStats() - largeStats not yet implemented');
        sinon.assert.calledOnce(exportStatsStub);
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
    it('should return formatted device statistics', function (done) {
      const expectedStats = JSON.parse('{"device":{"memory":{"memoryTotal":8373641216,"memoryUsed":4419657280},"cpu0":{"fiveSecAvgIdle":85,"fiveSecAvgIowait":0,"fiveSecAvgIrq":0,"fiveSecAvgNiced":0,"fiveSecAvgRatio":11,"fiveSecAvgSoftirq":0,"fiveSecAvgStolen":0,"fiveSecAvgSystem":3,"fiveSecAvgUser":8},"cpu1":{"fiveSecAvgIdle":75,"fiveSecAvgIowait":0,"fiveSecAvgIrq":0,"fiveSecAvgNiced":0,"fiveSecAvgRatio":22,"fiveSecAvgSoftirq":0,"fiveSecAvgStolen":0,"fiveSecAvgSystem":7,"fiveSecAvgUser":14}}}');

      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(hostInfoStats);

      const promise = bigStats.getDeviceStats();
      promise.should.be.fulfilled.then(() => {
        bigStats.stats.should.be.deep.equal(expectedStats);
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
    it('should return formatted device statistics', function (done) {
      const expectedStats = require('./data/expected-small-stats.json');
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').resolves(JSON.parse('{"clientside_curConns":0,"clientside_maxConns":0,"clientside_bitsIn":0,"clientside_bitsOut":0,"clientside_pktsIn":0,"clientside_pktsOut":0}'));

      const promise = bigStats.buildSmallStatsObject(vipResourceList.body);
      promise.should.be.fulfilled.then(() => {
        bigStats.stats.should.be.deep.equal(expectedStats);
        sinon.assert.callCount(getVipStatsStub, 7);
        sinon.assert.callCount(utilStub.logDebug, 7);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').rejects('something bad happened');
      const promise = bigStats.buildSmallStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildSmallStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 7);
      }).should.notify(done);
    });
  });

  describe.skip('buildMediumStatsObject', function () {
    // runs once before each test in this block
    beforeEach(function (done) {
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').resolves(JSON.parse('{"clientside_curConns":0,"clientside_maxConns":0,"clientside_bitsIn":0,"clientside_bitsOut":0,"clientside_pktsIn":0,"clientside_pktsOut":0}'));

      getPoolResourceStub = sinon.stub(bigStats, 'getPoolResourceList').resolves(JSON.parse('[{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.17:80?ver=13.1.1"},{"name":"10.1.20.18:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.18:80?ver=13.1.1"}]'));
      getPoolResourceStub.withArgs(undefined).resolves();

      getPoolMemberStatsStub = sinon.stub(bigStats, 'getPoolMemberStats').callsFake((poolMemberResource) => {
        return new Promise((resolve, reject) => {
          const stats = { 'serverside_curConns': 0, 'serverside_maxConns': 0, 'serverside_bitsIn': 0, 'serverside_bitsOut': 0, 'serverside_pktsIn': 0, 'serverside_pktsOut': 0, 'monitorStatus': 0 };
          resolve(poolMemberResource.name === '10.1.20.17:80' ? { '10.1.20.17:80': stats } : { '10.1.20.18:80': stats });
        });
      });
      done();
    });

    it('should return formatted device statistics', function (done) {
      const expectedStats = require('./data/expected-medium-stats.json');

      const promise = bigStats.buildMediumStatsObject(vipResourceList.body);
      promise.should.be.fulfilled.then(() => {
        bigStats.stats.should.be.deep.equal(expectedStats);
        sinon.assert.callCount(getVipStatsStub, 7);
        sinon.assert.callCount(getPoolResourceStub, 7);
        sinon.assert.callCount(getPoolMemberStatsStub, 10);
        sinon.assert.callCount(utilStub.logDebug, 4);
      }).should.notify(done);
    });

    it('should not return when getVipStats error occurs', function (done) {
      getVipStatsStub.restore();
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').rejects('something bad happened');

      const promise = bigStats.buildMediumStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildMediumStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 7);
      }).should.notify(done);
    });

    it('should not return when getPoolMemberStats error occurs', function (done) {
      getPoolMemberStatsStub.restore();
      getPoolMemberStatsStub = sinon.stub(bigStats, 'getPoolMemberStats').rejects('something bad happened');

      const promise = bigStats.buildMediumStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildMediumStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 7);
      }).should.notify(done);
    });
  });

  describe('buildLargeStatsObject', function () {
    it('should log an error when called', function () {
      bigStats.buildLargeStatsObject(vipResourceList);

      sinon.assert.calledWith(utilStub.logDebug, 'buildLargeStatsObject() with vipResourceList: [object Object]');
      sinon.assert.calledWith(utilStub.logInfo, 'buildLargeStatsObject() is not yet implemented.');
    });
  });

  describe('getPoolMemberStats', function () {
    // TODO: modify the mocks to sequentially return different results about each pool member each time it is called
    it('should return stats for a specific pool member', function (done) {
      const expectedStats = JSON.parse('{"10.1.20.17:80":{"serverside_curConns":0,"serverside_maxConns":0,"serverside_bitsIn":0,"serverside_bitsOut":0,"serverside_pktsIn":0,"serverside_pktsOut":0,"monitorStatus":0}}');
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(poolMemberStats);

      const promise = bigStats.getPoolMemberStats(JSON.parse('{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.17:80?ver=13.1.1"}'));
      promise.should.be.fulfilled.then((poolMemberStats) => {
        poolMemberStats.should.be.deep.equal(expectedStats);
        sinon.assert.calledOnce(utilStub.logDebug);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').rejects('something bad happened');
      const promise = bigStats.getPoolMemberStats(JSON.parse('{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.17:80?ver=13.1.1"}'));
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getPoolMemberStats(): something bad happened');
      }).should.notify(done);
    });
  });

  describe('getPoolResourceList', function () {
    it('should return a list of pool members', function (done) {
      const expectedStats = JSON.parse('[{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.17:80?ver=13.1.1"},{"name":"10.1.20.18:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.18:80?ver=13.1.1"}]');
      sendGetStub = sinon.stub(bigStats.restRequestSender, 'sendGet').resolves(JSON.parse('{"body":{"kind":"tm:ltm:pool:members:memberscollectionstate","selfLink":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members?$select=name%2CselfLink&ver=13.1.1","items":[{"name":"10.1.20.17:80","selfLink":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.17:80?ver=13.1.1"},{"name":"10.1.20.18:80","selfLink":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.18:80?ver=13.1.1"}]}}'));

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
      const expectedStats = JSON.parse('{"clientside_curConns":0,"clientside_maxConns":0,"clientside_bitsIn":0,"clientside_bitsOut":0,"clientside_pktsIn":0,"clientside_pktsOut":0}');
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
});
