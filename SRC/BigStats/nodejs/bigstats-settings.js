/*
*   BigStatsSettings:
*     Persisted State worker for storing settings.
*
*   N. Pearce, April 2018
*   http://github.com/npearce
*
*/
'use strict';

const logger = require('f5-logger').getInstance();
const os = require('os');
const Ajv = require('ajv');
const Util = require('./util');
<<<<<<< HEAD
const util = new Util('BigStatsSettings');

=======
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
const BigStatsSettingsSchema = require('./bigstats-schema.json');

class BigStatsSettings {
  constructor () {
<<<<<<< HEAD
=======
    this.util = new Util('BigStatsSettings');
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
    this.state = {};
  }

  /**
   * handle onStart
   */
  onStart (success, error) {
    var that = this;
    this.loadState(null, function (err, state) {
      if (err) {
<<<<<<< HEAD
        logger.info(`[BigStatsSettings - ERROR] Error loading state: ${err}`);
      } else {
        logger.info('[BigStatsSettings] State loaded.');
=======
        error(this.util.formatLogMessage(`Error loading state: ${err}`));
      } else {
        logger.info(this.util.formatLogMessage('State loaded.'));
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
        that.state = state;
      }
    });
    success();
  }

  /**
   * handle onGet HTTP request
   */
  onGet (restOperation) {
<<<<<<< HEAD
    this.getHostVersion()
    .then((version) => {

      let hostname = os.hostname();
      let safeHostname = hostname.replace(/\./g, '-');
      this.state.config.hostname = safeHostname;    
      this.state.config.hostVersion = version;
       // Respond with the persisted state (config)
      restOperation.setBody(this.state);
      this.completeRestOperation(restOperation);
    });

  }

  getHostVersion () {
    return new Promise((resolve,reject) => {
      let path = '/mgmt/tm/sys/version';
      var url = this.restHelper.makeRestnodedUri(path);
      var restOp = this.createRestOperation(url);
      this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        let version = resp.body.entries["https://localhost/mgmt/tm/sys/version/0"].nestedStats.entries.Version.description;
        resolve(version);
      })
      .catch((err) => {
        reject('\n\ngetHostVersion(): ERR' +err);
      });
    });
=======
    let hostname = os.hostname();
    let safeHostname = hostname.replace(/\./g, '-');
    this.state.config.hostname = safeHostname;
    // Respond with the persisted state (config)
    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
  }
  /**
   * handle onPost HTTP request
   */
  onPost (restOperation) {
    let input = restOperation.getBody();
    let newState = this.validateConfiguration(input);
    if (newState) {
      this.state = newState;
<<<<<<< HEAD
      logger.info('[BigStatsSettings] Settings updated.');
=======
      logger.info(this.util.formatLogMessage('Settings updated.'));
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
      restOperation.setBody(this.state);
      this.completeRestOperation(restOperation);
    } else {
      // Invalid input
<<<<<<< HEAD
      restOperation.fail(new Error('[BigStatsSettings - ERROR] Error: Invalid/No state provided...'));
=======
      restOperation.fail(new Error(this.util.formatLogMessage('Error: Invalid/No state provided...')));
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
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
    let jsonInput = this.isJson(input);
    if (jsonInput && typeof jsonInput.config !== 'undefined') {
      // Validate the input against the schema
      let ajv = new Ajv({ jsonPointers: true, allErrors: false, verbose: true, useDefaults: true });
      let validate = ajv.compile(BigStatsSettingsSchema);
      let valid = validate(jsonInput);
      if (valid === false) {
<<<<<<< HEAD
        const error = util.safeAccess(() => validate.errors[0].message, '');
        if (error !== '') {
          logger.info(`[BigStatsSettings] Validation error: ${this.translateAjvError(validate.errors[0])}`);
        } else {
          logger.info('[BigStatsSettings] Unknown validation error.');
=======
        const error = this.util.safeAccess(() => validate.errors[0].message, '');
        if (error !== '') {
          logger.info(this.util.formatLogMessage(`Validation error: ${this.translateAjvError(validate.errors[0])}`));
        } else {
          logger.info(this.util.formatLogMessage('Unknown validation error.'));
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
        }
        return false;
      }
      return jsonInput;
    } else {
      // isJson() returned false. Is ths even valid JSON??
      return false;
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
        input = JSON.parse(input);
      } catch (err) {
<<<<<<< HEAD
        logger.info(`[BigStatsSettings - ERROR] Error: Unable to parse input: ${err}`);
=======
        logger.info(this.util.formatLogMessage(`Error: Unable to parse input: ${err}`));
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
        return;
      }
    }
    return input;
  }
<<<<<<< HEAD

  createRestOperation (uri, body) {

    var restOp = this.restOperationFactory.createRestOperationInstance()
      .setUri(uri)
      .setContentType("application/json")
      .setIdentifiedDeviceRequest(true);

    if (body) {
      restOp.setBody(body);
    }

    return restOp;

=======
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
    };
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
  }

  /**
 * Format an Ajv schema validator message depending on category
 *
 * @param {*} errorDetail
 */
  translateAjvError (errorDetail) {
    switch (errorDetail.keyword) {
      case 'enum':
        return `${errorDetail.dataPath} ${errorDetail.message}. Specified value: ${errorDetail.data} (allowed value(s) are ${errorDetail.params.allowedValues}`;
      case 'required':
      case 'format':
      case 'minimum':
      case 'maximum':
        return `${errorDetail.dataPath} ${errorDetail.message}`;
      default:
        return errorDetail.message;
    }
  }
}

BigStatsSettings.prototype.WORKER_URI_PATH = 'shared/bigstats_settings';
BigStatsSettings.prototype.isPublic = true;
BigStatsSettings.prototype.isSingleton = true;
BigStatsSettings.prototype.isPersisted = true;

<<<<<<< HEAD
module.exports = BigStatsSettings;
=======
module.exports = BigStatsSettings;
>>>>>>> 96b6e7c23ec16b4291e3aec19973d1de5bd3208e
