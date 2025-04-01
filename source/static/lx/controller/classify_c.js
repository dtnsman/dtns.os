/**
 * Created by lauo.li on 2019/4/29.
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

// const rpc_api_util = require('../rpc_api_util') 
window.classify_c = {}
/**
 * 新建分类
 * @type {new_classify}
 */
window.classify_c.new_classify =new_classify;
async function new_classify(req,res) {
    let {user_id, s_id, shop_id, classify_name, random, sign} = str_filter.get_req_data(req);

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!classify_name) return res.json({ret:false,msg:"classify_name error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_classify:"+shop_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_classify:"+shop_id+random,random,120)

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'assert', begin: 0, len: 1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:'shop info unexists'})

    let retJson = await s_new_classify(shop_id,classify_name);
    res.json(retJson)
}
/**
 * 新建分类
 * shop_id商铺id，classifyName的名称，sortNum为序号（0为精选，1-100等）
 * @type {s_new_classify}
 */
window.classify_c.s_new_classify =s_new_classify;
async function s_new_classify(shop_id,classifyName)
{
    // let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'config', begin: 0, len: 1})// let classifyLists = !assertInfoRet || !assertInfoRet.ret ? [] : JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    let clist = await s_query_classify_list(shop_id,0,100000)

    var i= 0;
    for(;i<clist.length;i++)
    {
        if(clist[i].classify_name == classifyName)
            return {ret:false,msg:'classify name exists'}
    }

    //创建一个obj对象
    let forkRet = await rpc_query(OBJ_API_BASE + '/fork', {token: shop_id,space:'cls'})
    if(!forkRet || !forkRet.ret) return {ret:false,msg:'fork classify name token failed'}

    let classifyInfo = {shop_id,classify_name:classifyName,classify_id:forkRet.token_x,save_time: parseInt(new Date().getTime()/1000)}
    //后续在config中保存着classify-product（也就是分类里面的产品）
    let assertRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT,token_y: forkRet.token_x, opcode:'assert',
        opval:JSON.stringify(classifyInfo),extra_data:shop_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save classify-info failed'}

    let saveRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: shop_id,token_y: classifyInfo.classify_id, opcode:'relate',
        opval:'add',extra_data:JSON.stringify(classifyInfo)})

    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save classify-list failed'}

    return {ret:true,msg:'success',classify_id:forkRet.token_x  }
}

/**
 * 更新分类
 * @type {update_classify}
 */
window.classify_c.update_classify =update_classify;
async function update_classify(req,res) {
    let {user_id, s_id, shop_id, classify_id,classify_name, random, sign} = str_filter.get_req_data(req);

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!classify_id) return res.json({ret:false,msg:"classify_id error"})
    if(!classify_name) return res.json({ret:false,msg:"classify_name error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_classify:"+classify_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_classify:"+classify_id+random,random,120)

    let shopInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,shop_id,'assert')//rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'assert', begin: 0, len: 1})
    if(!shopInfo ) return res.json({ret:false,msg:'shop info unexists'})
    if(!shopInfo.user_id != user_id) return res.json({ret:false,msg:'no pm: not shop-creator'})
    let classifyInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,classify_id,'assert')
    if(!classifyInfo || classifyInfo.shop_id!=shop_id) return {ret:false,msg:'no pm: update classify-info failed'}

    let retJson = await s_update_classify(shop_id,classify_id,classify_name);
    res.json(retJson)
}
/**
 * 更新分类id
 * @type {s_update_classify}
 */
window.classify_c.s_update_classify =s_update_classify;
async function s_update_classify(shop_id,classify_id,classifyName)
{
    let classifyInfo =  await rpc_api_util.s_query_token_info(OBJ_API_BASE,classify_id,'assert')
    if(classifyInfo.shop_id!=shop_id) return {ret:false,msg:'no pm: update classify-info failed'}

    classifyInfo.classify_name = classifyName
    classifyInfo.save_time = parseInt(new Date().getTime()/1000)

    let assertRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT,token_y: classify_id, opcode:'assert',
        opval:JSON.stringify(classifyInfo),extra_data:shop_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'update classify-info failed'}

    return {ret:true,msg:'success'}
}

/**
 * 查询分类列表
 * @type {query_classify_list}
 */
