/**
 * Created by lauo.li on 2019/3/26.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const gnode_format_util = require('../libs/gnode_format_util');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const user_c = require('./user_c')
// // const user_m = require('../model/user_m');

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
window.order_c = {}
// const rpc_api_util = require('../rpc_api_util')
/**
 * 分为不同等级的会员（可进入不同的群）
 * @param {*} vip_level 
 */
async function s_queryOrderVipPrice(vip_level)
{
    console.log('s_queryOrderVipPrice-vip_level:',vip_level)
    if(vip_level<0) return 99999999//0;
    if(vip_level>9) return 99999999//0;

    let list = await get_vip_level_rights()
    console.log('s_queryOrderVipPrice-get_vip_level_rights-list:',list)
    if(!list) return 99999999//0

    return list[vip_level].price;
}

const DEFAULT_VIP_LEVEL_RIGHT_INFOS = [
    {
        vip_level:0,
        price : 0,
        vip_rights:'权益：进入所有的普通群聊'
    },
    {
        vip_level:1,
        price : 9,
        vip_rights:'权益：进入VIP1和普通群聊'
    },
    {
        vip_level:2,
        price : 19,
        vip_rights:'权益：进入VIP2等级以下的群聊'
    },
    {
        vip_level:3,
        price : 59,
        vip_rights:'权益：进入VIP3等级以下的群聊'
    },
    {
        vip_level:4,
        price : 99,
        vip_rights:'权益：进入VIP4等级以下的群聊'
    },
    {
        vip_level:5,
        price : 159,
        vip_rights:'权益：进入VIP5等级以下的群聊'
    },
    {
        vip_level:6,
        price : 399,
        vip_rights:'权益：进入VIP6等级以下的群聊'
    },
    {
        vip_level:7,
        price : 599,
        vip_rights:'权益：进入VIP7等级以下的群聊'
    },
    {
        vip_level:8,
        price : 799,
        vip_rights:'权益：进入VIP8等级以下的群聊'
    },
    {
        vip_level:9,
        price : 999,
        vip_rights:'权益：进入VIP9等级以下的群聊'
    }
]
window.order_c.get_vip_level_rights =get_vip_level_rights;
async function get_vip_level_rights() {
    let list = await rpc_api_util.s_query_token_info(VIP_API_BASE,VIP_TOKEN_ROOT,'config')
    console.log('get_vip_level_rights-s_query_token_info-list:',list)
    if(!list) list = DEFAULT_VIP_LEVEL_RIGHT_INFOS;
    return list;
}
/**
 * 得到vip的权限信息列表
 */
window.order_c.query_vip_right_info =query_vip_right_info;
async function query_vip_right_info(req, res) {
    let list = await get_vip_level_rights()
    if(list) res.json({ret:true,msg:'success',list})
    else res.json({ret:false,msg:'vip-level-rights-list is empty'})
}
/**
 * 查询订单的情况
 * @type {query_order_info}
 */
window.order_c.query_order_info =query_order_info;
async function query_order_info(req, res) {
    //order_id ，pay_type（余额、支付宝、微信、积分、代金券、会员特权）,pay_type_id（例如代金券id）
    let {order_id, random, sign} = str_filter.get_req_data(req);
    if(!order_id) return res.json({ret:false,msg:"order_id error"})
    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":pay_vip_buy_order:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_vip_buy_order:"+order_id+random,random,120)

    //查询订单状态--//查询order_id对应的obj_id的相应情况。
    let assertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    if(!assertOrderRet ||!assertOrderRet.ret) return res.json({ret:false,msg:"order-info is null"})
    let orderInfo = JSON.parse(JSON.parse(assertOrderRet.list[0].txjson).opval);
    orderInfo.ret = true;
    orderInfo.msg = "success"

    res.json(orderInfo)
}
/**
 * 创建一个vip订单记录。
 * @type {new_vip_buy_order}
 */
window.order_c.new_vip_buy_order =new_vip_buy_order;
async function new_vip_buy_order(req, res) {

    //vip_level等级，order_num（订单数量）,vip_buy_type（0默认按年，1不支持按月）
    //vip_pay_type{account,weixin,alipay,gsb,pcash,vip}----就仅仅支持人民币支付（当前 ）
    let {user_id,s_id,order_name,order_type,extra_data,vip_level,vip_pay_type,vip_buy_type,order_num,random,sign} = str_filter.get_req_data(req);
    if(!order_name) return res.json({ret: false, msg: "order_name format error"})
    if(!order_type) return res.json({ret: false, msg: "order_type format error"})
    if(!extra_data) return res.json({ret: false, msg: "extra_data format error"})

    if(vip_level!=vip_level*1 || vip_level<=0|| vip_level>9) return res.json({ret: false, msg: "vip_level format error"})
    if(!vip_pay_type) return res.json({ret: false, msg: "vip_pay_type format error"})
    if(!vip_buy_type) return res.json({ret: false, msg: "vip_buy_type format error"})
    if(order_num!=order_num*1 || order_num!=parseInt(order_num) || order_num<0) return res.json({ret: false, msg: "order_num format error"})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_vip_buy_order:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_vip_buy_order:"+user_id+random,random,120)

    //查询用户的VIP情况（如果已购买更高级别，则返回错误信息）
    let token_name = str_filter.create_token_name_pre(VIP_TOKEN_ROOT,user_id.split('_')[1]);
    let qRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:token_name,opcode:'fork',begin:0,len:1})
    if(!qRet || !qRet.ret)
    {
        let forkRet = await rpc_query(VIP_API_BASE+"/fork",{token:VIP_TOKEN_ROOT,dst_token:token_name})
        if(!forkRet || !forkRet.ret) return res.json({ret: false, msg: "fork vip-token failed"});
    }

    let listRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:token_name,opcode:'assert',begin:0,len:1})
    let vipObjInfo = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : null;

    if(vipObjInfo && vipObjInfo.vip_level > vip_level) return res.json({ret: false, msg: "already have high-level-vip",vip_info:vipObjInfo})

    //创建一个order_viplevel订单（价格，原价格，实付金额，数量，到期时间等）
    let forkOrderRet = await rpc_query(ORDER_API_BASE+"/fork",{token:ORDER_TOKEN_ROOT,space:'vip'+vip_level})
    if(!forkOrderRet ||!forkOrderRet.ret) return res.json({ret:false,msg:"fork vip-order-token failed"})

    vip_level = vip_level-0
    let orderInfo = {vip_level}


    //如果是有更低级别（计算价格差额）---
    let vip_price = await s_queryOrderVipPrice(vip_level)
    if(vip_price<=0){
        console.log('[Error] vip_price is zero :',vip_price)
        return res.json({ret:false,msg:'[Error] vip_price is zero'})
    }
    orderInfo.vip_price = vip_price
    orderInfo.pay_money =  vip_price * order_num
    let order_time = parseInt(new Date().getTime()/1000)
    orderInfo.pay_money_now = orderInfo.pay_money
    if(vipObjInfo && vipObjInfo.vip_timeout > order_time) {
        //扣除剩余费用。
        let lastMoney = vip_price * (vipObjInfo.vip_timeout-order_time) / (24* 60 *60 *365)
        lastMoney = Math.round(lastMoney*100)/100;
        orderInfo.pay_money_now = (vip_price * order_num) - lastMoney
    }

    orderInfo.order_id = forkOrderRet.token_x
    orderInfo.user_id = user_id;
    orderInfo.order_name = order_name
    orderInfo.order_type = order_type
    orderInfo.extra_data = extra_data
    orderInfo.vip_token = token_name
    orderInfo.vip_price = vip_price
    orderInfo.order_num = order_num
    orderInfo.vip_pay_type = vip_pay_type
    orderInfo.order_time = order_time
    orderInfo.order_status='new'//stop  success

    console.log("vip-order-info:"+JSON.stringify(orderInfo))
    //将订单信息放到订单assert状态中。
    let assertOrderRet = await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,
        token_y:forkOrderRet.token_x,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertOrderRet ||!assertOrderRet.ret) return res.json({ret:false,msg:"assert vip-order-info failed"})

    //将该订单id保存到用户订单表中（使用对应的order_userid纪录）---send为整体订单，assert为已支付订单。
    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(!userOrderToken) return res.json({ret: false, msg: "get user-order-token failed"});
    let sendOrder2UserRet = await rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,
        opval:JSON.stringify(orderInfo),extra_data:forkOrderRet.token_x})
    if(!sendOrder2UserRet ||!sendOrder2UserRet.ret) return res.json({ret:false,msg:"save user vip-order-info failed"})

    //返回订单情况。
    orderInfo.ret = true;
    orderInfo.msg = "success"

    return res.json(orderInfo)
}
/**
 * 支付一个vip订单
 * @type {pay_vip_buy_order}
 */
