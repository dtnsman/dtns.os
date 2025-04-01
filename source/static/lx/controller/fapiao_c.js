// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const gnode_format_util = require('../libs/gnode_format_util');
// const notice_util = require('../libs/notice_util');
// const user_c = require('./user_c');
// const manager_c = require('./manager_c');

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
window.fapiao_c = {}
/**
 * 申请开票
 * @type {applyFapiao}
 */
window.fapiao_c.applyFapiao =applyFapiao;
async function applyFapiao(req,res) {
    let {user_id,s_id,fp_kind,name_kind,name,code,fp_money,fp_extra,wuliu} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!fp_kind) return res.json({ret:false,msg:"fp_kind error"})
    if(!name_kind) return res.json({ret:false,msg:"name_kind error"})
    if(!name) return res.json({ret:false,msg:"name error"})
    if(name_kind=='公司' && !code) return res.json({ret:false,msg:"code error"})
    if(!fp_money || fp_money!=fp_money*1) return res.json({ret:false,msg:"fp_money error"})
    fp_extra = !fp_extra? '':fp_extra
    if(!wuliu) return res.json({ret:false,msg:"wuliu error"})

    let obj = {user_id,fp_kind,name_kind,name,code,fp_money,fp_extra,wuliu,save_time:parseInt(new Date().getTime()/1000),tips:'审核中' }

    //查询用户资料，看是否已经有rold_order_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.fapiao_order_id)
    {
        let forkRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,space:'fapiao'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork user-fapiao-order-id failed"});
        userInfo.fapiao_order_id = forkRet.token_x
        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})

        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo fapiao-order-id failed"});
    }
    obj.fapiao_order_id = userInfo.fapiao_order_id

    //如果存在，就发布一个新的fp
    let forkFPRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,space:'fapiaoNEW'})
    if(!forkFPRet||!forkFPRet.ret) return res.json({ret: false, msg: "fork fapiao-new-order-id failed"});

    //保存order-id，方便查询。
    obj.order_id = forkFPRet.token_x

    let assertFapiaoRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:forkFPRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.fapiao_order_id })
    if(!assertFapiaoRet || !assertFapiaoRet.ret) return res.json({ret: false, msg: "assert fapiao-new-order-info failed"});

    //order
    //send user-fapiao-order-id
    let sendRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:userInfo.fapiao_order_id,
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send fapiao-order-info failed"});

    //send all-user-fapiao-order-id
    let sendAllRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:ORDER_TOKEN_NAME+'_fapiaoall0000000',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send fapiao-order-info to allorder failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'您在发票管理系统，申请了金额为'+fp_money+'元的发票，请等待财务审核！',extra_data:user_id})

    return res.json({ret:true,msg:'success'})
}



/**
 * 审核通过发票申请
 * @type {applyOk}
 */
window.fapiao_c.applyOk =applyOk;
async function applyOk(req, res) {
    let {user_id, s_id, order_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!order_id) return res.json({ret:false,msg:"fapiao-apply-order_id error"})


    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"fapiao-apply-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '【审核通过】该发票申请（请接收快递），附加信息：'+msg

    let assertFapiaoRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.fapiao_order_id })
    if(!assertFapiaoRet || !assertFapiaoRet.ret) return res.json({ret: false, msg: "assert fapiao-order-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+obj.user_id.split('_')[1],
        opval:'【审核通过】恭喜您，您在发票管理系统，申请了金额为'+obj.fp_money+'元的发票，已经【审核通过】！请等待和接收发票（快递）',extra_data:obj.user_id})

    res.json({ret:true,msg:'success'})
}

/**
 * 审核不通过。
 * @type {applyDeny}
 */
window.fapiao_c.applyDeny =applyDeny;
async function applyDeny(req, res) {
    let {user_id, s_id, order_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!order_id) return res.json({ret:false,msg:"fapiao-apply-order_id error"})

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"fapiao-apply-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '【审核拒绝】该发票申请！备注：'+msg

    let assertFapiaoRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.fapiao_order_id })
    if(!assertFapiaoRet || !assertFapiaoRet.ret) return res.json({ret: false, msg: "assert fapiao-order-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+obj.user_id.split('_')[1],
        opval:'【审核拒绝】该发票申请！您在发票管理系统，申请了金额为'+obj.fp_money+'元的发票，已经被财务【拒绝】！备注信息：'+msg,extra_data:obj.user_id})

    res.json({ret:true,msg:'success'})
}



/**
 * 查询发票的申请纪录
 * @type {queryUserRoleOrders}
 */
window.fapiao_c.queryUserFapiaoOrders =queryUserFapiaoOrders;
async function queryUserFapiaoOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    //查询用户资料，看是否已经有rold_order_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.fapiao_order_id)
    {
        return res.json({ret: false, msg: "user-fapiao-order-id is empty"});
    }

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userInfo.fapiao_order_id,opcode:'send',begin:begin*len,len:len})

    let queryOrderInfoP = []

    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,fp_kind,name_kind,name,code,fp_money,fp_extra,wuliu} = str_filter.get_req_data(req)

            listRet.list[i].order_id = listRet.list[i].info.order_id
            //放到数组中，等待处理。
            queryOrderInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:listRet.list[i].order_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].fp_kind = listRet.list[i].info.fp_kind
            listRet.list[i].name_kind = listRet.list[i].info.name_kind
            listRet.list[i].name = listRet.list[i].info.name
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].code = listRet.list[i].info.code
            listRet.list[i].fp_money = listRet.list[i].info.fp_money
            listRet.list[i].fp_extra = listRet.list[i].info.fp_extra
            listRet.list[i].wuliu = listRet.list[i].info.wuliu
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryOrderInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i].tips = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval).tips
                }else{
                    listRet.list[i].tips = '审核中！'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-fapiao-list is empty'})
    }
}

/**
 * 查询认证的申请纪录
 * @type {queryUserRoleOrders}
 */
window.fapiao_c.queryAllUserFapiaoOrders =queryAllUserFapiaoOrders;
async function queryAllUserFapiaoOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:ORDER_TOKEN_NAME+'_fapiaoall0000000',opcode:'send',begin:begin*len,len:len})
    let queryOrderInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,fp_kind,name_kind,name,code,fp_money,fp_extra,wuliu} = str_filter.get_req_data(req)

            listRet.list[i].order_id = listRet.list[i].info.order_id
            //放到数组中，等待处理。
            queryOrderInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:listRet.list[i].order_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].fp_kind = listRet.list[i].info.fp_kind
            listRet.list[i].name_kind = listRet.list[i].info.name_kind
            listRet.list[i].name = listRet.list[i].info.name
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].code = listRet.list[i].info.code
            listRet.list[i].fp_money = listRet.list[i].info.fp_money
            listRet.list[i].fp_extra = listRet.list[i].info.fp_extra
            listRet.list[i].wuliu = listRet.list[i].info.wuliu
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryOrderInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i].tips = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval).tips
                }else{
                    listRet.list[i].tips = '待审核'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-fapiao-list is empty'})
    }
}
