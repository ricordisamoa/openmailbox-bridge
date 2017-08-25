/**
 * Copyright (c) 2017 Ricordisamoa
 * Licensed under the European Union Public License 1.1
 */
'use strict';

const POP3Server = require('./lib/pop3-server.js');
const pop3 = require('./pop3.js');
const SMTPServer = require('smtp-server').SMTPServer;
const smtp = require('./smtp.js');

class PortError extends Error {}

/**
 * @param {string} str
 * @return {string|number}
 */
function port(str) {
    if (str === 'no') {
        return str;
    }
    const num = Number(str);
    if (Number.isNaN(num)) {
        throw new PortError('Port number is not a number');
    }
    if (!Number.isInteger(num)) {
        throw new PortError('Port number is not an integer');
    }
    if (num < 0 || num > 65535) {
        throw new PortError('Invalid port number');
    }
    return num;
}

/**
 * @param {string[]} argv
 */
function main(argv) {
    const program = require('commander'); // eslint-disable-line global-require

    program
        .option('--pop3 <POP3>', 'port number for the POP3 server, or `no` to disable', port, 2110)
        .option('--smtp <SMTP>', 'port number for the SMTP server, or `no` to disable', port, 2587);

    try {
        program.parse(argv);
    } catch (err) {
        if (err instanceof PortError) {
            console.log(`\n  error: ${err.message}\n`);
            return;
        }
        throw err;
    }

    if (program.pop3 !== 'no') {
        const server = new POP3Server(pop3);
        server.listen(program.pop3);
        console.log(`POP3 server running on port ${program.pop3}`);
    }
    if (program.smtp !== 'no') {
        const server = new SMTPServer(smtp);
        server.listen(program.smtp);
        console.log(`SMTP server running on port ${program.smtp}`);
    }
}

module.exports = main;
