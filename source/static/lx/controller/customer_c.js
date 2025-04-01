/**
 * Created by lauo.li on 2019/5/16.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const gnode_format_util = require('../libs/gnode_format_util');
// const config = require('../config').config;
// const user_redis = require('..//config').user_redis;
// // const user_m = require('../model/user_m');
// const shop_c = require('./shop_c');
// const shopping_c = require('./shopping_c');
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
window.customer_c = {}
/**
 * 查询所有用户
 * @type {queryCustomerList}
 */
window.customer_c.queryCustomerList =queryCustomerList;
async function queryCustomerList(req,res) {
    let {user_id, s_id, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let listRet = await rpc_query(USER_API_BASE+'/chain/relations',{token:USER_TOKEN_NAME+'_'+ shop_id.split('_')[1],
        opcode:'hold',isx:true,begin:begin*len,len})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(USER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = []
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.user_id =  newInfo.user_id ?  newInfo.user_id: objs[i].token_y;
                newInfo.regist_time = str_filter.GetDateTimeFormat(newInfo.regist_time_i ? newInfo.regist_time_i
                :JSON.parse(rets[i].list[0].txjson).timestamp_i);
            newObjs.push(newInfo)
        }
    })

    if(newObjs&&newObjs.length>0)
    {
        return res.json({ret:true,msg:'success',list:newObjs})
    }

    return  res.json({ret:false,msg:'customer list is empty'});
}


/**
 * 查找用户（由关键词（可以是地址，也可以是其他的））
 * @type {search}
 */
