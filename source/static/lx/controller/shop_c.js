/**
 * Created by lauo.li on 2019/4/28.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const gnode_format_util = require('../libs/gnode_format_util');
// const config = require('../config').config;
// const user_redis = require('..//config').user_redis;
// // const user_m = require('../model/user_m');
// const manager_c = require('./manager_c');

// const rpc_query = require('..//rpc_api_config').rpc_query
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
window.shop_c = {}
function s_queryVipRight(vip_level)
{
    switch (vip_level) {
        case 0:return 1
        case 1:return 3
        case 2:return 10
        case 3:return 30
        case 4:return 60
        case 5:return 100
        case 6:return 9999;
        default:
            return 0;
    }
}
function s_queryVipPrice(vip_level)
{
    switch (vip_level) {
        case 0:return 0
        case 1:return 199
        case 2:return 599
        case 3:return 1599
        case 4:return 2999
        case 5:return 3999
        case 6:return 6999
        default:
            return 0;
    }
}
/**
 * 新购买商铺（会员特权与人民币支付两种方式）
 * @type {new_shop_buy_order}
 */
window.shop_c.new_shop_buy_order =new_shop_buy_order;
async function new_shop_buy_order(req, res) {

    let {user_id,s_id,order_name,extra_data,shop_kind,shop_name,shop_desc,shop_who,shop_phone,shop_addr,shop_gps_lng,shop_gps_lat,shop_img,random,sign} = str_filter.get_req_data(req);
    // if(!order_name) return res.json({ret: false, msg: "order_name format error"})
    // if(!extra_data) return res.json({ret: false, msg: "extra_data format error"})
    order_name = !order_name ? '创建商铺':order_name
    extra_data = !extra_data ? '创建商铺':extra_data

    if(!shop_kind) return res.json({ret: false, msg: "shop_kind format error"})
    if(!shop_name) return res.json({ret: false, msg: "shop_name format error"})
    if(!shop_desc) return res.json({ret: false, msg: "shop_desc format error"})

    if(!shop_who) return res.json({ret: false, msg: "shop_who format error"})
    if(!shop_phone) return res.json({ret: false, msg: "shop_phone format error"})
    if(!shop_addr) return res.json({ret: false, msg: "shop_addr format error"})
    if(!shop_img) return res.json({ret: false, msg: "shop_img format error"})
    shop_gps_lng =shop_gps_lng !=shop_gps_lng*1 ? 0: shop_gps_lng
    shop_gps_lat =shop_gps_lat !=shop_gps_lat*1 ? 0: shop_gps_lat

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    console.log("session-str:"+str)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_node_buy_order:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_node_buy_order:"+user_id+random,random,120)

    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return res.json({ret: false, msg: "get user-obj-info failed"});

    let checkNameRet = await s_checkNameExists(userObjToken, shop_name)
    if(checkNameRet) return res.json({ret:false,msg:"shop-name already exists"})

    //创建新订单
    let forkRet =   await rpc_query(ORDER_API_BASE+"/fork",{token:ORDER_TOKEN_ROOT,space:'shop'})
    if(!forkRet || !forkRet.ret) return res.json({ret: false, msg: "fork order-token failed"});

    //创建一个obj-order关联表（相当于是购买成功，这个事物就是他自己的了）。obj----与用户之间的关联（后面用于记录该node的续费情况等--关联订单）
    let orderObjToken = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,forkRet.token_x.split('_')[1])
    let forkObjRet =   await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:orderObjToken})
    if(!forkObjRet || !forkObjRet.ret) return res.json({ret: false, msg: "fork order-obj-token failed"});

    let orderInfo = {user_id,order_name,extra_data,shop_kind,shop_name,shop_desc,shop_who,shop_phone,shop_addr,shop_gps_lng,shop_gps_lat,shop_img}
    orderInfo.order_id = forkRet.token_x
    orderInfo.shop_id = forkObjRet.token_x
    orderInfo.order_time = parseInt(new Date().getTime()/1000)
    orderInfo.order_status = 'new'
    orderInfo.price = 299;//199元永久有效（1个店铺），如果是会员的话，就会有免费额度（vip0为免费1个额度等），vip1为免费3个额度等）。
    orderInfo.pay_money = orderInfo.price

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
    //返回订单情况。
    orderInfo.ret = true;
    orderInfo.msg = "success"

    return res.json(orderInfo)
}

