/**
 * create by poplang 2022/9/22
 */

// const  key_util = require("../dnalink.protocol/key_util")
// const {DNALinkFSMContractProcessor,CoinNumUtil,TXUtil,TokenUtil,VAL_TYPE} = require('../dnalink.protocol/DNALinkProtocol')
// const DNALinkProtocol =  require('../dnalink.protocol/DNALinkProtocol')

const TX_TABLE_NAME = 'token_tx'
const CHAIN_TABLE_NAME = 'token_chain'
const TOKEN_RELATION_TABLE_NAME = 'token_relation'
const TOKEN_MAP_TABLE_NAME = 'token_map'

// const {TOKEN_NAME,TOKEN_ROOT,TOKEN_ID_LENGTH} = require('../dnalink.protocol/root_config');


const chain_m_config = {
    token_namespace:'dnalinkchain:',//TOKEN_NAME+":",
    token_opcode_cache_timeout_ms:60*60*24,//1000*
}

const createTXDBTableSql = "CREATE TABLE IF NOT EXISTS `token_tx` (\
    `txid` VARCHAR(128) NOT NULL,\
    `token_x` varchar(256) NOT NULL,\
    `token_y` varchar(256) NOT NULL,\
    `opcode` varchar(256) NOT NULL,\
    `opval` TEXT NOT NULL,\
    `extra_data` TEXT NOT NULL,\
    `timestamp_i` INTEGER NOT NULL,\
    `txjson` TEXT not null,\
    `hash` varchar(256) NOT NULL,\
    `sign` varchar(256) NOT NULL,\
    `create_time_i` INTEGER NOT NULL,\
    `create_time` VARCHAR(128) NOT NULL,\
    PRIMARY KEY (`txid`)    \
);CREATE INDEX tx_tokenx_opcode ON token_tx(token_x,opcode);\
CREATE INDEX tx_tokeny_opcode ON token_tx(token_y,opcode);"


const createChainDBTableSql = "CREATE TABLE IF NOT EXISTS `token_chain` (\
    `token` VARCHAR(256) NOT NULL,\
    `height` INTEGER NOT NULL,\
    `txid` VARCHAR(256) NOT NULL,\
    `txjson` TEXT not null,\
    `hash` VARCHAR(256) NOT NULL,\
    `sign` VARCHAR(256) NOT NULL,\
    `token_relate` VARCHAR(128) not null,\
    `create_time_i` INTEGER NOT NULL,\
    `create_time` VARCHAR(128) NOT NULL,\
    PRIMARY KEY (`token`,`height`),\
    UNIQUE (`token`,`txid`,token_relate)\
);create INDEX token_time_i on `token_chain`(`token`,`create_time_i` desc);\
CREATE INDEX token_chain_tx_idx ON token_chain(txid);"

const createTokenRelationDBTableSql = "CREATE TABLE IF NOT EXISTS `token_relation` (\
    `token_x` VARCHAR(256) NOT NULL,\
    `token_y` VARCHAR(256) NOT NULL,\
    `opcode` TEXT NOT NULL,\
    `txid` VARCHAR(256) NOT NULL,\
    `create_time_i` INTEGER NOT NULL,\
    `create_time` VARCHAR(128) NOT NULL,\
    PRIMARY KEY (`token_x`,`token_y`,`opcode`)\
);"

const createTokenMapDBTableSql = "CREATE TABLE IF NOT EXISTS `token_map` (\
    `token` VARCHAR(256) NOT NULL,\
    `map_key` TEXT NOT NULL,\
    `map_value` TEXT NOT NULL,\
    `create_time_i` INTEGER NOT NULL,\
    `create_time` VARCHAR(128) NOT NULL,\
    UNIQUE(`token`,`map_key`)\
);create index token_time on `token_map`(`token`,`create_time`);\
create index token_time_i on `token_map`(`token`,`create_time_i`);"

