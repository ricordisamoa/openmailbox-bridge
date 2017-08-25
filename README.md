Receive and send emails from your OpenMailBox free account with your favorite email client.

## Background

On 5th August 2017, [openmailbox.org](https://www.openmailbox.org/) removed IMAP/POP/SMTP access from free accounts.

This Node.js-based POP3/SMTP server allows you to keep using OpenMailBox with any compliant email client. Under the hood, it interfaces with the [webmail](https://app.openmailbox.org/webmail/) via HTTPS requests.

## Usage

Node.js versions lower than 8.x may not work.

Run `npm install` to fetch dependencies.

Since some operating systems may prevent the use of port numbers up to 1023 by non-root users, POP3 and SMTP are by default served on ports 2110 and 2587, respectively.

Custom port numbers are supported via command-line arguments, for example:

```
node server.js --pop3=110 --smtp=587
```

You can also disable individual protocols by passing `no` instead of the port number.

This will only start the SMTP server:

```
node server.js --pop3=no
```

Make sure to update POP3 and/or SMTP server addresses in your email client's settings.

## Not (yet) supported

* IMAP
* Sending attachments
* SSL/TLS/STARTTLS

## Caveats

This program is highly experimental. It is not screened for security issues. It is not recommended to expose the server over the Internet.
