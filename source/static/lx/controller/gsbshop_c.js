// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const gnode_format_util = require('../libs/gnode_format_util');
// const notice_util = require('../libs/notice_util');
// const user_c = require('./user_c');
// const manager_c = require('./manager_c');

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


window.gsbshop_c = {}
/**
 * 发布商品
 * @type {newGoods}
 */
window.gsbshop_c.newGoods =newGoods;
async function newGoods(req,res) {
    let {user_id,s_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!goods_kind) return res.json({ret:false,msg:"goods_kind error"})
    if(!goods_name) return res.json({ret:false,msg:"goods_name error"})
    if(!goods_desc) return res.json({ret:false,msg:"goods_desc error"})
    if(!goods_price || goods_price!=goods_price*1) return res.json({ret:false,msg:"goods_price error"})
    if(!goods_image) return res.json({ret:false,msg:"goods_image error"})

    let obj = {user_id,goods_kind,goods_name,goods_desc,goods_price,goods_image,save_time:parseInt(new Date().getTime()/1000),tips:'审核中'}


    //查询用户资料，看是否已经有gsb_goods_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.gsb_goods_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'gsbgoods'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork user-goods-id failed"});
        userInfo.gsb_goods_id = forkRet.token_x
        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})

        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo gsbgoods-id failed"});
    }
    obj.gsb_goods_id = userInfo.gsb_goods_id

    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'gsbgoodsID'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork goods-new-obj-id failed"});

    //保存obj-id，方便查询。
    obj.obj_id = forkObjRet.token_x

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.gsb_goods_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert gsbgoods-new-obj-info failed"});

    //order
    //send user-goods-obj-id
    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.gsb_goods_id,
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send gsbgoods-obj-info failed"});

    //send all-user-goods-obj-id
    let sendAllRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_goodsall00000000',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send gsbgoods-obj-info to goodsall failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'您在积分商城，发布了金额为'+goods_price+'元的积分商城，请等待审核！',extra_data:JSON.stringify(obj)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 查询积分商品的信息
 * @type {queryGoodsInfo}
 */
