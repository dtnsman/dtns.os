/**
 * Created by dovis on 2022/1/21.
 */
// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// // const user_redis = require('..//config').user_redis;
// const manager_c = require('./manager_c');


// const rpc_query = require('..//rpc_api_config').rpc_query
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')
    
const rpc_api_util = require('../rpc_api_util') 

/**
 * 新建一个订单
 * @type {createOrder}
 */
module.exports.createOrder =createOrder;
async function createOrder(req,res) {
    let {user_id, s_id, goods,note, random,calculate, sign} = str_filter.get_req_data(req);

    if(!goods)  return res.json({ret:false,msg:"goods error"})
    if(!note)  note='';//return res.json({ret:false,msg:"note error"})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(config.redis_key+":createOrder:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":createOrder:"+user_id+random,random,120)

    try{
        goods  =JSON.parse(goods)
    }catch(ex)
    {
        return res.json({ret:false,msg:'goods_info error'})
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
        queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:goods[i].obj_id,opcode:'assert',begin:0,len:1}))
    }

    //处理全部请求（这里允许修改订单价格等）---所以重新查询一下（其实暂时没必要，重新发就可以了---但是重新发会影响obj-id，导致用户权益受损）。
    let total_money = 0;
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<goods.length;i++)
        {
            list.push(JSON.parse(JSON.parse(rets[i].list[0].txjson).opval))
            // list[i].number = goods[i].number
            // total_money += list[i].number * list[i].rmb_price
            list[i].number = 1
            total_money += list[i].number * list[i].rmb_price
        }
    })

    let forkRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT})
    if(!forkRet || !forkRet.ret) return res.json({ret:false,msg:'create order-id failed'})

    let order_id = forkRet.token_x;
    let save_time = parseInt(new Date().getTime()/1000)
    //订单ID，商品列表，福刻评语，总的价格等，订单时间等。
    let orderInfo = {order_id,user_id,goods:list,note,total_money,state:1,create_time_i:save_time}

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
    let orderForkId = ORDER_TOKEN_NAME+'_'+orderInfo.goods[0].user_id.split('_')[1]

    await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,dst_token:orderUserId});
    await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,dst_token:orderForkId});

    //创建全部作品id
    let forkAllOrderRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:ORDER_TOKEN_NAME+'_orderall00000000',opcode:'fork',begin:0,len:1})
    if(!forkAllOrderRet ||!forkAllOrderRet.ret)
    {
        let forkAllOrderRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,dst_token:ORDER_TOKEN_NAME+'_orderall00000000'})
        if(!forkAllOrderRet ||!forkAllOrderRet.ret) return res.json({ret:false,msg:"fork orderall-id failed"});
    }

    let userHoldRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:orderUserId,token_y:order_id,
        opcode:'hold',opval:'add',extra_data:JSON.stringify(orderInfo)});
    if(!userHoldRet || !userHoldRet.ret) return res.json({ret:false,msg:'add orderInfo to user-order-list failed'})

    let forkHoldRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:orderForkId,token_y:order_id,
        opcode:'hold',opval:'add',extra_data:JSON.stringify(orderInfo)});
    if(!forkHoldRet || !forkHoldRet.ret) return res.json({ret:false,msg:'add orderInfo to create-order-list failed'})

    let ManagerHoldRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_NAME+'_orderall00000000',token_y:order_id,
        opcode:'hold',opval:'add',extra_data:JSON.stringify(orderInfo)});
    if(!ManagerHoldRet || !ManagerHoldRet.ret) return res.json({ret:false,msg:'add orderInfo to all-order-list failed'})

    res.json({ret:true,msg:'success',order_id})
}

/**
 * 查询列表
 * queryOrderList
 */
