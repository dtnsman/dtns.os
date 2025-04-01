/**
 * create by poplang on 2022/9/26
 */
// const str_filter = require('../libs/str_filter');
// const  key_util = require("../../pop.lite.dnalink.engine/dnalink.protocol/key_util")
// const http_request  = require('../libs/http_request')
// const DNALinkEngine = require('../dnalink.engine/DNALinkEngine')
// const PopRuntime = require('../../pop.lang/PopRuntime2')
// const RPCApiUtil = require('./RPCApiUtil')

// const FileController = require('./superdimension/file/FileController')
// const MetaController = require('./superdimension/meta/MetaController')
// const WebSocketController = require('./superdimension/websocket/WebSocketController')


class DNALinkRPC
{
    constructor(engine)
    {
        this.engine = engine;
        this.root_config = engine.root_config
        this.fsm_config =engine.fsm_config
        this.appids = this.root_config.appids
        this.secret_keys=this.root_config.secret_keys
        this.MODULE_PATH=this.root_config.route_module_path

        this.protocol = engine.protocol
        this.fsm_p = engine.fsm_p
        this.tx_util = engine.tx_util
        this.token_util = engine.token_util
        this.coin_num_util = new CoinNumUtil(this.protocol.root_config.COIN_PRECISION_MAX)
        this.TOKEN_NAME = engine.TOKEN_NAME
        this.TOKEN_ROOT = engine.TOKEN_ROOT
        this.TOKEN_ID_LENGTH = engine.TOKEN_ID_LENGTH

        this.wallet_m = engine.wallet_m
        this.chain_m  = engine.chain_m
        this.kvdb  = engine.kvdb
        
        this.pop_cur_context = {}
        this.rpc_api_util = new RPCApiUtil(this.protocol,true)

        this.NOTLOAD_FLAG  = 'NOTLOAD'
        this.GLOBAL_ACCESS_CHAIN_OPEN  = this.NOTLOAD_FLAG;
        this.GLOBAL_WEBSOCKET_WRITE_MAP = {flag:this.NOTLOAD_FLAG} 
        this.init_global_websocket_map_flag = false;

        this.file_c = new FileController(this.protocol)
        this.meta_c = new MetaController(this.protocol)
        this.websocket_c = new WebSocketController(this)
        this.chain_m.setWebsocketController(this.websocket_c)
    }
    rpc_c_index(app) {
        //console.log('op-url:'+this.MODULE_PATH+'/op')
        this.file_c.file_c_index(app)
        this.meta_c.meta_c_index(app)
        this.websocket_c.websocket_index(app)

        //------常见操作。
        //分叉
        let This = this;
        app.all(this.MODULE_PATH+"/fork",function(req,res){This.fork_token_block(req,res)})// rpc_c.fork_token_block);
        //发送（币、积分、人民币、或者消息）
        app.all(this.MODULE_PATH+"/send", function(req,res){This.token_send_block(req,res)});
        //op操作
        app.all(this.MODULE_PATH+"/op", function(req,res){This.token_op_block(req,res)})
        // app.all(MODULE_PATH+"/space_info", root_c.querySpaceInfo);
        //-------------------------------------------------------------
        //chain查询操作（由token&opcode查询token-chain）
        app.all(this.MODULE_PATH+"/chain/query", function(req,res){This.query_chain(req,res)})
    
        app.all(this.MODULE_PATH+"/chain/opcode", function(req,res){This.query_token_chain_bytoken_opcode(req,res)})
    
        app.all(this.MODULE_PATH+"/chain/relations", function(req,res){This.query_token_relations(req,res)})
        app.all(this.MODULE_PATH+"/chain/relations/exists", function(req,res){This.check_token_relations(req,res)})
    
        app.all(this.MODULE_PATH+"/chain/map/keys", function(req,res){This.query_token_map_keys(req,res)})
        app.all(this.MODULE_PATH+"/chain/map/values", function(req,res){This.query_token_map_key_values(req,res)})
        app.all(this.MODULE_PATH+"/chain/map/value", function(req,res){This.query_token_map_value(req,res)})
    
        //chain查询操作（由token查询token-chain）
        app.all(this.MODULE_PATH+"/chain/token", function(req,res){This.query_token_chain_bytoken(req,res)})
        //chain查询操作（由txid查询token-chain）
        app.all(this.MODULE_PATH+"/chain/txid", function(req,res){This.query_token_chain_bytxid(req,res)})
        //chain查询操作（由token查询token-chain-states）
        app.all(this.MODULE_PATH+"/chain/states", function(req,res){This.query_token_states(req,res)})
    
        //支持文件下载等
        app.all(this.MODULE_PATH+"/chain/file*", function(req,res){This.file_c.download_file(req,res)})

        this.web3_node_funcs_map = new Map()
        app.all(this.MODULE_PATH+'/node/*',function(req,res){
            let url = req.url.indexOf('?')>0 ? req.url.substring(0, req.url.indexOf('?')):req.url;
            url = url.split('/node')[1]
            url = decodeURI(url)
            console.log('typeof-rpc-func:'+url+' '+(typeof This.web3_node_funcs_map.get(url)))
            if(typeof This.web3_node_funcs_map.get(url) == 'function')
            {
                This.web3_node_funcs_map.get(url)(req,res)
            }else{
                res.json({ret:false,msg:'rpc-func not exists'})
            }
        })

        //2024-4-9新增
        app.all(this.MODULE_PATH+"/chain/static", function(req,res){systemcmd_c.static(req,res)})
    }

    /**
     * 用于处于FORK证书生成等的合约（合约代码）
     * @param {*} req 
     * @param {*} res 
     * @param {*} params 
     * @param {*} next 
     */
    async processRPCReaction(req,res,params,next)
    {
        let {web3_sign, token_x,token_y,opcode,opval,extra_data} = params
        let xAreaName =this.token_util.getTokenCltAreaName(token_x)
        let xtokenId = token_x.split('_')[1]
        let rpc_func_ret = null
        //当为fork时
        if(opcode == this.fsm_config.OP_FORK && xAreaName!=null &&  
            xtokenId.indexOf(xAreaName+this.token_util.TOKEN_CLT_TIPS_STR+'fork')==0)
        { 
            //生成映射关系ID
            let length = (xAreaName+this.token_util.TOKEN_CLT_TIPS_STR+'fork').length
            //36字节（token-id是32字节）
            let forkid = 'FORK'+xtokenId.substring(length,xtokenId.length)+str_filter.randomBytes(length+4).toUpperCase()
            console.log('processRPCReaction-FORKID:'+forkid,forkid.length)
            let ret = await this.rpc_api_util.rpc_query('/op',{opcode:'map',token_x:this.TOKEN_ROOT,token_y:this.TOKEN_ROOT,opval:'add',
                extra_data:JSON.stringify({map_key:forkid,map_value:token_x})})
            rpc_func_ret = ret && ret.ret ? {FORKID:forkid,ret:true,msg:'success'}:null
        }

        //自动映射FORK-REL-USER（建立relf索引user-fork之间）
        if(opcode == this.fsm_config.OP_MAP && opval=='add')
        {
            let map_json = null
            try{
                map_json = JSON.parse(extra_data)
            }catch(ex){
                console.log('processRPCReaction-parse-map-json-exception:'+ex,ex)
            }
            let prefix_rel_user_str = 'FORK-REL-USER:'
            if(map_json && map_json.map_key && map_json.map_key.indexOf(prefix_rel_user_str)==0){
                let FORK_TOKEN_ID = token_x
                let FORK_USER_ID = map_json.map_key.substring(prefix_rel_user_str.length,map_json.map_key.length)
                let ret = await this.rpc_api_util.s_save_into_token_list('',FORK_USER_ID,FORK_TOKEN_ID,'relf',map_json.map_value)
                rpc_func_ret = ret && ret.ret ? {ret:true,msg:'success:DTNS-user-id relf DTNS-fork-id'}:null
            }
        }

        //自动映射hold-int（dtns.score.clt）
        if(opcode == this.fsm_config.OP_FORK && xAreaName!=null &&  
            xtokenId.indexOf(xAreaName+this.token_util.TOKEN_CLT_TIPS_STR+'int')==0)
        {
            let ret = await this.rpc_api_util.s_save_into_token_list('',extra_data,token_x,'hold','DTNS-user-id hold DTNS-int-id')
            rpc_func_ret = ret && ret.ret ? {ret:true,msg:'success:DTNS-user-id hold DTNS-int-id'}:null
        }

        //版税系统 2023-11-28（亦可认为是gas系统）
        g_rpcReactionFilterMapAdd(null)
        let web3_id = null
        if(opcode == this.fsm_config.OP_SEND)
        {
            if(xAreaName!=null)
            {
                let mapInfoRet = await this.rpc_api_util.rpc_query('/chain/map/value',{token:this.TOKEN_ROOT,map_key:'web3:' + xAreaName})
                if(mapInfoRet && mapInfoRet.ret && mapInfoRet.map_value) web3_id = mapInfoRet.map_value
            }
            console.log('processRPCReaction-opcode==send',this.fsm_p.isNumValType(),web3_sign,req.web3_sign_token,web3_id,opval,params,req)
            // web3_sign && req.web3_sign_token==web3_id //如果是app-id根用户使用seb3key转账-进行分账
            //if(!(!web3_sign || req.web3_sign_token!=web3_id))//!（如果是系统级转账 或者 非根账户使用web3key转账）---系统级转账亦须分账--除非使用了g_rpcReactionFilterMap进行过滤（允许不分账）
            // if(web3_sign && req.web3_sign_token!=web3_id)
        }
        
        if(opcode == this.fsm_config.OP_SEND && this.fsm_p.isNumValType() && (!web3_sign || web3_sign && req.web3_sign_token==web3_id) && extra_data!='recharge-order' && !g_rpcReactionFilterMap.has(extra_data))
        {
            //计算扣除比例，转账（然后取得转账结果）
            if(typeof g_system_tax == 'undefined') window.g_system_tax = 0.3
            if(typeof g_system_tax_gas == 'undefined') window.g_system_tax_gas = 1
            let defaultSetting = typeof g_system_tax_setting!='undefined' && g_system_tax_setting ? g_system_tax_setting:  [
                {
                    token:this.TOKEN_ROOT,
                    tax:g_system_tax,
                    type:'tax' //类型协议gas or  tax
                }
                // ,
                // {
                //     token:this.TOKEN_ROOT,
                //     tax:g_system_tax_gas,
                //     type:'gas' //类型协议gas or  tax
                // }
            ]
            const defaultSettingMap = typeof g_system_tax_setting_map!='undefined' && g_system_tax_setting_map ? g_system_tax_setting_map:{}

            let taxSetting = [] , map_key = 'tax:setting'
            //如果使用了xAreaName，则查询配置网络(一般情况下，dtns.network是必定使用了xAreaName的)
            if(xAreaName!=null)
            {
                map_key = 'tax:'+xAreaName 
                //按defaultSettingMap读取配置
                if(defaultSettingMap[map_key])
                {
                    defaultSetting = defaultSettingMap[map_key]
                }
            }
            //得到tax版税配置之token-id
            let mapInfoRet = await this.rpc_api_util.rpc_query('/chain/map/value',{token:this.TOKEN_ROOT,map_key})
            // if(!mapInfoRet|| !mapInfoRet.ret) mapInfoRet = await this.rpc_api_util.rpc_query('/chain/map/value',{token:this.TOKEN_ROOT,map_key:'tax:'+xAreaName})
            console.log('query-tax-mapInfoRet:',mapInfoRet,map_key,defaultSetting)
            if(mapInfoRet && mapInfoRet.ret && mapInfoRet.map_value)
            {
                let queryVal = await this.rpc_api_util.s_query_token_info('',mapInfoRet.map_value,this.fsm_config.OP_ASSERT)               
                console.log('query-tax-queryVal:',queryVal)
                if(queryVal){
                    taxSetting = queryVal
                }else{
                    taxSetting = defaultSetting
                }
            }else{
                taxSetting = defaultSetting
            }

            let flag = false
            for(let i=0;i<taxSetting.length;i++)
            {
                //避免二级生成更多的tax计费分账，赞成不断微分下去的分账 fix the bug
                let tax_extra_data = 'tax-'+Date.now()+'-'+Math.random()
                g_rpcReactionFilterMapAdd(tax_extra_data)
                if(taxSetting[i] && taxSetting[i].tax && taxSetting[i].token)
                {
                    //扣费（区分是gas还是tax---gas不进行乘法运算，直接扣,type=tax须进行比例运算）
                    let fee = taxSetting[i].type =='gas' ? this.coin_num_util.toCoinNumNUM( taxSetting[i].tax ):  this.coin_num_util.toCoinNumNUM( this.coin_num_util.mul(this.coin_num_util.toCoinNumNUM(opval) ,this.coin_num_util.toCoinNumNUM( taxSetting[i].tax) ))
                    if(this.coin_num_util.validateCoinNumNUM(fee) )//isFinite(fee))
                    {
                        let ret = await this.rpc_api_util.rpc_query('/op',{opcode:'send',token_x:token_y,token_y:taxSetting[i].token,opval:fee,extra_data:tax_extra_data})
                        if(ret && ret.ret){
                            taxSetting[i].ret = true
                            taxSetting[i].msg = 'success'
                            taxSetting[i].fee = fee
                            flag = true
                        }else{
                            taxSetting[i].ret = false
                            taxSetting[i].fee = fee
                            taxSetting[i].msg = ret ?ret.msg:'unkown failed'
                        }
                    }else{
                        taxSetting[i].ret = false
                        taxSetting[i].msg = 'fee-is-not-number'
                        taxSetting[i].fee = fee
                    }
                }
            }

            //返回结果
            rpc_func_ret = {ret:flag,msg:flag?'success':'send tax failed',tax_results:taxSetting} // ret && ret.ret ? {ret:true,msg:'success',tax:true}:null
        }
        //清理过滤
        else if(opcode == this.fsm_config.OP_SEND && this.fsm_p.isNumValType() && g_rpcReactionFilterMap.has(extra_data))
        {
            //once 
            g_rpcReactionFilterMap.delete(extra_data)
            if(g_rpcReactionFilterMap.has(extra_data))
            {
                console.log('[big-error]rpcReactionFilterMap-delete-tax-extra-data-failed:',extra_data,g_rpcReactionFilterMap.has(extra_data))
            }
        }
        if(typeof next == 'function'){
            next(rpc_func_ret)
        }else{
            res.json({ret:false,msg:'processRPCReaction-param(next) is not function'})
        }
    }