window.order_c.pay_vip_buy_order =pay_vip_buy_order;
async function pay_vip_buy_order(req, res) {

    //order_id ，pay_type（余额、支付宝、微信、积分、代金券、会员特权）,pay_type_id（例如代金券id）
    let {user_id, s_id, order_id, random, sign} = str_filter.get_req_data(req);
    if(!order_id) return res.json({ret:false,msg:"order_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":pay_vip_buy_order:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_vip_buy_order:"+order_id+random,random,120)

    //锁定订单处理（特别是支付特权等）----使用redis加lock操作。
    let orderTime = await user_redis.get(ll_config.redis_key+":pay_vip_buy_order_lock:"+order_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime >120)
    {
        return res.json({ret: false, msg: "order is locked failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_vip_buy_order_lock:"+order_id,parseInt(new Date().getTime()/1000) ,120)

    //查询订单状态--//查询order_id对应的obj_id的相应情况。
    let assertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})

    if(!assertOrderRet ||!assertOrderRet.ret)
    {
        await str_filter.sleep(1000);
        assertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    }

    if(!assertOrderRet ||!assertOrderRet.ret) return res.json({ret:false,msg:"query vip-order-info failed"})
    let vipOrderInfo = JSON.parse(JSON.parse(assertOrderRet.list[0].txjson).opval);
    if(vipOrderInfo.user_id != user_id) return res.json({ret:false,msg:"vip-order user_id unmatch"})
    if(vipOrderInfo.order_status == 'success') return res.json({ret:false,msg:"vip-order already pay"})

    //查询用户的VIP情况（如果已购买更高级别，则返回错误信息）
    let token_name = str_filter.create_token_name_pre(VIP_TOKEN_ROOT,user_id.split('_')[1]);
    let listRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:token_name,opcode:'assert',begin:0,len:1})
    let vipObjInfo = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : null;

    if(vipObjInfo && vipObjInfo.vip_level > vipOrderInfo.vip_level) return res.json({ret: false, msg: "user already have high-level-vip",vip_info:vipObjInfo,order_info:vipOrderInfo});
    //由pay_type核算特权、价格、余额信息。并且完成支付操作（余额不足、特权权限不足，则返回出错信息）。

    let rmbUserId = await s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
    let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
    let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

    vipOrderInfo.vip_price = vipOrderInfo.vip_price-0
    vipOrderInfo.order_num = vipOrderInfo.order_num -0
    //计算真实的扣费数额：
    let pay_time = parseInt(new Date().getTime()/1000)
    vipOrderInfo.pay_money_real = vipOrderInfo.pay_money
    if(vipObjInfo && vipObjInfo.vip_timeout > pay_time && vipOrderInfo.vip_level> vipObjInfo.vip_level) {
        //扣除剩余费用。
        let lastMoney = (vipObjInfo.vip_price-0) * (vipObjInfo.vip_timeout-pay_time) / (24* 60 *60 *365)
        lastMoney = Math.round(lastMoney*100)/100;
        vipOrderInfo.pay_money_real = (vipOrderInfo.vip_price * vipOrderInfo.order_num) - lastMoney
        vipOrderInfo.pay_money_real = Math.round(vipOrderInfo.pay_money_real*100)/100;
    }

    if(vipOrderInfo.pay_money_real > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to pay order"})

    //扣费--只有真实扣费>0才能扣费
    if(vipOrderInfo.pay_money_real >0) {
        let userSendRet = await rpc_query(RMB_API_BASE + "/send", {
            token_x: rmbUserId,
            token_y: RMB_TOKEN_ROOT,
            opval: vipOrderInfo.pay_money_real,
            extra_data: JSON.stringify(vipOrderInfo)
        })
        if (!userSendRet || !userSendRet.ret) return res.json({ret: false, msg: "user-wallet pay failed"})
    }

    vipOrderInfo.order_status = 'success'
    vipOrderInfo.pay_time = pay_time

    //修改订单状态（转帐成功之后才能进行update-order-status
    let assertVipOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:vipOrderInfo.order_id,opcode:'assert',opval:JSON.stringify(vipOrderInfo),extra_data:vipOrderInfo.user_id})
    if(!assertVipOrderRet || !assertVipOrderRet.ret) return {ret: false, msg: "assert order-status failed"};

    //刷新vip_userid的相应的config信息（也就是到期时间，vip特权情况等）。
    if(vipObjInfo && vipObjInfo.vip_level == vipOrderInfo.vip_level)
    {
        //续费
        vipOrderInfo.vip_timeout = (vipObjInfo.vip_timeout >=vipOrderInfo.pay_time ? vipObjInfo.vip_timeout:vipOrderInfo.pay_time)   + (vipOrderInfo.order_num * 24 * 60 *60 *365)
    }else{
        //新开（或者断续后再开）
        vipOrderInfo.vip_timeout = vipOrderInfo.pay_time + (vipOrderInfo.order_num * 24 * 60 *60 *365)
    }

    let assertOrder2UserRet = await rpc_query(VIP_API_BASE+"/op",{token_x:VIP_TOKEN_ROOT,token_y:token_name,opcode:'assert',
        opval:JSON.stringify(vipOrderInfo),extra:vipOrderInfo.order_id})
    if(!assertOrder2UserRet ||!assertOrder2UserRet.ret) return res.json({ret:false,msg:"update user vip-info failed"})

    //2020-5-11 增加一个全局的会员列表。---采用assert可行？
    let add2ListRet = await rpc_api_util.s_save_into_token_list(VIP_API_BASE,VIP_TOKEN_ROOT,token_name,'relv','add vip-user to vip-list');
    if(!add2ListRet){
        add2ListRet = await rpc_api_util.s_save_into_token_list(VIP_API_BASE,VIP_TOKEN_ROOT,token_name,'relv','add vip-user to vip-list');
    }
    console.log('add2ListRet:'+token_name+' add2flag:'+add2ListRet)

    //将该订单id保存到用户订单表中（使用对应的order_userid纪录）---send为整体订单，assert为已支付订单。
    await rpc_query(VIP_API_BASE+"/send",{token_x:VIP_TOKEN_ROOT,token_y:token_name, opval:JSON.stringify(vipOrderInfo),extra:vipOrderInfo.order_id})

    // //将订单信息放到订单assert状态中。
    await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT, token_y:vipOrderInfo.order_id,opcode:'assert',opval:JSON.stringify(vipOrderInfo),extra:user_id})

    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(userOrderToken) {
        await rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,opval:JSON.stringify(vipOrderInfo), extra:vipOrderInfo.order_id})
    }

    //这里需要退款给用户----仅当vip会员的情况下--------------------------------------------------------------------
    if(vipOrderInfo.pay_money_real<0 && vipObjInfo && vipObjInfo.vip_pay_type == 'rmb'){
        let userSendRet = await rpc_query(RMB_API_BASE + "/send",{token_x:RMB_TOKEN_ROOT,token_y:rmbUserId,
            opval:(-vipOrderInfo.pay_money_real),extra_data: vipOrderInfo.order_id});
        console.log("send back rmb to user !  userSendRet:"+JSON.stringify(userSendRet))
        //if (!userSendRet || !userSendRet.ret) return res.json({ret: false, msg: "user-wallet pay failed"})
    }
    //-----------------------------------------------------------------------------------------------------------

    if(!vipObjInfo )
    {
        //新开（对邀请人进行奖励）。
        rewardInviteUserVIPBuyRMB(user_id,vipOrderInfo)
    }

    //返回订单支付情况。
    vipOrderInfo.ret = true;
    vipOrderInfo.msg = "success"
    res.json(vipOrderInfo)
}


/**
 * 对购买会员进行人民币奖励
 * @param orderToken
 * @returns {Promise<void>}
 */
async function rewardInviteUserVIPBuyRMB(user_id,vipOrderInfo)
{
    //查询奖励VIP金额比率。
    let {invite_type,score_reward,vip_reward,rmb_reward} = await user_c.get_invite_setting();


    let assertUserRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserRet || !assertUserRet.ret) return res.json({ret: false, msg: "query user-info failed"})

    let buyUserInfo = JSON.parse(JSON.parse(assertUserRet.list[0].txjson).opval)
    if(!buyUserInfo.by_invite_code){
        //return {ret: false, msg: "by_invite_code is null"}
        console.log("by_invite_code is null")
    }

    delete buyUserInfo.pwd
    delete buyUserInfo.salt
    let orderToken =ORDER_TOKEN_NAME+"_"+buyUserInfo.by_invite_code

    let assertRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:orderToken,opcode:'assert',begin:0,len:1})
    if(!assertRet || !assertRet.ret){
        //return {ret: false, msg: "query ByInviteCode assert user-info failed"}
        console.log("query ByInviteCode assert user-info failed")
    }

    let userInfo = JSON.parse(JSON.parse(assertRet.list[0].txjson).opval)
    if(userInfo.invite_code !=buyUserInfo.by_invite_code ){
        // return {ret: false, msg: "user ByInviteCode != inviteUser.invite_code"}
        console.log("user ByInviteCode != inviteUser.invite_code")
    }

    let userTokenID = userInfo.user_id.split('_')[1]

    let assertVipRet = await rpc_query(VIP_API_BASE+'/chain/opcode',{token:VIP_TOKEN_NAME+"_"+userTokenID,opcode:'assert',begin:0,len:1})
    if(!assertVipRet || !assertVipRet.ret){
        //return {ret: false, msg: "query ByInviteCode assert user-info failed"}
        console.log("query assertVipRet user-info failed;   by_invite_code user is not vip!")

        //发送消息纪录
        rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+userTokenID,
            opval:'【奖励失败】用户（'+buyUserInfo.user_name+"）购买会员VIP"+vipOrderInfo.vip_level+"；由于您不是VIP1以上会员，无法获得现金奖励，预计损失："+
                (Math.round( vipOrderInfo.pay_money_real * 0.5 *100)/100)+"元人民币", extra_data:JSON.stringify(buyUserInfo)});
        return ;
    }
    let nowTime = parseInt(new Date().getTime()/1000)
    let userVipInfo = JSON.parse(JSON.parse(assertVipRet.list[0].txjson).opval)
    if(userVipInfo.vip_level <=0  || userVipInfo.vip_timeout <= nowTime)
    {
        console.log("vip_level is 0 or vip_timeout ; VIP-JSON:"+JSON.stringify(userVipInfo))

        //发送消息纪录
        rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+userTokenID,
            opval:'【奖励失败】用户（'+buyUserInfo.user_name+"）购买会员VIP"+vipOrderInfo.vip_level+"；由于您的会员已过期，无法获得现金奖励，预计损失："+
                (Math.round( vipOrderInfo.pay_money_real * 0.5 *100)/100)+"元人民币", extra_data:JSON.stringify(buyUserInfo)});
    }


    buyUserInfo.gsb = 0 //奖励的数值
    //按vip_reward进行奖励人民币
    buyUserInfo.vip_reward = vip_reward
    buyUserInfo.rmb = Math.round( vipOrderInfo.pay_money_real * vip_reward )/100;
    buyUserInfo.invite_time = parseInt(new Date().getTime()/1000)
    buyUserInfo.invite_order_name = '首次购买VIP会员返利'

    //保存一条成功邀请的纪录(order链上）。
    rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:orderToken,opval:JSON.stringify(buyUserInfo),extra_data:user_id});

    //发送消息纪录
    rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+userTokenID,
        opval:'用户（'+buyUserInfo.user_name+"）购买会员VIP"+vipOrderInfo.vip_level,
        extra_data:JSON.stringify(buyUserInfo)});

    //做激励---查询与之对应的user_id，然后对gsb_id进行激励。
    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:RMB_TOKEN_ROOT,token_y:RMB_TOKEN_NAME+"_"+userTokenID,
        opval:buyUserInfo.rmb,extra_data:JSON.stringify(buyUserInfo)});
    if(!sendRet || !sendRet.ret)
    {
        let msg = "send invite-user RMB failed! msg:"+sendRet.msg
        console.log(msg);
        // return {ret:false,msg}
    }

    rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+userTokenID,
        opval:'【奖励成功】用户（'+buyUserInfo.user_name+"）购买会员VIP"+vipOrderInfo.vip_level+"；您作为邀请人获得现金奖励，奖励："+
            (Math.round( vipOrderInfo.pay_money_real * 0.5 *100)/100)+"元人民币", extra_data:JSON.stringify(buyUserInfo)});

    console.log("send RMB success ");
    // return {ret:false,msg:"send RMB success "}
}


