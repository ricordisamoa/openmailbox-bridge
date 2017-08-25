/**
 * Copyright (c) 2017 Ricordisamoa
 * Licensed under the European Union Public License 1.1
 */
'use strict';

const request = require('request-promise-native');

class OpenMailBoxError extends Error {}

class CsrfTokenError extends OpenMailBoxError {}

class LoginError extends OpenMailBoxError {}

class AuthentificationFailedError extends LoginError {}

class LoginRequiredError extends OpenMailBoxError {}

/**
 * Interface with the OpenMailBox webmail.
 */
class OpenMailBox {

    /**
     * @param {string} userAgent
     */
    constructor(userAgent) {
        this.rootUrl = 'https://app.openmailbox.org';
        this.loginPage = 'https://app.openmailbox.org/login';
        this.loginUrl = 'https://app.openmailbox.org/requests/guest';
        this.webmailPage = 'https://app.openmailbox.org/webmail/';
        this.requestsUrl = 'https://app.openmailbox.org/requests/webmail';
        this.sendUrl = 'https://app.openmailbox.org/requests/webmail/send-message';
        this.userAgent = userAgent;
        this.tokenRegex = /<meta +name="csrf-token" +content="(.+?)">/;
        this.cookieJar = request.jar();
    }

    /**
     * Convert a message object as returned by mailparser's simpleParser
     * to an object accepted by OpenMailBox.
     */
    messageToObject(message) {
        if (message.attachments.length > 0) {
            throw new Error('Attachments not implemented');
        }
        const mapAddrs = addr => ({
            email: addr.address,
            name: (addr.name === '' ? null : addr.name)
        });
        return {
            to: message.to.value.map(mapAddrs),
            cc: message.cc ? message.cc.value.map(mapAddrs) : [],
            bcc: message.bcc ? message.bcc.value.map(mapAddrs) : [],
            subject: message.subject,
            type: message.html === false ? 'text/plain' : 'text/html',
            message_string: message.html === false ? message.text : message.html,
            joinedfiles: []
        };
    }

    /**
     * @param {string} page
     * @return {Promise<string>}
     */
    async getCsrfToken(page) {
        const options = {
            method: 'GET',
            uri: page,
            jar: this.cookieJar,
            headers: {
                'User-Agent': this.userAgent
            },
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.statusCode !== 200) {
            throw new CsrfTokenError(`Unexpected response status code: ${resp.statusCode}`);
        }
        const match = resp.body.match(this.tokenRegex);
        if (match === null) {
            throw new CsrfTokenError('csrf-token not found');
        }
        return match[1];
    }

    /**
     * @param {Object[]} messages
     * @return {Promise<number>}
     */
    async trashMessages(messages) {
        if (messages === undefined || messages.length === 0) {
            return 0;
        }
        const boxes = this.groupByMailbox(messages);
        for (const [mailbox, uids] of boxes) {
            await this.trashMessagesMailbox(mailbox, uids);
        }
        return messages.length;
    }

    /**
     * @private
     * @param {string} mailbox
     * @param {number[]} uids
     */
    async trashMessagesMailbox(mailbox, uids) {
        const csrfToken = await this.getCsrfToken(this.webmailPage);
        const headers = {
            'Origin': this.rootUrl,
            'User-Agent': this.userAgent,
            'X-CSRFToken': csrfToken,
            'Referer': this.webmailPage
        };
        const data = {
            mailbox: mailbox,
            dest: 'Trash',
            uids: uids.join('-'),
            action: 'move'
        };
        const options = {
            method: 'POST',
            uri: this.requestsUrl,
            jar: this.cookieJar,
            form: data,
            headers: headers,
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.headers['content-type'] !== 'application/json') {
            throw new OpenMailBoxError('Invalid response');
        }
        const result = JSON.parse(resp.body);
        if (result.exception !== undefined) {
            throw new OpenMailBoxError(result.error_info);
        }
        if (result.success !== 'the action was performed sucessfully') {
            throw new OpenMailBoxError('Unexpected response');
        }
    }

    /**
     * @param {Object[]} messages
     * @return {Map<string, number[]>}
     */
    groupByMailbox(messages) {
        const boxes = new Map();
        for (const message of messages) {
            if (boxes.has(message.mailbox)) {
                boxes.get(message.mailbox).push(message.uid);
            } else {
                boxes.set(message.mailbox, [message.uid]);
            }
        }
        return boxes;
    }

    /**
     * @param {Object[]} messages
     * @return {Promise<number>}
     */
    async markAsSeen(messages) {
        if (messages === undefined || messages.length === 0) {
            return 0;
        }
        const boxes = this.groupByMailbox(messages);
        for (const [mailbox, uids] of boxes) {
            await this.markAsSeenMailbox(mailbox, uids);
        }
        return messages.length;
    }

