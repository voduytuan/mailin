'use strict';

var child_process = require('child_process');
var shell = require('shelljs');
var Spamc = require('spamc');
var spamc = new Spamc();

/* Verify Python availability. */
var isPythonAvailable = shell.which('python');
if (!isPythonAvailable) {
    console.log('Python is not available. Dkim and spf checking is disabled.');
}

/* Verify spamc/spamassassin availability. */
var isSpamcAvailable = true;
if (!shell.which('spamassassin') || !shell.which('spamc')) {
    console.log('Either spamassassin or spamc are not available. Spam score computation is disabled.');
    isSpamcAvailable = false;
}

/* Provides high level mail utilities such as checking dkim, spf and computing
 * a spam score. */
module.exports = {
    /* @param rawEmail is the full raw mime email as a string. */
    validateDkim: function (rawEmail, callback) {
        if (!isPythonAvailable) {
            return callback(null, false);
        }

        var verifyDkim = child_process.spawn('python', ['python/verifydkim.py']);

        verifyDkim.stdout.on('data', function (data) {
            console.log(data.toString());
        });

        verifyDkim.on('close', function (code) {
            console.log('closed with return code ' + code);
            /* Convert return code to appropriate boolean. */
            return callback(null, !! !code);
        });

        verifyDkim.stdin.write(rawEmail);
        verifyDkim.stdin.end();
    },

    validateSpf: function (ip, address, host, callback) {
        if (!isPythonAvailable) {
            return callback(null, false);
        }

        var cmd = 'python python/verifyspf.py ' + ip + ' ' + address + ' ' + host;
        console.log(cmd);
        child_process.exec(cmd, function (err, stdout) {
            console.log(stdout);
            var code = 0;
            if (err) {
                code = err.code;
            }

            console.log('closed with return code ' + code);

            /* Convert return code to appropriate boolean. */
            return callback(null, !! !code);
        });
    },

    /* @param rawEmail is the full raw mime email as a string. */
    computeSpamScore: function (rawEmail, callback) {
        if (!isSpamcAvailable) {
            return callback(null, 0.0);
        }

        spamc.report(rawEmail, function (result) {
            if (!result) return callback(new Error('Unable to compute spam score.'));
            callback(null, result.spamScore);
        });
    }
};