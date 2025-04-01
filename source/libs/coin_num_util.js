/**
 * Created by lauo.li on 2018/12/28.
 * 用来计算一些coin的精度等函数
 */

const COIN_PRECISION_MAX = 4
const COIN_PRECISION_UNIT_10 = 10
const COIN_PRECISION_UNIT = 0.1
//,COIN_PRECISION_UNIT_10,COIN_PRECISION_UNIT,TOKEN_VAL_TYPE} = require('./root_config')
const BigNumber = require('bignumber.js');

/**
 * 计算coin的真实值（使用乘法的方式）-----在链上表达为整数值（需要消耗更大的空间，如1coin=1*10^COIN_PRECISION_MAX（整数值挺大，消耗大空间和不节省宽带）。
 * coinNum整数
 * precision整数（0-COIN_PRECISION_MAX）
 * COIN_PRECISION_UNIT为0.1（十进制）
 * @type {getCoinVal}
 * coinNum：1
 * precision:30
 * 显示为:0.000000000000000000000000000001
 */
module.exports.getCoinINTRealVal = getCoinINTRealVal
function getCoinINTRealVal(coinNum,precision = COIN_PRECISION_MAX)
{
    BigNumber.config({ DECIMAL_PLACES: precision })//这里是数字的精度（纯整数运算即可）

    let coin = new BigNumber(coinNum);
    let UNIT = new BigNumber(COIN_PRECISION_UNIT);
    let MUL_NUM = UNIT.pow(precision)

    //return coin.mul(MUL_NUM).toPrecision(precision).toString(COIN_PRECISION_UNIT_10);
    return coin.mul(MUL_NUM).toString(COIN_PRECISION_UNIT_10);
}
/**
 * 检查是否是币的数量（必须为整数）
 * @param coin
 * @returns {boolean}
 */
module.exports.validateCoinNumINT = validateCoinNumINT;
function validateCoinNumINT(coin)
{
    if(!coin) return false;

    BigNumber.config({ DECIMAL_PLACES: 20})
    coin0 = (new BigNumber(coin)).toString(COIN_PRECISION_UNIT_10);
    BigNumber.config({ DECIMAL_PLACES: 0 })
    coin1 = (new BigNumber(coin)).toString(COIN_PRECISION_UNIT_10);

    //console.log("coin: "+coin+" coin0: "+coin0+" coin1: "+coin1)

    return coin0 == coin1;
}

/**
 * 检查是否是币的数量（允许为数字-精度数值）
 * @param coin
 * @returns {boolean}
 */
module.exports.validateCoinNumNUM = validateCoinNumNUM;
function validateCoinNumNUM(coin)
{
    //coin0 = (new BigNumber(coin)).toString(COIN_PRECISION_UNIT_10);
    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX })
    coin1 = (new BigNumber(coin)).toString(COIN_PRECISION_UNIT_10);

    //console.log("coin: "+coin+" coin0: "+coin0+" coin1: "+coin1)

    return (""+coin) == coin1;
}
/**
 * 转成coin数值（整数）
 * @param coin
 * @returns {string|*}
 *
 * 0.5输入，1输出
 * 精度丢失，注意不要滥用
 */
module.exports.toCoinNumINT = toCoinNumINT;
function toCoinNumINT(coin)
{
    BigNumber.config({ DECIMAL_PLACES: 0 })
    coin1 = (new BigNumber(coin)).toString(COIN_PRECISION_UNIT_10);
    return coin1;
}

/**
 * 输出数值（NUMBER）
 * @param coin
 * @returns {string|*}
 */
module.exports.toCoinNumNUM = toCoinNumNUM;
function toCoinNumNUM(coin)
{
    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX})
    coin1 = (new BigNumber(coin)).toString(COIN_PRECISION_UNIT_10);
    return coin1;
}



/**
 * 加法运算
 */
/**
 * 加法运算
 * @param coni0
 * @param coni1
 * @returns {*}
 */
