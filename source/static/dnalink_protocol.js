/**
 * create by poplang on 2022/8/26
 */
// const bs58 = require(`bs58`);
// const BigNumber = require('bignumber.js');
// const str_filter = require("../libs/str_filter");

const VAL_TYPE={
    //NUM:'NUM',//这里必须与OPVAL_NUM_TYPE一至（亦NUM全大写，否则会出严重问题）
    COIN:'COIN',
    SCORE:'SCORE',
    MSG:'MSG',
    TEXT:'TEXT',
    CLT:'CLT',
}

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


class TokenUtil{
    constructor(protocol)
    {
        this.protocol = protocol
        const {TOKEN_NAME,TOKEN_ID_LENGTH,TOKEN_ROOT,TOKEN_CLT_TIPS_STR} = this.protocol.root_config
        this.TOKEN_ROOT = TOKEN_ROOT
        this.TOKEN_CLT_TIPS_STR = TOKEN_CLT_TIPS_STR
        this.TOKEN_PREFIX = TOKEN_NAME+"_"
        this.TOKEN_LENGTH = TOKEN_ID_LENGTH
        this.TOKEN_LOWER = false;
        this.TOKEN_X='token_x'
        this.TOKEN_Y='token_y'
    }
    isTokenInCltArea(token){
        if(!token || !this.validateTokenID(token) 
            || !this.TOKEN_CLT_TIPS_STR || this.TOKEN_CLT_TIPS_STR.length==0) return false;
        token = token.split(this.TOKEN_PREFIX)[1]
        return token.indexOf(this.TOKEN_CLT_TIPS_STR)>0
    }
    getTokenCltAreaName(token){
        if(this.isTokenInCltArea(token))
        {
            token = token.split(this.TOKEN_PREFIX)[1]
            return token.substring(0,token.indexOf(this.TOKEN_CLT_TIPS_STR))
        }
        return null
    }
    newTokenID(){

        // var UDIDSTR  = bs58.encode(Buffer.from(""+str_filter.randomBytes(this.TOKEN_LENGTH*2)));
        const idBuf = eccryptoJS.randomBytes(this.TOKEN_LENGTH*2)// window.crypto.getRandomValues(new Uint8Array(this.TOKEN_LENGTH*2))//32
        // let idUint256Array = Secp256k1.uint256(idBuf, 16)
        let UDIDSTR = bs58.encode(idBuf)// new Uint8Array((''+idUint256Array.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
        console.log('UDIDSTR:'+UDIDSTR+' len:'+UDIDSTR.length)
        
        UDIDSTR = this.TOKEN_LOWER ? (""+UDIDSTR).toLowerCase():UDIDSTR
        //console.log("UDIDSTR:"+UDIDSTR+" length:"+UDIDSTR.length);
        let tokenID = this.TOKEN_PREFIX + UDIDSTR.substring(0,this.TOKEN_LENGTH);
        return tokenID;

    }

    /**
     * 由tips得到token_id
     * @type {newTokenIDByTIPS}
     */
    newTokenIDByTIPS(token_tips,tips){

        if(!tips) return this.newTokenID();

        token_tips = this.validateTokenID(token_tips)?token_tips : this.TOKEN_ROOT;
        var token_id =token_tips.substring(0,this.TOKEN_ROOT.length-tips.length);
        return token_id+tips;
    }

