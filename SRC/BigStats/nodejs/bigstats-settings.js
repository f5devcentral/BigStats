/*
*   BigStatsSettings:
*     Persisted State worker for storing settings.
*
*   N. Pearce, April 2018
*   http://github.com/npearce
*
*/
'use strict';

const os = require('os');
const Ajv = require('ajv');
const BigStatsSettingsSchema = require('./bigstats-schema-0.5.0.json');
const util = require('./util');

function BigStatsSettings () {
  this.state = {};
  util.init('BigStatsSettings');
}

/**
 * handle onStart
 */
BigStatsSettings.prototype.onStart = function (success, error) {
  var that = this;
  this.loadState(null, function (err, state) {
    if (err) {
      util.logInfo(`Error loading state: ${err}`);
    } else {
      util.logInfo('State loaded.');
      that.state = state;
    }
  });
  success();
};

/**
 * handle onGet HTTP request
 */
BigStatsSettings.prototype.onGet = function (restOperation) {
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
};

/**
 * Indetify the host version that BigStats is running on
 */
BigStatsSettings.prototype.getHostVersion = function () {
  return new Promise((resolve, reject) => {
    let path = '/mgmt/tm/sys/version';
    var url = this.restHelper.makeRestnodedUri(path);
    var restOp = this.createRestOperation(url);
    this.restRequestSender.sendGet(restOp)
      .then((resp) => {
        let version = resp.body.entries['https://localhost/mgmt/tm/sys/version/0'].nestedStats.entries.Version.description;
        resolve(version);
      })
      .catch((err) => {
        util.logError(`getHostVersion(): Error: ${err}`);
        reject(err);
      });
  });
};

/**
 * handle onPost HTTP request
 */
BigStatsSettings.prototype.onPost = function (restOperation) {
  let input = restOperation.getBody();
  let newState = this.validateConfiguration(input);
  if (newState) { // HANDLE !input - you are calling validate.
    this.state = newState;
    util.logInfo('Settings updated.');
    restOperation.setBody(this.state);
    this.completeRestOperation(restOperation);
  } else {
    // Invalid input
    restOperation.fail(new Error(util.formatMessage('Error: Invalid/No state provided...')));
  }
};

/**
 * Check for some values, enforce some defaults. Uses Ajv JSON schema validator.
 *
 * @param {(object|string)} input
 *
 * @return {boolean}
 */
BigStatsSettings.prototype.validateConfiguration = function (input) {
  let jsonInput = this.isJson(input);
  // Validate the input against the schema
  let ajv = new Ajv({ jsonPointers: true, allErrors: false, verbose: true, useDefaults: true });
  let validate = ajv.compile(BigStatsSettingsSchema);
  let valid = validate(jsonInput);
  if (valid === false) {
    const error = util.safeAccess(() => validate.errors[0].message, '');
    if (error !== '') {
      util.logError(`Validation error: ${this.translateAjvError(validate.errors[0])}`);
    } else {
      util.logError('Unknown validation error.');
    }
    return false;
  }
  return jsonInput;
};

/**
 * If not an Object, can we parse it?
 *
 * @param {(object|string)} input
 *
 * @return {object}
 */
BigStatsSettings.prototype.isJson = function (input) {
  if (input && typeof input !== 'object') {
    try {
      input = JSON.parse(input);
    } catch (err) {
      util.logInfo(`Error: Unable to parse input: ${err}`);
      return;
    }
  }
  return input;
};

BigStatsSettings.prototype.createRestOperation = function (uri, body) {
  var restOp = this.restOperationFactory.createRestOperationInstance()
    .setUri(uri)
    .setContentType('application/json')
    .setIdentifiedDeviceRequest(true);

  if (body) {
    restOp.setBody(body);
  }

  return restOp;
};

/**
* Format an Ajv schema validator message depending on category
*
* @param {*} errorDetail
*/
BigStatsSettings.prototype.translateAjvError = function (errorDetail) {
  switch (errorDetail.keyword) {
    case 'enum':
      return `${errorDetail.dataPath} ${errorDetail.message}. Specified value: ${errorDetail.data} (allowed value(s) are ${errorDetail.params.allowedValues}`;
    case 'required':
    case 'format':
    case 'minimum':
    case 'maximum':
    case 'type':
      return `${errorDetail.dataPath} ${errorDetail.message}`;
    default:
      return errorDetail.message;
  }
};

BigStatsSettings.prototype.WORKER_URI_PATH = 'shared/bigstats_settings';
BigStatsSettings.prototype.isPublic = true;
BigStatsSettings.prototype.isSingleton = true;
BigStatsSettings.prototype.isPersisted = true;

module.exports = BigStatsSettings;
