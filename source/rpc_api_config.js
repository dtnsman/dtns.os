/**
 * Created by poplang
 */
// const http_req = require('./libs/http_request')

//这里配置dtns.node的相关节点信息。
const APPID = '10001'
const SECRET_KEY = '0000'
const NODEID= 'forklist'

const USER_TOKEN_NAME = luser_config.root_config.TOKEN_NAME
const RMB_TOKEN_NAME = lrmb_config.root_config.TOKEN_NAME
const GSB_TOKEN_NAME = lgsb_config.root_config.TOKEN_NAME
const SCORE_TOKEN_NAME = lscore_config.root_config.TOKEN_NAME
const PCASH_TOKEN_NAME = 'pcash'
const VIP_TOKEN_NAME = lvip_config.root_config.TOKEN_NAME
// const ORDER_TOKEN_NAME = 'order'
// const MSG_TOKEN_NAME = 'msg'
// const OBJ_TOKEN_NAME = 'obj'
// const HT_TOKEN_NAME = 'ht'
// const SMS_TOKEN_NAME = 'sms'
// const MSGA_TOKEN_NAME = 'msga'
// const DTNS_TOKEN_NAME='dtns'

window.rpc_api_config={
    NODEID,

    //#1 用户模块-user
    RPC_API_BASE:'forklist.dtns',
    USER_API_BASE: 'http://127.0.0.1:'+luser_config.root_config.DOMAIN_PORT,
    USER_TOKEN_NAME: luser_config.root_config.TOKEN_NAME,
    USER_TOKEN_ROOT:luser_config.root_config.TOKEN_ROOT,

    //#2 内容和项目-事物模块-obj
    OBJ_API_BASE: 'http://127.0.0.1:'+lobj_config.root_config.DOMAIN_PORT,
    OBJ_TOKEN_NAME: lobj_config.root_config.TOKEN_NAME,
    OBJ_TOKEN_ROOT:lobj_config.root_config.TOKEN_ROOT,
 
    //#3 人民币模块-rmb
    RMB_API_BASE: 'http://127.0.0.1:'+lrmb_config.root_config.DOMAIN_PORT,
    RMB_TOKEN_NAME: lrmb_config.root_config.TOKEN_NAME,
    RMB_TOKEN_ROOT:lrmb_config.root_config.TOKEN_ROOT,

    //#4 订单模块-order
    ORDER_API_BASE: 'http://127.0.0.1:'+lorder_config.root_config.DOMAIN_PORT,
    ORDER_TOKEN_NAME: lorder_config.root_config.TOKEN_NAME,
    ORDER_TOKEN_ROOT:lorder_config.root_config.TOKEN_ROOT,


    GSB_API_BASE: 'http://127.0.0.1:'+lgsb_config.root_config.DOMAIN_PORT,
    GSB_TOKEN_NAME: lgsb_config.root_config.TOKEN_NAME,
    GSB_TOKEN_ROOT:lgsb_config.root_config.TOKEN_ROOT,

    //#4 经验值模块-score
    SCORE_API_BASE: 'http://127.0.0.1:'+lscore_config.root_config.DOMAIN_PORT,
    SCORE_TOKEN_NAME: lscore_config.root_config.TOKEN_NAME,
    SCORE_TOKEN_ROOT:lscore_config.root_config.TOKEN_ROOT,

    //#5 代金券模块-pcash
    PCASH_API_BASE: 'https://c3.dtns/node.'+NODEID+'.'+PCASH_TOKEN_NAME+':vvvvvvvvvvv',
    PCASH_TOKEN_NAME: PCASH_TOKEN_NAME,
    PCASH_TOKEN_ROOT:PCASH_TOKEN_NAME+"_0000000000000000",

    //#6 VIP模块-vip
    VIP_API_BASE: 'http://127.0.0.1:'+lvip_config.root_config.DOMAIN_PORT,
    VIP_TOKEN_NAME: lvip_config.root_config.TOKEN_NAME,
    VIP_TOKEN_ROOT:lvip_config.root_config.TOKEN_ROOT,

    //#8 消息模块-msg
    MSG_API_BASE: 'http://127.0.0.1:'+lmsg_config.root_config.DOMAIN_PORT,//'https://c6.forklist.dtns/node.'+NODEID+'.'+MSG_TOKEN_NAME,
    MSG_TOKEN_NAME: lmsg_config.root_config.TOKEN_NAME,
    MSG_TOKEN_ROOT:lmsg_config.root_config.TOKEN_ROOT,


    DTNS_API_BASE:'http://127.0.0.1:'+dtns_config.root_config.DOMAIN_PORT,// 'https://c6.forklist.dtns/node.'+NODEID+'.'+OBJ_TOKEN_NAME,
    DTNS_TOKEN_NAME: dtns_config.root_config.TOKEN_NAME,
    DTNS_TOKEN_ROOT:dtns_config.root_config.TOKEN_ROOT,
};

