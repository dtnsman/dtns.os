// const str_filter = require('../libs/str_filter');
// const gnode_format_util = require('../libs/gnode_format_util');
// const notice_util = require('../libs/notice_util');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const user_m = require('../model/user_m');
// const order_c = require('./order_c');
// const shop_c = require('./shop_c');
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

// const http_req = require('../libs/http_request')
// const WXBizDataCrypt = require('../libs/WXBizDataCrypt')

window.user_weixin_c = {}
window.user_weixin_c.check =check;
async function check(req, res) {
    let {user_id,s_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let qRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    let userInfo = !qRet || !qRet.ret? null:JSON.parse(JSON.parse(qRet.list[0].txjson).opval)

    if(!userInfo || !userInfo.nickName)  return res.json({ret:false,msg:"userInfo"})

    return res.json({ret:true,msg:"session ok",user_info:userInfo})
}

window.user_weixin_c.login =login;
async function login(req, res) {
    let {shop_id,code} = str_filter.get_req_data(req)

    if(!shop_id) return res.json({ret:false,msg:'shop_id error'})
    if(!code) return res.json({ret:false,msg:'code error'})

    let shopInfo = await shop_c.s_queryShopInfo(shop_id)
    if(!shopInfo ) return res.json({ret:false,msg:'shopInfo is empty'})

    if(!shopInfo.weixin_appid || !shopInfo.weixin_key) return res.json({ret:false,msg:'shopInfo do not have weixin-keys'})

    //GET https://api.weixin.qq.com/sns/jscode2session?appid=APPID&secret=SECRET&js_code=JSCODE&grant_type=authorization_code
    let ret = await http_req.http_post("https://api.weixin.qq.com/sns/jscode2session",
        {appid:shopInfo.weixin_appid,secret:shopInfo.weixin_key,js_code:code,grant_type:'authorization_code'});

    console.log("weinxin-jscode2session-ret:"+JSON.stringify(ret))

    if( !ret.openid) return res.json({ret:false,msg:'weixin-login failed',errcode:ret.errcode});

    //保存微信的session_key（由openid来保存）
    user_redis.set(ll_config.redis_key+":weixin_session_key:"+ret.openid,ret.session_key)

    //查询绑定关系。
    let openid = ret.openid.replace('-').replace('_')
    let inner_openid =  USER_TOKEN_NAME+ '_openid'+ openid.substring(0,10);
    let qRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:inner_openid,opcode:'assert',begin:0,len:1})
    let list = !qRet || !qRet.ret? []:JSON.parse(JSON.parse(qRet.list[0].txjson).opval)
    let user_id = null,i=0
    for(;i<list.length;i++)
    {
        if(list[i].openid==ret.openid) user_id = list[i].user_id;
    }

    //未绑定，先行绑定。
    if(!user_id)
    {
        let forkRet = await rpc_query(USER_API_BASE+'/fork',{token:USER_TOKEN_ROOT,space:'weixin'});
        if(!forkRet || !forkRet.ret) return res.json({ret:false,msg:'new weixin-user failed'});

        user_id = forkRet.token_x
        ret.user_id = forkRet.token_x
        ret.shop_id = shop_id;

        list.push(ret)

        let assertRet0 = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:forkRet.token_x,
            opcode:'assert',opval:JSON.stringify(ret),extra_data:inner_openid});
        if(!assertRet0 || !assertRet0.ret) return res.json({ret:false,msg:'bind weixin-user failed-1'});

        await rpc_query(USER_API_BASE+'/fork',{token:USER_TOKEN_ROOT,dst_token:inner_openid});

        let assertRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:inner_openid,
            opcode:'assert',opval:JSON.stringify(list),extra_data:JSON.stringify(ret)});
        if(!assertRet || !assertRet.ret) return res.json({ret:false,msg:'bind weixin-user failed-2'});

        let shopUser = USER_TOKEN_NAME+'_'+shop_id.split('_')[1]
        await rpc_query(USER_API_BASE+'/fork',{token:USER_TOKEN_ROOT,dst_token:shopUser});

        let holdRet = await rpc_query(USER_API_BASE+'/op',{token_x:shopUser,token_y:user_id,opcode:'hold',opval:'add',extra_data:JSON.stringify(ret)});
        console.log("shop-user-id:"+shopUser+" hold-user-id:"+user_id+' ret:'+JSON.stringify(holdRet))
    }

    let qRet1 = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    let userInfo = qRet1 && qRet1.ret ? JSON.parse(JSON.parse(qRet1.list[0].txjson).opval) :null;

    //保存微信的session_key（由openid来保存）
    user_redis.set(ll_config.redis_key+":weixin_session_key:"+user_id,ret.session_key)

    let s_id = str_filter.randomBytes(16);
    user_redis.set(ll_config.redis_key+":session:"+user_id+"-"+s_id,s_id)
    await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'config',opval:s_id,extra_data:"session"});

    res.json({ret:true,msg:'success',code:!userInfo || !userInfo.nickName?10000:0,user_info:userInfo,user_id,s_id})
}