    // const poplang = new Pop(null,true)
    /**
     * 等待处理结果才返回。
     * @type {fork_token_block}
     *
     * http://127.0.0.1:88/fork?token=msg_0000000000000000
     * {"ret":true,"token_x":"msg_32LtxLjySdPhBHQk","public_key":"moa3LGdDkLL7qabKhW2q9NEN29kgA2ePFndt5HcpG9e3","private_key":"6wKddSRQyhGWDV7qnsjJqTGvDcSedKYPKHEVxm6b1398"}
     *
     * http://127.0.0.1:88/fork?token=msg_0000000000000000&tips=1
     * {"ret":true,"token_x":"msg_0000000000000001","public_key":"28WZ5sTTd1TtEZ1st1DXz1xgAKV9SfwmgmL5295Tgw15J","private_key":"8icax9JKw92DPS46GPvrnWvjvs8hdgkotRFAzoNC52yT"}
     *
     * http://127.0.0.1:88/fork?token=msg_0000000000000000&tips=1&space=sys
     * {"ret":true,"token_x":"msg_sys31RMLA3eJvPxL","public_key":"22PZtdYXEvkJGZUnxjzi1FWQiJGuQN5qAsPoWmnLJJaMu","private_key":"Ere2UW5SxThkJtCC2dM2o2d9y6TmtkERNoogz3ZYjo8r"}
     */
    async fork_token_block(req,res)
    {
        console.log('2019-8-7fork_token_block')
        let {txid,web3_sign,timestamp_i, token,dst_token,space,tips,extra_data} = str_filter.get_req_data(req);
        if(!this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:'fork-token format error'})

        //在钱包中保存fork_token
        //token_tips=null,dst_token=null,space=null,tips=null
        
        //根据需求,创建space
        let areaName_y = this.token_util.getTokenCltAreaName(token)
        areaName_y = areaName_y!=null ? areaName_y+this.token_util.TOKEN_CLT_TIPS_STR :null
        space = areaName_y ? (space!=null && space.indexOf(areaName_y)==0 ? space: areaName_y) :space

        let tokenInfo =   await this.wallet_m.getNewToken(token,dst_token,space,tips)  //   rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_new_token),{token,dst_token,space,tips});
        //let keys = await create_wallet_token(token_root)
        console.log("fork_token - rpc_query - api_new_token-keys:"+JSON.stringify(tokenInfo));

        if(!(tokenInfo instanceof Object)) {
            return res.json({ret:false,msg:'wallet new token failed! '})
        }
            
        let cltAreaRet = this.isInCLTAreaNow(tokenInfo.token,token,this.fsm_config.OP_FORK)
        if(cltAreaRet){
            console.log('cltAreaRet-is-not-null',cltAreaRet)
            this.wallet_m.delToken(tokenInfo.token)
            return res.json(cltAreaRet)
        }

        res.private_key = tokenInfo.private_key

        //生成交易纪录---txid生成，签名生成等。
        //let param = {token_x:tokenInfo.token,token_y:token,opcode:OP_FORK,opval:tokenInfo.public_key,extra_data:extra_data};
        let txinfo = web3_sign ? {txid,sign:web3_sign,hash:res.web3_hash,timestamp_i,token_x:tokenInfo.token,token_y:token,opcode:this.fsm_config.OP_FORK,opval:tokenInfo.public_key,extra_data,ret:true,msg:'success'}: 
                                await this.engine.newSignedTxUnsafe(tokenInfo.token,token,this.fsm_config.OP_FORK,tokenInfo.public_key,extra_data,0,res)//await rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_new_signed_tx_unsafe),param);
        //let txinfo = await this.engine.newSignedTxUnsafe(tokenInfo.token,token,this.fsm_config.OP_FORK,tokenInfo.public_key,extra_data)///rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_new_signed_tx_unsafe),param);
        if(!(txinfo && txinfo.ret)){
            this.wallet_m.delToken(tokenInfo.token)
            return res.json({ret:false,msg:'new_signed_tx_unsafe failed! msg:'+(txinfo?txinfo.msg:"wallet_api connected failed!")})
        }

        //成功拿到签名的tx_info
        // console.log("fork_token_block-txinfo:"+JSON.stringify(txinfo));
        //将其写入到tx纪录中，进行六度共识同步
        //let {txid,token_x,token_y,opcode,opval,extra_data,timestamp_i,hash,sign} = TXINFO;
    //  let x = tx_c.save_tx(null)
        let iNum = await  this.chain_m.save_tx(txinfo) //rpc_http_api.rpc_query(tx_api.getApiUrl(tx_api.api_save_tx),txinfo);

        if(iNum<=0){
            this.wallet_m.delToken(tokenInfo.token)
            return res.json({ret:false,msg:"save tx failed!"})
        }

        //保存到队列中（tx-writer队列）
        let txjson = this.tx_util.toTXJSONString(txinfo);
        txjson = JSON.parse(txjson)
        txjson.hash = txinfo.hash;
        txjson.sign = txinfo.sign;

        let commitRet = await this.engine.s_commitTXToTXWriteWaitQueue(txinfo.txid, JSON.stringify(txjson))
        console.log('commitRet:'+JSON.stringify(commitRet));
        if(!commitRet || !commitRet.ret)  return res.json(commitRet);// res.json({ret:false,msg:"commit tx failed!"})

        let This = this
        let makeRet = await this.engine.s_makeTXLisenter(txinfo.txid,function(results){
            results.rpc_func_ret = res.rpc_func_ret
            if(results.x_state) results.x_state.private_key = res.private_key
            if(results && !results.ret) This.wallet_m.delToken(tokenInfo.token)
            if(results && results.ret){
                //进行结果回调处理
                This.processRPCReaction(req,res,{token_x:results.token_x,
                    token_y:token,opcode:This.fsm_config.OP_FORK,web3_sign},function(ret){
                        if(ret) results.rpc_reaction_ret = ret
                        res.json(results)
                    })
            }
            else 
            res.json(results)
        })
        console.log("s_makeTXLisenter - makeRet:"+makeRet)
        if(!makeRet) res.json({ret:false,msg:'make tx-writer callback-lisenter failed!'});

