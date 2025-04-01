/**
 * Created by lauo.li on 2019/5/13.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const gnode_format_util = require('../libs/gnode_format_util');
// const config = require('../config').config;
// const user_redis = require('..//config').user_redis;
// // const user_m = require('../model/user_m');
// const shop_c = require('./shop_c');
// const product_c = require('./product_c');
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
window.shopping_c = {}
/**
 * 新建一个订单
 * @type {createOrder}
 */
window.shopping_c.createOrder =createOrder;
async function createOrder(req,res) {
    let {user_id, s_id,shop_id, calculate,address_info, goods,note, random, sign} = str_filter.get_req_data(req);

    if(!address_info)  return res.json({ret:false,msg:"address_info error"})
    if(!goods)  return res.json({ret:false,msg:"goods error"})
    if(!note)  note='';//return res.json({ret:false,msg:"note error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":add_address:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":add_address:"+user_id+random,random,120)

    try{
        address_info  =JSON.parse(address_info)
        goods  =JSON.parse(goods)
    }catch(ex)
    {
        return res.json({ret:false,msg:'address_info or address_info error'})
    }
    //为空
    if(!(goods instanceof Array) || goods.length<=0)
    {
        return res.json({ret:false,msg:'goods is empty'})
    }

    //查询产品相关信息（最新的）
    let i=0, queryObjInfoP = [],list=[]
    for(;i<goods.length;i++)
    {
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:goods[i].product_id,opcode:'assert',begin:0,len:1}))
    }

    //处理全部请求（这里允许修改订单价格等）---所以重新查询一下（其实暂时没必要，重新发就可以了---但是重新发会影响obj-id，导致用户权益受损）。
    let total_money = 0;
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<goods.length;i++)
        {
            list.push(JSON.parse(JSON.parse(rets[i].list[0].txjson).opval))
            list[i].number = goods[i].number
            total_money += list[i].number * list[i].product_price
        }
    })

    let forkRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,space:'shopping'})
    if(!forkRet || !forkRet.ret) return res.json({ret:false,msg:'create order-id failed'})

    let order_id = forkRet.token_x;
    let save_time = parseInt(new Date().getTime()/1000)
    //订单ID，快递地址信息，商品列表，总的价格等，订单时间等。
    let orderInfo = {order_id,user_id,shop_id,address_info,goods:list,note,total_money,order_status:0,create_time_i:save_time,save_time}

    if(calculate=='true')
    {
        orderInfo.ret = true;
        orderInfo.msg = 'success'
        return res.json(orderInfo)
    }

    let assertRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertRet || !assertRet.ret) return res.json({ret:false,msg:'save order-info failed'})

    //用户拥有该订单
    let orderUserId = ORDER_TOKEN_NAME+'_'+user_id.split('_')[1]
    let orderShopId = ORDER_TOKEN_NAME+'_'+shop_id.split('_')[1]

    await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,dst_token:orderUserId});
    await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,dst_token:orderShopId});

    let userHoldRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:orderUserId,token_y:order_id,
        opcode:'rels',opval:'add',extra_data:JSON.stringify(orderInfo)});
    if(!userHoldRet || !userHoldRet.ret) return res.json({ret:false,msg:'add orderInfo to user-order-list failed'})

    let shopHoldRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:orderShopId,token_y:order_id,
        opcode:'hold',opval:'add',extra_data:JSON.stringify(orderInfo)});
    if(!shopHoldRet || !shopHoldRet.ret) return res.json({ret:false,msg:'add orderInfo to shop-order-list failed'})

    res.json({ret:true,msg:'success',order_id})
}

/**
 * 查询列表
 * queryOrderList
 */
window.shopping_c.queryOrderList =queryOrderList;
async function queryOrderList(req,res) {
    let {user_id, s_id,begin,len,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/relations',{token:ORDER_TOKEN_NAME+'_'+ user_id.split('_')[1],
        opcode:'rels',isx:true,begin,len})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryObjInfoP = []
    let i = 0
    for(;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = []
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time)
            // newInfo.goods = JSON.parse(newInfo.goods)
            // newInfo.address_info = JSON.parse(newInfo.address_info)
            newObjs.push(newInfo)
        }
    })

    if(newObjs && newObjs.length>0)
        return res.json({ret:true,msg:'success',list:newObjs});
    else
        res.json({ret:false,msg:'order-list is empty'})
}



