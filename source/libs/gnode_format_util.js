/**
 * Created by lauo.li on 2019/3/15.
 */

const VAL_TYPE={
    //NUM:'NUM',//这里必须与OPVAL_NUM_TYPE一至（亦NUM全大写，否则会出严重问题）
    COIN:'COIN',
    SCORE:'SCORE',
    MSG:'MSG',
    TEXT:'TEXT',
    CLT:'CLT',
}

/**
 * 判断gnode_setting的配置
 * @param setting
 * @returns {*}
 */
module.exports.checkSetting = checkSetting
function checkSetting(setting)
{
    console.log("setting:"+JSON.stringify(setting))
    let {nodeid,name,val_type,appids,secret_keys,extra_data} = setting

    // if(!nodeid || !checkNodeid(nodeid)) return false; //{ret:false,msg:"nodeid format error!"}
    if(!name || !checkName(name)) return false;//{ret:false,msg:"name format error!"}
    if(!val_type || !checkValType(val_type)) return false;//{ret:false,msg:"val_type format error!"}
    if(!appids || !secret_keys || !checkKeys(appids,secret_keys)) return false;//{ret:false,msg:"keys format error!"}
    if(!extra_data  || !checkExtraData(extra_data)) return false;//{ret:false,msg:"extra_data format error!"}

    return true;
}

module.exports.checkStr = checkStr
function checkStr(s) {
    let reg = /^(\w|[\u4E00-\u9FA5]|\+|\-|\*)*$/;
    return !!s.match(reg);
}

module.exports.checkNodeid = checkNodeid
function checkNodeid(s) {
    let reg = /^[a-zA-Z][0-9a-zA-Z]*$/g
    return !!s.match(reg);
}

module.exports.checkName = checkName
function checkName(s) {
    let reg = /^[a-zA-Z]*$/g
    return !!s.match(reg);
}

/**
 * 判断val_type类型是否正确。
 * @type {checkValType}
 */
module.exports.checkValType = checkValType
function checkValType(s) {
    let keys = Object.keys(VAL_TYPE);
    var i =0;
    for(;i<keys.length;i++)
    {
        let key = keys[i]
        let val = VAL_TYPE[key];
        if(val==s) return true;
    }
    return false;
}

function checkNum(s) {
    if(s==s*1) return true;

    let reg = /^[1-9][0-9]*$/g
    return !!s.match(reg);
}
function checkKey(s) {
    let reg = /^[0-9a-zA-Z]*$/g
    return !!s.match(reg);
}
/**
 * 检测密钥
 * @type {checkKeys}
 */
module.exports.checkKeys= checkKeys
function checkKeys(appids,secret_keys) {
    if(!appids || !secret_keys) return false;

    try {
        appids = JSON.parse(appids);
        secret_keys = JSON.parse(secret_keys);
    }catch(ex)
    {
        console.log("checkKeys:"+ex)
        return false;
    }

    if(!(appids instanceof Array) || !(secret_keys instanceof Array)) return false
    if(appids.length!=secret_keys.length) return false

    let i=0;
    for(;i<appids.length;i++)
    {
        if(!appids[i] || !secret_keys[i]) return false;
        if(!checkNum(''+appids[i]) || !checkKey(''+secret_keys[i])) return false;
    }
    return true;
}

/**
 * 判断附加信息是否正确
 * @type {checkExtraData}
 *
 * let setting={
        //节点相关信息
        TOKEN_ID_LENGTH:16,//extra_data['token_id_length'],//一般不变
        COIN_PRECISION_MAX:extra_data['coin_precision_max'],//对于coin以及SCORE有用。
        COIN_TOP_VAL:extra_data['coin_top_val'],//'100*10000*10000',//对于coin有用。
}
 */
module.exports.checkExtraData= checkExtraData
function checkExtraData(extra_data) {
    if(!extra_data) return false;

    try {
        extra_data = JSON.parse(extra_data);
    }catch(ex)
    {
        console.log("checkExtraData:"+ex)
        return false;
    }

    if(extra_data['coin_precision_max']!=extra_data['coin_precision_max']-0
        || extra_data['coin_precision_max']<0||extra_data['coin_precision_max']>8)
        return false;

    if(extra_data['coin_top_val'] != extra_data['coin_top_val']-0 ||
        extra_data['coin_top_val'] != parseInt(extra_data['coin_top_val'] ) ||
        extra_data['coin_top_val']<0 )
        return false;

    if(extra_data['token_id_length']!=extra_data['token_id_length']-0
        || extra_data['token_id_length']<8||extra_data['token_id_length']>16)
        return false;

    return true;
}

//console.log("checkNodeid:"+checkNodeid('13X'))
//console.log("checkNodeid:"+checkNodeid('node13'))
//console.log("checkNodeid:"+checkNodeid('node35'))
//console.log("checkNodeid:"+checkNodeid('noXe35'))
//console.log("checkNodeid:"+checkNodeid('noXeCtx'))
//console.log("checkName:"+checkName('noXe35'))
//console.log("checkName:"+checkName('13X'))
//console.log("checkName:"+checkName('node13'))
//console.log("checkName:"+checkName('noXeCtx'))
//
//
//console.log("checkValType:"+checkValType('noXeCtx'))
//console.log("checkValType:"+checkValType('CLT'))
//console.log("checkValType:"+checkValType('CLT0'))
//console.log("checkValType:"+checkValType('MSG'))

//console.log("checkNum:"+checkNum('1001'))
//console.log("checkNum:"+checkNum('90000001'))
//console.log("checkNum:"+checkNum('90000a001'))
//console.log("checkNum:"+checkNum('134355'))
//console.log("checkNum:"+checkNum('a1001'))
//console.log("checkNum:"+checkNum('10a01'))
//console.log("checkNum:"+checkNum('001'))
//
//console.log("checkKey:"+checkKey('CLT'))
//console.log("checkKey:"+checkKey('CLT0'))
//console.log("checkKey:"+checkKey('MSG'))
//console.log("checkKey:"+checkKey('00CLT0'))
//console.log("checkKey:"+checkKey('10MSG'))
//console.log("checkKey:"+checkKey('10MSG0001'))

//console.log("checkKeys:"+checkKeys('["10001","1002"]','["10001","1002"]'))
//console.log("checkKeys:"+checkKeys('["10a001","1002"]','["10001","1002"]'))
//console.log("checkKeys:"+checkKeys('["10001","1002","1003"]','["10001","1002"]'))
//console.log("checkKeys:"+checkKeys('["10001","1002","1003"]','["10001","1002",""]'))
//console.log("checkKeys:"+checkKeys('["10001","1002","1003"]','["10001","1002","1"]'))

//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":0,"coin_top_val":100*10000*10000,"token_id_length":16}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":0,"coin_top_val":0,"token_id_length":8}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":-1,"coin_top_val":0,"token_id_length":8}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":0,"coin_top_val":-1,"token_id_length":8}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":0,"coin_top_val":0,"token_id_length":0}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":0,"coin_top_val":0,"token_id_length":17}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":0,"coin_top_val":0,"token_id_length":16}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":"x","coin_top_val":0,"token_id_length":16}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":"0","coin_top_val":"y","token_id_length":16}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":"0","coin_top_val":"0","token_id_length":"z"}'))
//console.log("checkExtraData:"+checkExtraData('{"coin_precision_max":"0","coin_top_val":"0","token_id_length":"13"}'))