/*
*   BigStatsSettings:
*     Persisted State worker for storing settings.
*
*   N. Pearce, April 2018
*   http://github.com/npearce
*
*/
'use strict'

const logger = require('f5-logger').getInstance()
const os = require('os')
const Ajv = require('ajv')
const Util = require('./util')
const BigStatsSettingsSchema = require('./bigstats-schema.json')

class BigStatsSettings {
  constructor () {
    this.util = new Util('BigStatsSettings')
    this.state = {}
  }
  /**
   * handle onStart
   */
  onStart (success, error) {
    var that = this
    this.loadState(null, function (err, state) {
      if (err) {
        error(this.util.formatLogMessage(`Error loading state: ${err}`))
      } else {
        logger.info(this.util.formatLogMessage('State loaded.'))
        that.state = state
      }
    })
    success()
  }
  /**
   * handle onGet HTTP request
   */
  onGet (restOperation) {
    let hostname = os.hostname()
    let safeHostname = hostname.replace(/\./g, '-')
    this.state.config.hostname = safeHostname
    // Respond with the persisted state (config)
    restOperation.setBody(this.state)
    this.completeRestOperation(restOperation)
  }
  /**
   * handle onPost HTTP request
   */
  onPost (restOperation) {
    let input = restOperation.getBody()
    let newState = this.validateConfiguration(input)
    if (newState) {
      this.state = newState
      logger.info(this.util.formatLogMessage('Settings updated.'))
      restOperation.setBody(this.state)
      this.completeRestOperation(restOperation)
    } else {
      // Invalid input
      restOperation.fail(new Error(this.util.formatLogMessage('Error: Invalid/No state provided...')))
    }
  }
  /**
   * Check for some values, enforce some defaults. Uses Ajv JSON schema validator.
   *
   * @param {(object|string)} input
   *
   * @return {boolean}
   */
  validateConfiguration (input) {
    let jsonInput = this.isJson(input)
    if (jsonInput && typeof jsonInput.config !== 'undefined') {
      // Validate the input against the schema
      let ajv = new Ajv({ jsonPointers: true, allErrors: false, verbose: true, useDefaults: true })
      let validate = ajv.compile(BigStatsSettingsSchema)
      let valid = validate(jsonInput)
      if (valid === false) {
        const error = this.util.safeAccess(() => validate.errors[0].message, '')
        if (error !== '') {
          logger.info(this.util.formatLogMessage(`Validation error: ${this.translateAjvError(validate.errors[0])}`))
        } else {
          logger.info(this.util.formatLogMessage('Unknown validation error.'))
        }
        return false
      }
      return jsonInput
    } else {
      // isJson() returned false. Is ths even valid JSON??
      return false
    }
  }
  /**
   * If not an Object, can we parse it?
   *
   * @param {(object|string)} input
   *
   * @return {object}
   */
  isJson (input) {
    if (input && typeof input !== 'object') {
      try {
        input = JSON.parse(input)
      } catch (err) {
        logger.info(this.util.formatLogMessage(`Error: Unable to parse input: ${err}`))
        return
      }
    }
    return input
  }
  /**
   * handle /example HTTP request
   */
  getExampleState () {
    return {
      'config': {
        'destination': {
          'protocol': '[http|https|statsd|kafka]',
          'address': '[ip_address]',
          'port': '[tcp_port]',
          'uri': '[uri]'
        },
        'interval': '[seconds]',
        'enabled': true,
        'debug': false
      }
    }
  }
  /**
 * Format an Ajv schema validator message depending on category
 *
 * @param {*} errorDetail
 */
  translateAjvError (errorDetail) {
    switch (errorDetail.keyword) {
      case 'enum':
        return `${errorDetail.dataPath} ${errorDetail.message}. Specified value: ${errorDetail.data} (allowed value(s) are ${errorDetail.params.allowedValues}`
      case 'required':
      case 'format':
      case 'minimum':
      case 'maximum':
        return `${errorDetail.dataPath} ${errorDetail.message}`
      default:
        return errorDetail.message
    }
  }
}

BigStatsSettings.prototype.WORKER_URI_PATH = 'shared/bigstats_settings'
BigStatsSettings.prototype.isPublic = true
BigStatsSettings.prototype.isSingleton = true
BigStatsSettings.prototype.isPersisted = true

module.exports = BigStatsSettings