window.classify_c.query_classify_list =query_classify_list;
async function query_classify_list(req,res) {
    let {user_id, s_id, shop_id, random, sign} = str_filter.get_req_data(req)

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str ) return res.json({ret:false,msg:"session error"})

    let clist = await s_query_classify_list(shop_id,0,100000)

    if(clist.length==0)
    {
        //如果分类为空，则创建一个精选的分类。
        saveRet = await s_new_classify(shop_id,'精选',1)
        if(saveRet && saveRet.ret && saveRet.classify_id)
            clist.push({shop_id,classify_name:'精选',classify_id:saveRet.classify_id,save_time: parseInt(new Date().getTime()/1000)})

    }

    res.json({ret:true,list:clist,count:clist.length})
}

/**
 * 查询列表。
 * @type {function(*=, *, *): Array}
 */
window.classify_c.s_query_classify_list =s_query_classify_list;
async function s_query_classify_list(shop_id) {

    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,shop_id,'relate',0,100000);//rpc_query(OBJ_API_BASE+'/chain/relations',{token:shop_id,opcode:'relate',isx:true,begin:0,len:10000})
  //  let list = !listRet ||!listRet.ret ? [] : listRet.list;
    list = list==null ? []:list;


    //排序
    list.sort(function(a,b){
        return a.save_time -  b.save_time;
    })

    return list;
}

/**
 * 删除分类
 * @type {delete_classify}
 */
window.classify_c.delete_classify =delete_classify;
async function delete_classify(req,res) {
    let {user_id, s_id, shop_id, classify_id, random, sign} = str_filter.get_req_data(req);

    if(!shop_id) return res.json({ret:false,msg:"shop_id error"})
    if(!classify_id) return res.json({ret:false,msg:"classify_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":delete_classify:"+classify_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":delete_classify:"+classify_id+random,random,120)

    let shopInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,shop_id,'assert')//rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'assert', begin: 0, len: 1})
    if(!shopInfo ) return res.json({ret:false,msg:'shop info unexists'})
    if(shopInfo.user_id != user_id) return res.json({ret:false,msg:'no pm: not shop-creator'})

    let classifyInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,classify_id,'assert')
    if(!classifyInfo || classifyInfo.shop_id!=shop_id) return {ret:false,msg:'no pm: update classify-info failed'}

    let retJson = await s_delete_classify(shop_id,classify_id);
    res.json(retJson)
}

/**
 * 删除分类id
 * @type {s_delete_classify}
 */
window.classify_c.s_delete_classify =s_delete_classify;
async function s_delete_classify(shop_id,classify_id)
{
    // let shopInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,shop_id,'assert')//rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'assert', begin: 0, len: 1})
    // if(!shopInfo ) return res.json({ret:false,msg:'shop info unexists'})
    // if(shopInfo.user_id != user_id) return res.json({ret:false,msg:'no pm: not shop-creator'})
    let classifyInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,classify_id,'assert')
    if(!classifyInfo || classifyInfo.shop_id!=shop_id) return {ret:false,msg:'no pm: update classify-info failed'}

    let delRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: shop_id,token_y: classify_id, opcode:'relate',
        opval:'del',extra_data:JSON.stringify(classifyInfo) })

    if(!delRet || !delRet.ret) return {ret:false,msg:'delete from classify-list failed'}

    return {ret:true,msg:'success'}
}

/**
 * 查询分类的资料
 * @type {query_classify_info}
 */
