/*
 * @Descripttion: 
 * @version: 
 * @Author: WindTYF
 * @Date: 2020-11-10 09:18:39
 * @LastEditors: WindTYF
 * @LastEditTime: 2020-12-17 16:21:33
 */
/**
 * Created by lauo.li on 2019/3/13.
 * 拦截器（密钥检测）和URL转发。
 */

const user_redis = require('../config').user_redis;
const config = require('../config').config;

const API_KEY = "***"
const str_filter = require('../libs/str_filter');
const rpc_query = require('../rpc_api_config').rpc_query
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSGA_API_BASE,MSGA_TOKEN_NAME,MSGA_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

const rpc_api_util = require('../rpc_api_util')
/**
 * 主要用于内网检测
 * @type {common_interceptor}
 */
module.exports.common_interceptor = common_interceptor;
async function common_interceptor(req, res, next) {

    let {key} = str_filter.get_req_data(req)

    let ip = str_filter.GetUserIP(req)
    console.log("common_interceptor-ip:"+ip);
    if(ip.indexOf('10.')==0 || ip.indexOf('127.')==0 || ip.indexOf('192.')==0)
        return next();

    if(!API_KEY)
        return next();

    console.log("API_KEY:"+API_KEY+" key:"+key);
    if(!key || key!=API_KEY)
        return res.json({ret:false,msg:"key format error!"})

    return next();
}

/**
 * 安全打印ip日志
 */
module.exports.ip_log = ip_log;
async function ip_log(req, res, next) {
    //获得客户端ip
    console.log('client-ip:'+str_filter.GetUserIP(req))
     
    let time_i = parseInt(new Date().getTime()/1000);
    let obj = {user_param:str_filter.get_req_data(req),ip:str_filter.GetUserIP(req),time_i:time_i,time_str:str_filter.GetDateTimeFormat(time_i)}

    await rpc_api_util.s_query_token_id(MSGA_API_BASE,MSGA_TOKEN_ROOT,'msg_iplog00000000000');
    //打日志，但是不等待处理结果 
    rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,'msg_iplog00000000000','notice',JSON.stringify(obj),'log-user-param-and-ip')
    next();
}

/**
 * Created by lauo.li on 2019/3/13.
 * 拦截器（密钥检测）和URL转发。
 */


/**
 * 主要用于内网检测
 * @type {common_interceptor}
 */
module.exports.api_filter = api_filter;
async function api_filter(req, res, next) {

    let {shop_id,secret_key} = str_filter.get_req_data(req)

    let flag = await shop_c.s_checkShopSecretKey(shop_id,secret_key)
    if(!flag)
        return res.json({ret:false,msg:'shop secret_key failed!'})

    return next();
}

const GROUPCHAT_PM_VISIT   = 'vip_level';
const GROUPCHAT_PM_INVITE  = 'invite_vip_level';
const GROUPCHAT_PM_SEND  = 'send_vip_level';
const GROUPCHAT_PM_MANAGER = 'manager_vip_level';

const MANAGER_VIP_LEVEL = 10;
const NORMAL_VIP_LEVEL = 0;


module.exports.GROUPCHAT_PM_VISIT = GROUPCHAT_PM_VISIT  //访问权限
module.exports.GROUPCHAT_PM_INVITE = GROUPCHAT_PM_INVITE  //拉人入群的权限
module.exports.GROUPCHAT_PM_SEND = GROUPCHAT_PM_SEND   //发送内容的权限
module.exports.GROUPCHAT_PM_MANAGER = GROUPCHAT_PM_MANAGER //管理员权限（如修改群资料等）
module.exports.MANAGER_VIP_LEVEL = MANAGER_VIP_LEVEL  //管理员vip等级
module.exports.NORMAL_VIP_LEVEL = NORMAL_VIP_LEVEL    //普通成员vip等级

//请求需要visit权限（访问权限）
module.exports.vip_filter_visit = vip_filter_visit;
function vip_filter_visit(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_VISIT
    next();
}
//请求需要invite权限（邀请人的权限）
module.exports.vip_filter_invite = vip_filter_invite;
function vip_filter_invite(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_INVITE
    next();
}
//请求需要send权限（发消息的权限）
module.exports.vip_filter_send = vip_filter_send;
async function vip_filter_send(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_SEND

    //获得客户端ip
    console.log('client-ip:'+str_filter.GetUserIP(req))
     
     
    let time_i = parseInt(new Date().getTime()/1000);
    let obj = {user_param:str_filter.get_req_data(req),ip:str_filter.GetUserIP(req),time_i:time_i,time_str:str_filter.GetDateTimeFormat(time_i)}

    //打日志，但是不等待处理结果 
    rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,MSGA_TOKEN_ROOT,'notice',JSON.stringify(obj),'log-user-param-and-ip')
    next();
}
//请求需要manager权限（管理员权限）
module.exports.vip_filter_manager = vip_filter_manager;
function vip_filter_manager(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_MANAGER
    console.log('vip_filter_manager:'+req.GROUPCHAT_PM)
    next();
}