    //let tokenNewID=newTokenIDByTIPS("msg_music00000000000","1")
    //let checkFlag = validateTokenID(tokenNewID);
    //console.log("tokenNewID:"+tokenNewID+" checkFlag:"+checkFlag)
    /**
     * 由tips得到token_id
     * @type {newTokenIDByTIPS}
     */
    newTokenIDBySpace(space){

        if(!space) return this.newTokenID();

        // var UDIDSTR  = bs58.encode(Buffer.from(""+str_filter.randomBytes(this.TOKEN_LENGTH*2)));
        const idBuf = eccryptoJS.randomBytes(this.TOKEN_LENGTH*2)// window.crypto.getRandomValues(new Uint8Array(this.TOKEN_LENGTH*2))//32
        // let idUint256Array = Secp256k1.uint256(idBuf, 16)
        let UDIDSTR = bs58.encode(idBuf) //new Uint8Array((''+idUint256Array.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
        console.log('UDIDSTR:'+UDIDSTR+' len:'+UDIDSTR.length)
        
        UDIDSTR = this.TOKEN_LOWER ? (""+UDIDSTR).toLowerCase():UDIDSTR
        var token_id =this.TOKEN_PREFIX + space+ UDIDSTR.substring(0,this.TOKEN_LENGTH-space.length);
        return token_id;
    }
    validateTokenID(token) {
        if (token && ("" + token).indexOf(this.TOKEN_PREFIX) >= 0) {

            let regExp = new RegExp("^[a-zA-Z0-9]+[a-zA-Z0-9]{1," + this.TOKEN_LENGTH + "}$")
            let sub_token = ("" + token).substring(this.TOKEN_PREFIX.length, ("" + token).length);
            return regExp.test(sub_token) && sub_token.length == this.TOKEN_LENGTH;
        }

        return false;
    }
    /**
     * 关于token_relate的判断
     * @type {validateTokenRelate}
     */
    validateTokenRelate(token) {
        return token==this.TOKEN_X || token==this.TOKEN_Y
    }
    test()
    {
        let token_id = this.newTokenID();
        let ret = this.validateTokenID(token_id)
        console.log("ret=" + ret + "\n token_id:" + token_id + " length:" + token_id.length);
    }

    //test();
}