/**
 * 查询用户的RMB-token（如果不存在，就fork）
 * @returns {Promise<*>}
 */
window.order_c.s_queryUserRMBToken =s_queryUserRMBToken;
async function s_queryUserRMBToken(user_id)
{
    let rmbUserId = str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);

    let qRmbTokenRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'fork',begin:0,len:1})
    if(!qRmbTokenRet || !qRmbTokenRet.ret)
    {
        let forkRet = await rpc_query(RMB_API_BASE+"/fork",{token:RMB_TOKEN_ROOT,dst_token:rmbUserId})
        if(!forkRet || !forkRet.ret) return null
    }

    return rmbUserId
}

/**
 * 查询用户的信息（包含了手机号码，邮箱等）。
 * @param user_id
 * @returns {Promise<null>}
 */
async function s_queryUserInfo(user_id)
{
    let userInfoRet = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1})
    if(!userInfoRet || !userInfoRet.ret)
    {
        return null
    }
    let userInfo = userInfoRet&& userInfoRet.ret ? JSON.parse(JSON.parse(userInfoRet.list[0].txjson).opval) : null;

    return userInfo
}

/**
 * 查询用户的订单token（如果不存在，就fork）
 * @returns {Promise<*>}
 */
async function s_queryUserOrderToken(user_id)
{
    let userOrderToken = str_filter.create_token_name_pre(ORDER_TOKEN_ROOT,user_id.split('_')[1]);
    let qUserOrderTokenRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:userOrderToken,opcode:'fork',begin:0,len:1})
    if(!qUserOrderTokenRet || !qUserOrderTokenRet.ret)
    {
        let forkUserOrderRet = await rpc_query(ORDER_API_BASE+"/fork",{token:ORDER_TOKEN_ROOT,dst_token:userOrderToken})
        if(!forkUserOrderRet || !forkUserOrderRet.ret) return null
    }

    return userOrderToken
}

/**
 * 新的队列中（每1分钟检测一次，是否还存在未创建队列）。
 * @returns {Promise<*>}
 */
async function s_queryGnodeNewListOBJToken()
{
    let gnodenewlistToken = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'gnodenewlist');
    let qTokenRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:gnodenewlistToken,opcode:'fork',begin:0,len:1})
    if(!qTokenRet || !qTokenRet.ret)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:gnodenewlistToken})
        if(!forkRet || !forkRet.ret) return null
    }

    return gnodenewlistToken
}

/**
 * 查询用户的Obj-token（如果不存在，就fork）---用来保存node和gnode等云链主机产品（暂时不包含源码等）。
 * @returns {Promise<*>}
 */
window.order_c.s_queryUserObjToken =s_queryUserObjToken;
async function s_queryUserObjToken(user_id)
{
    let userObjToken = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,user_id.split('_')[1]);
    let qUserObjTokenRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'fork',begin:0,len:1})
    if(!qUserObjTokenRet || !qUserObjTokenRet.ret)
    {
        let forkUserObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:userObjToken})
        if(!forkUserObjRet || !forkUserObjRet.ret) return null
    }

    return userObjToken
}


/**
 * 人民币充值订单创建
 * @type {new_rmb_recharge_order}
 */
window.order_c.new_rmb_recharge_order =new_rmb_recharge_order;
async function new_rmb_recharge_order(req, res) {
    //pay_num订单金额，pay_type（支付类型：支付宝、微信、银行卡支付、短信支付）
    let {user_id, s_id, order_name,order_type,pay_money,pay_type,extra_data,random, sign} = str_filter.get_req_data(req);

    if(pay_money!=pay_money*1 || pay_money!=parseInt(pay_money) || pay_money<=0) return res.json({ret: false, msg: "pay_money format error"})
    if(!pay_type) return res.json({ret: false, msg: "pay_type format error"})
    if(!extra_data) return res.json({ret: false, msg: "extra_data format error"})
    if(!order_name) return res.json({ret: false, msg: "order_name format error"})
    if(!order_type) return res.json({ret: false, msg: "order_type format error"})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_rmb_recharge_order:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_rmb_recharge_order:"+user_id+random,random,120)

    let forkRet =   await rpc_query(ORDER_API_BASE+"/fork",{token:ORDER_TOKEN_ROOT,space:'rmb'})
    if(!forkRet || !forkRet.ret) return res.json({ret: false, msg: "fork order-token failed"});

    let obj = {user_id,order_name,order_type,pay_money,pay_type,extra_data,order_time:parseInt(new Date().getTime()/1000),order_status:'new',order_id:forkRet.token_x}
    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:forkRet.token_x,opcode:'assert',opval:JSON.stringify(obj),extra_data:user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return res.json({ret: false, msg: "assert order-info failed"});

    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(!userOrderToken) return res.json({ret: false, msg: "get user-order-token failed"});

    let sendUserOrderRet =   await rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,opval:JSON.stringify(obj),extra_data:forkRet.token_x})
    if(!sendUserOrderRet || !sendUserOrderRet.ret) return res.json({ret: false, msg: "assert user-order-info failed"});

    // let rmbUserId = await s_queryUserRMBToken(user_id)
    // //2020-4-11 pay_money测试期间强制为1分钱
    // let payParam={order_number:forkRet.token_x,order_name,pay_money:0.01,auto:1,version:1,extra_data:"云支付自动充值",notify_url:null}
    // let payRet = await rpc_query(RMB_API_BASE+"/op",{token_x:RMB_TOKEN_ROOT,token_y:rmbUserId,opval:JSON.stringify(payParam),
    //     opcode:'pay',extra_data:forkRet.token_x})

    // if(!payRet || !payRet.xdtns_cloud_func_ret || !payRet.xdtns_cloud_func_ret.ret)
    // {
    //     obj.ret = true;
    //     obj.msg = "create pay-url failed"
    //     return res.json(obj)
    // }


    // let weixinPayUrl = payRet.xdtns_cloud_func_ret.pay_url;
    // let content = '提醒您，您的订单还未完成支付！支付链接为：'+weixinPayUrl+'，点击链接继续完成订单支付操作!'
    // let queryUserInfo = await s_queryUserInfo(user_id)
    // if(queryUserInfo) {
    //     notice_util.send_email(queryUserInfo.email?queryUserInfo.email:'251499600@qq.com', '【朋友电商云】充值订单待支付', content);
    //     // notice_util.send_sms(queryUserInfo.nation_code, queryUserInfo.phone, obj.order_id,331351)//330762//303762/331351
    //     //341959	普通短信	2019-05-29 13:20:01	用户告警短信	提醒您，您的订单还未完成支付，请及时处理！订单号：{1}  已通过
    //     //notice_util.send_sms(queryUserInfo.nation_code, queryUserInfo.phone, weixinPayUrl+"。请点击链接完成支付，感谢支持！验证码：123456",341959)
    // }
    let payUrlRes = null
    if(typeof g_forklist_user!='undefined')
    {
        req.obj_id = '0'
        req.obj = Object.assign({},obj,{rmb_price:obj.pay_money})
        req.order_id = forkRet.token_x
        payUrlRes =  await new Promise((resolve)=>{
            forklist_pay_c.forklist_pay(req,{json:function(data){
                resolve(data)
            }})
            setTimeout(()=>resolve(null),30000)
        }) 
        console.log('new_rmb_recharge_order-call-forklist_pay_c.forklist_pay-payUrlRes:',payUrlRes)
    }
    else{
        payUrlRes = await new Promise((resolve)=>{
            forklist_pay_c.h5_pay({params:{order_id:forkRet.token_x,user_id,s_id,random:Date.now()+'-'+Math.random()}},
            {json:function(data){
                resolve(data)
            }})
            setTimeout(()=>resolve(null),30000)
        }) 
        console.log('new_rmb_recharge_order-call-forklist_pay_c.h5_pay-payUrlRes:',payUrlRes)
    }

    if(!payUrlRes || !payUrlRes.ret) return res.json({ret:false,msg:'get forklist-pay-url failed'})


    //返回订单情况。
    obj.ret = true;
    obj.msg = "success"
    obj.pay_url =  payUrlRes.result//weixinPayUrl;
    obj.go_url = payUrlRes.result// payRet.xdtns_cloud_func_ret.go_url;

    return res.json(obj)
}

/**
 * 内部函数，用于处理订单（由微信接口回调）
 * @param order_id
 * @returns {Promise<*>}
 */