window.gsbshop_c.queryGoodsInfo =queryGoodsInfo;
async function queryGoodsInfo(req,res) {
    let {user_id, s_id, obj_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    if (!obj_id) return res.json({ret: false, msg: "obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: obj_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    oldObj.ret = true;
    oldObj.msg = 'success'
    res.json(oldObj)
}
/**
 * 更新商品信息（由obj_id）
 * @type {updateGoodsInfo}
 */
window.gsbshop_c.updateGoodsInfo =updateGoodsInfo;
async function updateGoodsInfo(req,res) {
    let {user_id,s_id,obj_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(!goods_kind) return res.json({ret:false,msg:"goods_kind error"})
    if(!goods_name) return res.json({ret:false,msg:"goods_name error"})
    if(!goods_desc) return res.json({ret:false,msg:"goods_desc error"})
    if(!goods_price || goods_price!=goods_price*1) return res.json({ret:false,msg:"goods_price error"})
    if(!goods_image) return res.json({ret:false,msg:"goods_image error"})

    let obj = {obj_id,user_id,goods_kind,goods_name,goods_desc,goods_price,goods_image,send_time:parseInt(new Date().getTime()/1000)}

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    if(oldObj.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update goodsinfo no pm"})

    let newObj = {}
    newObj = Object.assign(newObj,oldObj,obj)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert gsbgoods-update-obj-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'【积分商城】您在积分商城，修改了积分商品信息！商品名称：'+goods_name+" 商品ID:"+obj_id,extra_data:JSON.stringify(obj)})

    return res.json({ret:true,msg:'success'})
}

/**
 * 购买积分商品
 * @type {buyGoods}
 */
window.gsbshop_c.buyGoods =buyGoods;
async function buyGoods(req, res) {
    let {user_id, s_id, obj_id,goods_num,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('good')<0) return res.json({ret:false,msg:"obj_id error"})
    if(!goods_num || goods_num!=goods_num*1) return res.json({ret:false,msg:"goods_num error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    //创建一个obj-id（关于用户的购买记录？）
    if(obj.user_id==user_id) return res.json({ret:false,msg:"can not buy youself goods"})

    //查询用户资料，gsb_goods_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.gsb_goods_buyed_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'gsbgoodsOBJ'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork user-goods-id failed"});
        userInfo.gsb_goods_buyed_id = forkRet.token_x

        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo gsbgoods-buyed-id failed"});
    }
    // obj.gsb_goods_buyed_id = userInfo.gsb_goods_buyed_id

    //将购买的商品放到user-obj-id中。
    obj.buyed_num = obj.buyed_num?obj.buyed_num:0;
    obj.buyed_num += goods_num
    obj.order_num = obj.order_num?obj.order_num:0;
    obj.order_num +=1

    //扣用户的GSB费用。
    let payGSBNum = obj.goods_price* goods_num ;

    let userAccountRet = await rpc_query(GSB_API_BASE+"/chain/opcode",{token:GSB_TOKEN_NAME+"_"+user_id.split('_')[1],
                            opcode:'send',begin:0,len:1})
    let userWalletGSB =  userAccountRet && userAccountRet.ret ?JSON.parse(userAccountRet.list[0].txjson).token_state :0;
    if(payGSBNum > userWalletGSB) return res.json({ret:false,msg:"user have not enough gsb to pay order"})

    let payRet = await rpc_query(GSB_API_BASE+'/send',{token_x:GSB_TOKEN_NAME+"_"+user_id.split('_')[1],
            token_y:GSB_TOKEN_NAME+'_'+obj.user_id.split('_')[1], opval:payGSBNum,extra_data:JSON.stringify(obj)})
    if(!payRet || !payRet.ret) return res.json({ret: false, msg: "pay GSB to gsbgoods-buy failed"});

    //更新了用户的购买列表
    let buyOrder = {buy_user_id:user_id,buy_obj_id:obj_id,goods_num,buy_time:parseInt(new Date().getTime()/1000),pay_gsb:payGSBNum}
    buyOrder = Object.assign(buyOrder,obj)
    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.gsb_goods_buyed_id,
        opval:JSON.stringify(buyOrder),extra_data:obj_id})
    if(!sendRet || !sendRet.ret)
    {
        //退款
        rpc_query(GSB_API_BASE+'/send',{token_x:GSB_TOKEN_NAME+'_'+obj.user_id.split('_')[1],
            token_y: GSB_TOKEN_NAME+"_"+user_id.split('_')[1], opval:payGSBNum,extra_data:JSON.stringify(obj)})
        return res.json({ret: false, msg: "send to user-buyed-list failed"});
    }

    //更新商品订单数量和购买数量信息。
    rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert', opval:JSON.stringify(obj),extra_data: obj.user_id })

    //该商品的被购买纪录（用户可查阅）。
    rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opval:JSON.stringify(buyOrder),extra_data: user_id})

    //放到所有的GSB订单记录之下（obj_goodsallBUY00000）---方便管理员查看购买纪录，以便发放奖励等
    rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_goodsallBUY00000',
            opval:JSON.stringify(buyOrder),extra_data: user_id})

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:'【审核通过】恭喜您，您在积分商城，购买名为【'+obj.goods_name+'】的积分商品，已付款成功！',extra_data:JSON.stringify(obj)})

    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+obj.user_id.split('_')[1],
        opval:'【审核通过】恭喜您，您在积分商城，被其他用户购买了名为【'+obj.goods_name+'】的积分商品，对方已付款成功！金额：'+payGSBNum+" GSB！",
        extra_data:JSON.stringify(obj)})

    res.json({ret:true,msg:'success'})
}



/**
 * 审核通过
 * @type {sendOk}
 */
window.gsbshop_c.sendOk =sendOk;
async function sendOk(req, res) {
    let {user_id, s_id, obj_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('good')<0) return res.json({ret:false,msg:"obj_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '审核通过'
    obj.goods_status='ok'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //更新到商品表中。
    let allAssertRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_goodsall00000000',opcode:'assert',begin:0,len:1})
    let objList = []
    if(allAssertRet && allAssertRet.ret) {
        objList = JSON.parse(JSON.parse(allAssertRet.list[0].txjson).opval)
    }
    let i = 0,flag = false;
    for(;i<objList.length;i++)
    {
        if(objList[i].obj_id == obj_id){
            flag = true;
            Object.assign(objList[i],obj)//赋值
        }
    }
    if(!flag) objList.push(obj)
    let assertUpdateAllRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_goodsall00000000',opcode:'assert',
        opval:JSON.stringify(objList),extra_data:obj_id })
    if(!assertUpdateAllRet || !assertUpdateAllRet.ret) return res.json({ret: false, msg: "add obj-list obj-info failed"});

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+obj.user_id.split('_')[1],
        opval:'【审核通过】恭喜您，您在积分商城，发布了金额为'+obj.goods_price+'GSB的商品，已经【审核通过】！',extra_data:obj.user_id})

    res.json({ret:true,msg:'success'})
}

