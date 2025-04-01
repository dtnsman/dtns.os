/**
 * Created by lauo.li on 2019/5/18.
 */
const str_filter = require('../libs/str_filter');
const notice_util = require('../libs/notice_util');
const gnode_format_util = require('../libs/gnode_format_util');
const config = require('../config').config;
const user_redis = require('..//config').user_redis;
// const user_m = require('../model/user_m');
// const order_c = require('./order_c');
const manager_c = require('./manager_c');
const rpc_api_util = require('../rpc_api_util')

const rpc_query = require('..//rpc_api_config').rpc_query
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

const SYSTEM_CASHOUT_ID = 'order_cashoutlist00000';

/**
 * 新提现订单
 * @type {userCashOut}
 */
module.exports.userCashOut =userCashOut;
async function userCashOut(req,res) {
    let {user_id, s_id ,money, account_kind,account,account_name,account_note,phone,random,sign} = str_filter.get_req_data(req);

    if(!account) return res.json({ret:false,msg:"account error"})
    if(!account_name) return res.json({ret:false,msg:"account_name error"})
    if(money != money-0) return res.json({ret:false,msg:"money error"})
    if(!account_kind) return res.json({ret:false,msg:"recv_kind error"})
    if(phone != phone-0 || (''+phone).length!=11) return res.json({ret:false,msg:"phone error"})
    if(!account_note) return res.json({ret:false,msg:"account_note error"})
    // weixin =  !weixin ?'':weixin
    // email = !email?'':email

    //校验session
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(config.redis_key+":new_classify:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":new_classify:"+user_id+random,random,120)


    //锁定签到处理（特别是支付特权等）----使用redis加lock操作。
    // let orderTime = await user_redis.get(config.redis_key+":userCashOut_lock:"+user_id)
    // if(orderTime && parseInt(new Date().getTime()/1000) - orderTime <120)
    // {
    //     return res.json({ret: false, msg: "cashout order is locked failed"});
    // }
    // user_redis.set(config.redis_key+":userCashOut_lock:"+user_id,parseInt(new Date().getTime()/1000) ,120)

    let userInfo =await s_queryUserCashoutID(user_id);
    if(!userInfo ) return res.json({ret:false,msg:"user-info is empty or failed"})
    let {cashout_rmb_id,cashout_order_id} = userInfo

    //创建一个order对象
    let forkRet = await rpc_query(ORDER_API_BASE + '/fork', {token: ORDER_TOKEN_ROOT,space:'cashout'})
    if(!forkRet || !forkRet.ret) return {ret:false,msg:'fork cashout-order-token failed'}

    //0--未处理
    //1--用户转帐到提现帐户成功（冻结帐户）
    //2--提现成功（会将钱转回到token-root
    //3--提现失败，会将钱转回到用户帐户。
    let order_id = forkRet.token_x;
    let orderInfo = {order_name:'提现',order_desc:'提现金额：'+money+'元',order_id,user_id,
         money, account_kind,account,account_name,account_note,phone,
        save_time: parseInt(new Date().getTime()/1000),order_status:0}

    //后续在config中保存着classify-product（也就是分类里面的产品）
    let assertRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: ORDER_TOKEN_ROOT,token_y: forkRet.token_x, opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save order-info failed'}

    let saveRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: cashout_order_id,token_y:order_id, opcode:'hold',
        opval:'add',extra_data:JSON.stringify(orderInfo)})
    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save user-cashout-order-info to list failed'}

    saveRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: SYSTEM_CASHOUT_ID,token_y:order_id, opcode:'hold',
        opval:'add',extra_data:JSON.stringify(orderInfo)})
    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save user-cashout-order-info to system-list failed'}

    //转帐处理：
    let rmbUserId = await rpc_api_util.s_query_token_id(RMB_API_BASE,RMB_TOKEN_ROOT,user_id);//order_c.s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
    let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
    let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

    if(orderInfo.money > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to cashout"})

    let sendRmbRet = await rpc_query(RMB_API_BASE+'/send',{token_x:rmbUserId,token_y:cashout_rmb_id,opval:money,extra_data:JSON.stringify(orderInfo)})
    if(!sendRmbRet ||!sendRmbRet.ret) return res.json({ret:false,msg:"send cashout-money to cashout-rmb-id failed"})

    orderInfo.order_status = 1;
    assertRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: ORDER_TOKEN_ROOT,token_y: order_id, opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'update user-cashout-order-info to status=1  failed'}

    // let userMsgId = await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,user_id);//shopping_c.s_queryUserMSGToken(user_id)
    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'您成功提交了提现订单（金额：'
    //         +money+'），请耐心等待处理!',extra_data:JSON.stringify(orderInfo)})

    res.json({ret:true,msg:'success'})
}

