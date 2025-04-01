/**
 * create by poplang , 2022/9/22
 */
// const str_filter = require('../libs/str_filter')
// const key_util = require("../dnalink.protocol/key_util")
// const {DNALinkFSMContractProcessor,CoinNumUtil,TXUtil,TokenUtil,VAL_TYPE} = require('../dnalink.protocol/DNALinkProtocol')
// const DNALinkProtocol =  require('../dnalink.protocol/DNALinkProtocol')
// const Events = require('events');

const tx_writer_config = {
    tx_namespace:+"dnalinkengine:",
    tx_namespace_txinfo:"dnalinkengine:txinfo:",
    tx_wait_write_queue:'dnalinkengine:tx_wait_write_queue',
    tx_wait_write_queue_lock:'dnalinkengine:tx_wait_write_queue_lock',
    tx_now_write_queue:'dnalinkengine:tx_now_write_queue',
    tx_write_queue_monitor_sub:'dnalinkengine:tx_write_queue_monitor_sub',
    tx_write_queue_monitor_sub_one:'dnalinkengine:tx_write_queue_monitor_sub_one:',
    tx_cache_timeout_s:60,
    tx_write_timeout_ms:10000,
    tx_write_checkout_interval_ms:300,
}

const token_writer_config = {
    token_namespace:"dnalinkengine:",
    token_chain_write_queue:'dnalinkengine:token_chain_write_queue',
    token_namespace_state:"dnalinkengine:state:",
    token_namespace_state_timeout:60*60,
    token_wait_write_queue:'dnalinkengine:token_wait_write_queue:',
    token_now_write_queue:'dnalinkengine:token_now_write_queue:',
    token_write_queue_monitor_sub:'dnalinkengine:token_write_queue_monitor_sub:',
    token_write_queue_monitor_sub_one:'dnalinkengine:token_write_queue_monitor_sub_one:',
    token_write_checkout_interval_ms:2000,
    token_write_timeout_ms:10000,

}

class TokenQueue{
    constructor()
    {
        this.kv = new Map();
    }
    get(token)
    {   
        if(!this.kv.has(token)){
            this.kv.set(token,new Set())
        }
        let queue = this.kv.get(token)
        return queue
    }
}
class EventEmitter{
    constructor(){
        this.eventMap = new Map()
    }
    on(channelName,func){
        // console.log('EventEmitter.on----channelName:'+channelName+' typeof-func:'+(typeof func))
        if(!channelName) return false
        if(typeof func!='function')
            return false
        let list = this.eventMap.has(channelName) ?  this.eventMap.get(channelName):[]
        list.push(func)
        this.eventMap.set(channelName,list)
        return true
    }
    removeListener(channelName,func)
    {
        if(!channelName) return false
        if(typeof func!='function')
            return false
        let list = this.eventMap.has(channelName) ?  this.eventMap.get(channelName):[]
        let newList = []
        let flag = false;
        for(let i=0;i<list.length;i++){
            if(list[i] != func) newList.push(list[i])
            else flag = true;
        }
        this.eventMap.set(channelName,newList)
        return flag
    }
    listenerCount(channelName){
        if(!this.eventMap.has(channelName)) return -1
        let list = this.eventMap.get(channelName)
        return list.length
    }
    removeAllListeners(channelName){
        return this.eventMap.delete(channelName)
    }
    //emit函数使用形参x0-x5避免了...etc，当etc.len=1时，且etc[0]为数组时导致错误。
    emit(channelName,x0,x1,x2=null,x3=null,x4=null,x5=null){
        if(!this.eventMap.has(channelName))  return 0;
        let list = this.eventMap.get(channelName)
        for(let i=0;i<list.length;i++){
            let func = list[i]
            func(x0,x1,x2,x3,x4,x5)
        }
        return list.length
    }
}

class DNALinkEngine
{
    constructor(kvdb,wallet_m,chain_m,protocol)
    {
        this.kvdb = kvdb
        this.callbackEvents = new EventEmitter()
        this.eventsOne = new EventEmitter()//tx_write_queue_monitor_sub_one
        this.eventsOneToken = new EventEmitter();
        this.eventsTX = new EventEmitter()//tx_write_queue_monitor_sub
        this.wallet_m = wallet_m
        this.chain_m = chain_m
        this.txCallbackMap = new Map()
        this.token_chain_write_queue = new Set()
        this.tx_wait_write_queue_lock = false
        this.tx_wait_write_queue = new Set()
        this.tx_namespace_queue = new Set()
        this.tx_now_write_queue = new Set();
        this.tx_wait_write_queue_lock = 0;
        this.processTokenWriteQueueDataNowMap= new Map();
        this.token_wait_write_queue_kv = new TokenQueue();
        this.writeTokenChainQueueDatasSETIntervalFlag = false;

        this.protocol = protocol
        this.root_config = this.protocol.root_config
        this.fsm_config = this.protocol.fsm_config
        this.fsm_p = new DNALinkFSMContractProcessor(this.protocol)
        this.tx_util = new TXUtil(this.protocol)
        this.token_util = new TokenUtil(this.protocol)
        //this.coin_num_util = new CoinNumUtil(this.protocol)
        this.TOKEN_NAME = this.root_config.TOKEN_NAME
        this.TOKEN_ROOT = this.root_config.TOKEN_ROOT
        this.TOKEN_ID_LENGTH = this.root_config.TOKEN_ID_LENGTH
    }
    async newSignedTxUnsafe(token_x,token_y,opcode,opval,extra_data,timestamp_i,res=null)
    {
        timestamp_i = timestamp_i?timestamp_i : await this.wallet_m.queryTimestamp();

        //得到一个新的TX_ID（也可以本地直接生成，这里向网络去获取）
        //let txid_info = await rpc_http_api.rpc_query(tx_api.getApiUrl(tx_api.api_new_txid),{});
        let txid = this.tx_util.newTXID()//await rpc_http_api.rpc_query(tx_api.getApiUrl(tx_api.api_new_txid),{});
        if(this.tx_util.validateTXID(txid)){
            let TXINFO = {txid:txid,token_x:token_x,token_y:token_y,opcode:opcode,opval:opval,extra_data:extra_data,timestamp_i:timestamp_i}
            let TXJSON = this.tx_util.toTXJSONString(TXINFO);//序列化。
            let hash = await key_util.hashVal(TXJSON);

            //得到keys---2022-11-9新增token.key情况下的
            let wallet_keys = res && res.token_access_wallet && res.token_access_wallet.private_key ? 
                {private_key:res.token_access_wallet.private_key, public_key:res.token_access_wallet.public_key}:
                await this.wallet_m.queryTokenKeys(token_x);
            //2022-11-9日新增以上注释内容（暂时不改：后续整体优化修改）
            // if(!wallet_keys){//用于处理在没有token-wallet-key的情况下（2022新增）---也需要判断token_x是否已经fork
            //     let tokenState = await this.queryTokenState(token_x)
            //     if(!tokenState || !tokenState.public_key) return ({ret:false,msg:'token_x unexists in the chain!'});
            //     wallet_keys = await this.wallet_m.queryTokenKeys(this.TOKEN_ROOT);//使用root-token进行签名
            // }

            let {private_key,public_key} = wallet_keys?wallet_keys:{private_key:null,public_key:null}
            if(!private_key){
                return ({ret:false,msg:'token_x unexists in the wallet!'});
            }

            //2022-11-9新增强的安全性（有可能token之下无对应的private_key，但是public_key应该还是存在于wallet中的）
            // let wallet_keys_y = await this.wallet_m.queryTokenKeys(token_y);
            // if(!wallet_keys_y) return ({ret:false,msg:'token_y unexists in the wallet!'});
            
            //得到签名
            let sign =await this.wallet_m.signMsg(TXJSON,hash,private_key,public_key);
            if(sign){
                TXINFO.hash = hash;
                TXINFO.sign = sign;
                TXINFO.ret = true;
                TXINFO.msg = "success";
                return (TXINFO)
            }else{
                return ({ret:false,msg:'sign the TXJSON:'+TXJSON+' failed in the wallet!'});
            }
        }
    }

    async writeToTXWriteWaitQueue(txid,txjson)
    {
        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:'txid:'+txid+" format is error!"}

        let ret = this.tx_wait_write_queue.add(txid)//await tx_writer_redis.rpush(tx_writer_config.tx_wait_write_queue,txid);
        let txret = await this.kvdb.set(tx_writer_config.tx_namespace_txinfo+txid,txjson,tx_writer_config.tx_cache_timeout_s);
        
        console.log("tx_writer_redis.rpush ret:"+ret);
        
        let pubcnt = await this.noticeTXWriteQueueMonitorSub(txid);
        console.log("pubcnt:"+pubcnt+" by noticeTXWriteQueueMonitorSub()")

