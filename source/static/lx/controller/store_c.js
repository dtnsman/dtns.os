/**
 * Created by lauo.li on 2019/4/28.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const gnode_format_util = require('../libs/gnode_format_util');
// const config = require('../config').config;
// const user_redis = require('..//config').user_redis;
// // const user_m = require('../model/user_m');
// const shop_c = require('./shop_c');
// const product_c = require('./product_c');

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
window.store_c = {}
/**
 * 创建产品仓库
 * @type {newStore}
 */
window.store_c.newStore =newStore;
async function newStore(req,res) {
    let {user_id,s_id,store_kind,store_name,store_desc,store_who,store_phone,store_addr,store_wuliu_kind,store_wuliu,store_image,random,sign} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":newStore:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":newStore:"+user_id+random,random,120)

    if(!store_kind) return res.json({ret:false,msg:"store_kind error"})
    if(!store_name) return res.json({ret:false,msg:"store_name error"})
    if(!store_desc) return res.json({ret:false,msg:"store_desc error"})
    if(!store_who) return res.json({ret:false,msg:"store_who error"})
    if(!store_phone) return res.json({ret:false,msg:"store_phone error"})
    if(!store_wuliu_kind) return res.json({ret:false,msg:"store_wuliu_kind error"})
    if(!store_wuliu) return res.json({ret:false,msg:"store_phone error"})
    if(!store_image) return res.json({ret:false,msg:"store_image error"})

    let obj = {user_id,store_kind,store_name,store_desc,store_who,store_phone,store_addr,store_wuliu_kind,store_wuliu,store_image,save_time:parseInt(new Date().getTime()/1000),tips:'审核中'}

    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'store'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork store-new-obj-id failed"});

    //保存obj-id，方便查询。
    obj.store_id = forkObjRet.token_x

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert store-new-obj-info failed"});

    //hold user-hold store-obj-id
    let joinRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1],token_y:obj.store_id,opcode:'join',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!joinRet || !joinRet.ret)  return res.json({ret: false, msg: "have-join store-obj-info failed"});

    // if(store_id)
    // {
    //     let saveStoreRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:obj.store_id,
    //         opval:'add',extra_data:JSON.stringify(obj)})
    //     if(!saveStoreRet || !saveStoreRet.ret)
    //         console.log( "save to store-store store-obj-info failed");
    // }
    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'恭喜您，您成功创建名为'+store_name+'产品仓库！',extra_data:JSON.stringify(obj)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 查询产品仓库的信息
 * @type {querystoreInfo}
 */
window.store_c.queryStoreInfo =queryStoreInfo;
async function queryStoreInfo(req,res) {
    let {user_id, s_id, store_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if (!store_id) return res.json({ret: false, msg: "store_id error"})

    // let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: store_id, opcode: 'assert', begin: 0, len: 1})
    // if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "store_id-info is empty"})
    // let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    let oldObj = await s_queryStoreInfo(store_id)
    if(!oldObj) return res.json({ret: false, msg: "store info is empty"})

    oldObj.ret = true;
    oldObj.msg = 'success'
    res.json(oldObj)
}

/**
 * 内部的产品查询函数
 * @type {s_querystoreInfo}
 */
window.store_c.s_queryStoreInfo =s_queryStoreInfo;
async function s_queryStoreInfo(store_id) {
    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: store_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return null
    return  JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
}

/**
 * 删除产品仓库
 * @type {deleteStore}
 */
window.store_c.deleteStore =deleteStore;
async function deleteStore(req,res) {
    let {user_id, s_id, store_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if (!store_id) return res.json({ret: false, msg: "store_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: store_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "store_id-info is empty"})
    let storeInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    let joinRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_'+storeInfo.user_id.split('_')[1],token_y:storeInfo.store_id,opcode:'join',
        opval:'del',extra_data:JSON.stringify(storeInfo)})
    if(!joinRet || !joinRet.ret)  return res.json({ret: false, msg: "delete store-obj-info failed"});

    res.json({ret:true,msg:'success'})
}
/**
 * 更新产品仓库信息（store_id）
 * @type {updateStoreInfo}
 */
window.store_c.updateStoreInfo =updateStoreInfo;
async function updateStoreInfo(req,res) {
    let {user_id,s_id,store_id,store_kind,store_name,store_desc,store_who,store_phone,store_addr,store_wuliu_kind,store_wuliu,store_image,random,sign} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":newStore:"+store_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":newStore:"+store_id+random,random,120)

    if(!store_kind) return res.json({ret:false,msg:"store_kind error"})
    if(!store_name) return res.json({ret:false,msg:"store_name error"})
    if(!store_desc) return res.json({ret:false,msg:"store_desc error"})
    if(!store_who) return res.json({ret:false,msg:"store_who error"})
    if(!store_phone) return res.json({ret:false,msg:"store_phone error"})
    if(!store_wuliu_kind) return res.json({ret:false,msg:"store_wuliu_kind error"})
    if(!store_wuliu) return res.json({ret:false,msg:"store_phone error"})
    if(!store_image) return res.json({ret:false,msg:"store_image error"})

    let obj = {store_kind,store_name,store_desc,store_who,store_phone,store_addr,store_wuliu_kind,store_wuliu,store_image,save_time:parseInt(new Date().getTime()/1000),tips:'审核中'}

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:store_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(oldObj.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update storeinfo no pm"})

    let newObj = {}
    newObj = Object.assign(newObj,oldObj,obj)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:store_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert store-update-obj-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'【仓库更新】您成功修改了产品仓库信息！产品仓库名称：'+store_name+" 产品仓库ID:"+store_id,extra_data:JSON.stringify(obj)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 查询我的产品仓库
 * @type {queryAllStores}
 */
window.store_c.queryAllStores =queryAllStores;
async function queryAllStores(req, res) {
    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let allJoinRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1],isx:true,opcode:'join',begin:begin*len,len:len})
    if(!allJoinRet || !allJoinRet.ret)  return res.json({ret: false, msg: "user-store-list is empty"})
    let storeList = allJoinRet && allJoinRet.ret ? allJoinRet.list:[]

    let i=0, queryObjInfoP = [],list=[]
    for(;i<storeList.length;i++)
    {
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:storeList[i].token_y,opcode:'assert',begin:0,len:1}))
    }

    //处理全部请求（这里允许修改订单价格等）---所以重新查询一下（其实暂时没必要，重新发就可以了---但是重新发会影响obj-id，导致用户权益受损）。
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<storeList.length;i++)
        {
            list.push(JSON.parse(JSON.parse(rets[i].list[0].txjson).opval))
            list[i].save_time = str_filter.GetDateTimeFormat(list[i].save_time)
        }
    })

    res.json({ret:true,msg:'success',list:list})
}