/**
 * 删除订单信息
 * @type {deleteOrderInfo}
 */
window.shopping_c.deleteOrderInfo =deleteOrderInfo;
async function deleteOrderInfo(req,res) {
    let {user_id,shop_id, s_id, order_id,random, sign} = str_filter.get_req_data(req);

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet ||  !assertInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    if(orderInfo.order_status!=0) return res.json({ret:false,msg:"can not delete your payed order!"})
    if(orderInfo.shop_id!=shop_id) return res.json({ret:false,msg:"not shop's order"})

    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,begin:0,len:1,opcode:'assert'});
    if(!shopInfoRet ||  !shopInfoRet.ret) return res.json({ret:false,msg:"shop-info is empty"})
    let shopInfo =  JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    if(orderInfo.user_id!=user_id && shopInfo.user_id != user_id) return res.json({ret:false,msg:"delete order no pm"})

    //从地址列表中删除
    let delRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],token_y:order_id,
        opcode:'rels',opval:'del',extra_data:user_id})
    if(!delRet || !delRet.ret) return res.json({ret:false,msg:'del order from user-order-list failed'})

    //从商铺订单队列中删除
    let orderShopId = ORDER_TOKEN_NAME+'_'+shop_id.split('_')[1]
    delRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:orderShopId,token_y:order_id, opcode:'hold',opval:'del',extra_data:user_id})
    if(!delRet || !delRet.ret) return res.json({ret:false,msg:'del order from shop-order-list failed'})

    // await rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+shopInfo.user_id.split('_')[1],opval:'【订单管理】取消订单（订单ID:'+orderInfo.order_id+'，金额'
    //         +orderInfo.total_money+'元）成功',extra_data:JSON.stringify(orderInfo)})

    // await rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],opval:'已取消订单（订单ID:'+orderInfo.order_id+'，金额'
    //         +orderInfo.total_money+'元）！',extra_data:JSON.stringify(orderInfo)})

    res.json({ret:true,msg:'success'})
}


/**
 * 查询订单信息
 * @type {queryOrderInfo}
 */