module.exports.queryOrderList =queryOrderList;
async function queryOrderList(req,res) {
    let {user_id, s_id,begin,len,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let list = await rpc_api_util.s_query_token_list(ORDER_API_BASE,ORDER_TOKEN_NAME+'_'+ user_id.split('_')[1],'hold',begin*len,len);

    res.json({ret:true,msg:'success',orderList:list})

}

/**
 * 查询全部订单列表
 * queryAllOrderList
 */
module.exports.queryAllOrderList =queryAllOrderList;
async function queryAllOrderList(req,res) {
    let {user_id, s_id,begin,len,random,sign} = str_filter.get_req_data(req);

    // let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    // if(!str) return res.json({ret:false,msg:"session error"})

    let list = await rpc_api_util.s_query_token_list(ORDER_API_BASE,ORDER_TOKEN_NAME+'_orderall00000000','hold',begin*len,len);

    res.json({ret:true,msg:'success',orderList:list})

}


/**
 * 取消订单
 * @type {cancelOrderInfo}
 */
module.exports.cancelOrderInfo =cancelOrderInfo;
async function cancelOrderInfo(req,res) {
    let {user_id, s_id, order_id,random, sign} = str_filter.get_req_data(req);

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet ||  !assertInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(orderInfo.state!=1) return res.json({ret:false,msg:"can not delete your payed order!"})
    if(orderInfo.user_id!=user_id) return res.json({ret:false,msg:"delete order no pm"})

    //取消订单状态
    orderInfo.state = 9
    
    let assertRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:order_id,opcode:'assert',opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!assertRet || !assertRet.ret) return res.json({ret:false,msg:'save order-info failed'})

    res.json({ret:true,msg:'success'})
}


/**
 * 删除订单信息
 * @type {deleteOrderInfo}
 */