        if(pubcnt) return {ret:true,msg:"write-txid to tx_wait_write_queue success!"}
        else return {ret:false,msg:"noticeTXWriteQueueMonitorSub failed!"}
        
    }

    async s_commitTXToTXWriteWaitQueue(txid,txjson)
    {
        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:'txid:'+txid+" format is error!"}

        let ret =  this.tx_wait_write_queue.add(txid)//this.txQueue.add(txid)
        let txret = await this.kvdb.set(tx_writer_config.tx_namespace_txinfo+txid,txjson,tx_writer_config.tx_cache_timeout_s);

        console.log("tx_writer_redis.rpush ret:"+ret+' txret:'+txret);
        if(ret && txret){
            return {ret:true,msg:"success"}
        }else{
            return {ret:false,msg:"write txid to tx_wait_write_queue failed!"}
        }
    }
    async makeTXLisenter(txid,callback)
    {
        let subone_ret  = await this.createNewTXWriteMonitorTXResultSub(txid);

        let func =function(data)
        {
            console.log("makeTXLisenter-get-data:" + JSON.stringify(data))
            //res.json(data)
            callback(data)
            this.callbackEvents.removeListener(txid,func);
        };
        this.callbackEvents.on(txid,func);
    }
    async createNewTXWriteMonitorTXResultSub(txid)
    {
        //订阅成功。
        //let ret = true;//await tx_writer_sub_redis.redis_client.subscribeAsync(tx_writer_config.tx_write_queue_monitor_sub_one + txid);
        if(this.eventsOne.listenerCount(txid)<=0)
        {
            this.eventsOne.removeAllListeners(txid)
            let This = this;
            this.eventsOne.on(txid,function(channel,message){
                console.log(' this.eventsOne.on:'+txid)
                This.onTXWriterDealWithWaitedQueueMessage(channel,message)
            })
        }
        return true;
    }
    onTXWriterDealWithWaitedQueueMessage(channel,message)
    {
        console.log('onTXWriterDealWithWaitedQueueMessage:'+channel+' msg:'+message)//+' ctx:'+ctx)//+' m:'+ctx.processTXWriteQueueDataCore)
        if(!channel || !message)
        {
            console.log("error! maybe not ok! channel:"+channel+",message:"+message)
            return ;
        }
        if(channel == tx_writer_config.tx_write_queue_monitor_sub)
        {
            //开始循环处理这个tx-id队列的内容。
            console.log("now process the tx-write-queue! message:"+message)
            //异步处理----如果已经在处理中，不要进入第二次（加锁操作）。
            if(this.tx_util.validateTXID(message))
                this.processTXWriteQueueDataCore(); //处理txid的写入消息队列。
            else
            {
                this.updateTXToTokenWriteInfoCore(message)//可以与processTXWriteQueueDataCore异步进行（因为处理的不是一个queue空间的事情）
            }
        }
        //代表的是，接收到了这个txid的处理结果。
        else if(this.tx_util.validateTXID(message))
        {
            this.returnTXWriteRetInfo(message);
            //对tx-now-queue进行相关的处理（查看结果是否完成），如果是token_x = token_write（第一行记录），则通知其他的进行写入操作（特别是token_y要接收数据）。
            //然后异步处理各父亲结点。
        }
    }
    async processTXWriteQueueDataCore()
    {
        console.log('into processTXWriteQueueDataCore')
        try{
        //再判断一次锁的状态。
        let timestamp_now=new Date().getTime()
        console.log('now:'+timestamp_now)
        //let getRet = await this.kvdb.get(tx_writer_config.tx_wait_write_queue_lock);
        //console.log('now:getRet'+getRet)
        if(timestamp_now-this.tx_wait_write_queue_lock<100000)
        {
            console.log("processTXWriteQueueDataCore instance must be one ! can't be more than one!!!")
            return ;//res.json({ret:false,msg:"now have someone pay for the order"})
        }
        let setFlag = await this.kvdb.set(tx_writer_config.tx_wait_write_queue_lock,timestamp_now,tx_writer_config.tx_cache_timeout_s)
        // console.log("processTXWriteQueueDataCore-tx_writer_redis-setFlag:"+setFlag)

        //进入死循环处理，直到处理完全
        let pcnt = 0;
        while(true)
        {
            //得到长度（长度为0代表已经没有元素了）。
            let llen = this.tx_wait_write_queue.size//await tx_writer_redis.llen( tx_writer_config.tx_wait_write_queue );
            //console.log("tx_wait_write_queue.llen:",llen)
            if(llen<=0){
                //console.log("tx_wait_write_queue have no data!");
                break;
            }

            console.log("processTXWriteQueueDataCore-now-running-do-while");
            console.log("tx_wait_write_queue.llen:"+llen)

            //开始处理每一条记录（同步等待处理）
            //let txid = await tx_writer_redis.lindex( tx_writer_config.tx_wait_write_queue,  0);
            let txid = this.tx_wait_write_queue.values().next().value//await tx_writer_redis.lpop( tx_writer_config.tx_wait_write_queue);
            let writeJSON = await this.processTXWriteQueueDataOneRow(txid);

            console.log("processTXWriteQueueDataOneRow("+txid+") writeJSON:"+JSON.stringify(writeJSON))

            //判断处理结果。
            if(writeJSON && writeJSON.ret)
            {
                //这里的0是count，要删除所有的与txid一致的值。
                let rem_cnt = 0;//
                this.tx_wait_write_queue.delete(txid)//await tx_writer_redis.redis_client.lremAsync(tx_writer_config.tx_wait_write_queue,0,txid);
                if(rem_cnt>=0)
                {
                    console.log("rem txid success!");
                    //对结果进行保存处理（保存到数据库中）----重要（或者打日志）、。
                }
            }
            else{
                console.log("process txid failed! txid:"+txid);
                //返回结果。
                this.finishTX2TokenWrite(txid,false)

                //然后也会清理掉该txid
                let rem_cnt = 0;
                this.tx_wait_write_queue.delete(txid)// await tx_writer_redis.redis_client.lremAsync(tx_writer_config.tx_wait_write_queue,0,txid);
                console.log("processTXWriteQueueDataOneRow failed, and lrem the txid:"+txid+" rem_cnt:"+rem_cnt);
            }

            pcnt++;
        }

        //处理完全了。可以进入等待周期了。
        //processTXWriteQueueDataNowFlagTrue = false;
        let delRet = await this.kvdb.del(tx_writer_config.tx_wait_write_queue_lock)
        // console.log("tx_writer_redis-del-tx_wait_write_queue_lock-ret:"+delRet)

        if(pcnt>0)
            console.log("processTXWriteQueueDataCore once process num:"+pcnt)
        }catch(ex){
            console.log('processTXWriteQueueDataCore-exception:'+ex+'\n'+JSON.stringify(ex))
        }
    }

    async processTXWriteQueueDataOneRow(txid)
    {
        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:'txid:'+txid+" format is error!"}

        //查询得到该tx-info的信息（tx-info—）
        let txinfo = await this.kvdb.get(tx_writer_config.tx_namespace_txinfo+txid);

        console.log("processTXWriteQueueDataOneRow-txid:"+txid+" txinfo:"+txinfo+'\t'+JSON.stringify(txinfo))
        let txjson = JSON.parse(txinfo);
        let {token_x,token_y,opcode} = txjson;

        let x_state = await this.queryTokenState(token_x)
        let y_state = await this.queryTokenState(token_y)
        txjson.list_x = x_state.token_state_p
        txjson.list_y = y_state.token_state_p

        if( opcode !=this.fsm_config.OP_ROOT && y_state.token_height<0)
        {
            let y_state_ret = await this.updateTx2TokenWriteNowQueueResult(txid,token_y,"token_y{"+token_y+"} not in the chain!",token_y);
            console.log("rpc_query - api_update_tx2token_now_queue-update_txstatus:"+JSON.stringify(y_state_ret))
            console.log("processTokenWriteQueueDataOneRow-update_txstatus:"+y_state_ret)
            return {ret:false,msg:"token_y{"+token_y+"} not in the chain!"}
        }

        let timestamp_ms = new Date().getTime()
        let nowtx_info = {timestamp_ms:timestamp_ms,list_x:x_state.token_state_p,list_y:y_state.token_state_p,txinfo:txjson};//

        //txNowWriteQueue.push({txid:txid,timestamp_ms:timestamp_ms})

        let nowqueue_ret = this.tx_now_write_queue.add(txid) //await tx_writer_redis.rpush(tx_writer_config.tx_now_write_queue,txid);
        let nowtx_ret   = this.tx_namespace_queue.add(JSON.stringify(nowtx_info))//await tx_writer_redis.rpush(tx_writer_config.tx_namespace + txid,  JSON.stringify(nowtx_info) );



        if(nowqueue_ret && nowtx_ret)
        {
            //这里也是唯一的（因为会跟随着tx_write_queue_monitor_sub一起订阅----只有这个守护线程，才会订阅tx_writer_config.tx_namespace事件）。
            //subone_ret  = await createNewTXWriteMonitorTXResultSub(txid);
            //console.log("subone_ret:"+subone_ret);
        }else{
            //await finishTX2TokenWrite(txid,false)
            console.log("WARNNING: 2 times failed!! nowqueue_ret:"+nowqueue_ret+",nowtx_ret:"+nowtx_ret)
            return {ret:false,msg:"WARNNING: 2 tims failed!! nowqueue_ret:"+nowqueue_ret+",nowtx_ret:"+nowtx_ret};
        }

        //先同步token_x的写入（推荐到该链的----这里100%成功之后，可以进入乱序执行环节。
        //let {txid,token,txinfo} = str_filter.get_req_data(req);
        if(false)
        {
            let ret = await this.commitTXToTokenWriterWaitQueue(txid,token_x,JSON.stringify(txjson),this.token_util.TOKEN_X);
        }
        let commit_token_write_ret = await this.commitTXToTokenWriterWaitQueue(txid,token_x,JSON.stringify(txjson),this.token_util.TOKEN_X)//await rpc_http_api.rpc_query(xdtns_api.getApiUrl(xdtns_api.api_commit_tx2token_queue),
           // {txid:txid,token:token_x,txinfo: JSON.stringify(txjson),token_relate:token_util.TOKEN_X})
        console.log("commit_token_write_ret:"+ JSON.stringify(commit_token_write_ret));

        if(!commit_token_write_ret || !commit_token_write_ret.ret)
        {
            //await finishTX2TokenWrite(txid,false)
            console.log("processTXWriteQueueDataOneRow - commit_token_write_ret:"+JSON.stringify(commit_token_write_ret))
            return {ret:false,msg:"failed!!commit_token_write_ret:"+JSON.stringify(commit_token_write_ret)};
        }

        return {ret:true,msg:"success"}
    }

    async commitTXToTokenWriterWaitQueue(txid,token,txinfo,token_relate)//,token_state = "", token_height=0)
    {
        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:'txid:'+txid+" format is error!"}

        if(!token || !this.token_util.validateTokenID(token))
            return {ret:false,msg:'token:'+token+" format is error!"}

        if(!token_relate || !this.token_util.validateTokenRelate(token_relate))
            return {ret:false,msg:'token:'+token_relate+" format is error!"}

        if(!txinfo)
            return {ret:false,msg:'txinfo  format is error!'}

        //待写入到的数据。
        let writeinfo = {timestamp_ms:new Date().getTime(),txid:txid,token:token,txinfo:txinfo,token_relate:token_relate};
        console.log("writeinfo:"+JSON.stringify(writeinfo))


        let ret = this.token_wait_write_queue_kv.get(token).add(JSON.stringify(writeinfo))//await token_writer_redis.rpush(token_writer_config.token_wait_write_queue+token,JSON.stringify(writeinfo));
        console.log("token_writer_redis.rpush ret:"+ret);
        if(ret){
            let pubcnt = await this.noticeTokenWriteQueueMonitorSub(token);
            console.log("pubcnt:"+pubcnt+" by noticeTokenWriteQueueMonitorSub()")

            if(pubcnt) return {ret:true,msg:"write-txid to token_wait_write_queue success!"}
            else  return {ret:false,msg:"noticeTokenWriteQueueMonitorSub failed!"}
        }else return {ret:false,msg:"write txid to token_wait_write_queue failed!"}
        
    }

    /**
     * 这个函数是通知相关的守护线程进行相关的token-writer业务处理。
     */
    async noticeTokenWriteQueueMonitorSub(token)
    {
        //事件传送
        let cnt =  this.eventsOneToken.listenerCount(token)//this.eventsOne.emit(token,token)//await token_writer_redis.redis_client.publishAsync(token_writer_config.token_write_queue_monitor_sub+token,token);
        console.log('noticeTokenWriteQueueMonitorSub-listenerCount:'+cnt)
        //判断事件传送结果、
        if(cnt>0)
        {
            return cnt;
        }

        //证明没有守护线程守护，故此创建一个守护线程（tx_write_queue_monitor_sub）
        console.log("cnt<=0 and createNewTXWriteQueueMonitorSub now...")

        let flag = await this.createNewTokenWriteQueueMonitorSub(token);
        console.log("createNewTokenWriteQueueMonitorSub()="+flag)

        if(flag){
            let cnt = this.eventsOneToken.emit(token,token)//await token_writer_redis.redis_client.publishAsync(token_writer_config.token_write_queue_monitor_sub+token,token);
            return cnt ? 1:0;
        }else{
            //通知失败。
            console.log("createNewTokenWriteQueueMonitorSub ret failed!");
            return 0;
        }
    }

    /**
     * 创建一个新的token-write守护线程（针对token唯一性）
     */
    async createNewTokenWriteQueueMonitorSub(token)
    {
        //token_writer_sub_redis.redis_client.removeAllListeners('message');
        let This = this;
        this.eventsOneToken.on(token,function(message){
            This.onTokenWriterDealWithWaitedQueueMessage(message)
        }) //token_writer_sub_redis.redis_client.on('message',this.onTokenWriterDealWithWaitedQueueMessage);

        //写队列（批量写）
        if(!this.writeTokenChainQueueDatasSETIntervalFlag) {
            this.writeTokenChainQueueDatasSETIntervalFlag =true;
            this.writeTokenChainQueueDatas() 
                //setInterval(this.writeTokenChainQueueDatas, token_writer_config.token_write_checkout_interval_ms);

            console.log("setInterval-writeTokenChainQueueDatas!!")
        }
        return true;
    }

    /**
     * 消息sub的publish处理事件。
     * @param channel
     * @param message
     */
    onTokenWriterDealWithWaitedQueueMessage(message)//channel,message)
    {
        this.processTokenWriteQueueDataCore(message);
        console.log("now process the token-tx-write-queue! message:"+message)
    }

    
    /**
     * 开始逐个循环处理这个tx-write-queue（批量异步进行，但是是逐个的，避免出现一个token-write的时候乱序执行，导致结果执行失败）。
     */
    async processTokenWriteQueueDataCore(token)
    {
        //这里返回可以累积多一点数据再处理也是ok的（方便测试）。
        //return ;
        if(!this.token_util.validateTokenID(token))
        {
            console.log("token("+token+") format error !")
            return ;
        }

        if(this.processTokenWriteQueueDataNowMap.has(token)) {
            console.log("processTokenWriteQueueDataNowMap instance must be one ! can't be more than one!!!")
            return;
        }
        this.processTokenWriteQueueDataNowMap.set(token,token);

        //开始处理之前，就要去计算token的height高度信息，密钥（keys），token_state（特别是NUM_TYPE的操作op_send时的最后一个token_state）
        let STATE_INFO = await this.queryTokenState(token);
        if(STATE_INFO) STATE_INFO.token = token
        console.log("STATE_INFO: "+JSON.stringify(STATE_INFO));

        let pcnt = 0;
        while(true)
        {
            //timestamp_now=new Date().getTime()
            //processTokenWriteQueueDataNowMap.set(token,timestamp_now);

            //这里可以测试上面的processTXWriteQueueDataNowFlagTrue 变量
            //可以为这个processTXWriteQueueData()加锁，这样就避免了乱序执行的发生（特别是txid关于token-x写入是不能乱序的）
            //await str_filter.sleep(3000);
            //得到长度（长度为0代表已经没有元素了）。
            let queue_key = token_writer_config.token_wait_write_queue +token;
            let tokenQueue = this.token_wait_write_queue_kv.get(token)
            let llen =  tokenQueue.size//this.token_chain_write_queue.size //await token_writer_redis.llen( queue_key );
            console.log("token_writer_redis.llen:"+llen)
            if(llen<=0){
                console.log("token_wait_write_queue have no data!");
                break;
            }

            //开始处理每一条记录（同步等待处理）
            let writeinfo_ret = tokenQueue.values().next().value//await token_writer_redis.lindex( queue_key,  0);
            console.log("token_writer_redis--writeinfo_ret:"+JSON.stringify(writeinfo_ret))
            let writeinfo_json = JSON.parse(writeinfo_ret);
            console.log("token_writer_redis--writeinfo_ret:"+JSON.stringify(writeinfo_json))
            let writeJSON = await this.s_processTokenWriteQueueDataOneRow(token,writeinfo_json,STATE_INFO);

            console.log("processTokenWriteQueueDataOneRow("+token+") writeJSON:"+JSON.stringify(writeJSON))

            //判断处理结果。
            if(writeJSON && writeJSON.ret)
            {
                //删除一条处理的记录。
                let pop_cnt = tokenQueue.delete(writeinfo_ret)//await token_writer_redis.redis_client.lpop(queue_key)
                if(pop_cnt)
                {
                    console.log("write one success!");
                    //对结果进行保存处理（保存到数据库中）----重要（或者打日志）、。
                }else{

                    console.log("pop token-write-row failed! WARNING: have another ("+token+")token-monitor-processor?");
                    console.log("need to checkout the monitor-processor num!");

                    //测试publish-test（尝试发布一条消息，看是否接收得到）
                    let cnt = this.eventsOneToken.emit(token,token)//,this)//await token_writer_redis.redis_client.publishAsync(token_writer_config.token_write_queue_monitor_sub+token,"test");
                    console.log("token("+token+")-monitor-processor-cnt:"+cnt);
                }
            }
            else{
                console.log("process token-write-row failed! writeinfo:"+writeinfo_ret);
                //返回出错结果
                let pop_cnt =  tokenQueue.delete(writeinfo_ret)//await token_writer_redis.redis_client.lpop(queue_key);
                console.log("processTokenWriteQueueDataOneRow failed, and pop the token-writeinfo:"+token+" pop_cnt:"+pop_cnt)
            }
            pcnt++;
        }

        //这里可以释放token-write资源（也可以不释放）关键看性能与redis内存空间的平衡（重启node.js会清空subscribe）。

        //处理完全了。可以进入等待周期了。
        this.processTokenWriteQueueDataNowMap.delete(token);
        this.writeTokenChainQueueDatas()
        console.log("processTokenWriteQueueDataNowMap once process num:"+pcnt)
    }


    async  updateTXToTokenWriteInfoCore(retinfo)
    {
        console.log("updateTXToTokenWriteInfoCore-retinfo:"+JSON.stringify(retinfo))
        if(!retinfo || retinfo.length<TOKEN_ID_LENGTH)
        {
            return console.log("updateTXToTokenWriteInfoCore failed! retinfo:"+retinfo);
        }

        let retJson = JSON.parse(retinfo)
        let {txid,token,txinfo,token_relate} = retJson;
        if(!(this.tx_util.validateTXID(txid) && this.token_util.validateTokenID(token) && this.token_util.validateTokenRelate(token_relate)))
        {
            await this.finishTX2TokenWrite(txid,false)
            return console.log("updateTXToTokenWriteInfoCore failed by retinfo="+retinfo);
        }

        let txinfoJSON = txinfo instanceof Object ? txinfo : JSON.parse(txinfo);
        if(txinfoJSON.hasOwnProperty("ret") && !txinfoJSON.ret)
        {
            await this.finishTX2TokenWrite(txid,false)
            return console.log("updateTXToTokenWriteInfoCore failed! retinfo:"+retinfo);
        }

        //nowtx_info = {list_x:xret.list,list_y: yret.list,txinfo:txinfo};
        let rowsSize = this.tx_namespace_queue.size//await tx_writer_redis.redis_client.lrangeAsync(tx_writer_config.tx_namespace + txid,0,-1 );
        console.log("updateTXToTokenWriteInfoCore rows:"+rowsSize)
        if(rowsSize<=0)
        {
            await this.finishTX2TokenWrite(txid,false)
            return console.log("updateTXToTokenWriteInfoCore failed by txid-nowinfo unexists!! rowsSize:"+rowsSize);
        }



        let llen = this.tx_namespace_queue.size//rows.length;
        let nowtx_info = this.tx_namespace_queue.values().next().value//rows[0]//----------here
        let nowtxJson = JSON.parse(nowtx_info);
        if(!nowtxJson.list_x || !nowtxJson.list_y)
        {
            await this.finishTX2TokenWrite(txid,false)
            return console.log("updateTXToTokenWriteInfoCore failed by list_x or list_y unexists!! rows:"+JSON.stringify(nowtxJson));
        }

        let list_x = JSON.parse(nowtxJson.list_x)
        let list_y = JSON.parse(nowtxJson.list_y)
        let nowtx_txinfo = nowtxJson.txinfo
        if(txid!=nowtx_txinfo.txid) {
            await this.finishTX2TokenWrite(txid,false)
            return console.log("updateTXToTokenWriteInfoCore failed by nowtx_info!=retinfo(" + txid + ")");
        }

        let {token_x,token_y,opcode} = nowtx_txinfo;
        if(TOKEN_ROOT == token_x && this.fsm_config.OP_ROOT == opcode )
            return await this.finishTX2TokenWrite(txid,true)//当为op_root时事件结束

        //判断处于哪一步？
        iCheckCnt = 0
        for(i=1;i<this.tx_namespace_queue.size;i++)
        {
            let row = JSON.parse(this.tx_namespace_queue.values().next().value)
            if(row.token == token) iCheckCnt++;
            if(iCheckCnt>2){
                await this.finishTX2TokenWrite(txid,false)
                return console.log("updateTXToTokenWriteInfoCore failed by txid-muti times write by token("+token+")!! ");
            }
        }

        nextStepCnt = llen+1;//该进入下一步了。
        if(nextStepCnt==3)//token_y的写入
        {
            let commit_token_write_ret = await this.commitTXToTokenWriterWaitQueue(
                txid,token_y,nowtx_txinfo instanceof String ?
                 nowtx_txinfo: JSON.stringify(nowtx_txinfo),this.token_util.TOKEN_Y)//  await rpc_http_api.rpc_query(xdtns_api.getApiUrl(xdtns_api.api_commit_tx2token_queue),
                        // {txid:txid,token:token_y,txinfo: nowtx_txinfo instanceof String ? nowtx_txinfo: JSON.stringify(nowtx_txinfo),
                        //     token_relate:token_util.TOKEN_Y})

            if(!commit_token_write_ret || !commit_token_write_ret.ret)
            {
                await this.finishTX2TokenWrite(txid,false)
            }

            return console.log("updateTXToTokenWriteInfoCore commit_token_write_ret:"+ JSON.stringify(commit_token_write_ret));
        }
        //  x_list的写入和y_list的写入 （注意：当nextStepCnt>=3时，使用for语句为乱序执行，不使用则为顺序---建议顺序执行：：不会慢到哪里，可以精确定位失败write-token）。
        //else if(nextStepCnt>=4 && nextStepCnt <= (3+list_x.length + list_y.length))
        else if(nextStepCnt>=4 && nextStepCnt <= (3+list_x.length + list_y.length))
        {
            let list_write = list_x.concat(list_y);//将剩下的元素全部写入
            console.log("llen:",llen,"list_write:",list_write+" rows[1](",rows[1],")\nrows[2](",rows[2]+")");
            let i = nextStepCnt-4;
            //（注意：当nextStepCnt>=3时，使用for语句为乱序执行，不使用则为顺序---建议顺序执行：：不会慢到哪里，可以精确定位失败write-token）。
            //for(i=0;i<list_write.length;i++)
            if(i<list_write.length)
            {
                let token_now = list_write[i];
                //token_relate_now = opcode == OP_FORK ? token_x : token_relate_now;
                let token_relate_now = i< list_x.length ? this.token_util.TOKEN_X : this.token_util.TOKEN_Y;
                console.log("typeof(rows1,rows2)=",typeof rows[1],typeof rows[2]);
                let txinfo_now = i< list_x.length ? JSON.parse(rows[1]).txinfo : JSON.parse(rows[2]).txinfo //JSON.parse(rows[0]).txinfo//
                txinfo_now.list_x = list_x;
                txinfo_now.list_y = list_y;

                let commit_token_write_ret = await this.commitTXToTokenWriterWaitQueue(
                    txid,token_now,toJSON.stringify(txinfo_now),token_relate_now)//await rpc_http_api.rpc_query(xdtns_api.getApiUrl(xdtns_api.api_commit_tx2token_queue),
                    //{txid:txid,token:token_now,txinfo:JSON.stringify(txinfo_now),token_relate:token_relate_now})

                if(!commit_token_write_ret || !commit_token_write_ret.ret)
                {
                    await this.finishTX2TokenWrite(txid,false)
                }
                return console.log("updateTXToTokenWriteInfoCore(",txid,token_now,token_relate_now,") commit_token_write_ret:"+ JSON.stringify(commit_token_write_ret));
            }
        }else if(nextStepCnt > (3+list_x.length + list_y.length) )
        {
            return await this.finishTX2TokenWrite(txid,true)//当为op_root时事件结束
        }
        console.log("updateTXToTokenWriteInfoCore something error ! llen:"+llen+" nextStepCnt:"+nextStepCnt+"  retinfo:"+retinfo)
        return {ret:false,msg:"deal with tx-write something error! llen:"+llen+" nextStepCnt:"+nextStepCnt+"  retinfo:"+retinfo}
    }

    
    async finishTX2TokenWrite(txid,flag)
    {
        if(!this.tx_util.validateTXID(txid))
            return ;

        console.log("finishTX2TokenWrite-txid:",txid,flag)
        //通知处理结束。
        //subkey = tx_writer_config.tx_write_queue_monitor_sub_one + txid
        this.eventsOne.emit(txid,txid)//await tx_writer_redis.redis_client.publishAsync(subkey,txid);
    }

    async updateTx2TokenWriteNowQueueResult(txid,token,txinfo,token_relate)
    {
        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:'txid:'+txid+" format is error!"}

        if(!token || !this.token_util.validateTokenID(token))
            return {ret:false,msg:'token:'+token+" format is error!"}

        if(!token_relate || !this.token_util.validateTokenRelate(token_relate))
            return {ret:false,msg:'token:'+token_relate+" format is error!"}

        if(!txinfo)
            return {ret:false,msg:'txinfo  format is error!'}

        console.log("updateTXToTokenWriterNowQueue success!")

        let retInfo = {txid,token,txinfo,token_relate}

        let push_ret =  this.tx_namespace_queue.add(JSON.stringify(retInfo))//await tx_writer_redis.rpush(tx_writer_config.tx_namespace + txid,  JSON.stringify(retInfo))
        if(!push_ret)
        {
            return {ret:false,msg:'push retinfo to cached failed'}
        }

        //判断返回结果是否已经结束（由token-writer进行相关的返回动作，或者本地返回的结果）
        let txinfo_json = txinfo;//JSON.parse(txinfo);
        if( txinfo_json && txinfo_json.hasOwnProperty('ret') && !txinfo_json.ret)
        {
            this.finishTX2TokenWrite(txid,false);
            return {ret:false,msg:"txid-write call is ending!"};
        }


        //事件传送（还是处于核心的monitor_queue事件）
        let pubcnt = await this.noticeTXWriteQueueMonitorSub(JSON.stringify(retInfo));

        if(pubcnt)
            return {ret:true,msg:'success'}
        else{//没有守护线程，创建之。
            return {ret:false,msg:'notice tx-monitor failed'}
        }
    }

    async noticeTXWriteQueueMonitorSub(msg)
    {
        //事件传送
        let flag = this.eventsTX.emit('message',tx_writer_config.tx_write_queue_monitor_sub,msg)//,this)//let cnt = await tx_writer_redis.redis_client.publishAsync(tx_writer_config.tx_write_queue_monitor_sub,msg);
        console.log('eventsTX.emit-flag:'+flag)
        if(flag) return 1;

        //证明没有守护线程守护，故此创建一个守护线程（tx_write_queue_monitor_sub）
        console.log("cnt<=0 and createNewTXWriteQueueMonitorSub now...")

        flag = await this.createNewTXWriteQueueMonitorSub();
        for(let i = 0;i<3;i++)
        {
            if(!flag) {
                console.log("createNewTXWriteQueueMonitorSub try again!")
                flag = await this.createNewTXWriteQueueMonitorSub();
            }
            else
                break;
        }
        console.log("createNewTXWriteQueueMonitorSub()="+flag)

        if(flag){
            let cnt = this.eventsTX.emit('message',tx_writer_config.tx_write_queue_monitor_sub,msg)//,this)//await tx_writer_redis.redis_client.publishAsync(tx_writer_config.tx_write_queue_monitor_sub,msg);
            console.log('eventsTX.emit-cnt:'+cnt)
            return cnt;
        }else{
            //通知失败。
            console.log("createNewTXWriteQueueMonitorSub ret failed!");
            return 0;
        }
    }

    async createNewTXWriteQueueMonitorSub()
    {

        if(this.eventsTX.listenerCount('message')<=0)
        {
            this.eventsTX.removeAllListeners('message');
            let This = this;
            this.eventsTX.on('message',function(channel,message){
                This.onTXWriterDealWithWaitedQueueMessage(channel,message)
            });
        }
        return true;
    }

    /**
     * 处理一行数据。
     */
    async s_processTXWriteQueueDataOneRow(txid)
    {
        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:'txid:'+txid+" format is error!"}

        //查询得到该tx-info的信息（tx-info—）
        let txinfo = await this.kvdb.get(tx_writer_config.tx_namespace_txinfo+txid);

        console.log("processTXWriteQueueDataOneRow-txid:"+txid+" txinfo:"+txinfo)
        let txjson = JSON.parse(txinfo);
        let {token_x,token_y,opcode} = txjson;

        let x_state = await this.queryTokenState(token_x)
        let y_state = await this.queryTokenState(token_y)
        txjson.list_x = x_state.token_state_p
        txjson.list_y = y_state.token_state_p
        if(!txjson.list_x || !txjson.list_y)
        {
            let retObj = {ret:false,msg:'token may be not fork!',x_state,y_state,txjson}
            let sendJSONRet = await this.s_updateTx2TokenWriteNowQueueResult(txid,retObj);
            return retObj
        }
        // let tmpTxjsonNow = JSON.stringify(txjson)
        // console.log('tmpTxjsonNow:',tmpTxjsonNow,x_state,y_state)

        if( opcode !=this.fsm_config.OP_ROOT && y_state.token_height<0)
        {
            let y_state_ret = await this.s_updateTx2TokenWriteNowQueueResult(txid,{ret:false,msg:"token_y{"+token_y+"} not in the chain!"});
            return {ret:false,msg:"token_y{"+token_y+"} not in the chain!"}
        }

        // let timestamp_ms = new Date().getTime()
        // let nowtx_info = {timestamp_ms:timestamp_ms,list_x:x_state.token_state_p,list_y:y_state.token_state_p,txinfo:txjson};//

        //先写token_x、再写token_y，然后接着同步到token_x-list y-list
        let y_txinfo = {};
        Object.assign(y_txinfo,txjson)
        let writeInfo = {timestamp_ms:new Date().getTime(),txid,token_relate:this.token_util.TOKEN_X,txinfo:txjson};
        let retX = await  this.s_processTokenWriteQueueDataOneRow(token_x,writeInfo,x_state);
        if(!retX || !retX.ret)
        {
            let tmpRet = await this.s_updateTx2TokenWriteNowQueueResult(txid,retX);
            return retX;
        }

        writeInfo.txinfo = y_txinfo;
        writeInfo.token_relate = this.token_util.TOKEN_Y;
        let retY = await this.s_processTokenWriteQueueDataOneRow(token_y,writeInfo,y_state);
        if(!retY || !retY.ret)
        {
            let tmpRet = this.s_updateTx2TokenWriteNowQueueResult(txid,retY);
            return retY;
        }

        //X链同步。
        writeInfo.txinfo = txjson;
        //console.log('x-chain-txinfo:'+JSON.stringify(writeInfo.txinfo))
        let xlist = JSON.parse(txjson.list_x);
        for(let i=0;xlist && i<xlist.length;i++)
        {
            writeInfo.token_relate = this.token_util.TOKEN_X;
            let token = xlist[i];
            let tmpState = await this.queryTokenState(token)
            let retW = await  this.s_processTokenWriteQueueDataOneRow(token,writeInfo,tmpState);
            if(!retW || !retW.ret)
            {
                let tmpRet = this.s_updateTx2TokenWriteNowQueueResult(txid,retW);
                return retW;
            }
        }

        //Y链同步。
        writeInfo.txinfo = y_txinfo;
        //console.log('y-chain-txinfo:'+JSON.stringify(writeInfo.txinfo))
        let ylist = JSON.parse(txjson.list_y);
        for(let i=0;ylist && i<ylist.length;i++)
        {
            writeInfo.token_relate = this.token_util.TOKEN_Y;
            let token = ylist[i];
            let tmpState = await this.queryTokenState(token)
            let retW = await  this.s_processTokenWriteQueueDataOneRow(token,writeInfo,tmpState);
            if(!retW || !retW.ret)
            {
                let tmpRet = this.s_updateTx2TokenWriteNowQueueResult(txid,retW);
                return retW;
            }
        }

        x_state.token = token_x;
        y_state.token = token_y;
        if(opcode != this.fsm_config.OP_FORK) {
            delete x_state.private_key;
            delete y_state.private_key;
        }else{//是fork的情况下,删除parent-token(亦即token_y）的私钥，避免安全问题 2022-9-23
            delete y_state.private_key
            //新增于2022-11-9因为queryTokenState不再提供walletInfo信息（仅当非fork情况下）
            // let walletInfo = await this.wallet_m.queryTokenKeys(token_x)
            // x_state.private_key  = walletInfo.private_key
        }
        delete y_state.pre_txid;
        let retObj = {ret:true,msg:'success',txid,token_x,token_y,x_state,y_state};
        let sendJSONRet = await this.s_updateTx2TokenWriteNowQueueResult(txid,retObj);

        return retObj;// {ret:true,msg:"success"}
    }

    async queryTokenState(token)
    {
        let token_height = -1;
        let token_state_val = "0"
        let token_state_p = "[]"
        let pre_txid = null;

        let stateCache = await this.kvdb.get(token_writer_config.token_namespace_state+token);
        try{
            stateCache = stateCache ? JSON.parse(stateCache) :null
        }catch(ex){stateCache = null}
        if(!stateCache||!stateCache['public_key']) {
            let token_states = await this.chain_m.queryTokenStates(token);//// await rpc_http_api.rpc_query(chain_api.getApiUrl(chain_api.api_query_token_states), {token: token});
            console.log("rcp_query - api_query_token_states - token_states:" + JSON.stringify(token_states))

            if (!token_states ){// || !token_states.ret) {
                return null;
            }

            token_state_p = token_states['list'];
            token_state_val = token_states['val'] ? token_states['val'] : token_state_val;
            token_height = token_states['height'];
            pre_txid = token_states['txid'];
            //2022-8-5新增web3_key
            let web3_key = token_states['web3_key'];
            let public_key = token_states['public_key'];//必然存在，否则没有将fork信息保存成功
            if(!public_key)//应该是由于fork导致的(token_x是新创建的)
            {
                //新增于2022-11-9因为queryTokenState不再提供walletInfo信息（仅当非fork情况下）
                // let walletInfo = await this.wallet_m.queryTokenKeys(token)
                // token_states['public_key']  = walletInfo ?  walletInfo.public_key:null
                // public_key = walletInfo ?  walletInfo.public_key:null
                // console.log('this.chain_m.queryTokenStates:'+token+' public_key:'+public_key + ' walletinfo:'+JSON.stringify(walletInfo))
                // //遵守新的安全协议，不在token_state中保存private_key
                // // token_states.private_key  = walletInfo.private_key
                let keysInfo = await this.wallet_m.queryCacheWalletKeys(token);//null;//
                let keys = keysInfo ? keysInfo : null;
                keys = !keys ? await this.wallet_m.queryTokenKeys(token):keys //await rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_query_token_keys), {token: token})
                token_states['public_key']  = keys ?  keys.public_key:null
                public_key = keys ?  keys.public_key:null
            }

            //2022-11-9减少对private_key的查询
            // let keysInfo = await this.wallet_m.queryCacheWalletKeys(token);//null;//
            // let keys = keysInfo ? keysInfo : null;
            // keys = !keys ? await this.wallet_m.queryTokenKeys(token) //await rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_query_token_keys), {token: token})
            //     : keys
            // if (!keys) {
            //     console.log("api_query_token_keys failed: " + JSON.stringify(keys));
            //     // processTokenWriteQueueDataNowMap.delete(token);
            //     return null;//不会去处理一个这样的请求(查询不到公钥信息）。
            // }

            stateCache = {token_state_p:token_state_p,token_state_val:token_state_val,
                token_height:token_height,pre_txid:pre_txid,public_key,web3_key}//,private_key:keys.private_key,public_key:keys.public_key,web3_key}
            //fix the parent unexists bug! by lauo.li 2019-2-18
            //token_height<0意味着还在进行fork操作，不能保存这个错误的token_state在redis中（特别是会影响到token_parents的查询）
            let setRet = await this.kvdb.set(token_writer_config.token_namespace_state+token,JSON.stringify(stateCache),
                token_writer_config.token_namespace_state_timeout);
        }
        return stateCache;
    }
    async clearTokenState(token)
    {
        let clearRet = await this.kvdb.del(token_writer_config.token_namespace_state+token);
        return clearRet;
    }

    async s_processTokenWriteQueueDataOneRow(token,writeinfo_json ,STATE_INFO) {
        //if (cnt > 3)
        //     return {ret: false, msg: 'too much times failed!'};
        if(!writeinfo_json || !writeinfo_json.txid || !writeinfo_json.txinfo)
            return {ret: false, msg: "writeinfo_json  format is error! writeinfo_json:"+JSON.stringify(writeinfo_json)}
    
        console.log("s_processTokenWriteQueueDataOneRow - writeinfo_json:"+JSON.stringify(writeinfo_json))
    
        let timestamp_now=new Date().getTime()
        let {timestamp_ms,txid,token_relate,txinfo} = writeinfo_json;
        txinfo = typeof txinfo =='string' ? JSON.parse(txinfo):txinfo 
        let {token_x,token_y} = txinfo //JSON.parse(txinfo)
    
        if (!txid || !this.tx_util.validateTXID(txid))
            return {ret: false, msg: 'txid:' + txid + " format is error!"}

        if(!STATE_INFO)
        {
            return {ret: false, msg: 'STATE_INFO is NULL'}
        }
    
        if (!token || !this.token_util.validateTokenID(token))
            return {ret: false, msg: 'token_write:' + token + " format is error!"}
    
        if (!token_relate || !this.token_util.validateTokenRelate(token_relate))
            return {ret: false, msg: 'token_relate:' + token_relate + " format is error!"}
    
        //查询得到该tx-info的信息（tx-info—）
        console.log("token(" + token + ") and STATE_INFO:" + JSON.stringify(STATE_INFO) );
        console.log("typeof txinfo:" + (typeof txinfo)+ " txinfo-string:"+JSON.stringify(txinfo));
    
        let txjson = txinfo;//str_filter.parseJSON(txinfo);
    
        //提前得到token_y的parents，以便计算tmp_state
        let {opcode,opval,extra_data,hash,sign} = txjson;
        let isMe = token_relate==this.token_util.TOKEN_X? token == token_x : token==token_y;
    
        if (isMe) {
            let token_y_parents = [token_y]
            token_y_parents = token_y_parents.concat(JSON.parse("" + txjson.list_y))
    
            //禁止自己给自己发送内容（特别是波及金钱）
            if(this.fsm_p.banFSMTokenSend(token_x,token_y,opcode))
            {
                console.log("banFSMTokenSend after!1")
                 return {ret: false, msg: 'banFSMTokenSend failed!'}
            }
    
            //判断是否足够扣费。
            if (!this.fsm_p.validateFSMTokenState(token,opcode, opval, STATE_INFO, (this.token_util.TOKEN_X == token_relate))) {
                console.log("validateFSMTokenState after!1")
                return {ret: false, msg: 'validateFSMTokenState failed!'}
            }
    
            console.log("validateFSMTokenState after!2")
    
            //得到token_state和token_height
            if (isMe && (opcode == this.fsm_config.OP_FORK || opcode == this.fsm_config.OP_ROOT) && this.token_util.TOKEN_X == token_relate) {
                txjson.token_state = this.fsm_p.calcFSMTokenStateParents(opcode, opval, STATE_INFO, (token_x == token), token_y_parents)
                txjson.token_height = STATE_INFO.token_height + 1
                txjson.public_key = this.token_util.TOKEN_X == token_relate ? STATE_INFO.public_key :null;
            }
    
            console.log("validateFSMTokenState after!3  :::opcode:"+opcode+",opval:"+opval)
            if (isMe && (opcode == this.fsm_config.OP_SEND) && this.fsm_p.isNumValType() ) {
                txjson.token_state = this.fsm_p.calcFSMTokenStateVal(token,opcode, opval, STATE_INFO, (token_x == token))
                /* token_x == token ? coin_num_util.minus(STATE_INFO.token_state_val, opval) :
                coin_num_util.add(STATE_INFO.token_state_val, opval)*/
                txjson.token_height = STATE_INFO.token_height + 1
                txjson.pre_txid = STATE_INFO.pre_txid;//上一个txid（UXTO模型）---其实仅当TYPE=NUM时才有用。
            }
    
            console.log("validateFSMTokenState after!4")
            if (isMe && !this.fsm_p.validateFSMTokenHeight(opcode, STATE_INFO.token_height + 1) && this.token_util.TOKEN_X == token_relate)//操作本链的时候要注意。
            {
                return {ret: false, msg: 'OP_FORK and OP_ROOT only can do once! failed!token_x='+token_x+" STATE_INFO.token_height:"+STATE_INFO.token_height}
            }
        }else{
            //对加法、减法运算的审计。
    
        }
    
        //进行签名校验---2022-11-9日web3-sign验证过一次了（或者由于上层使用了token-root进行newTX和sign，所以无须再次检验签名）
        // if(isMe && this.token_util.TOKEN_X == token_relate)
        // {
        //     let vflag = key_util.verifySignMsg(hash,sign,STATE_INFO.public_key)
        //     if(!vflag)
        //     {
        //         console.log("s_processTokenWriteQueueDataOneRow verifySignMsg faield!")
        //         return {ret: false, msg: 'verifySignMsg failed!'};
        //     }
        // }
    
        //重新签名一行数据，然后写入数据库中（这里需要注意一下，如果token_x与token是一致的情况下，这里的重新签名一下txinfo是没有必要的。
        //let {msg,token} = req_data;
        //if (token_x != token)
        /////////////////////////////////2022-11-9无须再次获得hash和签名
        // {
        //     //这里不使用rcp调用的方式，直接本地取结果。
        //     hash = key_util.hashVal(this.tx_util.toTXJSONString(txjson));
        //     console.log("s_processTokenWriteQueueDataOneRow-hash:"+hash+" private_key:"+STATE_INFO.private_key)
        //     sign = key_util.signMsg(hash,STATE_INFO.private_key)
    
        //     console.log("tx_util.toTXJSONString(txjson):"+this.tx_util.toTXJSONString(txjson))
        // }
    
    
        //开始写入链中（使用chain_api接口）。
        //计算得到高度STATE_INFO.token_height+1
        //height = tmp_height (old:STATE_INFO.token_height+1)
        let req_data = {token:token,height:STATE_INFO.token_height+1,txid:txid,txjson:this.tx_util.toTXJSONString(txjson),hash:hash,sign:sign,token_relate:token_relate}
    
        console.log("rpc_query - api_save_tx2token_chain-token-state:"+JSON.stringify(txjson.token_state)+" STATE_INFO.token_state_p:"+STATE_INFO.token_state_p)
        console.log("rpc_query - api_save_tx2token_chain-tmp-height:"+txjson.token_height+" STATE_INFO.token_height:"+STATE_INFO.token_height)
        console.log("rpc_query - api_save_tx2token_chain-req-data:"+JSON.stringify(req_data))
    
        let chain_ret  =  null;//await rpc_http_api.rpc_query(chain_api.getApiUrl(chain_api.api_save_tx2token_chain),req_data);
        //console.log("api_save_tx2token_chain-chain_ret:"+JSON.stringify(chain_ret))
    
        //token_chain_write_queue
        let queue_write_ret = this.token_chain_write_queue.add(JSON.stringify(req_data));
        console.log("token_chain_write_queue-queue_write_ret:"+JSON.stringify(queue_write_ret))
    
        let cnt = 1;
        if(!queue_write_ret)//!chain_ret ||  !chain_ret.ret)
        {
            console.log("token_chain_write_queue save failed! msg:"+JSON.stringify(queue_write_ret))
             return {ret:false,msg:"token_chain_write_queue save failed!",token:token,txid:txid,state:STATE_INFO}
        }
    
        console.log("STATE_INFO-old:"+JSON.stringify(STATE_INFO))
        //高度token_height和token_state_val的变化。token_state_p一直不会变化的（首次生成即可---由state_api去修改相关的fork的token_state值）。
        STATE_INFO.token_height = STATE_INFO.token_height + 1;
        //2019-2-15 fix the bug--表现为token_root发送RMB失败，原因为STATE_INFO.token_state_val不见了 (txjson.token_state_val应为txjson.token_state）
        //STATE_INFO.token_state_val = isMe && opcode==OP_SEND ? txjson.token_state_val : STATE_INFO.token_state_val;
        STATE_INFO.token_state_p =  token==token_x && opcode==this.fsm_config.OP_FORK ? txjson.token_state:STATE_INFO.token_state_p
        STATE_INFO.token_state_val = isMe && opcode==this.fsm_config.OP_SEND ? txjson.token_state : STATE_INFO.token_state_val;
    
        console.log("STATE_INFO-new000:"+JSON.stringify(STATE_INFO))
    
        //结果保存在这里，以便update-txinfo-write-now-queue
        if(isMe){
            txjson.relate_sign = sign
        }
    
        //更新状态。
        let setRet = await this.kvdb.set(token_writer_config.token_namespace_state+token,JSON.stringify(STATE_INFO),
            token_writer_config.token_namespace_state_timeout);
        console.log("setRet:"+setRet);
    
        return {ret:true,msg:"success",txinfo}
    }

    
    /**
     * 传递处理结果
     * (txid,token,txinfo,token_relate);
     * @type {updateTx2TokenWriteNowQueueResult}
     */
    async s_updateTx2TokenWriteNowQueueResult(txid,retObj)
    {
        let func = this.txCallbackMap.get(txid)
        if(retObj && func )
        {
            //异步写队列或者清除数据
            if(retObj.ret)// && typeof func == 'function')
            {
                func(retObj);
                await this.writeTokenChainQueueDatas();
            }else{
                await this.clearTokenChainQueueDatas();
                func(retObj);
            }

            this.txCallbackMap.delete(txid)// delete tx_writer_redis.redis_client[txid]

            //异步执行之（新的txid处理入口）
            //setTimeout(this.s_processTXWriteQueue,1)
            this.s_processTXWriteQueue()
            return true;
        }
        return false;
    }

    s_makeTXLisenter(txid,func)
    {
        if(this.txCallbackMap.has(txid)) return false;
        // tx_writer_redis.redis_client[txid] = {};
        // tx_writer_redis.redis_client[txid].req = req;
        // tx_writer_redis.redis_client[txid].res = res;
        this.txCallbackMap.set(txid,func)
        return true;
    }


    async writeTokenChainQueueDatas()
    {
        while(true) {
            let rows = (()=>{
                let list = []
                let values = this.token_chain_write_queue.values()
                for(let i=0;i<this.token_chain_write_queue.size;i++)
                    list.push(values.next().value)
                return list
            })()
            //rows = await token_writer_redis.redis_client.lrangeAsync(token_writer_config.token_chain_write_queue, 0, 299);
            let need_cnt =rows.length;

            if(need_cnt<=0)
                break;

            let cnt = await this.chain_m.saveTXQueue2TokenChain(rows);
            console.log("writeTokenChainQueueDatas | cnt="+cnt+" need_cnt="+need_cnt);
            if(cnt>0)//cnt==need_cnt)
            {
                this.token_chain_write_queue.clear()
                let delCnt = '[clear is ok]';//this.token_chain_write_queue.clear()// await token_writer_redis.redis_client.ltrimAsync(token_writer_config.token_chain_write_queue, 300,-1)
                console.log("writeTokenChainQueueDatas || cnt="+cnt+" need_cnt="+need_cnt+" delCnt="+delCnt);
            }else{
                cnt = await this.chain_m.saveTXQueue2TokenChain(rows);

                this.token_chain_write_queue.clear()
                let delCnt = '[clear is ok]'; this.token_chain_write_queue.clear()
                //delCnt = '[clear is ok]';// await token_writer_redis.redis_client.ltrimAsync(token_writer_config.token_chain_write_queue, 300,-1)
                console.log("writeTokenChainQueueDatas || cnt="+cnt+" need_cnt="+need_cnt+" delCnt="+delCnt);
            }
        }
    }
    //当执行失败时，直接丢弃错误结果。
    async clearTokenChainQueueDatas()
    {
        while(true) {
            //let rows = await token_writer_redis.redis_client.lrangeAsync(token_writer_config.token_chain_write_queue, 0, 299);
            let rows = (()=>{
                let val = null
                let list = []
                while((val=this.token_chain_write_queue.values().next().value))
                {
                    list.push(val)
                }
                return list
            })()
            let need_cnt =rows ? rows.length :0;

            if(need_cnt<=0)
                break;

            for(let i=0;i<rows.length;i++)
            {
                let delRet = await this.kvdb.del(token_writer_config.token_namespace_state+rows[i].token)
                console.log('delTokeStateRet-'+rows[i].token+":"+delRet);
            }

            //console.log("writeTokenChainQueueDatas | cnt="+cnt+" need_cnt="+need_cnt);
            console.log("writeTokenChainQueueDatas | cnt=? need_cnt="+need_cnt);
            if(need_cnt>0)//cnt==need_cnt)
            {
                //let delCnt = await token_writer_redis.redis_client.ltrimAsync(token_writer_config.token_chain_write_queue, 300,-1)
                this.token_chain_write_queue.clear()
                let delCnt = '[clear is ok]';
                console.log("writeTokenChainQueueDatas || cnt=? need_cnt="+need_cnt+" delCnt="+delCnt);
            }
        }
    }
    async s_processTXWriteQueue()//func,params)
    {
        console.log('into s_processTXWriteQueue')
        //2022-8-5 设置一个自旋锁，解决部分请求直接崩溃的问题（因为这个设置的问题导致请求无法继续，从而导致死锁）
        let whileCnt = 1//&& whileCnt>0
        while(this.tx_wait_write_queue_lock ){
            console.log("4-10--s_processTXWriteQueue instance must be one ! can't be more than one!!! ")
            await str_filter.sleep(30*whileCnt)

            whileCnt++
            if(whileCnt>100)
            {
                //if(typeof func =='function') func()
                return ;
            }
            //whileCnt = whileCnt-1
        }
        // if(whileCnt<=0) {
        //     return ;
        // }
        this.tx_wait_write_queue_lock = true;
        // console.log("processTXWriteQueueDataCore-tx_writer_redis-setFlag:"+setFlag)
        try{
            let txid = this.tx_wait_write_queue.values().next().value;// (()=>{
                //await tx_writer_redis.lpop( tx_writer_config.tx_wait_write_queue);
            if(!txid){
                this.tx_wait_write_queue_lock = false;
                console.log('s_processTXWriteQueue-txid is undefined! ')//params:'+params)
                // if(typeof func =='function') func()
                return ;
            }
            this.tx_wait_write_queue.delete(txid)//正确删除

            let writeJSON = await this.s_processTXWriteQueueDataOneRow(txid);

            console.log("s_processTXWriteQueueDataOneRow("+txid+") writeJSON:"+JSON.stringify(writeJSON))
            //判断处理结果。
            if(writeJSON && writeJSON.ret){}
        }catch(ex){console.log('s_processTXWriteQueue-exception:'+ex,ex)}
        
        this.tx_wait_write_queue_lock = false;

        return ;
    }

    
    //!---------------------------------------------------------------------------------------------!//
    async root_token()
    {
        //判断是否已经存在于数据库。
        let keys = await this.wallet_m.queryTokenKeys(this.TOKEN_ROOT);
        console.log("queryTokenKeys-keys:"+JSON.stringify(keys)+" keys:"+keys)

        if(!(keys instanceof  Object&& keys.private_key && keys.public_key)){
            //return {ret:false,msg:'get token_root keys failed! result:'+JSON.stringify(keys)}
            //生成公钥和私钥
            let private_key = key_util.newPrivateKey();
            let public_key = key_util.getPublicKey(private_key);
            if(!(private_key && public_key)) return {ret: false, msg: "privateKey or publicKey create failed!"}
            let iNum = await this.wallet_m.saveTokenSignKeys(this.TOKEN_ROOT,private_key,public_key);
            if(iNum<0) return {ret:false,msg:'save root_token to wallet failed! '}
            keys = {private_key,public_key}
        }

        //生成交易纪录---txid生成，签名生成等。
        let root_config0 = Object.assign({},this.root_config) //require('../dnalink.protocol/root_config');
        root_config0.appids=null;
        root_config0.secret_keys=null;

        let timestamp_i = await this.wallet_m.queryTimestamp();
        let txid = this.tx_util.newTXID()
        if(!this.tx_util.validateTXID(txid)) return {ret:false,msg:'root txid is error'}
        let TXINFO = {txid,token_x:this.TOKEN_ROOT,token_y:this.TOKEN_ROOT,opcode:this.fsm_config.OP_ROOT,opval:keys.public_key,extra_data:JSON.stringify(root_config0),timestamp_i};
        let TXJSON = this.tx_util.toTXJSONString(TXINFO);//序列化。
        let hash = await key_util.hashVal(TXJSON);
        let sign = await this.wallet_m.signMsg(TXJSON,hash,keys.private_key,keys.public_key);
        if(!sign) return {ret:false,msg:'root TXINFO sign is null'}
        TXINFO.hash = hash;
        TXINFO.sign = sign;
        //await rpc_http_api.rpc_query(tx_api.getApiUrl(tx_api.api_new_txid),{});

        let iNum = await this.chain_m.save_tx(TXINFO);
        if(iNum<=0) return {ret:false,msg:'root save TXINFO failed'}

        //这里会重复写入（废弃？）
        TXJSON = this.tx_util.toTXJSONString(TXINFO)
        this.writeToTXWriteWaitQueue(txid,JSON.stringify(TXINFO))//TXJSON);
        //成功拿到签名的tx_info
        console.log("txinfo:"+JSON.stringify(TXINFO));

        return {ret:true,msg:'success'}
    }
    async dtns_network_client_sync_files(records)
    {
        let This = this
        if(!(typeof localStorage!='undefined' && localStorage.getItem('userInfo'))){
            console.log('dtns_network_client_sync_files failed by localStorage.getItem-userInfo is null')
            return -1
        }
        let userInfo = JSON.parse(localStorage.getItem('userInfo'))
        console.log('into dtns_network_client_sync_files now: g_sync_files_flag:', typeof g_sync_files_flag)
        if(typeof g_sync_files_flag =='undefined') return console.log('g_sync_files_flag is undefined ',this.roomid)
        console.log('into dtns_network_client_sync_files now:')
        let rows = records
        let iCnt = 0
        let hashMap = new Map()
        for(let i=0;i<rows.length;i++)
        {
            let info = null;
            try{ 
                info = JSON.parse(rows[i]);
            }catch(ex){
                info = rows[i]
            }
            
            // if(typeof info.txjson.token_x !='undefined' ) info.txjson = JSON.stringify(info.txjson)
            let txinfo =  this.chain_m.getTXInfo(info) 
            let opJSON = null;
            try{
                opJSON = JSON.parse(txinfo.opval)
            }catch(ex){
                continue
            }
           if(opJSON.hash && (opJSON.fmt  || opJSON.file_kind || opJSON.img_kind || txinfo.opcode == 'file'))
           {
                let hash = opJSON.hash
                console.log('dtns_network_client_sync_files-hash-map:',hash,hashMap.has(hash))
                if(hashMap.has(hash)) continue
                hashMap.set(hash,'')
                let hashFile = await ifileDb.getDataByKey(hash)
                console.log('dtns_network_client_sync_files-hash-file:',hash,hashFile)
                if(hashFile && hashFile.data) continue

                let params = {user_id:userInfo.user_id,s_id:userInfo.s_id,hash,url:'/user/file/sync' }
                console.log('dtns_network_client_sync_files----syncFile-hash:'+hash,opJSON,txinfo,rows[i])

                try{
                    let downloadFlag = await new Promise((resolve)=>{
                        rpc_client.download(params,async function(data){
                            console.log('dtns_network_client_sync_files---rpc_client.download-file-data:',data.data,data.data.buffer)
                            if(data && data.data){
                            console.log('dtns_network_client_sync_files---download----data-len:'+data.data.length)
                            ifileDb.addData({key:hash,data:data.data})
                            resolve(true)
                            }else{
                            console.log('dtns_network_client_sync_files---下载失败,',hash,opJSON,data)
                            resolve(false)
                            }
                        })
                    })
                    iCnt += downloadFlag ? 1:0
                }catch(ex){
                    console.log('dtns_network_client_sync_files---ex:'+ex,ex)
                }
           }
        }
        console.log('dtns_network_client_sync_files-download-iCnt:'+iCnt)
        return iCnt
    }
    async dtns_network_client_sync()
    {
        if( typeof g_dtns_network_client_not_sync!='undefined'&& g_dtns_network_client_not_sync || window.g_dev_roomid)
        {
            if(typeof g_loginDtnsAndForklist == 'function') g_loginDtnsAndForklist()
            return 
        }    
        //如果是dtns_network_client客户端，则连接，并且请求获得同步的节点数据。
        if(typeof g_dtns_network_client!='undefined' && g_dtns_network_client && this.protocol.roomid=='dtns.network')
        {
            console.log('into dtns_network_client_sync')
            //连接服务端
            let dtns_roomid = 'dtns.network'
            console.log('dtns_root_keys',dtns_root_keys)
            let roomid = dtns_roomid+'|'+ parseInt(Date.now()/1000)
            console.log('dtns-roomid:',roomid)
            let hash = await key_util.hashVal(roomid)
            let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
            let protocol = Object.assign({},this.protocol)
            protocol.roomid = roomid+'|'+sign+'|'+dtns_root_keys.token

            let This = this
            this.dtns_network_rtc_api = new RPCApiUtil(protocol,false)
            window.dtns_network_rtc_api = this.dtns_network_rtc_api
            if(typeof g_dtnsManager!='undefined') g_dtnsManager.addRPCClient(dtns_network_rtc_api.rtc_client)
            this.dtns_network_rtc_api.rtc_client.setPeerRefreshCallback(async function(){
                //使用chain/query获得全部数据
                let chainAllRecords = await This.dtns_network_rtc_api.rpc_query('/chain/query',
                    {begin:0,len:1000000000000})
                console.log('dtns_network_rtc_api-chainAllRecords:',chainAllRecords)
                console.log('into save-chain:',chainAllRecords.ret)
                if(chainAllRecords && chainAllRecords.ret && chainAllRecords.list)
                {
                    let list = chainAllRecords.list
                    console.log('into save-chain:list.len:',list.length)
                    list.sort(function(a,b){
                        return a.create_time_i - b.create_time_i
                    })
                    let cnt = await This.chain_m.saveTXQueue2TokenChain(list,true)
                    This.dtns_network_client_sync_files(list)
                    // console.log('This.chain_m:',This.chain_m,'typeof-chain_m:',typeof This.chain_m.saveTXQueue2TokenChain)
                }
                //请求设定websocket等
                let token = dtns_root_keys.token
                let timestamp_i = parseInt(Date.now()/1000)
                let TXINFO = {txid:This.tx_util.newTXID(),token_x:token,token_y:token,
                    opcode:This.fsm_config.OP_WEBSOCKET,opval:'op',extra_data:token,timestamp_i}
                let TXJSON = This.tx_util.toTXJSONString(TXINFO);//序列化。
                console.log('TXJSON:'+TXJSON)
                let hash = await key_util.hashVal(TXJSON);//得到hash值
                let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
                TXINFO.web3_sign = sign

                let websocketRet = await This.dtns_network_rtc_api.rpc_query('/op',TXINFO)
                console.log('dtns_network_rtc_api-op:websocket-ret:',websocketRet)
                if(!websocketRet || !websocketRet.ret  || !websocketRet.rpc_func_ret 
                    || !websocketRet.rpc_func_ret.token){
                    return 
                }
                console.log('link to dtns.network:')
                let link_token = websocketRet.rpc_func_ret.token
                This.dtns_network_rtc_api.rtc_client.setWs(link_token,async function(data){
                    console.log(dtns_roomid+'-recv-data:',data)
                    try{
                        data = JSON.parse(data)
                    }catch(ex){
                        console.log('parse-rows failed,ex:'+ex)
                    }
                    try{
                        //return false;//现在有了global-write-map
                        //应该还要进行校验。如果签名成功，写入到持久化队列
                        //不核验是没办法敢于写入数据的，特别是要判断全部是子token数据
                        let iNum = await This.chain_m.saveTXQueue2TokenChain(data,true,true);//这个格式可能还需要判断2022-8-15
                        console.log('save parent-token-rows-iNum:'+iNum)
                        // This.ws.send(JSON.stringify({ret:true,num:iNum,msg:'success'}))
                    }catch(ex)
                    {
                        console.log('tx-rows from parent write to mydisk failed,ex:'+ex)
                    }
                })
                //得到同步的数据请求
                This.dtns_network_rtc_api.rpc_query('/super/websocket/link',{token:link_token})

                if(typeof g_loginDtnsAndForklist == 'function') g_loginDtnsAndForklist()
            })
            return true
        }
        else 
            return false;
    }
    //对环境进行自检和安装
    async s_validateEnvAndInstall() {
        let data = await this.chain_m.queryTokenStates(this.TOKEN_ROOT)
        if(data && data.height >=0)
        {
            return {ret:true,msg:'environment is ok! ----root-token exists in the chain'}
        }

        console.log("root_token unexists")
        console.log("run install now:")   

        await this.chain_m.initAllTB()
        await this.wallet_m.initWalletDb();

        let ret = await this.dtns_network_client_sync()
        if(!ret) ret = await this.root_token();
        return ret;
    }

    //就否已经安装
    async s_checkEnvInstall()
    {
        let row = await this.chain_m.db_chain.queryOne("select count(1) as cnt from token_chain")
        return row && row.cnt >0
    }
    /**
     * 环境初始化和校验。
     */
    async testEnv() {
        let bInstallFlag = await this.s_checkEnvInstall();
        console.log("testEnv-bInstallFlag:"+bInstallFlag)

        if(!bInstallFlag)
        {
            let installRet = await this.s_validateEnvAndInstall();
            console.log('installRet:'+JSON.stringify(installRet))
        }else{
            await this.dtns_network_client_sync()
        }

        let check_flag = await this.s_checkEnvInstall();
        if (!check_flag) {
            console.log("run dnalink.engine env unsafe!")
        }

        return check_flag
    }
}
window.EventEmitter = EventEmitter
window.DNALinkEngine = DNALinkEngine