class DNALinkChainDAO
{
    constructor(db_chain,protocol){
        this.db_chain = db_chain
        this.protocol = protocol
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
    setWebsocketController(websocket_c)
    {
        this.websocket_c = websocket_c
    }

    async initTxDb()
    {

        let flag = await this.db_chain.executeUpdate(createTXDBTableSql);
        return flag
    }
    
    async  initAllTB()
    {
        if(this.db_chain == null) return false;
        let iNum = await this.initTxDb()
        iNum +=await this.initChainDb()
        iNum +=await this.initChainRelationDb();
        iNum +=await this.initChainMapDb();
        return iNum;
    }

    /**
     * 初始化blockchain数据库表
     * @type {initChainDb}
     */
     async  initChainDb()
     {
         let flag = await this.db_chain.executeUpdate(createChainDBTableSql)
         return flag;
     } 
    /**
     * 初始化关系表。
     * @type {function(): (*|*|*|*|*|*|*)}
     */
    async initChainRelationDb()
    {
        let sql = createTokenRelationDBTableSql;
        let flag = await this.db_chain.executeUpdate(sql);
        console.log('initChainRelationDb-flag:'+flag)
        return flag;
    }
    /**
     * 初始化映射表。
     * @type {function(): (*|*|*|*|*|*|*)}
     */
    async initChainMapDb()
    {
        let sql = createTokenMapDBTableSql;
        let flag = await this.db_chain.executeUpdate(sql);
        console.log('initChainMapDb-flag:'+flag)
        return flag;
    }

    /**
     * 查询tx信息
     * @type {query_tx}
     */
    async query_tx(txid)
    {
        let sql = "select * from token_tx where txid=?;"
        let row = await db_tx.queryOne(sql,[txid]);
        return row;
    }

    /**
     * 保存一条交易纪录到数据库。
     * 127.0.0.1/tx/save_tx?txid=txid_C17ESBTVjfyqqTgw&token_x=token_C17ESBTVjfyqqTgw&token_y=token_C17ESBTVjfyqqT1w&opcode=send&opval=137&hash=31addd4243423434&sign=asdfasdfasdfdffddddd
     *
     * @type {save_tx}
     */
    async save_tx(TXINFO)
    {
        let {txid,token_x,token_y,opcode,opval,extra_data,timestamp_i,hash,sign} = TXINFO;

        if(!this.tx_util.validateTXID(txid) ||
            !this.token_util.validateTokenID(token_x) ||
            !this.token_util.validateTokenID(token_y) ||
            !key_util.validateHashORSign(hash) ||
            !key_util.validateHashORSign(sign) ||
            !this.tx_util.validateOPCODE(opcode) ||
            !this.tx_util.validateOPVal(opcode,opval)||
            !this.coin_num_util.validateCoinNumINT(timestamp_i)
            )
        {
            console.log("txid-token-hash-sign-opcode-opval is no ok");
            console.log("validate:"+!this.tx_util.validateTXID(txid) +","+
            !this.token_util.validateTokenID(token_x) +","+
            !this.token_util.validateTokenID(token_y) +","+
            !key_util.validateHashORSign(hash) +","+
            !key_util.validateHashORSign(sign) +","+
            !this.tx_util.validateOPCODE(opcode) +","+
            !this.tx_util.validateOPVal(opcode,opval)+","+
            !this.coin_num_util.validateCoinNumINT(timestamp_i));
            console.log("TXINFO:"+JSON.stringify(TXINFO));
            return -1;
        }

        extra_data = !extra_data ? "":extra_data;
        //2019-1-3 ---timestamp_i这个绝对是不能缺少的，因为txjson与hash，sign都与此有关（一旦timestamp_i对不上就会崩溃）
        //timestamp_i = timestamp_i&&coin_num_util.validateCoinNumINT(timestamp_i)?timestamp_i: "UNIX_TIMESTAMP(NOW())";
        let txjson = this.tx_util.toTXJSONString(TXINFO);

        //保存进数据库表
        let sql = "insert or ignore into "+TX_TABLE_NAME+"(txid,token_x,token_y,opcode,opval,extra_data,timestamp_i,txjson,hash,sign,create_time_i,create_time) values("+
            "?,?,?,?,?,?,?,?,?,?,strftime('%s','now') ,datetime('now','localtime'));";

        let iNum = await this.db_chain.queryNum(sql,[txid,token_x,token_y,opcode,opval,extra_data,timestamp_i,txjson,hash,sign]);
        return iNum;
    }


    /**
     * 输出链
     * EXPLAIN  SELECT * FROM token_chain WHERE token='txid_C17ESBTVjfyqqTgw' AND height>0 ORDER BY height ASC LIMIT 10
     * @type {queryChain}
     */
    async queryChain(token,begin,len)
    {
        if(this.token_util.validateTokenID(token)){
            let sql = "select * from " + CHAIN_TABLE_NAME + " where token=? and height>=? order by height asc limit ?;"
            let rows = await this.db_chain.query(sql,[token,begin,len]);
            //console.log('query-chain-rows:'+JSON.stringify(rows)+' token:'+token+' len:'+len)
            return rows;
        }else{
            let sql = "select * from " + CHAIN_TABLE_NAME + " order by create_time_i desc limit ?,?;";
            let rows = await this.db_chain.query(sql,[begin,len]);
            return rows;
        }
    }
    /**
     * 得到txid
     * @type {queryTXByChain}
     */
    async queryTXByChain(token,txid)
    {
        let sql = "select b.txid,b.token_x,b.token_y,b.opcode,opval,extra_data,timestamp_i,a.txjson,a.hash,a.sign  from "+CHAIN_TABLE_NAME+" a , "+TX_TABLE_NAME+
                " b where token=? and a.txid=? and a.txid=b.txid";
        //console.log("queryTXByChain-sql:"+sql)
        let row = await this.db_chain.queryOne(sql,[token,txid]);
        return row;
    }
    /**
     * 得到链的父结点。
     * @type {queryChain}
     */
    async queryTokenParentRow(token)
    {
        //token = db_chain.escape(token);
        let sql = "select * from "+CHAIN_TABLE_NAME+" where token=? and height=0 limit 1";
        let row = await this.db_chain.queryOne(sql,[token]);
        //console.log("queryTokenParent-row:"+JSON.stringify(row))
        return row;
    }

    /**
     * 得到高度
     * @type {queryTokenMaxHeigth}
     */
    async queryTokenChainLast(token)
    {
        let sql = "select * from "+CHAIN_TABLE_NAME+" where token=? order by height desc limit 1";
        let row = await this.db_chain.queryOne(sql,[token]);
        return row;
    }

    /**
     * 保存tx到chain里面
     * @type {saveTokenTX}
     *     `token_relate` varchar(128) not null,\
     `opcode` varchar(32) not null,\
    `opval` text not null,\
    `token_state` text not null,\
    `token_height` text not null,\
    */
    async saveTX2TokenChain(token,height,txid,txjson,hash,sign, token_relate)
    {
        height = parseInt(height)
        let sql = "insert or ignore into "+CHAIN_TABLE_NAME+"(token,height,txid,txjson,hash,sign, token_relate,create_time_i,create_time)"
            +" values(?,?,?,?,?,?,?,strftime('%s','now') ,datetime('now','localtime'));"

        let iNum = await this.db_chain.queryNum(sql,[token,height,txid,txjson,hash,sign, token_relate]);
        // console.log("saveTX2TokenChain-iNum:"+iNum);
        // console.log("saveTX2TokenChain-param:",token,height,txid,txjson,hash,sign, token_relate);
        return iNum;
    }
    // getTXJson(info){
    //     let txinfo = this.getTXInfo(info)
    //     return JSON.stringify(txinfo)
    // }
    getTXInfo(info){
        // if(!info) return null;
        let txinfo = null;
        try{
            txinfo = JSON.parse(info.txjson)
        }catch(ex){
            // console.log('saveTXQueue2TokenChain2TXRecords-txjson-JSON.parse-exception:'+ex)
            txinfo = info.txjson
        }
        // if(typeof info.txjson.token_x !='undefined' ) info.txjson = JSON.stringify(info.txjson)
        return txinfo
    }
    async saveTXQueue2TokenChain2TXRecords(info)
    {
        let txinfo = this.getTXInfo(info)
        let txjson = JSON.stringify(txinfo)// JSON.stringify(txinfo) // info.txjson// JSON.stringify(info.txjson) 
        let sql = "insert or ignore into "+TX_TABLE_NAME+"(txid,token_x,token_y,opcode,opval,extra_data, timestamp_i,"+
                    "txjson,hash,sign,create_time_i,create_time)"
                    +" values(?,?,?,?,?,?,?,?,?,?,?,?);"
        let iNum =  await this.db_chain.executeUpdate(sql,[info.txid,txinfo.token_x,txinfo.token_y,txinfo.opcode,
                txinfo.opval,txinfo.extra_data,txinfo.timestamp_i,txjson,info.hash,info.sign,txinfo.timestamp_i,
                str_filter.GetDateTimeFormat(txinfo.timestamp_i)])
        return iNum
    }
    /**
     * 保存一个队列进入chain表中
     * @type {saveTXQueue2TokenChain}
     */
    async saveTXQueue2TokenChain(rows,syncFlag = false,syncOnceFlag = false)
    {
        console.log('into saveTXQueue2TokenChain:rows:',(rows instanceof Array),typeof rows,rows.length)
        // if(!(rows instanceof Array))
        //     return -1;

        if(rows.length<=0)
            return -1;

        let i = 0,iNum =0;
        let valuesStr =""
        let newRows = [];

        let sql = "insert or ignore into "+CHAIN_TABLE_NAME+"(token,height,txid,txjson,hash,sign, token_relate,create_time_i,create_time)"
                    +" values(?,?,?,?,?,?,?,strftime('%s','now') ,datetime('now','localtime'));"
        //let stm = this.db_chain.prepare(sql)
        let needSaveTXRecordsMap = new Map(), iSaveTxNum = 0;
        for(i=0;i<rows.length;i++)
        {
            let info = null;
            try{ 
                info = JSON.parse(rows[i]);
            }catch(ex){
                info = rows[i]
            }
            let height0 = parseInt(info.height)
            //stm.run([info.token,height0,info.txid,info.txjson,info.hash,info.sign,info.token_relate])
            // console.log('typeof info.txjson.token_x:',info.txjson.hasOwnProperty('token_x'),info.txjson)
            if( syncFlag && !needSaveTXRecordsMap.has(info.txid)) {
                iSaveTxNum+=await this.saveTXQueue2TokenChain2TXRecords(info)
                needSaveTXRecordsMap.set(info.txid,'')
            }
            // if(typeof info.txjson.token_x !='undefined' ) info.txjson = JSON.stringify(info.txjson)
            let txinfo =  this.getTXInfo(info) 
            let txjson = JSON.stringify( txinfo)
            iNum+=await this.db_chain.executeUpdate(sql,[info.token,height0,info.txid,txjson,info.hash,info.sign,info.token_relate])

            //保存parse之后的info和txjson
            newRows.push(info);
            newRows[i].txjson = txinfo;// typeof newRows[i].txjson == 'string' ?  JSON.parse(newRows[i].txjson):newRows[i].txjson

            //进行cached清除处理
            let txjsonTmp = txinfo//newRows[i].txjson//JSON.parse(info.txjson)
            if((!syncFlag || syncOnceFlag) &&( info.token == txjsonTmp.token_x || info.token == txjsonTmp.token_y))
            {
                this.db_chain.del(chain_m_config.token_namespace+info.token+'_'+txjsonTmp.opcode)
                //fix the web3.key bug on 2022/8/5
                if(txjsonTmp.opcode == this.fsm_config.OP_WEB3_KEY)
                {
                    //const token_writer = require("../dtns/TokenWriter")
                    let clear_ret = this.engine ?  await this.engine.clearTokenState(info.token) :null;
                    console.log('OP_WEB3_KEY:clear-ret:'+clear_ret)
                }
            }
        }
        console.log("saveTXQueue2TokenChain-iNum:"+iNum);
        console.log("saveTXQueue2TokenChain2TXRecords-iNum:"+iSaveTxNum);
        console.log("saveTXQueue2TokenChain-param:",rows);

        //插入成功，查找relation写入的tokens
        if(iNum>0)
        {
            let relateCnt = await this.saveTXQueue2TokenRelations(newRows);
            console.log('saveTXQueue2TokenChain-relateCnt:'+relateCnt)

            let mapCnt = await this.saveTXQueue2TokenMaps(newRows);
            console.log('saveTXQueue2TokenChain-mapCnt:'+mapCnt)

            //异步处理----来自children-token，要避免死循环？
            this.send2cloud(newRows);
            //同步到cloud.forklist.dtns
            //需要向token_parent同步（此时应订阅到了父节点）
            let token = this.root_config.TOKEN_ROOT
            //只有不是真正的根结点，才可向父结点同步----superdimension
            if(!(token.indexOf('_0000000000000000')>0))  
            {
               this.websocket_c.send_msg2all_parent(rows)//2022-9-26
            }
            //同步父节点数据。自身是client
        }
        return iNum;
    }

    /**
     * 将数据同步到cloud（以便订阅最新纪录）。
     * @param rows
     * @returns {Promise<void>}
     */
    async send2cloud(rows)
    {
        if(typeof this.websocket_c !='undefined')
            this.websocket_c.send_msg2all_client(rows)//下发的是完整数据。
    }

    /**
     * 将关系保存起来。
     * @param rows
     * @returns {Promise<number>}
     */
    async saveTXQueue2TokenRelations(rows)
    {
        let i=0, cnt=0;
        for(;i<rows.length;i++)
        {
            let info = rows[i];//JSON.parse(rows[i]);
            let txjson =info.txjson// typeof info.txjson == 'string' ? JSON.parse(info.txjson):info.txjson
            let {token_x,token_y,opcode,txid} = txjson

            if( !(info.token_relate == this.token_util.TOKEN_X && txjson.token_x == info.token ||
                info.token_relate == this.token_util.TOKEN_Y && txjson.token_y == info.token)) continue;

            if(!(txjson.opcode=='relate' || txjson.opcode=='join' || txjson.opcode=='hold' ||
                txjson.opcode.length==4 && txjson.opcode.indexOf('rel')==0)) continue;

            let sql = null,iNum = 0;
            if(txjson.opval=='add')
            {
                sql = 'insert or ignore into '+TOKEN_RELATION_TABLE_NAME+'(token_x,token_y,opcode,txid,create_time_i,create_time) values(?,?,?,?,'
                            +"strftime('%s','now') ,datetime('now','localtime'));"
                iNum = await this.db_chain.executeUpdate(sql,[token_x,token_y,opcode,txid])
            }else if(txjson.opval=='del')
            {
                sql = 'delete from '+TOKEN_RELATION_TABLE_NAME+' where token_x=? and token_y=? and opcode=? ;'
                iNum = await this.db_chain.executeUpdate(sql,[token_x,token_y,opcode])
            }else
            {
                continue;
            }

            console.log("saveTXQueue2TokenRelations-"+token_x+'-'+token_y+'-'+opcode+'-'+txjson.opval+'-'+iNum)
            cnt += iNum;
        }
        console.log('saveTXQueue2TokenRelations-cnt:'+cnt)
        return cnt;
    }

    /**
     * 将映射保存起来。
     * @param rows
     * @returns {Promise<number>}
     * 
     * http://127.0.0.1:59868/op?appid=10001&secret_key=d9a45326b6f1a5aefef8d199b580fad1&opcode=map&token_x=tns_0000000000000000&token_y=tns_0000000000000000&opval=add&extra_data=%7B%22map_key%22%3A%22www.dtns.cn%22%2C%22map_value%22%3A%22tns_0000000000000000%22%7D
     * http://127.0.0.1:59868/op?appid=10001&secret_key=d9a45326b6f1a5aefef8d199b580fad1&opcode=map&token_x=tns_0000000000000000&token_y=tns_0000000000000000&opval=del&extra_data=%7B%22map_key%22%3A%22www.dtns.cn5%22%2C%22map_value%22%3A%22tns_12%22%7D
     */
    async saveTXQueue2TokenMaps(rows)
    {
        let i=0, cnt=0;
        for(;i<rows.length;i++)
        {
            let info = rows[i];//JSON.parse(rows[i]);
            let txjson = info.txjson//typeof info.txjson == 'string' ? JSON.parse(info.txjson):info.txjson//info.txjson;//JSON.parse(info.txjson);
            let {token_x,token_y,opcode,txid} = txjson

            if( !(info.token_relate == this.token_util.TOKEN_X && txjson.token_x == info.token ||
                info.token_relate == this.token_util.TOKEN_Y && txjson.token_y == info.token)) continue;
    
            if(!(txjson.opcode=='map')) continue;
    
            let sql = null,iNum = 0;
            let map_info = null;
            try{ 
                map_info = JSON.parse(txjson.extra_data);
                if(!map_info.map_key) continue;
            }catch(ex)
            {
                console.log('saveTXQueue2TokenMaps-ex:'+txjson.extra_data);
                continue;
            }
            let {map_key,map_value} = map_info
            // txid = info.txid
            if(txjson.opval=='add')
            {
                sql = "update  "+TOKEN_MAP_TABLE_NAME+" set map_value=? where token=? and map_key=? limit 2;"
                iNum = await this.db_chain.executeUpdate(sql,[map_value,token_y,map_key])
                {
                    sql = 'insert or ignore into '+TOKEN_MAP_TABLE_NAME+'(token,map_key,map_value,create_time_i,create_time) values('
                        +"?,?,?,strftime('%s','now') ,datetime('now','localtime'));";
                    iNum += await this.db_chain.executeUpdate(sql,[token_y,map_key,map_value]) 
                } 
            }else if(txjson.opval=='del')
            {
                sql = 'delete from '+TOKEN_MAP_TABLE_NAME+' where token=? and map_key=? ;'
                iNum = await this.db_chain.executeUpdate(sql,[token_y,map_key])
            }else
            {
                continue;
            }

            console.log("saveTXQueue2TokenMaps-"+token_x+'-'+token_y+'-'+opcode+'-'+txjson.opval+'-'+iNum)
            cnt += iNum;
        }
        console.log('saveTXQueue2TokenMaps-cnt:'+cnt)
        return cnt;
    }

    /**
     * 查询relations（token关系），非常有用的关系（哈哈）。
     * @type {queryTokenRelations}
     */
    async queryTokenRelations(token,opcode,isX,begin,len)
    {
        let sql = 'select * from '+TOKEN_RELATION_TABLE_NAME+" where token_"+(isX?'x':'y')+"=?"+
            " and opcode=? order by create_time desc limit ?,?;"
        let rows = await this.db_chain.query(sql,[token,opcode,begin,len]);
        return rows;
    }

    /**
     * 判断关系
     * @type {function(*=, *=, *=): *}
     */
    async checkTokenRelations(token_x,token_y,opcode)
    {
        let sql = 'select * from '+TOKEN_RELATION_TABLE_NAME+" where token_x=? and token_y=? and opcode=? ;"
        let row = await this.db_chain.queryOne(sql,[token_x,token_y,opcode]);
        return row;
    }

    /**
     * 查询token所有map-key-values（token映射）---关于token的所有的映射key-values
     * @type {queryTokenMaps}
     */
    async queryTokenMapKeyValues(token,begin,len)
    {
        let sql = 'select * from '+TOKEN_MAP_TABLE_NAME+" where token=? order by create_time desc limit ?,?;"
        let rows = await this.db_chain.query(sql,[token,begin,len]);
        return rows;
    }

    /**
     * 查询token所有map-keys（token映射）-----单纯返回所有Key
     * @type {queryTokenMaps}
     */
    async queryTokenMapKeys(token,begin,len)
    {
        let sql = 'select map_key from '+TOKEN_MAP_TABLE_NAME+" where token=? order by create_time desc limit ?,?;"
        let rows = await this.db_chain.query(sql,[token,begin,len]);
        return rows;
    }
    
    /**
     * 查询token的map-value（token映射）-----单纯返回Key对应的value
     * @type {queryTokenMaps}
     */
    async queryTokenMapValue(token,map_key)
    {
        let sql = 'select * from '+TOKEN_MAP_TABLE_NAME+" where token=? and map_key=?;"
        let row = await this.db_chain.queryOne(sql,[token,map_key]);
        return row;
    }

    /**
     * 得到最后一个height，fork的token_state，send的XX值。
     * @type {queryTokenStates}
     */
    async queryTokenStates(token)
    {
        let height = await this.queryTokenHeight(token);
        let plist = await this.queryTokenParent(token);
        let val_info = this.fsm_p.isNumValType()?await this.queryTokenVal(token,this.fsm_config.OP_SEND) :await this.queryTokenByOpcode(token,this.fsm_config.OP_SEND);
        //console.log('queryTokenStates-token:'+token+'-val_info:'+JSON.stringify(val_info)+' str-type:'+(typeof val_info))
        //2022-8-5新增web3.key的支持
        let web3_info = await this.queryTokenByOpcode(token,this.fsm_config.OP_WEB3_KEY);
        let forkInfo = await this.queryTokenByOpcode(token,
             token.indexOf('0000000000000000')>0 ? this.fsm_config.OP_ROOT:this.fsm_config.OP_FORK);
        let val = this.fsm_p.isNumValType() ? (val_info ?  JSON.parse(val_info.txjson).token_state:"0") :
                                        (val_info ?  JSON.parse(val_info.txjson).opval:"") ;
        let web3_key = web3_info?JSON.parse(web3_info.txjson).opval:null;
        let public_key = forkInfo?JSON.parse(forkInfo.txjson).opval:null;
        let txid = val_info ? val_info.txid:"null";

        let ret = {height:height,list:plist,val:val,txid:txid,web3_key,public_key};
        console.log("queryTokenStates-ret"+JSON.stringify(ret));

        return ret;
    }

    /**
     * 主要用于获取parent链-token的正确state-val的值（例如ib3.node-token-id的dnts-int值
     * 2023-11-16修复
     * @param {*} token 
     * @param {*} opcode 
     * @returns 
     */
    async queryTokenVal(token,opcode)//send的操作值 
    {
        let sql = "select a.* from "+CHAIN_TABLE_NAME+" a ,"+TX_TABLE_NAME+" b where token=? and a.txid=b.txid and b.opcode="+
        "? and ( (token = b.token_x and a.token_relate='token_x')  or (token=b.token_y and a.token_relate='token_y') ) order by height desc limit ?,?;"

        let rows = await this.db_chain.query(sql,[token,opcode,0,1]);
        console.log('queryTokenVal-token:'+token, opcode ,rows)
        if(rows && rows.length>0)
            return rows[0]
        return null
    }

    /**
     * 得到高度。
     */
    async queryTokenHeight(token)
    {
        let sql = "select * from "+CHAIN_TABLE_NAME+" where token=? order by height desc limit 1;";
        let row = await this.db_chain.queryOne(sql,[token]);

        if(row)
        {
            return row['height'];
        }
        else
            return -1;
    }
    /**
     * 得到fork值
     */
    async queryTokenParent(token)
    {
        let sql = "select txjson from "+CHAIN_TABLE_NAME+" where token=? and height=0 limit 1;"
        let row = await this.db_chain.queryOne(sql,[token]);

        if(row){
            let txjson = JSON.parse(row.txjson);
            return txjson.token_state;
        }
        else
            return "[]"
    }

    /**
     * 得到opcode最后一个值
     */
    async queryTokenByOpcode(token,opcode)
    {
        let rows = await this.queryTokenChainByTokenAndOpcode(token,0,1,opcode)
        if(rows && rows.length>=1) return rows[0]
        return null
        if(false)
        {
        //console.log('into queryTokenByOpcode:'+token+'\topcode:'+opcode)

        let checkSql =" select * from token_tx where (token_x = ? or token_y = ?) and opcode = ?   \
                    order by create_time_i desc limit 1;"
        let checkRows =  await  this.db_chain.query(checkSql,[token,token,opcode])
        console.log('queryTokenByOpcode-checkRows-length:'+checkRows.length)
        if(checkRows.length<=0) return null

        // let sql = "select a.* from "+CHAIN_TABLE_NAME+" a,"+TX_TABLE_NAME+
        // " b where ((b.token_x=? and b.opcode=?) or (b.token_y=? and b.opcode=?)) "+
        // " and a.txid=b.txid and a.token=? order by a.height desc limit 1";
        // console.log('query-token-opcode-sql:'+sql)
        // let row = await this.db_chain.queryOne(sql,[token,opcode,token,opcode,token]);

        let sql = "select a.* from "+CHAIN_TABLE_NAME+" a,"+TX_TABLE_NAME+" b where a.token=?"+
            " and  (token = b.token_x or token=b.token_y )  and a.txid=b.txid and b.opcode=? order by a.height desc limit 1";
        let row = await this.db_chain.queryOne(sql,[token,opcode]);
        console.log('query-token-opcode-sql:'+sql)

        if(row){
            return row;
        }
        else
            return null;
        }
    }
    /**
     * 得到token_chain记录（同步情况）、按时间顺序排列
     * @type {queryTokenChainByTXID}
     */
    async queryTokenChainByTXID(txid)
    {
        let sql = "select * from "+CHAIN_TABLE_NAME+"  where txid=? order by create_time asc";
        let rows = await this.db_chain.query(sql,[txid]);

        if(rows){
            return rows;
        }
        else
            return null;
    }

    /**
     * 查询token的chain情况（倒序排列）
     * @type {queryTokenChainByToken}
     */
    async queryTokenChainByToken(token,begin,len)
    {
        let sql = "select * from "+CHAIN_TABLE_NAME+"  where token=? order by height desc limit ?,?;"
        let rows = await this.db_chain.query(sql,[token,begin,len]);

        if(rows){
            return rows;
        }
        else
            return null;
    }
    /**
     * 查流水帐
     * @type {queryTokenChainByTokenAndOpcode}
     */
    async queryTokenChainByTokenAndOpcode(token,begin,len,opcode)
    {
        //读取缓存
        //chain_redis.del(chain_m_config.token_namespace+info.token+'_'+txjsonTmp.opcode)
        if(parseInt(begin) == 0 && parseInt(len) ==1)
        {
            //await token_writer_redis.get(token_writer_config.token_namespace_state+token);
            let rowsStr = await this.db_chain.get(chain_m_config.token_namespace+token+'_'+opcode)
            // console.log('rowsStr:'+rowsStr)
            if(rowsStr)
            {
                try{
                    let rows = JSON.parse(rowsStr)
                    return rows;
                }catch(ex)
                {
                    console.log('chain_m-queryTokenChainByTokenAndOpcode:rowsStr='+rowsStr)
                    this.db_chain.del(chain_m_config.token_namespace+token+'_'+opcode)
                }
            }
        }
        //正常地从数据库读取
        let checkSql =" select * from token_tx where (token_x = ? or token_y = ?) and opcode = ?   \
                    order by create_time_i desc limit 1;"// ?,?;"
        let checkRows =  await  this.db_chain.query(checkSql,[token,token,opcode])//,0,parseInt(begin)+parseInt(len)])
        console.log('checkRows-length:'+(!checkRows || checkRows.length<=0 ? 0: checkRows.length)+' token:'+token+' opcode:'+opcode)
        if(!checkRows || checkRows.length<=0) return null

        //2022-11-9，当且仅当opcode== this.fsm_config.OP_FORK（自己fork于parent时，token_x=me）|| web3.key设置时，最好token_x=token_y
        let sql = null
        //这里针对fork进行特殊处理，当len>1时，为查询子token的列表，当为len=1时，是查询自身token的情况。on 2023-1-11
        if(!(parseInt(begin) == 0 && parseInt(len) ==1))
        {
            sql = "select a.* from "+CHAIN_TABLE_NAME+" a ,"+TX_TABLE_NAME+" b where token=? and a.txid=b.txid and b.opcode="+
                "? and (token = b.token_y "+(opcode== this.fsm_config.OP_FORK ? '':' or token=b.token_x ')+") order by height desc limit ?,?;"
        }
        else 
            sql = "select a.* from "+CHAIN_TABLE_NAME+" a ,"+TX_TABLE_NAME+" b where token=? and a.txid=b.txid and b.opcode="+
            "? and (token = b.token_x "+(opcode== this.fsm_config.OP_FORK ? '':' or token=b.token_y ')+") order by height desc limit ?,?;"
        
        let rows = await this.db_chain.query(sql,[token,opcode,begin,len]);
        // let sql = "select a.* from "+CHAIN_TABLE_NAME+" a,"+TX_TABLE_NAME+
        //     " b where ((b.token_x=? and b.opcode=?) or (b.token_y=? and b.opcode=?)) "+
        //     " and a.txid=b.txid and a.token=? order by a.height desc limit ?,?";
        //let rows = await this.db_chain.query(sql,[token,opcode,token,opcode,token,begin,len]);

        if(rows){
            //先设置缓存
            if(parseInt(begin) == 0 && parseInt(len) ==1 
            //以下g_loginDtnsAndForklist_started是为了避免在同步时间，使用opcode的缓存功能  于2023-6-16修复x.dtns的BUG
                && typeof g_loginDtnsAndForklist_started !='undefined' && g_loginDtnsAndForklist_started)
            {
                let setRet = await this.db_chain.set(chain_m_config.token_namespace+token+'_'+opcode,JSON.stringify(rows),chain_m_config.token_opcode_cache_timeout_ms);
                console.log('chain_m-queryTokenChainByTokenAndOpcode:setCacheRet:'+setRet+' rows:'+JSON.stringify(rows))
            }

            return rows;
        }
        else
            return null;
    }
}

window.DNALinkChainDAO = DNALinkChainDAO