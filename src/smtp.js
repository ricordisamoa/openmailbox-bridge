/**
 * Copyright (c) 2017 Ricordisamoa
 * Licensed under the European Union Public License 1.1
 */
'use strict';

const simpleParser = require('mailparser').simpleParser;
const OpenMailBox = require('./openmailbox.js');
const USER_AGENTS = require('./user-agents.js');

module.exports = {
    authMethods: ['PLAIN'],

    disabledCommands: ['STARTTLS'],

    onClose(session) {
        if (session.user === undefined) {
            console.log('unauthenticated user disconnected');
        } else {
            console.log(`${session.user.name} disconnected`);
        }
    },

    onAuth(auth, session, callback) {
        const parts = auth.username.split('@');
        if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
            throw new Error('Invalid email address');
        }
        const opmbx = new OpenMailBox(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
        opmbx.login(parts[1], parts[0], auth.password).then(() => {
            callback(null, {user: {name: auth.username, opmbx}});
        }).catch(err => {
            callback(err);
        });
    },

    onMailFrom(address, session, callback){
        if (session.user === undefined || address.address !== session.user.name){
            return callback(new Error('Not allowed to send mail'));
        }
        return callback();
    },

    onData(stream, session, callback) {
        simpleParser(stream).then(mail => {
            if (mail.from.value.length !== 1) {
                callback(new Error(`Unexpected number of 'From' addresses: ${mail.from.value.length}`));
                return;
            }
            if (mail.from.value[0].address !== session.envelope.mailFrom.address) {
                callback(new Error('Unexpected email address in \'From\''));
                return;
            }
            if (mail.to.value.length !== session.envelope.rcptTo.length) {
                callback(new Error(`Unexpected number of 'To' addresses: ${mail.to.value.length}`));
                return;
            }
            for (const [toIndex, toAddress] of mail.to.value.entries()) {
                if (toAddress.address !== session.envelope.rcptTo[toIndex].address) {
                    callback(new Error('Unexpected email address in \'To\''));
                    return;
                }
            }
            session.user.opmbx.send(mail).then(() => {
                callback();
            }).catch(err => {
                callback(err);
            });
        }).catch(err => {
            callback(err);
        });
    }
};