/**
 * 新提现订单
 * @type {newUserCashOut}
 */
module.exports.newUserCashOut =newUserCashOut;
async function newUserCashOut(req,res) {
    let {user_id, s_id ,money,type,random,sign} = str_filter.get_req_data(req);

    //校验session
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!type) return res.json({ret:false,msg:"type error"})
    if(type!='bank' && type!='alipay') return res.json({ret:false,msg:"type2 error"})
    if(money != money-0) return res.json({ret:false,msg:"money error"})

    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(config.redis_key+":new_classify:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":new_classify:"+user_id+random,random,120)



    let userInfo =await s_queryUserCashoutID(user_id);
    if(!userInfo ) return res.json({ret:false,msg:"user-info is empty or failed"})
    let {cashout_rmb_id,cashout_order_id} = userInfo

    //提现账户信息
    let data = {}
    let apply_type_text
    if(type == 'bank'){
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.bank_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
        data = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        apply_type_text = '银行卡'
    }else if(type == 'alipay'){
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.alipay_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
        data = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        apply_type_text = '支付宝账户'
    }



    //创建一个order对象
    let forkRet = await rpc_query(ORDER_API_BASE + '/fork', {token: ORDER_TOKEN_ROOT,space:'cashout'})
    if(!forkRet || !forkRet.ret) return {ret:false,msg:'fork cashout-order-token failed'}

    //0--未处理
    //1--用户转帐到提现帐户成功（冻结帐户）
    //2--提现成功（会将钱转回到token-root
    //3--提现失败，会将钱转回到用户帐户。
    let order_id = forkRet.token_x;
    let orderInfo = {order_name:'提现',order_desc:'提现金额：'+money+'元',order_id,user_id,apply_info:data,apply_type:type,apply_type_text:apply_type_text,
        money,create_time: parseInt(new Date().getTime()/1000),order_status:0,status_text:'审核中'}

    //后续在config中保存着classify-product（也就是分类里面的产品）
    let assertRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: ORDER_TOKEN_ROOT,token_y: forkRet.token_x, opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save order-info failed'}

    let saveRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: cashout_order_id,token_y:order_id, opcode:'hold',
        opval:'add',extra_data:JSON.stringify(orderInfo)})
    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save user-cashout-order-info to list failed'}

    saveRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: SYSTEM_CASHOUT_ID,token_y:order_id, opcode:'hold',
        opval:'add',extra_data:JSON.stringify(orderInfo)})
    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save user-cashout-order-info to system-list failed'}

    //转帐处理：
    let rmbUserId = await rpc_api_util.s_query_token_id(RMB_API_BASE,RMB_TOKEN_ROOT,user_id);//order_c.s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
    let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
    let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

    if(orderInfo.money > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to cashout"})

    let sendRmbRet = await rpc_query(RMB_API_BASE+'/send',{token_x:rmbUserId,token_y:cashout_rmb_id,opval:money,extra_data:JSON.stringify(orderInfo)})
    if(!sendRmbRet ||!sendRmbRet.ret) return res.json({ret:false,msg:"send cashout-money to cashout-rmb-id failed"})

    orderInfo.order_status = 1;
    assertRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: ORDER_TOKEN_ROOT,token_y: order_id, opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'update user-cashout-order-info to status=1  failed'}

    // let userMsgId = await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,user_id);//shopping_c.s_queryUserMSGToken(user_id)
    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'您成功提交了提现订单（金额：'
    //         +money+'），请耐心等待处理!',extra_data:JSON.stringify(orderInfo)})

    res.json({ret:true,msg:'success'})
}


/**
 * 得到用户的提现帐户
 * @type {s_queryUserCashoutID}
 */