/**
 * 查询用户的Obj-token（如果不存在，就fork）---用来保存node和gnode等云链主机产品（暂时不包含源码等）。
 * @returns {Promise<*>}
 */
window.shop_c.s_queryUserObjToken =s_queryUserObjToken;
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
 * 统计还有多少gnode空间剩余。
 * @param user_id
 * @returns {Promise<number>}
 */
window.shop_c.s_queryVipUsedNum =s_queryVipUsedNum;
async function s_queryVipUsedNum(user_id)
{
    let userObjToken = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,user_id.split('_')[1]);
    // let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    // let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);
    //
    // let vip_used_num = 0;
    // // let now_time = parseInt(new Date().getTime()/1000)
    // let i = 0;
    // for(;i<userObjList.length;i++)
    // {
    //     let orderInfo = userObjList[i];
    //     if( orderInfo.pay_type =='vip' )
    //         vip_used_num += orderInfo.space_num*1;//可以是1G，也可以是2G-XG
    // }

    let list = await s_queryMyShops(user_id,0,100000);
    return list ?list.length:0;
}

/**
 * 判断一个token-name是否已经被该用户所使用（使用obj-list中来判断）
 * @param orderInfo
 * @returns {Promise<*>}
 */
async function s_checkNameExists(userObjToken,shop_name)
{
    let name = shop_name

    let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);

    let i =0;
    for(;i<userObjList.length;i++)
    {
        let tmpOrderInfo = userObjList[i];
        console.log("tmpOrderInfo:"+JSON.stringify(tmpOrderInfo))

        let nowName = tmpOrderInfo.shop_name;
        if(nowName == name)
            return true

    }
    return false
}


/**
 * 查询用户的RMB-token（如果不存在，就fork）
 * @returns {Promise<*>}
 */
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
 * 支付一个云链主机（G节点，云链主机，联盟链，行业主链，行业合链）的订单
 * @type {pay_node_buy_order}
 */
