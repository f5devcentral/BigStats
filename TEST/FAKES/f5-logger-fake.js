/*
 * Copyright (c) 2013-2016, F5 Networks, Inc. All rights reserved.
 * No part of this software may be reproduced or transmitted in any
 * form or by any means, electronic or mechanical, for any purpose,
 * without express written permission of F5 Networks, Inc.
 */
'use strict';

var f5logger = {};

f5logger.setup = function (options) { };

f5logger.getInstance = function (options) { return { info: function (message) { } }; };

module.exports = f5logger;