module.exports.s_queryUserCashoutID =s_queryUserCashoutID;
async function s_queryUserCashoutID(user_id) {
    let userInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!userInfoRet || !userInfoRet.ret) return null
    let userInfo = JSON.parse(JSON.parse(userInfoRet.list[0].txjson).opval)

    let update_flag = false;
    if(!userInfo.cashout_rmb_id)
    {
        let forkRet = await rpc_query(RMB_API_BASE + '/fork', {token: RMB_TOKEN_ROOT,space:'cashout'})
        if(!forkRet || !forkRet.ret) return null;

        userInfo.cashout_rmb_id = forkRet.token_x;
        update_flag = true;
    }

    if(!userInfo.cashout_order_id)
    {
        let forkRet = await rpc_query(ORDER_API_BASE + '/fork', {token: ORDER_TOKEN_ROOT,space:'cashout00'})
        if(!forkRet || !forkRet.ret) return null;

        userInfo.cashout_order_id = forkRet.token_x;
        update_flag = true;
    }


    let system_cashout_id = SYSTEM_CASHOUT_ID
    let systemInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:system_cashout_id,opcode:'fork',begin:0,len:1})
    if(!systemInfoRet||!systemInfoRet.ret)
    {
        await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT, dst_token:system_cashout_id})
    }

    if(update_flag)
    {
        let assertRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data: user_id})
        if(!assertRet || !assertRet.ret) return null;
    }

    // userInfo.system_cashout_id = system_cashout_id;

    return userInfo;
}



/**
 * 处理提现
 * @type {dealCashoutOrder}
 */
