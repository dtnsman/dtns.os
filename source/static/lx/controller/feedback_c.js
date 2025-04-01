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
window.feedback_c = {}
/**
 * 新反馈
 * @type {newFeedback}
 */
window.feedback_c.newFeedback =newFeedback;
async function newFeedback(req,res) {
    let {user_id, s_id, shop_id,title, content,phone,label,random,sign} = str_filter.get_req_data(req);

    if(!title) return res.json({ret:false,msg:"title error"})
    if(!content) return res.json({ret:false,msg:"content error"})
    // if(!Feedback_img) return res.json({ret:false,msg:"Feedback_img error"})
    if(!label) return res.json({ret:false,msg:"label error"})
    if(phone != phone-0 || (''+phone).length!=11) return res.json({ret:false,msg:"phone error"})

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
    //
    // let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    // if(!shopInfoRet || !shopInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    // let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)
    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {feedback_list_id} = shopInfo

    // if( shopInfo.user_id != user_id) return res.json({ret:false,msg:"user no pm"})

    //创建一个obj对象
    let forkRet = await rpc_query(OBJ_API_BASE + '/fork', {token: OBJ_TOKEN_ROOT,space:'feedback'})
    if(!forkRet || !forkRet.ret) return {ret:false,msg:'fork Feedback-token failed'}

    let feedbackInfo = {feedback_id:forkRet.token_x, title,content,label,shop_id,user_id,phone,save_time: parseInt(new Date().getTime()/1000)}

    //后续在config中保存着classify-product（也就是分类里面的产品）
    let assertRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT,token_y: forkRet.token_x, opcode:'assert',
        opval:JSON.stringify(feedbackInfo),extra_data:shop_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save Feedback-info failed'}

    let saveRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: feedback_list_id,token_y: feedbackInfo.feedback_id, opcode:'hold',
        opval:'add',extra_data:JSON.stringify(feedbackInfo)})

    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save Feedback-info to list failed'}


    let userMsgId = await shopping_c.s_queryUserMSGToken(feedbackInfo.user_id)
    let shopUserMsgId = await shopping_c.s_queryUserMSGToken(shopInfo.user_id)

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'您成功反馈了问题（内容：'
            +content+'），请耐心等待处理!',extra_data:JSON.stringify(feedbackInfo)})

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:shopUserMsgId,opval:'您的商铺（'+shopInfo.shop_name
            +'）因用户遇到问题，收到新的用户反馈（反馈ID:'+feedbackInfo.feedback_id+'，内容：'+content+'）！',extra_data:JSON.stringify(feedbackInfo)})

    res.json({ret:true,msg:'success'})
}



/**
 * 得到Feedback-list-ids
 * @type {s_queryShopFeedbackListIDS}
 */
window.feedback_c.s_queryShopFeedbackListIDS =s_queryShopFeedbackListIDS;
async function s_queryShopFeedbackListIDS(shop_id) {
    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!shopInfoRet || !shopInfoRet.ret) return null
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    let update_flag = false;
    if(!shopInfo.feedback_list_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE + '/fork', {token: OBJ_TOKEN_ROOT,space:'feedbacklist'})
        if(!forkRet || !forkRet.ret) return null;

        shopInfo.feedback_list_id = forkRet.token_x;
        update_flag = true;
    }

    if(update_flag)
    {
        let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:shop_id,opcode:'assert',
            opval:JSON.stringify(shopInfo),extra_data: shop_id})
        if(!assertOBJRet || !assertOBJRet.ret) return null;
    }

    return shopInfo;
}


/**
 * 删除反馈
 * @type {del_product}
 */
