/**
 * Created by poplang on 2023/1/3.
 */

// const { randomBytes } = require('crypto')
// const crypto = require('crypto');
// const secp256k1 = require('secp256k1')
// const bs58 = require(`bs58`);

/**
 * 使用bs58Encode编码
 * @type {bs58Encode}
 */
const key_util = {}
window.key_util = key_util

key_util.bs58Encode = bs58Encode;
function bs58Encode(msg)
{
    var MSG = bs58.encode(msg);
    return MSG;
}
/**
 * 使用bs58Decode解码
 * @type {bs58Decode}
 */
key_util.bs58Decode = bs58Decode;
function bs58Decode(msg)
{
    //处理sign包含了recid的情况
    if(msg && msg.indexOf('-')>0) msg = msg.split('-')[0]

    var MSG = bs58.decode(msg);
    return MSG;
}

/**
 * 使用hashName进行内容签名，得到hash值
 * @type {hashVal}
 */
key_util.hashVal = hashVal;
async function hashVal(msg,hashName = 'SHA-256')
{
    // var msg_hash = crypto.createHash(hashName).update(msg).digest('hex');
    const encoder = new TextEncoder()//将字符串转码为utf8编码的unit8Array
    let a = await window.crypto.subtle.digest(
    {
        name: hashName//"SHA-256",
    },
    new Uint8Array(encoder.encode(msg)))//[1,2,3,4,6,7,8,9,10]))

    //console.log('a:',a)
    const tx = new Uint8Array(a)//Secp256k1.uint256(new Uint8Array(a), 16)
    let txStr = Secp256k1.uint256(tx, 16).toString(16)
    //let t = bs58.encode(tx)

    return msg_hash = txStr;
    // return bs58Encode(Buffer.from(msg_hash));
}

/**
 * 生成新的private_key
 * @type {newPrivateKey}
 */
