const BigNumber = require('bignumber.js');


class CoinNumUtil{
    constructor(COIN_PRECISION_MAX,COIN_PRECISION_UNIT_10 = 10,COIN_PRECISION_UNIT = 0.1)
    {
        this.COIN_PRECISION_MAX = COIN_PRECISION_MAX
        // this.TOKEN_VAL_TYPE =TOKEN_VAL_TYPE
        this.COIN_PRECISION_UNIT_10 = COIN_PRECISION_UNIT_10
        this.COIN_PRECISION_UNIT = COIN_PRECISION_UNIT
        this.BN = typeof BigNumber.another=='function' ?  BigNumber.another({ DECIMAL_PLACES: COIN_PRECISION_MAX }):BigNumber.clone({ DECIMAL_PLACES: COIN_PRECISION_MAX })
    }
    /**
     * 得到token_val_type的值
     * @type {getTokenVALTYPE}
     */
    getTokenVALTYPE()
    {
        return this.TOKEN_VAL_TYPE;
    }
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
    getCoinINTRealVal(coinNum,precision )
    {
        precision = precision<=0 ? this.COIN_PRECISION_MAX:precision
        this.BN.config({ DECIMAL_PLACES: precision })//这里是数字的精度（纯整数运算即可）

        let coin = new this.BN(''+coinNum);
        let UNIT = new this.BN(''+this.COIN_PRECISION_UNIT);
        let MUL_NUM = UNIT.pow(precision)

        //return coin.mul(MUL_NUM).toPrecision(precision).toString(COIN_PRECISION_UNIT_10);
        let ret =  coin.mul(MUL_NUM).toString(this.COIN_PRECISION_UNIT_10);
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX })
        return ret
    }
    /**
     * 检查是否是币的数量（必须为整数）
     * @param coin
     * @returns {boolean}
     */
    validateCoinNumINT(coin)
    {
        if(!coin) return false;

        this.BN.config({ DECIMAL_PLACES: 20})
        let coin0 = (new this.BN(''+coin)).toString(this.COIN_PRECISION_UNIT_10);
        this.BN.config({ DECIMAL_PLACES: 0 })
        let coin1 = (new this.BN(''+coin)).toString(this.COIN_PRECISION_UNIT_10);
        //console.log("coin: "+coin+" coin0: "+coin0+" coin1: "+coin1)
        return coin0 == coin1;
    }

    /**
     * 检查是否是币的数量（允许为数字-精度数值）
     * @param coin
     * @returns {boolean}
     */
    validateCoinNumNUM(coin)
    {
        //coin0 = (new this.BN(''+coin)).toString(COIN_PRECISION_UNIT_10);
        let coinStr = ''+coin
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX })
        try{
            let coin1 = (new this.BN(''+coin)).toString(this.COIN_PRECISION_UNIT_10);
            //console.log("coin: "+coin+" coin0: "+coin0+" coin1: "+coin1)
            return coinStr == coin1 || 
                (new this.BN(coinStr.replace(coin1,''))).toString(this.COIN_PRECISION_UNIT_10) ==0
        }catch(ex){console.log('validateCoinNumNUM:'+ex)}
        return false;
    }
    /**
     * 转成coin数值（整数）
     * @param coin
     * @returns {string|*}
     *
     * 0.5输入，1输出
     * 精度丢失，注意不要滥用
     */
    toCoinNumINT(coin)
    {
        this.BN.config({ DECIMAL_PLACES: 0 })
        let coin1 = (new this.BN(''+coin)).toString(this.COIN_PRECISION_UNIT_10);
        return coin1;
    }

    /**
     * 输出数值（NUMBER）
     * @param coin
     * @returns {string|*}
     */
    toCoinNumNUM(coin)
    {
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX})
        let coin1 = (new this.BN(''+coin)).toString(this.COIN_PRECISION_UNIT_10);
        return coin1;
    }
    /**
     * 加法运算
     * @param coni0
     * @param coni1
     * @returns {*}
     */
    add(coni0,coni1)
    {
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX})
        let COIN0 = new this.BN(''+coni0);
        let COIN1 = new this.BN(''+coni1);
        return COIN0.add(COIN1).toString(this.COIN_PRECISION_UNIT_10);
    }

    /**
     * 减法运算
     * @param coni0
     * @param coni1
     * @returns {*}
     */
    minus(coni0,coni1)
    {
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX})
        let COIN0 = new this.BN(''+coni0);
        let COIN1 = new this.BN(''+coni1);
        return COIN0.minus(COIN1).toString(this.COIN_PRECISION_UNIT_10);
    }
    /**
     * 除法运算（只留下整数）
     * @param coni0
     * @param coni1
     * @returns {*}
     */
    div(coni0,coni1)
    {
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX+3})
        let COIN0 = new this.BN(''+coni0);
        let COIN1 = new this.BN(''+coni1);
        let COIN2 = COIN0.div(COIN1);

        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX })//这里是数字的精度（纯整数运算即可）
        return COIN2.toString(this.COIN_PRECISION_UNIT_10);
    }

    /**
     * 这里是小于
     * @type {lt}
     */
    lt(coni0,coin1)
    {
        let COIN0 = new this.BN(''+coni0);
        let COIN1 = new this.BN(''+coin1);
        return  COIN0.lt(COIN1)
    }

    lte(coni0,coin1)
    {
        let COIN0 = new this.BN(''+coni0);
        let COIN1 = new this.BN(''+coin1);
        return  COIN0.lte(COIN1)
    }


    /**
     * 乘法运算
     * @param coni0
     * @param coni1
     * @returns {*}
     */
    mul(coni0,coni1)
    {
        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX+3})
        let COIN0 = new this.BN(''+coni0);
        let COIN1 = new this.BN(''+coni1);
        let COIN2 = COIN0.mul(COIN1);

        this.BN.config({ DECIMAL_PLACES: this.COIN_PRECISION_MAX})
        return COIN2.toString(this.COIN_PRECISION_UNIT_10);
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
    getCoinRealVal2(coinNum,precision )
    {
        precision = precision<=0 ? this.COIN_PRECISION_MAX:precision
        return "error !!! can not use the error function!precision is not ok toString"

        this.BN.config({ DECIMAL_PLACES: precision*2 })//这里是数字的精度（纯整数运算即可）

        let coin = new this.BN(''+coinNum);
        let UNIT_10 = new this.BN(''+COIN_PRECISION_UNIT_10);
        let DIV_NUM = UNIT_10.pow(precision)

        return coin.div(DIV_NUM).toPrecision(precision).toString(COIN_PRECISION_UNIT_10);
    }


    test()
    {
        let coin = "100000000000001";
        let coin1 = "33333333333333333333333333000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        let coin2 = 1.5;
        let precision = 10;//最大值了。

        console.log("BigNumber.precision:"+BigNumber.precision+" coin:"+coin+" precision:"+precision+" realVal:"+this.getCoinINTRealVal(coin,precision)
            +" \n2:"+this.getCoinRealVal2(coin,precision))

        console.log("add ="+this.add(coin,coin1));
        console.log("minus ="+this.minus(this.add(coin,coin1),coin2));

        let coin3 = this.div(this.add(coin,coin1),coin2);
        console.log("div ="+coin3);

        let coin4 = this.mul(coin3,coin2);
        console.log("mul ="+coin4);
        console.log('this.COIN_PRECISION_MAX:'+this.COIN_PRECISION_MAX)

        console.log("coin-1="+this.validateCoinNumINT(1.5));
        console.log("coin-2="+this.validateCoinNumNUM(0.5));
        console.log("coin-3="+this.validateCoinNumINT(1));
        console.log("coin-4="+this.validateCoinNumINT("22222222222222222222222222000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"));
        console.log("coin-5="+this.validateCoinNumINT("1.01"));
        console.log("coin-6="+this.validateCoinNumNUM("0.5")+" coinNum:"+this.toCoinNumINT("0.5"));
        console.log("coin-7="+this.validateCoinNumNUM("1"));
        console.log("coin-8="+this.validateCoinNumNUM("1.0"));
        console.log("coin-9="+this.validateCoinNumNUM("1.196"));
        console.log("coin-9="+this.validateCoinNumNUM("10000000000.0"));
    }
}

var cutil = new CoinNumUtil(4)
cutil.test()

console.log(''+(cutil.add("0.1555555555","0.1555555555")))
console.log(''+(cutil.mul("0.1555555555","0.1555555555")))
console.log(''+(cutil.div("0.1555555555","0.15565559999")))
console.log(''+(cutil.lt("0.1555555555","0.1555555555")))
console.log(''+(cutil.div(0.300200020000000000000000000000000000000000000001,"0.30000000000000004")))
console.log(''+(cutil.toCoinNumNUM(0.00000001) == cutil.toCoinNumNUM(0)))

console.log(''+(cutil.toCoinNumNUM( cutil.mul(cutil.toCoinNumNUM(0.01),cutil.toCoinNumNUM(0.1)) )))
console.log(''+(cutil.toCoinNumNUM( cutil.minus(cutil.toCoinNumNUM(0.01),cutil.toCoinNumNUM(0.1)) )))
