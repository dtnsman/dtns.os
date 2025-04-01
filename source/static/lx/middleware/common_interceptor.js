/**
 * Created by lauo.li on 2019/3/13.
 * 拦截器（密钥检测）和URL转发。
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const user_redis = require('../config').user_redis;
// const config = require('../config').config;
// const rpc_query = require('../rpc_api_config').rpc_query
// const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
//     ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
//     GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
//     PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
//     RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
//     SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
//     OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
//     MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
//     VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

// const rpc_api_util = require('../rpc_api_util')


/**
 * 主要用于内网检测
 * @type {common_interceptor}
 */
window.api_filter = api_filter;
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


window.GROUPCHAT_PM_VISIT = GROUPCHAT_PM_VISIT  //访问权限
window.GROUPCHAT_PM_INVITE = GROUPCHAT_PM_INVITE  //拉人入群的权限
window.GROUPCHAT_PM_SEND = GROUPCHAT_PM_SEND   //发送内容的权限
window.GROUPCHAT_PM_MANAGER = GROUPCHAT_PM_MANAGER //管理员权限（如修改群资料等）
window.MANAGER_VIP_LEVEL = MANAGER_VIP_LEVEL  //管理员vip等级
window.NORMAL_VIP_LEVEL = NORMAL_VIP_LEVEL    //普通成员vip等级

//请求需要visit权限（访问权限）
window.vip_filter_visit = vip_filter_visit;
function vip_filter_visit(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_VISIT
    next();
}
//请求需要invite权限（邀请人的权限）
window.vip_filter_invite = vip_filter_invite;
function vip_filter_invite(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_INVITE
    next();
}
//请求需要send权限（发消息的权限）
window.vip_filter_send = vip_filter_send;
async function vip_filter_send(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_SEND

    //获得客户端ip
    // console.log('client-ip:'+str_filter.GetUserIP(req))
     
     
    let time_i = parseInt(new Date().getTime()/1000);
    let obj = {user_param:str_filter.get_req_data(req),ip:'1.1.1.1',//str_filter.GetUserIP(req),
        time_i:time_i,time_str:str_filter.GetDateTimeFormat(time_i)}

    //打日志，但是不等待处理结果 
    rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,MSG_TOKEN_ROOT,'notice',JSON.stringify(obj),'log-user-param-and-ip')
    next();
}
//请求需要manager权限（管理员权限）
window.vip_filter_manager = vip_filter_manager;
function vip_filter_manager(req, res, next) {
    req.GROUPCHAT_PM = GROUPCHAT_PM_MANAGER
    console.log('vip_filter_manager:'+req.GROUPCHAT_PM)
    next();
}


/**
 * 如果是vip社群，判断用户权限是否允许访问、发内容、拉人
 */
