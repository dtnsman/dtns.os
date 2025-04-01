/**
 * Created by lauo.li on 2019/4/28.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const gnode_format_util = require('../libs/gnode_format_util');
// const config = require('../config').config;
// const user_redis = require('..//config').user_redis;
// // const user_m = require('../model/user_m');

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
window.product_c = {}
/**
 * 发布产品
 * @type {newProduct}
 */
window.product_c.newProduct =newProduct;
async function newProduct(req,res) {
    let {user_id,s_id,shop_id,product_name,product_desc,product_ad,product_price,product_image,product_vip_rate} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!product_name) return res.json({ret:false,msg:"product_name error"})
    if(!product_ad) return res.json({ret:false,msg:"product_ad error"})
    if(!product_desc) return res.json({ret:false,msg:"product_desc error"})
    if(!product_price || product_price!=product_price*1) return res.json({ret:false,msg:"product_price error"})
    if(!product_image) return res.json({ret:false,msg:"product_image error"})
    if(product_vip_rate!=product_vip_rate-0 || parseInt(product_vip_rate)!=product_vip_rate-0 || product_vip_rate>10 || product_vip_rate<0)
        return res.json({ret:false,msg:"product_vip_rate error"})

    let shopInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,shop_id,'assert')
    if(!shopInfo) return res.json({ret:false,msg:"shop-info is empty"})
    //&& !manager_c.isManagerUid(user_id)
    if(shopInfo.user_id!=user_id ) return res.json({ret:false,msg:"no pm: new product failed"})

    let obj = {user_id,shop_id,product_name,product_desc,product_ad,product_price,product_image,product_vip_rate,save_time:parseInt(new Date().getTime()/1000)}

    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'pd'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork product-id failed"});

    //保存obj-id，方便查询。
    obj.product_id = forkObjRet.token_x

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert product-new-obj-info failed"});

    //hold user-hold product-obj-id
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:shop_id,token_y:obj.product_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold product-obj-info failed"});

    return res.json({ret:true,msg:'success'})
}

/**
 * 查询产品的信息
 * @type {queryproductInfo}
 */
window.product_c.queryProductInfo =queryProductInfo;
async function queryProductInfo(req,res) {
    let {user_id, s_id, product_id,secret_key} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str ) return res.json({ret: false, msg: "session error"})

    if (!product_id) return res.json({ret: false, msg: "product_id error"})

    // let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: product_id, opcode: 'assert', begin: 0, len: 1})
    // if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "product_id-info is empty"})
    // let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    let oldObj = await s_queryProductInfo(product_id)
    if(!oldObj) return res.json({ret: false, msg: "product info is empty"})

    oldObj.ret = true;
    oldObj.msg = 'success'
    res.json(oldObj)
}

/**
 * 内部的产品查询函数
 * @type {s_queryProductInfo}
 */
window.product_c.s_queryProductInfo =s_queryProductInfo;
async function s_queryProductInfo(product_id) {
    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: product_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return null
    return  JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
}

/**
 * 删除产品
 * @type {deleteProduct}
 */
window.product_c.deleteProduct =deleteProduct;
async function deleteProduct(req,res) {
    let {user_id, s_id, product_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if (!product_id) return res.json({ret: false, msg: "product_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: product_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "product_id-info is empty"})
    let productInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:productInfo.shop_id,token_y:productInfo.product_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(productInfo)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete product from list failed"});

    res.json({ret:true,msg:'success'})
}
/**
 * 更新产品信息（product_id）
 * @type {updateproductInfo}
 */
window.product_c.updateProductInfo =updateProductInfo;
async function updateProductInfo(req,res) {
    let {user_id,s_id,product_id,product_name,product_desc,product_ad,product_price,product_image,product_vip_rate} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!product_id) return res.json({ret:false,msg:"product_id error"})
    if(!product_name) return res.json({ret:false,msg:"product_name error"})
    if(!product_ad) return res.json({ret:false,msg:"product_ad error"})
    if(!product_desc) return res.json({ret:false,msg:"product_desc error"})
    if(!product_price || product_price!=product_price*1) return res.json({ret:false,msg:"product_price error"})
    if(!product_image) return res.json({ret:false,msg:"product_image error"})
    if(product_vip_rate!=product_vip_rate-0 || parseInt(product_vip_rate)!=product_vip_rate-0 || product_vip_rate>10 || product_vip_rate<0)
        return res.json({ret:false,msg:"product_vip_rate error"})

    let obj = {product_name,product_desc,product_ad,product_price,product_image,product_vip_rate,save_time:parseInt(new Date().getTime()/1000)}

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:product_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(oldObj.user_id!=user_id ) return res.json({ret:false,msg:"no pm: update productinfo"})

    let newObj = {}
    newObj = Object.assign(newObj,oldObj,obj)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:product_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert product-update-obj-info failed"});


    return res.json({ret:true,msg:'success'})
}


/**
 * 查询我的产品
 * @type {queryUserproductOrders}
 */
window.product_c.queryAllProducts =queryAllProducts;
async function queryAllProducts(req, res) {
    let {user_id, s_id, shop_id,random, sign, begin, len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

   // let allHoldRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1],isx:true,opcode:'hold',begin:begin*len,len:len})
    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,shop_id,'hold',begin*len,len);

    res.json({ret:true,msg:'success',list:list})
}