module.exports.add = add;
function add(coni0,coni1)
{
    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX})
    let COIN0 = new BigNumber(coni0);
    let COIN1 = new BigNumber(coni1);
    return COIN0.add(COIN1).toString(COIN_PRECISION_UNIT_10);
}

/**
 * 减法运算
 * @param coni0
 * @param coni1
 * @returns {*}
 */
module.exports.minus = minus;
function minus(coni0,coni1)
{
    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX})
    let COIN0 = new BigNumber(coni0);
    let COIN1 = new BigNumber(coni1);
    return COIN0.minus(COIN1).toString(COIN_PRECISION_UNIT_10);
}
/**
 * 除法运算（只留下整数）
 * @param coni0
 * @param coni1
 * @returns {*}
 */
module.exports.div = div;
function div(coni0,coni1)
{
    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX+3})
    let COIN0 = new BigNumber(coni0);
    let COIN1 = new BigNumber(coni1);
    let COIN2 = COIN0.div(COIN1);

    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX })//这里是数字的精度（纯整数运算即可）
    return COIN2.toString(COIN_PRECISION_UNIT_10);
}

/**
 * 这里是小于
 * @type {lt}
 */
module.exports.lt = lt;
function lt(coni0,coin1)
{
    let COIN0 = new BigNumber(coni0);
    let COIN1 = new BigNumber(coin1);
    return   COIN0.lt(COIN1)
}


/**
 * 乘法运算
 * @param coni0
 * @param coni1
 * @returns {*}
 */
module.exports.mul = mul;
function mul(coni0,coni1)
{
    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX+3})
    let COIN0 = new BigNumber(coni0);
    let COIN1 = new BigNumber(coni1);
    let COIN2 = COIN0.mul(COIN1);

    BigNumber.config({ DECIMAL_PLACES: COIN_PRECISION_MAX})
    return COIN2.toString(COIN_PRECISION_UNIT_10);
}
/**
 * 使用DIV方法得到真实值。----------------此函数精度不行，不推荐使用。
 * @param coinNum
 * @param precision
 * @returns {string}
 *
 * coinNum：1
 * precision:30
 * 显示为1.00000000000000000000000000000e-30
 */
//module.exports.getCoinRealVal2 = getCoinRealVal2;
function getCoinRealVal2(coinNum,precision = COIN_PRECISION_MAX)
{
    return "error !!! can not use the error function!precision is not ok toString"

    BigNumber.config({ DECIMAL_PLACES: precision*2 })//这里是数字的精度（纯整数运算即可）

    let coin = new BigNumber(coinNum);
    let UNIT_10 = new BigNumber(COIN_PRECISION_UNIT_10);
    let DIV_NUM = UNIT_10.pow(precision)

    return coin.div(DIV_NUM).toPrecision(precision).toString(COIN_PRECISION_UNIT_10);
}


function test()
{
    coin = "100000000000001";
    coin1 = "33333333333333333333333333000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    coin2 = 1.5;
    precision = 8;//最大值了。

    console.log("BigNumber.precision:"+BigNumber.precision+" coin:"+coin+" precision:"+precision+" realVal:"+getCoinINTRealVal(coin,precision)
    +" \n2:"+getCoinRealVal2(coin,precision))

    console.log("add ="+add(coin,coin1));
    console.log("minus ="+minus(add(coin,coin1),coin2));

    coin3 = div(add(coin,coin1),coin2);
    console.log("div ="+coin3);

    coin4 = mul(coin3,coin2);
    console.log("mul ="+coin4);

    console.log("coin-1="+validateCoinNumINT(1.5));
    console.log("coin-2="+validateCoinNumNUM(0.5));
    console.log("coin-3="+validateCoinNumINT(1));
    console.log("coin-4="+validateCoinNumINT("22222222222222222222222222000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"));
    console.log("coin-5="+validateCoinNumINT("1.01"));
    console.log("coin-6="+validateCoinNumNUM("0.5")+" coinNum:"+toCoinNumINT("0.5"));
    console.log("coin-7="+validateCoinNumNUM("1"));
}

//test();


