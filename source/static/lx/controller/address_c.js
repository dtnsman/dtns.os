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
window.address_c = {}
/**
 * 新增一个地址
 * @type {addAddress}
 */
window.address_c.addAddress =addAddress;
async function addAddress(req,res) {
    let {user_id, s_id, user_name, phone, province,province_id,city,city_id,district,district_id,address_detail,address, mail_code,random,sign}
                = str_filter.get_req_data(req);

    if(!user_name)  return res.json({ret:false,msg:"user_name error"})
    if(!phone)  return res.json({ret:false,msg:"phone error"})
    if(!province)  return res.json({ret:false,msg:"province error"})
    if(!city)  return res.json({ret:false,msg:"city error"})
    if(!district)  return res.json({ret:false,msg:"district error"})
    if(!address_detail)  return res.json({ret:false,msg:"address_detail error"})
    if(!address)  return res.json({ret:false,msg:"address error"})
    if(!mail_code)  return res.json({ret:false,msg:"mail_code error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":add_address:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":add_address:"+user_id+random,random,120)

    let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'address'})
    if(!forkRet || !forkRet.ret) return res.json({ret:false,msg:'new address-id failed'})
    let address_id = forkRet.token_x

    let obj = {user_id,address_id, user_name, phone, province,province_id,city,city_id,district,district_id,address_detail,address, mail_code}
    let assertRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:address_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:user_id})
    if(!assertRet || !assertRet.ret) return res.json({ret:false,msg:'save address-info failed'})

    //使用户拿到address
    let relateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1],token_y:address_id,opcode:'relate',opval:'add',extra_data:JSON.stringify(obj)})
    if(!relateRet || !relateRet.ret){
        rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1]})
        return res.json({ret:false,msg:'add address to user-address-list failed'})
    }

    res.json({ret:true,msg:'success',address_id})
}

/**
 * 修改地址信息
 * @type {updateAddressInfo}
 */
window.address_c.updateAddressInfo =updateAddressInfo;
async function updateAddressInfo(req,res) {
    let {user_id, s_id, address_id,user_name, phone, province,province_id,city,city_id,district,district_id,address_detail,address, mail_code,random,sign}
        = str_filter.get_req_data(req);

    if(!address_id)  return res.json({ret:false,msg:"address_id error"})
    if(!user_name)  return res.json({ret:false,msg:"user_name error"})
    if(!phone)  return res.json({ret:false,msg:"phone error"})
    if(!province)  return res.json({ret:false,msg:"province error"})
    if(!city)  return res.json({ret:false,msg:"city error"})
    if(!district)  return res.json({ret:false,msg:"district error"})
    if(!address_detail)  return res.json({ret:false,msg:"address_detail error"})
    if(!address)  return res.json({ret:false,msg:"address error"})
    if(!mail_code)  return res.json({ret:false,msg:"mail_code error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":update_address:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":update_address:"+user_id+random,random,120)

    let obj = {user_id,address_id, user_name, phone, province,province_id,city,city_id,district,district_id,address_detail,address, mail_code}
    let assertRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:address_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:user_id})
    if(!assertRet || !assertRet.ret) return res.json({ret:false,msg:'update address-info failed'})

    res.json({ret:true,msg:'success'})
}

/**
 * 前置到最顶部
 * @type {up2List}
 */
window.address_c.up2List =up2List;
async function up2List(req,res) {
    let {user_id, s_id,address_id, random, sign} = str_filter.get_req_data(req)

    if (!address_id) return res.json({ret: false, msg: "address_id error"})
    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let objUserId = OBJ_TOKEN_NAME+'_'+user_id.split('_')[1];
    let delRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:objUserId,token_y:address_id,opcode:'relate',opval:'del'})
    if(!delRet|| !delRet.ret) return res.json({ret:false,msg:'up address-info failed! code:1'})

    let relateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:objUserId,token_y:address_id,opcode:'relate',opval:'add',
        extra_data:user_id})

    relateRet = !relateRet|| !relateRet.ret ? await rpc_query(OBJ_API_BASE+'/op',{token_x:objUserId,token_y:address_id,opcode:'relate',opval:'add',
        extra_data:user_id}) : relateRet

    relateRet = !relateRet|| !relateRet.ret ? await rpc_query(OBJ_API_BASE+'/op',{token_x:objUserId,token_y:address_id,opcode:'relate',opval:'add',
        extra_data:user_id}) : relateRet

    if(!relateRet|| !relateRet.ret) return res.json({ret:false,msg:'up address-info failed! code:2'})

    return res.json({ret:true,msg:'success'})
}

/**
 * 删除地址信息
 * @type {deleteAddressInfo}
 */
window.address_c.deleteAddressInfo =deleteAddressInfo;
async function deleteAddressInfo(req,res) {
    let {user_id, s_id, address_id,random, sign} = str_filter.get_req_data(req);

    if (!address_id) return res.json({ret: false, msg: "address_id error"})
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //从地址列表中删除
    let relateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1],token_y:address_id,opcode:'relate',opval:'del',extra_data:user_id})
    if(!relateRet || !relateRet.ret) return res.json({ret:false,msg:'del address to user-address-list failed'})

    res.json({ret:true,msg:'success'})
}


/**
 * 查询地址信息（用于修改地址）
 * @type {queryAddressInfo}
 */
window.address_c.queryAddressInfo =queryAddressInfo;
async function queryAddressInfo(req,res) {
    let {user_id, s_id, address_id,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:address_id,begin:0,len:1,opcode:'assert'});
    if(assertInfoRet && assertInfoRet.ret){
        let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        obj.ret = true;
        obj.msg='success'
        return res.json(obj)
    }
    res.json({ret:false,msg:'address info is empty'})
}


/**
 * 查询列表。
 * queryAddressList
 */
window.address_c.queryAddressList =queryAddressList;
async function queryAddressList(req,res) {
    let {user_id, s_id,begin,len,random,sign} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/relations',{token:OBJ_TOKEN_NAME+'_'+ user_id.split('_')[1],
        opcode:'relate',isx:true,begin,len})
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
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<objs.length;i++)
        {
            let newInfo = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
            newObjs.push(newInfo)
        }
    })

    if(newObjs && newObjs.length>0)
        return res.json({ret:true,msg:'success',list:newObjs});
    else
        res.json({ret:false,msg:'address-list is empty'})
}