key_util.newPrivateKey = newPrivateKey;
function newPrivateKey()
{
    // generate privKey
    // let privKey
    // do {
    //     privKey = randomBytes(32) //其实是一个buffer，二进制的buffer。
    //     //privKey = randomBytes(32) //其实是一个buffer，二进制的buffer。
    // } while (!secp256k1.privateKeyVerify(privKey))

    // //console.log("privKey:"+privKey+" length:"+privKey.length+" typeof:"+(typeof privKey))
    const privateKeyBuf = window.crypto.getRandomValues(new Uint8Array(32))
    let privateKey = Secp256k1.uint256(privateKeyBuf, 16)
    let prikey = bs58.encode( new Uint8Array((''+privateKey.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    console.log('privateKey:'+privateKey.toString(16)+' len:'+privateKey.toString(16).length)
    // privateKey ='9a9a6539856be209b8ea2adbd155c0919646d108515b60b7b13d6a79f1ae5174'
    // console.log('privateKey:'+privateKey+' len:'+privateKey.length)
    // prikey = bs58.encode( new Uint8Array((privateKey).match(/.{1,2}/g).map(byte => parseInt(byte, 16))) )
    console.log('prikey:'+prikey+' len:'+prikey.length)

    /**https://www.programcreek.com/python/example/94569/secp256k1.PublicKey
     * out = b"\x04"
			out += pubkey.x.to_bytes(32, 'big')
			out += pubkey.y.to_bytes(32, 'big')
			self.pubkey = PublicKey(out, raw=True) 

            https://learnblockchain.cn/article/1526
            未压缩格式：G=04 79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798 483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
压缩格式：
G = 02 79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798
压缩格式中标志位是02，可知G点y坐标是偶数。
至于为什么选择02，03，04作为标志呢？工程实现习惯而已，不必纠结。由于椭圆曲线中公钥是一个点，所以一般公钥表示使用压缩格式
https://learnblockchain.cn/article/1526    

参照：
https://blog.csdn.net/QQ604666459/article/details/82497414
Private key: 9a9a6539856be209b8ea2adbd155c0919646d108515b60b7b13d6a79f1ae5174
Public key : [X(188ac3f1c6bbbc336fdc33cb5e605ff7c3ee2d36249933b0322220a616a11fb3):
    Y(40a609475afa1f9a784cad0db5d5ba7dbaab2147a5d7b9bbde4d1334a0e40a5e)]
Compressed key  : 0340a609475afa1f9a784cad0db5d5ba7dbaab2147a5d7b9bbde4d1334a0e40a5e
Uncompressed key: 0440a609475afa1f9a784cad0db5d5ba7dbaab2147a5d7b9bbde4d1334a0e40a5e188ac3f1c6bbbc336fdc33cb5e605ff7c3ee2d36249933b0322220a616a11fb3
————————————————
*/
    // Generating public key
    // const publicKey = Secp256k1.generatePublicKeyFromPrivateKeyData(Secp256k1.uint256(new Uint8Array((''+privateKey.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16)))),16)//privateKey)
    // const pubX = Secp256k1.uint256(publicKey.x, 16)
    // // const pubY = Secp256k1.uint256(publicKey.y, 16)
    // console.log('publicKey:'+JSON.stringify(publicKey))
    // console.log('pubX-16:'+JSON.stringify(pubX.toString(16)))
    // let puby = (''+publicKey.y)
    // let flagStr = puby.substring(puby.length-2,puby.length)
    // const flagInt =  Secp256k1.uint256(flagStr, 16)
    // console.log('flagInt:'+flagInt+' %2:'+(flagInt%2))
    // const flagT = flagInt%2 == 0 ?'02':'03'
    // console.log(puby+' publicKey.y.len：'+puby.length+' flag-str:'+puby.substring(puby.length-2,puby.length))  
    // //let flag =  publicKey.y.substring()
    // let pubXStr = bs58.encode( new Uint8Array((flagT+pubX.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // // let pubYStr = bs58.encode( new Uint8Array((''+pubY.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // // let pubkey = bs58.encode( new Uint8Array((publicKey.x+publicKey.y).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // console.log('pubXStr:'+pubXStr+' len:'+pubXStr.length)
    // // console.log('pubYStr:'+pubYStr+' len:'+pubYStr.length)
    // // console.log('pubkey:'+pubkey+' len:'+pubkey.length)
    // console.log('prikey:'+prikey+' len:'+prikey.length)
    return prikey//{private_key:prikey,public_key:pubXStr}
    // return bs58Encode(privKey);
}

/**
 * 生态新的publicKey
 * @type {getPublicKey}
 */
key_util.getPublicKey = getPublicKey;
function getPublicKey(privateKey){
    // var privKey = bs58Decode(privateKey);
    // var pubKey = secp256k1.publicKeyCreate(privKey);
    // pubKeyStr = bs58Encode(pubKey);

    // return pubKeyStr

    let privateKeyBuf = bs58Decode(privateKey)//bs58.encode( new Uint8Array((''+privateKey.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    console.log('privateKeyBuf:'+privateKeyBuf+' len:'+privateKeyBuf.length)
    // privateKey ='9a9a6539856be209b8ea2adbd155c0919646d108515b60b7b13d6a79f1ae5174'
    // console.log('privateKey:'+privateKey+' len:'+privateKey.length)
    // prikey = bs58.encode( new Uint8Array((privateKey).match(/.{1,2}/g).map(byte => parseInt(byte, 16))) )
    // console.log('prikey:'+prikey+' len:'+prikey.length)

    /**https://www.programcreek.com/python/example/94569/secp256k1.PublicKey
     * out = b"\x04"
			out += pubkey.x.to_bytes(32, 'big')
			out += pubkey.y.to_bytes(32, 'big')
			self.pubkey = PublicKey(out, raw=True) 

            https://learnblockchain.cn/article/1526
            未压缩格式：G=04 79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798 483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
压缩格式：
G = 02 79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798
压缩格式中标志位是02，可知G点y坐标是偶数。
至于为什么选择02，03，04作为标志呢？工程实现习惯而已，不必纠结。由于椭圆曲线中公钥是一个点，所以一般公钥表示使用压缩格式
https://learnblockchain.cn/article/1526    

参照：
https://blog.csdn.net/QQ604666459/article/details/82497414
Private key: 9a9a6539856be209b8ea2adbd155c0919646d108515b60b7b13d6a79f1ae5174
Public key : [X(188ac3f1c6bbbc336fdc33cb5e605ff7c3ee2d36249933b0322220a616a11fb3):
    Y(40a609475afa1f9a784cad0db5d5ba7dbaab2147a5d7b9bbde4d1334a0e40a5e)]
Compressed key  : 0340a609475afa1f9a784cad0db5d5ba7dbaab2147a5d7b9bbde4d1334a0e40a5e
Uncompressed key: 0440a609475afa1f9a784cad0db5d5ba7dbaab2147a5d7b9bbde4d1334a0e40a5e188ac3f1c6bbbc336fdc33cb5e605ff7c3ee2d36249933b0322220a616a11fb3
————————————————
*/
    // Generating public key
    //new Uint8Array((''+privateKey.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    const publicKey = Secp256k1.generatePublicKeyFromPrivateKeyData(Secp256k1.uint256(privateKeyBuf,16))//privateKey)
    const pubX = Secp256k1.uint256(publicKey.x, 16)
    // const pubY = Secp256k1.uint256(publicKey.y, 16)
    console.log('publicKey:'+JSON.stringify(publicKey))
    console.log('pubX-16:'+JSON.stringify(pubX.toString(16)))
    let puby = (''+publicKey.y)
    let flagStr = puby.substring(puby.length-2,puby.length)
    const flagInt =  Secp256k1.uint256(flagStr, 16)
    console.log('flagInt:'+flagInt+' %2:'+(flagInt%2))
    const flagT = flagInt%2 == 0 ?'02':'03'
    console.log(puby+' publicKey.y.len：'+puby.length+' flag-str:'+puby.substring(puby.length-2,puby.length))  
    //let flag =  publicKey.y.substring()
    let pubXStr = bs58.encode( new Uint8Array((flagT+pubX.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // let pubYStr = bs58.encode( new Uint8Array((''+pubY.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // let pubkey = bs58.encode( new Uint8Array((publicKey.x+publicKey.y).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    console.log('pubXStr:'+pubXStr+' len:'+pubXStr.length)
    // console.log('pubYStr:'+pubYStr+' len:'+pubYStr.length)
    // console.log('pubkey:'+pubkey+' len:'+pubkey.length)
    console.log('prikey:'+privateKeyBuf+' len:'+privateKeyBuf.length)

    return pubXStr

    /**这里会导致递归问题（invalidateKeys里会调用　getPublicKey）
    //2019-1-4新增判断
    if(invalidateKeys(privateKey,pubKeyStr))
        return pubKeyStr;
    else
        return null;
    */
}
/**
 * prikey:GfUgJumbkkvCcqVzJqDVXTYr2Tu3ShaQknW77wE2chME len:44
RPCApiUtil.js?62ee:42 pubXStr:2cN7ft3HBJEN7zHU8z1J6YV7KhpEmQUXQvrXPLh1eo7k len:44
RPCApiUtil.js?62ee:43 pubYStr:6bGb6SE7GBDFd68BcGYoZq9BdTaYLNPuRmQ6duzeAm1V len:44
 */
//  console.log('get-pubkey:'+getPublicKey('GfUgJumbkkvCcqVzJqDVXTYr2Tu3ShaQknW77wE2chME'))
//  let hash = hashVal('helloadfasdfasdf  world')
//  console.log('hash-val:'+hash)
//  let sign = signMsg(hash,'GfUgJumbkkvCcqVzJqDVXTYr2Tu3ShaQknW77wE2chME')
//  let p0 = recoverPublickey(sign,hash,0)
//  let p1 = recoverPublickey(sign,hash,1)
// //  let p2 = recoverPublickey(sign,hash,2)
//  let verify = verifySignMsg(hash,sign,'d4zrfTYUmPhuG9rJbLMtUz69ph6tFpciP2mB7BYYghcJ')
//  let verify1 = verifySignMsg(hash,sign,'d4zrfTYUmPhuG9rJbLMtUz69ph6tFpciP2mB7BYYghcJ')
//  console.log('p0:'+p0)
//  console.log('p1:'+p1)
// //  console.log('p2:'+p2)
//  console.log('verify:',verify,verify1)
//3sTUU1AcgwUqN6QBZNyBoTA3JS4qVLY2znedobZitwXzthkE56A91fUGiTyAuNWKokhkzPAkgwVgY1JWmi6rdqWV  
//45082ced08c1271150ad106abab2e0613c13cf5c377073204a8d8165893eed67
key_util.recoverPublickey = recoverPublickey;
function recoverPublickey(sign,hash,num=0)
{
    console.log('recoverPublickey-sign:'+sign+' hash:'+hash)
    if((''+sign).indexOf('-')>0)
    {
        let arr = (''+sign).split('-')
        sign = arr[0]
        num = parseInt(arr[1])
    }
    console.log('num:'+num)
    // let results=[]
    // //for(let i=0;i<=0;i++)
    // results.push( secp256k1.ecdsaRecover(bs58Decode(sign),0,Buffer.from(hash,'hex')))
    // return results
    let digest = Secp256k1.uint256(hash,16)
    let signArr = bs58.decode(sign)
    let sigR = Secp256k1.uint256(signArr.slice(0,32),16)
    let sigS = Secp256k1.uint256(signArr.slice(32,64),16)
    console.log('sigR:'+sigR.length+' signS:'+sigS.length+' sign:'+signArr.length)
    let publicKey = Secp256k1.ecrecover(num,sigR,sigS,digest)//recId, sigr, sigs, message) 

    const pubX = Secp256k1.uint256(publicKey.x, 16)
    // const pubY = Secp256k1.uint256(publicKey.y, 16)
    console.log('publicKey:'+JSON.stringify(publicKey))
    console.log('pubX-16:'+JSON.stringify(pubX.toString(16)))
    let puby = (''+publicKey.y)
    let flagStr = puby.substring(puby.length-2,puby.length)
    const flagInt =  Secp256k1.uint256(flagStr, 16)
    console.log('flagInt:'+flagInt+' %2:'+(flagInt%2))
    const flagT = flagInt%2 == 0 ?'02':'03'
    console.log(puby+' publicKey.y.len：'+puby.length+' flag-str:'+puby.substring(puby.length-2,puby.length))  
    //let flag =  publicKey.y.substring()
    let pubXStr = bs58.encode( new Uint8Array((flagT+pubX.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // let pubYStr = bs58.encode( new Uint8Array((''+pubY.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    // let pubkey = bs58.encode( new Uint8Array((publicKey.x+publicKey.y).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    console.log('pubXStr:'+pubXStr+' len:'+pubXStr.length)
    return pubXStr
//    try{
//        return bs58Encode(secp256k1.ecdsaRecover(bs58Decode(sign),num,Buffer.from(hash,'hex')))
//    }catch(ex){return null}
}

// let rets = recoverPublickey('3sTUU1AcgwUqN6QBZNyBoTA3JS4qVLY2znedobZitwXzthkE56A91fUGiTyAuNWKokhkzPAkgwVgY1JWmi6rdqWV',
//     '45082ced08c1271150ad106abab2e0613c13cf5c377073204a8d8165893eed67',1)
// let rets1 = recoverPublickey('LPzxgz89Dpq5jPYnnf9iGW7tLQbP6p7bubtEKaAzjEP3HmPjwaYgaNtdS1y1dPx3LjHzWSb4F9v6ncbANq5t5n7',
//     'fd441b99deda764e558d57bb050c3f1aa1a646411c2b966862a74ff92dc2e1db',0)
// let rets2= recoverPublickey('5TT35YLGcoZvVCqjgVGGQQnTEwSsfWdLEJGmtwt3MgD7XQqQ72zDq3zQMK7rRAYSuV3vnmG4mQ9EdJPGrVbhoVUe','53592a58ac6bd0871f04aa38b1f31b183baadef441f33b7591e4f267029dc78a',1)
// console.log('rets:',rets2)
// let rets3 = recoverPublickey('39FvTRKwuP8dBYM6rpTQB6EQTcakd52QveoSRHQ6FcYdjwZwVWkMT1ohkce72AJBviA1xqRFaCFJYQwbJS3AZpdR','cf34d0823a8745695c3dd396bdf62edf888e051df04e0c7246c3becd37baf34e',0)
// let rets4 = recoverPublickey('39FvTRKwuP8dBYM6rpTQB6EQTcakd52QveoSRHQ6FcYdjwZwVWkMT1ohkce72AJBviA1xqRFaCFJYQwbJS3AZpdR','cf34d0823a8745695c3dd396bdf62edf888e051df04e0c7246c3becd37baf34e',1)

// console.log('rets:',rets3,rets4)
// let public_key = getPublicKey('9TBqaV4Y5jeUmqTBb8Hw4yZtgjFCxFC4LAeNPsFC33HD')
// console.log('public:'+public_key)

// v0 = verifySignMsg('cf34d0823a8745695c3dd396bdf62edf888e051df04e0c7246c3becd37baf34e','39FvTRKwuP8dBYM6rpTQB6EQTcakd52QveoSRHQ6FcYdjwZwVWkMT1ohkce72AJBviA1xqRFaCFJYQwbJS3AZpdR',rets3)
// v1 = verifySignMsg('cf34d0823a8745695c3dd396bdf62edf888e051df04e0c7246c3becd37baf34e','39FvTRKwuP8dBYM6rpTQB6EQTcakd52QveoSRHQ6FcYdjwZwVWkMT1ohkce72AJBviA1xqRFaCFJYQwbJS3AZpdR',rets4)
// console.log(v0,v1)

// let rets5 = recoverPublickey('55TLcBntXXJWjTjBEiDsrYsB68V7wbuEREBu4tAjJxF9vRqvGkusPq8SzbmGBp4azxWHsnw1CYt21h4v8ek1bEs2','62c163c5983dfcddc5305494443ab6ba31b0b77b76a546ed50e21edf09847148',1)
// console.log('rets5:',rets5)

// let pkey = getPublicKey('462xmEi8fSTDKmamEbSANJrqJLn6eK194YQLPNJDukXW')
// let h = hashVal('helloddfddddd')
// let s = signMsg(h,'462xmEi8fSTDKmamEbSANJrqJLn6eK194YQLPNJDukXW')
// let rpkey = recoverPublickey(s,h,0)
// console.log('recvL',pkey,h,s,rpkey)

// let pkey = getPublicKey('4tCqkbeEeaFrbVfo7TtRQ9jZbBmcVDrUg2wmrKkJPmdt')
// let h = hashVal('helloddfddddd----------------msg')
// let s = signMsg(h,'462xmEi8fSTDKmamEbSANJrqJLn6eK194YQLPNJDukXW')
// let rpkey = recoverPublickey(s,h,0)
// console.log('recvL',pkey,h,s,rpkey)
// console.log('veri',verifySignMsg(h,s,'22GGBPygHw9DQMHT3MauAjxNzjFLYZ7eosbMeVy5LmDEC'))

// let rpkey = recoverPublickey('56DRSp1gsXkKw4GHzfP7Y7uKkuYjZYVH6XbCfwSWynM29xC2e4jC88scvBrf6njhcMJRaVxtbyBQre8u8ufRshNj-0','be9d26a196f1d8169f9f58eb131e6cc33b22c3e537038644fbb18b81575a2908',0)
// console.log('rpkey',rpkey)
// rpkey = recoverPublickey('2NpQJ3TTvJQ4NqsAeZk7RRKJDUmsbUYsnL1BEkd8sHzaYQYgLvzgD3xwDyhZyowtqRe6aUfrvfFzrKNYjnsCgjaE-1','c3d7d73e8677153a746236b5cc21f67f7643feb06f986ac752880bb85b9e524d')
// console.log('rpkey',rpkey)

// let rpkey = recoverPublickey('4sGKMhTMzYFKcyskqgzvwyei45r8BRperXjHfT6oitbAiH12ZT6YQMr267LSMpYmCnyAVygrXGofJRXXDomK7MiX','490f0088a410705749628ecfb0dfd474052baf6057edfd971ee2f4f5156efd49')
// console.log('rpkey',rpkey)
// rpkey = recoverPublickey('4sGKMhTMzYFKcyskqgzvwyei45r8BRperXjHfT6oitbAiH12ZT6YQMr267LSMpYmCnyAVygrXGofJRXXDomK7MiX','490f0088a410705749628ecfb0dfd474052baf6057edfd971ee2f4f5156efd49',1)
// console.log('rpkey',rpkey)

// let buf0 = bs58Decode('j2wouBvh96UdnCfd8QisYjaUUkhDouaiPYQKe3eaFFyv')
// // let buf1 = bs58Decode('2Hy5Y3i8L5B54QQcLEvEf3hhdLkj9uS3RBAsREcC55nFxrS')
// let buf2 = bs58Decode('22GGBPygHw9DQMHT3MauAjxNzjFLYZ7eosbMeVy5LmDEC')
// console.log('buf0.len:'+buf0.length,buf0)
// // console.log('buf1.len:'+buf1.length,buf1)
// console.log('buf1.len:'+buf2.length,buf2)

//2022-11-11成功设置recid和辨别了public-key中浏览器与node.js的不同（浏览器的public_key缺少了02、03标志位）
// let pkey = getPublicKey('6zBN1j89ozjFRZzVGJRz5aXv7BzBPMuu3aUJwmZ4Ua6a')
// let h = hashVal('helloddfddddd----------------msg'+Math.random())
// let s = signMsg(h,'6zBN1j89ozjFRZzVGJRz5aXv7BzBPMuu3aUJwmZ4Ua6a')
// let rpkey = recoverPublickey(s,h,0)
// console.log('recvL',pkey,h,s,rpkey)
// s = s.split('-')[0]
// console.log('veri',verifySignMsg(h,s,'nP9oz4GxYVxNgKnqCtaBgPk7nqyz2QDgN7jkGdRyKtRY'))

// let buf0 = bs58Decode('nP9oz4GxYVxNgKnqCtaBgPk7nqyz2QDgN7jkGdRyKtRY')
// // let buf1 = bs58Decode('29C4cvbYgbr8rPDkRw6MQ1CSgVi9pxSgD7BLBszpznXZw')
// let buf2 = bs58Decode('nP9oz4GxYVxNgKnqCtaBgPk7nqyz2QDgN7jkGdRyKtRY')
// console.log('buf0.len:'+buf0.length,buf0)
// // console.log('buf1.len:'+buf1.length,buf1)
// console.log('buf1.len:'+buf2.length,buf2)

// console.log('getHavedRecidSign:',getHavedRecidSign(h,s,'nP9oz4GxYVxNgKnqCtaBgPk7nqyz2QDgN7jkGdRyKtRY'))

//注意 首字符uint8Array 是偶数，则为03，是奇数，则是02
/**
pubX-16:"4d7cb19c257bb78e64a00e061dcb2df99402783a1c722a25476291b9eac31fa4"
RPCApiUtil.js?62ee:70 pubXStr:yuRnVpAi2Dm8XLWGMH2qBKxYtsbF86zDpoPtUzmYBjXq len:44
recid:0
recvL yuRnVpAi2Dm8XLWGMH2qBKxYtsbF86zDpoPtUzmYBjXq a70816919985c48654e0b6dff46dc607594931446318626b1359b036ab677e9f 3hFhDAoGqbtT8yf516PxXvuzNdBNZXR1yhrEwmXsztWEsw3ejZaw5awov9sTVwp9MhBr4qoMFVHGPhD6YdQ4Pygo yuRnVpAi2Dm8XLWGMH2qBKxYtsbF86zDpoPtUzmYBjXq
veri true
buf0.len:33 <Buffer 03 4d 7c b1 9c 25 7b b7 8e 64 a0 0e 06 1d cb 2d f9 94 02 78 3a 1c 72 2a 25 47 62 91 b9 ea c3 1f a4>
buf1.len:33 <Buffer 03 4d 7c b1 9c 25 7b b7 8e 64 a0 0e 06 1d cb 2d f9 94 02 78 3a 1c 72 2a 25 47 62 91 b9 ea c3 1f a4>


参考：https://learnblockchain.cn/article/1526
未压缩格式：G=04 79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798 483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
压缩格式：
G = 02 79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798
压缩格式中标志位是02，可知G点y坐标是偶数。

*/


// let pkey = getPublicKey('BQWLM2Buwc74s14e3Juiby3WYQ3SJgQk2bnKqLE5DT8w')
// let h = hashVal('helloddfddddd')
// let s = signMsg(h,'BQWLM2Buwc74s14e3Juiby3WYQ3SJgQk2bnKqLE5DT8w')
// let rpkey = recoverPublickey(s,h,0)
// console.log('recvL',pkey,h,s,rpkey)
// //2022-11-10解决此问题 node.js-public-x ====brower.secp256k1.js-publicKey.x+'0x03'beforeTheHead
// let buf0 = bs58Decode('5MMwHYmVVWy9Pod5a5CSGkMfFSwg14SNfoBJtaj5khN5')
// let buf1 = bs58Decode('2Hy5Y3i8L5B54QQcLEvEf3hhdLkj9uS3RBAsREcC55nFxrS')
// let buf2 = bs58Decode('y3K3mv2HsfBT73yLFbjKrQmDzvseEgef7x3HUM1PJZ6u')
// console.log('buf0.len:'+buf0.length,buf0)
// console.log('buf1.len:'+buf1.length,buf1)
// console.log('buf1.len:'+buf2.length,buf2)
// console.log('ver:',verifySignMsg(h,s,'y3K3mv2HsfBT73yLFbjKrQmDzvseEgef7x3HUM1PJZ6u'))

/*
recid:0
recvL y3K3mv2HsfBT73yLFbjKrQmDzvseEgef7x3HUM1PJZ6u 0864dda33b78cbebdecdb1c46e77d87227cf8d1d38e1fc6b125c5957c566ae83 29KyAh3sA3T4ApX7CA24J9Nk3B8NKT2aUkBPE5VyYc1bu2B6d2942k6xbg4XdNLbkrgWHwA8Qor4vNpQrVr7mhox y3K3mv2HsfBT73yLFbjKrQmDzvseEgef7x3HUM1PJZ6u
buf0.len:32 <Buffer 40 a6 09 47 5a fa 1f 9a 78 4c ad 0d b5 d5 ba 7d ba ab 21 47 a5 d7 b9 bb de 4d 13 34 a0 e4 0a 5e>
buf1.len:34 <Buffer 39 2c ef 9a a6 b4 bd 1c c4 ca 68 fe b3 6c f4 f2 80 cc ed e1 ef fc 39 bd a4 fc 51 e9 b7 90 84 5e ef ef>
buf1.len:33 <Buffer 03 40 a6 09 47 5a fa 1f 9a 78 4c ad 0d b5 d5 ba 7d ba ab 21 47 a5 d7 b9 bb de 4d 13 34 a0 e4 0a 5e>
*/
// console.log('ver',verifySignMsg(h,s,'GdxCGfsqQkhE3Jgxp24fFVzKh1qn7Ku2HopNBRjicsq3'))
// console.log('ver1',verifySignMsg(h,s,'5WooXwTTzp663stfeT5Fayz2dCQtGKiQ4h4dPN8MKjWW'))


// let pkey = getPublicKey('9aoXNbJVQLWQnGdNBYJFikuuLVgGdiiEKgPWaYae5prE')
// let h = hashVal('helloddfddddd')
// let s = signMsg(h,'9aoXNbJVQLWQnGdNBYJFikuuLVgGdiiEKgPWaYae5prE')
// let rpkey = recoverPublickey(s,h,1)
// console.log('recvL',pkey,h,s,rpkey)

// let okey = rpkey
// //根据内容不一样，recoverPublic的recv-id也不一样，但是无论如何，使用旧的rpkey，都能成功恢复 (变化了就不能versign成功了)
// h = hashVal('hedasdfasdfasdfasdfadsfasdflldafsdgfadsgadgasdfasdfasdgadgasdgfasdfo')
// s = signMsg(h,'9aoXNbJVQLWQnGdNBYJFikuuLVgGdiiEKgPWaYae5prE')
// rpkey = recoverPublickey(s,h,0)
// console.log('recvL',pkey,h,s,rpkey)
// console.log('verL',verifySignMsg(h,s,okey))
/*//2022-11-9成功验证了access.key和token.key的fork出来的wallet_token_info有效进行了签名，并且可以recoverPublickey恢复之
{"txid":"txid_21SSbRqwTa8T9pwr","token_x":"rmb_acc29LuHxjTmZtGB","token_y":"rmb_0000000000000000","opcode":"fork","opval":"dG6S6NcvdgiuKRdqpm3Et6GyUw2pDKGrB9e6Bu8FLtzY","extra_data":"token_key","timestamp_i":"1667984681","token_state":"[\"rmb_0000000000000000\"]","token_height":0,"public_key":"dG6S6NcvdgiuKRdqpm3Et6GyUw2pDKGrB9e6Bu8FLtzY"}
*/
/**
 * 签名内容
 * @type {signMsg}
 */
key_util.signMsg = signMsg;
function signMsg(msg,privKey){

    // private_key =  bs58Decode(privKey);
    // //console.log("private_key:"+private_key+" length:"+private_key.length+" typeof:"+(typeof private_key))

    // var sigObj = secp256k1.ecdsaSign(Buffer.from(msg,"hex"),private_key)//sign
    // //return sigObj.signature;
    // console.log('recid:'+sigObj.recid)
    // //2022-11-11新增
    // return bs58Encode(sigObj.signature)+'-'+sigObj.recid

    let hash = msg//''+sha256(TXJSON);// (''+sha256(TXJSON)).toUpperCase();//得到hash值
    console.log('hash:'+hash+' len:'+hash.length+' keys-secp256k1:'+(Object.keys(Secp256k1)))
    //console.log('hex-len:'+('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8').length)
    const digest = Secp256k1.uint256(hash, 16)
    let prikey = Secp256k1.uint256(bs58.decode(privKey),16)//
    console.log('hash:'+hash+' digest:'+digest+' prikey:'+prikey)//' private_key:'+private_key+

    let sign = Secp256k1.ecsign(prikey, digest)//key_util.signMsg(hash,'4bmmY1VEj8FjAVLGYhrt4AtvMisXRj2YDNNYHryjogPV');
    console.log('sign:'+JSON.stringify(sign))
    let web3_sign= bs58.encode( new Uint8Array((sign.r+sign.s).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))+'-'+sign.v
    return web3_sign
}

/**
 * 验证签名
 * @type {verifySignMsg}
 */
key_util.verifySignMsg = verifySignMsg;
function verifySignMsg(msg, signature, pubKey)
{
    if(pubKey==null) return false
    //2022-11-11新增
//    signature = signature && (''+signature).indexOf('-')>0 ? (''+signature).split('-')[0]:signature
//    console.log(' verifySignMsg',signature)
//     pubKey = bs58Decode(pubKey);
//     signature = bs58Decode(signature)
   let public_key =  recoverPublickey(signature,msg)
   console.log('public_key:'+public_key+' pubKey:'+pubKey)
   return (public_key ==  pubKey)
   // return secp256k1.ecdsaVerify( signature,Buffer.from(msg,'hex'), pubKey);//verify
}

key_util.getHavedRecidSign = getHavedRecidSign;
function getHavedRecidSign(msg, signature, pubKey)
{
    if((''+signature).indexOf('-')>0) return signature

   for(let i=0;i<4;i++)
   {
       let pkey = recoverPublickey(signature,msg,i)
       if(pkey==pubKey) return signature+'-'+i
   }
   //无法添加recv-id，也不影响，直接返回即可
   return signature
}

/**
 * 判断keys是否ok正确
 * @type {invalidateKeys}
 */
key_util.invalidateKeys = invalidateKeys;
function invalidateKeys(privateKey,publicKey)
{
    if(privateKey && publicKey ) {
        let pub_key ="";
        try {
            pub_key = getPublicKey(privateKey);
        }catch(err){
            console.log("invalidateKeys-error:"+err);
            return false;
        }

        if (pub_key.length <= 0 || ("" + pub_key) != publicKey)
            return false;
        else
            return true;
    }
    else{
        return false;
    }
}

/**
 * 检测签名和hash是否符合格式要求
 * @type {validateHashORSign}
 */
key_util.validateHashORSign = validateHashORSign
function validateHashORSign(hashOrSign)
{
    //2022-11-11新增（因为有了-recid）
   hashOrSign = (''+hashOrSign)
   hashOrSign = hashOrSign.indexOf('-')>0 ? hashOrSign.split('-')[0]:hashOrSign
    if(hashOrSign && (""+hashOrSign).length>0)
    {
        let regExp = new RegExp("^[a-zA-Z0-9]+[a-zA-Z0-9]{8,256}$")
        //sub_token = sub_token.substring(0,3);

        //console.log("sub_token:"+sub_token)

        return regExp.test(""+hashOrSign);
    }
    return false;
}


async function test_keys(){

    let private_key = newPrivateKey();
    console.log("private_key:"+private_key+" length:"+private_key.length+" typeof="+(typeof private_key))

    pub_key = getPublicKey(private_key);
    console.log("pub_key:"+pub_key+" length:"+pub_key.length+" typeof="+(typeof pub_key))
    console.log("invalidateKeys:"+invalidateKeys(private_key,pub_key))
    console.log("invalidateKeys:"+invalidateKeys("",""))
    try{
        console.log("invalidateKeys:"+invalidateKeys("1","2"))
    }catch(err){
        console.log("invalidateKeys-err:"+err);
    }

    var msg_text = "hello妹子你好啊，这是非常不错的字符啊"
    var msg_hash = await hashVal(msg_text);
    /*
    var msg_hash0 = hashVal(msg_text,"md5");
    console.log("msg_test:"+msg_text+"\nmsg_text.length:"+msg_text.length);
    console.log("msg_hash:"+msg_hash+" length:"+msg_hash.length)
    console.log("msg_hash0:"+msg_hash0+" length:"+msg_hash0.length)

    msg_hash_bs58 = bs58Encode(Buffer.from(msg_hash));
    msg_hash_str = bs58Decode(msg_hash_bs58);
    console.log("msg_hash_bs58:"+msg_hash_bs58+" length="+msg_hash_bs58.length+" typeof="+(typeof msg_hash_bs58))
    console.log("msg_hash_str:"+msg_hash_str+" length="+msg_hash_str.length+" typeof="+(typeof msg_hash_str))
    */

    sign = signMsg(msg_hash,private_key)
    console.log("sign:"+sign+" length:"+sign.length)

    bverify = verifySignMsg(msg_hash,sign,pub_key);
    console.log("bverify:"+bverify+" msg_hash:"+msg_hash+" sign:"+sign+" pub_key:"+pub_key)

}

// test_keys();


//test();

async function test() {
// or require('secp256k1/elliptic')
//   if you want to use pure js implementation in node
    var timestamp = Date.parse(new Date());
// generate message to sign
    let msg = Buffer.from("wellcom to beijing--from lauo.li", "utf8")
    msg = Buffer.from("202cb962ac59075b964b07152d234b70")//32字节,二进制 binnary
    msg = Buffer.from("202cb962ac59075b964b07152d234b70" + "202cb962ac59075b964b07152d234b70", "hex")
    msg = Buffer.from("202cb962ac59075b964b07152d234b70", "binary")//32字节,二进制 binnary

    var text = Buffer.from("wellcom to beijing--from lauo.li北京欢迎你，哈哈，是吗，这确实不错呢，你非常可以呢？3123423哈哈，翰的不错《}{}你是来自哪里呢，非常可以啊,11", "utf8")
    var md5 = crypto.createHash('md5').update(text).digest('hex');


    console.log("data:" + msg + ",md5:" + md5 + ",text=" + text + ",code-length=" + text.byteLength);
    msg = Buffer.from(md5);
// generate privKey
    let privKey
    do {
        privKey = msg;
        privKey = randomBytes(32) //其实是一个buffer，二进制的buffer。
        //privKey = randomBytes(32) //其实是一个buffer，二进制的buffer。
    } while (!secp256k1.privateKeyVerify(privKey))

// get the public key in a compressed format
//这里将一个hex十六进制的buffer转为字符串，又通过buffer转回来。
    var byteArray = new Buffer(privKey.toString('hex'), 'hex')
    console.log("privKey=" + privKey.toString('hex'));

    const pubKey = secp256k1.publicKeyCreate(byteArray)


// sign the message
    let sigObj;
    let flag;

    console.log('begin:'+new Date().getTime())

    console.time()
    for(i=0;i<10000;i++)
    {
        let sha_hash = crypto.createHash('sha256').update(text).digest('hex');
        //console.log('sha_hash:'+sha_hash)
        // sigObj = secp256k1.sign(Buffer.from(sha_hash), privKey)
// verify the signature
    }
    console.timeEnd()


    console.time()
for(i=0;i<10000;i++)
    {
        sigObj =  secp256k1.ecdsaSign(msg, privKey)
// verify the signature
    }
    console.timeEnd()
    console.log('end 0 :'+new Date().getTime())
    console.time()
    //console.log('time-end0:'+console.timeEnd())
for(i=0;i<10000;i++)
    {
        flag =  secp256k1.ecdsaVerify(sigObj.signature,msg,  pubKey);
    //    console.log('flag:'+flag)
    }
    console.timeEnd()




    console.log("data:" + msg);
    console.log("privKey:" + privKey + "|" + byteArray + "|" + privKey.toString('hex') + ",length=" + privKey.length + " toString.length:" + privKey.toString('hex').length);
    console.log("privKey:" + privKey + "|" + byteArray + "|" + privKey.toString('base64') + ",length=" + privKey.length + " toString.length:" + privKey.toString('base64').length);
    console.log("privKey:" + privKey + "|" + byteArray + "|" + bs58.encode(privKey) + ",length=" + privKey.length + " toString.length:" + bs58.encode(privKey).length + "===" + bs58.decode(bs58.encode(privKey)));
    console.log("pubKey:" + pubKey.toString('hex') + ",length=" + pubKey.length);
    console.log("sigObj:" + sigObj.signature.toString('hex') + ",length=" + sigObj.signature.length);
    console.log("flag:" + flag);


    console.log("used-time:" + (Date.parse(new Date()) - timestamp));

// => true


//buffer的一些编码测试：
    console.log("buffer-test:");
    const buf = Buffer.from('hello world', 'ascii');

    console.log(buf.toString('hex'));
// Prints: 68656c6c6f20776f726c64
    console.log(buf.toString('base64'));
// Prints: aGVsbG8gd29ybGQ=

    console.log(Buffer.from('fhqwhgads', 'ascii'));
// Prints: <Buffer 66 68 71 77 68 67 61 64 73>
    console.log(Buffer.from('fhqwhgads', 'utf16le'));
// Prints: <Buffer 66 00 68 00 71 00 77 00 68 00 67 00



   privKey = newPrivateKey();
   let pubKey0 = getPublicKey(privKey)
   msg = '8c296ad1e67e42d27267a871ee39b2c292282df027262ea2065ccc9948831a2e';
   console.time()
   for(i=0;i<10000;i++)
   {
       sigObj =  signMsg(msg,privKey)//secp256k1.ecdsaSign(msg, privKey)
   // verify the signature
   }
   console.timeEnd()
   console.log('end 0 :'+new Date().getTime())
   console.time()
   //console.log('time-end0:'+console.timeEnd())
   for(i=0;i<10000;i++)
   {
       flag =  verifySignMsg(msg,sigObj,pubKey0)//secp256k1.ecdsaVerify(sigObj.signature,msg,  pubKey);
   //    console.log('flag:'+flag)
   }
   console.timeEnd()
   
}
function testBrowser()
{

const a = bs58Decode('8Yxir41tmUEedK5nAoZqfH44bcnA89QngYodXi36wD4k').toString('hex')
console.log('a:'+a+' len:'+a.length)
const b = bs58Decode('puuWxs8GeTM28zHxRrr27bQ2pG5sUhJNiDKHb8RMwsfj').toString('hex')
console.log('b:'+b)

const hash = 'f7eef88671ce6da658c0fb838482e3d1aaef8e4dfc9a85d73517eb0485acb31d'
console.log('hash-len:'+hash.length)
const sign = signMsg(hash,'8Yxir41tmUEedK5nAoZqfH44bcnA89QngYodXi36wD4k')
const sign1 = Secp256k1.uint256( bs58Decode(sign),16).toString(16)//.toString('hex')
console.log('sign:'+sign+' len:'+sign.length+'\tsign2:'+sign1+' len:'+sign1.length)

let ret = 'E7E588F0FFCB82F5A2822A9523054E9127A91EC8A2008ADD32B6A7AA2A992EDB2AE6690423DF234E61C6D3060515D1557B9F08384636FD5F601D71CF60AA1775'
console.log('ret-len：'+ret.length)

//new Uint8Array((flagT+pubX.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
//这里使用的是new Uint8Array方法来封装（而不是使用TextEncoder）
let priKey = bs58Encode( new Uint8Array(( '7ecd5cb78755d45deb5087d2327c70245cd6b8ed2e1116f18d9667de87514666').toString(16).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))//Buffer.from('7ecd5cb78755d45deb5087d2327c70245cd6b8ed2e1116f18d9667de87514666','hex'))

const pubKey= getPublicKey(priKey)
console.log('priKey:'+priKey)
console.log('pubKey:'+pubKey)
console.log('pubKey-decode:'+bs58Decode(pubKey).toString('hex'))
const sign3= signMsg('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',priKey)
console.log('sign3:'+bs58Decode(sign3).toString('hex'))

// const der = Secp256k1.signatureExport(bs58Decode(sign3))
// console.log('der:'+der.toString('hex'))
// //恢复public-key（是否也可用于较验）
// const rpubk = secp256k1.ecdsaRecover(bs58Decode(sign3),0,Buffer.from('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8','hex'))
// console.log('rpubk:'+Buffer.from(rpubk,'hex').toString('hex')+' array:'+rpubk)


// //成功还原了pubkey---证明函数是匹配的（前后端统一与匹配：https://github.com/lionello/secp256k1-js）
// let sign4 = 'ce09f8e34df7773df407183d9b84ae31cd8f680caf4ea237fa4af54cb750db5b3ff768e1c6af77b02217ba1ee3dbcab85edf81cc0921218355265e2e6561fd71'
// let sign5 = 'b73dcca7ade792a48d2e14548d8f53b6799e7f2dea2480af8051160e50da20032e8a932b2506e4c1c036c3aed2df19de222f6aaf74ee8eb2d00a3bd69702cf9e'
// sign5 = '90be2facb42bcdf7aa560062afdfa40cd38b04680668398e001d3810295238cf6622c11f354d1b4d24ef18db77e0bf52ccdb69b488b64451c8d8ac51c8205fd0'
// //sign5 = '91D7E304B178D3B161F55AEFFA47CBD00D4FDF4C90051B26CBC6AEC614E9000F1ACF9982A715434771401A5E7AB3D58F87128F8D289C192D14A95CD6122EBA52'.toLowerCase()
// //sign5 = 'A46958CA8418DCC323EBB500A6C6D52CC2F2CA36FE00285105E9923D4BC6389C8A8F77FAF89E7665DA41B4C91A5FDF49FEB6B26746B4BF433D1FEC237C2AC9CF'.toLowerCase()
// //这是browser的还原，recid=0
// const rpubk2 = secp256k1.ecdsaRecover(Buffer.from(sign5,'hex'),0,Buffer.from('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8','hex'))
// console.log('rpubk2:'+Buffer.from(rpubk2,'hex').toString('hex')+' array:'+rpubk2)
// //这是browser的还原，recid=1
// const rpubk3 = secp256k1.ecdsaRecover(Buffer.from(sign4,'hex'),1,Buffer.from('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8','hex'))
// console.log('rpubk3:'+Buffer.from(rpubk3,'hex').toString('hex')+' array:'+rpubk2)


// let sign4encode = bs58Encode(Buffer.from(sign4,'hex'))
// let sign5encode = bs58Encode(Buffer.from(sign5,'hex'))
// let checkFlag = verifySignMsg('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',
//                        sign5encode,pubKey)
// let checkFlag2 = verifySignMsg('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',
//                        sign3,pubKey)
// console.log('checkFlag:'+checkFlag)
// console.log('checkFlag2:'+checkFlag2)
// console.log('pubKey:'+  bs58Decode( pubKey).toString('hex'))
}
// console.log('--------------------testBrowser')
// testBrowser()
// test()
/*
//  pubx:d02e02c044bdea76439983b5d3a7de8cc3150ef3dc59d0bcff81ebdff37a4e2b 
//  puby:80e70b40b4051aa22069637f16bfb3f40fedabbacc8dbb307841a3d6038ff4f0
// index.html:62 Signature must be valid:true 
// prikey:e2bf59a30df9b0fba003cd304d059c4ae4690c9628d7c38cf4ffa0b603a6c2d3 len:64

pubx:acd29ab0ae01e53d239c6b53a082cdbe78b865fad28db51a37ba4ab65e0b9339 puby:a7506323481e0a2d8cf8b804b9da83ad8e20829e23b0d4b880e4c44a86d00f11
index.html:62 
signR:b73dcca7ade792a48d2e14548d8f53b6799e7f2dea2480af8051160e50da2003 
signS:2e8a932b2506e4c1c036c3aed2df19de222f6aaf74ee8eb2d00a3bd69702cf9e
index.html:63 Signature must be valid:true 
prikey:7ecd5cb78755d45deb5087d2327c70245cd6b8ed2e1116f18d9667de87514666


483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
*/