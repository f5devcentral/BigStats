'use strict';

function Util () { }

Util.prototype.init = function (moduleName) { };

Util.prototype.logInfo = function (message) { };

Util.prototype.logDebug = function (message) { };

Util.prototype.logError = function (message) { };

Util.prototype.formatMessage = function (message, classifier) { };

Util.prototype.safeAccess = function (func, fallbackValue) { };

module.exports = Util;