window.shopping_c.queryOrderInfo =queryOrderInfo;
async function queryOrderInfo(req,res) {
    let {user_id, s_id, order_id,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(assertInfoRet && assertInfoRet.ret){
        let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        obj.ret = true;
        obj.msg='success'
        return res.json(obj)
    }
    res.json({ret:false,msg:'order info is empty'})
}

/**
 * 查询用户的RMB-token（如果不存在，就fork）
 * @returns {Promise<*>}
 */
window.shopping_c.s_queryUserRMBToken =s_queryUserRMBToken;
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

// /**
//  * 得到消息user-id
//  * @param user_id
//  * @returns {Promise<*>}
//  */
// window.shopping_c.s_queryUserMSGToken =s_queryUserMSGToken;
// async function s_queryUserMSGToken(user_id)
// {
//     let newUserId = str_filter.create_token_name_pre(MSG_TOKEN_ROOT,user_id.split('_')[1]);

//     let qTokenRet = await rpc_query(MSG_API_BASE+"/chain/opcode",{token:newUserId,opcode:'fork',begin:0,len:1})
//     if(!qTokenRet || !qTokenRet.ret)
//     {
//         let forkRet = await rpc_query(MSG_API_BASE+"/fork",{token:MSG_TOKEN_ROOT,dst_token:newUserId})
//         if(!forkRet || !forkRet.ret) return null
//     }

//     return newUserId
// }

/**
 * 支付订单。
 * @type {payOrder}
 */
window.shopping_c.payOrder =payOrder;
async function payOrder(req,res) {
    let {user_id, s_id, order_id, random, sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":payOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":payOrder:"+order_id+random,random,120)

    //判断是否已经支付过。
    str = await user_redis.get(ll_config.redis_key+":order-status:"+order_id)
    if(str=='ok')
    {
        return res.json({ret: false, msg: "order is payed"});
    }
    // user_redis.set(config.redis_key+":order-status:"+order_id,'ok',60*60)

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "order-info is empty"});

    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    if(orderInfo.order_status >=1)
        return res.json({ret: false, msg: "order is payed, order_status:"+orderInfo.order_status});
    if(orderInfo.user_id!=user_id) return res.json({ret: false, msg: "it is not your order"});

    //转帐支付（查询该订单归属的shop_id）。
    //let orderInfo = {user_id,order_name,extra_data,shop_kind,shop_name,shop_desc,shop_who,shop_phone,shop_addr,shop_gps_lng,shop_gps_lat,shop_img}

    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:orderInfo.shop_id,begin:0,len:1,opcode:'assert'});
    if(!shopInfoRet || !shopInfoRet.ret) return res.json({ret: false, msg: "shop-info is empty"});
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    //转帐
    let rmbUserId = await s_queryUserRMBToken(user_id)//str_filter.create_token_name_pre(RMB_TOKEN_ROOT,user_id.split('_')[1]);
    let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
    let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

    if(orderInfo.total_money > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to pay order"})

    let shopUserRmbId = await s_queryUserRMBToken(shopInfo.user_id)
    //开始转帐
    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:rmbUserId,token_y:shopUserRmbId,opval:orderInfo.total_money,extra_data:JSON.stringify(orderInfo)})
    if(!sendRet || !sendRet.ret) return res.json({ret:false,msg:"send rmb failed"})

    //修改订单状态：
    orderInfo.order_status=1;
    orderInfo.payed='ok'
    let saveRet = await rpc_query(ORDER_API_BASE+'/op',{ token_x:ORDER_TOKEN_ROOT, token_y:order_id,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!saveRet || !saveRet.ret)  return res.json({ret:false,msg:"pay successed! and update order-status failed"})

    // let userMsgId = await s_queryUserMSGToken(user_id)
    // let shopUserMsgId = await s_queryUserMSGToken(shopInfo.user_id)

    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'支付订单（订单ID:'+orderInfo.order_id+'，金额'
    //         +orderInfo.total_money+'元）成功',extra_data:JSON.stringify(orderInfo)})

    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:shopUserMsgId,opval:'您的商铺（'+shopInfo.shop_name
    //         +'）销售商品（订单ID:'+orderInfo.order_id+'，金额'
    //         +orderInfo.total_money+'元），订单已收款成功，请及时发货',extra_data:JSON.stringify(orderInfo)})

    user_redis.set(ll_config.redis_key+":order-status:"+order_id,'ok',60*60)

    res.json({ret:true,msg:'success'})
}


/**
 * 查询订单列表
 * queryOrderList
 */
window.shopping_c.queryShopOrderList =queryShopOrderList;
async function queryShopOrderList(req,res) {
    let {shop_id,user_id, s_id,order_status,begin,len,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})

    begin = begin - 1
    begin = begin*len

    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!shopInfoRet || !shopInfoRet.ret) return res.json({ret:false,msg:"shop-info is empty"})
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    if(shopInfo.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update shopinfo no pm"})

    // let orderUserId = ORDER_TOKEN_NAME+'_'+user_id.split('_')[1]
    let orderShopId = ORDER_TOKEN_NAME+'_'+shop_id.split('_')[1]

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/relations',{token:orderShopId, opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let results = []
    let queryObjInfoP = []
    let i = 0
    for(;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        results.push(info)
    }

    let newObjs = [], cnt = 0;
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<results.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time)
            if(order_status =='all' || order_status-0 == newInfo.order_status-0)
            {
                cnt ++;
                if(cnt>=begin && cnt <begin+len)
                {
                    newInfo.user_name = newInfo.address_info.user_name;
                    newInfo.phone = newInfo.address_info.phone;
                    newInfo.address = newInfo.address_info.address;
                    newObjs.push(newInfo)
                }
            }
        }
    })

    if(newObjs && newObjs.length>0)
        return res.json({ret:true,msg:'success',list:newObjs});
    else
        res.json({ret:false,msg:'order-list is empty'})
}

/**
 * 订单退款
 * @type {refundOrder}
 */