window.order_c.s_pay_rmb_recharge_order = s_pay_rmb_recharge_order
async function s_pay_rmb_recharge_order(order_id)
{
    let str = await user_redis.get(ll_config.redis_key+":s_pay_rmb_recharge_order:"+order_id)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":s_pay_rmb_recharge_order:"+order_id,order_id,120)
    
    //查询订单信息
    let qOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    let orderInfo = qOrderRet&& qOrderRet.ret ? JSON.parse(JSON.parse(qOrderRet.list[0].txjson).opval) : null;
    if(!orderInfo) return {ret: false, msg: "order-info is null"};

    if(orderInfo.order_status=='success') return {ret: false, msg: "order-status is already success"};

    //修改订单状态（转帐成功之后才能进行update-order-status
    orderInfo.order_status = "success"
    orderInfo.pay_time = parseInt(new Date().getTime()/1000)

    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:orderInfo.order_id,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return {ret: false, msg: "assert order-status failed"};

    //锁定订单状态
    //锁定订单处理（特别是支付特权等）----使用redis加lock操作。
    let orderTime = await user_redis.get(ll_config.redis_key+":pay_rmb_recharge_order:"+order_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime >120)
    {
        return {ret: false, msg: "order is locked failed"};
    }
    user_redis.set(ll_config.redis_key+":pay_rmb_recharge_order:"+order_id,parseInt(new Date().getTime()/1000) ,120)

    //充值金额----状态修改需要在此之前（否则也空间被攻击）
    let rmbUserId = await s_queryUserRMBToken(orderInfo.user_id)
    //充值订单，不进行分账处理2023-11-28-bak
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(JSON.stringify(orderInfo))
    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:RMB_TOKEN_ROOT,token_y:rmbUserId,opval:orderInfo.pay_money, extra_data:JSON.stringify(orderInfo)})
    if(!sendRet || !sendRet.ret) return {ret: false, msg: "send rmb failed"};

    //得到用户token
    let userOrderToken = await s_queryUserOrderToken(orderInfo.user_id)
    if(userOrderToken) {
        rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,opval:JSON.stringify(orderInfo), extra_data:orderInfo.order_id})
    }

    orderInfo.ret = true;
    orderInfo.msg = "success"
    return orderInfo
}
/**
 * 支付回调接口
 * @type {pay_rmb_recharge_order}
 */
window.order_c.pay_rmb_recharge_order =pay_rmb_recharge_order;
async function pay_rmb_recharge_order(req, res) {
    //order_id订单id，
    let {order_id, random, sign} = str_filter.get_req_data(req);

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":pay_rmb_recharge_order:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_rmb_recharge_order:"+order_id+random,random,120)
    let ret = await s_pay_rmb_recharge_order(order_id);
    res.json(ret);
}

/**
 * 查询用户的objs
 * @type {query_user_node_objs}
 */
window.order_c.query_user_node_objs =query_user_node_objs;
async function query_user_node_objs(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":query_user_node_objs:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":query_user_node_objs:"+user_id+random,random,120)

    //得到相应的列表数据
    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return res.json({ret: false, msg: "get user-obj-info failed"});
    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval)

    res.json({ret:true,msg:'success',list:userObjList})
}
/**
 * 新购买云链主机（G节点，云链主机，联盟链，行业主链，行业合链）。
 * @type {new_node_buy_order}
 */
window.order_c.new_node_buy_order =new_node_buy_order;
async function new_node_buy_order(req, res) {
    //order_type 订单类型：gnode为G节点，node为云链主机、ilc行业联盟链，行业主链imc、行业合链icc
    //vip_pay_type(rmb、gsb、pcash等）---可以三者混搭（初期先实现人民币购买）
    //obj_buy_kind(year-month)
    //order_num数量（按月或者按年的数量）
    //要记录购买的商品与用户之间的关系（所以obj_id需要明确表达为用户已购买商品，或者是待购买商品）。-----这里为新购买，续费走另外通道。
    //order_name,order_type,pay_type
    let {user_id,s_id,req_type,order_name,deploy_area,order_type,obj_id,extra_data,buy_times_kind,order_num,space_num,random,gnode_setting,node_key,sign} = str_filter.get_req_data(req);

    //来自管理后台的请求。2019-4-1新增
    if(req_type=='simple')
    {
        if(order_type=='gnode')
        {
            if(deploy_area == 'tencent') obj_id = 'obj_gnodetencent0000'
            else if(deploy_area == 'huawei') obj_id = 'obj_gnodehuawei00000'
            else if(deploy_area == 'aliyun') obj_id = 'obj_gnodealiyun00000'
            else if(deploy_area == 'baidu') obj_id = 'obj_gnodebaidu000000'
            if(!gnode_setting) return res.json({ret: false, msg: "gnode_setting format error"})

            //{"name":"test","val_type":"CLT","appids":"[1001]","secret_keys":"[\"ctJctaMt\"]","extra_data":"{\"coin_precision_max\":0,\"coin_top_val\":0,\"token_id_length\":16}"}
            gnode_setting = JSON.parse(gnode_setting)
            gnode_setting.appids = "[10001]"
            gnode_setting.secret_keys= JSON.stringify([str_filter.randomBytes(16)])

            gnode_setting.extra_data = gnode_setting.extra_data ? JSON.parse(gnode_setting.extra_data) :{coin_top_val:0};
            gnode_setting.extra_data.token_id_length = 16;
            if(gnode_setting.val_type == 'SCORE') gnode_setting.extra_data.coin_precision_max = 4
            else gnode_setting.extra_data.coin_precision_max = 8
            gnode_setting.extra_data =  JSON.stringify(gnode_setting.extra_data)

            gnode_setting = JSON.stringify(gnode_setting)
            console.log("gnode_setting:"+gnode_setting)
        }else{
            if(deploy_area == 'tencent') obj_id = 'obj_nodetencent00000'
            else if(deploy_area == 'huawei') obj_id = 'obj_nodehuawei000000'
            else if(deploy_area == 'aliyun') obj_id = 'obj_nodealiyun000000'
            else if(deploy_area == 'baidu') obj_id = 'obj_nodebaidu0000000'
            node_key = str_filter.randomBytes(16)


            let userVipToken = str_filter.create_token_name_pre(VIP_TOKEN_ROOT,user_id.split('_')[1]);
            let listVipRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:userVipToken,opcode:'assert',begin:0,len:1})
            let vipObjInfo = listVipRet&& listVipRet.ret ? JSON.parse(JSON.parse(listVipRet.list[0].txjson).opval) : null;
            let vip_level = vipObjInfo?vipObjInfo.vip_level * 1 : 0;
            if(vip_level<3) return res.json({ret: false, msg: "buy cloud-node need more than vip3 level"})
        }
    }


    if(!obj_id) return res.json({ret: false, msg: "obj_id format error"})
    if(!order_name) return res.json({ret: false, msg: "order_name format error"})
    if(!order_type) return res.json({ret: false, msg: "order_type format error"})
    //判断order_type是否正确
    if(obj_id.indexOf(order_type)<0) return res.json({ret:false,msg:"obj_info unmatch order_type-1"})
    if(order_type =='node' && obj_id.indexOf('gnode')>=0) return res.json({ret:false,msg:"obj_info unmatch order_type-2"})
    if(order_type =='node' && !node_key) res.json({ret: false, msg: "node_key format error"})
    if(order_type =='gnode' && ( !gnode_setting || !gnode_format_util.checkSetting(JSON.parse(gnode_setting)))) return res.json({ret:false,msg:"gnode_setting format error"})
    if(order_type!='node' && order_type!='gnode' && order_type!='ilc' && order_type!='imc'&& order_type!='icc' ) return res.json({ret:false,msg:"obj_info unmatch order_type-3"})

    if(!extra_data) return res.json({ret: false, msg: "pay_extra_data format error"})
    // if(!vip_pay_type) return res.json({ret: false, msg: "vip_pay_type format error"})
    if(!buy_times_kind || buy_times_kind!='year' && buy_times_kind!='month' && buy_times_kind!='day')
        return res.json({ret: false, msg: "buy_times_kind format error" })
    if(order_num!=order_num*1 || order_num!=parseInt(order_num) || order_num<0) return res.json({ret: false, msg: "order_num format error"})
    if(space_num!=space_num*1 || space_num!=parseInt(space_num) || space_num<0) return res.json({ret: false, msg: "space_num format error"})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_node_buy_order:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_node_buy_order:"+user_id+random,random,120)

    if(order_type=='gnode') {
        let userObjToken = await s_queryUserObjToken(user_id)
        if(!userObjToken) return res.json({ret: false, msg: "get user-obj-info failed"});


        let checkNameRet = await s_checkNameExists(userObjToken, gnode_setting)
        if(!checkNameRet) return res.json({ret:false,msg:"gnode token-name already exists"})
    }

    //查询obj的情况
    let qObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:obj_id,opcode:'assert',begin:0,len:1})
    let objInfo = qObjRet&& qObjRet.ret ? JSON.parse(JSON.parse(qObjRet.list[0].txjson).opval) : null;
    if(!objInfo) return res.json({ret:false,msg:"obj_info error"})

    //创建新订单
    let forkRet =   await rpc_query(ORDER_API_BASE+"/fork",{token:ORDER_TOKEN_ROOT,space:order_type})
    if(!forkRet || !forkRet.ret) return res.json({ret: false, msg: "fork order-token failed"});

    //创建一个obj-order关联表（相当于是购买成功，这个事物就是他自己的了）。obj----与用户之间的关联（后面用于记录该node的续费情况等--关联订单）
    let orderObjToken = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,forkRet.token_x.split('_')[1])
    let forkObjRet =   await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:orderObjToken})
    if(!forkObjRet || !forkObjRet.ret) return res.json({ret: false, msg: "fork order-obj-token failed"});

    let orderInfo = objInfo
    orderInfo.order_id = forkRet.token_x
    orderInfo.user_obj_id = forkObjRet.token_x
    orderInfo.obj_id = obj_id
    orderInfo.user_id = user_id
    orderInfo.order_name = order_name
    orderInfo.order_type = order_type
    orderInfo.order_sub_type = 'new'
    orderInfo.extra_data = extra_data
    // orderInfo.pay_type = pay_type

    if(order_type == 'gnode')
        orderInfo.gnode_setting = gnode_setting
    else
        orderInfo.node_key =node_key

    orderInfo.buy_times_kind = buy_times_kind
    orderInfo.order_num = order_num
    orderInfo.space_num = space_num
    orderInfo.order_price = buy_times_kind=='year'? objInfo.price_y : (buy_times_kind=='month'?objInfo.price_m :objInfo.price_d)
    orderInfo.pay_money = objInfo.order_price * order_num * space_num
    orderInfo.order_time = parseInt(new Date().getTime()/1000)
    orderInfo.order_status = 'new'

    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:forkRet.token_x,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return res.json({ret: false, msg: "assert order-info failed"});

    let assertOrderObjRet =   await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertOrderObjRet || !assertOrderObjRet.ret) return res.json({ret: false, msg: "assert order-obj-info failed"});

    //将该订单id保存到用户订单表中（使用对应的order_userid纪录）---send为整体订单，assert为已支付订单。
    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(!userOrderToken) return res.json({ret: false, msg: "get user-order-token failed"});
    let sendOrder2UserRet = await rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,
        opval:JSON.stringify(orderInfo),extra_data:forkRet.token_x})
    if(!sendOrder2UserRet ||!sendOrder2UserRet.ret) return res.json({ret:false,msg:"save user vip-order-info failed"})

    //user-obj放一个obj纪录（未成功也算？）--暂时不放了。

    //obj里面也放一个订单纪录。
    let sendOrder2ObjRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,
        token_y:obj_id,opval:JSON.stringify(orderInfo), extra_data:forkRet.token_x})
    if(!sendOrder2ObjRet ||!sendOrder2ObjRet.ret) return res.json({ret:false,msg:"save obj vip-order-info failed"})

    //返回订单情况。
    orderInfo.ret = true;
    orderInfo.msg = "success"

    return res.json(orderInfo)
}