window.shop_c.pay_shop_buy_order =pay_shop_buy_order;
async function pay_shop_buy_order(req, res) {

    //order_id ，pay_type（余额、支付宝、微信、积分、代金券、会员特权）,pay_type_id（例如代金券id）
    let {user_id, s_id, order_id, pay_type, random, sign} = str_filter.get_req_data(req);

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
    let orderTime = await user_redis.get(ll_config.redis_key+":pay_shop_buy_order_lock:"+order_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime >120)
    {
        return res.json({ret: false, msg: "order is locked failed"});
    }
    user_redis.set(ll_config.redis_key+":pay_shop_buy_order_lock:"+order_id,parseInt(new Date().getTime()/1000) ,120)

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

    let checkNameRet = await s_checkNameExists(userObjToken, orderInfo.shop_name)
    if(checkNameRet) return res.json({ret:false,msg:"gnode token-name already exists"})

    //更新订单状态，以便在vip特权中纪录。
    orderInfo.pay_type = pay_type //这里极其重要，影响到订单计算等。
    orderInfo.secret_key = str_filter.randomBytes(16);//str_filter.randomSafe(16)
    orderInfo.order_status = 'success'
    orderInfo.pay_time = parseInt(new Date().getTime()/1000)
    //500年的有效期（其实无任何意义，代表永久的意思）
    orderInfo.obj_timeout =  orderInfo.pay_time +100*365*24*60*60*5 //orderInfo.pay_time + ((orderInfo.buy_times_kind=='year'? 24*60*60*365 : (orderInfo.buy_times_kind=='month'?24*60*60*30 : 24*60*60) )* orderInfo.order_num)

    //支付方式（人民币方式）---最简单
    if(pay_type=='rmb')
    {
        let rmbUserId = await s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
        let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
        let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

        if(orderInfo.pay_money > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to pay order"})

        orderInfo.pay_money_real = orderInfo.pay_money

        //转帐处理
        let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:rmbUserId,
            token_y:RMB_TOKEN_ROOT,opval:orderInfo.pay_money,extra_data: JSON.stringify(orderInfo)})
        if (!sendRet || !sendRet.ret) return res.json({ret: false, msg: "user-wallet pay failed"})

        //继续处理后续的保存纪录等。goto last
    }
    //支付方式（会员方式 ）--需要考虑会员的特权情况。-----这里使用特权续费，仅仅当发生在系统自动续费的情况下（极重要，并且是快到期的情况下）。
    else if(pay_type=='vip')
    {

        let userVipToken = str_filter.create_token_name_pre(VIP_TOKEN_ROOT,user_id.split('_')[1]);
        let listVipRet = await rpc_query(VIP_API_BASE+"/chain/opcode",{token:userVipToken,opcode:'assert',begin:0,len:1})
        let vipObjInfo = listVipRet&& listVipRet.ret ? JSON.parse(JSON.parse(listVipRet.list[0].txjson).opval) : null;
        let vip_level = vipObjInfo?vipObjInfo.vip_level * 1 : 0;
        let vip_right = s_queryVipRight(vip_level);

        //查询用户的当前占有的gnode-obj情况。
        let vipUsedNum = await s_queryVipUsedNum(user_id)
        if(vip_level!=0 && vip_right*1 < vipUsedNum*1 )//当vip特权数量为5，gnodeUsedNum=4，并且space_num=2时，无法使用vip特权支付全额订单。
        {
            // console.log("gnodeUsedNum:"+gnodeUsedNum+" orderInfo.space_num:"+orderInfo.space_num+" vip_right:"+vip_right+" (gnodeUsedNum+ orderInfo.space_num):"+(gnodeUsedNum+ orderInfo.space_num))
            return res.json({ret: false, msg: "vip-right is used"});
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
    //修改订单状态（转帐成功之后才能进行update-order-status
    let assertOrderRet =   await rpc_query(ORDER_API_BASE+"/op",{token_x:ORDER_TOKEN_ROOT,token_y:orderInfo.order_id,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_id})
    if(!assertOrderRet || !assertOrderRet.ret) return {ret: false, msg: "assert order-status failed"};

    //userObj得到assert值和更新assert值---方便续费超时查询、VIP特权查询等。
    // let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    // let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);
    // userObjList.push(orderInfo)
    // let assertUserObjRet =   await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:userObjToken,opcode:'assert',
    //     opval:JSON.stringify(userObjList),extra_data:user_id})
    // if(!assertUserObjRet || !assertUserObjRet.ret) return res.json({ret: false, msg: "assert user-obj-info failed"});

    let holdRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:userObjToken,token_y:orderInfo.shop_id,opcode:'relate',
       opval:'add',extra_data:JSON.stringify(orderInfo)})
    if(!holdRet || !holdRet.ret) return res.json({ret: false, msg: "hold shop-info failed"});

    //得到一条user-obj（购买成功纪录）
    let sendUserObjRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:userObjToken,
        opval:JSON.stringify(orderInfo),extra_data:orderInfo.user_obj_id})
    if(!sendUserObjRet || !sendUserObjRet.ret) return res.json({ret: false, msg: "send order-obj-info failed"});

    // let assertOrderObjRet =   await
    await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.shop_id,opcode:'assert', opval:JSON.stringify(orderInfo),extra_data:user_id})
    // if(!assertOrderObjRet || !assertOrderObjRet.ret) return res.json({ret: false, msg: "assert order-obj-info failed"});

    //保存一条成功付费的订单纪录（方便后查）
    // let sendOrderObjRet = await
    await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.shop_id, opval:JSON.stringify(orderInfo),extra_data:user_id})
    // if(!sendOrderObjRet || !sendOrderObjRet.ret) return res.json({ret: false, msg: "send order-obj-info failed"});

    //首次购买，奖励100GSB
    // if(userObjList.length == 1)
    {
        await rpc_query(GSB_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:GSB_TOKEN_ROOT+"_"+user_id.split('_')[1], opval:100,extra_data:order_id})
    }

    //user-order也保存一条纪录纪录。
    let userOrderToken = await s_queryUserOrderToken(user_id)
    if(userOrderToken) {
        await rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:userOrderToken,opval:JSON.stringify(orderInfo), extra:orderInfo.order_id})
    }

    orderInfo.ret = true
    orderInfo.msg = 'success'
    return res.json(orderInfo)
}


/**
 * 用户的商铺列表
 * @type {queryMyShops}
 */
