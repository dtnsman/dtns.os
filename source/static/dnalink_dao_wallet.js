/**
 * create by poplang 2022/9/22
 */
// const  key_util = require("../dnalink.protocol/key_util")
// const {DNALinkFSMContractProcessor,CoinNumUtil,TXUtil,TokenUtil,VAL_TYPE} = require('../dnalink.protocol/DNALinkProtocol')
// const DNALinkProtocol =  require('../dnalink.protocol/DNALinkProtocol')

// const {TOKEN_NAME,TOKEN_ROOT,TOKEN_ID_LENGTH} = require('../dnalink.protocol/root_config');
const token_namespace = 'dnalinktx:'//TOKEN_NAME+":"
const token_opcode_cache_timeout_ms = 60*60*24 //1天超时
const wallet_token_key ='dnalinktx:wallet:'// TOKEN_NAME+":wallet:"

const TB_WALLET_NAME = 'token_wallet'

const initUserWalletTablerSql = "CREATE TABLE IF NOT EXISTS `token_wallet` (\
    `token` VARCHAR(256) NOT NULL,\
    `secret_key` VARCHAR(256) ,\
    `secret_salt` VARCHAR(256) ,\
    `private_key` VARCHAR(256) NOT NULL,\
    `public_key` VARCHAR(256) NOT NULL,\
    `create_time_i` INTEGER NOT NULL,\
    `create_time` VARCHAR(128) NOT NULL,\
    PRIMARY KEY (`token`)    \
);"

class DNALinkWalletDAO
{
    constructor(db_wallet,protocol){
        this.db_wallet = db_wallet
        this.protocol = protocol;

        this.root_config = this.protocol.root_config
        this.fsm_config = this.protocol.fsm_config
        this.fsm_p = new DNALinkFSMContractProcessor(this.protocol)

        this.tx_util = new TXUtil(this.protocol)
        this.token_util = new TokenUtil(this.protocol)
        this.coin_num_util = new CoinNumUtil(this.protocol.root_config.COIN_PRECISION_MAX)
    }

    setEngine(engine)
    {
        this.engine = engine
    }

    /**
     * 初始化Table。
     * @type {initWalletDb}
     */
    async initWalletDb()
    {
        let sql = initUserWalletTablerSql;
        let flag = await this.db_wallet.executeUpdate(sql);
        //console.log("initWalletDb-flag:"+flag+" sql:"+sql)
        if(flag)
        {
            return "success";
        }else{
            return "failed";
        }
    }
    async clearTokenCache(token)
    {
        let flag = await this.db_wallet.del(wallet_token_key+token)
        console.log('clearTokenCache-wallet-cache-flag:'+flag+' token:'+token)
        return flag;
    }
    /**
     * 保存cache
     */
    async cacheWalletKeys(token,info)
    {
        if(!this.token_util.validateTokenID(token)) return false;
        let cache_ret = await this.db_wallet.set(wallet_token_key+token,JSON.stringify(info),60*60);
        //console.log("4-10-cacheWalletKeys-cache_ret:"+cache_ret+'\tget:'+await this.db_wallet.get(wallet_token_key+token))
        return cache_ret
    }

    /**
     * 得到缓存信息。
     */
    async queryCacheWalletKeys(token)
    {
        let info = await this.db_wallet.get(wallet_token_key+token);
        console.log("queryCacheWalletKeys-info:"+info)
        if(info)
        {
            return JSON.parse(info);
        }
        return null
    }

    /**
     * 保存token和密钥信息。
     * @type {saveTokenSignKeys}
     */
    async saveTokenSignKeys(token,private_key,public_key)
    {

        if(!this.token_util.validateTokenID(token))
            return "token failed";
        if(private_key!='***' && !key_util.invalidateKeys(private_key,public_key) ) {
            console.log("private_key:"+private_key+",public_key:"+public_key)
            return "keys failed";
        }

        // token = db_wallet.escape(token);
        // private_key = db_wallet.escape(private_key);
        // public_key = db_wallet.escape(public_key);

        let sql  = "insert or ignore into "+TB_WALLET_NAME+"(token,private_key,public_key,create_time_i,create_time) values("
            +"?,?,?,strftime('%s','now') ,datetime('now','localtime'))";

        let iNum = await this.db_wallet.queryNum(sql,[token,private_key,public_key]);

        if(iNum>0)
        {
            let info = {token,private_key,public_key};
            this.cacheWalletKeys(token,info);
        }

        return iNum;
    }