window.vip_filter = vip_filter;
async function vip_filter(req, res, next) {
    let {user_id,s_id,chatid} = str_filter.get_req_data(req)
    console.log('req.GROUPCHAT_PM:'+req.GROUPCHAT_PM)
    req.GROUPCHAT_PM = !req.GROUPCHAT_PM ? GROUPCHAT_PM_VISIT : req.GROUPCHAT_PM //默认检测访问权限

    //判断参数信息
    if(!chatid){
        let result = {ret:false,msg:'chatid error'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    } 

    //判断用户session状态
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str)
    {
        let result = {ret:false,msg:"session error"}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    
    //判断是否是群成员
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin =  await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
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
    //是否被封
    if(userInfo.is_baned)
    {
        let result = {ret:false,msg:'you is already baned by console-user'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    req.userInfo = userInfo;

    //拿到聊天室信息（主要是vip信息）
    let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert');
    if(!chatInfo)  {
        let result = {ret:false,msg:'chat-info is empty'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }
    chatInfo.vip_level = !chatInfo.vip_level ? NORMAL_VIP_LEVEL: chatInfo.vip_level;
    chatInfo.invite_vip_level = !chatInfo.invite_vip_level ? NORMAL_VIP_LEVEL: chatInfo.invite_vip_level;
    chatInfo.send_vip_level = !chatInfo.send_vip_level ? NORMAL_VIP_LEVEL: chatInfo.send_vip_level;

    req.chatInfo = chatInfo;
    if(!chatInfo) 
    {
        let result = {ret:false,msg:'chat-info is empty'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    //判断群是否被封禁。---2020-4-23新增
    if(chatInfo.is_baned){
        let result = {ret:false,msg:'chatroom is alread baned'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    //是否被禁言
    let mem_user_id = user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ? user_id: MSG_TOKEN_NAME+'_'+user_id.split('_')[1];
    let is_contact_flag = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,mem_user_id,'relb');
    if(is_contact_flag){
        let result = {ret:false,msg:'you is already baned speak'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    //单聊无权限控制
    if(chatInfo.chat_type == 'single') 
        return next();

    let is_manager = chatInfo.create_user_id == user_id;
    req.is_owner = is_manager; //这个标志位是群主
    //进一步判断是否是管理员列表里的管理员
    is_manager = !is_manager ? await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,msg_user_id,'relx') : is_manager
    req.is_manager = is_manager;

    //如果是管理员（群主）直接下一步。
    if(is_manager) 
        return next();

    //如果是需要管理员权限，非管理员直接拦截
    if(GROUPCHAT_PM_MANAGER == req.GROUPCHAT_PM) {
        let result = {ret:false,msg:'manager pm judge: need manager pm'}
        console.log('vip_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    //判断是否需要进行会员等级判断
    if( GROUPCHAT_PM_VISIT == req.GROUPCHAT_PM  &&  chatInfo.vip_level==NORMAL_VIP_LEVEL && !chatInfo.forkids && !chatInfo.xmsgids) return next();
    //当是拉人权限时，必须同时满足群访问权限和拉人权限都为普通（vip0）才能直接放过
    if( GROUPCHAT_PM_INVITE == req.GROUPCHAT_PM  &&  chatInfo.invite_vip_level==NORMAL_VIP_LEVEL && chatInfo.vip_level==NORMAL_VIP_LEVEL) return next();
    //当是发内容权限时，访问权限和发送权限均为0
    if( GROUPCHAT_PM_SEND == req.GROUPCHAT_PM  &&  chatInfo.send_vip_level==NORMAL_VIP_LEVEL && chatInfo.vip_level==NORMAL_VIP_LEVEL) return next();

    //#1 ----判断访问权限    
    //拿到用户的VIP信息。
    let vipInfo = await rpc_api_util.s_query_token_info(VIP_API_BASE,VIP_TOKEN_NAME+'_'+user_id.split('_')[1],'assert');
    let now_time = parseInt(new Date().getTime()/1000);
    //如果是manager则是：vip10
    //以下此行代码判断管理员，但是在前面已经对管理员进行了放过
    //vipInfo = is_manager ? {vip_level:MANAGER_VIP_LEVEL,send_vip_level:MANAGER_VIP_LEVEL,invite_vip_level:MANAGER_VIP_LEVEL,vip_timeout:now_time+100*60*60*24}:vipInfo
    vipInfo = !vipInfo ? {vip_level:NORMAL_VIP_LEVEL,send_vip_level:NORMAL_VIP_LEVEL,invite_vip_level:NORMAL_VIP_LEVEL,vip_timeout:0}:vipInfo;
    req.vipInfo = vipInfo;

    //检测是否符合visit权限
    let forkids_visit_flag = true
    if(chatInfo.forkids)
    {
        forkids_visit_flag = false
        if(userInfo.dtns_user_id)
        {
            let forkidsArray = chatInfo.forkids.split(';')
            let reqs = []
            for(let i=0;i<forkidsArray.length;i++){
                reqs.push(rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:forkidsArray[i]}))
            }
            let rets = await Promise.all(reqs)
            console.log('forkid-map-key-value-query-rets:',rets)
            //web3InfoRet && web3InfoRet.map_value
            let reqs2 = []
            for(let i=0;i<rets.length;i++)
            {
                reqs2.push(rets[i] && rets[i].ret && rets[i].map_value ? 
                        rpc_api_util.s_check_token_list_related(DTNS_API_BASE,userInfo.dtns_user_id,rets[i].map_value,'relf'):false)
            }
            let rets2 = await Promise.all(reqs2)
            console.log('forkids-check-relations-rets2:',rets2)
            for(let i=0;i<rets2.length;i++)
            {
                if(rets2[i]){
                    forkids_visit_flag = true
                    break;
                }
            }
        }
    }

    //判断xmsgids权限
    let xmsgids_visit_flag = true
    if(chatInfo.xmsgids)
    {
        xmsgids_visit_flag = false
        let xmsgidsArray = chatInfo.xmsgids.split(';')
        let reqs = []
        for(let i=0;i<xmsgidsArray.length;i++){
            reqs.push(rpc_api_util.s_check_token_list_related(MSG_API_BASE,xmsgidsArray[i],msg_user_id,'relb'))
        }
        let rets = await Promise.all(reqs)
        console.log('vip_filter-xmsgids--query-rets:',rets)
        for(let i=0;i<rets.length;i++)
        {
            if(rets[i]){
                xmsgids_visit_flag = true
                break;
            }
        }
    }

    //#1 判断访问权限
    //判断等级够不够
    //如果福刻访问权限为false，则继续判断会员等级或者是否失效时间过期
    if( !forkids_visit_flag  && !xmsgids_visit_flag 
        || !xmsgids_visit_flag && !chatInfo.forkids
        || !forkids_visit_flag && !chatInfo.xmsgids
        )
    {
        //如果群的vip访问权限为0，则只依赖于forkid的权限判断（亦即无forkids权限，亦即无群访问权限）
        if(chatInfo.vip_level == NORMAL_VIP_LEVEL)
            return res.json({ret:false,msg:"visit pm judge: your vip-level less than groupchat-vip-level",forkids_visit_flag,xmsgids_visit_flag})

        if(vipInfo.vip_level < chatInfo.vip_level) 
        {
            let result = {ret:false,msg:"visit pm judge: your vip-level less than groupchat-vip-level",forkids_visit_flag,xmsgids_visit_flag,
                user_vip_level:vipInfo.vip_level,is_vip:vipInfo.vip_level >NORMAL_VIP_LEVEL,is_vip_timeout:false,chat_vip_level:chatInfo.vip_level}
            console.log('vip_filter-result:'+JSON.stringify(result))
            return res.json(result)
        }

        //判断是否超时--仅当社群访问权限非0（不是normal_vip_level时才需要
        if(chatInfo.vip_level!=NORMAL_VIP_LEVEL && now_time>= vipInfo.vip_timeout)
        {
            let result = {ret:false,msg:"visit pm judge: your vip is timeout",forkids_visit_flag,xmsgids_visit_flag,
                user_vip_level:vipInfo.vip_level,is_vip:vipInfo.vip_level>NORMAL_VIP_LEVEL,is_vip_timeout:true,chat_vip_level:chatInfo.vip_level}
            console.log('vip_filter-result:'+JSON.stringify(result))
            return res.json(result)
        }
    }

    //只需要判断一下访问权限即可---只判断访问权限
    if(GROUPCHAT_PM_VISIT == req.GROUPCHAT_PM ) 
        return next()

    
    //#2 判断其它邀请入群和写权限------没有访问权限，是不能进行到此步骤的
    if(GROUPCHAT_PM_SEND == req.GROUPCHAT_PM )
    {
        
        if(vipInfo.vip_level < chatInfo.send_vip_level) 
        {
            let result = {ret:false,msg:"send pm judge: your vip-level less than groupchat-vip-level",
                user_vip_level:vipInfo.vip_level,is_vip:vipInfo.vip_level>NORMAL_VIP_LEVEL,is_vip_timeout:false,chat_vip_level:chatInfo.vip_level}
            console.log('vip_filter-result:'+JSON.stringify(result))
            return res.json(result)
        }

        //时间判断
        if(chatInfo.send_vip_level!=NORMAL_VIP_LEVEL && now_time>= vipInfo.vip_timeout)
        {
            let result = {ret:false,msg:"visit pm judge: your vip is timeout",
                user_vip_level:vipInfo.vip_level,is_vip:vipInfo.vip_level>NORMAL_VIP_LEVEL,is_vip_timeout:true,chat_vip_level:chatInfo.vip_level}
            console.log('vip_filter-result:'+JSON.stringify(result))
            return res.json(result)
        }
    }else if(GROUPCHAT_PM_INVITE ==  req.GROUPCHAT_PM)
    {
        if(vipInfo.vip_level < chatInfo.invite_vip_level) 
        {
            let result = {ret:false,msg:"invite pm judge: your vip-level less than groupchat-vip-level",user_vip_level:vipInfo.vip_level,is_vip:vipInfo.vip_level>NORMAL_VIP_LEVEL,
                is_vip_timeout:false,chat_vip_level:chatInfo.vip_level}
            console.log('vip_filter-result:'+JSON.stringify(result))
            return res.json(result)
        }

        //时间判断
        if(chatInfo.invite_vip_level!=NORMAL_VIP_LEVEL && now_time>= vipInfo.vip_timeout)
        {
            let result = {ret:false,msg:"visit pm judge: your vip is timeout",
                user_vip_level:vipInfo.vip_level,is_vip:vipInfo.vip_level>NORMAL_VIP_LEVEL,is_vip_timeout:true,chat_vip_level:chatInfo.vip_level}
            console.log('vip_filter-result:'+JSON.stringify(result))
            return res.json(result)
        }
    }

    next();
}

/**
 * 这个变量用于控制管理后台的权限（初始化控制台用户权限）
 */
const INIT_CONSOLE_USER = ll_config.init_console_user;
window.INIT_CONSOLE_USER = INIT_CONSOLE_USER

/**
 * 连线-控制台权限控制（客服和管理员有权限进入）
 */
window.console_filter = console_filter;
async function console_filter(req, res, next) {
    let {user_id,s_id} = str_filter.get_req_data(req)

    //判断用户session状态
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str)
    {
        let result = {ret:false,msg:"session error"}
        console.log('console_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    if(INIT_CONSOLE_USER && user_id == INIT_CONSOLE_USER || await manager_c.isManagerUid(user_id)){
        req.is_console_user = true;
        return next()
    }
    let console_user_list_id = await rpc_api_util.s_query_token_id(USER_API_BASE,USER_TOKEN_ROOT,'consoleuser00000')
    let relateRet = await rpc_api_util.s_check_token_list_related(USER_API_BASE,console_user_list_id,user_id,'relc')
    req.is_console_user = !req.is_console_user ? relateRet :req.is_console_user

    if(!req.is_console_user )
    {
        let result = {ret:false,msg:"no pm error",INIT_CONSOLE_USER,user_id,is_manager_flag:await manager_c.isManagerUid(user_id)}
        console.log('console_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    next();
}

/**
 * 检验是否拥有登录状态
 * 2023-6-27新增（可用于插件中等）
 */
window.session_filter = session_filter;
async function session_filter(req, res, next) {
    let {user_id,s_id} = str_filter.get_req_data(req)

    //判断用户session状态
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str)
    {
        let result = {ret:false,msg:"session error"}
        console.log('session_filter-result:'+JSON.stringify(result))
        return res.json(result)
    }

    next()
}