// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const gnode_format_util = require('../libs/gnode_format_util');
// const notice_util = require('../libs/notice_util');

// const user_c = require('./user_c');

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

window.manager_c = {}
window.manager_c.isManagerUid =isManagerUid;
async function isManagerUid(user_id) {
    if(!user_id) return false
    let roomid = ll_config.roomid// typeof rpcHost =='undefined' || !rpcHost ?  null : rpcHost.roomid
    console.log('isManagerUid-roomid:'+roomid)
    console.log('isManagerUid-getItem:'+localStorage.getItem('manager_uid-'+roomid))
    if(roomid)
    {
        console.log('isManagerUid-key:'+'manager_uid-'+roomid)
        let bFlag = typeof localStorage =='undefined' ? false : user_id == localStorage.getItem('manager_uid-'+roomid)// 'user_25r86kVMBzpo4tPM' || user_id=='user_25r86kVMBzpo4tPM'
        console.log('isManagerUid-bFlag:'+bFlag)
        if(bFlag) return true
    }

    //采用判断是否是web3app对应的所有者，判断管理员权限。2023-5-5新增
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    console.log('isManagerUid-userInfo:',userInfo,userInfo ? userInfo.dtns_user_id:null)
    if(!userInfo || !userInfo.dtns_user_id || (roomid!='dtns' && (typeof dtns_root_keys =='undefined' || !dtns_root_keys.token))) return false

    let default_web3app_dtns_token = typeof g_system_default_web3app_dtns_token =='undefined' ? 'dtns_dtns000appc4ry9HNWtcTaxXjNQCTKYQ' : g_system_default_web3app_dtns_token
    let is_web3app_manager = await rpc_api_util.s_check_token_list_related(DTNS_API_BASE,userInfo.dtns_user_id,roomid!='dtns' ? dtns_root_keys.token:default_web3app_dtns_token,'relw');
    console.log('is_web3app_manager:',is_web3app_manager)
    return is_web3app_manager
}
/**
 * 查询认证的申请纪录
 * @type {queryUserRoleOrders}
 */
window.manager_c.queryAllUserRoleOrders =queryAllUserRoleOrders;
async function queryAllUserRoleOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:'order_roleall000000000',opcode:'send',begin:begin*len,len:len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].bindInfo = JSON.parse(listRet.list[i].txjson.opval)

            listRet.list[i].user_name = listRet.list[i].bindInfo.user_name
            listRet.list[i].tips = listRet.list[i].bindInfo.tips
            listRet.list[i].user_id = listRet.list[i].bindInfo.user_id
            listRet.list[i].role_kind = listRet.list[i].bindInfo.role_kind
            listRet.list[i].role_name = listRet.list[i].bindInfo.role_name
            listRet.list[i].bind_time = str_filter.GetDateTimeFormat(listRet.list[i].txjson.timestamp_i)

            listRet.list[i].paper_kind = listRet.list[i].bindInfo.paper_kind
            listRet.list[i].paper_code = listRet.list[i].bindInfo.paper_code
            listRet.list[i].filename = listRet.list[i].bindInfo.filename

            delete listRet.list[i].txjson
            delete listRet.list[i].bindInfo
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-bind-role-list is empty'})
    }
}

/**
 * 审核通过资料。
 * @type {queryAllUserRoleOrders}
 */