module.exports.deleteOrderInfo =deleteOrderInfo;
async function deleteOrderInfo(req,res) {
    let {user_id, s_id, order_id,random, sign} = str_filter.get_req_data(req);

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet ||  !assertInfoRet.ret) return res.json({ret:false,msg:"order-info is empty"})
    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(orderInfo.state!=1) return res.json({ret:false,msg:"can not delete your payed order!"})
    if(orderInfo.user_id!=user_id) return res.json({ret:false,msg:"delete order no pm"})


    //从购买者列表中删除
    let delRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_NAME+'_'+orderInfo.user_id.split('_')[1],token_y:order_id,
        opcode:'hold',opval:'del',extra_data:user_id})
    if(!delRet || !delRet.ret) return res.json({ret:false,msg:'del order from user-order-list failed'})

    // //从create订单队列中删除
    // let orderForkId = ORDER_TOKEN_NAME+'_'+orderInfo.goods[0].user_id.split('_')[1]
    // delRet = await rpc_query(ORDER_API_BASE+'/op',{token_x:orderForkId,token_y:order_id, opcode:'hold',opval:'del',extra_data:user_id})
    // if(!delRet || !delRet.ret) return res.json({ret:false,msg:'del order from fork-order-list failed'})

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
module.exports.queryOrderInfo =queryOrderInfo;
async function queryOrderInfo(req,res) {
    let {user_id, s_id, order_id,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(assertInfoRet && assertInfoRet.ret){
        let order = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        
        return res.json({ret:true,msg:'success',order})
    }
    res.json({ret:false,msg:'order info is empty'})
}

/**
 * 查询用户的RMB-token（如果不存在，就fork）
 * @returns {Promise<*>}
 */
module.exports.s_queryUserRMBToken =s_queryUserRMBToken;
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
// module.exports.s_queryUserMSGToken =s_queryUserMSGToken;
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
 * 支付订单。（余额支付）
 * @type {payOrderByAccount}
 */
module.exports.payOrderByAccount =payOrderByAccount;
async function payOrderByAccount(req,res) {
    let {user_id, s_id, order_id, random, sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(config.redis_key+":payOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":payOrder:"+order_id+random,random,120)

    //判断是否已经支付过。
    str = await user_redis.get(config.redis_key+":order-status:"+order_id)
    if(str=='ok')
    {
        return res.json({ret: false, msg: "order is payed"});
    }
    // user_redis.set(config.redis_key+":order-status:"+order_id,'ok',60*60)

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "order-info is empty"});

    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    if(orderInfo.state >1)
        return res.json({ret: false, msg: "order is payed",data:{'state':orderInfo.state}});
    if(orderInfo.user_id!=user_id) return res.json({ret: false, msg: "it is not your order"});


    let pay_type = 'rmb'
    let obj_id = orderInfo.goods[0].obj_id

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('nft')<0) return res.json({ret:false,msg:"obj_id error"})

    let obj =  orderInfo.goods[0]
 
    // if(obj.user_id==user_id) return res.json({ret:false,msg:"can not buy youself nft"})

    //查询用户资料，nft_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.nft_buyed_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'nftbuy'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork user-buyed-id failed"});
        userInfo.nft_buyed_id = forkRet.token_x

        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo nft-buyed-id failed"});
    }
   
    obj.pay_type = pay_type;

    //扣用户的余额费用。
    let payRMBNum = obj.rmb_price* 1 ;

    if(pay_type=='gsb') {
       //
    }else if(pay_type=='rmb')
    {
        let userAccountRet = await rpc_query(RMB_API_BASE + "/chain/opcode", {token: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opcode: 'send', begin: 0, len: 1})
        let userWalletRMB = userAccountRet && userAccountRet.ret ? JSON.parse(userAccountRet.list[0].txjson).token_state : 0;
        console.log('扣除用户总额：'+payRMBNum);
        console.log('用户余额：'+userWalletRMB);
        if (payRMBNum > userWalletRMB) return res.json({ret: false, msg: "user have not enough rmb to pay order"})

        //买家扣除
        obj.send_node='购买福刻作品'
        let rootpayRet = await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + "_" + user_id.split('_')[1],
            token_y: RMB_TOKEN_ROOT, opval: payRMBNum, extra_data: JSON.stringify(obj)})
        if (!rootpayRet || !rootpayRet.ret) return res.json({ret: false, msg: "pay rmb to nft failed"});
        console.log("余额支付，支付费用成功")


        let list = [], level=1;
        await forklist_c.calculateSubaccount(list, level, obj_id, payRMBNum)
        console.log("计算佣金分配")

        await forklist_c.sendSubaccount(obj_id, list)
        console.log("发放佣金")
   
    }

    //福刻
    obj.forkComments = orderInfo.note
    obj.original_obj_id= obj_id
    obj.owner = user_id
    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'nft'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork nft-new-obj-id failed"});
    //保存obj-id，方便查询。
    obj.obj_id = forkObjRet.token_x
    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.nft_list_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-new-obj-info failed"});


    //更新了用户的购买列表
    let buyOrder = {buy_user_id:user_id,user_name:userInfo.user_name,buy_obj_id:obj_id,buy_time:parseInt(new Date().getTime()/1000),pay_rmb:obj.rmb_price}
    buyOrder = Object.assign(obj,buyOrder)

    //hold user-hold nft_buyed_id
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:userInfo.nft_buyed_id,token_y:obj_id,opcode:'hold',
    opval:'add',extra_data:JSON.stringify(buyOrder)})
    if(!holdRet || !holdRet.ret)
    {
        console.log("hold更新订单列表失败，进行退款业务")
        //退款
        if(pay_type=='gsb') {
           //
        }else if(pay_type=='rmb') {
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_rmb, extra_data: JSON.stringify(obj)})
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_root_rmb, extra_data: JSON.stringify(obj)})
        }
        return res.json({ret: false, msg: "hold nft-obj-info to nft_buyed_id failed"});
    }

    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.nft_buyed_id,
        opval:JSON.stringify(buyOrder),extra_data:obj_id})
    if(!sendRet || !sendRet.ret)
    {
        console.log("更新订单列表失败，进行退款业务")
        //退款
        if(pay_type=='gsb') {
            ///
        }else if(pay_type=='rmb') {
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_rmb, extra_data: JSON.stringify(obj)})
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_root_rmb, extra_data: JSON.stringify(obj)})
        }
        // console.log("更新订单列表失败，进行退款业务成功")
        return res.json({ret: false, msg: "send to user-buyed-list failed"});
    }

    //更新源福刻交易记录
    let xx = async function()
    {
        //该作品的交易记录
        let historysendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opval:JSON.stringify(buyOrder),extra_data: user_id})
        if(!historysendRet || !historysendRet.ret){
            console.log("福刻交易历史记录更新失败")
        }
    }
    xx();

    //福刻版本
    let NFTFork = async function(){
        //利市与作品hold关联
        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj.obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(buyOrder)})
        // if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info to album failed"});
        if(!holdRet || !holdRet.ret){
            console.log("利市与作品hold关联失败")
        }
    }
    NFTFork();

    //修改订单状态：
    orderInfo.state=2;
    orderInfo.payed='ok'
    let saveRet = await rpc_query(ORDER_API_BASE+'/op',{ token_x:ORDER_TOKEN_ROOT, token_y:order_id,opcode:'assert',
        opval:JSON.stringify(orderInfo),extra_data:user_id})
    if(!saveRet || !saveRet.ret)  return res.json({ret:false,msg:"pay successed! and update order-status failed"})
   


    user_redis.set(config.redis_key+":order-status:"+order_id,'ok',60*60)

    console.log('window.user_c.createFORKMap:',window && window.user_c ?window.user_c.createFORKMap:null )
    let forkMapRet = await window.user_c.createFORKMap(obj_id)
    console.log('payOrderByAccount-forkMapRet:',forkMapRet)

    res.json({ret:true,msg:'success'})
}