/**
 * 统计还有多少gnode空间剩余。
 * @param user_id
 * @returns {Promise<number>}
 */
window.order_c.s_queryVipGnodeUsedNum =s_queryVipGnodeUsedNum;
async function s_queryVipGnodeUsedNum(user_id)
{
    let userObjToken = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,user_id.split('_')[1]);
    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);

    let gnode_used_num = 0;
    let now_time = parseInt(new Date().getTime()/1000)
    let i = 0;
    for(;i<userObjList.length;i++)
    {
        let orderInfo = userObjList[i];
        if(orderInfo.order_type == 'gnode' && orderInfo.pay_type =='vip' && orderInfo.obj_timeout >now_time)
            gnode_used_num += orderInfo.space_num*1;//可以是1G，也可以是2G-XG
    }
    return gnode_used_num;
}

/**
 * 创建相应的node节点（并且是以orderInfo.deploy_area_code开头的）。
 * @param orderInfo
 * @returns {Promise<*>}
 */
async function s_queryNodeDeployAreaCode(orderInfo)
{
    orderInfo.node_deploy_area_code = orderInfo.deploy_area_code+str_filter.randomNum(6)

    let forkRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT, space: orderInfo.node_deploy_area_code })
    forkRet = !forkRet || !forkRet.ret ? await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT, space: orderInfo.node_deploy_area_code }):forkRet
    if(!forkRet || !forkRet.ret){
        return null;
    }

    orderInfo.node_master_host = forkRet.token_x.split('_')[1] + '.'+orderInfo.master_host
    return forkRet.token_x
}

/**
 * 判断一个token-name是否已经被该用户所使用（使用obj-list中来判断）
 * @param orderInfo
 * @returns {Promise<*>}
 */
async function s_checkNameExists(userObjToken,gnode_setting)
{
    let {name,val_type,appids,secret_keys,extra_data} = JSON.parse(gnode_setting)

    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);

    let i =0;
    for(;i<userObjList.length;i++)
    {
        let tmpOrderInfo = userObjList[i];
        console.log("tmpOrderInfo:"+JSON.stringify(tmpOrderInfo))
        if(tmpOrderInfo.order_type=='gnode')
        {
            let nowName = tmpOrderInfo.gnode_setting ? JSON.parse(tmpOrderInfo.gnode_setting).name :null;
            if(nowName == name) //{ret: false, msg: "gnode token-name exists"};
                return false
        }
    }
    //{ret: true, msg: "success"};
    return true
}

/**
 * 支付一个云链主机（G节点，云链主机，联盟链，行业主链，行业合链）的订单
 * @type {pay_node_buy_order}
 */
window.order_c.pay_node_buy_order =pay_node_buy_order;
async function pay_node_buy_order(req, res) {

    //order_id ，pay_type（余额、支付宝、微信、积分、代金券、会员特权）,pay_type_id（例如代金券id）
    let {user_id, s_id, order_id, pay_type, pay_type_extra, random, sign} = str_filter.get_req_data(req);

    if(!order_id) return res.json({ret:false,msg:"order_id error"})
    if(!pay_type) return res.json({ret:false,msg:"pay_type error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":pay_node_buy_order:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_node_buy_order:"+order_id+random,random,120)

    //锁定订单处理（特别是支付特权等）----使用redis加lock操作。
    let orderTime = await user_redis.get(ll_config.redis_key+":pay_node_buy_order_lock:"+order_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime >120)
    {
        return res.json({ret: false, msg: "order is locked failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_node_buy_order_lock:"+order_id,parseInt(new Date().getTime()/1000) ,120)

    //查询订单状态--//查询order_id对应的obj_id的相应情况。
    let qAssertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    if(!qAssertOrderRet ||!qAssertOrderRet.ret)
    {
        await str_filter.sleep(1000);
        qAssertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    }
    if(!qAssertOrderRet ||!qAssertOrderRet.ret) return res.json({ret:false,msg:"query node-order-info failed"})
    let orderInfo = JSON.parse(JSON.parse(qAssertOrderRet.list[0].txjson).opval);
    if(orderInfo.user_id != user_id) return res.json({ret:false,msg:"node-order user_id unmatch"})
    if(orderInfo.order_status == 'success') return res.json({ret:false,msg:"node-order already pay"})

    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return res.json({ret: false, msg: "get user-obj-info failed"});

    if(orderInfo.order_type=='gnode') {
        let checkNameRet = await s_checkNameExists(userObjToken, orderInfo.gnode_setting)
        if(!checkNameRet) return res.json({ret:false,msg:"gnode token-name already exists"})
    }

    //更新订单状态，以便在vip特权中纪录。
    orderInfo.pay_type = pay_type //这里极其重要，影响到订单计算等。
    orderInfo.order_status = 'success'
    orderInfo.pay_time = parseInt(new Date().getTime()/1000)
    orderInfo.obj_timeout = orderInfo.pay_time + ((orderInfo.buy_times_kind=='year'? 24*60*60*365 : (orderInfo.buy_times_kind=='month'?24*60*60*30 : 24*60*60) )* orderInfo.order_num)

    //支付方式（人民币方式）---最简单
    if(pay_type=='rmb')
    {
        let rmbUserId = await s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
        let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
        let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

        if(orderInfo.pay_money > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to pay order"})

        //转帐处理
        let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:rmbUserId,
            token_y:RMB_TOKEN_ROOT,opval:orderInfo.pay_money,extra_data: JSON.stringify(orderInfo)})
        if (!sendRet || !sendRet.ret) return res.json({ret: false, msg: "user-wallet pay failed"})

        //继续处理后续的保存纪录等。goto last
    }
    //支付方式（会员方式 ）--需要考虑会员的特权情况。-----这里使用特权续费，仅仅当发生在系统自动续费的情况下（极重要，并且是快到期的情况下）。
    else if(pay_type=='vip')
    {
        if(orderInfo.buy_times_kind != 'month' )
            return res.json({ret: false, msg: "vip-right can not use"});

        let userVipToken = str_filter.create_token_name_pre(VIP_TOKEN_ROOT,user_id.split('_')[1]);
        if(orderInfo.order_type != 'gnode') return res.json({ret: false, msg: "vip have no right get "+orderInfo.order_type+" by free-type"});
        let listVipRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:userVipToken,opcode:'assert',begin:0,len:1})
        let vipObjInfo = listVipRet&& listVipRet.ret ? JSON.parse(JSON.parse(listVipRet.list[0].txjson).opval) : null;
        let vip_level = vipObjInfo?vipObjInfo.vip_level * 1 : 0;
        let vip_right = vipObjInfo? JSON.parse(vipObjInfo.vip_right).gnode *1 : 1

        // console.log("vipObjInfo:"+JSON.stringify(vipObjInfo))
        // console.log("vip_level:"+vip_level+" vip_right:"+vip_right)

        //查询用户的当前占有的gnode-obj情况。
        let gnodeUsedNum = await s_queryVipGnodeUsedNum(user_id)
        if(vip_level!=0 && vip_right < (gnodeUsedNum*1+ orderInfo.space_num*1))//当vip特权数量为5，gnodeUsedNum=4，并且space_num=2时，无法使用vip特权支付全额订单。
        {
            // console.log("gnodeUsedNum:"+gnodeUsedNum+" orderInfo.space_num:"+orderInfo.space_num+" vip_right:"+vip_right+" (gnodeUsedNum+ orderInfo.space_num):"+(gnodeUsedNum+ orderInfo.space_num))
            return res.json({ret: false, msg: "gnode-right is used"});
        }
        if(vip_level==0)
        {
            let listNodeObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'send',begin:0,len:1})
            if(listNodeObjRet&&listNodeObjRet.ret) return res.json({ret: false, msg: "gnode-right is used, by vip0"});
        }

        orderInfo.pay_money_real = 0
        //这里使用特权成功（看看是否纪录一下）---在纪录特权中。
        let sendRet = await rpc_query(VIP_API_BASE+"/send",{token_x:VIP_TOKEN_ROOT,token_y:userVipToken, opval:JSON.stringify(orderInfo),extra:orderInfo.order_id})
        if (!sendRet || !sendRet.ret) return res.json({ret: false, msg: "use-vip-right pay failed"})
    }
    //支付方式（代金券模式）---暂时不做
    else if(pay_type=='pcash'){
        return res.json({ret: false, msg: "pay_type unsupport"});
    }
    //支付方式（混合模式）---暂时不做（使用gnode，并且使用代金券，同时使用人民币支付）。
    else if(pay_type=='muti'){
        return res.json({ret: false, msg: "pay_type unsupport"});
    }else{
        return res.json({ret: false, msg: "pay_type unmatch"});
    }

    //支付成功，更新状态--assert
    if(orderInfo.order_type == 'node') {
        orderInfo.node_obj_id = await s_queryNodeDeployAreaCode(orderInfo)
        console.log('s_queryNodeDeployAreaCode-orderInfo:'+JSON.stringify(orderInfo))
    }

    //修改订单状态（转帐成功之后才能进行update-order-status
    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:orderInfo.order_id,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return {ret: false, msg: "assert order-status failed"};

    //userObj得到assert值和更新assert值---方便续费超时查询、VIP特权查询等。
    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);
    userObjList.push(orderInfo)
    let assertUserObjRet =   await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:userObjToken,opcode:'assert',
        opval:JSON.stringify(userObjList),extra_data:user_id})
    if(!assertUserObjRet || !assertUserObjRet.ret) return res.json({ret: false, msg: "assert user-obj-info failed"});

    //得到一条user-obj（购买成功纪录）
    let sendUserObjRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:userObjToken,
        opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_obj_id})
    if(!sendUserObjRet || !sendUserObjRet.ret) return res.json({ret: false, msg: "send order-obj-info failed"});

    // ------------------------------------------------------------
    // 开始跑所谓的云链主机创建流程
    // 智能调用相关函数，或者提交数据库任务队列，以便执行下一步操作。
    if(orderInfo.order_type == 'gnode'){
    }
    else if(orderInfo.order_type == 'node')
    {
        //前面计算了node_obj_id以及node_master_host
        if(!orderInfo.node_obj_id)
            return res.json({ret: false, msg: "deploy node-obj-id is null"});

        //标记orderinfo信息
        rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:orderInfo.node_obj_id,
            opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:orderInfo.order_id})


    }
    // -----------------------------------------------------------

    // let assertOrderObjRet =   await
    rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.user_obj_id,opcode:'assert', opval:JSON.stringify(orderInfo),extra_data:user_id})
    // if(!assertOrderObjRet || !assertOrderObjRet.ret) return res.json({ret: false, msg: "assert order-obj-info failed"});

    //保存一条成功付费的订单纪录（方便后查）
    // let sendOrderObjRet = await
    rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.user_obj_id, opval:JSON.stringify(orderInfo),extra_data:user_id})
    // if(!sendOrderObjRet || !sendOrderObjRet.ret) return res.json({ret: false, msg: "send order-obj-info failed"});

    //首次购买G节点或者云链主机，奖励100GSB
    if(userObjList.length == 1)
    {
        rpc_query(GSB_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:GSB_TOKEN_ROOT+"_"+user_id.split('_')[1], opval:100,extra_data:order_id})
    }
    //user-order也保存一条纪录纪录。
    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(userOrderToken) {
        rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,opval:JSON.stringify(orderInfo), extra:orderInfo.order_id})
    }
    //node-obj里面也放一个订单纪录。
    rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.obj_id,opval:JSON.stringify(orderInfo), extra:user_id})

    orderInfo.ret = true
    orderInfo.msg = 'success'
    return res.json(orderInfo)
}

