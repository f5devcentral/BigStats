'use strict'

var proxyquire = require('proxyquire').noCallThru()

const assert = require('assert')
const mocha = require('mocha')
const sinon = require('sinon')

let bigstats
let httpExporterStub
let statsdExporterStub
let kafkaExporterStub

let lastLoggerInfoMessage

let loggerStub = {
  getInstance: function () {
    return {
      info: function (message) {
        lastLoggerInfoMessage = message
      }
    }
  }
}

describe('BigStats', function () {
  // runs once before all tests in this block
  mocha.before(function (done) {
    done()
  })

  // runs before each test in this block
  beforeEach(function () {
    // create stub for f5-logger dependency since it isn't available to the tests
    var BigStats = proxyquire('../../SRC/BigStats/nodejs/bigstats', {
      'f5-logger': loggerStub
    })
    bigstats = new BigStats()
    httpExporterStub = sinon.stub(bigstats, 'httpExporter').returns(0)
    statsdExporterStub = sinon.stub(bigstats, 'statsdExporter').returns(0)
    kafkaExporterStub = sinon.stub(bigstats, 'kafkaExporter').returns(0)
  })

  mocha.after(function (done) {
    done()
  })

  describe('replaceDotsSlashesColons', function () {
    it('should replace . / : with -', function () {
      const input = 'https://support.f5.com:80/kb/en-us/products/big-ip_apm/manuals/product/apm-visual-policy-editor-13-1-0/3.html#guid-bb209ab6-68ab-4bf0-9c82-ac5e767f5816'
      assert.strictEqual(bigstats.replaceDotsSlashesColons(input), 'https---support-f5-com-80-kb-en-us-products-big-ip_apm-manuals-product-apm-visual-policy-editor-13-1-0-3-html#guid-bb209ab6-68ab-4bf0-9c82-ac5e767f5816')
    })
  })

  describe('exportStats', function () {
    it.only('should call httpExporter when called with protocol "http"', function () {
      const protocol = 'http'
      bigstats.exportStats('', protocol)
      sinon.assert.calledOnce(httpExporterStub)
    })

    it.only('should call httpExporter when called with protocol "https"', function () {
      bigstats.exportStats('', 'https')
      sinon.assert.calledOnce(httpExporterStub)
    })

    it.only('should call statsdExporter when called with protocol "statsd"', function () {
      bigstats.exportStats('', 'statsd')
      sinon.assert.calledOnce(statsdExporterStub)
    })

    it.only('should call kafkaExporter when called with protocol "kafka"', function () {
      bigstats.exportStats('', 'kafka')
      sinon.assert.calledOnce(kafkaExporterStub)
    })

    it.only('should call logger info method when called with unknown protocol', function () {
      bigstats.exportStats('', 'kjhsdfkjhsdf')
      // TODO: find a way to stub out a proxyquire imported module method without resorting to this variable checking hackery
      assert.strictEqual(lastLoggerInfoMessage, '[BigStats] - Unrecognized \'protocol\'')
    })
  })
})
