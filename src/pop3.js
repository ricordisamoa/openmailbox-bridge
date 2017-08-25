/**
 * Copyright (c) 2017 Ricordisamoa
 * Licensed under the European Union Public License 1.1
 */
'use strict';

const Readable = require('stream').Readable;
const OpenMailBox = require('./openmailbox.js');
const USER_AGENTS = require('./user-agents.js');

const MAX_MESSAGES = 100;

module.exports = {
    onAuth(auth, session, callback) {
        const parts = auth.username.split('@');
        if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
            callback(new Error('Invalid email address'));
            return;
        }
        const opmbx = new OpenMailBox(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
        opmbx.login(parts[1], parts[0], auth.password).then(() => {
            callback(null, {user: {name: auth.username, opmbx}});
        }).catch(err => {
            callback(err);
        });
    },

    onListMessages(session, callback) {
        // only list messages in INBOX
        const mailbox = 'INBOX';
        session.user.opmbx.fetchMessages(mailbox, 1, MAX_MESSAGES).then(messages => {
            callback(null, {
                messages: messages
                    .map(message => ({
                        //id: message._id.toString(),
                        uid: message.uid,
                        mailbox: mailbox,
                        //size: message.size,
                        size: 0, // XXX
                        //flags: message.flags,
                        seen: message.seen
                    })),
                count: messages.length,
                //size: messages.reduce((acc, message) => acc + message.size, 0)
                size: 0 // XXX
            });
        }).catch(err => {
            callback(err);
        });
    },

    onFetchMessage(message, session, callback) {
        session.user.opmbx.fetchMessage(message).then(message => {
            const stream = new Readable();
            stream.push(message);
            stream.push(null);
            callback(null, stream);
        }).catch(err => {
            callback(err);
        });
    },

    onUpdate(update, session, callback) {
        session.user.opmbx.markAsSeen(update.seen).then(seenCount => {
            console.info(`POP3 [${session.user.name}] Marked ${seenCount} messages as seen`);
            session.user.opmbx.trashMessages(update.deleted).then(deleteCount => {
                console.info(`POP3 [${session.user.name}] Deleted ${deleteCount} messages`);
            }).catch(err => {
                console.error('POP3', err);
            });
        }).catch(err => {
            console.error('POP3', err);
        });

        // return callback without waiting for the update result
        setImmediate(callback);
    }
};