/**
 * 货架添加产品。
 * @type {add_product}
 */
window.store_c.add_product =add_product;
async function add_product(req,res) {
    let {user_id, s_id, product_id, store_id, random, sign} = str_filter.get_req_data(req)

    if (!store_id) return res.json({ret: false, msg: "store_id error"})
    if (!product_id) return res.json({ret: false, msg: "classify_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let storeInfo = await s_queryStoreInfo(store_id)
    if(!storeInfo) return res.json({ret:false,msg:'store-info is empty'})
    if(storeInfo.user_id != user_id) return res.json({ret:false,msg:'not store manager'})

    let productInfo = await product_c.s_queryProductInfo(product_id)
    if(!productInfo) return res.json({ret:false,msg:'productInfo is empty'})

    let joinRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)})
    if(!joinRet|| !joinRet.ret) return res.json({ret:false,msg:'product-info add to classify failed!'})

    return res.json({ret:true,msg:'success'})
}

/**
 * 从货架上删除产品
 * @type {del_product}
 */
window.store_c.del_product =del_product;
async function del_product(req,res) {
    let {user_id, s_id,product_id, store_id, random, sign} = str_filter.get_req_data(req)

    if (!store_id) return res.json({ret: false, msg: "store_id error"})
    if (!product_id) return res.json({ret: false, msg: "classify_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:product_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'del product-info from classify failed!'})

    return res.json({ret:true,msg:'success'})
}

/**
 * 前置到最顶部
 * @type {up_product}
 */
window.store_c.up_product =up_product;
async function up_product(req,res) {
    let {user_id, s_id,product_id, store_id, random, sign} = str_filter.get_req_data(req)

    if (!store_id) return res.json({ret: false, msg: "store_id error"})
    if (!product_id) return res.json({ret: false, msg: "product_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:product_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'up product-info failed! code:1'})

    let productInfo = await product_c.s_queryProductInfo(product_id)
    if(!productInfo) return res.json({ret:false,msg:'productInfo is empty'})

    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)})

    holdRet = !holdRet|| !holdRet.ret ? await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)}) : holdRet

    holdRet = !holdRet|| !holdRet.ret ? await rpc_query(OBJ_API_BASE+'/op',{token_x:store_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)}) : holdRet

    if(!holdRet|| !holdRet.ret) return res.json({ret:false,msg:'up product-info failed! code:2'})

    return res.json({ret:true,msg:'success'})
}



/**
 * 得到货架的产品。
 * @type {shop_products}
 */

window.store_c.query_products =query_products;
async function query_products(req,res) {
    let {user_id, s_id, store_id, begin,len,random, sign} = str_filter.get_req_data(req)

    if (!store_id) return res.json({ret: false, msg: "store_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let rlist =  await s_query_products(store_id,begin*len,len)
    res.json({ret:true,msg:'success',list:rlist})
}

/**
 * 查询列表。
 * @type {function(*=, *, *): Array}
 */
window.store_c.s_query_products =s_query_products;
async function s_query_products(store_id,begin,len) {

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:store_id,opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryObjInfoP = []
    let i = 0
    for(;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = []
    //查询分类数据
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newObjs.push(newInfo)
        }
    })

    //排序
    // newObjs.sort(function(a,b){
    //     if(a.sort_num!=b.sort_num)
    //         return a.sort_num-b.sort_num
    //     else
    //         return a.save_time -  b.save_time;
    // })

    //if(begin==0&& len>newObjs.length) return newObjs;
    let rlist = [],j=begin
    for(;j<newObjs.length && j<begin+len;j++)
    {
        newObjs[j].save_time = str_filter.GetDateTimeFormat(newObjs[j].save_time)
        rlist.push(newObjs[j])
    }

    return rlist;
}