window.customer_c.searchCustomerList =searchCustomerList;
async function searchCustomerList(req,res) {
    let {user_id, s_id, search_key,shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    if (!search_key) return res.json({ret: false, msg: "search_key error"})
    search_key = search_key.toLowerCase()
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let listRet = await rpc_query(USER_API_BASE+'/chain/relations',{token:USER_TOKEN_NAME+'_'+ shop_id.split('_')[1],
        opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(USER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = [],cnt=0
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<objs.length;i++)
        {
            let str = JSON.parse(rets[i].list[0].txjson).opval.toLowerCase();
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.user_id =  newInfo.user_id ?  newInfo.user_id: objs[i].token_y;
            newInfo.regist_time = str_filter.GetDateTimeFormat(newInfo.regist_time_i ? newInfo.regist_time_i
                :JSON.parse(rets[i].list[0].txjson).timestamp_i);
            if(str.indexOf(search_key)>=0)
            {
                cnt++

                if(cnt>=(begin-0)*(len-0) && cnt<(parseInt(begin)+1)*parseInt(len))
                    newObjs.push(newInfo)
            }
        }
    })

    if(newObjs&&newObjs.length>0)
    {
        return res.json({ret:true,msg:'success',list:newObjs})
    }

    return  res.json({ret:false,msg:'customer list is empty'});
}

/**
 * 查找会员用户
 * @type {searchVipList}
 */
window.customer_c.queryVipList =queryVipList;
async function queryVipList(req,res) {
    let {user_id, s_id,shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let listRet = await rpc_query(USER_API_BASE+'/chain/relations',{token:USER_TOKEN_NAME+'_'+ shop_id.split('_')[1],
        opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(USER_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = [],cnt=0
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.user_id =  newInfo.user_id ?  newInfo.user_id: objs[i].token_y;
            newInfo.regist_time = str_filter.GetDateTimeFormat(newInfo.regist_time_i ? newInfo.regist_time_i
                :JSON.parse(rets[i].list[0].txjson).timestamp_i);

            let nowTime =  parseInt(new Date().getTime()/1000)
            if(newInfo.is_vip && newInfo.vip_timeout-nowTime>0)
            {
                cnt++

                if(cnt>=(begin-0)*(len-0) && cnt<(parseInt(begin)+1)*parseInt(len))
                    newObjs.push(newInfo)
            }
        }
    })

    if(newObjs&&newObjs.length>0)
    {
        return res.json({ret:true,msg:'success',list:newObjs})
    }

    return  res.json({ret:false,msg:'vip-user list is empty'});
}

/**
 * 查询商铺一年的VIP的价格
 * @type {s_queryVipPrice}
 */
window.customer_c.s_queryVipPrice =s_queryVipPrice;
async function s_queryVipPrice(shop_id) {
    if(!shop_id) return -1;

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return -1;
    let shopInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    return shopInfo.vip_price ? shopInfo.vip_price : 199;//默认价格为199元1年。
}

/**
 * 查询vip会员的价格。
 * @type {queryVipPrice}
 */
window.customer_c.queryVipPrice =queryVipPrice;
async function queryVipPrice(req,res) {
    let {user_id, s_id,shop_id} = str_filter.get_req_data(req);
    if(!shop_id) return res.json({ret:false,msg:'shop_id error'})

    let vip_price =await  s_queryVipPrice(shop_id)

    res.json({ret:true,msg:'success',vip_price})
}

/**
 * 更新商铺的VIP年费
 * @type {updateShopWeixinInfo}
 */
window.customer_c.updateShopVipPrice =updateShopVipPrice;
async function updateShopVipPrice(req,res) {
    let {user_id,s_id,shop_id,vip_price,time_kind} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(oldObj.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update shopinfo no pm"})

    // let newObj = {}
    if(time_kind=='year') oldObj.vip_price_y = vip_price
    else if(time_kind=='month') oldObj.vip_price_m = vip_price
    else if(time_kind=='day') oldObj.vip_price_d = vip_price
    else if(time_kind=='week') oldObj.vip_price_w = vip_price
    oldObj.vip_price = vip_price;
    oldObj.vip_time_kind = time_kind

    // newObj = Object.assign(newObj,oldObj)
    // if(!newObj.secret_key) newObj.secret_key = str_filter.randomSafe(16)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:shop_id,opcode:'assert',
        opval:JSON.stringify(oldObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert update-obj-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'【商铺管理】您在商铺管理，修改了商铺的VIP价格信息！商铺名称：'+oldObj.shop_name+" 商铺ID:"+shop_id,extra_data:JSON.stringify(obj)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 购买商铺VIP
 * @type {buyShopVipOrder}
 */
window.customer_c.buyShopVipOrder =buyShopVipOrder;
async function buyShopVipOrder(req,res) {
    let {user_id, s_id, shop_id, random,sign} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":payOrder:"+order_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":payOrder:"+order_id+random,random,120)

    let userInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!userInfoRet || !userInfoRet.ret) return res.json({ret:false,msg:"user-info is empty"})

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"shop-info is empty"})
    let shopInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    let vip_price =shopInfo.vip_price ? shopInfo.vip_price : 199 //await  s_queryVipPrice(shop_id)
    let vip_time_kind = shopInfo.vip_time_kind ? shopInfo.vip_time_kind:'year'
    let timeout = vip_time_kind=='year'?24*60*60 * 365 :( vip_time_kind=='month'?24*60*60 * 30 : (vip_time_kind=='day'?24*60*60 :24*60*60*7 ))

    //转帐
    let rmbUserId = await shopping_c.s_queryUserRMBToken(user_id)
    let userAccountRet = await rpc_query(RMB_API_BASE+"/chain/opcode",{token:rmbUserId,opcode:'send',begin:0,len:1})
    let userWalletMoney =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;

    if(vip_price > userWalletMoney) return res.json({ret:false,msg:"user have not enough money to pay vip-order"})

    let shopUserRmbId = await shopping_c.s_queryUserRMBToken(shopInfo.user_id)
    let orderInfo = {order_name:'购买VIP',money:vip_price,vip_time_kind,timeout,order_time: parseInt(new Date().getTime()/1000),shop_id,user_id}
    //开始转帐
    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:rmbUserId,token_y:shopUserRmbId,opval:vip_price,extra_data:JSON.stringify(orderInfo)})
    if(!sendRet || !sendRet.ret) return res.json({ret:false,msg:"send rmb failed"})

    //修改用户状态：

    userInfo.is_vip=true;
    if(userInfo.vip_timeout && userInfo.vip_timeout > orderInfo.order_time)
    {
        userInfo.vip_timeout = userInfo.vip_timeout+timeout
    }else{
        userInfo.vip_timeout = timeout
    }

    let saveRet = await rpc_query(USER_API_BASE+'/op',{ token_x:USER_TOKEN_ROOT, token_y:user_id,opcode:'assert',
        opval:JSON.stringify(userInfo),extra_data:JSON.stringify(orderInfo)})
    if(!saveRet || !saveRet.ret)  return res.json({ret:false,msg:"pay successed! and update user-vip-info failed"})

    let userMsgId = await shopping_c.s_queryUserMSGToken(user_id)
    let shopUserMsgId = await shopping_c.s_queryUserMSGToken(shopInfo.user_id)

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'购买会员订单成功（金额'
            +orderInfo.total_money+'元）!',extra_data:JSON.stringify(orderInfo)})

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:shopUserMsgId,opval:'您的商铺（'+shopInfo.shop_name
            +'）销售会员成功（UID:'+user_id+'，用户名：'+userInfo.nickName+'，金额'
            +orderInfo.total_money+'元），订单已收款成功！',extra_data:JSON.stringify(orderInfo)})

    res.json({ret:true,msg:'success'})
}