window.manager_c.roleOk =roleOk;
async function roleOk(req, res) {
    let {user_id, s_id, role_user_id,random, sign} = str_filter.get_req_data(req);


    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!role_user_id) return res.json({ret:false,msg:"role-user-id error"})


    //查询用户资料，看是否已经有rold_order_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+role_user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.role_order_id)
    {
        return res.json({ret: false, msg: "user-bind-role-id is empty"});
    }

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userInfo.role_order_id,opcode:'send',begin:0,len:2})
    if(!listRet || !listRet.ret) return res.json({ret: false, msg: "user-bind-role-list is empty"});

    let orderInfo = JSON.parse(JSON.parse(listRet.list[0].txjson).opval)
    orderInfo.tips = '审核通过'

    //更新用户资料。
    let updateUserInfoFlag = await user_c.s_modifyUserInfo(role_user_id,['role_name','role_info'],[orderInfo.role_name,orderInfo])
    if(!updateUserInfoFlag) return res.json({ret: false, msg: "update user-info failed"})

    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+role_user_id.split('_')[1],opval:'恭喜您：你的认证资料审核通过了！您将获得100 GSB和500经验值！'
        ,extra_data:JSON.stringify(orderInfo)})

    let sendRoleOrderRet = await  rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:userInfo.role_order_id,opval:JSON.stringify(orderInfo),extra_data:role_user_id})
    if(!sendRoleOrderRet || !sendRoleOrderRet.ret) return res.json({ret: false, msg: "send user-role-order failed"});

    let sendAllRoleOrderRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:ORDER_TOKEN_NAME+'_roleall000000000',
        opval:JSON.stringify(orderInfo),extra_data:role_user_id})
    if(!sendAllRoleOrderRet || !sendAllRoleOrderRet.ret) return res.json({ret: false, msg: "send all-user-role-order failed"});


    //奖励经验值。
    rpc_query(SCORE_API_BASE+'/send',{token_x:SCORE_TOKEN_ROOT,token_y:SCORE_TOKEN_NAME+"_"+role_user_id.split('_')[1],
        opval:500,extra_data:'身份认证成功，奖励500经验值'})
    rpc_query(GSB_API_BASE+'/send',{token_x:GSB_TOKEN_ROOT,token_y:GSB_TOKEN_NAME+"_"+role_user_id.split('_')[1],
        opval:100,extra_data:'身份认证成功，奖励100 GSB'})

    res.json({ret:true,msg:'success'})
}

/**
 * 审核不通过。
 * @type {roleDeny}
 */
window.manager_c.roleDeny =roleDeny;
async function roleDeny(req, res) {
    let {user_id, s_id, role_user_id,random, sign,msg} = str_filter.get_req_data(req);


    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})


    //查询用户资料，看是否已经有rold_order_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+role_user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.role_order_id)
    {
        return res.json({ret: false, msg: "user-bind-role-id is empty"});
    }

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userInfo.role_order_id,opcode:'send',begin:0,len:2})
    if(!listRet || !listRet.ret) return res.json({ret: false, msg: "user-bind-role-list is empty"});

    let orderInfo = JSON.parse(JSON.parse(listRet.list[0].txjson).opval)
    orderInfo.tips = '被拒绝通过审核，原因：'+msg

    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+role_user_id.split('_')[1],
        opval:'【认证身份】你的认证资料未能通过审核，拒绝原因为：'+msg
        ,extra_data:JSON.stringify(orderInfo)})

    let sendRoleOrderRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:userInfo.role_order_id,opval:JSON.stringify(orderInfo),extra_data:role_user_id})
    if(!sendRoleOrderRet || !sendRoleOrderRet.ret) return res.json({ret: false, msg: "send user-role-order failed"});

    let sendAllRoleOrderRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:ORDER_TOKEN_NAME+'_roleall000000000',
        opval:JSON.stringify(orderInfo),extra_data:role_user_id})
    if(!sendAllRoleOrderRet || !sendAllRoleOrderRet.ret) return res.json({ret: false, msg: "send all-user-role-order failed"});
    res.json({ret:true,msg:'success'})
}

/**
 * 查询人民币订单流水
 * @type {queryRmbOrders}
 */