window.shop_c.queryMyShops =queryMyShops;
async function queryMyShops(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let objs = await s_queryMyShops(user_id,begin*len,len)

    if(objs.length>0)
    {
        return res.json({ret: true, msg: 'success', count: objs.length, list: objs})
    }else{
        return res.json({ret:false,msg:'list is empty'})
    }
}
window.shop_c.s_queryMyShops =s_queryMyShops;
async function s_queryMyShops(user_id,begin,len)
{
    let userObjToken = await s_queryUserObjToken(user_id)
    if(!userObjToken) return []// res.json({ret: false, msg: "get user-obj-info failed"});

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:userObjToken,opcode:'relate',isx:true,begin:begin,len})
    let userObjList = !listRet ||!listRet.ret ? [] : listRet.list;

    console.log("user-shops-size:"+userObjList.length)

    // userObjList.sort(function(a,b){
    //     return a.order_time - b.order_time
    // })

    let objs = []
    let queryObjInfoP = []
    let i = begin
    for(;i<userObjList.length;i++)
    {
        let info = userObjList[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = []
    //处理全部请求。
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.order_time = str_filter.GetDateTimeFormat(newInfo.order_time)
            newObjs.push(newInfo)
        }
    })

    return newObjs;
}



/**
 * 查询商铺的信息
 * @type {querysrcInfo}
 */
window.shop_c.queryShopInfo =queryShopInfo;
async function queryShopInfo(req,res) {
    let {user_id, s_id, shop_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)

    if (!str ) return res.json({ret: false, msg: "session error"})

    if (!shop_id) return res.json({ret: false, msg: "obj_id error"})

    let oldObj = await s_queryShopInfo(shop_id)
    if(!oldObj) return res.json({ret: false, msg: "shop info is empty"})

    oldObj.ret = true;
    oldObj.msg = 'success'
    res.json(oldObj)
}

window.shop_c.s_queryShopInfo =s_queryShopInfo;
async function s_queryShopInfo(shop_id) {
    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return null;
    return JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
}


/**
 * 更新商品信息（由obj_id）
 * @type {updateShopInfo}
 */
window.shop_c.updateShopInfo =updateShopInfo;
async function updateShopInfo(req,res) {
    let {user_id,s_id,shop_id,shop_name,shop_desc,shop_img} = str_filter.get_req_data(req)

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    if(!shop_id) return res.json({ret:false,msg:"obj_id error"})
    if(!shop_name) return res.json({ret:false,msg:"shop_name error"})
    if(!shop_desc) return res.json({ret:false,msg:"shop_desc error"})
    if(!shop_img) return res.json({ret:false,msg:"shop_img error"})

    let obj = {shop_id:shop_id,shop_name,shop_desc,shop_img, update_time:parseInt(new Date().getTime()/1000)}

    let shopInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,shop_id,'assert')
    if(!shopInfo) return res.json({ret:false,msg:"shop-info is empty"})

    if(shopInfo.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"no pm: update shopinfo failed"})

    let newObj = {}
    newObj = Object.assign(newObj,shopInfo,obj)
    if(!newObj.secret_key) newObj.secret_key = str_filter.randomSafe(16)

    let assertOBJRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,shop_id,'assert',JSON.stringify(newObj),'update shop-info')
    if(!assertOBJRet) return res.json({ret: false, msg: "save shop-info failed"});

    return res.json({ret:true,msg:'success'})
}


window.shop_c.s_newShop =s_newShop;
async function s_newShop(shop_id,user_id, shop_name,shop_desc,shop_img) {
    // let {user_id,s_id,shop_id,shop_kind,shop_name,shop_desc,shop_who,shop_phone,shop_addr,shop_img} = str_filter.get_req_data(req)
    if(!shop_id) return ({ret:false,msg:"shop_id error"})
    if(!user_id) return  ({ret:false,msg:"user_id error"})
    if(!shop_name) return ({ret:false,msg:"shop_name error"})
    if(!shop_desc) return ({ret:false,msg:"shop_desc error"})
    if(!shop_img) return ({ret:false,msg:"shop_img error"})

    let time_i = parseInt(new Date().getTime()/1000)
    let obj = {shop_id,user_id,shop_name,shop_desc,shop_img,
        create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i)}

    shop_id = await rpc_api_util.s_query_token_id(OBJ_API_BASE,OBJ_TOKEN_ROOT,shop_id);
    if(!shop_id) return {ret:false,msg:'get shop_id failed'}

    let assertRet =  await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,shop_id,'assert',JSON.stringify(obj),'save shop-info')

    if(assertRet)
    return ({ret:true,msg:'success'})
    else return ({ret:false,msg:'save shop-info failed'})
}