/**
 * 审核不通过
 * @type {sendDeny}
 */
window.gsbshop_c.sendDeny =sendDeny;
async function sendDeny(req, res) {
    let {user_id, s_id, obj_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('good')<0) return res.json({ret:false,msg:"obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '【审核拒绝】该积分商品发布！备注：'+msg
    obj.goods_status='deny'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});


    //更新到商品表中。
    let allAssertRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_goodsall00000000',opcode:'assert',begin:0,len:1})
    let objList = []
    if(allAssertRet && allAssertRet.ret) {
        objList = JSON.parse(JSON.parse(allAssertRet.list[0].txjson).opval)
    }
    let i = 0,flag = false, newObjList=[];
    for(;i<objList.length;i++)
    {
        if(objList[i].obj_id == obj_id){
            flag = true;
        }else{
            newObjList.push(objList[i])
        }
    }
    if(flag) {
        let assertUpdateAllRet = await rpc_query(OBJ_API_BASE + '/op', {token_x: OBJ_TOKEN_ROOT, token_y: OBJ_TOKEN_NAME + '_goodsall00000000',
            opcode: 'assert', opval: JSON.stringify(newObjList), extra_data: obj_id})
        if (!assertUpdateAllRet || !assertUpdateAllRet.ret) return res.json({ret: false, msg: "del from obj-list obj-info failed"});
    }

    //发送一条系统消息
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+'_'+obj.user_id.split('_')[1],
        opval:'【审核拒绝】该商品发布！您在积分商城，发布名称为【'+obj.goods_name+'】的商品，已经被【审核拒绝】！备注信息：'+msg,extra_data:obj.user_id})

    res.json({ret:true,msg:'success'})
}



/**
 * 查询所有的通过审核的商品
 * @type {queryUserGSBGoodsOrders}
 */
window.gsbshop_c.queryAllGSBGoods =queryAllGSBGoods;
async function queryAllGSBGoods(req, res) {
    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let allAssertRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_goodsall00000000',opcode:'assert',begin:0,len:1})
    if(!allAssertRet || !allAssertRet.ret)  return res.json({ret: false, msg: "goods-list is empty"})
    let objList = JSON.parse(JSON.parse(allAssertRet.list[0].txjson).opval)

    let i=0, queryObjInfoP = []
    for(;i<objList.length;i++)
    {
        // objList[i].txjson = JSON.parse(objList[i].txjson)
        objList[i].info = objList[i]

        //let {user_id,s_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)
        objList[i].obj_id = objList[i].info.obj_id
        //放到数组中，等待处理。
        queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:objList[i].obj_id,opcode:'assert',begin:0,len:1}))

        objList[i].goods_kind = objList[i].info.goods_kind
        objList[i].goods_name = objList[i].info.goods_name
        objList[i].goods_desc = objList[i].info.goods_desc
        objList[i].save_time = str_filter.GetDateTimeFormat(objList[i].info.save_time)
        objList[i].goods_price = objList[i].info.goods_price
        objList[i].goods_image = objList[i].info.goods_image
        objList[i].tips = objList[i].info.tips

        delete objList[i].txjson
        delete objList[i].info
    }

    //处理全部请求（这里允许修改订单价格等）---所以重新查询一下（其实暂时没必要，重新发就可以了---但是重新发会影响obj-id，导致用户权益受损）。
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<objList.length;i++)
        {
            if(rets[i] && rets[i].ret) {
                Object.assign(objList[i],JSON.parse(JSON.parse(rets[i].list[0].txjson).opval))
            }else{
                objList[i].tips = '审核通过!'
            }
        }
    })

    //数组排序。
    objList.sort(function(a,b){
        return  a.send_time - b.send_time;
    })

    res.json({ret:true,msg:'success',list:objList})
}

/**
 * 查询用户的商品
 * @type {queryUserGSBGoodsOrders}
 */