Object.assign(window,window.rpc_api_config)

// module.exports.getNodeUrl = getNodeUrl
function getNodeUrl(url)
{
    return url;
}
/**
 * 由重定义的类型得到dtns-redirecdt-name之命名
 * @param {} redirect_name 
 * @returns 
 */
function redirectName2DTNSName(redirect_name){
    switch(redirect_name){
        case RMB_TOKEN_NAME:return 'int'; //不使用rmb，而是使用积分
        case SCORE_TOKEN_NAME:return 'score'
        case GSB_TOKEN_NAME:return 'gsb'
        case VIP_TOKEN_NAME:return 'vip'
        return null
    }
}
async function forkDTNSIDByName(redirect_name,dtns_user_id)
{
    let is_web3app = typeof g_dtns_network_client!='undefined' && g_dtns_network_client
    let token = is_web3app ? dtns_root_keys.token :DTNS_TOKEN_ROOT      
    let timestamp_i = parseInt(Date.now()/1000)
    let prefix_str = rpc_client.roomid + '000'+redirectName2DTNSName(redirect_name)
    let token_x = dtns_config.root_config.TOKEN_NAME+'_'+ prefix_str +key_util.newPrivateKey().substring(0,
        dtns_config.root_config.TOKEN_ID_LENGTH - prefix_str.length)
    let TXINFO = {txid:sign_util.newTXID() ,token_x,token_y:token,
        opcode:'fork',opval:'opval',extra_data:dtns_user_id,timestamp_i}
    let TXJSON = sign_util.toTXJSONString(TXINFO);//序列化。
    console.log('forkDTNSIDByName-fork:TXJSON:'+TXJSON)
    let hash = await key_util.hashVal(TXJSON);//得到hash值
    let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
    if(is_web3app) TXINFO.web3_sign = sign
    let ret = is_web3app ?  await dtns_network_rtc_api.rpc_query('/op',TXINFO):await rpc_query(DTNS_API_BASE+'/op',TXINFO)
    console.log('forkDTNSIDByName-fork-ret:',ret)
    if(ret && ret.ret) return token_x
    else return null
}
async function setWeb3Key2tokenDtnsID(userInfo,token_dtns_id_name)
{
    if(!userInfo[token_dtns_id_name]) return {ret:false,msg:'token_dtns_id unexists'}
    let dtns_user_id = userInfo.dtns_user_id
    let dtnsUserStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:dtns_user_id})
    console.log('setWeb3Key2tokenDtnsID-dtnsUserStates',dtnsUserStates)
    if(!dtnsUserStates || !dtnsUserStates.ret) return {ret:false,msg:'query dtns_user_id token states failed'}
    const dtns_public_key = dtnsUserStates.web3_key ? dtnsUserStates.web3_key  :dtnsUserStates.public_key
    
    let is_web3app = typeof g_dtns_network_client!='undefined' && g_dtns_network_client
    let token = is_web3app ? dtns_root_keys.token :DTNS_TOKEN_ROOT      
    let timestamp_i = parseInt(Date.now()/1000)
    let TXINFO = {txid:sign_util.newTXID() ,token_x:token,token_y:userInfo[token_dtns_id_name],
        opcode:dtns_config.fsm_config.OP_WEB3_KEY,opval:dtns_public_key,extra_data:"set web3-key",timestamp_i}
    let TXJSON = sign_util.toTXJSONString(TXINFO);//序列化。
    console.log('setWeb3Key2tokenDtnsID-fork:TXJSON:'+TXJSON)
    let hash = await key_util.hashVal(TXJSON);//得到hash值
    let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
    if(is_web3app) TXINFO.web3_sign = sign
    
    let setWeb3KeyRet = is_web3app ?  await dtns_network_rtc_api.rpc_query('/op',TXINFO):await rpc_query(DTNS_API_BASE+'/op',TXINFO)
    console.log('setWeb3Key2tokenDtnsID-setWeb3KeyRet:',setWeb3KeyRet)
    return setWeb3KeyRet
    //if(!setWeb3KeyRet || !setWeb3KeyRet.ret) return res.json({ret: false, msg: "set web3_id web3-key failed"})
}
async function queryTokenIDByUserToken(reqdata,result_flag = false)
{
    if(result_flag){
        if(!reqdata.token) return 
        let tokenid = reqdata.token.split('_')[1]
        if(tokenid == RMB_TOKEN_ROOT.split('_')[1]){
            //root-token直接返回（仅当是rmb的时候，其他的须重新创建对应的根账户）
            return g_score_setting.web3app_token
        }
        let userid = USER_TOKEN_NAME+'_'+tokenid
        let userInfo =await rpc_api_util.s_query_token_info(USER_API_BASE,userid,'assert')
        if(!userInfo) return null
        if(reqdata.tmpObj)
        reqdata.tmpObj.userInfo = userInfo
        let token_dtns_id_name = 'dtns_'+redirectName2DTNSName(reqdata.redirect_name)+'_id'
        //增加prefix-str的判断
        let prefix_str = 'dtns_'+rpc_client.roomid + '000'+redirectName2DTNSName(reqdata.redirect_name)
        if(userInfo[token_dtns_id_name] && userInfo[token_dtns_id_name].startsWith(prefix_str)) 
            return userInfo[token_dtns_id_name]
        else{
            userInfo[token_dtns_id_name] =await forkDTNSIDByName(reqdata.redirect_name,userInfo.dtns_user_id)
            if(userInfo[token_dtns_id_name] ){
                let saveFlag = await rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,userid,'assert',JSON.stringify(userInfo),userInfo[token_dtns_id_name])
                if(saveFlag){
                    // setWeb3Key2tokenDtnsID(userInfo,token_dtns_id_name)
                    return userInfo[token_dtns_id_name]
                }
                else return null;
            }
            return null
        }
    }
    if(reqdata.redirect_op_flag){
        //token_x //token_y
        reqdata.token_x = await queryTokenIDByUserToken({tmpObj:reqdata.tmpObj,redirect_op_flag:false,token:reqdata.token_x ? reqdata.token_x: reqdata.dst_token,redirect_name:reqdata.redirect_name},true)
        reqdata.token_y = await queryTokenIDByUserToken({tmpObj:reqdata.tmpObj,redirect_op_flag:false,token:reqdata.token_y ? reqdata.token_y: reqdata.token,redirect_name:reqdata.redirect_name},true)
    }else{
        //token
        reqdata.token = await queryTokenIDByUserToken({redirect_op_flag:false,token:reqdata.token,redirect_name:reqdata.redirect_name},true)
    }
}
/**
 * 封装的rpc请求。
 * @type {rpc_query}
 */