    /**
     * @private
     * @param {string} mailbox
     * @param {number[]} uids
     */
    async markAsSeenMailbox(mailbox, uids) {
        const csrfToken = await this.getCsrfToken(this.webmailPage);
        const headers = {
            'Origin': this.rootUrl,
            'User-Agent': this.userAgent,
            'X-CSRFToken': csrfToken,
            'Referer': this.webmailPage
        };
        const data = {
            mailbox: mailbox,
            uids: uids.join('-'),
            action: 'markasseen'
        };
        const options = {
            method: 'POST',
            uri: this.requestsUrl,
            jar: this.cookieJar,
            form: data,
            headers: headers,
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.headers['content-type'] !== 'application/json') {
            throw new OpenMailBoxError('Invalid response');
        }
        const result = JSON.parse(resp.body);
        if (result.exception !== undefined) {
            throw new OpenMailBoxError(result.error_info);
        }
        if (result.success !== 'the action was performed sucessfully') {
            throw new OpenMailBoxError('Unexpected response');
        }
    }

    /**
     * @param {Object} message
     * @return {Promise<string>}
     */
    async fetchMessage(message) {
        const params = {
            mailbox: message.mailbox,
            uid: message.uid,
            action: 'downloadmessage'
        };
        const options = {
            method: 'GET',
            uri: this.requestsUrl,
            qs: params,
            jar: this.cookieJar,
            headers: {
                'User-Agent': this.userAgent,
                'Referer': this.webmailPage
            },
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.statusCode !== 200) {
            throw new OpenMailBoxError(`Unexpected response status code: ${resp.statusCode}`);
        }
        if (resp.headers['content-type'] !== 'text/plain') {
            throw new OpenMailBoxError('Invalid response');
        }
        return resp.body;
    }

    /**
     * @param {string} mailbox
     * @param {number} rangeStart
     * @param {number} rangeEnd
     * @return {Promise<Object[]>}
     */
    async fetchMessages(mailbox, rangeStart, rangeEnd) {
        if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd)) {
            throw new OpenMailBoxError('Invalid range');
        }
        const csrfToken = await this.getCsrfToken(this.webmailPage);
        const params = {
            range: `${rangeStart}-${rangeEnd}`,
            sort: 'date',
            order: '1', // 0 = most recent messages first; 1 = least recent messages first
            selected: '',
            action: 'maillist',
            mailbox: mailbox
        };
        const options = {
            method: 'GET',
            uri: this.requestsUrl,
            qs: params,
            jar: this.cookieJar,
            headers: {
                'User-Agent': this.userAgent,
                'X-CSRFToken': csrfToken,
                'Referer': this.webmailPage
            },
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.headers['content-type'] !== 'application/json') {
            throw new OpenMailBoxError('Invalid response');
        }
        const result = JSON.parse(resp.body);
        if (result.partial_list === undefined) {
            throw new OpenMailBoxError('Unexpected response');
        }
        return result.partial_list;
    }

    /**
     * @param {Object} message Message object as returned by mailparser's simpleParser
     */
    async send(message) {
        const csrfToken = await this.getCsrfToken(this.webmailPage);
        const headers = {
            'Origin': this.rootUrl,
            'User-Agent': this.userAgent,
            'X-CSRFToken': csrfToken,
            'Referer': this.webmailPage
        };
        const data = {
            message: JSON.stringify(this.messageToObject(message)),
            action: 'sendmessage'
        };
        const options = {
            method: 'POST',
            uri: this.sendUrl,
            jar: this.cookieJar,
            form: data,
            headers: headers,
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.headers['content-type'] !== 'application/json') {
            throw new OpenMailBoxError('Invalid response');
        }
        const result = JSON.parse(resp.body);
        if (result.exception !== undefined) {
            if (result.exception === 'LoginRequired') {
                throw new LoginRequiredError(result.error_info);
            }
            throw new OpenMailBoxError(result.error_info);
        }
        if (result.success !== 'the action was performed sucessfully') {
            throw new OpenMailBoxError('Unexpected response');
        }
    }

    /**
     * Attempt login to OpenMailBox.
     *
     * @param {string} domain
     * @param {string} username
     * @param {string} password
     */
    async login(domain, username, password) {
        const csrfToken = await this.getCsrfToken(this.loginPage);
        const postHeaders = {
            'Origin': this.rootUrl,
            'User-Agent': this.userAgent,
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrfToken,
            'Referer': this.loginPage
        };
        const data = {
            domain: domain,
            name: username,
            password: password,
            action: 'login'
        };
        const options = {
            method: 'POST',
            uri: this.loginUrl,
            jar: this.cookieJar,
            form: data,
            headers: postHeaders,
            resolveWithFullResponse: true,
            simple: false
        };
        const resp = await request(options);
        if (resp.headers['content-type'] !== 'application/json') {
            throw new LoginError('Invalid response');
        }
        const result = JSON.parse(resp.body);
        if (result.exception !== undefined) {
            if (result.exception === 'AuthentificationFailed') {
                throw new AuthentificationFailedError(result.error_info);
            }
            throw new LoginError(result.error_info);
        }
        if (resp.statusCode !== 200) {
            throw new LoginError(`Unexpected response status code: ${resp.statusCode}`);
        }
    }

}

module.exports = OpenMailBox;