/**
 * 更新商铺的微信小程序信息
 * @type {updateShopWeixinInfo}
 */
window.shop_c.updateShopWeixinInfo =updateShopWeixinInfo;
async function updateShopWeixinInfo(req,res) {
    let {user_id,s_id,shop_id,weixin_appid,weixin_key} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!weixin_appid) return res.json({ret:false,msg:"weixin_appid error"})
    if(!weixin_key) return res.json({ret:false,msg:"weixin_key error"})

    let obj = {weixin_appid,weixin_key, update_weixin_time:parseInt(new Date().getTime()/1000)}

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(oldObj.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update shopinfo no pm"})

    let newObj = {}
    newObj = Object.assign(newObj,oldObj,obj)
    if(!newObj.secret_key) newObj.secret_key = str_filter.randomSafe(16)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:shop_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert update-obj-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'【商铺管理】您在商铺管理，修改了商铺的微信小程序密钥信息！商铺名称：'+oldObj.shop_name+" 商铺ID:"+shop_id,extra_data:JSON.stringify(obj)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 删除商铺
 * @type {deleteShop}
 */
window.shop_c.deleteShop =deleteShop;
async function deleteShop(req,res) {
    let {user_id, s_id, obj_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if (!obj_id) return res.json({ret: false, msg: "obj_id error"})

    let delFlag = s_deleteShop(user_id,obj_id)
    if(delFlag)
        res.json({ret:true,msg:'success'})
    else
        res.json({ret:false,msg:'delete failed'})
}


/**
 * 删除用户的sho
 * @type {deleteUserGnode}
 */
// window.shop_c.deleteShop =deleteShop;
async function s_deleteShop(user_id,obj_id) {
    let userObjToken = await s_queryUserObjToken(user_id)

    //查询obj的情况
    let qObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:obj_id,opcode:'assert',begin:0,len:1})
    let objInfo = qObjRet&& qObjRet.ret ? JSON.parse(JSON.parse(qObjRet.list[0].txjson).opval) : null;
    if(!objInfo)
    {
        console.log('nodeInfo is null, obj_id:'+obj_id)
        return false;
    }

    //userObj得到assert值和更新assert值---方便续费超时查询、VIP特权查询等。
    // let qAssertUserObjRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:userObjToken,opcode:'assert',begin:0,len:1})
    // let userObjList = !qAssertUserObjRet ||!qAssertUserObjRet.ret ? [] : JSON.parse(JSON.parse(qAssertUserObjRet.list[0].txjson).opval);
    // let i =0 ,flag = false ,newObjList=[];
    // for(;i<userObjList.length;i++)
    // {
    //     let orderInfo = userObjList[i]
    //     if(orderInfo.shop_id == obj_id)
    //     {
    //         flag = true;
    //     }else{
    //         newObjList.push(orderInfo)
    //     }
    // }
    // console.log("deleteUserObj-flag:"+flag)
    // console.log('deleteUserObj-userObjList:'+JSON.stringify(userObjList))
    // console.log('deleteUserObj-newObjList:'+JSON.stringify(newObjList))
    //
    // if(newObjList.length!=userObjList.length) {
    //     let assertUserObjRet = await rpc_query(OBJ_API_BASE + "/op",
    //         {token_x: OBJ_TOKEN_ROOT, token_y: userObjToken, opcode: 'assert', opval: JSON.stringify(newObjList), extra_data: user_id})
    //     if (!assertUserObjRet || !assertUserObjRet.ret) return false;
    // }

    let delRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:userObjToken,token_y:obj_id,opcode:'relate',opval:'del'})
    if (!delRet || !delRet.ret) return false;

    let nodeType = ''
    let msgRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'您已经成功删除商铺"'+objInfo.shop_name+'"（ID：'+obj_id+'）！',extra_data:(!objInfo || !objInfo.ret ?obj_id: JSON.stringify(objInfo))})
    console.log('msgRet:'+JSON.stringify(msgRet))

    return true;
}