module.exports.dealCashoutOrder =dealCashoutOrder;
async function dealCashoutOrder(req,res) {
    let {user_id, s_id,order_id,deal_status,deal_msg,random, sign} = str_filter.get_req_data(req)

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    if (!deal_msg) return res.json({ret: false, msg: "deal_msg error"})
    if (!deal_status ) return res.json({ret: false, msg: "deal_status error"})
    deal_status = deal_status-0
    if(deal_status!=2 && deal_status!=3) return res.json({ret: false, msg: "deal_status error"})
    //校验session
    let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if( !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"user no pm"})

    //防重放攻击
    str = await user_redis.get(config.redis_key+":dealCashoutOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":dealCashoutOrder:"+order_id+random,random,120)

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    orderInfo.order_status = orderInfo.order_status-0
    if(orderInfo.order_status!=1) return res.json({ret:false,msg:"order-status not payed, need order-status=1"})

    //锁定签到处理（特别是支付特权等）----使用redis加lock操作。
    let orderTime = await user_redis.get(config.redis_key+":userCashOut_lock:"+orderInfo.order_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime <120)
    {
        return res.json({ret: false, msg: "cashout order is locked failed"});
    }
    user_redis.set(config.redis_key+":userCashOut_lock:"+orderInfo.order_id,parseInt(new Date().getTime()/1000) ,120)

    let userInfo =await s_queryUserCashoutID(orderInfo.user_id);
    if(!userInfo ) return res.json({ret:false,msg:"user-info is empty or failed"})
    let {cashout_rmb_id,cashout_order_id} = userInfo

    orderInfo.order_status = deal_status;
    orderInfo.deal_status = deal_status;
    orderInfo.deal_msg = deal_msg;
    orderInfo.deal_time =  parseInt(new Date().getTime()/1000)
    orderInfo.deal_user_id = user_id;

    if(deal_status==2){
        orderInfo.status_text = '通过'
    }else if(deal_status==3){
        orderInfo.status_text = '拒绝'
    }
    


    //处理成功的提现
    if(deal_status==2)
    {
        let sendRmbRet = await rpc_query(RMB_API_BASE+'/send',{token_x:cashout_rmb_id,token_y:RMB_TOKEN_ROOT,opval:orderInfo.money,
            extra_data:JSON.stringify(orderInfo)})
        if(!sendRmbRet ||!sendRmbRet.ret) return res.json({ret:false,msg:"send cashout-money to system failed"})
    }else{
        let sendRmbRet = await rpc_query(RMB_API_BASE+'/send',{token_x:cashout_rmb_id,token_y: RMB_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],
            opval:orderInfo.money, extra_data:JSON.stringify(orderInfo)})
        if(!sendRmbRet ||!sendRmbRet.ret) return res.json({ret:false,msg:"send cashout-money back to user failed"})
    }


    let assertRet = await rpc_query(ORDER_API_BASE + '/op', {token_x: ORDER_TOKEN_ROOT,token_y: order_id, opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save order-info failed'}

    // let userMsgId = await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,orderInfo.user_id) ;//shopping_c.s_queryUserMSGToken(orderInfo.user_id)
    // let managerUserMsgId = await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,user_id)//await shopping_c.s_queryUserMSGToken(user_id)

    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'您的提现订单已经处理完成（金额：'
    //         +orderInfo.money+'，订单ID：'+order_id+'，提现结果：'+(deal_status==2?'成功':'退款'),extra_data:JSON.stringify(orderInfo)})

    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:managerUserMsgId,opval:'【提现管理】提现处理成功（金额：'
    //         +orderInfo.money+'，订单ID：'+order_id+'，提现结果：'+(deal_status==2?'成功':'退款'),extra_data:JSON.stringify(orderInfo)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 查看反馈。
 * @type {queryOrderInfo}
 */
module.exports.queryOrderInfo =queryOrderInfo;
async function queryOrderInfo(req,res) {
    let {user_id, s_id,shop_id,order_id,msg,random, sign} = str_filter.get_req_data(req)

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    //校验session
    let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let userInfo =await s_queryUserCashoutID(user_id);
    if(!userInfo ) return res.json({ret:false,msg:"user-info is empty or failed"})
    // let {feedback_list_id} = shopInfo

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if( orderInfo.user_id != user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"user no pm"})

    orderInfo.ret =true;
    orderInfo.msg = 'success'

    return res.json(orderInfo)
}

/**
 * 得到用户的提现订单纪录。
 * @type {queryUserOrderList}
 */
module.exports.queryUserOrderList =queryUserOrderList;
async function queryUserOrderList(req,res) {
    let {user_id, s_id, begin,len} = str_filter.get_req_data(req);

    //校验session
    let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str ) return res.json({ret: false, msg: "session error"})

    // if(!manager_c.isManagerUid(user_id)) return res.json({ret: false, msg: "no manager pm"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let userInfo =await s_queryUserCashoutID(user_id);
    if(!userInfo ) return res.json({ret:false,msg:"user-info is empty or failed"})
    let {cashout_rmb_id,cashout_order_id} = userInfo

    let list = await rpc_api_util.s_query_token_list(ORDER_API_BASE,cashout_order_id,'hold',begin*len,len);

    res.json({ret:true,msg:'success',list:list})

    // let listRet = await rpc_query(ORDER_API_BASE+'/chain/relations',{token:cashout_order_id,
    //     opcode:'hold',isx:true,begin:begin*len,len})
    // let list = !listRet ||!listRet.ret ? [] : listRet.list;

    // let objs = []
    // let queryInfoP = []
    // for(let i = 0;i<list.length;i++)
    // {
    //     let info = list[i]
    //     // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
    //     //放到数组中，等待处理。
    //     queryInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

    //     objs.push(info)
    // }

    // let newObjs = []
    // //查询分类数据
    // await Promise.all(queryInfoP).then(function(rets){
    //     // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
    //     for(let i =0;i<objs.length;i++)
    //     {
    //         let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
    //         newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
    //             :JSON.parse(rets[i].list[0].txjson).timestamp_i);
    //         newObjs.push(newInfo)
    //     }
    // })

    // if(newObjs&&newObjs.length>0)
    // {
    //     return res.json({ret:true,msg:'success',list:newObjs})
    // }

    // return  res.json({ret:false,msg:'order list is empty'});
}

/**
 * 查询所有提现订单纪录。
 * @type {queryOrderList}
 */