/**
 * 得到用户的gnode列表
 * @type {query_gnode_objs}
 */
window.order_c.query_gnode_objs =query_gnode_objs;
async function query_gnode_objs(req, res)
{
    let {user_id,s_id,random,sign,begin,len,gnode_kind} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = (begin - 1)*len

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})


    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:"user-info unexists"})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    let user_name = userInfo.user_name;

    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return res.json({ret: false, msg: "get user-obj-info failed"});

    //userObj得到assert值和更新assert值---方便续费超时查询、VIP特权查询等。
    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);

    console.log("user-gnodes-size:"+userObjList.length)

    userObjList.sort(function(a,b){
        a.order_time > b.order_time
    })

    let gnodeObjs = [],kindObjs = []
    let i = 0
    let cnt = 0;
    let kind_cnt =0;
    for(;i<userObjList.length;i++)
    {
        let orderInfo = userObjList[i]
        // console.log("orderInfo-order-type:"+orderInfo.order_type)
        if(orderInfo.order_type =='gnode')
        {

            orderInfo.is_timeout = orderInfo.obj_timeout> parseInt(new Date().getTime()/1000) ?'运行中':'已过期'
            orderInfo.obj_timeout = str_filter.GetDateTimeFormat(orderInfo.obj_timeout)

            try {
                orderInfo.gnode_setting = JSON.parse(orderInfo.gnode_setting)
                orderInfo.name = orderInfo.gnode_setting.name
                orderInfo.val_type = orderInfo.gnode_setting.val_type
                orderInfo.gnode_setting.appids = JSON.parse(orderInfo.gnode_setting.appids)
                orderInfo.gnode_setting.secret_keys = JSON.parse(orderInfo.gnode_setting.secret_keys)
                orderInfo.secret_keys = 'appid='+orderInfo.gnode_setting.appids[0]+'&secret_key='+orderInfo.gnode_setting.secret_keys[0]
                orderInfo.obj_url = 'http://node.'+user_name+"."+orderInfo.name+'.'+orderInfo.master_host
            }catch(ex){
                orderInfo.gnode_setting = null;
            }
            cnt++;
            if(cnt>=begin && cnt<begin+len)
                gnodeObjs.push(orderInfo)


            console.log("orderInfo.gnode_kind="+orderInfo.gnode_kind+" gnode_kind:"+gnode_kind)

            if(orderInfo.gnode_kind == gnode_kind)
            {
                kind_cnt ++;
                if(kind_cnt>=begin && kind_cnt<begin+len)
                {
                    kindObjs.push(orderInfo);
                }
            }
        }
        else{
            //非gnode节点。
            console.log("not gnode:"+JSON.stringify(orderInfo))
        }
    }

    if(gnodeObjs.length>0) {
        if(!gnode_kind)
            return res.json({ret: true, msg: 'success', count: gnodeObjs.length, list: gnodeObjs})
        else{
            if(kindObjs.length>0)
            {
                return res.json({ret: true, msg: 'success', count: kindObjs.length, list: kindObjs})
            }else{
                return res.json({ret:false,msg:'gnode-list is empty'})
            }
        }
    }
    else
        return res.json({ret:false,msg:'gnode-list is empty'})
}



/**
 * 得到用户的node列表
 * @type {query_node_objs}
 */
window.order_c.query_node_objs =query_node_objs;
async function query_node_objs(req, res)
{
    let {user_name,user_id,s_id,random,sign,begin,len,node_kind: node_kind} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = (begin - 1)*len

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return res.json({ret: false, msg: "get user-obj-info failed"});

    //userObj得到assert值和更新assert值---方便续费超时查询、VIP特权查询等。
    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);

    console.log("user-gnodes-size:"+userObjList.length)

    userObjList.sort(function(a,b){
        a.order_time > b.order_time
    })

    let gnodeObjs = [],kindObjs = []
    let i = 0
    let cnt = 0;
    let kind_cnt =0;
    for(;i<userObjList.length;i++)
    {
        let orderInfo = userObjList[i]
        // console.log("orderInfo-order-type:"+orderInfo.order_type)
        if(orderInfo.order_type =='node')
        {
            orderInfo.obj_timeout = str_filter.GetDateTimeFormat(orderInfo.obj_timeout)
            orderInfo.is_timeout = orderInfo.obj_timeout> parseInt(new Date().getTime()/1000) ?'已过期':'运行中'

            try {
                orderInfo.gnode_setting = JSON.parse(orderInfo.gnode_setting)
                orderInfo.name = orderInfo.gnode_setting.name
                orderInfo.val_type = orderInfo.gnode_setting.val_type
                orderInfo.gnode_setting.appids = JSON.parse(orderInfo.gnode_setting.appids)
                orderInfo.gnode_setting.secret_keys = JSON.parse(orderInfo.gnode_setting.secret_keys)
                orderInfo.secret_keys = 'appid='+orderInfo.gnode_setting.appids[0]+'&secret_key='+orderInfo.gnode_setting.secret_keys[0]
                orderInfo.obj_url = 'http://node.'+user_name+"."+orderInfo.name+'.'+orderInfo.master_host
            }catch(ex){
                orderInfo.gnode_setting = null;
            }
            cnt++;
            if(cnt>=begin && cnt<begin+len)
                gnodeObjs.push(orderInfo)


            console.log("orderInfo.node_kind="+orderInfo.gnode_kind+" node_kind:"+node_kind)

            if(orderInfo.gnode_kind == node_kind)
            {
                kind_cnt ++;
                if(kind_cnt>=begin && kind_cnt<begin+len)
                {
                    kindObjs.push(orderInfo);
                }
            }
        }
        else{
            //非gnode节点。
            console.log("not gnode:"+JSON.stringify(orderInfo))
        }
    }

    if(gnodeObjs.length>0) {
        if(!node_kind)
            return res.json({ret: true, msg: 'success', count: gnodeObjs.length, list: gnodeObjs})
        else{
            if(kindObjs.length>0)
            {
                return res.json({ret: true, msg: 'success', count: kindObjs.length, list: kindObjs})
            }else{
                return res.json({ret:false,msg:'cloud-node-list is empty'})
            }
        }
    }
    else
        return res.json({ret:false,msg:'cloud-node-list is empty'})
}

/**
 * 查询gnode的statements
 * @type {query_gnode_statements}
 */
