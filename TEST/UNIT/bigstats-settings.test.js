'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();

const util = require('./util-fake');

const defaultValidationHeader = 'Validation error:';

let utilStub;
let sendGetStub;
let settings;
let vipResourceList;
let hostVersionInfo;

describe('BigStatsSettings', function () {
  describe('getHostVersion', function () {
    // runs before each test in this block
    beforeEach(function (done) {
      vipResourceList = require('./data/vip-resource-list.json');
      hostVersionInfo = require('./data/host-version.json');

      let moduleUnderTest = '../../SRC/BigStats/nodejs/bigstats-settings';
      utilStub = sinon.createStubInstance(util);
      const BigStatsSettings = proxyquire(moduleUnderTest, { './util': utilStub });
      settings = new BigStatsSettings();

      settings.restHelper = {};
      settings.restHelper.makeRestnodedUri = sinon.spy();
      settings.createRestOperation = sinon.spy();
      settings.restRequestSender = { sendGet: function () { }, sendPost: function () { } };

      done();
    });

    it('getHostVersion should return version 13.1.1', function (done) {
      sendGetStub = sinon.stub(settings.restRequestSender, 'sendGet').resolves(hostVersionInfo);

      const promise = settings.getHostVersion(vipResourceList.items[0]);
      promise.should.be.fulfilled.then((version) => {
        version.should.equal('13.1.1');
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });

    it('getHostVersion should not return when error occurs', function (done) {
      sendGetStub = sinon.stub(settings.restRequestSender, 'sendGet').rejects('something bad happened');

      const promise = settings.getHostVersion(vipResourceList.items[0]);
      promise.should.be.rejected.then(() => {
        sinon.assert.calledWith(utilStub.logError, 'getHostVersion(): Error: something bad happened');
        sinon.assert.calledOnce(sendGetStub);
      }).should.notify(done);
    });
  });

  describe('validateConfiguration', function () {
    // runs before each test in this block
    beforeEach(function (done) {
      let moduleUnderTest = '../../SRC/BigStats/nodejs/bigstats-settings';
      utilStub = sinon.createStubInstance(util);
      const BigStatsSettings = proxyquire(moduleUnderTest, { './util': utilStub });
      settings = new BigStatsSettings();
      done();
    });

    afterEach(function (done) {
      sinon.resetHistory();
      done();
    });

    it('should be invalid', function () {
      settings.validateConfiguration('').should.be.equal(false);
    });

    it('should be valid', function () {
      let json = {
        'config': {
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
        }
      };

      settings.validateConfiguration(json).should.be.deep.equal(json);
    });

    it('should enforce minimum value for interval', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'address': '192.168.1.42',
            'port': 8080,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 8,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
    });

    it('should use default values if not provided', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'address': '192.168.1.42',
            'port': 8080,
            'uri': '/stats'
          }
        }
      };

      let expectedJson = {
        'config': {
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
        }
      };

      settings.validateConfiguration(json).should.be.deep.equal(expectedJson);
    });

    it('should fail validation if the destination object is missing', function () {
      let json = {
        'config': {
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config should have required property 'destination'`);
    });

    it('should fail validation if the protocol property is missing', function () {
      let json = {
        'config': {
          'destination': {
            'address': '192.168.1.42',
            'port': 8080,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination should have required property 'protocol'`);
    });

    it('should fail validation if the protocol property is not set to an expected value', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'blah',
            'address': '192.168.1.42',
            'port': 8080,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination/protocol should be equal to one of the allowed values. Specified value: blah (allowed value(s) are http,https,statsd,kafka`);
    });

    it('should fail validation if the messageTemplate property is set to an incorrect type', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'kafka',
            'messageTemplate': 42,
            'address': '192.168.1.42',
            'port': 8080,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination/messageTemplate should be string`);
    });

    it('should fail validation if the protocol property is set to kafka, but the topic is set to an invalid value', function () {
      let json = {
        'config': {
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
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination/kafka/topic should be equal to one of the allowed values. Specified value: bob (allowed value(s) are all,partition`);
    });

    it('should fail validation if the address property is missing', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'port': 8080,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination should have required property 'address'`);
    });

    it('should fail validation if the address property is not a valid ipv4 address', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'address': '192.168.1.422',
            'port': 8080,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination/address should match format "ipv4"`);
    });

    it('should fail validation if the port property is missing', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'address': '192.168.1.42',
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination should have required property 'port'`);
    });

    it('should enforce minimum value for port', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'address': '192.168.1.42',
            'port': 0,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination/port should be >= 1`);
    });

    it('should enforce maximum value for port', function () {
      let json = {
        'config': {
          'destination': {
            'protocol': 'http',
            'address': '192.168.1.42',
            'port': 65536,
            'uri': '/stats'
          },
          'size': 'small',
          'interval': 10,
          'enabled': true,
          'debug': false
        }
      };

      settings.validateConfiguration(json).should.be.equal(false);
      sinon.assert.calledWith(utilStub.logError, `${defaultValidationHeader} /config/destination/port should be <= 65535`);
    });
  });
});