module.exports.queryOrderList =queryOrderList;
async function queryOrderList(req,res) {
    let {user_id, s_id, begin,len} = str_filter.get_req_data(req);

    //校验session
    let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str ) return res.json({ret: false, msg: "session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret: false, msg: "no manager pm"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    

    let list = await rpc_api_util.s_query_token_list(ORDER_API_BASE,SYSTEM_CASHOUT_ID,'hold',begin*len,len);

    res.json({ret:true,msg:'success',list:list})


    // let listRet = await rpc_query(ORDER_API_BASE+'/chain/relations',{token:SYSTEM_CASHOUT_ID,
    //     opcode:'hold',isx:true,begin:begin*len,len})
    // let list = !listRet ||!listRet.ret ? [] : listRet.list;

    // let objs = []
    // let queryInfoP = []
    // for(let i = 0;i<list.length;i++)
    // {
    //     let info = list[i]
    //     // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
    //     //放到数组中，等待处理。
    //     queryInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

    //     objs.push(info)
    // }

    // let newObjs = []
    // //查询分类数据
    // await Promise.all(queryInfoP).then(function(rets){
    //     // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
    //     for(let i =0;i<objs.length;i++)
    //     {
    //         let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
    //         newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
    //             :JSON.parse(rets[i].list[0].txjson).timestamp_i);
    //         newObjs.push(newInfo)
    //     }
    // })

    // if(newObjs&&newObjs.length>0)
    // {
    //     return res.json({ret:true,msg:'success',list:newObjs})
    // }

    // return  res.json({ret:false,msg:'order list is empty'});
}

//
// /**
//  * 查找反馈（由关键词（可以是地址，也可以是其他的））
//  * @type {search}
//  */
// module.exports.searchFeedbackList =searchFeedbackList;
// async function searchFeedbackList(req,res) {
//     let {user_id, s_id, search_key,shop_id, begin,len} = str_filter.get_req_data(req);
//
//     if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
//     if (!search_key) return res.json({ret: false, msg: "search_key error"})
//     search_key = search_key.toLowerCase()
//     //校验session
//     let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
//     if (!str && !secret_key) return res.json({ret: false, msg: "session error"})
//
//     if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
//     if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
//     begin = begin - 1
//     // len = begin*len;
//
//     let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
//     if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
//     let {Feedback_list_id,Feedback_toplist_id} = shopInfo
//
//     let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:Feedback_list_id, opcode:'hold',isx:true,begin:0,len:100000})
//     let list = !listRet ||!listRet.ret ? [] : listRet.list;
//
//     let objs = []
//     let queryInfoP = []
//     for(let i = 0;i<list.length;i++)
//     {
//         let info = list[i]
//         // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
//         //放到数组中，等待处理。
//         queryInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))
//
//         objs.push(info)
//     }
//
//     let newObjs = [],cnt=0
//     //查询分类数据
//     await Promise.all(queryInfoP).then(function(rets){
//         // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
//         for(let i =0;i<objs.length;i++)
//         {
//             let str = JSON.parse(rets[i].list[0].txjson).opval.toLowerCase();
//             let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
//             newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
//                 :JSON.parse(rets[i].list[0].txjson).timestamp_i);
//             if(str.indexOf(search_key)>=0)
//             {
//                 cnt++
//
//                 if(cnt>=(begin-0)*(len-0) && cnt<(parseInt(begin)+1)*parseInt(len))
//                     newObjs.push(newInfo)
//             }
//         }
//     })
//
//     if(newObjs&&newObjs.length>0)
//     {
//         return res.json({ret:true,msg:'success',list:newObjs})
//     }
//
//     return  res.json({ret:false,msg:'Feedback list is empty'});
// }

/**
 * 查找未处理的订单
 * @type {queryUndealList}
 */
module.exports.queryUndealList =queryUndealList;
async function queryUndealList(req,res) {
    let {user_id, s_id, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str ) return res.json({ret: false, msg: "session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret: false, msg: "no manager pm"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/relations',{token:SYSTEM_CASHOUT_ID,
        opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = [],cnt=0
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
                :JSON.parse(rets[i].list[0].txjson).timestamp_i);
            if(!newInfo.deal_status) {
                cnt++;
                if (cnt >= parseInt(begin) * parseInt(len) && cnt < parseInt(begin + 1) * parseInt(len)) {
                    newObjs.push(newInfo)
                }
            }
        }
    })

    if(newObjs&&newObjs.length>0)
    {
        return res.json({ret:true,msg:'success',list:newObjs})
    }

    return  res.json({ret:false,msg:'order list is empty'});
}


/**
 * 查找已经处理的反馈
 * @type {queryDealList}
 */