    /**
     * 新创建一个token帐户
     * @type {getNewToken}
     */
    async getNewToken(token_tips=null,dst_token=null,space=null,tips=null)
    {
        var token = null;

        if(this.token_util.validateTokenID(dst_token))
            token = dst_token;
        else if(space)
            token = this.token_util.newTokenIDBySpace(space);
        else if(tips)
            token = this.token_util.newTokenIDByTIPS(token_tips,tips);
        else
            token = this.token_util.newTokenID();

        // let token = token_util.newTokenID();
        let private_key = key_util.newPrivateKey();
        let public_key = key_util.getPublicKey(private_key);

        let sql  = "insert  or ignore  into "+TB_WALLET_NAME+"(token,private_key,public_key,create_time_i,create_time) values("
            +"?,?,?,strftime('%s','now') ,datetime('now','localtime'));"

        let iNum = await this.db_wallet.queryNum(sql,[token,private_key,public_key]);
        //console.log('sql:'+sql+'\niNum:'+iNum+' token:'+token+' private_key:'+private_key+' public_key:'+public_key)
        if(iNum>0)
        {

            let info= {
                token:token,
                private_key:private_key,
                public_key:public_key
            }
            this.cacheWalletKeys(token,info);
            return info
        }else{
            return iNum;
        }
    }
    async delToken(token)
    {
        if(!this.token_util.validateTokenID(token))
            return false;
        let sql  = "delete from "+TB_WALLET_NAME+" where token = ?;"
        let iNum = await this.db_wallet.queryNum(sql,[token]);
        
        let cache_ret = await this.db_wallet.del(wallet_token_key+token);
        console.log('cached-del:'+token+' ret:'+cache_ret +' sql-del-ret-num:'+iNum)
    
        return iNum>0;
    }
    /**
     * 查询数据库中的密钥表信息。
     * @type {queryTokenKeys}
     */
    async queryTokenKeys(token)
    {
        if(!this.token_util.validateTokenID(token))
            return "tokenid not ok"

        let sql  = "select private_key,public_key from "+TB_WALLET_NAME+" where token=?;"//+TOKEN;

        let ret = await this.db_wallet.queryOne(sql,[token]);
        if(ret)
        {
            let info = {
                token:token,
                private_key:ret.private_key,
                public_key:ret.public_key,
            };
            this.cacheWalletKeys(token,info);
            return info
        }else{
            return null;
        }
    }

    /**
     * 将所有的云钱包里的数据缓存到cache
     * @type {cacheTokenKeys}
     */
    async cacheTokenKeys()
    {
        let sql = "select * from "+TB_WALLET_NAME;
        let rows = await this.db_wallet.query(sql);
        if(!rows || rows.length<=0)
        {
            return {ret:false,msg:"wallet is empty"}
        }

        for(i=0;i<rows.length;i++)
        {
            let keys = rows[i];
            let info = {token:keys.token,private_key:keys.private_key,public_key:keys.public_key}
            cacheWalletKeys(keys.token,info);
        }

        return {ret:false,msg:"wallet cached ok, cnt:"+rows.length}
    }

    /**
     * 签名内容
     * @type {signMsg}
     */
    async signMsg(msg,msg_hash,private_key,public_key)
    {
        let sign =await key_util.signMsg(msg_hash,private_key);

        //判断公钥与sign对应得上
        let flag = false;
        try{
            flag = await key_util.verifySignMsg(msg_hash,sign,public_key);
        }catch(err){
            return "verifySignMsg failed";
        }

        return flag ? sign:null;
    }

    /**
     * 查询时间戳
     * @type {queryTimestamp}
     */
    async queryTimestamp() {
        let sql = "SELECT strftime('%s','now') AS timestamp_i;";
        let row =  await this.db_wallet.queryOne(sql);
        if(row){
            return row['timestamp_i'];
        }else{
            return -1;
        }
    }
}

window.DNALinkWalletDAO = DNALinkWalletDAO