window.classify_c.query_classify_info =query_classify_info;
async function query_classify_info(req,res) {
    let {user_id, s_id, shop_id,classify_id, random, sign} = str_filter.get_req_data(req)

    if (!classify_id) return res.json({ret: false, msg: "classify_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})
    let classifyInfo = await s_query_classify_info(shop_id,classify_id)

    if(!classifyInfo) return res.json({ret:false,msg:'not in the classify-list'})

    classifyInfo.ret = true;
    classifyInfo.msg = 'success'
    res.json(classifyInfo)
}

/**
 * 内部查询的分类info
 * @type {function(*=, *): *}
 */
window.classify_c.s_query_classify_info =s_query_classify_info;
async function s_query_classify_info(shop_id,classify_id) {
    let classifyInfo =  await rpc_api_util.s_query_token_info(OBJ_API_BASE,classify_id,'assert')
    if(!classifyInfo || classifyInfo.shop_id!=shop_id) return null;//无权限
    return classifyInfo;
}

/**
 * 货架添加产品。
 * @type {add_product}
 */
window.classify_c.add_product =add_product;
async function add_product(req,res) {
    let {user_id, s_id, shop_id,product_id, classify_id, random, sign} = str_filter.get_req_data(req)

    if (!classify_id) return res.json({ret: false, msg: "classify_id error"})
    if (!product_id) return res.json({ret: false, msg: "product_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let classifyInfo = await s_query_classify_info(shop_id,classify_id)
    if(!classifyInfo) return res.json({ret:false,msg:'classify_id not in the shop-classify-list'})

    let shopInfo = await shop_c.s_queryShopInfo(shop_id)
    if(!shopInfo) return res.json({ret:false,msg:'shop_info is empty'})
    if(shopInfo.user_id != user_id)  return res.json({ret:false,msg:'not shop manager'})

    let productInfo = await product_c.s_queryProductInfo(product_id)
    if(!productInfo) return res.json({ret:false,msg:'productInfo is empty'})
    if(productInfo.shop_id != shop_id)  return res.json({ret:false,msg:'no pm:not shop product'})

    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:classify_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)})
    if(!holdRet|| !holdRet.ret) return res.json({ret:false,msg:'product-info add to classify failed!'})

    return res.json({ret:true,msg:'success'})
}

/**
 * 从货架上删除产品
 * @type {del_product}
 */
window.classify_c.del_product =del_product;
async function del_product(req,res) {
    let {user_id, s_id,product_id, classify_id, random, sign} = str_filter.get_req_data(req)

    if (!classify_id) return res.json({ret: false, msg: "classify_id error"})
    if (!product_id) return res.json({ret: false, msg: "product_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:classify_id,token_y:product_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'del product-info from classify failed!'})

    return res.json({ret:true,msg:'success'})
}

/**
 * 前置到最顶部
 * @type {del_product}
 */
window.classify_c.up_product =up_product;
async function up_product(req,res) {
    let {user_id, s_id,product_id, classify_id, random, sign} = str_filter.get_req_data(req)

    if (!classify_id) return res.json({ret: false, msg: "classify_id error"})
    if (!product_id) return res.json({ret: false, msg: "product_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:classify_id,token_y:product_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'up product-info failed! code:1'})

    let productInfo = await product_c.s_queryProductInfo(product_id)
    if(!productInfo) return res.json({ret:false,msg:'productInfo is empty'})

    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:classify_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)})

    holdRet = !holdRet|| !holdRet.ret ? await rpc_query(OBJ_API_BASE+'/op',{token_x:classify_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)}) : holdRet

    holdRet = !holdRet|| !holdRet.ret ? await rpc_query(OBJ_API_BASE+'/op',{token_x:classify_id,token_y:product_id,opcode:'hold',opval:'add',
        extra_data:JSON.stringify(productInfo)}) : holdRet

    if(!holdRet|| !holdRet.ret) return res.json({ret:false,msg:'up product-info failed! code:2'})

    return res.json({ret:true,msg:'success'})
}

/**
 * 得到货架的产品。
 * @type {shop_products}
 */

window.classify_c.query_products =query_products;
async function query_products(req,res) {
    let {user_id, s_id, classify_id, secret_key,begin,len,random, sign} = str_filter.get_req_data(req)

    if (!classify_id) return res.json({ret: false, msg: "classify_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let rlist =  await s_query_classify_products(classify_id,begin*len,len)
    res.json({ret:true,msg:'success',list:rlist})
}

/**
 * 查询列表。
 * @type {function(*=, *, *): Array}
 */
window.classify_c.s_query_classify_products =s_query_classify_products;
async function s_query_classify_products(classify_id,begin,len) {

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:classify_id,opcode:'hold',isx:true,begin:0,len:10000})
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

    let rlist = [],j=begin
    for(;j<newObjs.length && j<begin+len;j++)
    {
        newObjs[j].save_time = str_filter.GetDateTimeFormat(newObjs[j].save_time)
        rlist.push(newObjs[j])
    }

    return rlist;
}