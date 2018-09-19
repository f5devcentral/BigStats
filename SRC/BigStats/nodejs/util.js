/*
*   Util:
*     Collection of helper functions for BigStats modules.
*
*   D. Edgar, September 2018
*   http://github.com/npearce
*
*/

'use strict'

class Util {
  constructor (moduleName) {
    this.moduleName = moduleName
  }

  /**
   * String formatting helper for log messages per module
   * @param {*} message The message to log
   */
  formatLogMessage (message) {
    return `[${this.moduleName}] - ${message}`
  }

  /**
   * Safely access object and property values without having to stack up safety checks for undefined values
   * @param {*} func A function that encloses the value to check
   * @param {*} fallbackValue A default value that is returned if any of the values in the object heirarchy are undefined
   */
  safeAccess (func, fallbackValue) {
    try {
      return func()
    } catch (e) {
      return fallbackValue
    }
  }
}

module.exports = Util
