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
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').resolves(JSON.parse('{"device": {"id": "ip-172-31-1-20-us-west-1-compute-internal","tenants": [{"id": "Common","services": [{"id": "/Common/172.31.10.20:80","clientside_curConns": 0,"clientside_maxConns": 0,"clientside_bitsIn": 0,"clientside_bitsOut": 0,"clientside_pktsIn": 0,"clientside_pktsOut": 0}]},{"id": "Tenant_01/App1","services": [{"id": "/Tenant_01/172.31.4.11:80","clientside_curConns": 0,"clientside_maxConns": 0,"clientside_bitsIn": 0,"clientside_bitsOut": 0,"clientside_pktsIn": 0,"clientside_pktsOut": 0}]},{"id": "Tenant_02/App2","services": [{"id": "/Tenant_02/172.31.4.21:443","clientside_curConns": 0,"clientside_maxConns": 0,"clientside_bitsIn": 0,"clientside_bitsOut": 0,"clientside_pktsIn": 0,"clientside_pktsOut": 0}]},{"id": "Tenant_03/App3","services": [{"id": "/Tenant_03/172.31.4.31:80","clientside_curConns": 0,"clientside_maxConns": 0,"clientside_bitsIn": 0,"clientside_bitsOut": 0,"clientside_pktsIn": 0,"clientside_pktsOut": 0}]}]}}'));
      const promise = bigStats.buildSmallStatsObject(vipResourceList.body);
      promise.should.be.fulfilled.then(() => {
        // bigStats.stats.should.be.deep.equal(expectedStats); //FIXME: new object model stuff with unique 'id' breaks this test.
        sinon.assert.callCount(getVipStatsStub, 6);
        sinon.assert.callCount(utilStub.logDebug, 6);
      }).should.notify(done);
    });

    it('should not return when error occurs', function (done) {
      getVipStatsStub = sinon.stub(bigStats, 'getVipStats').rejects('something bad happened');
      const promise = bigStats.buildSmallStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildSmallStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 6);
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

  describe.skip('buildLargeStatsObject', function () {
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

      const promise = bigStats.buildLargeStatsObject(vipResourceList.body);
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

      const promise = bigStats.buildLargeStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildLargeStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 7);
      }).should.notify(done);
    });

    it('should not return when getPoolMemberStats error occurs', function (done) {
      getPoolMemberStatsStub.restore();
      getPoolMemberStatsStub = sinon.stub(bigStats, 'getPoolMemberStats').rejects('something bad happened');

      const promise = bigStats.buildLargeStatsObject(vipResourceList.body);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'buildLargeStatsObject(): something bad happened');
        sinon.assert.callCount(getVipStatsStub, 7);
      }).should.notify(done);
    });
  });

  describe('getPoolMemberStats', function () {
    // TODO: modify the mocks to sequentially return different results about each pool member each time it is called
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
      const expectedStats = JSON.parse('[{"name":"10.1.20.17:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.17:80?ver=13.1.1","vip":{"destination": "/Common/172.31.10.20:80","fullPath": "/Common/myVIP","partition": "Common","pool": "/Common/myPool","poolReference":{"link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool?ver=13.1.1"},"selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myVIP?ver=13.1.1"}},{"name":"10.1.20.18:80","path":"https://localhost/mgmt/tm/ltm/pool/~DVWA~Application_1~web_pool/members/~DVWA~10.1.20.18:80?ver=13.1.1","vip":{"destination": "/Common/172.31.10.20:80","fullPath": "/Common/myVIP","partition": "Common","pool": "/Common/myPool","poolReference":{"link": "https://localhost/mgmt/tm/ltm/pool/~Common~myPool?ver=13.1.1"},"selfLink": "https://localhost/mgmt/tm/ltm/virtual/~Common~myVIP?ver=13.1.1"}}]');
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
      const expectedStats = JSON.parse('{"id":"/Common/172.31.10.20:80","clientside_curConns":0,"clientside_maxConns":0,"clientside_bitsIn":0,"clientside_bitsOut":0,"clientside_pktsIn":0,"clientside_pktsOut":0}');
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