window.feedback_c.delFeedback =delFeedback;
async function delFeedback(req,res) {
    let {user_id, s_id,shop_id,feedback_id,random, sign} = str_filter.get_req_data(req)

    if (!feedback_id) return res.json({ret: false, msg: "feedback_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {feedback_list_id} = shopInfo

    if( shopInfo.user_id != user_id) return res.json({ret:false,msg:"user no pm"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:feedback_list_id,token_y:feedback_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'del Feedback-info from list failed!'})

    return res.json({ret:true,msg:'success'})
}


/**
 * 处理反馈
 * @type {del_product}
 */
window.feedback_c.dealFeedback =dealFeedback;
async function dealFeedback(req,res) {
    let {user_id, s_id,shop_id,feedback_id,msg,random, sign} = str_filter.get_req_data(req)

    if (!feedback_id) return res.json({ret: false, msg: "feedback_id error"})
    if (!msg) return res.json({ret: false, msg: "msg error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {feedback_list_id} = shopInfo

    if( shopInfo.user_id != user_id) return res.json({ret:false,msg:"user no pm"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:feedback_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let feedbackInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    feedbackInfo.deal_status = 1;
    feedbackInfo.deal_time =  parseInt(new Date().getTime()/1000)
    feedbackInfo.deal_user_id = user_id;
    feedbackInfo.deal_msg = msg;

    let assertRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT,token_y: feedback_id, opcode:'assert',
        opval:JSON.stringify(feedbackInfo),extra_data:shop_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save Feedback-info failed'}


    let userMsgId = await shopping_c.s_queryUserMSGToken(feedbackInfo.user_id)
    let shopUserMsgId = await shopping_c.s_queryUserMSGToken(shopInfo.user_id)

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'您反馈的问题收到了处理结果（内容：'
            +msg+'）!',extra_data:JSON.stringify(feedbackInfo)})

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:shopUserMsgId,opval:'【反馈处理】成功处理用户反馈（反馈ID:'+
            feedbackInfo.feedback_id+'，处理结果：'+msg+'）,！',extra_data:JSON.stringify(feedbackInfo)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 查看反馈。
 * @type {queryInfo}
 */
window.feedback_c.queryInfo =queryInfo;
async function queryInfo(req,res) {
    let {user_id, s_id,shop_id,feedback_id,msg,random, sign} = str_filter.get_req_data(req)

    if (!feedback_id) return res.json({ret: false, msg: "feedback_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    // let {feedback_list_id} = shopInfo

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:feedback_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let feedbackInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if( shopInfo.user_id != user_id && feedbackInfo.user_id!=user_id) return res.json({ret:false,msg:"user no pm"})
    //
    // feedbackInfo.deal_status = 1;
    // feedbackInfo.deal_time =  parseInt(new Date().getTime()/1000)
    // feedbackInfo.deal_user_id = user_id;
    // feedbackInfo.deal_msg = msg;
    //
    // let assertRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT,token_y: feedback_id, opcode:'assert',
    //     opval:JSON.stringify(feedbackInfo),extra_data:shop_id })
    // if(!assertRet || !assertRet.ret) return {ret:false,msg:'save Feedback-info failed'}
    feedbackInfo.ret =true;
    feedbackInfo.msg = 'success'

    return res.json(feedbackInfo)
}


/**
 * 查询所有反馈
 * @type {queryFeedbackList}
 */
window.feedback_c.queryFeedbackList =queryFeedbackList;
async function queryFeedbackList(req,res) {
    let {user_id, s_id, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {feedback_list_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:feedback_list_id,
        opcode:'hold',isx:true,begin:begin*len,len})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = []
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
                :JSON.parse(rets[i].list[0].txjson).timestamp_i);
            newObjs.push(newInfo)
        }
    })

    if(newObjs&&newObjs.length>0)
    {
        return res.json({ret:true,msg:'success',list:newObjs})
    }

    return  res.json({ret:false,msg:'Feedback list is empty'});
}


/**
 * 查找反馈（由关键词（可以是地址，也可以是其他的））
 * @type {search}
 */
window.feedback_c.searchFeedbackList =searchFeedbackList;
async function searchFeedbackList(req,res) {
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

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {Feedback_list_id,Feedback_toplist_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:Feedback_list_id, opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

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
            newInfo.save_time = str_filter.GetDateTimeFormat(newInfo.save_time ? newInfo.save_time
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

    return  res.json({ret:false,msg:'Feedback list is empty'});
}

/**
 * 查找未处理的反馈
 * @type {queryUndealList}
 */
window.feedback_c.queryUndealList =queryUndealList;
async function queryUndealList(req,res) {
    let {user_id, s_id, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {feedback_list_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:feedback_list_id,
        opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

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

    return  res.json({ret:false,msg:'Feedback list is empty'});
}


/**
 * 查找已经处理的反馈
 * @type {queryDealList}
 */
window.feedback_c.queryDealList =queryDealList;
async function queryDealList(req,res) {
    let {user_id, s_id, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let shopInfo =await s_queryShopFeedbackListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {feedback_list_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:feedback_list_id,
        opcode:'hold',isx:true,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryInfoP = []
    for(let i = 0;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        queryInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:info.token_y,opcode:'assert',begin:0,len:1}))

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

    return  res.json({ret:false,msg:'Feedback list is empty'});
}
