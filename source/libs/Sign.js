/************************
 * 签名
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CommomUtil = require('../libs/CommomUtil');


// const privatePem = fs.readFileSync(path.join(__dirname, '../rsa_private_key.pem'));
// const privateKey = privatePem.toString();


module.exports = {
    sign: function(data, privateKey) {
        const sign = crypto.createSign('SHA256');
        sign.update(data);

        let signature = sign.sign(privateKey, 'hex');
        return signature;
    }
}