window.shopping_c.refundOrder =refundOrder;
async function refundOrder(req,res) {
    let {user_id,shop_id, s_id, order_id,random, sign} = str_filter.get_req_data(req);

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":refundOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":refundOrder:"+order_id+random,random,120)

    //判断是否已经支付过。
    str = await user_redis.get(ll_config.redis_key+":order-refund:"+order_id)
    if(str=='ok')
    {
        return res.json({ret: false, msg: "order is refunded"});
    }
    // user_redis.set(config.redis_key+":order-refund:"+order_id,'ok',60*60)

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet ||  !assertInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    if(orderInfo.order_status<=0) return res.json({ret:false,msg:"can not refund unpayed order!"})
    if(orderInfo.shop_id!=shop_id) return res.json({ret:false,msg:"not shop's order"})

    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,begin:0,len:1,opcode:'assert'});
    if(!shopInfoRet ||  !shopInfoRet.ret) return res.json({ret:false,msg:"shop-info is empty"})
    let shopInfo =  JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    if(orderInfo.user_id!=user_id && shopInfo.user_id != user_id) return res.json({ret:false,msg:"refund order no pm"})
    //如果是用户发起的退款，则要求当没有发起快递之前。
    if(orderInfo.user_id==user_id  && orderInfo.order_status>1)  return res.json({ret:false,msg:"shop-manager have sended wuliu"})

    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:RMB_TOKEN_ROOT,token_y:RMB_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],
        opval:orderInfo.total_money,extra_data:JSON.stringify(orderInfo)})

    if(!sendRet || !sendRet.ret) return res.json({ret:false,msg:"refund order,and send rmb failed!"})


    orderInfo.order_status = 9;//退款成功。
    orderInfo.order_refund = true;
    orderInfo.refund_uid = user_id;

    let assertNewInfoRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,
        opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertNewInfoRet || !assertNewInfoRet.ret){
        sendRet = rpc_query(RMB_API_BASE+"/send",{token_x:RMB_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],token_y:RMB_TOKEN_ROOT,
            opval:orderInfo.total_money,extra_data:JSON.stringify(orderInfo)})
        return res.json({ret:false,msg:"refund order,and assert order-info failed!",money_back:sendRet&&sendRet.ret})
    }

    // await rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+shopInfo.user_id.split('_')[1],opval:'【订单管理】订单退款成功（订单ID:'+orderInfo.order_id+'，金额'
    //         +orderInfo.total_money+'元）！',extra_data:JSON.stringify(orderInfo)})

    // await rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],opval:'订单退款成功（订单ID:'+orderInfo.order_id+'，金额'
    //         +orderInfo.total_money+'元）！',extra_data:JSON.stringify(orderInfo)})

    user_redis.set(ll_config.redis_key+":order-refund:"+order_id,'ok',60*60)
    res.json({ret:true,msg:'success'})
}
/**
 * 填写快递单号
 * @type {sendKD}
 */
window.shopping_c.sendKD =sendKD;
async function sendKD(req,res) {
    let {user_id,s_id,shop_id,order_id,kd_company,kd_number} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!order_id) return res.json({ret:false,msg:"order_id error"})


    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!shopInfoRet || !shopInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    if(shopInfo.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"shop-order no pm"})


    let orderInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!orderInfoRet || !orderInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(orderInfoRet.list[0].txjson).opval)
    if(orderInfo.order_status!=1) return res.json({ret:false,msg:"order-status is not payed,maybe order-status=1"})

    if(orderInfo.shop_id!=shop_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update order-kuaidi no pm"})

    let newObj = {kd_company,kd_number}
    newObj = Object.assign(newObj,orderInfo)
    newObj.order_status=2;

    let assertOrderRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: order_id})
    if(!assertOrderRet || !assertOrderRet.ret) return res.json({ret: false, msg: "save order-kd-info failed"});

    //发送一条系统消息
    // rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
    //     opval:'【订单管理】订单发货成功！快递公司名称：'+kd_company+"，快递单号："+kd_number+"，订单ID:"+order_id,extra_data:JSON.stringify(newObj)})

    // rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],
    //     opval:'【订单通知】您的订单发货成功！快递公司名称：'+kd_company+"，快递单号："+kd_number+"，订单ID:"+order_id,extra_data:JSON.stringify(newObj)})


    return res.json({ret:true,msg:'success'})
}

/**
 * 确认收货
 * @type {recvOrder}
 */