/**
 * 支付订单。
 * @type {payOrder}
 */
module.exports.payOrder =payOrder;
async function payOrder(req,res) {
    let {user_id, s_id, order_id, random, sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(config.redis_key+":payOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":payOrder:"+order_id+random,random,120)

    //判断是否已经支付过。
    str = await user_redis.get(config.redis_key+":order-status:"+order_id)
    if(str=='ok')
    {
        return res.json({ret: false, msg: "order is payed"});
    }
    // user_redis.set(config.redis_key+":order-status:"+order_id,'ok',60*60)

    let assertInfoRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:order_id,begin:0,len:1,opcode:'assert'});
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "order-info is empty"});

    let orderInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    if(orderInfo.state >1)
        return res.json({ret: false, msg: "order is payed",data:{'state':orderInfo.state}});
    if(orderInfo.user_id!=user_id) return res.json({ret: false, msg: "it is not your order"});


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

    user_redis.set(config.redis_key+":order-status:"+order_id,'ok',60*60)

    res.json({ret:true,msg:'success'})
}


/**
 * 查询订单列表
 * queryOrderList
 */
module.exports.queryShopOrderList =queryShopOrderList;
async function queryShopOrderList(req,res) {
    let {shop_id,user_id, s_id,order_status,begin,len,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
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
module.exports.refundOrder =refundOrder;
async function refundOrder(req,res) {
    let {user_id,shop_id, s_id, order_id,random, sign} = str_filter.get_req_data(req);

    if (!order_id) return res.json({ret: false, msg: "order_id error"})
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(config.redis_key+":refundOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":refundOrder:"+order_id+random,random,120)

    //判断是否已经支付过。
    str = await user_redis.get(config.redis_key+":order-refund:"+order_id)
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

    user_redis.set(config.redis_key+":order-refund:"+order_id,'ok',60*60)
    res.json({ret:true,msg:'success'})
}
/**
 * 填写快递单号
 * @type {sendKD}
 */
module.exports.sendKD =sendKD;
async function sendKD(req,res) {
    let {user_id,s_id,shop_id,order_id,kd_company,kd_number} = str_filter.get_req_data(req)

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
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
module.exports.recvOrder =recvOrder;
async function recvOrder(req,res) {
    let {user_id,s_id,shop_id,order_id,kd_company,kd_number} = str_filter.get_req_data(req)

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
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
module.exports.commentOrder =commentOrder;
async function commentOrder(req,res) {
    let {user_id,s_id,shop_id,order_id,rank,comment} = str_filter.get_req_data(req)
    if(rank-0 != rank || rank-0<0|| rank-0>5) return res.json({ret:false,msg:"rank error"})
    if(!comment) return res.json({ret:false,msg:"comment error"})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
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
module.exports.queryCommentList =queryCommentList;
async function queryCommentList(req,res) {
    let {user_id, s_id,product_id, begin,len,random,sign} = str_filter.get_req_data(req);
    if(!product_id) return res.json({ret:false,msg:"product_id error"})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
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