window.gsbshop_c.queryUserGSBGoodsOrders =queryUserGSBGoodsOrders;
async function queryUserGSBGoodsOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    //查询用户资料，gsb_goods_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.gsb_goods_id)
    {
        return res.json({ret: false, msg: "user-gsbgoods-order-id is empty"});
    }

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.gsb_goods_id,opcode:'send',begin:begin*len,len:len})

    let queryObjInfoP = []

    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].goods_kind = listRet.list[i].info.goods_kind
            listRet.list[i].goods_name = listRet.list[i].info.goods_name
            listRet.list[i].goods_desc = listRet.list[i].info.goods_desc
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].goods_price = listRet.list[i].info.goods_price
            listRet.list[i].goods_image = listRet.list[i].info.goods_image
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                }else{
                    listRet.list[i].tips = '审核中！'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-gsbgoods-list is empty'})
    }
}


/**
 * 查询用户的购买订单纪录（重要）
 * @type {queryUserGSBGoodsBuyedObjs}
 */
window.gsbshop_c.queryUserGSBGoodsBuyedObjs =queryUserGSBGoodsBuyedObjs;
async function queryUserGSBGoodsBuyedObjs(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    //查询用户资料，gsb_goods_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    if(!userInfo.gsb_goods_buyed_id)
    {
        return res.json({ret: false, msg: "query gsbgoods-buyed-id failed"});
    }

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.gsb_goods_buyed_id,opcode:'send',begin:begin*len,len:len})


    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            listRet.list[i].goods_kind = listRet.list[i].info.goods_kind
            listRet.list[i].goods_name = listRet.list[i].info.goods_name
            listRet.list[i].goods_desc = listRet.list[i].info.goods_desc
            listRet.list[i].buy_time = str_filter.GetDateTimeFormat(listRet.list[i].info.buy_time)
            listRet.list[i].goods_price = listRet.list[i].info.goods_price
            listRet.list[i].goods_image = listRet.list[i].info.goods_image
            listRet.list[i].tips = listRet.list[i].info.tips

            listRet.list[i].pay_gsb = listRet.list[i].info.pay_gsb
            listRet.list[i].goods_num = listRet.list[i].info.goods_num

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-buyed-gsbgoods-list is empty'})
    }
}

/**
 * 查询所有的用户的购买订单纪录（重要）
 * @type {queryAllUserBuyedObjs}
 */
window.gsbshop_c.queryAllUserBuyedObjs =queryAllUserBuyedObjs;
async function queryAllUserBuyedObjs(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})
    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_goodsallBUY00000',opcode:'send',begin:begin*len,len:len})

    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            listRet.list[i].buy_user_id = listRet.list[i].info.buy_user_id
            listRet.list[i].goods_kind = listRet.list[i].info.goods_kind
            listRet.list[i].goods_name = listRet.list[i].info.goods_name
            listRet.list[i].goods_desc = listRet.list[i].info.goods_desc
            listRet.list[i].buy_time = str_filter.GetDateTimeFormat(listRet.list[i].info.buy_time)
            listRet.list[i].goods_price = listRet.list[i].info.goods_price
            listRet.list[i].goods_image = listRet.list[i].info.goods_image
            listRet.list[i].tips = listRet.list[i].info.tips

            listRet.list[i].pay_gsb = listRet.list[i].info.pay_gsb
            listRet.list[i].goods_num = listRet.list[i].info.goods_num

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-buyed-gsbgoods-list is empty'})
    }
}


/**
 * 用户的积分商品列表（我的发布）
 * @type {queryUserRoleOrders}
 */
window.gsbshop_c.queryAllUserGoods =queryAllUserGoods;
async function queryAllUserGoods(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_goodsall00000000',opcode:'send',begin:begin*len,len:len})
    let queryObjInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,goods_kind,goods_name,goods_desc,goods_price,goods_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].goods_kind = listRet.list[i].info.goods_kind
            listRet.list[i].goods_name = listRet.list[i].info.goods_name
            listRet.list[i].goods_desc = listRet.list[i].info.goods_desc
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].goods_price = listRet.list[i].info.goods_price
            listRet.list[i].goods_image = listRet.list[i].info.goods_image
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                }else{
                    listRet.list[i].tips = '待审核'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-fapiao-list is empty'})
    }
}