window.user_weixin_c.regist =regist;
async function regist(req, res) {
    let {shop_id,user_id,s_id,encryptedData,iv} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!shop_id) return res.json({ret:false,msg:'shop_id error'})
    if(!encryptedData) return res.json({ret:false,msg:'encryptedData error'})
    if(!iv) return res.json({ret:false,msg:'iv error'})

    let shopInfo = await shop_c.s_queryShopInfo(shop_id)
    if(!shopInfo ) return res.json({ret:false,msg:'shopInfo is empty'})

    if(!shopInfo.weixin_appid || !shopInfo.weixin_key) return res.json({ret:false,msg:'shopInfo do not have weixin-keys'})

    let session_key = await user_redis.get(ll_config.redis_key+":weixin_session_key:"+user_id);
    var pc = new WXBizDataCrypt(shopInfo.weixin_appid , session_key)
    var data = pc.decryptData(encryptedData , iv)
    console.log('regist-user-info:'+JSON.stringify(data))
    let user_info = data;//JSON.parse(data);
    user_info.regist_time_i = parseInt(new Date().getTime()/1000)

    //将avatarUrl转换为本地图片（重要）。

    let assertRet0 = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,
        opcode:'assert',opval:JSON.stringify(user_info),extra_data:user_id});
    if(!assertRet0 || !assertRet0.ret) return res.json({ret:false,msg:'save weixin-user-info failed'});

    user_info.ret = true
    user_info.msg = 'success'

    return res.json(user_info);
}

/**
 * 查询用户资料
 * @type {regist}
 */
window.user_weixin_c.queryUserInfo =queryUserInfo;
async function queryUserInfo(req, res) {
    let {shop_id,user_id,s_id} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let qRet1 = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    let userInfo = qRet1 && qRet1.ret ? JSON.parse(JSON.parse(qRet1.list[0].txjson).opval) :{ret:false,msg:'user-info is empty'};

    if(userInfo.nickName)
    {
        userInfo.ret = true;
        userInfo.msg = 'success'
    }
    return res.json(userInfo)
}

/**
 * 绑定手机号码。
 * @type {bindPhone}
 */
window.user_weixin_c.bindPhone =bindPhone;
async function bindPhone(req, res) {
    let {phone,code,user_id,s_id} = str_filter.get_req_data(req)

    if(phone != phone-0 || (''+phone).length!=11) return res.json({ret:false,msg:"phone error"})
    if(!code) return res.json({ret:false,msg:"code error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    str = await user_redis.get(ll_config.redis_key+":sms_code:"+phone)
    if(str!=code) return  res.json({ret:false,msg:"code unmatch"})

    let qRet1 = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    let userInfo = qRet1 && qRet1.ret ? JSON.parse(JSON.parse(qRet1.list[0].txjson).opval) :null;
    if(!userInfo || !userInfo.nickName) return res.json({ret:false,msg:"userInfo is empty"})
    if(userInfo.phone) return res.json({ret:false,msg:"userInfo already have phone"})


    userInfo.user_id = user_id
    userInfo.phone = phone;

    let saveRet = await rpc_query(USER_API_BASE+'/op',{ token_x:USER_TOKEN_ROOT, token_y:user_id,opcode:'assert',
        opval:JSON.stringify(userInfo),extra_data:phone})
    if(!saveRet || !saveRet.ret)  return res.json({ret:false,msg:"save phone to userInfo failed"})

    let userPhoneID = USER_TOKEN_NAME+'_phone'+phone
    // let forkRet =
    await rpc_query(USER_API_BASE+'/fork',{token:USER_TOKEN_ROOT,dst_token: userPhoneID});
    // if(!forkRet || !forkRet.ret) return res.json({ret:false,msg:'new weixin-user failed'});
    //phone-user-id的映射关系。
    await rpc_query(USER_API_BASE+'/op',{token_x:userPhoneID,token_y: user_id,opcode:'relate',opval:'add',extra_data:JSON.stringify(userInfo)});

    userInfo.ret = true;
    userInfo.msg = 'success'

    return res.json(userInfo)
}



