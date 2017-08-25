/**
 * Copyright (c) 2017 Ricordisamoa
 * Licensed under the European Union Public License 1.1
 */
'use strict';

const start = require('./src/server.js');

if (require.main === module) {
    start(process.argv);
}
