/*
*   Util:
*     Collection of helper functions for BigStats modules.
*
*   D. Edgar, September 2018
*   http://github.com/aknot242
*
*/

'use strict';
const logger = require('f5-logger');

var Util = { };

Util.init = function (moduleName) {
  this.moduleName = moduleName;
  this.debugEnabled = false;
  this.loggerInstance = logger.getInstance();
};

Util.debugEnabled = this.debugEnabled;

/**
 * Logging helper used to log info messages
 * @param {*} message The info message to log
 */
Util.logInfo = function (message) {
  this.loggerInstance.info(this.formatMessage(message));
};

/**
 * Logging helper used to log debug messages
 * @param {*} message The debug message to log
 */
Util.logDebug = function (message) {
  this.loggerInstance.info(this.formatMessage(message, 'DEBUG'));
};

/**
 * Logging helper used to log error messages
 * @param {*} message The error message to log
 */
Util.logError = function (message) {
  this.loggerInstance.info(this.formatMessage(message, 'ERROR'));
};

/**
 * String formatting helper for log messages
 * @param {*} message The message to format
 */
Util.formatMessage = function (message, classifier) {
  classifier = typeof classifier !== 'undefined' ? ` - ${classifier}` : '';
  return `[${this.moduleName}${classifier}] - ${message}`;
};

/**
 * Safely access object and property values without having to stack up safety checks for undefined values
 * @param {*} func A function that encloses the value to check
 * @param {*} fallbackValue A default value that is returned if any of the values in the object heirarchy are undefined
 */
Util.safeAccess = function (func, fallbackValue) {
  try {
    return func();
  } catch (e) {
    return fallbackValue;
  }
};

module.exports = Util;
