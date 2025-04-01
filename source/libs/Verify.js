/************************
 * 验证
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CommomUtil = require('../libs/CommomUtil');



// const publicPem = fs.readFileSync(path.join(__dirname, '../rsa_public_key.pem'));
// const publicKey = publicPem.toString();

module.exports = {
    verify: function(data, signature, publicKey) {
        const verify = crypto.createVerify('SHA256');
        verify.update(data);

        let flag = verify.verify(publicKey, signature, 'hex');
        return flag;
    }
}
