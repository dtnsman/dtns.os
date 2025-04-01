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
window.post_c = {}
/**
 * 新帖子
 * @type {newPost}
 */
window.post_c.newPost =newPost;
async function newPost(req,res) {
    let {user_id, s_id, shop_id,title, content,post_img,random,label,sign} = str_filter.get_req_data(req);

    if(!title) return res.json({ret:false,msg:"title error"})
    if(!content) return res.json({ret:false,msg:"content error"})
    if(!post_img) return res.json({ret:false,msg:"post_img error"})
    if(!label) return res.json({ret:false,msg:"label error"})

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
    let shopInfo =await s_queryShopPostListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {post_list_id,post_toplist_id} = shopInfo

    if( shopInfo.user_id != user_id) return res.json({ret:false,msg:"user no pm"})

    //创建一个obj对象
    let forkRet = await rpc_query(OBJ_API_BASE + '/fork', {token: OBJ_TOKEN_ROOT,space:'post'})
    if(!forkRet || !forkRet.ret) return {ret:false,msg:'fork post-token failed'}

    let postInfo = {post_id:forkRet.token_x, title,content,label,post_img,shop_id,user_id,save_time: parseInt(new Date().getTime()/1000)}

    //后续在config中保存着classify-product（也就是分类里面的产品）
    let assertRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT,token_y: forkRet.token_x, opcode:'assert',
        opval:JSON.stringify(postInfo),extra_data:shop_id })
    if(!assertRet || !assertRet.ret) return {ret:false,msg:'save post-info failed'}



    let saveRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: post_list_id,token_y: postInfo.post_id, opcode:'hold',
        opval:'add',extra_data:JSON.stringify(postInfo)})

    if(!saveRet || !saveRet.ret) return {ret:false,msg:'save post-info to list failed'}

    if(label=='置顶' || label=='top')
    {
        await rpc_query(OBJ_API_BASE + '/op', {token_x: post_toplist_id,token_y: postInfo.post_id, opcode:'hold',
            opval:'add',extra_data:JSON.stringify(postInfo)})
    }


    // let userMsgId = await shopping_c.s_queryUserMSGToken(user_id)
    let shopUserMsgId = await shopping_c.s_queryUserMSGToken(shopInfo.user_id)

    // await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:userMsgId,opval:'购买会员订单成功（金额'
    //         +orderInfo.total_money+'元）!',extra_data:JSON.stringify(orderInfo)})

    await rpc_query(RMB_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:shopUserMsgId,opval:'您的商铺（'+shopInfo.shop_name
            +'）发布新的文章成功（帖子ID:'+postInfo.post_id+'，标题：'+title+'）！',extra_data:JSON.stringify(postInfo)})

    res.json({ret:true,msg:'success'})
}
//queryPostInfo
/**
 * 查询文章的内容
 * @type {queryPostInfo}
 */
window.post_c.queryPostInfo =queryPostInfo;
async function queryPostInfo(req,res) {
    let {user_id, s_id, post_id,secret_key} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if (!post_id) return res.json({ret: false, msg: "post_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: post_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "post-info is empty"});
    let postInfo =  JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    postInfo.ret = true;
    postInfo.msg = 'success'
    res.json(postInfo)
}


/**
 * 得到post-list-ids
 * @type {s_queryShopPostListIDS}
 */
window.post_c.s_queryShopPostListIDS =s_queryShopPostListIDS;
async function s_queryShopPostListIDS(shop_id) {
    let shopInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:shop_id,opcode:'assert',begin:0,len:1})
    if(!shopInfoRet || !shopInfoRet.ret) return null
    let shopInfo = JSON.parse(JSON.parse(shopInfoRet.list[0].txjson).opval)

    let update_flag = false;
    if(!shopInfo.post_list_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE + '/fork', {token: OBJ_TOKEN_ROOT,space:'postlist'})
        if(!forkRet || !forkRet.ret) return null;

        shopInfo.post_list_id = forkRet.token_x;
        update_flag = true;
    }
    if(!shopInfo.post_toplist_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE + '/fork', {token: OBJ_TOKEN_ROOT,space:'postlist'})
        if(!forkRet || !forkRet.ret) return null;

        shopInfo.post_toplist_id = forkRet.token_x;
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
 * 删除文章
 * @type {del_product}
 */
window.post_c.delPost =delPost;
async function delPost(req,res) {
    let {user_id, s_id,shop_id,post_id,random, sign} = str_filter.get_req_data(req)

    if (!post_id) return res.json({ret: false, msg: "post_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let shopInfo =await s_queryShopPostListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {post_list_id,post_toplist_id} = shopInfo

    if( shopInfo.user_id != user_id) return res.json({ret:false,msg:"user no pm"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:post_list_id,token_y:post_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'del post-info from list failed!'})

    await rpc_query(OBJ_API_BASE+'/op',{token_x:post_toplist_id,token_y:post_id,opcode:'hold',opval:'del'})

    return res.json({ret:true,msg:'success'})
}


/**
 * 删除TOP文章
 * @type {delTopPost}
 */
window.post_c.delTopPost =delTopPost;
async function delTopPost(req,res) {
    let {user_id, s_id,post_id,shop_id,random, sign} = str_filter.get_req_data(req)

    if (!post_id) return res.json({ret: false, msg: "post_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let shopInfo =await s_queryShopPostListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {post_list_id,post_toplist_id} = shopInfo

    if( shopInfo.user_id != user_id) return res.json({ret:false,msg:"user no pm"})

    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:post_toplist_id,token_y:post_id,opcode:'hold',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'del post-info from toplist failed!'})

    return res.json({ret:true,msg:'success'})
}


/**
 * 查询所有文章
 * @type {queryPostList}
 */
window.post_c.queryPostList =queryPostList;
async function queryPostList(req,res) {
    let {user_id, s_id, secret_key,shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let shopInfo =await s_queryShopPostListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {post_list_id,post_toplist_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:post_list_id,
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

    return  res.json({ret:false,msg:'post list is empty'});
}


/**
 * 查找文章（由关键词（可以是地址，也可以是其他的））
 * @type {search}
 */
window.post_c.searchPostList =searchPostList;
async function searchPostList(req,res) {
    let {user_id, s_id,secret_key, search_key,shop_id, begin,len} = str_filter.get_req_data(req);

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

    let shopInfo =await s_queryShopPostListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {post_list_id,post_toplist_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:post_list_id, opcode:'hold',isx:true,begin:0,len:100000})
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

    return  res.json({ret:false,msg:'post list is empty'});
}

/**
 * 查找置顶帖子
 * @type {queryTopList}
 */
window.post_c.queryTopList =queryTopList;
async function queryTopList(req,res) {
    let {user_id, s_id,secret_key, shop_id, begin,len} = str_filter.get_req_data(req);

    if (!shop_id) return res.json({ret: false, msg: "shop_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str && !secret_key) return res.json({ret: false, msg: "session error"})

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1
    // len = begin*len;

    let shopInfo =await s_queryShopPostListIDS(shop_id);
    if(!shopInfo ) return res.json({ret:false,msg:"obj-assert-info is empty or failed"})
    let {post_list_id,post_toplist_id} = shopInfo

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:post_toplist_id,
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

    return  res.json({ret:false,msg:'post list is empty'});
}