window.order_c.query_gnode_statements =query_gnode_statements;
async function query_gnode_statements(req, res)
{
    let {user_id,user_name,s_id,obj_id,begin,len,random,sign} = str_filter.get_req_data(req);
    if(!obj_id) return res.json({ret: false, msg: "obj_id format error"})
    if(obj_id.indexOf('000')>0) return res.json({ret: false, msg: "obj is shopping"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = (begin - 1)*len

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    // str = await user_redis.get(config.redis_key+":new_node_renew_order:"+user_id+random)
    // if(str)
    // {
    //     return res.json({ret: false, msg: "muti call failed"});
    // }
    // user_redis.set(config.redis_key+":new_node_renew_order:"+user_id+random,random,120)

    //查询obj的情况
    let qObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:obj_id,opcode:'assert',begin:0,len:1})
    let orderInfo = qObjRet&& qObjRet.ret ? JSON.parse(JSON.parse(qObjRet.list[0].txjson).opval) : null;
    if(!orderInfo) return res.json({ret:false,msg:"obj_info error"})

    if(orderInfo.order_type =='gnode')
    {
        orderInfo.obj_timeout = str_filter.GetDateTimeFormat(orderInfo.obj_timeout)
        orderInfo.is_timeout = orderInfo.obj_timeout> parseInt(new Date().getTime()/1000) ?'已过期':'运行中'

        try {
            orderInfo.gnode_setting = JSON.parse(orderInfo.gnode_setting)
            orderInfo.name = orderInfo.gnode_setting.name
            orderInfo.val_type = orderInfo.gnode_setting.val_type
            orderInfo.gnode_setting.appids = JSON.parse(orderInfo.gnode_setting.appids)
            orderInfo.gnode_setting.secret_keys = JSON.parse(orderInfo.gnode_setting.secret_keys)
            orderInfo.secret_keys = 'appid='+orderInfo.gnode_setting.appids[0]+'&secret_key='+orderInfo.gnode_setting.secret_keys[0]
            orderInfo.obj_url = 'http://node.'+user_name+"."+orderInfo.name+'.'+orderInfo.master_host
        }catch(ex){
            orderInfo.gnode_setting = null;

            return res.json({ret:false,msg:"gnode-setting is null"})
        }
    }

    let listRet = await rpc_query(orderInfo.obj_url+"/chain/query",{begin,len,appid:orderInfo.gnode_setting.appids[0],secret_key:orderInfo.gnode_setting.secret_keys[0]})
    console.log("query_gnode_statements-listRet:"+JSON.stringify(listRet))
    if(listRet && listRet.ret)
    {
        let list = listRet.list;
        let i = 0;
        for(;i<list.length;i++)
        {
            // list[i].txjson = JSON.parse(list[i].txjson);
            list[i].save_time = str_filter.GetDateTimeFormat(JSON.parse(list[i].txjson).timestamp_i)
        }
        return res.json({ret:true,msg:'success',list:list})
    }else{
        return res.json({ret:false,msg:'chain is empty; '+listRet.msg})
    }
}
/**
 * 这里是续费操作（对已购买的产品进行自动化续费---使用会员特权和人民币续费）
 * //如果金额 不足，或者会员特权不足，将失败
 *
 * //每天计费记录（判断是否空间超额---空间超额开始限额？？还是允许超额），超额部分需要付费
 * //每天检测，看是否准备超时，即将超时的话（提前1天），自动创建续费订单进行续费操作----扣用户余额帐户---或者使用会员特权。
 * //每天检测，如果超时，将其移动到config命名字下，或者停机进入回收站处理。
 *
 */

/**
 * 内部调用的续费订单函数
 * @type {s_new_node_renew_order}
 */
window.order_c. s_new_node_renew_order =s_new_node_renew_order;
async function s_new_node_renew_order(user_id,order_name,obj_id,extra_data,buy_times_kind,order_num,space_num)
{
    //查询obj的情况
    let qObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:obj_id,opcode:'assert',begin:0,len:1})
    let objInfo = qObjRet&& qObjRet.ret ? JSON.parse(JSON.parse(qObjRet.list[0].txjson).opval) : null;
    if(!objInfo) return {ret:false,msg:"obj_info error"}

    //创建新订单
    let forkRet =   await rpc_query(ORDER_API_BASE+"/fork",{token:ORDER_TOKEN_ROOT,space:objInfo.order_type+'renew'})
    if(!forkRet || !forkRet.ret) return {ret: false, msg: "fork order-token failed"}

    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return {ret: false, msg: "get user-obj-info failed"}

    let orderInfo = objInfo
    orderInfo.order_id = forkRet.token_x
    orderInfo.user_obj_id = obj_id
    orderInfo.obj_id = objInfo.obj_id //对齐（这里与obj_id是不一样的，那个是userOrderObj）
    orderInfo.order_name = order_name
    orderInfo.extra_data = extra_data
    orderInfo.order_sub_type = 'renew'
    // orderInfo.pay_type = pay_type
    orderInfo.order_num = order_num
    if(space_num<objInfo.space_num)
    {
        return {ret: false, msg: "space_num can not less than the old-space-num"}
    }


    console.log("orderInfo.buy_times_kind:"+orderInfo.buy_times_kind+" buy_times_kind:"+buy_times_kind)
    orderInfo.buy_times_kind = buy_times_kind && (buy_times_kind=='year' || buy_times_kind=='month' || buy_times_kind=='day') ? buy_times_kind : objInfo.buy_times_kind
    orderInfo.order_price = orderInfo.buy_times_kind=='year'? objInfo.price_y : (orderInfo.buy_times_kind=='month'?objInfo.price_m :objInfo.price_d)

    orderInfo.order_time = parseInt(new Date().getTime()/1000)
    orderInfo.order_status = 'new'

    console.log("objInfo.space_num:"+objInfo.space_num)
    console.log("objInfo.obj_timeout:"+objInfo.obj_timeout+" orderInfo.order_time:"+orderInfo.order_time+"(space_num > objInfo.space_num):"+(space_num > objInfo.space_num))
    if(space_num > objInfo.space_num && objInfo.obj_timeout> orderInfo.order_time)
    {
        orderInfo.pay_money = orderInfo.order_price * order_num * space_num  -
            objInfo.space_num *objInfo.order_price* (objInfo.obj_timeout - orderInfo.order_time) / ( objInfo.buy_times_kind=='year' ? 24*60*60*365 : 24*60*60*30)
        console.log("orderInfo.pay_money:"+orderInfo.pay_money)
    }else{
        orderInfo.pay_money = orderInfo.order_price * order_num * space_num
    }
    orderInfo.pay_money = Math.round(orderInfo.pay_money*100)/100

    orderInfo.space_num = space_num

    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:forkRet.token_x,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return {ret: false, msg: "assert order-info failed"}

    //将该订单id保存到用户订单表中（使用对应的order_userid纪录）---send为整体订单，assert为已支付订单。
    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(!userOrderToken) return {ret: false, msg: "get user-order-token failed"}
    let sendOrder2UserRet = await rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,
        opval:JSON.stringify(orderInfo),extra_data:forkRet.token_x})
    if(!sendOrder2UserRet ||!sendOrder2UserRet.ret) return {ret:false,msg:"save user vip-order-info failed"}

    //user-obj放一个obj纪录（未成功也算？）--续费成功再放？？

    //obj里面也放一个订单纪录。
    let sendOrder2ObjRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,
        token_y:obj_id,opval:JSON.stringify(orderInfo), extra_data:forkRet.token_x})
    if(!sendOrder2ObjRet ||!sendOrder2ObjRet.ret) return {ret:false,msg:"save obj vip-order-info failed"}

    //返回订单情况。
    orderInfo.ret = true;
    orderInfo.msg = "success"

    return orderInfo
}
/**
 *  这里是创建一个续费订单
 * @type {recharge_node_pay_order}
 */
window.order_c. new_node_renew_order =new_node_renew_order;
async function new_node_renew_order(req, res)
{
    //obj_buy_kind(year-month)
    //order_num数量（按月或者按年的数量）
    //要记录购买的商品与用户之间的关系（所以obj_id需要明确表达为用户已购买商品，或者是待购买商品）。-----这里为新购买，续费走另外通道。
    //order_name,order_type,pay_type
    let {user_id,s_id,order_name,obj_id,extra_data,buy_times_kind,order_num,space_num,random,sign} = str_filter.get_req_data(req);
    if(!obj_id) return res.json({ret: false, msg: "obj_id format error"})
    if(obj_id.indexOf('000')>0) return res.json({ret: false, msg: "obj is shopping"})
    if(!order_name) return res.json({ret: false, msg: "order_name format error"})
    if(!extra_data) return res.json({ret: false, msg: "pay_extra_data format error"})
    if(order_num!=order_num*1 || order_num!=parseInt(order_num) || order_num<0) return res.json({ret: false, msg: "order_num format error"})
    if(space_num!=space_num*1 || space_num!=parseInt(space_num) || space_num<0) return res.json({ret: false, msg: "space_num format error"})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_node_renew_order:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_node_renew_order:"+user_id+random,random,120)


    let retInfo = await s_new_node_renew_order(user_id,order_name,obj_id,extra_data,buy_times_kind,order_num,space_num)
    console.log("new_node_renew_order-retInfo:"+JSON.stringify(retInfo))
    return res.json(retInfo)
}

/**
 * 支付续费订单
 * @type {s_pay_node_renew_order}
 */