class TXUtil{
    constructor(protocol,TX_PREFIX = 'txid_',TX_ID_LENGTH=16,TX_ID_LOWER =false)
    {
        this.fsm_p = new DNALinkFSMContractProcessor(protocol)
        this.coin_num_util = this.fsm_p.coin_num_util
        this.fsm_config = this.fsm_p.fsm_config
        this.root_config = this.fsm_p.root_config
        //一些配置
        this.TX_PREFIX = TX_PREFIX
        this.TX_ID_LENGTH = TX_ID_LENGTH
        this.TX_ID_LOWER = TX_ID_LOWER
        this.OPCODES = this.reverseOPCODES()
    }
    newTXID()
    {
        // var UDIDSTR  = bs58.encode(Buffer.from(""+str_filter.randomBytes(this.TX_ID_LENGTH*2)));
        const idBuf =  eccryptoJS.randomBytes(this.TX_ID_LENGTH*2)//window.crypto.getRandomValues(new Uint8Array(this.TX_ID_LENGTH*2))//32
        let idUint256Array = idBuf.toString('hex') //Secp256k1.uint256(idBuf, 16)
        let UDIDSTR = bs58.encode( new Uint8Array((''+idUint256Array.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
        console.log('UDIDSTR:'+UDIDSTR+' len:'+UDIDSTR.length)
        
        UDIDSTR = this.TX_ID_LOWER ? (""+UDIDSTR).toLowerCase():UDIDSTR
        let txID = this.TX_PREFIX + UDIDSTR.substring(0,this.TX_ID_LENGTH);
        return txID;
    }
    validateTXID(TXID)
    {
        if(TXID && (""+TXID).indexOf(this.TX_PREFIX)>=0){

            let regExp = new RegExp("^[a-zA-Z0-9]+[a-zA-Z0-9]{1,"+this.TX_ID_LENGTH+"}$")
            let sub_TXID = (""+TXID).substring(this.TX_PREFIX.length,(""+TXID).length);
            //sub_token = sub_token.substring(0,3);
            //console.log("sub_token:"+sub_token)
            return regExp.test(sub_TXID) && sub_TXID.length == this.TX_ID_LENGTH;
        }
        return false;
    }
    validateTXJSON(txinfo,txjson)
    {
        if(!txinfo || !txjson)
            return false;

        if(txinfo.txid != txjson.txid)
        {
            console.log("validateTXJSON: txid not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        if(txinfo.token_x != txjson.token_x)
        {
            console.log("token_x not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        if(txinfo.token_y != txjson.token_y)
        {
            console.log("token_y not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        if(txinfo.opcode != txjson.opcode)
        {
            console.log("opcode not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        if(txinfo.opval != txjson.opval)
        {
            console.log("opval not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        if(txinfo.extra_data != txjson.extra_data)
        {
            console.log("extra_data not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        if(txinfo.timestamp_i != txjson.timestamp_i)
        {
            console.log("timestamp_i not equals  ",txinfo.txid ,txjson.txid)
            return false;
        }

        return true;
    }

    /**
     * 判断opcode是否合法
     * @type {validateOPCODE}
     */
    validateOPCODE(opcode)
    {
        if(!opcode) return false;
        return this.OPCODES[opcode]!=null //性能更好。
    }
    reverseOPCODES()
    {
        let LIST = {}
        let OPCODE_LIST = this.fsm_config ;//require('../fsm_contract/fsm_config')
        let keys = Object.keys(OPCODE_LIST);
        for(let i=0;i<keys.length;i++){
            let val = keys[i] ;
            let opcode =  OPCODE_LIST[keys[i]] 
            LIST[opcode] = val;    
        }
        return LIST;
    }


    /**
     * 判断opcode对应的opval是否合法
     * @type {validateOPCODE}
     */
    validateOPVal(opcode,opval) {
        //console.log("validateOPVal("+opcode+","+opval+")")
        if (!this.validateOPCODE(opcode)) {
            //console.log("validateOPCODE:"+validateOPCODE(opcode)+" opcode:"+opcode);
            return false;
        }

        if(!opval)
            return false;


        /**
         * 判断数据是send状态下的数值计算，如判断opval格式是否正确
         */
        if(opcode==this.fsm_config.OP_SEND && //操作是send的情况下
            this.fsm_p.isNumValType() )  //操作是数值计算
        {
            //数值计算。
            return this.coin_num_util.validateCoinNumNUM(""+opval)
        }

        return (""+opval).length>0;
    }

    /**
     * 输出为JSON字符串
     * @type {toTXJSON}
     */
    toTXJSONString(TXINFO)
    {
        let {txid,token_x,token_y,opcode,opval,token_state,token_height,pre_txid,extra_data,timestamp_i}=TXINFO;
        let TXINFO_JSON = {txid:""+txid,token_x:""+token_x,token_y:""+token_y,opcode:""+opcode,opval:""+opval,extra_data:""+extra_data,timestamp_i:""+timestamp_i};

        if(TXINFO.hasOwnProperty("token_state"))
        {
            TXINFO_JSON.token_state = ""+TXINFO.token_state
        }
        if(TXINFO.hasOwnProperty('token_height'))
        {
            TXINFO_JSON.token_height = TXINFO.token_height
        }
        if(TXINFO.hasOwnProperty('public_key'))
        {
            TXINFO_JSON.public_key = TXINFO.public_key
        }
        if(TXINFO.pre_txid)
        {
            TXINFO_JSON.pre_txid = TXINFO.pre_txid
        }

        return JSON.stringify(TXINFO_JSON);
    }

    /**
     * 返回opcode-list
     * @type {getOpcodeList}
     */
    getOpcodeList()
    {
        return this.OPCODE_LIST;
    }

    test()
    {
        let TXID = this.newTXID();
        let ret = this.validateTXID(TXID)
        console.log("validateTXID-ret=" + ret + " txid:" + TXID + " length:" + TXID.length);

        let opcode = "fork"
        console.log("opcode:"+opcode+" validate:"+this.validateOPCODE(opcode));


        opcode = "send"
        console.log("opcode:"+opcode+" validate:"+this.validateOPCODE(opcode));

        opcode = "check"
        console.log("opcode:"+opcode+" validate:"+this.validateOPCODE(opcode));


        let TXINFO = {txid:'txid_13412352152354',token_x:"token_adfasdfadfas",
            token_y:"token_ayjjkkkkkkkk111",opcode:"fork",opval:'123',extra_data:'not have',timestamp_i:13429348349};

        let TXJSONSTR = this.toTXJSONString(TXINFO);

        console.log("TXINFO-toTXJSONString:"+TXJSONSTR);


    }

    //test();
}



class DNALinkFSMContractProcessor
{
    constructor(protocol)
    {
        this.protocol = protocol
        this.coin_num_util = new CoinNumUtil(protocol.root_config.COIN_PRECISION_MAX)
        this.root_config = protocol.root_config
        this.fsm_config  = protocol.fsm_config
    }
    /**
     * 判断是否是NumValType
     * @type {isNumValType}
     */
    isNumValType()
    {
        return this.root_config.TOKEN_VAL_TYPE ==VAL_TYPE.COIN 
            || this.root_config.TOKEN_VAL_TYPE ==VAL_TYPE.SCORE;
    }
    /**
     * 得到token-state（由opcode还有opval，历史数据）
     *
     * calcFSMTokenState
     * @param opcode
     * @param opval
     * @param STATE_INFO
     * @returns {*}
     */
    calcFSMTokenStateParents(opcode,opval,STATE_INFO,direct ,plist)
    {
        let retState = null;
        if(opcode== this.fsm_config.OP_SEND && this.isNumValType())
        {
            //加减方向不能搞错
            console.log("calcFSMTokenStateParents----opcode==OP_SEND && isNumValType()")
            retState =  direct ? this.coin_num_util.minus(STATE_INFO.token_state_val,opval) :
                this.coin_num_util.add(opval, STATE_INFO.token_state_val)
        }
        else if(opcode == this.fsm_config.OP_ROOT)
        {
            retState =  "[]";
        }
        else if(opcode == this.fsm_config.OP_FORK)
        {
            retState = JSON.stringify(plist)
        }
        else if(opcode == this.fsm_config.OP_SETKEY || opcode == this.fsm_config.OP_CHKEY)
        {
            retState = STATE_INFO.public_key;
        }
        else if(opcode == this.fsm_config.OP_ASSERT || opcode == this.fsm_config.OP_CONFIG
             || opcode ==this.fsm_config.OP_PHONE || opcode == this.fsm_config.OP_FSM)
        {
            retState = opval;
        }
        else {
            retState = "state-null";
        }
        //console.log("calcFSMTokenState("+opcode+","+opval+","+JSON.stringify(STATE_INFO),direct+","+") -- retstate="+retState)
        return retState;
    }
    validateFSMTokenHeight(opcode,new_height )
    {
        if(opcode == this.fsm_config.OP_FORK || opcode == this.fsm_config.OP_ROOT)
        {
            if( (new_height-0)>=1) {
                //console.log("validateFSMTokenHeight(opcode,new_height)-",opcode,new_height)
                return false
            }
        }

        return true;
    }
    //处理禁止发送的情形
    banFSMTokenSend(token_x,token_y,opcode)
    {
        if(opcode==this.fsm_config.OP_FORK && token_x == token_y)
        {
            return true;
        }

        if(opcode==this.fsm_config.OP_SEND && this.isNumValType() && token_x == token_y)
        {
            return true;
        }

        //仅当TOKEN_BURN_FLAG=false时，如果direct=false代表着token_root要进行所谓的销毁币操作（禁止该行为）----这里代码未生效，因为这里仅限制了token_x
        if(opcode==this.fsm_config.OP_SEND && this.root_config.TOKEN_VAL_TYPE == VAL_TYPE.COIN  && token_y == this.root_config.TOKEN_ROOT && !this.root_config.TOKEN_BURN_FLAG)
        {
            return true;
        }

        return false;
    }
    /**
     * 判断状态。
     * @type {validateFSMTokenState}
     */
    validateFSMTokenState(token,opcode,opval,STATE_INFO,direct )
    {
        //console.log("validateFSMTokenState-STATE_INFO"+JSON.stringify(STATE_INFO))
        if(opcode==this.fsm_config.OP_SEND && this.isNumValType())
        {
            //创世区块期间，不做严格校验（并且都是由root-token  send出即可）。
            //这样可以确保做审计的时候，总数为0
            if(token==this.root_config.TOKEN_ROOT )
            {
                //如果是coin型，创始币的派发只能在TOKEN_BASE_HEIGHT高度之前（无限派发模式）。----这里修正为仅仅小于COIN_TOP_VAL时
                if(this.root_config.TOKEN_VAL_TYPE == VAL_TYPE.COIN){// && STATE_INFO.token_height<= TOKEN_BASE_HEIGHT) {

                    //仅当TOKEN_BURN_FLAG=false时，如果direct=false代表着token_root要进行所谓的销毁币操作（禁止该行为）----这里代码未生效，因为这里仅限制了token_x
                    if(!direct && !this.root_config.TOKEN_BURN_FLAG) return false;

                    //COIN_TOP_VAL限制了币发行的总量
                    let new_val = direct ? this.coin_num_util.minus(STATE_INFO.token_state_val,opval) :this.coin_num_util.add(opval, STATE_INFO.token_state_val)
                    var sum = this.coin_num_util.add(this.root_config.COIN_TOP_VAL, new_val);
                    return this.coin_num_util.lt(sum,0) ? false : true ;//如果小于0，由为false
                }

                //如果是score类型，则不token_root可以无限派发币
                if(this.root_config.TOKEN_VAL_TYPE == VAL_TYPE.SCORE)
                    return  true;
            }

            //加减方向不能搞错
            STATE_INFO.token_state_val = STATE_INFO.token_state_val ?STATE_INFO.token_state_val:"0"
            opval = opval?opval:"0"

            //console.log("validateFSMTokenState-coin_num_util.minus-"+STATE_INFO.token_state_val+"-"+opval)
            let val = direct ? this.coin_num_util.minus(STATE_INFO.token_state_val,opval) :this.coin_num_util.add(opval, STATE_INFO.token_state_val)
            return direct && this.coin_num_util.lt(val,0) ? false :true;//加是一定能加成功。
        }

        return true;
    }

    /**
     * 计算状态。
     * @type {calcFSMTokenStateVal}
     */
    calcFSMTokenStateVal(token,opcode,opval,STATE_INFO,direct )
    {
        if(opcode==this.fsm_config.OP_SEND && this.isNumValType())
        {
            //加减方向不能搞错
            let val = direct ? this.coin_num_util.minus(STATE_INFO.token_state_val,opval) :this.coin_num_util.add(opval, STATE_INFO.token_state_val)
            return val;
        }

        return "";
    }

}

class DNALinkProtocol
{
    constructor(root_config,fsm_config)
    {
        this.root_config = Object.assign({},root_config)
        this.fsm_config = Object.assign({},fsm_config)
    }
}

function test()
{
    let protocol_config =require('./dnalink_protocol_config')
    let p = new DNALinkProtocol(protocol_config.root_config,protocol_config.fsm_config)
    let token_u = new TokenUtil(p)
    token_u.test()
    let coin_num_util = new CoinNumUtil(p)
    coin_num_util.test();
    let tx_util = new TXUtil(p,'txid.',32,true)
    tx_util.test();

    let fsm_p = new DNALinkFSMContractProcessor(p)
}
// test();

window.DNALinkProtocol = DNALinkProtocol
window.TXUtil = TXUtil
window.TokenUtil = TokenUtil
window.CoinNumUtil =CoinNumUtil
window.DNALinkFSMContractProcessor = DNALinkFSMContractProcessor
window.VAL_TYPE = VAL_TYPE