/**
 * 如果是vip社群，判断用户权限是否允许访问、发内容、拉人
 */
module.exports.vip_filter = vip_filter;
async function vip_filter(req, res, next) {
    let {user_id,s_id,chatid} = str_filter.get_req_data(req)

    //判断参数信息
    if(!chatid){
        let result = {ret:false,msg:'chatid error'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    } 

    //判断用户session状态
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str)
    {
        let result = {ret:false,msg:"session error"}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    
    //判断是否是群成员
    let msg_user_id = USER_TOKEN_NAME!=MSGA_TOKEN_NAME ?MSGA_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin =  await rpc_api_util.s_check_token_list_related(MSGA_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin) {
        let result = {ret:false,msg:"error: not the member of chatroom"}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    let userInfo =  await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!userInfo)
    {
        let result = {ret:false,msg:'user-info is empty'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    
    let chatInfo = await rpc_api_util.s_query_token_info(MSGA_API_BASE,chatid,'assert');

    //单聊无权限控制
    if(chatInfo.chat_type == 'single') 
        return next();

    let is_manager = chatInfo.create_user_id == user_id;
    
    //进一步判断是否是管理员列表里的管理员
    is_manager = !is_manager ? await rpc_api_util.s_check_token_list_related(MSGA_API_BASE,chatid,msg_user_id,'relx') : is_manager

    //如果是管理员（群主）直接下一步。
    if(is_manager) 
        return next();
    
    return res.json({ret:false, msg:'user no creater or manager'})
}

/**
 * 这个变量用于控制管理后台的权限（初始化控制台用户权限）
 */
const INIT_CONSOLE_USER = config.init_console_user;
module.exports.INIT_CONSOLE_USER = INIT_CONSOLE_USER

/**
 * 连线-控制台权限控制（客服和管理员有权限进入）
 */
module.exports.console_filter = console_filter;
async function console_filter(req, res, next) {
    let {user_id,s_id} = str_filter.get_req_data(req)

    //判断用户session状态
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str)
    {
        let result = {ret:false,msg:"session error"}
        console.log('console_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    if(user_id == INIT_CONSOLE_USER) req.is_console_user = true;
    let console_user_list_id = await rpc_api_util.s_query_token_id(USER_API_BASE,USER_TOKEN_ROOT,'consoleuser00000')
    let relateRet = await rpc_api_util.s_check_token_list_related(USER_API_BASE,console_user_list_id,user_id,'relc')
    req.is_console_user = !req.is_console_user ? relateRet :req.is_console_user

    if(!req.is_console_user )
    {
        let result = {ret:false,msg:"no pm error"}
        console.log('console_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    next();
}


/**
 * 项目仓库权限控制（项目群主和管理员有权限进入）
 */
module.exports.rps_filter = rps_filter;
async function rps_filter(req, res, next) {
    let {user_id,s_id,chatid} = str_filter.get_req_data(req)

    //判断参数信息
    if(!chatid){
    let result = {ret:false,msg:'chatid error'}
    console.log('rps_filter-result:'+JSON.stringify(result))
    return res.json(result)
    } 

    //判断用户session状态
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str)
    {
        let result = {ret:false,msg:"session error"}
        console.log('rps_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    
    //判断是否是群成员
    let msg_user_id = USER_TOKEN_NAME!=MSGA_TOKEN_NAME ?MSGA_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin =  await rpc_api_util.s_check_token_list_related(MSGA_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin) {
        let result = {ret:false,msg:"error: not the member of chatroom"}
        console.log('rps_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    let userInfo =  await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!userInfo)
    {
        let result = {ret:false,msg:'user-info is empty'}
        console.log('rps_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    
    let chatInfo = await rpc_api_util.s_query_token_info(MSGA_API_BASE,chatid,'assert');

    let is_manager = chatInfo.create_user_id == user_id;
    
    //进一步判断是否是管理员列表里的管理员
    is_manager = !is_manager ? await rpc_api_util.s_check_token_list_related(MSGA_API_BASE,chatid,msg_user_id,'relx') : is_manager

    //如果是管理员（群主）直接下一步。
    if(is_manager) 
        return next();
    
    return res.json({ret:false, msg:'user no creater or manager'})
}