window.order_c.s_pay_node_renew_order =s_pay_node_renew_order;
async function s_pay_node_renew_order(user_id, order_id, pay_type, pay_type_extra)
{
    //查询订单状态--//查询order_id对应的obj_id的相应情况。
    let qAssertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    if(!qAssertOrderRet ||!qAssertOrderRet.ret)
    {
        await str_filter.sleep(1000);
        qAssertOrderRet = await rpc_query(ORDER_API_BASE+"/chain/opcode",{token:order_id,opcode:'assert',begin:0,len:1})
    }

    if(!qAssertOrderRet ||!qAssertOrderRet.ret) return {ret:false,msg:"query node-order-info failed"}
    let orderInfo = JSON.parse(JSON.parse(qAssertOrderRet.list[0].txjson).opval);
    if(orderInfo.user_id != user_id) return {ret:false,msg:"node-order user_id unmatch"}
    if(orderInfo.order_status == 'success') return {ret:false,msg:"node-order already pay"}

    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return {ret: false, msg: "get user-obj-info failed"}

    //查询obj的情况
    let qObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:orderInfo.user_obj_id,opcode:'assert',begin:0,len:1})
    let objInfo = qObjRet&& qObjRet.ret ? JSON.parse(JSON.parse(qObjRet.list[0].txjson).opval) : null;
    if(!objInfo) return {ret:false,msg:"obj_info error"}


    //更新订单状态，以便在vip特权中纪录。
    orderInfo.pay_type = pay_type //这里极其重要，影响到订单计算等。
    orderInfo.order_status = 'success'
    orderInfo.pay_time = parseInt(new Date().getTime()/1000)

    if(orderInfo.space_num > objInfo.space_num )
    {
        console.log("objInfo.obj_timeout:"+objInfo.obj_timeout+" orderInfo.order_time:"+orderInfo.order_time)
        //先退款后续费
        if(objInfo.obj_timeout> orderInfo.order_time) {
            orderInfo.pay_money = orderInfo.order_price * orderInfo.order_num * orderInfo.space_num -
                objInfo.space_num * objInfo.order_price * (objInfo.obj_timeout - orderInfo.order_time) / (objInfo.buy_times_kind == 'year' ? 24 * 60 * 60 * 365 : 24 * 60 * 60 * 30)
        }
        else{
            orderInfo.pay_money = orderInfo.order_price * orderInfo.order_num * orderInfo.space_num
        }
        orderInfo.obj_timeout = orderInfo.order_time + ((orderInfo.buy_times_kind=='year'? 24*60*60*365 : (orderInfo.buy_times_kind=='month'?24*60*60*30 : 24*60*60) )* orderInfo.order_num)

    }else{//直接续费
        orderInfo.pay_money = orderInfo.order_price * orderInfo.order_num * orderInfo.space_num

        var obj_timeout = objInfo.obj_timeout> orderInfo.pay_time ? objInfo.obj_timeout: orderInfo.pay_time
        orderInfo.obj_timeout = obj_timeout + ((orderInfo.buy_times_kind=='year'? 24*60*60*365 : (orderInfo.buy_times_kind=='month'?24*60*60*30 : 24*60*60) )* orderInfo.order_num)
    }

    orderInfo.pay_money = Math.round(orderInfo.pay_money*100)/100


    //支付方式（人民币方式）---最简单
    if(pay_type=='rmb') {
        let rmbUserId = await s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
        let userAccountRet = await rpc_query(RMB_API_BASE + "/chain/opcode", {token: rmbUserId, opcode: 'send', begin: 0, len: 1})
        let userWalletMoney = userAccountRet && userAccountRet.ret ? JSON.parse(userAccountRet.list[0].txjson).token_state : 0;

        if (orderInfo.pay_money > userWalletMoney) return {ret: false, msg: "user have not enough money to pay order"}

        //转帐处理
        if (orderInfo.pay_money > 0) {
            let sendRet = await rpc_query(RMB_API_BASE + "/send", {
                token_x: rmbUserId,
                token_y: RMB_TOKEN_ROOT, opval: orderInfo.pay_money, extra_data: JSON.stringify(orderInfo)
            })
            if (!sendRet || !sendRet.ret) return {ret: false, msg: "user-wallet pay failed"}
        }else {
            let sendRet = await rpc_query(RMB_API_BASE + "/send", {token_x: RMB_TOKEN_ROOT,
                token_y: rmbUserId, opval: 0-orderInfo.pay_money, extra_data: JSON.stringify(orderInfo)})
            if (!sendRet || !sendRet.ret) return {ret: false, msg: "user-wallet pay failed"}
        }
        //继续处理后续的保存纪录等。goto last
    }
    //支付方式（会员方式 ）--需要考虑会员的特权情况。
    else if(pay_type=='vip')
    {
        if(orderInfo.buy_times_kind != 'month' || (objInfo.obj_timeout-orderInfo.pay_time)>24*60*60*3)
            return {ret: false, msg: "vip-right can not use",buy_times_kind:orderInfo.buy_times_kind}

        let userVipToken = str_filter.create_token_name_pre(VIP_TOKEN_ROOT,user_id.split('_')[1]);
        if(orderInfo.order_type != 'gnode') return {ret: false, msg: "vip have no right get "+orderInfo.order_type+" by free-type"}
        let listVipRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:userVipToken,opcode:'assert',begin:0,len:1})
        let vipObjInfo = listVipRet&& listVipRet.ret ? JSON.parse(JSON.parse(listVipRet.list[0].txjson).opval) : null;
        let vip_level = vipObjInfo?vipObjInfo.vip_level : 0;
        let vip_right = vipObjInfo? JSON.parse(vipObjInfo.vip_right).gnode : 1;
        //查询用户的当前占有的gnode-obj情况。
        let gnodeUsedNum = await s_queryVipGnodeUsedNum(user_id)
        if(vip_level!=0 && vip_right< gnodeUsedNum+ orderInfo.space_num)//当vip特权数量为5，gnodeUsedNum=4，并且space_num=2时，无法使用vip特权支付全额订单。
        {
            return {ret: false, msg: "gnode-right is used"}
        }
        if(vip_level==0)
        {
            let listNodeObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'send',begin:0,len:1})
            if(listNodeObjRet&&listNodeObjRet.ret) return {ret: false, msg: "gnode-right is used, by vip0"}
        }

        orderInfo.pay_money_real = 0

        //这里使用特权成功（看看是否纪录一下）---在纪录特权中。
        let sendRet = await rpc_query(VIP_API_BASE+"/send",{token_x:VIP_TOKEN_ROOT,token_y:userVipToken, opval:JSON.stringify(orderInfo),extra:orderInfo.order_id})
        if (!sendRet || !sendRet.ret) return {ret: false, msg: "use-vip-right pay failed"}
    }
    //支付方式（代金券模式）---暂时不做
    else if(pay_type=='pcash'){
        return {ret: false, msg: "pay_type unsupport"}
    }
    //支付方式（混合模式）---暂时不做（使用gnode，并且使用代金券，同时使用人民币支付）。
    else if(pay_type=='muti'){
        return {ret: false, msg: "pay_type unsupport"}
    }else{
        return {ret: false, msg: "pay_type unmatch"}
    }
    //支付成功，更新状态--assert
    //修改订单状态（转帐成功之后才能进行update-order-status
    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:orderInfo.order_id,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return {ret: false, msg: "assert order-status failed"};

    let assertOrderObjRet =   await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.user_obj_id,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertOrderObjRet || !assertOrderObjRet.ret) return {ret: false, msg: "assert order-obj-info failed"}

    //保存一条成功续费的订单纪录（方便后查）
    let sendOrderObjRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.user_obj_id,
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!sendOrderObjRet || !sendOrderObjRet.ret) return {ret: false, msg: "send order-obj-info failed"}

    //得到一条user-obj（购买成功纪录）
    let sendUserObjRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:userObjToken,
        opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_obj_id})
    if(!sendUserObjRet || !sendUserObjRet.ret) return {ret: false, msg: "send order-obj-info failed"}

    //userObj得到assert值和更新assert值---方便续费超时查询、VIP特权查询等。
    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);

    //更新内容。
    let i=0
    let updateFlag = false;
    let newUserObjList = []
    for(;i<userObjList.length;i++)
    {
        let objTmpInfo = userObjList[i]
        if(objTmpInfo.user_obj_id == orderInfo.user_obj_id)
        {
            //带有去重功能。
            if(!updateFlag) {
                newUserObjList.push(orderInfo)
                updateFlag = true;
            }
        }else{
            newUserObjList.push(objTmpInfo)
        }
    }
    if(!updateFlag)
        newUserObjList.push(orderInfo)

    let assertUserObjRet =   await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:userObjToken,opcode:'assert',
        opval:JSON.stringify(newUserObjList),extra_data:user_id})
    if(!assertUserObjRet || !assertUserObjRet.ret) return {ret: false, msg: "assert user-obj-info failed"}

    //user-order也保存一条纪录纪录。
    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(userOrderToken) {
        rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,opval:JSON.stringify(orderInfo), extra:orderInfo.order_id})
    }

    //node-obj里面也放一个订单纪录。
    rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.obj_id,opval:JSON.stringify(orderInfo), extra:user_id})

    orderInfo.ret = true
    orderInfo.msg = 'success'
    return orderInfo

}
/**
 * 支付续费订单（类似新创建的订单，不同的是，这个是刷新超时时间，并且不进行所谓的创建新节点操作）。
 * @type {pay_node_renew_order}
 */
window.order_c.pay_node_renew_order =pay_node_renew_order;
async function pay_node_renew_order(req, res)
{
    //order_id ，pay_type（余额、支付宝、微信、积分、代金券、会员特权）,pay_type_id（例如代金券id）
    let {user_id, s_id, order_id, pay_type, pay_type_extra, random, sign} = str_filter.get_req_data(req);

    if(!order_id) return res.json({ret:false,msg:"order_id error"})
    if(!pay_type) return res.json({ret:false,msg:"pay_type error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":pay_node_buy_order:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_node_buy_order:"+order_id+random,random,120)

    //锁定订单处理（特别是支付特权等）----使用redis加lock操作。
    let orderTime = await user_redis.get(ll_config.redis_key+":pay_node_buy_order_lock:"+order_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime >120)
    {
        return res.json({ret: false, msg: "order is locked failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_node_buy_order_lock:"+order_id,parseInt(new Date().getTime()/1000) ,120)


    let retJson = await s_pay_node_renew_order(user_id, order_id, pay_type, pay_type_extra)
    console.log("pay_node_renew_order-retJson:"+retJson)


    return res.json(retJson)
}