        //调用tx-writer写。
        await this.engine.s_processTXWriteQueue();
    }



    /**
     * 发送（已经初始化过了帐户）
     * @type {token_send_block}
     *
     * http://127.0.0.1:88/send?token_x=msg_0000000000000000&token_y=msg_y7QeVEahUyQ7LNrs&opval=你好外星人 ET
     */
    async token_send_block(req,res)
    {
        let {txid,web3_sign,timestamp_i, token_x,token_y,opval,extra_data} = str_filter.get_req_data(req);
        if(!opval)
            return res.json({ret:false,msg:"opval is null"})
                    
        let cltAreaRet = this.isInCLTAreaNow(token_x,token_y,this.fsm_config.OP_SEND)
        if(cltAreaRet){
            console.log('cltAreaRet-is-not-null',cltAreaRet)
            return res.json(cltAreaRet)
        }

        extra_data = !extra_data ?"":extra_data;

        //生成交易纪录---txid生成，签名生成等。
        //let param = {token_x:token_x , token_y:token_y, opcode:OP_SEND,opval:opval,extra_data:extra_data};
        let txinfo = web3_sign ? {txid,sign:web3_sign,hash:res.web3_hash,timestamp_i,token_x,token_y,opcode:this.fsm_config.OP_SEND,opval,extra_data,ret:true,msg:'success'}: 
                                await this.engine.newSignedTxUnsafe(token_x,token_y,this.fsm_config.OP_SEND,opval,extra_data,0,res)//await rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_new_signed_tx_unsafe),param);
        //let txinfo = await this.engine.newSignedTxUnsafe(token_x,token_y,this.fsm_config.OP_SEND,opval,extra_data)//await rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_new_signed_tx_unsafe),param);
        if(!txinfo || !txinfo.ret){
            return res.json({ret:false,msg:'new_signed_tx_unsafe failed! msg:'+(txinfo?txinfo.msg:"wallet_api connected failed!")})
        }
        //成功拿到签名的tx_info
        // console.log("token_send_block-txinfo:"+JSON.stringify(txinfo));

        let iNum = await  this.chain_m.save_tx(txinfo) //rpc_http_api.rpc_query(tx_api.getApiUrl(tx_api.api_save_tx),txinfo);

        if(iNum<=0){
            return res.json({ret:false,msg:"save tx failed!"})
        }


        let txjson = this.tx_util.toTXJSONString(txinfo);
        txjson = JSON.parse(txjson)
        txjson.hash = txinfo.hash;
        txjson.sign = txinfo.sign;
        let commitRet = await this.engine.s_commitTXToTXWriteWaitQueue(txinfo.txid, JSON.stringify(txjson))
        console.log('commitRet:'+JSON.stringify(commitRet));
        if(!commitRet || !commitRet.ret)  return res.json(commitRet);// res.json({ret:false,msg:"commit tx failed!"})

        let This = this
        let makeRet = await this.engine.s_makeTXLisenter(txinfo.txid,function(results){
            results.rpc_func_ret = res.rpc_func_ret
            // if(results.x_state) results.x_state.private_key = res.private_key
            // if(results && !results.ret) This.wallet_m.delToken(tokenInfo.token)
            if(results && results.ret)
            {
                //进行结果回调处理
                This.processRPCReaction(req,res,{token_x,
                    token_y,opcode:This.fsm_config.OP_SEND,opval,extra_data,web3_sign},function(ret){
                        if(ret) results.rpc_reaction_ret = ret
                        res.json(results)
                    })
            }
            else 
                res.json(results)
            // ret.rpc_func_ret = res.rpc_func_ret
            // res.json(ret)
        })
        console.log("s_makeTXLisenter - makeRet:"+makeRet)
        if(!makeRet) res.json({ret:false,msg:'make tx-writer callback-lisenter failed!'});

        //调用tx-writer写。
        await this.engine.s_processTXWriteQueue();
    }

    /**
     * 这里是所有的操作都能进行（fork，send，assert等操作，只要是oplist里面的字段）
     * @type {token_op_block}
     *
     * http://127.0.0.1:88/op?token_x=msg_0000000000000002&token_y=msg_0000000000000000&opcode=fork&opval=test&tips=1&space=sys&extra_data=你好 外星人
     * {"ret":false,"msg":"new_signed_tx_unsafe failed! msg:token_x unexists in the wallet!"}
     * 注解：当是fork操作时，需要所谓的wallet支持，这里没有创建该token，故不存在，如fork建议使用/fork操作。
     *
     * http://127.0.0.1:88/op?token_x=msg_0000000000000000&token_y=msg_0000000000000000&opcode=send&opval=test&tips=1&space=sys&extra_data=你好 外星人
     * {"ret":true,"msg":"success","list":"{\"txid\":\"txid_22N3C9e4srLqDUE1\",\"token\":\"msg_0000000000000000\",\"txinfo\":{\"txid\":\"txid_22N3C9e4srLqDUE1\",\"token_x\":\"msg_0000000000000000\",\"token_y\":\"msg_0000000000000000\",\"opcode\":\"send\",\"opval\":\"test\",\"extra_data\":\"你好 外星人\",\"timestamp_i\":\"1550288363\",\"hash\":\"70b58cd5df69ad2b0cef5cc6ac6945a791e375f0e23b017c9f3e95c89ea1b444\",\"sign\":\"3vVrgYAvAXY7bZDyY9S66JxPkETmsT1o3emH2AGWvGZDR84P64enQvSfu7RWBFcg3Eg6yW6ZUHfKXjVjB1gfbPZz\",\"list_x\":\"[]\",\"list_y\":\"[]\",\"relate_sign\":\"3vVrgYAvAXY7bZDyY9S66JxPkETmsT1o3emH2AGWvGZDR84P64enQvSfu7RWBFcg3Eg6yW6ZUHfKXjVjB1gfbPZz\"},\"token_relate\":\"msg_0000000000000000\"}"}
     *
     * http://127.0.0.1:88/op?token_x=msg_0000000000000000&token_y=msg_0000000000000000&opcode=assert&opval=test&tips=1&space=sys&extra_data=你好 外星人
     * {"ret":true,"msg":"success","list":"{\"txid\":\"txid_24hsPc4JtshRN4Yr\",\"token\":\"msg_0000000000000000\",\"txinfo\":{\"txid\":\"txid_24hsPc4JtshRN4Yr\",\"token_x\":\"msg_0000000000000000\",\"token_y\":\"msg_0000000000000000\",\"opcode\":\"assert\",\"opval\":\"test\",\"extra_data\":\"你好 外星人\",\"timestamp_i\":\"1550288384\",\"hash\":\"d0cbbee91836e458484b17c0cea7c00e5c40cd9480da6fbd49006a9dd60e1d90\",\"sign\":\"3GBMVMjLbdyYKkNbLFXHgAjYQ9rxoawyX528kQm7wCKBtWyyHwVJFxdkK4uWZXaiH3GpzRa3v5qtW4mckNNGbBaN\",\"list_x\":\"[]\",\"list_y\":\"[]\",\"relate_sign\":\"3GBMVMjLbdyYKkNbLFXHgAjYQ9rxoawyX528kQm7wCKBtWyyHwVJFxdkK4uWZXaiH3GpzRa3v5qtW4mckNNGbBaN\"},\"token_relate\":\"msg_0000000000000000\"}"}
     *
     * http://127.0.0.1:88/op?token_x=msg_0000000000000000&token_y=msg_0000000000000000&opcode=chkey&opval=test&tips=1&space=sys&extra_data=你好 外星人
     * {"ret":true,"msg":"success","list":"{\"txid\":\"txid_273DcMYJqUrTFzbA\",\"token\":\"msg_0000000000000000\",\"txinfo\":{\"txid\":\"txid_273DcMYJqUrTFzbA\",\"token_x\":\"msg_0000000000000000\",\"token_y\":\"msg_0000000000000000\",\"opcode\":\"chkey\",\"opval\":\"test\",\"extra_data\":\"你好 外星人\",\"timestamp_i\":\"1550288408\",\"hash\":\"9f45ceb4047011fe88ac22f71cf9c546df2db792857f41c3ca644d2e995537b5\",\"sign\":\"5AFt1BpXj6n8KS9ihsKGy4QavbHfBf1J3L2MYbeizyqAf7DE5T82uX1AJZUwuN7SjRUK5m6Y7yEbUzQTAFSZz7Wg\",\"list_x\":\"[]\",\"list_y\":\"[]\",\"relate_sign\":\"5AFt1BpXj6n8KS9ihsKGy4QavbHfBf1J3L2MYbeizyqAf7DE5T82uX1AJZUwuN7SjRUK5m6Y7yEbUzQTAFSZz7Wg\"},\"token_relate\":\"msg_0000000000000000\"}"}
     *
     * 注意：这里chkey还不能完成相应的修改密钥操作，仅仅是声明而已（待后续完善）。
     *
     * http://127.0.0.1:88/op?token_x=msg_0000000000000000&token_y=msg_0000000000000000&opcode=phone&opval=18675516875&tips=1&space=sys&extra_data=你好 外星人
     * 这里设置了一个手机号码：18675516875（非常棒的设定）。
     *
     *
     *
     */
    isInCLTAreaNow(token_x,token_y,opcode)
    {
        console.log('token_x_y',token_x,token_y,opcode)
        let areaName_x = this.token_util.getTokenCltAreaName(token_x)
        let areaName_y = this.token_util.getTokenCltAreaName(token_y)
        console.log('areaName_x_y',areaName_x,areaName_y)
        if(areaName_x!=areaName_y &&  
            ! //取非,意味着下述N种情况不存在
            (token_x==this.TOKEN_ROOT || //当token_x是token_root时,允许操作（含转账send等更多操作）
            token_y== this.TOKEN_ROOT && opcode==this.fsm_config.OP_FORK || //或者当token_y是token-root且opcode=fork时允许操作
            areaName_x!=null && areaName_y==null && opcode==this.fsm_config.OP_FORK  //当且仅当token_y不为token-root且是新fork[权益域]时--权益根域不是二级（而是三级或更深级）
            || areaName_y!=null && opcode && (opcode=='relate' || opcode=='join' || opcode=='hold' ||
                    opcode.length==4 && opcode.indexOf('rel')==0) //处于【关系域】，允许作为token_y操作生成[关系域]
            )) 
        {
            console.log('isInCLTAreaNow-ret:opcode outside token-clt-area')
            return {ret:false,msg:'opcode outside token-clt-area'}
        }
        console.log('isInCLTAreaNow-ret:null')
        return null
    }
    async token_op_block(req,res)
    {
        let {txid,web3_sign,timestamp_i, token_x,token_y,opcode,opval,extra_data,appid,secret_key,set_call,token_key,access_key,space,dst_token,tips} = str_filter.get_req_data(req);
        if(!this.tx_util.validateOPCODE(opcode))
        {
            console.log('opcode:'+opcode+' is error')
            return res.json({ret:false,msg:'opcode error'})
        }

        //2022-11-11新增recid（以便用于恢复公钥，追踪系统用）
        if(res.web3_public_key)
        {
            web3_sign = key_util.getHavedRecidSign(res.web3_hash,web3_sign,res.web3_public_key)
            console.log('getHavedRecidSign-web3_sign:',web3_sign)
        }

        //拦截的fork请求（以便pop中实现规整的设计）
        if(opcode== this.fsm_config.OP_FORK)
        {
            console.log('fork-op-param:',token_x,token_y,opcode,opval,extra_data,appid,secret_key,token_key,access_key,space,dst_token)
            //2022-11-10支持了使用web3_sign的方式来设置public_key和fork
            if(token_x!=token_y){//使用web3_sign（亦即仅通过opval来提供public_key，而不再提private_key）
                //return res.json({ret:false,msg:'token not match'})
                //保存public_key到token_wallet中，并且获得token_height必须为-1.
                let iHeight = await this.chain_m.queryTokenHeight(token_x)
                if(iHeight>=0) return res.json({ret:false,msg:'fork-error:token_x already exist!'})
                //!key_util.verifySignMsg(res.web3_hash,web3_sign,opval) &&
                if(! (await key_util.verifySignMsg(res.web3_hash,web3_sign,res.web3_public_key)))
                    return res.json({ret:false,msg:'public_key verify sign failed'})

                let saveWalletNum = await this.wallet_m.saveTokenSignKeys(token_x,'***',opval)
                // let cached = await this.wallet_m.cacheWalletKeys(token_x, {token:token_x,private_key:'***',public_key:opval})
                res.private_key = '***'

                console.log('fork-op-rpc-saveWalletNum:'+saveWalletNum);//+' keys:'+JSON.stringify(await this.wallet_m.queryTokenKeys(token_x))+' cached:'+cached)
                //check-public-key
                // let keys = await this.wallet_m.queryTokenKeys(token_x)
                // console.log('fork-token-x-keys:'+JSON.stringify(keys))
                // let keyInfo = await this.wallet_m.queryCacheWalletKeys(token_x)
                // console.log('fork-token-x-keys-cached:'+JSON.stringify(keyInfo))
            }else{ //token_x = token_y 
                let token = token_x;
                
                //根据需求,创建space
                let areaName_y = this.token_util.getTokenCltAreaName(token_y)
                areaName_y = areaName_y!=null ? areaName_y+this.token_util.TOKEN_CLT_TIPS_STR :null
                space = areaName_y ? (space!=null && space.indexOf(areaName_y)==0 ? space: areaName_y) :space

                let tokenInfo =   await this.wallet_m.getNewToken(token,dst_token,space,tips) 
                token_x =tokenInfo.token
                opval = tokenInfo.public_key
                res.private_key = tokenInfo.private_key
                res.tokenInfo = tokenInfo
            }
            // let ret =  await this.rpc_api_util.rpc_query('/fork',{token,opcode,opval,extra_data,appid,secret_key,token_key,access_key,space,dst_token})
            // return res.json(ret)
        }
        
        let cltAreaRet = this.isInCLTAreaNow(token_x,token_y,opcode)
        if(cltAreaRet){
            console.log('cltAreaRet-is-not-null',cltAreaRet)
            if(res.private_key) this.wallet_m.delToken(res.tokenInfo.token)
            return res.json(cltAreaRet)
        }
        
        // if(!opval)
        //     return res.json({ret:false,msg:"opval is null"})

        extra_data = !extra_data ?"":extra_data;

        //[1]调用云函数（如短信发送接口）。
        if(opcode==this.fsm_config.OP_SMS)
        {
            //先发送短信。
            let smsRet = null;
            let tmpOpval = JSON.parse(opval);
            try {
                let {phone, code,sms_sign, template,order_number, version} = tmpOpval;
                if (!phone || !code && !template || version != parseInt(version) || version != 1)//版本号为1
                {
                    console.log('tmpOpval:'+opval)
                    smsRet = {ret: false, msg: "param unmatch"};
                }
                else {
                    smsRet = await http_request.http_post('https://cloud.forklist.dtns/cloud-sms/send',
                        {
                            appid, secret_key,
                            user_name: Xdtns_NODE_ID,
                            token_name: this.TOKEN_NAME,
                            order_number,
                            phone,
                            code,sms_sign,template,
                            random: Math.random()
                        });
                }
                console.log('smsRet:'+JSON.stringify(smsRet));
            }catch(ex)
            {
                console.log('parse param error, ex:'+JSON.stringify(ex))
                smsRet = {ret:false,msg:"parse param error"}
            }
            //
            // let send_sms_flag = smsRet &&smsRet.ret;
            // let sms_last_num  = smsRet ? smsRet.sms_last_num : -1;
            tmpOpval.rpc_func_ret = smsRet;
            res.rpc_func_ret = smsRet;
            // tmpOpval.sms_last_num = sms_last_num;
            opval = JSON.stringify(tmpOpval);
        }
        //[1]调用云函数（发送邮件接口）。
        else if(opcode==this.fsm_config.OP_MAIL)
        {
            //先发送短信。
            let mailRet = null;
            let tmpOpval = JSON.parse(opval);
            try {
                let {mail_list, title, content, version,order_number} = tmpOpval;
                content = !content ? '':content;
                if (!mail_list || !title || version != parseInt(version) || version != 1)//版本号为1
                {
                    console.log('tmpOpval:'+opval)
                    mailRet = {ret: false, msg: "param unmatch"};
                }
                else {
                    //https://cloud.forklist.dtns/cloud-sms/send?user_name=opencom&token_name=user&appid=10001&secret_key=&phone=18675516875&code=testabc&random=8&order_number=yaaa
                    mailRet = await http_request.http_post('https://cloud.forklist.dtns/cloud-mail/send',
                        {
                            appid, secret_key,
                            user_name: Xdtns_NODE_ID,
                            token_name: this.TOKEN_NAME,
                            order_number,
                            mail_list,
                            title,content,
                            random: Math.random()
                        });
                }
                console.log('mailRet:'+JSON.stringify(mailRet));
            }catch(ex)
            {
                console.log('parse param error, ex:'+JSON.stringify(ex))
                mailRet = {ret:false,msg:"parse param error"}
            }
            //
            // let send_sms_flag = smsRet &&smsRet.ret;
            // let sms_last_num  = smsRet ? smsRet.sms_last_num : -1;
            tmpOpval.rpc_func_ret = mailRet;
            res.rpc_func_ret = mailRet;
            // tmpOpval.sms_last_num = sms_last_num;
            opval = JSON.stringify(tmpOpval);
        }
        //[4]2019-9-5新增的ws订阅地址。
        else if(opcode==this.fsm_config.OP_WSLISTEN)
        {
            if(false){
            let listenRet = await http_request.http_post('https://cloud.forklist.dtns/cloud/ws/listen',
            {
                appid, secret_key,
                user_name: this.root_config.TNS_NAMESPACE.split('_')[0],
                token_name: this.TOKEN_NAME,
                opval, //将参数直接同步server
                random: Math.random()
            });

            console.log('listenRet:'+JSON.stringify(listenRet));
            res.rpc_func_ret = listenRet;
            extra_data = JSON.stringify(listenRet);
            }
        }
        //[3]如果是pay云支付指令，创建一个云支付指令订单。
        else if(opcode==this.fsm_config.OP_PAY)
        {
            //先发送短信。
            let payQRet = null;
            let tmpOpval = JSON.parse(opval);
            try {
                let {order_name,order_number,pay_money,auto,notify_url, version,method} = tmpOpval;
                if(method && method=='callback')
                {

                }
                else{
                    tmpOpval.extra_data = !tmpOpval.extra_data ? '':tmpOpval.extra_data;
                    if (!order_name || !pay_money || pay_money!=pay_money*1 || version != parseInt(version) || version != 1)//版本号为1
                    {
                        console.log('tmpOpval:'+opval)
                        payQRet = {ret: false, msg: "param unmatch"};
                    }
                    else {
                        //https://cloud.forklist.dtns/cloud-sms/send?user_name=opencom&token_name=user&appid=10001&secret_key=&phone=18675516875&code=testabc&random=8&order_number=yaaa
                        payQRet = await http_request.http_post('https://cloud.forklist.dtns/cloud-pay/order/new',
                            {
                                appid, secret_key,
                                user_name: Xdtns_NODE_ID,
                                token_name: this.TOKEN_NAME,
                                token_x,token_y,
                                order_name,extra_data:tmpOpval.extra_data,
                                order_number,
                                pay_money,auto,notify_url,
                                random: Math.random()
                            });
                    }
                    console.log('payQRet:'+JSON.stringify(payQRet));

                    tmpOpval.rpc_func_ret = payQRet;
                    res.rpc_func_ret = payQRet;
                }
            }catch(ex)
            {
                console.log('parse param error, ex:'+JSON.stringify(ex))
                payQRet = {ret:false,msg:"parse param error"}
                tmpOpval.rpc_func_ret = payQRet;
                res.rpc_func_ret = payQRet;
            }
            //
            // let send_sms_flag = smsRet &&smsRet.ret;
            // let sms_last_num  = smsRet ? smsRet.sms_last_num : -1;
            // tmpOpval.sms_last_num = sms_last_num;
            opval = JSON.stringify(tmpOpval);
        }else if(opcode == this.fsm_config.OP_FILE_UP &&  req.files&& req.files.length>0)//( (opval+'').length==0 || !opval)
        {
            //文件流，直接用超维api
            req.params = !req.params ? {}:req.params
            req.params.token = token_y
            req.params.next = true;
            // req.next = function(objInfo)
            // {
            //     let param = {token_x,token_y,opcode:OP_FILE_UP,opval:JSON.stringify(objInfo),extra_data:''};
            //     let opRet =await this.rpc_api_util.rpc_query('/op',param)
            //     console.log('OP_FILE_UP-opRet:'+JSON.stringify(opRet))
            // }
            let superRet =  await this.file_c.upload_file(req,res);
        // console.log('OP_FILE_UP-superRet:'+JSON.stringify(superRet))
            return superRet;

            //token_y才是存储的目标。
        }else if(opcode==this.fsm_config.OP_FILE_DOWN &&  (opval+'').indexOf('{')!=0 )//opval是json时,是源自于本代码段之回调保存于chain链上的标准tokenx tokeny opcode数据
        {
            //http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file22aunvJuZg83&token_y=valuetest_file22aunvJuZg83&opcode=file.download&opval=1659583973
            req.params = !req.params ? {}:req.params
            req.params.token = token_y
            req.params.next = true;
            req.params.timestamp = (opval+0)>1000000 ? 0+opval:null;
            let superRet =  await this.file_c.download_file(req,res);
            //console.log('OP_FILE_DOWN-superRet:'+JSON.stringify(superRet))
            return superRet;
            //文件流，直接用超维api
        }else if(opcode.indexOf(this.fsm_config.OP_WEBSOCKET)==0)
        {
            if(opcode==this.fsm_config.OP_WEBSOCKET_TOKEN_WRITE)//开启，关闭
            {
                //http://127.0.0.1:60000/op?access_key=acconced773220f68b4c21070a525d2bf2dffb4bc25fa38143a11baa61f6805c16c7f78&appid=10001&secret_ke1y=bbdbffb24df77be206c820bbe06ae02c&acss_key=&token_x=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_2wihzNDAb2Aa8arW&begin=0&len=1000000000&&web3_sign1=1&opcode=websocket.token.write&extra_data=wslisten-helloworld&opval=http://127.0.0.1:611111
                //这里需要为token设置相关的opval-http-url映射表。
                //token_x:TOKEN_ROOT-write  token_y:token，  relw（relw）---查询列表可得映射表
                // if(opval == OP_WEBSOCKET_TOKEN_WRITE)//opval-是http路由。
                if(opval.indexOf('http')==0)
                {
                    let saveRet = await this.rpc_api_util.s_save_into_token_list('',this.TOKEN_ROOT,token_x,this.fsm_config.OP_RELW,opval)
                    if(!saveRet ){
                        return res.json({ret:false,msg:'save into websocket-list failed!'})
                    }
                }else{
                    let delRet =await this.rpc_api_util.s_del_from_token_list('',this.TOKEN_ROOT,token_x,this.fsm_config.OP_RELW,opval)
                    if(!delRet ){
                        return res.json({ret:false,msg:'remove from websocket-list failed!'})
                    }  
                }
                //刷新GLOBAL数据
                setTimeout(async function(){
                    websocket_c.query_websocket_write_map();
                },5000)
            }
            res.token = 'ws'+str_filter.randomBytes(32);
            let link_token = opcode==this.fsm_config.OP_WEBSOCKET || token_x == this.TOKEN_ROOT ? res.token: token_x
            let setRet = await this.kvdb.set(res.token,link_token,60*10);
            if(setRet) res.rpc_func_ret  = {ret:true,msg:'success',token:res.token}
        }else if(opcode.indexOf(this.fsm_config.OP_ACCESS)>=0)
        {
            //http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_0000000000000000&token_y=valuetest_0000000000000000&opcode=access.chain&opval=50000&extra_data=wslisten-helloworld
            if(opcode == this.fsm_config.OP_ACCESS_BAN)
            {
                let delRet = await this.kvdb.del(opval)//清理掉access_key（暂时只允许使用appid和secret_key授权清理）
                if(delRet) res.rpc_func_ret  = {ret:true,msg:'success',tips:'del access_key',access_key:opval,}
            }else{
                let setRet =null;
                //2022-11-9 fix the sudo root bug  token_y == this.TOKEN_ROOT || 
                if(token_x != this.TOKEN_ROOT)  return res.json({ret:false,msg:'token_x must be TOKEN_ROOT'})
                if(opcode==this.fsm_config.OP_ACCESS_CHAIN_OPEN)
                {
                    global.GLOBAL_ACCESS_CHAIN_OPEN = opval; //修改这个状态，可以关闭
                    //http://127.0.0.1:60000/op?token_key1=tkaccdcf5a8f0bad903b3796134bd5d7f8d3dff2bc0ad2f3a6bfcbc6d3b7f7e711cca&appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=&token_x=valuetest_2wihzNDAb2Aa8arW&token=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_0000000000000000&begin=0&len=1000000000&&web3_sign1=1&opcode=access.chain.open&extra_data=&opval=access.chain.open
                    console.log('GLOBAL_ACCESS_CHAIN_OP:'+GLOBAL_ACCESS_CHAIN_OPEN)
                }else if(opcode==this.fsm_config.OP_ACCESS_ONCE)
                {
                    res.access_key = 'acconce'+str_filter.randomBytes(32);
                    setRet =  await this.kvdb.set(res.access_key,this.fsm_config.OP_ACCESS_ONCE+':'+opval,60*20);//20分钟
                }
                else{
                    res.access_key = 'acc'+str_filter.randomBytes(32);
                    let timestamp = parseInt(opval)
                    if(opcode==this.fsm_config.OP_ACCESS_ALL)
                    {
                        let walletTokenRet = await this.rpc_api_util.rpc_query('/fork',{token:this.root_config.TOKEN_ROOT,space:'acc',extra_data:'token_key'})
                        if(!walletTokenRet || !walletTokenRet.ret) return res.json({ret:false,msg:'create wallet-token-failed'})
                        console.log('fork-access_key-wallet-key:'+JSON.stringify(walletTokenRet))
                        walletTokenRet.private_key= walletTokenRet.x_state.private_key
                        walletTokenRet.public_key = walletTokenRet.x_state.public_key
                        setRet =  await this.kvdb.set(res.access_key,JSON.stringify(walletTokenRet),timestamp);
                    }else{
                        setRet =  await this.kvdb.set(res.access_key,opcode,timestamp);
                    }
                    console.log('set access_key to redis:'+setRet+' timestamp:'+timestamp)
                }
                
                if(setRet) res.rpc_func_ret  = {ret:true,msg:'success',access_key:res.access_key}
            }
        }
        else if(opcode.indexOf(this.fsm_config.OP_TOKEN)==0)
        {
            //http://127.0.0.1:60000/op?token_key=tkacc008246422aa1edd21d99019ad9802ca4a1d3acd0110a7db7149188d8e8126143&appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_0000000000000000&acss_key=accf8ea53fa1964bb8aa810b045ed13a85277ae8ff9520d2b132ea4a181e50419d4&token_y=valuetest_0000000000000000&opcode=access.all&opval=50&extra_data=wslisten-helloworld
            if(opcode == this.fsm_config.OP_TOKEN_ACCESS)
            {
                res.token_key = 'tkacc'+str_filter.randomBytes(32);
                let timestamp = parseInt(opval)
                let setRet =  true;//await this.kvdb.set(res.token_key,token_x,timestamp);//walletTokenRet里的token_y即是
                let walletTokenRet = await this.rpc_api_util.rpc_query('/fork',{token:token_x,space:'tk',extra_data:'token_key'})
                if(!walletTokenRet || !walletTokenRet.ret) return res.json({ret:false,msg:'create wallet-token-failed'})
                console.log('fork-token_key-wallet-key:'+JSON.stringify(walletTokenRet))
                walletTokenRet.private_key = walletTokenRet.x_state.private_key
                walletTokenRet.public_key = walletTokenRet.x_state.public_key
                let setWalletRet = await this.kvdb.set(res.token_key,JSON.stringify(walletTokenRet),timestamp)//+':wallet-token'
                console.log('set token_key to redis:'+setRet+' setWalletRet:'+setWalletRet+' timestamp:'+timestamp)
                if(setRet && setWalletRet) res.rpc_func_ret  = {ret:true,msg:'success',token_key:res.token_key}
            }else if(opcode ==this.fsm_config. OP_TOKEN_BAN)
            {
                let delRet = await this.kvdb.del(opval)//清理掉token_key
                if(delRet) res.rpc_func_ret  = {ret:true,msg:'success',tips:'del token_key',token_key:opval,}
            }
        }else if(opcode.indexOf(this.fsm_config.OP_WEB3_KEY)==0)
        {
            //在common_interceptor进行权限校验，这里不需要处理什么，直接生成对应的存储纪录即可。---清除旧缓存
            // let clear_ret = await token_writer.clearTokenState(token_x);
            // console.log('OP_WEB3_KEY:clear-ret:'+clear_ret)
            let hash = await key_util.hashVal('msg');//得到hash值
            let vflag = false;
            try{
                //http://127.0.0.1:60000/op?token_key1=tkaccc6ddaff123acc302ee6a2e1b7acd7e7657bd20fc5796c0ceb99f9fc6e6d551c6&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=&token_x=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_2wihzNDAb2Aa8arW&begin=0&len=1000000000&&web3_sign=3YEDoKG3bwqpbWPo6namoyNQD6JneHyVG2VQBoA4qv4LdmeYegowQ8vLsYE9d3TY8xyjPVqxcKqrwBonKgHzVxeb&extra_data=3YEDoKG3bwqpbWPo6namoyNQD6JneHyVG2VQBoA4qv4LdmeYegowQ8vLsYE9d3TY8xyjPVqxcKqrwBonKgHzVxeb&opcode=web3.key&opval=28cubN1isDZq89zdPzq5sEP6uFg5XRtznpzYRdpFRt4Fw&req_time=1659685080
                //签名算法和校验算法
                let sign =await key_util.signMsg(hash,'5HzurxJhjwyJV3njY9mKuHHdacQ5R14vLKK3zghyLUQ3');
                console.log('sign:'+sign+' public_key:'+opval+' hash:'+hash)
                vflag=await key_util.verifySignMsg(hash,sign,opval)//只是测试格式，不是真的校验密钥的正确与否
            }catch(ex)
            {
                console.log('verifySignMsg-exception:'+ex)
                return res.json({ret:false,msg:'web_key format error'});
            }
        }else if(opcode==this.fsm_config.OP_WEB3_TOKEN_OPEN)
        {
            //http://127.0.0.1:60000/op?token_key=tkacc2dd1b994ef98e133bd547927824c4168e82c880a799ff2f41271cda5c321f5ab&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=&token_x=valuetest_24hs9nV2XajdEc7F&token_y=valuetest_24hs9nV2XajdEc7F&begin=0&len=1000000000&opcode=web3.token.open&opval=web3.token.open&extra_data=wslisten-helloworld
            //do nothing
            // if(opval!=OP_WEB3_TOKEN_OPEN)  return res.json({ret:false,
            //     msg:'use '+OP_WEB3_TOKEN_OPEN+' api, the opval='+OP_WEB3_TOKEN_OPEN});
            //也可以使用OP_WEB3_TOKEN_OPEN取消授权
        }else if(opcode == this.fsm_config.OP_WEB3_META_SET && !set_call)
        {
            req.params = !req.params ? {}:req.params
            req.params.token = token_y
            req.params.next = true;
            let superRet =  await this.meta_c.setMetaFunction(req,res);
            return superRet;
        }
        //http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file22axi6p2k5Y5&token_y=valuetest_file22axi6p2k5Y5&opcode=web3.meta.call&opval=%7B%22method%22%3A%22setProfile%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%91%E9%BE%99%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
        //http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file22axi6p2k5Y5&token_y=valuetest_file22axi6p2k5Y5&opcode=web3.meta.call&opval=%7B%22method%22%3A%22screenshot%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%91%E9%BE%99%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
        //http://ec2-52-81-96-59.cn-north-1.compute.amazonaws.com.cn:61000/node.lauo.valuetest/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file272eH1bg8Rtj&token_y=valuetest_file272eH1bg8Rtj&opcode=web3.meta.set&opval=%7B%22file_id%22%3A%20%22valuetest_file272eH1bg8Rtj%22%2C%22methods%22%3A%20%7B%22screenshot%22%3A%20%22screenshot%22%2C%22setProfile%22%3A%22setProfile%22%7D%2C%22width%22%3A%20480%2C%22height%22%3A%20960%7D&extra_data=web3.meta.set-helloworld&begin=0&len=100
        //http://ec2-52-81-96-59.cn-north-1.compute.amazonaws.com.cn:61000/node.lauo.valuetest/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file272eH1bg8Rtj&token_y=valuetest_file272eH1bg8Rtj&opcode=web3.meta.call&opval=%7B%22method%22%3A%22setProfile%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%91%E6%A5%9A%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
        //http://ec2-52-81-96-59.cn-north-1.compute.amazonaws.com.cn:61000/node.lauo.valuetest/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file272eH1bg8Rtj&token_y=valuetest_file272eH1bg8Rtj&opcode=web3.meta.call&opval=%7B%22method%22%3A%22screenshot%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%91%E6%A5%9A%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
        else if(opcode == this.fsm_config.OP_WEB3_META_CALL && !set_call)
        {
            req.params = !req.params ? {}:req.params
            req.params.token = token_y
            req.params.next = true;
            let superRet =  await this.meta_c.callMetaFunction(req,res);
            return superRet;
        }else if(opcode==this.fsm_config.OP_WEB3_POP)//每次均清空旧的context（global的除外）---设置global-context貌似权限有问题哈。
        {
            console.log('OP_WEB3_POP-opval:'+opval)
            let opJSON = JSON.parse(opval)
            let {token_key,poplang,context} = await this.pop_query_token_key(token_x,true)
            if(token_key)
            {
                let ret =await poplang.opbatch(context,opJSON.pop_lines,!opJSON.async)
                console.log('web3.pop-ret:'+JSON.stringify(ret))
                res.rpc_func_ret = {ret:ret.ret,msg:this.fsm_config.OP_WEB3_POP,result:ret.results,popmsg:ret.msg}//,context}
            }else{
                res.rpc_func_ret = {ret:false,msg:'token_key create failed!'}
            }
        }else if(opcode==this.fsm_config.OP_WEB3_POP_CALL)
        {
            let {token_key,poplang,context,first_time,pre_init_ret} = await this.pop_query_token_key(token_x)
            if(token_key){
                let ret = await poplang.op(context,opval)
                console.log('pop.call-ret:'+JSON.stringify(ret))
                res.rpc_func_ret = {ret:true,msg:this.fsm_config.OP_WEB3_POP_CALL,result:ret,pre_init_ret}
            }else{
                res.rpc_func_ret = {ret:false,msg:'token_key create failed!'}
            }
        }
        else if(opcode==this.fsm_config.OP_WEB3_POP_ONCE)//执行一次批处理，但不会清空旧的context
        {
            let opJSON = JSON.parse(opval)
            let {token_key,poplang,context,first_time,pre_init_ret} = await this.pop_query_token_key(token_x)
            if(token_key){
                let ret = await poplang.opbatch(context,opJSON.pop_lines,!opJSON.async)
                res.rpc_func_ret = {ret:ret.ret,msg:this.fsm_config.OP_WEB3_POP_ONCE,
                    result:ret.results,popmsg:ret.msg,pre_init_ret}
                console.log('pop.once-results:'+JSON.stringify(ret))
            }else{
                res.rpc_func_ret = {ret:false,msg:'token_key create failed!'}
            }
        }
        else if(opcode==this.fsm_config.OP_WEB3_POP_SCRIPT)//执行一次批处理，但不会清空旧的context
        {
            let opJSON = JSON.parse(opval)
            let {token_key,poplang,context,first_time,pre_init_ret} = await this.pop_query_token_key(token_x)
            // console.log('script-opval:'+opval)
            if(token_key){
                let ret = await poplang.runScript(context,opJSON.script,!opJSON.async)
                res.rpc_func_ret = {ret:ret.ret, msg:this.fsm_config.OP_WEB3_POP_SCRIPT,
                        result:ret.results,popmsg:ret.msg,pre_init_ret} ;//{ret:ret.ret,msg:'pop.opbatch.script',result:ret,context}
                console.log('pop.script-results:'+JSON.stringify(ret))
            }else{
                res.rpc_func_ret = {ret:false,msg:'token_key create failed!'}
            }
        }else if (opcode==this.fsm_config.OP_WEB3_POP_NODE_FUNC)
        {
            console.log('is_dnalink_node_manager:'+res.is_dnalink_node_manager+' opval:'+opval)
            if(res.is_dnalink_node_manager)
            {
                let This = this
                if(!this.poplang){
                    this.poplang = new PopRuntime({},true,true)//这里是否使用安全模式值得考虑的。
                    this.poplang.setProtocol(this.protocol)//直接使用本协议
                }
                this.web3_node_funcs_map.set(opval,async function(req,res){
                    console.log('call web3-rpc-path:'+opval)
                    if(!This.poplang.is_call_inited)
                    {
                        let popInfo =await This.rpc_api_util.s_query_token_info('',token_x,This.fsm_config.OP_WEB3_POP)
                        console.log('web3-rpc-path-popInfo:'+JSON.stringify(popInfo))
                        let runOk = popInfo ? await This.poplang.opbatch(null,popInfo.pop_lines,!popInfo.async):null
                        console.log('web3-rpc-path-runOk:'+JSON.stringify(runOk))
                        This.poplang.is_call_inited = true
                    }
                    let ctx = str_filter.get_req_data(req)
                    ctx.node_func_res = res
                    let ret = await This.poplang.op(ctx,'~'+opval)//这里通过rpc_res.json可以直接返回结果
                    try{
                        delete ctx.node_func_res
                        delete ctx.$ret//这里有进行原型污染的可能性---正确的清理对应的ctx参数，可以有效的进行results结果收集
                        res.json({ret:false,msg:'~'+opval+' run failed',ctx})
                    }catch(ex){console.log('node_func-call-ex:'+ex)}
                })
                //存到调用纪录列表中。
            }else{
                return res.json({ret:false,msg:'need node-manager pm'})
            }
        }
        //[2]以下是正常流程。
        //生成交易纪录---txid生成，签名生成等。
        //let param = {token_x:token_x , token_y:token_y, opcode:opcode,opval:opval,extra_data:extra_data};
        //2022-11-10当是node-manager时，使用token-root的private_key进行所有的txinfo签名（为了追踪签名者信息）
        if(res.is_dnalink_node_manager){
            res.token_access_wallet = await this.engine.wallet_m.queryTokenKeys(this.root_config.TOKEN_ROOT)
            console.log('is_dnalink_node_manager-token_access_wallet:'+JSON.stringify(res.token_access_wallet))
        } 
        // if(opcode == this.fsm_config.OP_FORK)//2022-11-10仅当fork时，使用当前token_x的wallet，除非是---不特殊处理（因为要追踪token-fork的原由--使用token.key和access_key也会被追踪到；并且最重要的，支持web3_sign模式）
        // {
        //     // delete res.token_access_wallet
        //     //console.log('is-fork-opcode-token_access_wallet:'+JSON.stringify(res.token_access_wallet))
        // }
        let txinfo = web3_sign ? {txid,sign:web3_sign,hash:res.web3_hash,timestamp_i,token_x,token_y,opcode,opval,extra_data,ret:true,msg:'success'}: 
                                await this.engine.newSignedTxUnsafe(token_x,token_y,opcode,opval,extra_data,0,res)//await rpc_http_api.rpc_query(wallet_api.getApiUrl(wallet_api.api_new_signed_tx_unsafe),param);
        if(!txinfo || !txinfo.ret){
            if(res.private_key) this.wallet_m.delToken(res.tokenInfo.token)
            //fix the bug 2023-3-29 避免被恶意攻击（非权限订阅数据）
            if(opcode.indexOf(this.fsm_config.OP_WEBSOCKET)==0) delete res.rpc_func_ret
            return res.json({ret:false,msg:'new_signed_tx_unsafe failed! msg:'+(txinfo?txinfo.msg:"wallet_api connected failed!"),rpc_func_ret:res.rpc_func_ret})
        }
        console.log('opval:'+opval)
        let iNum = await  this.chain_m.save_tx(txinfo) //rpc_http_api.rpc_query(tx_api.getApiUrl(tx_api.api_save_tx),txinfo);

        if(iNum<=0){
            if(res.private_key) this.wallet_m.delToken(res.tokenInfo.token)
            //fix the bug,save tx failed,but ret the rpc_func_ret(access_token, websocket以及token_key泄露)
            if(opcode==this.fsm_config.OP_SMS) return res.json({ret:false,msg:"save tx failed!",rpc_func_ret:res.rpc_func_ret})
            else return res.json({ret:false,msg:"save tx failed!"});
        }

        let txjson = this.tx_util.toTXJSONString(txinfo);
        txjson = JSON.parse(txjson)
        txjson.hash = txinfo.hash;
        txjson.sign = txinfo.sign;
        let commitRet = await this.engine.s_commitTXToTXWriteWaitQueue(txinfo.txid, JSON.stringify(txjson))
        console.log('commitRet:'+JSON.stringify(commitRet));
        if(!commitRet || !commitRet.ret)  return res.json(commitRet);// res.json({ret:false,msg:"commit tx failed!"})

        let OP_FORK = this.fsm_config.OP_FORK
        let This = this
        let makeRet = await this.engine.s_makeTXLisenter(txinfo.txid,async function(results){
            console.log('op-results:'+JSON.stringify(results))
            results.rpc_func_ret = res.rpc_func_ret
            if(opcode == OP_FORK && results.x_state)
            {
                results.x_state.private_key = res.private_key
                //console.log('xstate-public-key:'+ (await This.engine.queryTokenState(token_x)).public_key)
                //fix the bug, 使用web3_sign（不使用appid-secret_key和token-key、access-key情况下，无门槛fork）
               // if(res.web3_public_key && !results.x_state.public_key) results.x_state.public_key  = res.web3_public_key
            } 
            console.log('res.func_ret:'+JSON.stringify(res.rpc_func_ret))
            if(res.private_key && results && !results.ret) This.wallet_m.delToken(res.tokenInfo.token)
            if(results && results.ret)
            {
                //进行结果回调处理
                This.processRPCReaction(req,res,{token_x,
                    token_y,opcode,opval,extra_data,web3_sign},function(ret){
                        if(ret) results.rpc_reaction_ret = ret
                        res.json(results)
                    })
            }
            else
            res.json(results)
        })
        console.log("s_makeTXLisenter - makeRet:"+makeRet)
        if(!makeRet) res.json({ret:false,msg:'make tx-writer callback-lisenter failed!',rpc_func_ret:res.rpc_func_ret});

        //调用tx-writer写。
        await this.engine.s_processTXWriteQueue();
    }

    async pop_query_token_key(token_x,isclear = false)
    {
        let token_key = this.pop_cur_context[token_x] ? this.pop_cur_context[token_x].token_key:null
        if(isclear || !this.pop_cur_context[token_x]) {
            delete this.pop_cur_context[token_x]
            this.pop_cur_context[token_x] = {first_time:true,token_key,poplang:new PopRuntime(null,true),context:{}};//{token_key:'notset',contesxt:{}}
            let t_protocol = Object.assign({},this.protocol)
            t_protocol.root_config = Object.assign({},this.protocol.root_config)
            delete t_protocol.root_config.appids //使用token_key
            delete t_protocol.root_config.secret_keys //使用token_key
            this.pop_cur_context[token_x].poplang.setProtocol(t_protocol)//this.protocol)
        }else{
            this.pop_cur_context[token_x].first_time =false;
        } 
        if(!token_key)//仅仅token_key不删除。
        {
            let params = {token_x,token_y:token_x,opcode:this.fsm_config.OP_TOKEN_ACCESS,opval:60*60*24*10000}//1万天超时
            let tokenRet = await this.rpc_api_util.rpc_query('/op',params)
            console.log('tokenKeyRet:'+JSON.stringify(tokenRet))
            if(typeof tokenRet.rpc_func_ret =='string')
                tokenRet.rpc_func_ret = tokenRet.rpc_func_ret ? JSON.parse(tokenRet.rpc_func_ret):null
            if(tokenRet.ret && tokenRet.rpc_func_ret && tokenRet.rpc_func_ret.ret)
                token_key = this.pop_cur_context[token_x].token_key = tokenRet.rpc_func_ret.token_key;
            else token_key = null;
        }
        
        let context = this.pop_cur_context[token_x];// opJSON.context_type == 'global' ? globalThis.pop_global_context : globalThis.pop_cur_context
        //将poplang变量的token_key直接设置，以便为了避免context输出泄露token_key
        context.poplang.token_key = token_key
        console.log('pop_query_token_key-context:'+context+' y:'+this.pop_cur_context[token_x])
        console.log('pop_query_token_key-context.first_time:'+context.first_time+' isclear:'+isclear)

        context.pre_init_ret =null;
        if(context.first_time && !isclear)//不是web3.pop代码
        {
            let popInfo =await this.rpc_api_util.s_query_token_info('',token_x,OP_WEB3_POP)
            console.log('popcall-popInfo:'+JSON.stringify(popInfo))
            context.pre_init_ret = popInfo? await context.poplang.opbatch(context.context,popInfo.pop_lines,!popInfo.async):null
            console.log('pre_init_ret:'+JSON.stringify(context.pre_init_ret))
        }

        return this.pop_cur_context[token_x]
    }

    /**
     * 查询一个token的链
     * @type {query_chain}
     */
    async query_chain(req, res) {
        let {token,begin,len} = str_filter.get_req_data(req, res);
        if(begin!=begin*1 ) return res.json({ret:false,msg:'begin format error'})
        if(len!=len*1 ) return res.json({ret:false,msg:'len format error'})

        let rows = await this.chain_m.queryChain(token, begin, len)

        var json_msg = {};
        if (rows && rows instanceof Array && rows.length > 0) {
            json_msg['ret'] = true;
            json_msg['msg'] = "ok";
            json_msg['list']= rows;
        }else{
            json_msg['ret'] = false;
            json_msg['msg'] = token?  "token unexists in the chain" : "token chain is empty";
        }

        res.json(json_msg);
    }

    async  query_tx_bychain(req, res) {
        let {token,txid} = str_filter.get_req_data(req, res);

        if(!token || !this.token_util.validateTokenID(token))
            return {ret:false,msg:"token format error"}

        if(!txid || !this.tx_util.validateTXID(txid))
            return {ret:false,msg:"txid format error"}


        let row = await this.chain_m.queryTXByChain(token, txid)

        var json_msg = {};
        if (row ) {
            row.ret = true;
            row.msg = "success"
            return res.json(row);
        }else{
            json_msg['ret'] = false;
            json_msg['msg'] = "token-tx unexists in the chain";
            return res.json(json_msg);
        }
    }

    /**
     * @type {query_parent_token}
     */
    async query_token_parent(req, res) {
        let {token} = str_filter.get_req_data(req, res);


        if(this.TOKEN_ROOT == token){
            let list = "[]"
            return res.json({ret:true,msg:"success",list:list})//返回一个空数组。
        }

        let row = await this.chain_m.queryTokenParentRow(token)
        console.log("query_token_parent-row:"+JSON.stringify(row))
        //得到parent结点。
        //return res.json({ret:true,list:""+row,msg:"success"});

        if(row&&row.token==token){
            txjson = JSON.parse(row.txjson);
            return res.json({ret:true,list:""+txjson.token_state,msg:"success!"});
        }else{
            let json_msg = {}
            json_msg['ret'] = false;
            json_msg['msg'] = "token not in the chain";
            return res.json(json_msg);;
        }
    }

    /**
     * 得到最新的token-info
     * @type {query_token_chain_last}
     */
    async query_token_chain_last(req, res) {
        let {token} = str_filter.get_req_data(req, res);
        let row = await this.chain_m.queryTokenChainLast(token)

        //得到parent结点。
        if(row && row.token==token)
        {
            row.ret = true;
            return res.json(row);
        }else{
            let json_msg = {}
            json_msg['ret'] = false;
            json_msg['msg'] = "token not in the chain";
            return res.json(json_msg);;
        }
    }


    /**
     * 得到最新的token-states
     * @type {query_token_chain_last}
     */
    async query_token_states(req, res) {
        let {token} = str_filter.get_req_data(req, res);

        if(!token || !this.token_util.validateTokenID(token))
            return {ret:false,msg:"token format is error!"}

        let row = await this.chain_m.queryTokenStates(token)

        row.ret = true;
        row.msg = "success"

        console.log("query_token_states-row:"+JSON.stringify(row))
        return res.json(row);
    }

    /**
     * 将tx写入到token-chain数据库
     * @type {save_token_tx}
     * async function save_tx2token_chain(token,height,txid,txjson,hash,sign,
     token_relate,opcode,opval,token_state,token_height)
    */
    async save_tx2token_chain(req, res) {

        let req_data = str_filter.get_req_data(req, res);
        console.log("save_tx2token_chain - save_tx2token_chain-req-data:"+JSON.stringify(req_data));

        let {token,height,txid,txjson,hash,sign,token_relate} = req_data
        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format error!"});

        if(!token_relate || !this.token_util.validateTokenID(token_relate))
            return res.json({ret:false,msg:"token_relate format error!"});

        if(!txid || !this.tx_util.validateTXID(txid))
            return res.json({ret:false,msg:"txid format error!"});

        if(!hash || !sign)
            return res.json({ret:true,msg:"hash or sign format error!"});

        let row = await this.chain_m.saveTX2TokenChain(token,height,txid,txjson,hash,sign,token_relate);

        if(row>0){
            return res.json({ret: true, msg: "success!"});
        }else{
            let json_msg = {}
            json_msg['ret'] = false;
            json_msg['msg'] = "save tx to token-chain failed ! ";//ret0:"+JSON.stringify(ret0);
            return res.json(json_msg);;
        }
    }


    /**
     * 由txid查询token-chain的同步情况
     * @type {query_token_chain_bytxid}
     *
     * http://127.0.0.1:88/chain/query_token_chain_bytxid?txid=txid_N7qZ1drVYW69Pjav
     */
    async query_token_chain_bytxid(req, res) {
        let {txid} = str_filter.get_req_data(req, res);

        if(!txid || !this.tx_util.validateTXID(txid))
            return res.json({ret:false,msg:"txid format is error!"})

        let rows = await this.chain_m.queryTokenChainByTXID(txid)

        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }

        return res.json({ret:false,msg:"txid{"+txid+"} do not in token-chain"})
    }

    /**
     * 由token查询在token-chain的情况（倒序排列）
     * @type {query_token_chain_bytoken}
     *
     * http://127.0.0.1:88/chain/query_token_chain_bytoken?token=token_0000000000000000&begin=0&len=10
     *
     */
    async query_token_chain_bytoken(req, res) {
        let {token,begin,len} = str_filter.get_req_data(req, res);

        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})

        begin = parseInt(begin)
        len = parseInt(len)
        if(!(0+begin+len == 0+(begin+len)))
            return res.json({ret:false,msg:"begin{"+begin+"} or len{"+len+"} format is error!"})

        let rows = await this.chain_m.queryTokenChainByToken(token,begin,len);

        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }

        return res.json({ret:false,msg:"token{"+token+"} do not in token-chain"})
    }

    /**
     * 查流水帐（特殊操作，如opcode=fork为分叉操作）
     * @type {query_token_chain_bytoken_opcode}
     *
     * 以下为得到流水帐：token_N7vZWiT6qc6ojtFf
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_N7vZWiT6qc6ojtFf&begin=20&len=10&opcode=send
     *
     * 以下为得到父亲结点：
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_N7vZWiT6qc6ojtFf&begin=0&len=10&opcode=fork
     *
     * 由token_0000000000000000分叉的清单
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_0000000000000000&begin=0&len=10&opcode=fork
     *
     *
     * 加上了密钥信息，否则无法访问。
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_0000000000000000&begin=0&len=10&opcode=fork&appid=1001&secret_key=UcjtndeD
     *
     */
    async query_token_chain_bytoken_opcode(req, res) {
        let {token,begin,len,opcode} = str_filter.get_req_data(req, res);

        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})

        begin = parseInt(begin)
        len = parseInt(len)
        if(!(0+begin+len == 0+(begin+len)))
            return res.json({ret:false,msg:"begin{"+begin+"} or len{"+len+"} format is error!"})

        if(!opcode || !this.tx_util.validateOPCODE(opcode))
            return res.json({ret:false,msg:"opcode{"+opcode+"}  format is error!"})

        let rows = await this.chain_m.queryTokenChainByTokenAndOpcode(token,begin,len,opcode);

        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }

        return res.json({ret:false,msg:"result-list is empty"})
    }

    /**
     * 查询token关系
     * @type {query_token_relations}
     */
    async query_token_relations(req, res) {
        let {token,begin,len,opcode,isx} = str_filter.get_req_data(req, res);

        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})

        begin = parseInt(begin)
        len = parseInt(len)
        if(!(0+begin+len == 0+(begin+len)))
            return res.json({ret:false,msg:"begin{"+begin+"} or len{"+len+"} format is error!"})

        if(!opcode || !this.tx_util.validateOPCODE(opcode))
            return res.json({ret:false,msg:"opcode{"+opcode+"}  format is error!"})

        isx = isx=='false'||isx==0||isx=='0' ? false:true
        let rows = await this.chain_m.queryTokenRelations(token,opcode,isx,begin,len);

        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }

        return res.json({ret:false,msg:"token-relations is empty"})
    }

    /**
     * 判断两个token是否有关系
     * @type {check_token_relations}
     */
    async check_token_relations(req, res) {
        let {token_x,token_y,opcode} = str_filter.get_req_data(req, res);

        if(!token_x || !this.token_util.validateTokenID(token_x))
            return res.json({ret:false,msg:"token_x format is error!"})

        if(!token_y || !this.token_util.validateTokenID(token_y))
            return res.json({ret:false,msg:"token_y format is error!"})

        if(!opcode || !this.tx_util.validateOPCODE(opcode))
            return res.json({ret:false,msg:"opcode{"+opcode+"}  format is error!"})


        let row = await this.chain_m.checkTokenRelations(token_x,token_y,opcode)

        if(row)
        {
            row.ret = true;
            row.msg ='success';
            return res.json(row);
        }


        return res.json({ret:false,msg:"unexists"})
    }


    /**
     * 查询所有token的映射key-values
     * @type {query_token_map_key_values}
     * http://127.0.0.1:59868/chain/map/values?appid=10001&secret_key=d9a45326b6f1a5aefef8d199b580fad1&opcode=map&token=tns_0000000000000000&begin=0&len=100
     */
    async query_token_map_key_values(req, res) {
        let {token,begin,len} = str_filter.get_req_data(req, res);
    
        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})
    
        begin = parseInt(begin)
        len = parseInt(len)
        if(!(0+begin+len == 0+(begin+len)))
            return res.json({ret:false,msg:"begin{"+begin+"} or len{"+len+"} format is error!"})

        let rows = await this.chain_m.queryTokenMapKeyValues(token,begin,len);
    
        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }
    
        return res.json({ret:false,msg:"token-maps is empty"})
    }

    /**
     * 查询所有token的映射keys
     * @type {query_token_map_keys}
     * http://127.0.0.1:59868/chain/map/keys?appid=10001&secret_key=d9a45326b6f1a5aefef8d199b580fad1&opcode=map&token=tns_0000000000000000&begin=0&len=100
     */
    async query_token_map_keys(req, res) {
        let {token,begin,len} = str_filter.get_req_data(req, res);
    
        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})
    
        begin = parseInt(begin)
        len = parseInt(len)
        if(!(0+begin+len == 0+(begin+len)))
            return res.json({ret:false,msg:"begin{"+begin+"} or len{"+len+"} format is error!"})
    
        let rows = await this.chain_m.queryTokenMapKeys(token,begin,len);
    
        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }
    
        return res.json({ret:false,msg:"token-maps is empty"})
    }


    /**
     * 查询所有token的map_value
     * @type {query_token_map_value}
     * http://127.0.0.1:59868/chain/map/value?appid=10001&secret_key=d9a45326b6f1a5aefef8d199b580fad1&opcode=map&token=tns_0000000000000000&map_key=www.dtns.cn
     */
    async query_token_map_value(req, res) {
        let {token,map_key} = str_filter.get_req_data(req, res);
    
        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})

        if(!map_key)
            return res.json({ret:false,msg:"map_key format is error!"})

        let row = await this.chain_m.queryTokenMapValue(token,map_key);
    
        if(row)
        {
            row.ret = true
            row.msg = 'success'
            return res.json(row)
        }
    
        return res.json({ret:false,msg:"map_value is empty"})
    }

    /**
     * 查流水帐（特殊操作，如opcode=fork为分叉操作）
     * @type {query_token_chain_bytoken_opcode}
     *
     * 以下为得到流水帐：token_N7vZWiT6qc6ojtFf
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_N7vZWiT6qc6ojtFf&begin=20&len=10&opcode=send
     *
     * 以下为得到父亲结点：
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_N7vZWiT6qc6ojtFf&begin=0&len=10&opcode=fork
     *
     * 由token_0000000000000000分叉的清单
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_0000000000000000&begin=0&len=10&opcode=fork
     *
     *
     * 加上了密钥信息，否则无法访问。
     * http://127.0.0.1:88/chain/query_token_chain_bytoken_opcode?token=token_0000000000000000&begin=0&len=10&opcode=fork&appid=1001&secret_key=UcjtndeD
     *
     */
    async query_token_chain_bytoken_opcode(req, res) {
        let {token,begin,len,opcode} = str_filter.get_req_data(req, res);
    
        if(!token || !this.token_util.validateTokenID(token))
            return res.json({ret:false,msg:"token format is error!"})
    
        begin = parseInt(begin)
        len = parseInt(len)
        if(!(0+begin+len == 0+(begin+len)))
            return res.json({ret:false,msg:"begin{"+begin+"} or len{"+len+"} format is error!"})
    
        if(!opcode || !this.tx_util.validateOPCODE(opcode))
            return res.json({ret:false,msg:"opcode{"+opcode+"}  format is error!"})
    
        let rows = await this.chain_m.queryTokenChainByTokenAndOpcode(token,begin,len,opcode);
    
        if(rows && rows.length>0)
        {
            return res.json({ret:true,msg:"success",list:rows})
        }
    
        return res.json({ret:false,msg:"result-list is empty"})
    }

    //一个过滤器
    async common_interceptor(req, res, next) {
        //后续可利用该封装来处理多国语言的返回值.
        if(false){
            res.oldjson = res.json
            res.json = function(obj)
            {
                //console.log('parse-res-json:'+JSON.stringify(obj))
                if(typeof obj.msg !='undefined'){
                    switch(obj.msg){
                        case'appid or secret_key format error!':obj.msg='应用id或者密钥错误';break
                        default:break;
                    }
                } 
                res.oldjson(obj)
            }
        }

        if(this.appids.length<=0)
        {
            return next();
        }
    
        let req_data = str_filter.get_req_data(req);
        let { appid,secret_key,access_key,opcode,token_key,txid,token_x,token_y,token,
            opval,extra_data,web3_sign,timestamp_i} = req_data;
    
        let url = req.url.indexOf('?')>0 ? req.url.substring(0, req.url.indexOf('?')):req.url;
        //url = !url ?req.url :url;
        console.log("http-call("+url+") params:\tappid:"+appid+",secret_key:"+secret_key+" req-data:"+JSON.stringify(req_data))
    
        //【注意】
        if(url.indexOf('/super/websocket/link')==0)
            return next();

        if(url.indexOf('/node')==0)
            return next();

        //2023-12-1新增，为了支持ib3-qw的SDK收款通道
        if(url.indexOf('/forklist')==0)
            return next();
    
        //先加载参数
        if(this.GLOBAL_ACCESS_CHAIN_OPEN == this.NOTLOAD_FLAG)
        {
            // console.log('into NOTLOAD_FLAG:'+this.NOTLOAD_FLAG +'\tGLOBAL_ACCESS_CHAIN_OPEN:'+this.GLOBAL_ACCESS_CHAIN_OPEN)
            let retJson = await this.chain_m.queryTokenByOpcode(this.TOKEN_ROOT,this.fsm_config.OP_ACCESS_CHAIN_OPEN);
            if(retJson) this.GLOBAL_ACCESS_CHAIN_OPEN  = (JSON.parse(retJson.txjson)).opval
        }
        if(this.GLOBAL_WEBSOCKET_WRITE_MAP.flag == this.NOTLOAD_FLAG)
        {
            if(!this.init_global_websocket_map_flag) {
                this.query_websocket_write_map();
                this.init_global_websocket_map_flag = true
            }
        }
    
    
        if(url.indexOf('/chain')==0 && ( this.g_chain_open_access || this.GLOBAL_ACCESS_CHAIN_OPEN==this.fsm_config.OP_ACCESS_CHAIN_OPEN)) return next();
    
        //fork请求调用时---判断opval是否为web3.token.open，如果，将允许访问，否则按appid和secret_key来判断
        if((opcode==this.fsm_config.OP_FORK || url.indexOf( '/fork')==0) && opval ==this.fsm_config.OP_WEB3_TOKEN_OPEN)
        {
            //http://127.0.0.1:60000/fork?token_key1=tkacc2dd1b994ef98e133bd547927824c4168e82c880a799ff2f41271cda5c321f5ab&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=&token=valuetest_24hs9nV2XajdEc7F&token_y=valuetest_0000000&begin=0&len=1000000000&opcode=fork&opval=web3.token.open&extra_data=wslisten-helloworld
            let opvalRet = await this.rpc_api_util.s_query_token_info('',token,this.fsm_config.OP_WEB3_TOKEN_OPEN)
            if(opvalRet && opvalRet==this.fsm_config.OP_WEB3_TOKEN_OPEN) return next();
        }
        if(access_key)
        {
            res.is_dnalink_node_manager = true
            let acc_opcode = await this.kvdb.get(access_key)
            console.log('access_key:'+access_key+' query-redis-opcode:'+acc_opcode)
            if(acc_opcode){
                if(acc_opcode == this.fsm_config.OP_ACCESS_CHAIN && url.indexOf('/chain')==0) return next();
                if(acc_opcode == this.fsm_config.OP_ACCESS_SUPER && url.indexOf('/super')==0) return next();
                //acc_opcode == OP_ACCESS_ALL 除了access.*指令不能二级授权（包含清理授权access_key），其他都可以做。
                //if(acc_opcode == this.fsm_config.OP_ACCESS_ALL && opcode.indexOf(this.fsm_config.OP_ACCESS)!=0) return next();
                if(acc_opcode.indexOf('{')==0)//OP_ACCESS_ALL
                {
                    let acc_token_wallet_info = null;
                    try{
                        acc_token_wallet_info = JSON.parse(acc_opcode)
                    }catch(ex){console.log('access_key_token_wallet_info parese exception',ex);}
                    if(!acc_token_wallet_info) return res.json({ret:false,msg:'pm-wallet-info unexists'})
                    res.token_access_wallet = acc_token_wallet_info //2022-11-9将使用该授权了的token-wallet-info进行相应签名（以便追踪纪录）
                    delete res.is_dnalink_node_manager
                    return next();
                }
                //不管成功失败与否，只能访问一次。
                if(acc_opcode.indexOf(this.fsm_config.OP_ACCESS_ONCE)==0 &&acc_opcode.split(':')[1] == url){
                    if(acc_opcode.split(':')[2] && opcode!=acc_opcode.split(':')[2]) return res.json({ret:false,msg:"access_key ok but once visit opcode-api failed"}) 
                    let delRet = await this.kvdb.del(access_key)
                    console.log('aceess_once-delRet:'+delRet)
                    if(delRet ) return next()
                    else return res.json({ret:false,msg:"access_key ok but once-count failed"})
                } else return res.json({ret:false,msg:"access_key ok but url unmatch"})
            } 
            //2022-11-9 可以继续判断appid-secret_key等。
            if(!appid)
            return res.json({ret:false,msg:"access_key error or have no pm"})
        }
        //http://127.0.0.1:60000/chain/token?token_key=tkacc000d510b41bfe1d912b39f4c904b6d23b573ef89ab4dfa53bac857c8353abb39&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=accf8ea53fa1964bb8aa810b045ed13a85277ae8ff9520d2b132ea4a181e50419d4&token=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_0000000&begin=0&len=1000000000&opcode=websocket&opval=50&extra_data=wslisten-helloworld
        //http://127.0.0.1:60000/chain/opcode?token_key=tkacc000d510b41bfe1d912b39f4c904b6d23b573ef89ab4dfa53bac857c8353abb39&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=accf8ea53fa1964bb8aa810b045ed13a85277ae8ff9520d2b132ea4a181e50419d4&token=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_0000000&begin=0&len=1000000000&opcode=fork&opval=50&extra_data=wslisten-helloworld
        if(token && (url.indexOf( '/fork')==0|| url.indexOf('/chain')==0) || url.indexOf('/chain/file/')==0)//fix the bug by token_key
        {
            if(url.indexOf('/chain/file/')==0){
                let urls = url.split('/')
                let tmpToken = urls[urls.length-1];
                if(this.token_util.validateTokenID(tmpToken))token = tmpToken;
                else token = null
            }
            token_x = token 
            token_y = token 
        }
        if(token_key && token_x && token_y)//权限token域权限进行访问接口（不论是/chain还是op接口，当然/super接口不支持
        {
            opcode = !opcode ? '':opcode
            if(url.indexOf('/chain/txid')==0 || url.indexOf('/chain/query')==0) return res.json({ret:false,msg:"token_key error or have no pm"})
            if(url.indexOf('/super')==0)  return res.json({ret:false,msg:"have no pm to visit super-interface-api"})
            //不能使用更高级的access.*接口
            if(opcode.indexOf(this.fsm_config.OP_ACCESS)==0) return res.json({ret:false,msg:"have no pm to use access.*(opcode api)"})
            //不能二级授权生成新的token.key（避免无限生成新的token.key扰乱了安全性；但是可以自身清理自身）
            if(opcode==this.fsm_config.OP_TOKEN_ACCESS) return res.json({ret:false,msg:"have no pm to use token.key(opcode api)"})
            //这时不能使用更高级的web3.key修改密钥接口
            if(opcode==this.fsm_config.OP_WEB3_KEY) return res.json({ret:false,msg:"have no pm to use web3.key(opcode api)"})
            //如果不是清理自身权限，则不允许清理
            if(opcode==this.fsm_config.OP_TOKEN_BAN && token_key !=opval) return res.json({ret:false,msg:"have no pm to clear the token_key(opval error)"})
    
            let acc_token_wallet_info = await this.kvdb.get(token_key)
            try{
                acc_token_wallet_info = JSON.parse(acc_token_wallet_info)
            }catch(ex){console.log('acc_token_wallet_info parese exception',ex);acc_token_wallet_info = null;}

            let acc_token = acc_token_wallet_info ? acc_token_wallet_info.token_y :null //await this.kvdb.get(token_key)
            console.log('acc_token:'+acc_token)
            if(!this.token_util.validateTokenID(acc_token)) return res.json({ret:false,msg:"token_key-acc_token error or have no pm"}) 
            if(acc_token==this.fsm_config.TOKEN_ROOT || (acc_token==token_x && acc_token == token_y)) return next();
            
            let xState = await this.engine.queryTokenState(token_x)
            let yState = await this.engine.queryTokenState(token_y)
            console.log(this.TOKEN_ROOT+' '+token_x+' '+token_y+' acc_token:'+acc_token+' x-plist:'+xState.token_state_p+' y-plist:'+yState.token_state_p)
            console.log('acc_token:'+acc_token+' x-plist:'+xState.token_state_p+' y-plist:'+yState.token_state_p)
            
            //http://127.0.0.1:60000/op?token_key=tkaccd238f1103709f9d638bf09c8891793bf42bf25e4185f1c4f3f204cad08e7aab2&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=accf8ea53fa1964bb8aa810b045ed13a85277ae8ff9520d2b132ea4a181e50419d4&token_x=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_0000000000000000&opcode=access.all&opval=50&extra_data=wslisten-helloworld
            let xAccFlag = acc_token== token_x ||  (''+xState.token_state_p).indexOf(acc_token)>0 
            let yAccFlag = acc_token== token_y ||  (''+yState.token_state_p).indexOf(acc_token)>0
    
            res.token_access_wallet = acc_token_wallet_info
            if(xAccFlag && yAccFlag) return next();//除了有权限的特权，否则不允许再使用file等指令给token_y随便赋值
            if( (url.indexOf('/send')==0 || opcode==this.fsm_config.OP_SEND || opcode==this.fsm_config.OP_WEB3_META_CALL)  && xAccFlag) return next();
            //2022-11-9 可以继续判断appid-secret_key等
            if(!appid) return res.json({ret:false,msg:"token_key error or have no pm"})
            delete res.token_access_wallet //只有token_key有效的情况下，才保持该token_access_wallet用于标记sign等信息
        }else if(web3_sign)//使用private_key或者web3_key的私钥签名之后得到sign访问接口
        {
            if(url.indexOf('/chain/txid')==0 || url.indexOf('/chain/query')==0) return res.json({ret:false,msg:"token_key error or have no pm"})
            if(url.indexOf('/super')==0)  return res.json({ret:false,msg:"have no pm to visit super-interface-api"})
            //不能使用更高级的access.*接口
            if(opcode.indexOf(this.fsm_config.OP_ACCESS)==0) return res.json({ret:false,msg:"have no pm to use access.*(opcode api)"})
            if(opcode==this.fsm_config.OP_WEB3_KEY && extra_data!=web3_sign ) return res.json({ret:false,msg:"use api web3.key param error(web3_sign=extra_data)"})
            //
            let acc_token = token_x ;
            let xState = await this.engine.queryTokenState(token_x)
            let yState = await this.engine.queryTokenState(token_y)
            console.log(this.root_config.TOKEN_ROOT+' '+token_x+' '+token_y+' acc_token:'+acc_token+' x-plist:'+xState.token_state_p+' y-plist:'+yState.token_state_p)
            console.log('acc_token:'+acc_token+' x-plist:'+xState.token_state_p+' y-plist:'+yState.token_state_p)
            
            console.log('xState:'+JSON.stringify(xState))
            let TXINFO = {txid,token_x,token_y,opcode,opval,extra_data,timestamp_i}
            let TXJSON = this.tx_util.toTXJSONString(TXINFO);//序列化。
            console.log('TXJSON:'+TXJSON)
            let hash = await key_util.hashVal(TXJSON);//得到hash值
            res.web3_hash = hash

            let public_key = null
            if(opcode!=this.fsm_config.OP_FORK)//仅当fork时，特殊处理
            {
                public_key = xState ? (xState.web3_key ? xState.web3_key:xState.public_key):null;
                if(!public_key)
                {
                    this.wallet_m.clearTokenCache()
                }
            }else{//equal OP_FORK
                if(token_x && token_x != token_y && opval !='opval') //2022-11-10 当是新创建op-fork，且无token-root的private-key，使用新的token_x(new-token-id)的private_key得到web3_sign
                {   
                    public_key = opval;//2022-11-11因为浏览器端已经正确生成了对应的public_key //key_util.recoverPublickey(web3_sign,hash)
                }else{
                    public_key = yState ? (yState.web3_key ? yState.web3_key:yState.public_key):null;
                }
            }
            if(!public_key) return res.json({ret:false,msg:"token_x-public_key error or have no pm"})
            res.web3_public_key = public_key

            //进行校验
            let timestamp_now =await this.wallet_m.queryTimestamp()
            console.log('req_time:'+timestamp_i+' timestamp_now:'+timestamp_now)
            //timestamp控制在时间为10分钟内有效
            if(!timestamp_i || timestamp_now+5*60 <parseInt(timestamp_i) ||timestamp_now - parseInt(timestamp_i) >600) return res.json({ret:false,msg:"timestamp_i error or have no pm"})
    
            //这里是web_sign的签名算法
            //let txinfo = await wallet_c.s_new_signed_tx_unsafe(token_x,token_y,opcode,opval,extra_data)
            //:'web3_sign'
            
            let vflag = false;
            try{
                //签名算法和校验算法
                let sign =await key_util.signMsg(hash,'4bmmY1VEj8FjAVLGYhrt4AtvMisXRj2YDNNYHryjogPV');
                console.log('sign:'+sign+' public_key:'+public_key+' web3_sign:'+web3_sign+' hash:'+hash)
                //2023-3-11新增OP_HOLD的指令权限判断（只能是共同父签名才能拥有该权限）--否则会带来hold权限漏洞
                if(opcode==this.fsm_config.OP_HOLD )//签名须在共同父链中发出
                {
                    let xplist = [], yplist=[]
                    try{
                        xplist = JSON.parse(xState.token_state_p).reverse();xplist.push(token_x)
                        yplist = JSON.parse(yState.token_state_p).reverse();yplist.push(token_y)
                    }catch(ex){}
                    console.log('check-same-parents:'+JSON.stringify(xplist)+'---'+JSON.stringify(yplist))
                    for(let i=0;i<xplist.length && i<yplist.length;i++)
                    {
                        if(xplist[i] == yplist[i]){
                            let xParentState = await this.engine.queryTokenState(xplist[i])
                            public_key = xParentState ? (xParentState.web3_key ? xParentState.web3_key:xParentState.public_key):null;
                            vflag= await key_util.verifySignMsg(hash,web3_sign,public_key)
                            console.log('check-same-parent:'+i+' '+xplist[i]+' vflag:'+vflag)
                            if(vflag) break
                        }
                        else 
                            break
                    }
                    console.log('web3-hold-vflag:'+vflag)
                }
                else{
                    vflag= await key_util.verifySignMsg(hash,web3_sign,public_key)
                    if(vflag) req.web3_sign_token = token_x 
                    //2023-3-10（hold【归属权益域】的判断---仅做一层hold判断判断，不递归---没必要再深入上去）
                    //如验证不通过，则判断是否是【hold关系】的token-list-publie_key或web3-key
                    if(!vflag){
                        //对父链进行【权限域】判断
                        let parentTokens = []
                        try{
                            parentTokens = JSON.parse(xState.token_state_p).reverse()
                        }catch(ex){}
                        for(let i=0;i<parentTokens.length;i++){
                            let xParentState = await this.engine.queryTokenState(parentTokens[i])
                            public_key = xParentState ? (xParentState.web3_key ? xParentState.web3_key:xParentState.public_key):null;
                            vflag= await key_util.verifySignMsg(hash,web3_sign,public_key)
                            console.log('parentTokens:'+i+' '+parentTokens[i]+',vflag='+vflag)
                            if(vflag){
                                req.web3_sign_token = parentTokens[i]
                                break
                            } 
                        }
                        if(!vflag)
                        {
                            //查询hold的x-token对应的public-key，是否验证通过。
                            let listRet = await this.rpc_api_util.rpc_query('/chain/relations',{token:token_x,opcode:'hold',isx:false,begin:0,len:10000})
                            let list = !listRet ||!listRet.ret ? [] : listRet.list;
                            for(let i=0;i<list.length;i++){
                                let xHoldState = await this.engine.queryTokenState(list[i].token_x)
                                public_key = xHoldState ? (xHoldState.web3_key ? xHoldState.web3_key:xHoldState.public_key):null;
                                vflag= await key_util.verifySignMsg(hash,web3_sign,public_key)
                                console.log('hold-relations:'+i+' '+list[i].token_x+' hold token_x,vflag='+vflag)
                                if(vflag){
                                    req.web3_sign_token = list[i].token_x
                                    break
                                } 
                            }
                        }
                    }
                }
            }catch(ex)
            {
                console.log('verifySignMsg-exception:'+ex)
            }
            if(!vflag) return res.json({ret:false,msg:"token_x-web3_sign error or have no pm"})
            //通过web3_sign增加recid(在op_block中顶部新增，这里不再需要)
            //res.web3_hash = key_util.getHavedRecidSign(hash,web3_sign,public_key)
    
            //http://127.0.0.1:60000/op?token_key1=tkaccc6ddaff123acc302ee6a2e1b7acd7e7657bd20fc5796c0ceb99f9fc6e6d551c6&appid=&secret_key=bbdbffb24df77be206c820bbe06ae02c&acss_key=&token_x=valuetest_2wihzNDAb2Aa8arW&token_y=valuetest_2wihzNDAb2Aa8arW&begin=0&len=1000000000&&web3_sign=2rxtYJaJb6bFRXqCoeQ9TMdt3ybfYWwuXUb6QEwsCNEJzFgTcrNUNEZLxqB9E2dPqBBVZP4wTHRRW32heb1K25Sf&extra_data=2rxtYJaJb6bFRXqCoeQ9TMdt3ybfYWwuXUb6QEwsCNEJzFgTcrNUNEZLxqB9E2dPqBBVZP4wTHRRW32heb1K25Sf&opcode=token.key&opval=280000cubN1isDZq89zdPzq5sEP6uFg5XRtznpzYRdpFRt4Fw&req_time=1659670482
            //let xAccFlag =  (''+xState.token_state_p).indexOf(acc_token)>0 ----自身肯定有权限
            let yAccFlag = true//2023-3-10，web3_sign不再只是操作子链（关系链、send操作也可以--只要没有限定【数值权益域】）  (''+yState.token_state_p).indexOf(acc_token)>0 //操作子链
    
            //3种情况：1、token-y与token-x一致，因public_key是acc_token=token_x（已经做了签名校验）；2、yAccFlag代表了操作的token_y是在token_x的child-tokens中；3、无门槛fork：res.web3_public_key==opval 
            if(token_x == token_y || yAccFlag || res.web3_public_key==opval ) return next();//除了有权限的特权，否则不允许再使用file等指令给token_y随便赋值
            return res.json({ret:false,msg:"web3_sign error or have no pm"})
        }
    
        console.log("http-call("+url+") params:\tappid:"+appid+",secret_key:"+secret_key+" req-data:"+JSON.stringify(req_data))
    
        if(!appid || !secret_key)
            return res.json({ret:false,msg:"appid or secret_key format error!"})
    
        for(let i=0;i<this.appids.length;i++)
        {
            if(this.appids[i]==appid)
            {
                if(secret_key == this.secret_keys[i])
                {
                    res.is_dnalink_node_manager = true
                    return next();
                }else{
                    console.log("appid:"+this.appids[i]+",secret_key:"+this.secret_keys[i]);
                    return res.json({ret:false,msg:"appid{"+appid+"} , secret_key{"+secret_key+"}  error!"})
                }
            }
        }
    
        return res.json({ret:false,msg:"appid{"+appid+"} , secret_key{"+secret_key+"}  error!"})
    }

    async query_websocket_write_map()
    {
        let This = this
        let list = await this.rpc_api_util.s_query_token_list('',this.root_config.TOKEN_ROOT,this.fsm_config.OP_RELW,0,100000,false,async function(token_y){
            let opval =  await This.rpc_api_util.s_query_token_info('',token_y,This.fsm_config.OP_WEBSOCKET_TOKEN_WRITE);
            return {token_x:This.root_config.TOKEN_ROOT,token_y,opval}
        })
        console.log(this.fsm_config.OP_WEBSOCKET_TOKEN_WRITE+'websocket-write-token-list:'+JSON.stringify(list));
        this.GLOBAL_WEBSOCKET_WRITE_MAP = {flag:'loaded'}//更改为新的map
        for(let i =0;list && i<list.length;i++)
        {
            //刷新数据
           this.GLOBAL_WEBSOCKET_WRITE_MAP[list[i].token_y] = ""+list[i].opval;
        }
        return this.GLOBAL_WEBSOCKET_WRITE_MAP
    }
    
}

window.g_rpcReactionFilterMapAdd = rpcReactionFilterMapAdd
function rpcReactionFilterMapAdd(tax_extra_data)
{
    if(typeof g_rpcReactionFilterMap == 'undefined' ) window.g_rpcReactionFilterMap = new Map()
    if(!tax_extra_data) return false
    g_rpcReactionFilterMap.set(tax_extra_data,'ok')
    return true
}

window.DNALinkRPC = DNALinkRPC
// module.exports = DNALinkRPC