window.rpc_query = async function (url,reqdata){
    if(!url){
        console.log('rpc_query-url is null')
        return {ret:false,msg:'rpc_query-url is null'}
    }
    const origin_url = url
    console.log('rpc_query-origin_url:',origin_url)
    if( !window.g_dev_roomid && typeof g_score_setting!='undefined' && g_score_setting.openflag && origin_url.indexOf(RMB_API_BASE)==0)
    {
        if(origin_url.indexOf(RMB_API_BASE)==0){
            reqdata.redirect_name = RMB_TOKEN_NAME
        }
        // if(origin_url.indexOf(GSB_API_BASE)==0){
        //     reqdata.redirect_name = GSB_TOKEN_NAME
        // }
        // if(origin_url.indexOf(SCORE_API_BASE)==0){
        //     reqdata.redirect_name = SCORE_TOKEN_NAME
        // }
        // if(origin_url.indexOf(VIP_API_BASE)==0){
        //     reqdata.redirect_name = VIP_TOKEN_NAME
        // }
        //是否是op操作
        let urlTmp = url.split(':')[2]
        urlTmp = urlTmp.substring(urlTmp.indexOf('/'),urlTmp.length)
        reqdata.redirect_op_flag = urlTmp == '/op' || urlTmp == '/fork' || urlTmp == '/send'
        console.log('urlTmp:'+urlTmp+'--redirect_op_flag:'+reqdata.redirect_op_flag)
        reqdata.tmpObj = {}
        //先得到相应的token-id
        await queryTokenIDByUserToken(reqdata)
        //判断是op操作还是查询操作（如果查询，改变了token之后即可直接查询dtns.network）
        if(reqdata.redirect_op_flag){
            if(urlTmp == '/fork'){
                reqdata.opcode = 'fork'
                reqdata.opval = 'opval'
                reqdata.extra_data = reqdata.tmpObj.userInfo.dtns_user_id
            }else if(urlTmp =='/send'){
                reqdata.opcode = 'send'
            }
            //进行web3签名
            let is_web3app = typeof g_dtns_network_client!='undefined' && g_dtns_network_client
            let timestamp_i = parseInt(Date.now()/1000)
            let TXINFO = {txid:sign_util.newTXID() ,token_x:reqdata.token_x,token_y:reqdata.token_y,
                opcode:reqdata.opcode,opval:reqdata.opval,
                extra_data:reqdata.opcode=='send'?'order':reqdata.extra_data,timestamp_i}
            if(typeof g_rpcReactionFilterMapAdd=='function') g_rpcReactionFilterMapAdd(null)
            if(typeof g_rpcReactionFilterMap !='undefined' && g_rpcReactionFilterMap.has(reqdata.extra_data)) 
            {
                TXINFO.extra_data = 'recharge-order' //修改为dtns.network后端可以识别的标识
                g_rpcReactionFilterMap.delete(reqdata.extra_data)
                console.log('rpc_api_config.js-set-recharge-order now!')
            } 
            let TXJSON = sign_util.toTXJSONString(TXINFO);//序列化。
            console.log('redirect_op:TXJSON:'+TXJSON,reqdata)
            let hash = await key_util.hashVal(TXJSON);//得到hash值
            let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
            if(is_web3app) TXINFO.web3_sign = sign
            let ret = is_web3app ?  await dtns_network_rtc_api.rpc_query('/op',TXINFO):await rpc_query(DTNS_API_BASE+'/op',TXINFO)
            console.log('redirect_op-ret:',ret)
            if(ret && ret.ret) return ret
            else return {ret:false,msg:'web3 call failed, result:'+JSON.stringify(ret)}
        }else{
            delete reqdata.tmpObj
            //直接进行查询
            let query_url = DTNS_API_BASE+urlTmp ///getNodeUrl(origin_url)
            let queryRet = await rpc_query(query_url,reqdata)
            console.log('dtns-web3-query-ret:',queryRet)
            return queryRet
        }
    }
    reqdata = !reqdata ? {}:reqdata;
    if(!reqdata.appid || !reqdata.secret_key) {
        reqdata.appid = APPID
        reqdata.secret_key = SECRET_KEY
    }

    const settings = [luser_config,lobj_config,lgsb_config,lmsg_config,lscore_config,lvip_config,lrmb_config,lorder_config]
    for(let i=0;i<settings.length;i++)
    {
        let tmp_config = settings[i]
        if(url.indexOf('127.0.0.1:'+tmp_config.root_config.DOMAIN_PORT)>0)
        {
            reqdata.appid = tmp_config.root_config.appids[0]
            reqdata.secret_key = tmp_config.root_config.secret_keys[0]
            break;
        }
    }

    if(url.indexOf(':'+dtns_config.root_config.DOMAIN_PORT)>0)//'node.'+NODEID+'.obj')>0)
    {
        reqdata.appid = dtns_config.root_config.appids[0]
        reqdata.secret_key = dtns_config.root_config.secret_keys[0]
    }

    url = getNodeUrl(url)

    let rpc_name = url.split(':')[2]
    rpc_name =  rpc_name ? rpc_name.substring(0,rpc_name.indexOf('/')):null
    reqdata.rpc_name = rpc_name //请求的rpc

    let urlTmp = url.split(':')[2]
    urlTmp = urlTmp.substring(urlTmp.indexOf('/'),urlTmp.length)
    let originUrl = url
    url = urlTmp

    let ret = null
    //url=='/super/websocket/link' || 
    if(
        (url == '/op' && (reqdata.opcode=='file.upload' || reqdata.opcode=='file.download')))
    {
        ret = await new Promise((resolve)=>{
            rpc_client.send(url,reqdata,null,function(rdata){
                // console.log('rpc_client-send-recved-data:'+JSON.stringify(rdata))

                if(rdata)
                    resolve(rdata.data)
                else 
                    resolve(null)
            })
            setTimeout(()=>resolve(null),30000)//30s超时
        })
    }else if(url=='/super/websocket/link' ){
        let req = {url,token:reqdata.token,rpc_name,params:reqdata}
        let ws = {ws_token:req.params.token}
        if(typeof wsPeer == 'undefined'){
            window.wsPeer = {}
        }
        console.log('op-websocket-link-params:'+JSON.stringify(req.params))
        ws.on =function(msg,func){
            switch(msg){
                case 'message':
                    wsPeer.wsMessageMap = wsPeer.wsMessageMap ? wsPeer.wsMessageMap:new Map()
                    wsPeer.wsMessageMap.set(ws.ws_token,func)
                    break;
                case 'close':
                    wsPeer.closeWSList = wsPeer.closeWSList ? wsPeer.closeWSList:[];//break;
                    wsPeer.closeWSList.push({ws,close:func})
                    break;
            }
        }
        //返回结果。
        ws.send = function(msg)
        {
            console.log('ws-send:'+JSON.stringify(msg))
            msg = str_filter.parseJSON(msg)
            let msgObj = {ws:true,ws_token:ws.ws_token,data:msg}
            //wsPeer.send(JSON.stringify(msgObj))
            let wsMsg = rpc_client.qWS(msgObj.ws_token)
            if(typeof wsMsg == 'function')
                wsMsg(msgObj.data)
            else
            console.log('[Error] websocket have no message-function callback')
        }
        ws.close = function(){
            console.log('ws-close is called! on peer we will do nothing !!!')
        }
        ws.closePeer=function(){
            console.log('peer-ws-close is called!')
            if(wsPeer && wsPeer.wsMessageMap)
            wsPeer.wsMessageMap.delete(ws.ws_token)

            let closeWSList = wsPeer.closeWSList
            let tmpCloseWSList = []
            for(let i=0;closeWSList&& i<closeWSList.length;i++ )
            {
                let tmp = closeWSList[i]
                if(tmp.ws != ws) tmpCloseWSList.push(tmp)
            }
            wsPeer.closeWSList = tmpCloseWSList
        }
        if(defaultRTC.rpc(req.rpc_name))
            return defaultRTC.rpc(req.rpc_name).websocket_c.svr_service(ws,req)  //this.rpc.websocket_c.svr_service(ws,req)       
        else
            return res.json({ret:false,msg:'[error]can not find matched-rpc'})
    }
    else{
        let req = {url,rpc_name,params:reqdata}
        ret = await new Promise((resolve)=>{
            defaultRTC.rpc_index_call(req,{is_dnalink_node_manager:true,json:function(obj){
                resolve(obj)
            }})
            setTimeout(()=>resolve(null),30000)
        })
    }
    // if(true || reqdata.secret_key == 'EFmAoAp35HFEFMZvYdfKryE24UTP')
    // {
    //     let rpc_name = url.split(':')[2]
    //     rpc_name =  rpc_name ? rpc_name.substring(0,rpc_name.indexOf('/')):null
    //     reqdata.rpc_name = rpc_name //请求的rpc

    //     let urlTmp = url.split(':')[2]
    //     urlTmp = urlTmp.substring(urlTmp.indexOf('/'),urlTmp.length)
    //     console.log('getNodeUrl-return-url:'+url)
    //     {
    //         let req = {url:urlTmp,rpc_name:'80',params:reqdata}
    //         ret = await new Promise((resolve)=>{
    //             defaultRTC.rpc_index_call(req,{is_dnalink_node_manager:true,json:function(obj){
    //                 resolve(obj)
    //             }})
    //             setTimeout(()=>resolve(null),30000)
    //         })
    //     }
    // }
    // else{
    //     ret = await http_req.http_post(url,reqdata);
    // }
    console.log("rpc_query-url:"+originUrl)
    console.log("rpc_query-reqdata:"+JSON.stringify(reqdata))
    // console.log("rpc_query-ret:"+ret)
    // try {
        // if (ret && ret.length != ('' + ret).length)
        console.log("rpc_query-ret:" + JSON.stringify(ret))
    // }catch(ex)
    // {
    //     console.log('ex:'+ex)
    // }

    return ret;
}