module.exports.queryDealList =queryDealList;
async function queryDealList(req,res) {
    let {user_id, s_id, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str ) return res.json({ret: false, msg: "session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret: false, msg: "no manager pm"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/relations',{token:SYSTEM_CASHOUT_ID,
        opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = [],cnt=0
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
                :JSON.parse(rets[i].list[0].txjson).timestamp_i);
            if(newInfo.deal_status) {
                cnt++;
                if (cnt >= parseInt(begin) * parseInt(len) && cnt < parseInt(begin + 1) * parseInt(len)) {
                    newObjs.push(newInfo)
                }
            }
        }
    })

    if(newObjs&&newObjs.length>0)
    {
        return res.json({ret:true,msg:'success',list:newObjs})
    }

    return  res.json({ret:false,msg:'order list is empty'});
}



////////////////////////////////提现方式////////////////////////////////////
/**
 * 修改提现账户信息
 * @type {modifyBankinfo}
 */
module.exports.modifyBankinfo =modifyBankinfo;
async function modifyBankinfo(req, res) {
    let {user_id,s_id,type,real_name,card_no,bank_name} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!type) return res.json({ret:false,msg:"type error"})
    if(type!='bank' && type!='alipay') return res.json({ret:false,msg:"type2 error"})

    if(type == 'bank'){
        if(!bank_name) return res.json({ret:false,msg:"bank_name error"})
    }else if(type == 'alipay'){
        bank_name = '支付宝账户'
    }

    if(!real_name) return res.json({ret:false,msg:"real_name error"})
    if(!card_no) return res.json({ret:false,msg:"card_no error"})

    let data ={user_id, type,bank_name,real_name,card_no}

    let dataObj = {}

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let userInfo = JSON.parse(JSON.parse(ret.list[0].txjson).opval);

    if(type == 'bank'){
        if(!userInfo.bank_id){
            let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'bankID'})
            if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork bankID failed"});
            userInfo.bank_id = forkRet.token_x
            let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
                opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
            if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo bank_id failed"});

            data.id =  userInfo.bank_id
            data.create_time = parseInt(new Date().getTime()/1000);

            dataObj = data
        }else{
            let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.bank_id,opcode:'assert',begin:0,len:1})
            if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
            let olddata = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

            data.update_time = parseInt(new Date().getTime()/1000);

            let newdata = {}
            newdata = Object.assign(newdata,olddata,data)
            dataObj = newdata
        }
        let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.bank_id,opcode:'assert',
         opval:JSON.stringify(dataObj),extra_data: user_id})
        if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert bank-update-obj-info failed"});

    }else if(type == 'alipay'){
        if(!userInfo.alipay_id){
            let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'alipayID'})
            if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork alipayID failed"});
            userInfo.alipay_id = forkRet.token_x
            let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
                opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
            if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo alipayID failed"});

            data.id =  userInfo.alipay_id
            data.create_time = parseInt(new Date().getTime()/1000);

            dataObj = data
        }else{
            let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.alipay_id,opcode:'assert',begin:0,len:1})
            if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
            let olddata = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

            data.update_time = parseInt(new Date().getTime()/1000);

            let newdata = {}
            newdata = Object.assign(newdata,olddata,data)
            dataObj = newdata
        }
        let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.alipay_id,opcode:'assert',
         opval:JSON.stringify(dataObj),extra_data: user_id})
        if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert alipay-update-obj-info failed"});


    }

    res.json({ret:true,msg:'success',data:dataObj})
}

/**
 * 查询提现方式信息
 * @type {queryBankinfo}
 */
module.exports.queryBankinfo =queryBankinfo;
async function queryBankinfo(req, res) {
    let {user_id,s_id,type,random} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!type) return res.json({ret:false,msg:"type error"})
    if(type!='bank' && type!='alipay') return res.json({ret:false,msg:"type2 error"})


    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let userInfo = JSON.parse(JSON.parse(ret.list[0].txjson).opval);

    if(type == 'bank'){
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.bank_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
        let data = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

        res.json({ret:true,msg:'success',data:data})
    }else if(type == 'alipay'){
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.alipay_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
        let data = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

        res.json({ret:true,msg:'success',data:data})
    }

}





