window.shopping_c.recvOrder =recvOrder;
async function recvOrder(req,res) {
    let {user_id,s_id,shop_id,order_id,kd_company,kd_number} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    // if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!order_id) return res.json({ret:false,msg:"order_id error"})

    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!shopInfoRet || !shopInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)
    // if(shopInfo.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"shop-order no pm"})

    let orderInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!orderInfoRet || !orderInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(orderInfoRet.list[0].txjson).opval)
    if(orderInfo.order_status!=2) return res.json({ret:false,msg:"order-status is not send wuliu,maybe order-status=2"})

    // if(orderInfo.shop_id!=shop_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update order-kuaidi no pm"})
    orderInfo.recv_wuliu = true;
    orderInfo.recv_wuliu_time =  parseInt(new Date().getTime()/1000)
    orderInfo.order_status = 3;

    let assertOrderRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data: order_id})
    if(!assertOrderRet || !assertOrderRet.ret) return res.json({ret: false, msg: "save order-recv-wuliu-info failed"});

    //发送一条系统消息
    // rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
    //     opval:'订单收货成功！订单ID:'+order_id,extra_data:JSON.stringify(orderInfo)})

    // rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+shopInfo.user_id.split('_')[1],
    //     opval:'【订单通知】用户已经收货成功！订单ID:'+order_id,extra_data:JSON.stringify(orderInfo)})

    return res.json({ret:true,msg:'success'})
}


/**
 * 评价订单
 * @type {commentOrder}
 */
window.shopping_c.commentOrder =commentOrder;
async function commentOrder(req,res) {
    let {user_id,s_id,shop_id,order_id,rank,comment} = str_filter.get_req_data(req)
    if(rank-0 != rank || rank-0<0|| rank-0>5) return res.json({ret:false,msg:"rank error"})
    if(!comment) return res.json({ret:false,msg:"comment error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    // if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!order_id) return res.json({ret:false,msg:"order_id error"})

    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!shopInfoRet || !shopInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)
    // if(shopInfo.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"shop-order no pm"})

    let orderInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,opcode:'assert',begin:0,len:1})
    if(!orderInfoRet || !orderInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(orderInfoRet.list[0].txjson).opval)
    if(orderInfo.order_status!=3) return res.json({ret:false,msg:"order-status is not check wuliu,maybe order-status=3"})

    // if(orderInfo.shop_id!=shop_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update order-kuaidi no pm"})
    orderInfo.comment_flag = true;
    orderInfo.comment_time =  parseInt(new Date().getTime()/1000)
    orderInfo.comment = comment;
    orderInfo.rank = rank;
    orderInfo.order_status = 4;

    let assertOrderRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data: order_id})
    if(!assertOrderRet || !assertOrderRet.ret) return res.json({ret: false, msg: "save order-comment-info failed"});

    //发送一条系统消息
    // await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],
    //     opval:'订单评价成功！订单ID:'+order_id,extra_data:JSON.stringify(orderInfo)})

    // await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+shopInfo.user_id.split('_')[1],
    //     opval:'【订单通知】用户已经评价订单成功！订单ID:'+order_id,extra_data:JSON.stringify(orderInfo)})

    for(let i=0;i<orderInfo.goods.length;i++)
    {
        //发送每个商品正面的订单评价。
        await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:orderInfo.goods[i].product_id,
            opval:JSON.stringify(orderInfo),extra_data:user_id})
    }

    return res.json({ret:true,msg:'success'})
}

/**
 * 查询商品的评价列表
 * @type {queryCommentList}
 */
window.shopping_c.queryCommentList =queryCommentList;
async function queryCommentList(req,res) {
    let {user_id, s_id,product_id, begin,len,random,sign} = str_filter.get_req_data(req);
    if(!product_id) return res.json({ret:false,msg:"product_id error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:product_id,opcode:'send',begin,len})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    // let objs = []
    // let i = 0
    // for(;i<list.length;i++)
    // {
    //     let info = list[i]
    //     // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
    //     //放到数组中，等待处理。
    //     queryObjInfoP.push( rpc_query(ORDER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))
    //
    //     objs.push(info)
    // }

    // let newObjs = []
    // await Promise.all(queryObjInfoP).then(function(rets){
    //     JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
    //     let i =0;
    //     for(;i<objs.length;i++)
    //     {
    //         let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
    //         newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time)
    //         // newInfo.goods = JSON.parse(newInfo.goods)
    //         // newInfo.address_info = JSON.parse(newInfo.address_info)
    //         newObjs.push(newInfo)
    //     }
    // })

    if(list && list.length>0)
        return res.json({ret:true,msg:'success',list:list});
    else
        res.json({ret:false,msg:'comment-list is empty'})
}