window.manager_c.queryRmbOrders =queryRmbOrders;
async function queryRmbOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let rmbListRet = await rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_ROOT,opcode:'send',begin:begin*len,len:len})
    if(rmbListRet &&rmbListRet.ret)
    {
        let i =0;
        for(;i<rmbListRet.list.length;i++)
        {
            rmbListRet.list[i].txjson = JSON.parse(rmbListRet.list[i].txjson)
            rmbListRet.list[i].val = rmbListRet.list[i].txjson.token_state
            rmbListRet.list[i].opval = rmbListRet.list[i].txjson.opval
            rmbListRet.list[i].send_val = rmbListRet.list[i].txjson.token_x == RMB_TOKEN_ROOT ? '-'+rmbListRet.list[i].opval : '+'+rmbListRet.list[i].opval;
            // rmbListRet.list[i].recv_val = rmbListRet.list[i].txjson.token_x == userRmbToken ? '' : rmbListRet.list[i].opval;
            try {
                rmbListRet.list[i].txjson.extra_data = JSON.parse(rmbListRet.list[i].txjson.extra_data)
                rmbListRet.list[i].order_name = rmbListRet.list[i].txjson.extra_data.order_name
                rmbListRet.list[i].order_id = rmbListRet.list[i].txjson.extra_data.order_id
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.extra_data.order_time)
            }catch(ex)
            {
                rmbListRet.list[i].order_name = ''
                rmbListRet.list[i].order_id = rmbListRet.list[i].txjson.extra_data
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.timestamp_i)
            }
        }
        res.json({ret:true,msg:'success',list:rmbListRet.list})
    }
    else{
        res.json({ret:false,msg:'rmb orders is empty'})
    }
}


/**
 * 查询GSB订单流水
 * @type {queryRmbOrders}
 */
window.manager_c.queryGSBOrders =queryGSBOrders;
async function queryGSBOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let list = await rpc_query(GSB_API_BASE+'/chain/opcode',{token:GSB_TOKEN_ROOT,opcode:'send',begin:begin*len,len:len})
    if(list &&list.ret)
    {
        let i =0;
        for(;i<list.list.length;i++)
        {
            list.list[i].txjson = JSON.parse(list.list[i].txjson)
            list.list[i].val = list.list[i].txjson.token_state
            list.list[i].opval = list.list[i].txjson.opval
            list.list[i].send_val = list.list[i].txjson.token_x == RMB_TOKEN_ROOT ? '-'+list.list[i].opval : '+'+list.list[i].opval;
            // rmbListRet.list[i].recv_val = rmbListRet.list[i].txjson.token_x == userRmbToken ? '' : rmbListRet.list[i].opval;
            try {
                list.list[i].txjson.extra_data = JSON.parse(list.list[i].txjson.extra_data)
                list.list[i].order_name = list.list[i].txjson.extra_data.order_name
                list.list[i].order_id = list.list[i].txjson.extra_data.order_id
                list.list[i].order_time = str_filter.GetDateTimeFormat(list.list[i].txjson.extra_data.buy_time)
            }catch(ex)
            {
                list.list[i].order_name = ''
                list.list[i].order_id = list.list[i].txjson.extra_data
                list.list[i].order_time = str_filter.GetDateTimeFormat(list.list[i].txjson.timestamp_i)
            }
        }
        res.json({ret:true,msg:'success',list:list.list})
    }
    else{
        res.json({ret:false,msg:'gsb orders is empty'})
    }
}


/**
 * 查询系统消息。
 * @type {querySysMsg}
 */
window.manager_c.querySysMsg =querySysMsg;
async function querySysMsg(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let listRet = await rpc_query(MSG_API_BASE+'/chain/opcode',{token:MSG_TOKEN_ROOT,opcode:'send',begin:begin*len,len:len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            let senderIsMe = listRet.list[i].txjson.token_x == MSG_TOKEN_ROOT
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].opval = listRet.list[i].txjson.opval
            listRet.list[i].send_time = str_filter.GetDateTimeFormat(listRet.list[i].txjson.timestamp_i)
            listRet.list[i].msg_userid = senderIsMe ? listRet.list[i].txjson.token_y : listRet.list[i].txjson.token_x
            listRet.list[i].user_name = listRet.list[i].msg_userid == MSG_TOKEN_ROOT ? '[系统消息]':'[用户消息]'
            listRet.list[i].sender_isme = senderIsMe
            listRet.list[i].send_kind = senderIsMe ?'发送':'接收'
            listRet.list[i].extra_data = listRet.list[i].txjson.extra_data
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'sysmsg is empty'})
    }
}