/**
 * Created by lauo.li on 2019/3/21.
 */
// const str_filter = require('../libs/str_filter');
// const gnode_format_util = require('../libs/gnode_format_util');
// const notice_util = require('../libs/notice_util');
// const huawei_notice_util = require('../libs/huawei_notice_util');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const user_m = require('../model/user_m');
// const order_c = require('./order_c');
// const shop_c = require('./shop_c');
// const cashout_c = require('./cashout_c');
// const rpc_query = require('../rpc_api_config').rpc_query
// const groupchat_c = require('./groupchat_c');
// const console_c = require('./console_c');//2020.06.19新增
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

//邀请机制的默认配置
const DEFAULT_INVITE_SETTING = {invite_type:3,score_reward:1,vip_reward:0,rmb_reward:0} 
window.user_c = {}
//获得邀请机制的配置信息
window.user_c.get_invite_setting =get_invite_setting;
async function get_invite_setting() {
    let setting = await rpc_api_util.s_query_token_info(USER_API_BASE,VIP_TOKEN_ROOT,'config')
    if(!setting) setting = DEFAULT_INVITE_SETTING;
    return setting;
}
/**
 * 得到邀请机制的配置信息
 */
window.user_c.query_invite_setting =query_invite_setting;
async function query_invite_setting(req, res) {
    let setting = await get_invite_setting()
    setting.ret = true;
    setting.msg = 'success'
    res.json(setting)
}
//以下bindDevice仅在DTNS连接下才可用（亦即ll-con-kmm账户下，roomid=dtns或者dtns-inner-room）
window.user_c.bindDevice = bindDevice
async function bindDevice(req,res)
{
    let {phoneHash,deviceName,sign,sign2,phoneEnInfo,public_key,web3name,invite_code} = str_filter.get_req_data(req)
    console.log(phoneHash,deviceName,sign,phoneEnInfo,public_key,web3name,invite_code)
    invite_code= deviceName && deviceName.indexOf('@')>0 ? deviceName.split('@')[1]:invite_code
    
    web3name = !web3name ? 'dtns':web3name
    //#0 先行验证
    let deviceHash = await key_util.hashVal(deviceName)// eccryptoJS.sha256(eccryptoJS.utf8ToBuffer(deviceName))
    console.log('deviceHash',deviceHash,deviceHash.length)
    let recoverKey = await key_util.recoverPublickey(sign,deviceHash)// await eccryptoJS.recover(deviceHash,key_util.bs58Decode(sign),true)
    // recoverKey = key_util.bs58Encode(recoverKey)
    let recoverKey2 = sign2 ? await key_util.recoverPublickey(sign2,deviceHash) : null//  await eccryptoJS.recover(deviceHash,key_util.bs58Decode(sign2),true):null
    // recoverKey2 =recoverKey2? key_util.bs58Encode(recoverKey2) :null
    console.log('recoverKey:',recoverKey,'recoverKey2:',recoverKey2,sign2,'len:'+recoverKey.length,public_key)
    //先判断是否是内部接口 fix the bug on 2023/3/23 18:37
    if(req.roomid.indexOf('dtns-inner-room') != 0){
        //仅针对dtns-user之ecc-keys签名的授权生成目标web3app之dtns-device-id
        //（其中--参数public_key是目标dtns-device-id的参数---用于生成新的dtns-device-id并且设备它的web3_key--生成逻辑在下面有）
        let {user_id,s_id} =  str_filter.get_req_data(req)
        let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
        if(!ustr) return res.json({ret:false,msg:'no pm to visit api-bindDevice'})
        let userInfoRet = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
        if(!userInfoRet) return res.json({ret:false,msg:'no pm to visit api-bindDevice(userInfo is empty)'})
        let dtns_user_id = userInfoRet.dtns_user_id
        let dtnsUserStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:dtns_user_id})
        if(!dtnsUserStates || !dtnsUserStates.ret) return res.json({ret:false,msg:'no pm to visit api-bindDevice(dtns-user token-states is empty)'})
        const dtns_user_public_key = dtnsUserStates.web3_key ? dtnsUserStates.web3_key  :dtnsUserStates.public_key
        //判断是否为dtns-user之ecc-keys的web3sign授权
        //（与pop-safe-sms的【短信授权】不同，这个直接是【dtns-user设备授权】）
        console.log('recoverKey、dtns_user_public_key：',recoverKey2,dtns_user_public_key)
        if(recoverKey2!=dtns_user_public_key) return res.json({ret:false,msg:'no pm to visit api-bindDevice(recover2-publicKey not equal to dtns-user-public_key)'})
        phoneHash = userInfoRet.phoneHash
        phoneEnInfo = userInfoRet.phoneEnInfo
    }
    //无论如何，recoverKey==public_key，确保device-ecc-keys是正确的参数
    if(recoverKey!=public_key)
    {
        return res.json({ret:false,msg:'recover-publicKey not equal to public_key'})
    }
    //#1.00 判断web3name是否存在
    if(web3name!='dtns')
    {
        let web3nameInfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
        console.log('web3nameInfoRet',web3nameInfoRet)
        if(!web3nameInfoRet ||!web3nameInfoRet.ret)
        {
            return res.json({ret:false,msg:'web3-app unexists!'})
        }
    }

    //#1.0 判断是否已经存在phone-user
    let bind_user_id = null
    let mapInfoRet = await rpc_query(USER_API_BASE+'/chain/map/value',
            {token:USER_TOKEN_ROOT,map_key:'phoneHash:'+phoneHash}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('mapInfoRet',mapInfoRet)
    let obj = null, dtns_user_id =null
    if(mapInfoRet && mapInfoRet.ret)
    {
        bind_user_id = mapInfoRet.map_value
        obj = await rpc_api_util.s_query_token_info(USER_API_BASE,bind_user_id,'assert')
        dtns_user_id = obj.dtns_user_id
        obj.regist_time = parseInt(new Date().getTime()/1000)//fix the bug on 2023/3/23 str_filter.GetDateTimeFormat(obj.regist_time)
        obj.deviceName = deviceName //fix the bug on 2023/3/23
        obj.user_name = deviceName //fix the bug on 2023/3/23（避免昵称ll-con-kmm泄露--也是重点之一）
    }
    else{
        //#1 fork-dtns-user-id
        let newDTNSAccountRet = await rpc_query(DTNS_API_BASE+"/fork",{token:DTNS_TOKEN_ROOT,opval:phoneHash,space:'dtns000',extra_data:"regist DTNS user"});
        if(!newDTNSAccountRet || !newDTNSAccountRet.ret) return res.json({ret: false, msg: "get new dtns-user-id failed"})
        dtns_user_id = newDTNSAccountRet.token_x

        let setWeb3KeyRet = await rpc_query(DTNS_API_BASE+"/op",
            {token_x:dtns_user_id,token_y:dtns_user_id,opval:public_key,opcode:dtns_config.fsm_config.OP_WEB3_KEY,extra_data:"set web3-key"});
        if(!setWeb3KeyRet || !setWeb3KeyRet.ret) return res.json({ret: false, msg: "set dtns-user-id web3-key failed"})
    
        //bind-user-id
        let newAccountRet = await rpc_query(USER_API_BASE+"/fork",{token:USER_TOKEN_ROOT,opval:phoneHash,extra_data:"regist phone user"});
        if(!newAccountRet || !newAccountRet.ret) return res.json({ret: false, msg: "get new user-account id failed"})
        bind_user_id = newAccountRet.token_x

        let bindDTNSIDRet = await rpc_query(USER_API_BASE+'/op',
        {token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_ROOT,opcode:'map',opval:'add',
        extra_data:JSON.stringify({map_key:'dtns-userid:'+dtns_user_id,map_value:bind_user_id})})
        if(!bindDTNSIDRet || !bindDTNSIDRet.ret) return res.json({ret:false,msg:'map dtns-user-id to phone-user-id failed'})
    
        let bindPhoneHashRet = await rpc_query(USER_API_BASE+'/op',
        {token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_ROOT,opcode:'map',opval:'add',
        extra_data:JSON.stringify({map_key:'phoneHash:'+phoneHash,map_value:bind_user_id})})
        if(!bindPhoneHashRet || !bindPhoneHashRet.ret) return res.json({ret:false,msg:'map phoneHash to bind-user-id failed'})
        //生成salt
        // let salt = str_filter.randomBytes(8);
        // let newPwd = str_filter.md5(pwd+salt);
        let user_name = deviceName
        // let invite_code=null
        let phone = '12345678901' //手机号码被保护起来了，不再具备唯一性（只有user_id才是唯一的）
        let regist_time = parseInt(new Date().getTime()/1000)
        let mc_logos_list =await mc_logos.get_list()//[]// await require('../mc_logos').get_list();
        let myTmpLogo = mc_logos_list[bind_user_id.split('_')[1].substring(15,17).charCodeAt()%mc_logos_list.length]
        obj = {phone,phoneHash,phoneEnInfo,dtns_user_id,public_key,user_name,logo:myTmpLogo,user_id:bind_user_id,by_invite_code:invite_code,regist_time}

        let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:bind_user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:phoneHash});
        if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert phone-info failed"})
        // obj.regist_time = str_filter.GetDateTimeFormat(regist_time)
    }

    let newDeviceAccountRet = await rpc_query(DTNS_API_BASE+"/fork",{token:DTNS_TOKEN_ROOT,opval:phoneHash,space:web3name+'1d000',extra_data:deviceName});
    if(!newDeviceAccountRet || !newDeviceAccountRet.ret) return res.json({ret: false, msg: "get new dtns-device-id failed"})
    let dtns_device_id = newDeviceAccountRet.token_x

    setWeb3KeyRet = await rpc_query(DTNS_API_BASE+"/op",
        {token_x:dtns_device_id,token_y:dtns_device_id,opval:public_key,opcode:dtns_config.fsm_config.OP_WEB3_KEY,extra_data:"set web3-key"});
    if(!setWeb3KeyRet || !setWeb3KeyRet.ret) return res.json({ret: false, msg: "set dtns-device-id web3-key failed"})

    let savePhoneInfoRet = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,dtns_device_id,'assert',JSON.stringify(obj),phoneHash)
    if(!savePhoneInfoRet)  return res.json({ret: false, msg: "set dtns-device-id phoneInfo failed"})
    //比token_x 可以查询到token_y，从token_y亦可查询到token_x（hold、rela-z关系较为方便查询映射关系）
    let bindDeviceRet = await rpc_api_util.s_save_into_token_list(DTNS_API_BASE,dtns_user_id,dtns_device_id,'hold',public_key)
    if(!bindDeviceRet) return res.json({ret:false,msg:'hold dtns-device failed'})

    //绑定公钥关系（与device统一绑定）
    let bindPublicKeyRet = await rpc_query(DTNS_API_BASE+'/op',
        {token_x:DTNS_TOKEN_ROOT,token_y:DTNS_TOKEN_ROOT,opcode:'map',opval:'add',
        extra_data:JSON.stringify({map_key:'ecc-pubkey:'+public_key,map_value:dtns_device_id})})
    if(!bindPublicKeyRet || !bindPublicKeyRet.ret) return res.json({ret:false,msg:'map dtns-device public_key failed'})

    //生成session-id
    let s_id = null// str_filter.randomBytes(16);
    // user_redis.set(ll_config.redis_key+":session:"+bind_user_id+"-"+s_id,s_id)

    if(invite_code)
    {
        let orderToken = ORDER_TOKEN_NAME+"_"+invite_code
        rewardInviteUser(orderToken,obj)
    }

    // delete obj.pwd
    // delete obj.salt
    obj.ret = true
    obj.msg = 'success'
    obj.s_id = s_id
    obj.dtns_device_id = dtns_device_id
    obj.regist_time = str_filter.GetDateTimeFormat(obj.regist_time)

    //2020.06.19新增机器人客服自动加新用户
    console_c.auto_add_new_user(obj.user_id, 'afterRegister'); // 触发条件：注册后

    //#2 fork-dtns-user-id（应该先fork这个） dtns-id与user-id是唯一绑定关系（暂定）
    //#3 fork-dtns-device-id（应该先fork这个）
    //#4 bind userid-dtns-id
    //#5 bind dtns-id->device-id
    //#6 map all
    //#7 ret msg
    res.json(obj)

    //发送通知(可能别的地方,依然要发送通知,例如登录设备)
    if(typeof g_system_send_notice_bind_device_notice_no_flag == 'undefined' || !g_system_send_notice_bind_device_notice_no_flag)
    {
        let noticeRet = await sendNotice(obj,'bind_device_notice')
        if(!noticeRet || !noticeRet.ret)
        {
            //延迟10秒,再发一次.
            setTimeout(()=>{
                sendNotice(obj,'bind_device_notice')
            },10000)
        }
    }
}

async function sendNotice(obj,noticeType){
    if(!obj) return {ret:false,msg:'obj is null'}
    //创建一个s_id,用于sigleChat
    let s_id = str_filter.randomBytes(16);
    user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id)
    let cReq = {params:{user_id:obj.user_id,s_id,user_b:obj.user_id,random:Date.now()}}
    let cRes = {}
    let singleRet = await new Promise((resolve)=>{
        cRes.json =function(data)
        {
            console.log('sendNotice-singleChat-cRes.json-ret-data:',data)
            resolve(data)
        }
        //获得chatid
        groupchat_c.singleChat(cReq,cRes)
    })
    console.log('sendNotice-singleRet:',singleRet)
    if(!singleRet || !singleRet.ret) return singleRet;
    //发送文本通知消息(由前端负责解析)
    let chatid = singleRet.chatid
    cReq.params.random = Date.now()
    cReq.params.chatid = chatid 
    obj.notice_msg_type = noticeType
    cReq.params.msg = JSON.stringify(obj)
    let sendMsgRet = await new Promise((resolve)=>{
        cRes.json =function(data)
        {
            console.log('sendNotice-sendMsgTypeText-cRes.json-ret-data:',data)
            resolve(data)
        }
        groupchat_c.sendMsgTypeText(cReq,cRes)
    })
    console.log('sendNotice-sendMsgRet:',sendMsgRet)
    return sendMsgRet
}

window.user_c.loginDevice = loginDevice
async function loginDevice(req,res)
{
    let {timestamp,web3name,sign} = str_filter.get_req_data(req)
    console.log('loginDevice---timestamp,web3name,sign',timestamp,web3name,sign)
    web3name = !web3name ? 'dtns':web3name

    if(timestamp+60*5 < parseInt( Date.now()/1000))
    {
        return res.json({ret:false,msg:'device login timeout'})
    }

    if(!sign)return res.json({ret:false,msg:'sign is error'})

    //#0 先行验证
    let hash =await key_util.hashVal(web3name+':'+timestamp)
    let recoverKey = await key_util.recoverPublickey(sign,hash)

    //由ecc-pubkey得到dtns-device-id
    let tokenInfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:'ecc-pubkey:'+recoverKey}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('tokenInfoRet',tokenInfoRet)
    if(!tokenInfoRet ||!tokenInfoRet.ret ||!tokenInfoRet.map_value)
    {
        return res.json({ret:false,msg:'dtns-device-id unexists!'})
    }

    //判断设备ID格式是否正确（是否是该web3app所需的格式）
    let dtns_device_id = tokenInfoRet.map_value
    if(dtns_device_id.split('_')[1].indexOf(web3name)!=0 && web3name!='dtns' && web3name.indexOf('dev')<0 && web3name.indexOf('loc')<0)  
    //2023-3-23当dtns_device_id在web3name=dtns时，亦可登录dtns-user（登录的是ll-con-kmm）
    //（与dtns-user共享了dtns_device_id，而不是重新绑定--重新绑定还是需要pop-safe-sms授权、
    //或者使用dtns-user-ecc-keys授权（待【新增】该逻辑
    //--任意web3name均可使用根账户dnts-user的ecc-keys授权绑定新的web3appp
    //-->使用dtns之ll-con-kmm服务端连接并实现（根账户之ll-con-kmm应用下）
    //---使用user-id和s-id，以及使用dnts-user之ecc-keys签名，生成新的web3app->dtns_device_id））
    //当ll-con-kmm拥有dtns-user的keys时，直接创建新的web3app之设备ID、并连接和登录web3app
        return res.json({ret:false,msg:'dtns-device-id unmatch web3name:'+web3name})

    //判断是否还存在着dtns-user-id与dtns-device-id的hold关系，如无，则表示该设备ID已被【禁止】
    let list = await rpc_api_util.s_query_token_list(DTNS_API_BASE,dtns_device_id,'hold',0,10000,true,null)
    console.log('dtns-device-hold-list:',list)
    if(!list || list.length==0 || list.length!=1 || !list[0].token_x)
         return res.json({ret:false,msg:'dtns-device-id not allowed by dtns-user-id,  dtns-user-id unexists!'})
    
    //判断user-id是否与dtns_user_id绑定，如无，则代表着该web3-user-id已经改绑定其他的dtns-user-id（则代表【禁止】权限）
    let dtns_user_id = list[0].token_x
    let user_id = null,obj = null
    if(web3name=='dtns')
    {
        let userIDRet = await rpc_query(USER_API_BASE+'/chain/map/value',
                    {token:USER_TOKEN_ROOT,map_key:'dtns-userid:'+dtns_user_id}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
        console.log('userIDRet',userIDRet)
        if(!userIDRet ||!userIDRet.ret ||!userIDRet.map_value)
        {
            return res.json({ret:false,msg:'dtns-user-id not allowed by web3app-user-id, web3app-user-id unexists!'})
        }

        user_id = userIDRet.map_value
    }
    else{ //web3name is not dtns
        let bindUserInfoRet = await rpc_query(USER_API_BASE+'/chain/map/value',
                {token:USER_TOKEN_ROOT,map_key:'dtns-userid:'+dtns_user_id}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
        console.log('tokenInfoRet',tokenInfoRet)
        if(!bindUserInfoRet ||!bindUserInfoRet.ret ||!bindUserInfoRet.map_value)
        {
            console.log('into bind UserInfo')
            let deviceObjInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,dtns_device_id,'assert')
            if(!deviceObjInfo) return res.json({ret:false,msg:'query device-obj-info is null, maybe not synced!'})

            const {phone,phoneHash,phoneEnInfo,dtns_user_id,public_key,user_name,logo,by_invite_code,regist_time} = deviceObjInfo
            //bind-user-id
            let newAccountRet = await rpc_query(USER_API_BASE+"/fork",{token:USER_TOKEN_ROOT,opval:phoneHash,extra_data:"regist phone user"});
            if(!newAccountRet || !newAccountRet.ret) return res.json({ret: false, msg: "get new user-account id failed"})
            let bind_user_id = newAccountRet.token_x
            console.log('bind_user_id',bind_user_id)
    
            let bindDTNSIDRet = await rpc_query(USER_API_BASE+'/op',
            {token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_ROOT,opcode:'map',opval:'add',
            extra_data:JSON.stringify({map_key:'dtns-userid:'+dtns_user_id,map_value:bind_user_id})})
            if(!bindDTNSIDRet || !bindDTNSIDRet.ret) return res.json({ret:false,msg:'map dtns-user-id to phone-user-id failed'})
        
            let bindPhoneHashRet = await rpc_query(USER_API_BASE+'/op',
            {token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_ROOT,opcode:'map',opval:'add',
            extra_data:JSON.stringify({map_key:'phoneHash:'+phoneHash,map_value:bind_user_id})})
            if(!bindPhoneHashRet || !bindPhoneHashRet.ret) return res.json({ret:false,msg:'map phoneHash to bind-user-id failed'})

            deviceObjInfo.user_id = bind_user_id //正确保存userid
            let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:bind_user_id,opcode:'assert',opval:JSON.stringify(deviceObjInfo),extra_data:phoneHash});
            if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert phone-info failed"})
            // deviceObjInfo.regist_time = str_filter.GetDateTimeFormat(regist_time)

            user_id = bind_user_id
            obj = deviceObjInfo
        }else{
            user_id = bindUserInfoRet.map_value
            let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
            obj = userInfo
            obj.user_id = user_id
        }
    }
    // let obj = await rpc_api_util.s_query_token_info(DTNS_API_BASE,tokenInfoRet.map_value,'assert')
    // if(!obj ) return res.json({ret:false,msg:'dtns-device-user-info unexists!'})

    // let user_id = obj.user_id 
    if(!user_id ) return res.json({ret:false,msg:'web3-user-id unexists!'})

    //还是直接查询user_id的值
    obj = !obj ? await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert'):obj
    obj.regist_time = str_filter.GetDateTimeFormat(obj.regist_time)

    //生成session-id
    let s_id = str_filter.randomBytes(16);
    if(window.g_user_session_timeout) user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id,window.g_user_session_timeout < 3 ? 3*24*60*60 :window.g_user_session_timeout) //3天超时 或任意秒数超时
    else user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id) //不超时

    if(window.g_allow_users && window.g_allow_users.indexOf(obj.user_id) <0)
    {
        console.log('user_id not allow:',obj.user_id)
        return res.json({ret:false,msg:'user_id not allow!',user_id:obj.user_id})
    }

    // delete obj.pwd
    // delete obj.salt
    obj.ret = true
    obj.msg = 'success'
    obj.s_id = s_id
    obj.dtns_device_id = dtns_device_id

    res.json(obj)

    //发送通知(登录设备)
    obj.s_id = null //避免使用上述的s_id
    if(typeof g_system_send_notice_login_device_notice_flag != 'undefined' && g_system_send_notice_login_device_notice_flag)
    {
        let noticeRet = await sendNotice(obj,'login_device_notice')
        if(!noticeRet || !noticeRet.ret)
        {
            //延迟10秒,再发一次.
            setTimeout(()=>{
                sendNotice(obj,'login_device_notice')
            },10000)
        }
    }
}

window.user_c.createFORKMap = createFORKMap
async function createFORKMap(obj_id,map_dtns_user_id = null,now_buy_fork_id = null)
{
    console.log('createFORKMap-params:',obj_id,map_dtns_user_id)
    //修改obj_id对应的信息
    let objInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,obj_id,'assert')
    console.log('createFORKMap-objInfo:',objInfo)
    if(!objInfo) return {ret:false,msg:'obj-info is empty'}

    let FORKID = objInfo.FORKID
    let token_x = objInfo.dtns_fork_id
    let is_web3app = typeof g_dtns_network_client!='undefined' && g_dtns_network_client
    if(!FORKID || !token_x){// return {ret:false,msg:'obj-info already haved the FORKID'}
        //构建FORK福刻信息
        let token = is_web3app ? dtns_root_keys.token :DTNS_TOKEN_ROOT
            
        let timestamp_i = parseInt(Date.now()/1000)
        let prefix_str = rpc_client.roomid + '000fork'
        token_x = dtns_config.root_config.TOKEN_NAME+'_'+ prefix_str +key_util.newPrivateKey().substring(0,
            dtns_config.root_config.TOKEN_ID_LENGTH - prefix_str.length)

        let TXINFO = {txid:sign_util.newTXID() ,token_x,token_y:token,
            opcode:'fork',opval:'opval',extra_data:'fork',timestamp_i}
        let TXJSON = sign_util.toTXJSONString(TXINFO);//序列化。
        console.log('createFORKMap-fork-FORKID:TXJSON:'+TXJSON)
        let hash = await key_util.hashVal(TXJSON);//得到hash值
        let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
        if(is_web3app) TXINFO.web3_sign = sign

        let ret = is_web3app ?  await dtns_network_rtc_api.rpc_query('/op',TXINFO):await rpc_query(DTNS_API_BASE+'/op',TXINFO)
        console.log('createFORK-FORK-RET:',ret)
        if(!ret || !ret.ret) return {msg:'fork failed',ret:false}
        if(!ret.rpc_reaction_ret || !ret.rpc_reaction_ret.ret) return {msg:'map FORKID failed',ret:false}
        FORKID = ret.rpc_reaction_ret.FORKID
        console.log('createFORK-FORKID:',FORKID)

        timestamp_i = parseInt(Date.now()/1000)
        TXINFO = {txid:sign_util.newTXID() ,token_x,token_y:token_x,
            opcode:'assert',opval:FORKID,extra_data:obj_id,timestamp_i}
        TXJSON = sign_util.toTXJSONString(TXINFO);//序列化。
        console.log('TXJSON:'+TXJSON)
        hash = await key_util.hashVal(TXJSON);//得到hash值
        sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
        if(is_web3app) TXINFO.web3_sign = sign

        ret = is_web3app ?  await dtns_network_rtc_api.rpc_query('/op',TXINFO):await rpc_query(DTNS_API_BASE+'/op',TXINFO)
        if(!ret || !ret.ret) return {msg:'assert failed',ret:false}

        objInfo.FORKID = FORKID
        objInfo.dtns_fork_id = token_x //dtns_fork合约ID
        let saveFlag = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT, obj_id,'assert',JSON.stringify(objInfo),'save FORKID')
        if(!saveFlag) return {ret:false,msg:'save FORKID to obj-info failed'}
    }
    
     //递归保存map关系
    let dtns_user_id = map_dtns_user_id
    if(!map_dtns_user_id){
        let user_id =  objInfo.owner ? objInfo.owner :objInfo.user_id

        let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
        if(!userInfo) return {ret:false,msg:'query map-user-info failed'}

        dtns_user_id = userInfo.dtns_user_id
        // if(!dtns_user_id) return {ret:true,msg:'save FORKID success, but user-id not dtns-user-id'}
    }
    console.log('createFORK-map-dtns_user_id:',dtns_user_id,map_dtns_user_id)

    if(!now_buy_fork_id)
    {
        now_buy_fork_id = token_x
    }

    //dtns-fork-id map dtns-user-id
    if(dtns_user_id){
        timestamp_i = parseInt(Date.now()/1000)
        TXINFO = {txid:sign_util.newTXID() ,token_x,token_y:token_x,
            opcode:'map',opval:'add',extra_data:JSON.stringify({map_key:'FORK-REL-USER:'+dtns_user_id,map_value:now_buy_fork_id}),timestamp_i}
        TXJSON = sign_util.toTXJSONString(TXINFO);//序列化。
        console.log('createFORKMap-TXJSON:'+TXJSON)
        hash = await key_util.hashVal(TXJSON);//得到hash值
        sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
        if(is_web3app) TXINFO.web3_sign = sign
        ret = is_web3app ?  await dtns_network_rtc_api.rpc_query('/op',TXINFO):await rpc_query(DTNS_API_BASE+'/op',TXINFO)
        if(!ret || !ret.ret) return {ret:false,msg:'save map-relation failed'}
    }else{
        console.log('createFORKMap--save FORKID success, but user-id not dtns-user-id')
    }
    
    //递归父obj_id
    let original_obj_id = objInfo.original_obj_id ? objInfo.original_obj_id : objInfo.obj_id
    console.log('createFORKMap--original_obj_id:',original_obj_id)
    if(original_obj_id && original_obj_id!=obj_id)
    {
        let sub_ret = await createFORKMap(original_obj_id,dtns_user_id,now_buy_fork_id)
        console.log('createFORKMap--sub_ret:',sub_ret)
        return {ret:true,msg:'map success',sub_map_ret:sub_ret}
    }
    return {ret:true,msg:'map success'}
}
/**
 * 发送通知
 */
window.user_c.sendWeb3Notice = sendWeb3Notice
async function sendWeb3Notice(req,res)
{
    let {user_id,s_id,notice_json} = str_filter.get_req_data(req);
    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})
    try{
        notice_json = JSON.parse(notice_json)
    }catch(ex)
    {
        console.log('notice_json-parse:'+ex)
        notice_json = null
    }
    if(!notice_json) return  res.json({ret:false,msg:"param(notice_json) error"})
    let ret = null
    if(typeof g_dtns_network_client!='undefined' && g_dtns_network_client )
    {
        ret = await dtns_network_rtc_api.rpc_query('/op',notice_json)
    }else{
        ret = await rpc_query(DTNS_API_BASE+'/op',notice_json)
    }

    if(ret)  res.json(ret)
    else res.json({ret:false,msg:'connect to dtns.network failed'})
}
/**
 * 查询通知结果
 */
window.user_c.queryWeb3NoticeList = queryWeb3NoticeList
async function queryWeb3NoticeList(req,res)
{
    let {user_id,s_id,dtns_device_id,opcode,begin,len} = str_filter.get_req_data(req);
    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    let ret = null
    if(typeof g_dtns_network_client!='undefined' && g_dtns_network_client )
    {
        ret = await dtns_network_rtc_api.rpc_query('/chain/opcode',{token:dtns_device_id,begin,len,opcode})
    }else{
        ret = await rpc_query(DTNS_API_BASE+'/chain/opcode',{token:dtns_device_id,begin,len,opcode})
    }

    if(ret && ret.list)
    {
        res.json(ret)
    }else{
        res.json({ret:false,msg:'query-list return null'})
    }
}
/**
 * 查询一批用户的公钥（一般特别用于chat-members-public_keys查询）
 */
window.user_c.queryUsersPublicKeys = queryUsersPublicKeys
async function queryUsersPublicKeys(req,res)
{
    let {users} = str_filter.get_req_data(req)
    if(!users || users.indexOf('[')!=0) return res.json({ret:false,msg:'param{users} is error'})
    try{
        users = JSON.parse(users)
    }catch(ex){}
    if(!users || users.length==0) return res.json({ret:false,msg:'param{users} may be error'})
    let results = []
    //查询public_keys
    for(let i=0;i<users.length;i++)
    {
        let userInfo= await rpc_api_util.s_query_token_info(USER_API_BASE,users[i],'assert')
        if(!userInfo) results.push({user_id:users[i],public_key:null})
        let dtns_user_id = userInfo.dtns_user_id
        let dtnsUserStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:dtns_user_id})
        if(!dtnsUserStates || !dtnsUserStates.ret) results.push({user_id:users[i],public_key:null})
        const public_key = dtnsUserStates.web3_key ? dtnsUserStates.web3_key  :dtnsUserStates.public_key
        results.push({user_id:users[i],public_key})
    }
    console.log('results:',results)
    res.json({ret:true,msg:'success',list:results})
}
/**
 * 设置批量用户的加密密钥（目前仅用于聊天室的e2ee端到端加密中--通用接口web3key）
 * ---当有新的用户加入时，直接给对应的用户派发这个web3key即可----不用保存在文件中（文件的同步性较差，并且迁移较为麻烦）
 */
window.user_c.setUsersWeb3Keys = setUsersWeb3Keys
async function setUsersWeb3Keys(req,res)
{
    let {user_id,s_id,list,list_id,web3key_hash,set_chat_web3key_hash_flag} = str_filter.get_req_data(req);
    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})
    if(!web3key_hash || web3key_hash.length<32) return res.json({ret:false,msg:"param(web3key_hash) error"})
    //判断是否是群成员
    //君子协议（如果非管理员之恶意用户修改了群的通讯密钥，则会导致通讯沟通出现问题）---客户端技术
    let my_msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin =  await rpc_api_util.s_check_token_list_related(MSG_API_BASE,my_msg_user_id,list_id,'relm');
    if(!isJoin) return res.json({ret:false,msg:"set-web3keys pm error"})

    if(!list || list.indexOf('[')!=0) return res.json({ret:false,msg:'param{list} is error'})
    try{
        list = JSON.parse(list)
    }catch(ex){}
    if(!list || list.length==0) return res.json({ret:false,msg:'param{list} may be error'})

    let results = [], syncFlag = false
    //完成同步
    for(let i=0;i<list.length;i++)
    {
        //web3-key-hash用于标识是哪一个web3-key（方便客户端使用解密的密钥）
        let {user_id,public_key,encrptoKeyText} = list[i]
        if(!encrptoKeyText) {
            console.log('setUsersWeb3Keys-list['+i+'].encrptoKeyText is null')
            results.push({ret:false,msg:'list['+i+'].encrptoKeyText is null'})
            continue
        }
        //判断是否是群成员
        let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
        let isJoin =  await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,list_id,'relm');
        if(!isJoin) results.push({ret:false,msg:'have no relation'})

        //直接在map中保存相应的web3-key（保存在用户的user-token-id-map中）
        let bindWeb3KeyRet = await rpc_query(USER_API_BASE+'/op',
        {token_x:user_id,token_y:user_id,opcode:'map',opval:'add',
        extra_data:JSON.stringify({map_key:'web3key_hash:'+web3key_hash,map_value:JSON.stringify({public_key,encrptoKeyText,list_id})})})

        if(bindWeb3KeyRet && bindWeb3KeyRet.ret && !syncFlag) syncFlag = true
        results.push(bindWeb3KeyRet)
    }
    let obj = {ret:syncFlag,msg:syncFlag?'success':'sync user-web3keys failed',results}

    let set_chatflag = false
    if(set_chat_web3key_hash_flag) //直接设置聊天室对应的web3_hash
    {
        if(syncFlag)
        {
            //直接在map中保存相应的web3-key（保存在用户的user-token-id-map中）
            let bindWeb3KeyRet = await rpc_query(MSG_API_BASE+'/op',
            {token_x:list_id,token_y:list_id,opcode:'map',opval:'add',
            extra_data:JSON.stringify({map_key:'web3key_hash',map_value:web3key_hash})})
            console.log('setUsersWeb3Keys->bindWeb3KeyRet',bindWeb3KeyRet)
            if(!bindWeb3KeyRet || !bindWeb3KeyRet.ret)
            {
                bindWeb3KeyRet = await rpc_query(MSG_API_BASE+'/op',
                {token_x:list_id,token_y:list_id,opcode:'map',opval:'add',
                extra_data:JSON.stringify({map_key:'web3key_hash',map_value:web3key_hash})})
                console.log('setUsersWeb3Keys->bindWeb3KeyRet',bindWeb3KeyRet)
            }
            set_chatflag = bindWeb3KeyRet && bindWeb3KeyRet.ret
        }
        obj.set_chatflag = set_chatflag
    }
    res.json(obj)    
}
/**
 * 设置群聊的web3key_hash（以标识采用的是哪一个web3key来解密）
 */
window.user_c.setObjWeb3Key = setObjWeb3Key
async function setObjWeb3Key(req,res)
{
    let {user_id,s_id,list_id,web3key_hash} = str_filter.get_req_data(req);
    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})
    if(!web3key_hash || web3key_hash.length<32) return res.json({ret:false,msg:"param(web3key_hash) error"})

    //判断是否是群成员
    //君子协议（如果非管理员之恶意用户修改了群的通讯密钥，则会导致通讯沟通出现问题）---客户端技术
    let my_msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin =  await rpc_api_util.s_check_token_list_related(MSG_API_BASE,my_msg_user_id,list_id,'relm');
    if(!isJoin) return res.json({ret:false,msg:"set-web3keys pm error"})

    //直接在map中保存相应的web3-key（保存在用户的user-token-id-map中）
    let bindWeb3KeyRet = await rpc_query(MSG_API_BASE+'/op',
    {token_x:list_id,token_y:list_id,opcode:'map',opval:'add',
    extra_data:JSON.stringify({map_key:'web3key_hash',map_value:web3key_hash})})
    console.log('setObjWeb3Key->bindWeb3KeyRet',bindWeb3KeyRet)

    res.json(bindWeb3KeyRet)
}
/**
 * 查询得到obj的web3-key-hash
 */
window.user_c.queryObjWeb3Key = queryObjWeb3Key
async function queryObjWeb3Key(req,res)
{
    let {user_id,s_id,list_id} = str_filter.get_req_data(req);
    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    let web3InfoRet = await rpc_query(MSG_API_BASE+'/chain/map/value',
                {token:list_id,map_key:'web3key_hash'})
    console.log('queryObjWeb3Key->web3InfoRet',web3InfoRet)
    if(!web3InfoRet|| !web3InfoRet.ret || !web3InfoRet.map_value) return res.json({ret:false,msg:'query web3key-hash failed'})
    res.json({ret:true,msg:'success',web3key_hash:web3InfoRet.map_value})
}
/**
 * 得到用户的map中的web3key:list_id
 */
window.user_c.queryUserWeb3Key = queryUserWeb3Key
async function queryUserWeb3Key(req,res)
{
    let {user_id,s_id,web3key_hash} = str_filter.get_req_data(req);
    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    let web3InfoRet = await rpc_query(USER_API_BASE+'/chain/map/value',
                {token:user_id,map_key:'web3key_hash:'+web3key_hash})
    console.log('queryUserWeb3Key->web3InfoRet',web3InfoRet)
    if(!web3InfoRet|| !web3InfoRet.ret || !web3InfoRet.map_value) return res.json({ret:false,msg:'query web3key-hash failed'})
    let {public_key,encrptoKeyText,list_id} = JSON.parse(web3InfoRet.map_value)
    res.json({ret:true,msg:'success',public_key,encrptoKeyText,web3key_hash,list_id})
}

window.user_c.syncWeb3Keys = syncWeb3Keys
async function syncWeb3Keys(req,res)
{
    let {user_id,encrypt_public_key,time_i,sign} = str_filter.get_req_data(req)
    time_i = parseInt(time_i)
    let now_i = Date.now()
    console.log('syncWeb3Keys-time_i:'+time_i+' now_i:'+now_i)
    if(time_i-5*60*1000 > now_i || time_i+600*1000 < now_i)
    {
        console.log('syncWeb3Keys-time_error')
        return res.json({ret:false,msg:'time_i error'})
    }
    let hash =await key_util.hashVal(''+time_i)
    let public_key = await key_util.recoverPublickey(sign,hash)
    if(!public_key)
    {
        console.log('syncWeb3Keys-recoverPublicKey failed')
        return res.json({ret:false,msg:'recover-public_key error'})
    }

    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    if(!userInfo){
        console.log('syncWeb3Keys-userInfo is empty')
        return res.json({ret:false,msg:'userInfo is empty'})
    }

    let dtns_user_id = userInfo.dtns_user_id
    let dtnsUserStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:dtns_user_id})
    console.log('syncWeb3Keys-dtnsUserStates',dtnsUserStates)
    if(!dtnsUserStates || !dtnsUserStates.ret) return res.json({ret:false,msg:'query dtns_user_id token states failed'})
    const dtns_public_key = dtnsUserStates.web3_key ? dtnsUserStates.web3_key  :dtnsUserStates.public_key
    if(public_key!=dtns_public_key){
        console.log('syncWeb3Keys-dtns_public_key not equal to public_key:',dtns_public_key,public_key)
        return res.json({ret:false,msg:'dtns_public_key not equal to public_key'})
    }
    // USER_TOKEN_ROOT:USER_TOKEN_NAME+"_0000000000000000",
    // RMB_TOKEN_ROOT:RMB_TOKEN_NAME+"_0000000000000000",
    // GSB_TOKEN_ROOT:GSB_TOKEN_NAME+"_0000000000000000",
    // SCORE_TOKEN_ROOT:SCORE_TOKEN_NAME+"_0000000000000000",
    // PCASH_TOKEN_ROOT:PCASH_TOKEN_NAME+"_0000000000000000",
    // VIP_TOKEN_ROOT:VIP_TOKEN_NAME+"_0000000000000000",
    // ORDER_TOKEN_ROOT:ORDER_TOKEN_NAME+"_0000000000000000",
    // MSG_TOKEN_ROOT:MSG_TOKEN_NAME+"_0000000000000000",
    // OBJ_TOKEN_ROOT:OBJ_TOKEN_NAME+"_0000000000000000",
    // HT_TOKEN_ROOT:HT_TOKEN_NAME+"_0000000000000000",
    // DTNS_TOKEN_ROOT
    let reqs = [
            window['g_engine_'+DTNS_TOKEN_NAME].wallet_m.queryTokenKeys(DTNS_TOKEN_ROOT),
            window['g_engine_'+USER_TOKEN_NAME].wallet_m.queryTokenKeys(USER_TOKEN_ROOT),
            window['g_engine_'+RMB_TOKEN_NAME].wallet_m.queryTokenKeys(RMB_TOKEN_ROOT),
            window['g_engine_'+GSB_TOKEN_NAME].wallet_m.queryTokenKeys(GSB_TOKEN_ROOT),
            window['g_engine_'+SCORE_TOKEN_NAME].wallet_m.queryTokenKeys(SCORE_TOKEN_ROOT),
            window['g_engine_'+VIP_TOKEN_NAME].wallet_m.queryTokenKeys(VIP_TOKEN_ROOT),
            window['g_engine_'+ORDER_TOKEN_NAME].wallet_m.queryTokenKeys(ORDER_TOKEN_ROOT),
            window['g_engine_'+MSG_TOKEN_NAME].wallet_m.queryTokenKeys(MSG_TOKEN_ROOT),
            window['g_engine_'+OBJ_TOKEN_NAME].wallet_m.queryTokenKeys(OBJ_TOKEN_ROOT)]
            // rpc_query(DTNS_API_BASE+'/chain/states',{token:DTNS_TOKEN_ROOT}),
            // rpc_query(USER_API_BASE+'/chain/states',{token:USER_TOKEN_ROOT}),
            // rpc_query(RMB_API_BASE+'/chain/states',{token:RMB_TOKEN_ROOT}),
            // rpc_query(GSB_API_BASE+'/chain/states',{token:GSB_TOKEN_ROOT}),
            // rpc_query(SCORE_API_BASE+'/chain/states',{token:SCORE_TOKEN_ROOT}),
            // // rpc_query(PCASH_API_BASE+'/chain/states',{token:PCASH_TOKEN_ROOT}),
            // rpc_query(VIP_API_BASE+'/chain/states',{token:VIP_TOKEN_ROOT}),
            // rpc_query(ORDER_API_BASE+'/chain/states',{token:ORDER_TOKEN_ROOT}),
            // rpc_query(MSG_API_BASE+'/chain/states',{token:MSG_TOKEN_ROOT}),
            // rpc_query(OBJ_API_BASE+'/chain/states',{token:OBJ_TOKEN_ROOT})]
    let rets = await Promise.all(reqs)
    console.log('syncWeb3Keys-rets:',rets)
    let retsJson = JSON.stringify(rets)
    let enText = null;
    try{
        enText =  await sign_util.encryptSomethingInfo(retsJson,encrypt_public_key)
    }catch(ex)
    {
        console.log('syncWeb3Keys-encryptSomethingInfo-exception:'+ex)
        return res.json({ret:false,msg:'encrypt_public_key is error'})
    }
    console.log('syncWeb3Keys-enText:',enText)
    res.json({ret:true,msg:'success',en_text:enText})
}

window.user_c.createWeb3App = createWeb3App
async function createWeb3App(req,res)
{
    let {user_id,s_id,web3name,web3desc,name,logo,pics,pubkey,labels,cid} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    if(!web3name || !web3desc) 
    {
        return res.json({ret:false,msg:"param(web3name,web3desc) error"})
    }
    let regExp = new RegExp("^[a-zA-Z0-9]+[a-zA-Z0-9]{1,16}$")
    if(!(web3name.length>1 && web3name.length<=16) || !regExp.test(web3name) || web3name.indexOf('1d')>=0)
    {
        return res.json({ret:false,msg:"param(web3name) format error"})
    }

    //查询web3name是否已经存在
    let web3InfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('web3InfoRet',web3InfoRet)
    if(web3InfoRet && web3InfoRet.map_value)
    {
        return res.json({ret:false,msg:'web3app is alreadly exists!'})
    }

    let newWeb3AccountRet = await rpc_query(DTNS_API_BASE+"/fork",{token:DTNS_TOKEN_ROOT,space:web3name+'000app',extra_data:"create web3-app user"});
    if(!newWeb3AccountRet || !newWeb3AccountRet.ret) return res.json({ret: false, msg: "get new dtns-user-id failed"})
    let web3_id = newWeb3AccountRet.token_x

    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    if(!userInfo){
        return res.json({ret:false,msg:'userInfo is unexists!'})
    }

    let dtns_user_id = userInfo.dtns_user_id
    if(!dtns_user_id){
        return res.json({ret:false,msg:'userInfo.dtns_user_id is unexists!'})
    }

    //设置public_key
    let public_key = pubkey
    if(!public_key)
    {
        let dtnsUserStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:dtns_user_id})
        console.log('dtnsUserStates',dtnsUserStates)
        if(!dtnsUserStates || !dtnsUserStates.ret) return res.json({ret:false,msg:'query dtns_user_id token states failed'})
        public_key = dtnsUserStates.web3_key ? dtnsUserStates.web3_key  :dtnsUserStates.public_key
    }
    
    let setWeb3KeyRet = await rpc_query(DTNS_API_BASE+"/op",
        {token_x:web3_id,token_y:web3_id,opval:public_key,opcode:dtns_config.fsm_config.OP_WEB3_KEY,extra_data:"set web3-key"});
    if(!setWeb3KeyRet || !setWeb3KeyRet.ret) return res.json({ret: false, msg: "set web3_id web3-key failed"})

    let objInfo = {dtns_user_id,web3name,web3desc,public_key,web3_id,name,logo,pics,labels, create_time_i:parseInt(Date.now()/1000)}
    objInfo.create_time = str_filter.GetDateTimeFormat(objInfo.create_time_i)
    let saveInfoRet = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'assert',JSON.stringify(objInfo),dtns_user_id)
    if(!saveInfoRet) return res.json({ret:false,msg:'save web3-obj-info to web3_id failed'})

    //2024-4-9新增，须判断cid是否有效
    let useCidFlag = false
    console.log('cid-param:',cid)
    if(cid)
    {
        let nowStr = await kmmDb.get('web3-cid:'+cid)
        console.log('cid-web3-nowStr:',nowStr,cid)
        if(nowStr == 'new')
        {
            let setFlag = await kmmDb.set('web3-cid:'+cid,'used')
            if(!setFlag) return res.json({ret:false,msg:'use the cid failed'})
            //设置为使用成功
            useCidFlag = true
        }else if(nowStr == 'used')
        {
            return res.json({ret:false,msg:'the cid is used'})
        }
    }
    //须扣费（不是管理员均须扣费---FORK或VIP用户待考虑优惠情形）
    if(!useCidFlag && !(await manager_c.isManagerUid(user_id)))
    {
        //计算创建web3app的费用
        let fee =typeof g_system_default_create_web3app_fee == 'undefined' || !isFinite(g_system_default_create_web3app_fee) ?  10000 : g_system_default_create_web3app_fee;////good_fee && ''+parseInt(good_fee) == good_fee ? parseInt(good_fee) :1
        //fee不能过小（过小则不利于内容付费）
        let rmbUserId = await order_c.s_queryUserRMBToken(user_id)
        let userSendRet = await rpc_query(RMB_API_BASE + "/send", {
            token_x: rmbUserId,
            token_y: RMB_TOKEN_ROOT,
            opval: fee , //1元或100DTNS
            extra_data: JSON.stringify(objInfo)
        })
        if(!userSendRet|| !userSendRet.ret){
            return res.json({ret:false,msg:'createWeb3App need fee: '+fee+'$ ,but your account is not enougth'})
        }
    }
    

    //保存关系
    let bindListRet = await rpc_api_util.s_save_into_token_list(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'relw',dtns_user_id)
    if(!bindListRet) return res.json({ret:false,msg:'bind web3_id to DTNS_TOKEN_ROOT failed'})

    bindListRet = await rpc_api_util.s_save_into_token_list(DTNS_API_BASE,dtns_user_id,web3_id,'relw',dtns_user_id)
    if(!bindListRet) return res.json({ret:false,msg:'bind web3_id to dtns_user_id failed'})

    let bindWeb3IDRet = await rpc_query(DTNS_API_BASE+'/op',
    {token_x:DTNS_TOKEN_ROOT,token_y:DTNS_TOKEN_ROOT,opcode:'map',opval:'add',
    extra_data:JSON.stringify({map_key:'web3:'+web3name,map_value:web3_id})})
    if(!bindWeb3IDRet || !bindWeb3IDRet.ret) return res.json({ret:false,msg:'map web3name to web3_id failed'})

    //web3app--default-tax-setting save 分账默认配置 2023-11-29
    let taxFlag = await createWeb3AppDefaultTaxSetting(objInfo)
    console.log('createWeb3App-taxFlag:',taxFlag,objInfo)
    //end the tax-setting-default save 
    //set-default-tax-max
    let taxMaxFlag = await createWeb3AppDefaultTaxMaxSetting(objInfo)
    console.log('createWeb3App-taxMaxFlag:',taxMaxFlag,objInfo)
    //end

    objInfo.ret = true
    objInfo.msg = 'success'
    res.json(objInfo)
}
/**
 * 设置default-setting的api处理函数
 */
window.user_c.createWeb3AppDefaultTaxSettingRpc = createWeb3AppDefaultTaxSettingRpc
async function  createWeb3AppDefaultTaxSettingRpc(req,res)
{
    let {web3name,setting} = str_filter.get_req_data(req)
    if(!web3name) return res.json({ret:false,msg:'web3name is empty'})

    let web3MapRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
            {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('createWeb3AppDefaultTaxSettingRpc-web3_id-MapRet',web3MapRet)
    if(!web3MapRet || !web3MapRet.ret || !web3MapRet.map_value)
        return res.json({ret:false,msg:'query web3name-map-web3_id failed!'})
    let objInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3MapRet.map_value,'assert')
    if(!objInfo) return res.json({ret:false,msg:'web3app-info is empty'})

    //web3app--default-tax-setting save 分账默认配置 2023-11-29
    let taxFlag = await createWeb3AppDefaultTaxSetting(objInfo,setting)
    console.log('createWeb3AppDefaultTaxSettingRpc-taxFlag:',taxFlag,objInfo)
    if(taxFlag)
    {
        objInfo.ret = true
        objInfo.msg = 'success'
    }else{
        objInfo.ret = false
    }
    res.json(objInfo)
}
/**
 * 设置default-setting的内部处理函数
 */
async  function  createWeb3AppDefaultTaxSetting(objInfo,setting = null)
{
    console.log('into createWeb3AppDefaultTaxSetting-begin:',objInfo)
    if(!objInfo) return false
    //尝试判断和解析setting-2-obj，如果格式不正确，则返回出错信息
    if(setting)
    {
        try{
            let settingObj = JSON.parse(setting)
            if(!settingObj.length || settingObj.length<=0 || !(settingObj[0].token)) //判断是否一个[{"token"}]的格式
            {
                objInfo.msg = 'param setting is error,setting-obj-format error!'
                return false
            }
        }catch(ex)
        {
            console.log('createWeb3AppDefaultTaxSetting-setting-parse-Exception:'+ex,ex)
            objInfo.msg = 'param setting is error, parse it exception!'
            return false
        }
    }

    let web3_id = objInfo.web3_id
    let web3name= objInfo.web3name
    if(!web3_id){
        console.log('createWeb3AppDefaultTaxSetting-web3_id is empty!')
        return false
    }
    //先判断是否存在，不存在着创建tax:web3name的map绑定关系
    let taxMapRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
            {token:DTNS_TOKEN_ROOT,map_key:'tax:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    if(!taxMapRet || !taxMapRet.ret || !taxMapRet.map_value)
    {
        let newWeb3IntAccountRet = await rpc_query(DTNS_API_BASE+"/fork",{token:DTNS_TOKEN_ROOT,space:web3name+'000int',extra_data:"create web3-int-id"});
        if(newWeb3IntAccountRet && newWeb3IntAccountRet.ret){
            let web3_int_id = newWeb3IntAccountRet.token_x
            //设置tax:web3name为默认的tax-setting配置
            let bindWeb3IntRet = await rpc_query(DTNS_API_BASE+'/op',
                {token_x:DTNS_TOKEN_ROOT,token_y:DTNS_TOKEN_ROOT,opcode:'map',opval:'add',
                extra_data:JSON.stringify({map_key:'tax:'+web3name,map_value:web3_int_id})})
            if(bindWeb3IntRet && bindWeb3IntRet.ret)
            {
                objInfo.web3_int_id = web3_int_id
            }else
            {
                objInfo.msg = 'bind web3-int-id failed'
                return false
            }
        }else{
            objInfo.msg = 'fork web3-int-id failed'
            return false
        }
    }else{
        objInfo.web3_int_id = taxMapRet.map_value
    }
    let web3_int_id = objInfo.web3_int_id
    //设置默认配置
    let root_tax = typeof g_root_tax_default =='undefined' || !isFinite(g_root_tax_default) ? 0.3: g_root_tax_default
    let web3_int_tax= typeof g_web3_tax_default =='undefined' || !isFinite(g_web3_tax_default) ? 0.2: g_web3_tax_default
    let defaultSetting = [
        {
            token:web3_int_id,//DTNS_TOKEN_ROOT,//这里不能是token-root，而必须是web3_int_id（仅用于配置和接收系统佣金）
            tax: root_tax,
            type:'tax' // gas etc..
        },
        {
            token:web3_id,
            tax: web3_int_tax,
            type:'tax' // gas etc..
        },
    ]
    let web3_int_settingRet = await rpc_api_util.s_save_token_info(DTNS_API_BASE,web3_int_id,web3_int_id,'assert',setting ? setting : JSON.stringify(defaultSetting),'tax-default-setting')
    if(web3_int_settingRet)
    {
        objInfo.web3_tax_setting = setting ? JSON.parse(setting) :defaultSetting
        return true
    }
    objInfo.msg = 'save web3-int-id defult-setting-failed'
    return false
}
/**
 * 查询tax版税系统的配置信息（据web3name）
 */
window.user_c.createWeb3AppDefaultTaxSettingQueryRpc = createWeb3AppDefaultTaxSettingQueryRpc
async function  createWeb3AppDefaultTaxSettingQueryRpc(req,res)
{
    let {web3name} = str_filter.get_req_data(req)
    if(!web3name) return res.json({ret:false,msg:'web3name is empty'})

    let web3MapRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
            {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('createWeb3AppDefaultTaxSettingQueryRpc-web3_id-MapRet',web3MapRet)
    if(!web3MapRet || !web3MapRet.ret || !web3MapRet.map_value)
        return res.json({ret:false,msg:'query web3name-map-web3_id failed!'})
    let objInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3MapRet.map_value,'assert')
    if(!objInfo) return res.json({ret:false,msg:'web3app-info is empty'})

    let web3_id = objInfo.web3_id
    if(!web3_id){
        console.log('createWeb3AppDefaultTaxSettingQueryRpc-web3_id is empty!')
        return res.json({ret:false,msg:'web3_id is empty'})
    }
    //先判断是否存在，不存在着创建tax:web3name的map绑定关系
    let taxMapRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
            {token:DTNS_TOKEN_ROOT,map_key:'tax:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    if(!taxMapRet || !taxMapRet.ret || !taxMapRet.map_value)
    {
        return res.json({ret:false,msg:'web3app-tax-setting-map is empty'})
    }else{
        objInfo.web3_int_id = taxMapRet.map_value
    }
    let web3_int_id = objInfo.web3_int_id

    //得到配置信息
    let settingInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3_int_id,'assert') 
    if(!settingInfo) return res.json({ret:false,msg:'tax-setting is empty'})
    res.json({ret:true,msg:'success',tax_setting:settingInfo})
}
/**
 * 设置最大值web3app的交易流通问题上限rpc-api接口，默认为10个亿
 */
window.user_c.createWeb3AppDefaultTaxMaxSettingRpc = createWeb3AppDefaultTaxMaxSettingRpc
async function  createWeb3AppDefaultTaxMaxSettingRpc(req,res)
{
    let {web3name} = str_filter.get_req_data(req)
    if(!web3name) return res.json({ret:false,msg:'web3name is empty'})

    let web3MapRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
            {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('createWeb3AppDefaultTaxMaxSettingRpc-web3_id-MapRet',web3MapRet)
    if(!web3MapRet || !web3MapRet.ret || !web3MapRet.map_value)
        return res.json({ret:false,msg:'query web3name-map-web3_id failed!'})
    let objInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3MapRet.map_value,'assert')
    if(!objInfo) return res.json({ret:false,msg:'web3app-info is empty'})

    //web3app--default-tax-setting save 分账默认配置 2023-11-29
    let taxMaxFlag = await createWeb3AppDefaultTaxMaxSetting(objInfo)
    console.log('createWeb3AppDefaultTaxMaxSettingRpc-taxMaxFlag:',taxMaxFlag,objInfo)
    if(taxMaxFlag)
    {
        objInfo.ret = true
        objInfo.msg = 'success'
    }else{
        objInfo.ret = false
    }
    res.json(objInfo)
}
/**
 * 设置最大值web3app的交易流通问题上限-内部函数，默认为10个亿
 */
async function createWeb3AppDefaultTaxMaxSetting(objInfo)
{
    console.log('into createWeb3AppDefaultTaxSetting-begin:',objInfo)
    if(!objInfo || !objInfo.web3_id) return false

    let web3_id = objInfo.web3_id
    let defaultTaxMax = typeof g_web3_tax_max_default =='undefined' || !isFinite(g_web3_tax_max_default) ? 1000000000: g_web3_tax_max_default
    let tax_max_extra_data = 'tax-max-setting-'+Date.now()+'-'+Math.random()
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(tax_max_extra_data) //不进行分账
    let ret = await rpc_query(DTNS_API_BASE+'/op',{opcode:'send',token_x:DTNS_TOKEN_ROOT,token_y:web3_id,opval:defaultTaxMax,extra_data:tax_max_extra_data})
    if(ret && ret.ret){
        objInfo.defaultTaxMax = defaultTaxMax
        return true
    }
    objInfo.msg = 'send web3_id default-tax-max-number failed'
    return false
}

window.user_c.setWeb3AppPublicKey = setWeb3AppPublicKey
async function setWeb3AppPublicKey(req,res)
{
    let {user_id,s_id,web3name,pubkey} = str_filter.get_req_data(req);
    if(!pubkey) return res.json({ret:false,msg:'param(pubkey) error'})

    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    let web3InfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('web3InfoRet',web3InfoRet)
    if(!web3InfoRet || !web3InfoRet.ret || !web3InfoRet.map_value)
    {
        return res.json({ret:false,msg:'web3app is unexists!'})
    }
    let web3_id = web3InfoRet.map_value

    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    if(!userInfo){
        return res.json({ret:false,msg:'userInfo is unexists!'})
    }

    let dtns_user_id = userInfo.dtns_user_id
    if(!dtns_user_id){
        return res.json({ret:false,msg:'userInfo.dtns_user_id is unexists!'})
    }

    let isRelated = await rpc_api_util.s_check_token_list_related(DTNS_API_BASE,dtns_user_id,web3_id,'relw')
    if(!isRelated) return res.json({ret:false,msg:'web3app not related to  dtns-user-id!'})

    let objInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3_id,'assert')
    if(!objInfo) return res.json({ret:false,msg:'web3app.objInfo is null'})
    if(objInfo.public_key == pubkey) return res.json({ret:false,msg:'web3app.objInfo.public_ke is equals to pubkey'})

    //须扣费（不是管理员均须扣费---FORK或VIP用户待考虑优惠情形）
    if(!(await manager_c.isManagerUid(user_id))){
        //计算发送头榜的费用
        let fee = 100;////good_fee && ''+parseInt(good_fee) == good_fee ? parseInt(good_fee) :1
        //fee不能过小（过小则不利于内容付费）
        let rmbUserId = await order_c.s_queryUserRMBToken(user_id)
        let userSendRet = await rpc_query(RMB_API_BASE + "/send", {
            token_x: rmbUserId,
            token_y: RMB_TOKEN_ROOT,
            opval: fee , //1元或100DTNS
            extra_data: JSON.stringify(objInfo)
        })
        if(!userSendRet|| !userSendRet.ret){
            return res.json({ret:false,msg:'createWeb3App need fee: 100$ ,but your account is not enougth'})
        }
    }

    let setWeb3KeyRet = await rpc_query(DTNS_API_BASE+"/op",
        {token_x:web3_id,token_y:web3_id,opval:pubkey,opcode:dtns_config.fsm_config.OP_WEB3_KEY,extra_data:"set web3-key"});
    if(!setWeb3KeyRet || !setWeb3KeyRet.ret) return res.json({ret: false, msg: "set web3_id web3-key failed"})

    objInfo.public_key = pubkey
    let setObjInfoRet = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'assert',JSON.stringify(objInfo),dtns_user_id)
    if(!setObjInfoRet) return res.json({ret: false, msg: "save web3_id objInfo.public_key failed"})

    objInfo.ret = true
    objInfo.msg = 'success'
    res.json(objInfo)
}
window.user_c.queryWeb3AppInfo = queryWeb3AppInfo
async function queryWeb3AppInfo(req,res)
{
    let {user_id,s_id,web3name} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    let web3InfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('web3InfoRet',web3InfoRet)
    if(!web3InfoRet || !web3InfoRet.ret || !web3InfoRet.map_value)
    {
        return res.json({ret:false,msg:'web3app is unexists!'})
    }
    let web3_id = web3InfoRet.map_value

    let objInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3_id,'assert')
    if(!objInfo) return res.json({ret:false,msg:'web3app.objInfo is null'})

    let web3idStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:web3_id})
    console.log('web3idStates',web3idStates)
    if(!web3idStates || !web3idStates.ret) return res.json({ret:false,msg:'query web3_id token states failed'})
    const web3_key = web3idStates.web3_key ? web3idStates.web3_key  :web3idStates.public_key

    objInfo.web3_key = web3_key
    objInfo.ret = true
    objInfo.msg = 'success'

    res.json(objInfo)
   
}
/**
 * 管理员直接修改web3app的设置
 * 例如：logo、name、web3desc、forkid（门禁id）、network等
 * createWeb3app的参数：web3name,web3desc,name,logo,pics,pubkey,labels
 */
window.user_c.setWe3appSetting = setWe3appSetting
async function setWe3appSetting(req,res){
    let {web3name,web3desc,name,logo,pics,pubkey,labels,forkid,network} = str_filter.get_req_data(req)
    if(!web3name) return res.json({ret:false,msg:'param-web3name is error'})
    if(!web3desc && !name && !logo && !pics && !pubkey && !labels && !forkid && !network)
    res.json({ret:false,msg:'params is empty'})

    let modifyObj = {}
    if(web3desc) modifyObj.web3desc = web3desc
    if(name) modifyObj.name = name
    if(logo) modifyObj.logo = logo
    if(pics) modifyObj.pics = pics
    // if(pubkey) modifyObj.pubkey = pubkey
    if(labels) modifyObj.labels = labels
    if(forkid) modifyObj.forkid = forkid
    if(network) modifyObj.network = network

    let web3InfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('web3InfoRet',web3InfoRet)
    if(!web3InfoRet || !web3InfoRet.ret || !web3InfoRet.map_value)
    {
        return res.json({ret:false,msg:'web3app is unexists!'})
    }
    let web3_id = web3InfoRet.map_value
    let objInfo = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3_id,'assert')
    if(!objInfo) return res.json({ret:false,msg:'web3app.objInfo is null'})

    objInfo = Object.assign({},objInfo,modifyObj)
    let saveInfoRet = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'assert',JSON.stringify(objInfo),'modify-web3app-setting')
    if(!saveInfoRet) return res.json({ret:false,msg:'modify web3app-setting failed'})
    res.json({ret:true,msg:'success'})
}
/**
 * 配置dtns的network配置信息（主要是tns-turn-phones-url）
 */
window.user_c.setDTNSNetworkConfig = setDTNSNetworkConfig
async function setDTNSNetworkConfig(req,res){
    let {web3name,config} = str_filter.get_req_data(req)
    if(!web3name) return res.json({ret:false,msg:'web3name is error'})
    if(!config || config.indexOf('{')!=0) return res.json({ret:false,msg:'config is error'})
    let configObj = null;
    try{
        configObj = JSON.parse(config)
    }catch(ex){
        console.log('[Error] parse network-config exception:'+ex,ex)
        return res.json({ret:false,msg:'config is not object-str'})
    }
    if(!configObj) return res.json({ret:false,msg:'parse config to configObj failed'})

    let mapInfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',{token:DTNS_TOKEN_ROOT,map_key:'web3:'+web3name})
    if(!mapInfoRet || !mapInfoRet.ret) return res.json({ret:false,msg:'query web3-id failed , web3name:'+web3name+' is error'})
    let web3_id = mapInfoRet.map_value
    let web3info = await rpc_api_util.s_query_token_info(DTNS_API_BASE,web3_id,'assert')
    if(!web3info) return res.json({ret:false,msg:'query web3-info failed'})
    let network = web3info.network ? web3info.network :'main.dtns'
    let modifyNetworkFlag = false
    if(configObj.network && network != configObj.network ) {
        console.log('modify-network--web3name:'+web3name,configObj.network,'old-network:',network)
        network = configObj.network
        modifyNetworkFlag = true
    }

    mapInfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',{token:DTNS_TOKEN_ROOT,map_key:'network:'+network})
    let network_token_id = null
    if(!mapInfoRet || !mapInfoRet.ret){
        network_token_id = await rpc_api_util.s_fork_token_id(DTNS_API_BASE,DTNS_TOKEN_ROOT,'network')
        if(!network_token_id) return res.json({ret:false,msg:'fork network-token-id failed , network:'+network})
        //network_token_id = forkRet.token_x
        //添加新的map-value
        let saveMapValueRet = await rpc_query(DTNS_API_BASE+'/op',{token_x:DTNS_TOKEN_ROOT,token_y:DTNS_TOKEN_ROOT,
            opcode:'map',opval:'add',
            extra_data:JSON.stringify({map_key:'network:'+network,map_value:network_token_id})})
        if(!saveMapValueRet || !saveMapValueRet.ret) return res.json({ret:false,msg:'save network-id-map failed'})
    }else{
        network_token_id = mapInfoRet.map_value
    }
    console.log('setDTNSNetworkConfig-network-token-id:',network_token_id)
    if(!network_token_id) return res.json({ret:false,msg:'get network-token-id failed , network:'+network})
    configObj.network = network
    let saveFlag = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,network_token_id,'assert',JSON.stringify(configObj),'network:'+network)

    if(saveFlag)
    {
        if(modifyNetworkFlag)
        {
            web3info.network = network
            saveFlag = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'assert',JSON.stringify(web3info),'modify-network-to:'+network)
            if(saveFlag) return res.json({ret:true,msg:'success'})
            return res.json({ret:false,msg:'save web3info.network failed'})
        }
        return res.json({ret:true,msg:'success'})
    }
    else res.json({ret:false,msg:'save config failed'})
}

/**
 * 发送短信。
 * @type {send_sms}
 */
window.user_c.send_sms =send_sms;
async function send_sms(req, res) {
    let {nation_code, phone, random, sign} = str_filter.get_req_data(req);
    nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;

    return res.json({ret:false,msg:'send_sms-api is unsafe and stopped!'})

    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});

    // 防重放攻击
    let str = await user_redis.get(ll_config.redis_key+":send_sms:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":send_sms:"+phone+random,random,120)

    str = await user_redis.get(ll_config.redis_key+":send_sms:"+phone)
    if(str)
    {
        return res.json({ret: false, msg: "send sms frequently, please send after 60s"});
    }
    user_redis.set(ll_config.redis_key+":send_sms:"+phone,phone,60)

    //送短信
    let code = str_filter.randomNum(6);
    let flag =await huawei_notice_util.send_sms(nation_code, phone, code);// await notice_util.send_sms(nation_code, phone, code);
    console.log("send sms:" + phone + " code:" + code + " flag:" + flag);
    if(!flag) {
        user_redis.del(ll_config.redis_key+":send_sms:"+phone,phone)//放开限制
        return res.json({ret: false, msg: "send sms failed"});
    }

    //记录在链上。
    let phone_id = await rpc_api_util.s_query_token_id(USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME+'_phone'+phone)
    if(!phone_id)
    {
        return res.json({ret: false, msg: "query phone-id failed"})
    }
    rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,phone_id,'send',code,'sms_code')

    //存放于redis中(10分钟）
    user_redis.set(ll_config.redis_key+":sms_code:"+phone,code,10*60)
    res.json({ret: true, msg: "success" })
}

/**
 * 发送安全邮箱以及安全手机的验证码。
 * @type {send_bind_code}
 */
window.user_c.send_bind_code =send_bind_code;
async function send_bind_code(req, res) {
    let {user_id,s_id,email, random, sign} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    // 防重放攻击
    let str = await user_redis.get(ll_config.redis_key+":send_bind_code:"+user_id)
    if(str)
    {
        return res.json({ret: false, msg: "send code wait 60s"});
    }
    user_redis.set(ll_config.redis_key+":send_bind_code:"+user_id,user_id,60)

    let email_code = str_filter.randomNum(6);
    let code = str_filter.randomNum(6);

    //查询手机号码
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    let phone = userInfo.phone

    let flag = await huawei_notice_util.send_sms(userInfo.nation_code,phone,code)
    if(!flag) return res.json({ret: false, msg: "send sms failed"});

    user_redis.set(ll_config.redis_key+":sms_code:bind:"+phone,code,10*60)

    let emailFlag = await huawei_notice_util.send_email(email,'【请查收安全邮箱验证码】您在dtns云绑定安全邮箱','【请查收安全邮箱验证码】您在dtns云绑定安全邮箱，安全验证码为：'+email_code)
    if(!emailFlag) return res.json({ret: false, msg: "send email failed"});

    user_redis.set(ll_config.redis_key+":sms_code:bind:"+email,email_code,10*60)

    console.log("email_code:"+email_code)
    console.log("code:"+code)

    return res.json({ret: true, msg: "success",email})
}

/**
 *
 * @type {bind_role}
 */
window.user_c.bind_role =bind_role;
async function bind_role(req, res) {
    let {phone,user_id,s_id,role_kind,role_name,paper_kind,paper_code,code,filename, random, sign} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    if(!role_kind)  return res.json({ret:false,msg:"role_kind error"})
    if(!role_name || role_name.length<2)  return res.json({ret:false,msg:"role_name error"})
    if(!paper_kind)  return res.json({ret:false,msg:"paper_kind error"})
    if(!paper_code || paper_code.length<8)  return res.json({ret:false,msg:"paper_code error"})

    //校验短信（是否已经存在链上）
    let smsCode = await user_redis.get(ll_config.redis_key+":sms_code:"+phone)
    if(code!=smsCode)  return res.json({ret: false, msg: "sms_code unmatch"});


    //查询用户资料，看是否已经有rold_order_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.role_order_id)
    {
        let forkRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,space:'role'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork role-order-id failed"});
        userInfo.role_order_id = forkRet.token_x
        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})

        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo role-order-id failed"});
    }

    let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email,tips:'申请认证',user_name:userInfo.user_name}
    //将该申请资料，保存到order-id中
    let sendRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:userInfo.role_order_id,
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send role-order-info failed"});

    let sendAllRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:ORDER_TOKEN_NAME+'_roleall000000000',
        opval:JSON.stringify(obj),extra_data:user_id})

    if(!sendAllRet || !sendAllRet.ret){
		rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,dst_token:ORDER_TOKEN_NAME+'_roleall000000000'});
		return res.json({ret: false, msg: "send role-order-info to allorder failed"});
	}

    user_redis.del(ll_config.redis_key+":sms_code:"+phone)

    return res.json({ret:true,msg:'success'})
}


/**
 * 绑定安全邮箱
 * @type {bind_email}
 */
window.user_c.bind_email =bind_email
async function bind_email(req, res) {

    let {user_id,s_id,email, email_code,code,random, sign} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    if(!email) return res.json({ret:false,msg:"email error"})
    if(!email_code) return res.json({ret:false,msg:"email_code error"})
    if(!code) return res.json({ret:false,msg:"code error"})

    // 防重放攻击
    let str = await user_redis.get(ll_config.redis_key+":send_bind_code:"+email+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":send_bind_code:"+email+random,random,120)

    //查询手机号码
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    let phone = userInfo.phone


    let email_codeStr = await user_redis.get(ll_config.redis_key+":sms_code:bind:"+email)
    let phone_codeStr = await user_redis.get(ll_config.redis_key+":sms_code:bind:"+phone)

    if(email_codeStr!=email_code) return res.json({ret: false, msg: "email code error"});
    if(phone_codeStr!=code) return res.json({ret: false, msg: "phone code error"});

    //成功即可绑定。
    userInfo.email = email;
    let assertRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:userInfo.user_id,opcode:'assert',opval:JSON.stringify(userInfo),extra_data:phone})
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert userInfo error"});

    rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+"_phone"+phone,opcode:'assert',opval:JSON.stringify(userInfo),extra_data:user_id})
    rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:str_filter.create_token_name_last(userInfo.user_name),
        opcode:'assert',opval:JSON.stringify(userInfo),extra_data:user_id})
    rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+user_id.split('_')[1],opval:'恭喜您，成功绑定安全邮箱（'+email+'）',extra_data:user_id})

    //奖励经验值。
    rpc_query(SCORE_API_BASE+'/send',{token_x:SCORE_TOKEN_ROOT,token_y:SCORE_TOKEN_NAME+"_"+user_id.split('_')[1],
        opval:100,extra_data:'绑定安全邮箱'})

    user_redis.del(ll_config.redis_key+":sms_code:bind:"+email)
    user_redis.del(ll_config.redis_key+":sms_code:bind:"+phone)
    return res.json({ret: true, msg: "success",email})
}

function get_token_user_name(user_name)
{
    let len = user_name.length;
    if(len>0) return USER_TOKEN_ROOT.substring((USER_TOKEN_NAME+"_").length+len,USER_TOKEN_ROOT.length)+user_name
    return user_name;
}
/**
 * 注册用户
 * @type {regist_user}
 *
 *
 */
window.user_c.regist_phone_user =regist_phone_user;
async function regist_phone_user(req, res) {
    let {nation_code,phone,sms_code,user_name,pwd,random,sign,invite_code} = str_filter.get_req_data(req);
    nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;

    return res.json({ret:false,msg:'regist_phone_user-api is unsafe and stopped!'})

    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!sms_code || sms_code.length!=6 || sms_code!=sms_code*1) return res.json({ret: false, msg: "sms_code is error"});
    //|| !gnode_format_util.checkNodeid(user_name)
    if(!user_name || user_name.length<2 || user_name.length>16) return res.json({ret: false, msg: "user_name is error"});
    if(!pwd || pwd.length<16) return res.json({ret: false, msg: "pwd is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    // 防重放攻击
    let str = await user_redis.get(ll_config.redis_key+":regist_phone_user:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":regist_phone_user:"+phone+random,random,120)

    let {invite_type,score_reward,vip_reward,rmb_reward} = await get_invite_setting();
    if(invite_type == 2 && !invite_code){
        console.log('invite_type equal 2 but invite_code is null')
        return res.json({ret: false, msg: "need invite_code"});
    }

    //校验短信（是否已经存在链上）
    if(sms_code!='888888')
    {
        let smsCode = await user_redis.get(ll_config.redis_key+":sms_code:"+phone)
        if(sms_code!=smsCode)  return res.json({ret: false, msg: "sms_code unmatch"});
    }else{
        console.log('[pass]use safe-sms-code:'+sms_code)
        let phoneid = USER_TOKEN_NAME+'_phone'+phone
        await rpc_api_util.s_query_token_id(USER_API_BASE,USER_TOKEN_ROOT,phoneid) 
    } 
    //判断帐户是否已经注册
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:10});
    if(ret && ret.ret)  return res.json({ret: false, msg: "this phone is registed"});

    // let token_user_name = str_filter.create_token_name_last(USER_TOKEN_ROOT,user_name);
    // ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:token_user_name,opcode:'assert',begin:0,len:10});
    // if(ret && ret.ret)  return res.json({ret: false, msg: "this user_name is registed"});

    let newAccountRet = await rpc_query(USER_API_BASE+"/fork",{token:USER_TOKEN_ROOT,opval:phone,extra_data:"regist phone user"});
    if(!newAccountRet || !newAccountRet.ret) return res.json({ret: false, msg: "get new account id failed"})

    // let newUserAccountRet = await rpc_query(USER_API_BASE+"/fork",{token:USER_TOKEN_ROOT,dst_token:token_user_name,opval:phone,extra_data:"regist user_name"});
    // if(!newUserAccountRet || !newUserAccountRet.ret) return res.json({ret: false, msg: "get new account id failed"})
    //生成salt
    let salt = str_filter.randomBytes(8);
    let newPwd = str_filter.md5(pwd+salt);
    let regist_time = parseInt(new Date().getTime()/1000)
    let mc_logos_list =await mc_logos.get_list()//[]// await require('../mc_logos').get_list();
    let myTmpLogo = mc_logos_list[newAccountRet.token_x.split('_')[1].substring(15,17).charCodeAt()%mc_logos_list.length]
    let obj = {phone,nation_code,user_name,logo:myTmpLogo,pwd:newPwd,user_id:newAccountRet.token_x,salt,by_invite_code:invite_code,regist_time}

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:newAccountRet.token_x,opcode:'assert',opval:JSON.stringify(obj),extra_data:phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert phone-info failed"})

    // let assertUserRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:token_user_name,opcode:'assert',opval:JSON.stringify(obj),extra_data:phone});
    // if(!assertUserRet || !assertUserRet.ret) return res.json({ret: false, msg: "assert user_name-info failed"})

    //登记帐户相关信息（在链上）。
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:newAccountRet.token_x});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "regist_user failed"})

    //生成session-id
    let s_id = str_filter.randomBytes(16);
    user_redis.set(ll_config.redis_key+":session:"+newAccountRet.token_x+"-"+s_id,s_id)

    rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:newAccountRet.token_x,opcode:'config',opval:s_id,extra_data:"session"});

    if(invite_code)
    {
        let orderToken = ORDER_TOKEN_NAME+"_"+invite_code
        rewardInviteUser(orderToken,obj)
    }

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = 'success'
    obj.s_id = s_id
    obj.regist_time = str_filter.GetDateTimeFormat(regist_time)

    user_redis.del(ll_config.redis_key+":sms_code:"+phone)

    //2020.06.19新增机器人客服自动加新用户
    console_c.auto_add_new_user(obj.user_id, 'afterRegister'); // 触发条件：注册后

    return res.json(obj)
}

/**
 * 由orderToken查询assert得到对应的值。
 * @param orderToken
 * @returns {Promise<void>}
 */
async function rewardInviteUser(orderToken,obj)
{
    delete obj.pwd
    delete obj.salt

    let {invite_type,score_reward,vip_reward,rmb_reward} = await get_invite_setting();

    let assertRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:orderToken,opcode:'assert',begin:0,len:1})
    if(!assertRet || !assertRet.ret){
        console.log("query inviteCode assert user-info failed")
        // return {ret: false, msg: "query inviteCode assert user-info failed"}
    }

    let userInfo = JSON.parse(JSON.parse(assertRet.list[0].txjson).opval)
    if(orderToken.split('_')[1] != userInfo.invite_code) {
        console.log("rewardInviteUser orderToken:"+orderToken+" userInfo.invite_code:"+userInfo.invite_code)
        // return {ret: false, msg: "user invite_code != user-info.invite_code"}
    }

    let userTokenID = userInfo.user_id.split('_')[1]
    obj.gsb = score_reward//100 //奖励的数值
    obj.rmb = rmb_reward
    obj.invite_time = parseInt(new Date().getTime()/1000)
    obj.invite_order_name = '首次注册奖励'
    //保存一条成功邀请的纪录(order链上）。
    rpc_query(ORDER_API_BASE+"/send",{token_x:ORDER_TOKEN_ROOT,token_y:orderToken,opval:JSON.stringify(obj),extra_data:obj.user_id});

    //做激励---查询与之对应的user_id，然后对gsb_id进行激励。
    let sendRet = await rpc_query(GSB_API_BASE+"/send",{token_x:GSB_TOKEN_ROOT,token_y:GSB_TOKEN_NAME+"_"+userTokenID,
            opval:obj.gsb,extra_data:JSON.stringify(obj)});
    if(!sendRet || !sendRet.ret)
    {
        let msg = "send invite-user GSB faile! msg:"+sendRet.msg
        console.log(msg);
    }
    else console.log("send GSB success ");


    sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:RMB_TOKEN_ROOT,token_y:RMB_TOKEN_NAME+"_"+userTokenID,
            opval:obj.rmb,extra_data:JSON.stringify(obj)});
    if(!sendRet || !sendRet.ret)
    {
        let msg = "send invite-user RMB faile! msg:"+sendRet.msg
        console.log(msg);
    }
    else console.log("send RMB success ");

    //发送消息纪录
    rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+userTokenID,opval:'成功邀请用户（'+userInfo.user_name+"），获得注册奖励",
        extra_data:JSON.stringify(obj)});
}

/**
 * 登录手机，由短信。
 * @type {login_user_sms}
 */
window.user_c.login_user_sms =login_user_sms;
async function login_user_sms(req, res) {
    let {nation_code,phone,sms_code,random} = str_filter.get_req_data(req);
    nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;

    return res.json({ret:false,msg:'login_user_sms-api is unsafe and stopped!'})

    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!sms_code || sms_code.length!=6 || sms_code!=sms_code*1) return res.json({ret: false, msg: "sms_code is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    // //防重放攻击
    let str = await user_redis.get(ll_config.redis_key+":login_user_sms:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":login_user_sms:"+phone+random,random,120)

    //校验手机号码和短信（是否已经存在链上）
    let smsStr = await user_redis.get(ll_config.redis_key+":sms_code:"+phone)
    if(!smsStr) res.json({ret: false, msg: "sms_code unmatch"});

    //查询帐户信息
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "phone unregist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    //生成session-id，将session-id存在链上和redis上。
    //生成session-id
    let s_id = str_filter.randomBytes(16);
    user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id)

    rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'config',opval:s_id,extra_data:"session"});

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"
    obj.s_id = s_id

    user_redis.del(ll_config.redis_key+":sms_code:"+phone)

    return res.json(obj)
}

/**
 * 登录帐户（靠密码）
 * @type {login_user_pwd}
 */
window.user_c.login_user_pwd =login_user_pwd;
async function login_user_pwd(req, res) {
    let {nation_code,phone,pwd,random} = str_filter.get_req_data(req);

    return res.json({ret:false,msg:'login_user_pwd-api is unsafe and stopped!'})

    // nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;
    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!pwd ) return res.json({ret: false, msg: "pwd is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    //防重放攻击
    let str = await user_redis.get(ll_config.redis_key+":login_user_pwd:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":login_user_pwd:"+phone+random,random,120)

    //查询帐户信息
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "phone unregist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(str_filter.md5(pwd+obj.salt)!=obj.pwd)  return res.json({ret: false, msg: "pwd error"});;
    //生成session-id，将session-id存在链上和redis上。
    //生成session-id
    let s_id = str_filter.randomBytes(16);
    user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id)

    rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'config',opval:s_id,extra_data:"session"});

    delete obj.pwd
    delete obj.salt

    obj.regist_time = obj.regist_time ? str_filter.GetDateTimeFormat(obj.regist_time) : null;
    if(!obj.regist_time) delete obj.regist_time;

    obj.ret = true;
    obj.msg = "success"
    obj.s_id = s_id

    return res.json(obj)
}

/**
 * 修改用户密码--通过手机号码和短信
 * @type {modify_user_pwd}
 */
window.user_c.modify_user_pwd_sms =modify_user_pwd_sms;
async function modify_user_pwd_sms(req, res) {
    let {nation_code,phone,sms_code,random,pwd} = str_filter.get_req_data(req);
    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!sms_code || sms_code.length!=6 || sms_code!=sms_code*1) return res.json({ret: false, msg: "sms_code is error"});
    if(!pwd ) return res.json({ret: false, msg: "pwd is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    return res.json({ret:false,msg:'modify_user_pwd_sms-api is unsafe and stopped!'})

    //校验key和random
    let str = await user_redis.get(ll_config.redis_key+":modify_phone_user_pwd:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":modify_phone_user_pwd:"+phone+random,random,120)

    //校验手机号码和短信（是否已经存在链上）
    let smsStr = await user_redis.get(ll_config.redis_key+":sms_code:"+phone)
    if(!smsStr) res.json({ret: false, msg: "sms_code unmatch"});

    //查询帐户信息
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "phone unregist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);

    if(obj.pwd==str_filter.md5(pwd+obj.salt)) return res.json({ret: false, msg: "new-pwd equal old-pwd"});

    obj.salt = str_filter.randomBytes(8)
    obj.pwd = str_filter.md5(pwd+obj.salt)

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    //登记帐户相关信息（在链上）。
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    user_redis.del(ll_config.redis_key+":sms_code:"+phone)

    return res.json({ret:true,msg:"success"})
}

/**
 * 查询用户信息，包含认证等相关情况。
 * @type {queryUserInfo}
 */
window.user_c.queryUserInfo =queryUserInfo;
async function queryUserInfo(req, res) {
    let {user_id,s_id,dst_user_id} = str_filter.get_req_data(req);
    //查redis或者链上资料。

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!dst_user_id) return res.json({ret:false,msg:"dst_user_id error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:dst_user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});
    //2020-4-2新增，用于是否已经添加为联系人。
    let is_contact = await rpc_api_util.s_check_token_list_related(USER_API_BASE,user_id,dst_user_id,'relm');

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(obj && obj['dtns_int_id'] && obj['dtns_int_id'].indexOf('_'+ll_config.roomid)<0)
    {
        let dtns_int_id = obj.dtns_int_id
        delete obj.dtns_int_id
        // (DTNS_API_BASE,DTNS_TOKEN_ROOT,dtns_device_id,'assert',JSON.stringify(obj),phoneHash
        let saveRet = await rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,user_id,'assert',JSON.stringify(obj),'set dtns-int-id to empty')
        console.log('set dtns-int-id to empty,saveRet:',saveRet,dtns_int_id,ll_config.roomid)
    }
    obj.ret = true;
    obj.msg = "success"
    obj.is_contact = is_contact;//用于判断dst_user_id是否已经是user_id的联系人（这样就不用重复添加联系人）
    delete obj.salt
    delete obj.pwd
    res.json(obj)
}

/**
 * 内部查询用户信息。
 * @type {s_queryUserInfo}
 */
window.user_c.s_queryUserInfo =s_queryUserInfo;
async function s_queryUserInfo(dst_user_id) {

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:dst_user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return {};

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    obj.ret = true;
    obj.msg = "success"
    delete obj.salt
    delete obj.pwd
    return obj;
}

/**
 * 查询用户信息---由手机号码查询
 * @type {queryUserInfoByPhone}
 */
window.user_c.queryUserInfoByPhone =queryUserInfoByPhone;
async function queryUserInfoByPhone(req, res) {
    let {user_id,s_id,phone} = str_filter.get_req_data(req);
    //查redis或者链上资料。

    return res.json({ret:false,msg:'queryUserInfoByPhone-api is unsafe and stopped!'})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //if(phone!=phone*1 || (phone+'').length!=11) return res.json({ret:false,msg:"phone error"}) 
    if(!phone) return res.json({ret:false,msg:"phone error"}) 
    //得到手机号码对应的用户信息表。
    let phoneInfoRet = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!phoneInfoRet || !phoneInfoRet.ret) return res.json({ret: false, msg: "phone-user un-regist!"});
    let phoneInfo = JSON.parse(JSON.parse(phoneInfoRet.list[0].txjson).opval);

    //得到目标user-id
    let dst_user_id = phoneInfo.user_id;
    if(!dst_user_id) return res.json({ret:false,msg:"get phone-user-info's user-id failed"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:dst_user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});


    //得到dst_user_id的资料。
    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    obj.ret = true;
    obj.msg = "success"
    delete obj.salt
    delete obj.pwd
    res.json(obj)
}
/**
 * 得到更安全的用户信息
 */
window.user_c.get_safe_user_info =get_safe_user_info;
function get_safe_user_info(userInfo) {
    if(!userInfo) return userInfo;
    delete userInfo.salt
    delete userInfo.pwd
}

/**
 * 修改链上资料
 * @type {modifyUserInfo}
 */
window.user_c.modifyUserInfo =modifyUserInfo;
async function modifyUserInfo(req, res) {
    let {user_id,s_id,user_name,logo} = str_filter.get_req_data(req);

    if(!user_name || user_name.length<2 || user_name.length>32) res.json({ret:false,msg:"user_name error"})
    if(!logo || user_name.length<16 ) res.json({ret:false,msg:"logo error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(obj.user_name == user_name) return res.json({ret: false, msg: "new-name equal old-name!"});
    obj.user_name = user_name;
    obj.logo = logo;
    obj.mod_time  = parseInt(new Date().getTime()/1000)

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    // //登记帐户相关信息（在链上）。
    // let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    // if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    let msg = user_name+'修改了个人资料';
    //不等待消息处理完。
    groupchat_c.sendUserInfoModifyMsg(user_id,msg,obj)

    return res.json(obj)
}


/**
 * 修改链上资料
 * @type {modifyUserInfoName}
 */
window.user_c.modifyUserInfoName =modifyUserInfoName;
async function modifyUserInfoName(req, res) {
    let {user_id,s_id,user_name} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!user_name || user_name.length<2 || user_name.length>32) res.json({ret:false,msg:"user_name error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(obj.user_name == user_name) return res.json({ret: false, msg: "new-name equal old-name!"});
    obj.user_name = user_name;
    obj.mod_time  = parseInt(new Date().getTime()/1000)

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    // //登记帐户相关信息（在链上）。
    // let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    // if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    let msg = user_name+'修改了昵称';
    //不等待消息处理完。
    groupchat_c.sendUserInfoModifyMsg(user_id,msg,obj)

    return res.json(obj)
}


window.user_c.modifyUserInfoLogo =modifyUserInfoLogo;
async function modifyUserInfoLogo(req, res) {
    let {user_id,s_id,logo} = str_filter.get_req_data(req);

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!logo || logo.length<16 ) res.json({ret:false,msg:"logo error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    //if(obj.logo == logo) return res.json({ret: false, msg: "new-name equal old-name!"});
    obj.logo = logo;
    obj.mod_time  = parseInt(new Date().getTime()/1000)

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    // //登记帐户相关信息（在链上）。
    // let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    // if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    let msg = '修改了头像';//user_name+'
    //不等待消息处理完。
    groupchat_c.sendUserInfoModifyMsg(user_id,msg,obj)

    return res.json(obj)
}

/**
 * 修改用户资料（内部调用函数）
 */
window.user_c.s_modifyUserInfo =s_modifyUserInfo;
async function s_modifyUserInfo(user_id,keys,values)
{
    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret){
        console.log(JSON.stringify(({ret: false, msg: "user_id unexist now!"})))
        return false;
    }

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    // if(obj[key] == value) return res.json({ret: false, msg: "new-value equal old-value!"});
    let i = 0;
    for(;i<keys.length;i++)
        obj[keys[i]]  = values[i]

    // if(JSON.parse(ret.list[0].txjson).opval == JSON.stringify(obj))
    // {
    //     console.log("JSON.parse(ret.list[0].txjson).opval:"+JSON.parse(ret.list[0].txjson).opval)
    //     console.log("JSON.stringify(obj):"+JSON.stringify(obj))
    //     console.log(JSON.stringify({ret: false, msg: "new-value equal old-value!"}))
    //     return false;
    // }
    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret)
    {
        console.log(JSON.stringify({ret: false, msg: "assert user-info failed"}))
        return false;
    }



    let assertPhoneRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+"_phone"+obj.phone,
            opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!assertPhoneRet || !assertPhoneRet.ret)
    {
        console.log(JSON.stringify({ret: false, msg: "assert phone-info failed"}))
        return false;
    }

    let assertNameRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:str_filter.create_token_name_last(USER_TOKEN_ROOT,obj.user_name),
        opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!assertNameRet || !assertNameRet.ret)
    {
        console.log(JSON.stringify({ret: false, msg: "assert name-info failed"}))
        return false;
    }

    return true
}

/**
 * @type {send_email}
 */
window.user_c.send_email =send_email;
async function send_email(req, res) {
    let {email,subject,content} = str_filter.get_req_data(req);

    let flag = await notice_util.send_email(email,subject,content);
    console.log("send email:"+email+" subject:"+subject+ " content:"+content+" flag:"+flag);

    res.json({ret:flag,msg:flag?"success":"send email failed"})
    //校验key和random

    // 发送短信。

    //发送成功，纪录在redis和链上。
}
/**
 * 认证帐户
 * @type {renzheng}
 */
window.user_c.renzheng =renzheng;
async function renzheng(req, res) {
    let {phone,sms_code,random,email} = str_filter.get_req_data(req);
    //校验key和random

    //校验手机号码和短信（是否已经存在链上）

    //判断邮箱是否已经绑定过该帐户。

}

/**
 * 查询用户的账户余额。
 * @type {queryAccountRmb}
 */
window.user_c.queryAccountRmb =queryAccountRmb;
async function queryAccountRmb(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    //校验key和random
    let str = await user_redis.get(ll_config.redis_key+":queryAccountRmb:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":queryAccountRmb:"+user_id+random,random,120)

    //查询用户帐户信息
    let rmb = 0;
    
    let sendInfoRet = await rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1})
    if(sendInfoRet && sendInfoRet.ret){
        rmb = JSON.parse(sendInfoRet.list[0].txjson).token_state * 1;
    }else {
        //创建一个人民币帐户
        rpc_query(RMB_API_BASE+'/fork',{token:RMB_TOKEN_ROOT,dst_token: RMB_TOKEN_NAME+"_"+user_id.split('_')[1]})
    }
       
    let obj = {ret:true,msg:'success',rmb}
    return res.json(obj)
}

/**
 * 查询用户的accout资料。
 * @type {queryAccountInfo}
 */
window.user_c.queryAccountInfo =queryAccountInfo;
async function queryAccountInfo(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    //校验key和random
    let str = await user_redis.get(ll_config.redis_key+":queryAccountInfo:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":queryAccountInfo:"+user_id+random,random,120)

    let {cashout_rmb_id} = await cashout_c.s_queryUserCashoutID(user_id)

    //批量查询用户帐户信息
    let rmb = 0, vipInfo = null, gsb = 0,pcashInfo = null,score =0,userInfo = null ,vip_used_num=0,userObjList = [],cashout_rmb = 0;
    await Promise.all([
        rpc_query(VIP_API_BASE+'/chain/opcode',{token:VIP_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1}),
        rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        rpc_query(GSB_API_BASE+'/chain/opcode',{token:GSB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        null,// rpc_query(PCASH_API_BASE+'/chain/opcode',{token:PCASH_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1}),
        rpc_query(SCORE_API_BASE+'/chain/opcode',{token:SCORE_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1}),

        rpc_query(MSG_API_BASE+'/chain/opcode',{token:MSG_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1}),
        shop_c.s_queryVipUsedNum(user_id),
        // rpc_query(OBJ_API_BASE+"/chain/opcode",{token:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
        shop_c.s_queryMyShops(user_id,0,100000),
        rpc_query(RMB_API_BASE+'/chain/opcode',{token:cashout_rmb_id,opcode:'send',begin:0,len:1}),
        ]
    ).then(async function(rets)
    {
        if(rets[0] && rets[0].ret)
        {
            vipInfo = JSON.parse(JSON.parse(rets[0] .list[0].txjson).opval)
            vipInfo.vip_timeout_str = str_filter.GetDateTimeFormat(vipInfo.vip_timeout)
        }else {
            rpc_query(VIP_API_BASE+'/fork',{token:VIP_TOKEN_ROOT,dst_token: VIP_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }
        if(rets[1] && rets[1].ret)
        {
            rmb = JSON.parse(rets[1].list[0].txjson).token_state * 1;
        }else {
            //创建一个人民币帐户
            rpc_query(RMB_API_BASE+'/fork',{token:RMB_TOKEN_ROOT,dst_token: RMB_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }
        if(rets[2] && rets[2].ret)
        {
            gsb = JSON.parse(rets[2].list[0].txjson).token_state * 1;
        }else {
            //创建一个GSB帐户
            rpc_query(GSB_API_BASE+'/fork',{token:GSB_TOKEN_ROOT,dst_token: GSB_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }
        if(rets[3] && rets[3].ret)
        {
            pcashInfo = JSON.parse(JSON.parse(rets[3].list[0].txjson).opval)
        }else{
            //创建一个代金券帐户
            // rpc_query(PCASH_API_BASE+'/fork',{token:PCASH_TOKEN_ROOT,dst_token: PCASH_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }
        if(rets[4] && rets[4].ret)
        {
            score = JSON.parse(rets[4].list[0].txjson).token_state * 1;
        }else{
            //创建一个积分帐户
            rpc_query(SCORE_API_BASE+'/fork',{token:SCORE_TOKEN_ROOT,dst_token: SCORE_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }

        if(!rets[6] || !rets[6].ret)
        {
            rpc_query(MSG_API_BASE+'/fork',{token:MSG_TOKEN_ROOT,dst_token: MSG_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }

        // if(!rets[8] || !rets[8].ret)
        // {
        // }else{
        //     userObjList = JSON.parse(JSON.parse(rets[8].list[0].txjson).opval)
        // }
        vip_used_num = rets[7];
        userObjList = rets[8]
        if(rets[9] && rets[9].ret)
        {
            cashout_rmb = JSON.parse(rets[9].list[0].txjson).token_state * 1;
        }


        if(rets[5] && rets[5].ret)
        {
            userInfo = JSON.parse(JSON.parse(rets[5].list[0].txjson).opval)
            let tmpUserInfo = JSON.parse(JSON.parse(rets[5].list[0].txjson).opval)
            delete userInfo.pwd
            delete userInfo.salt

            if(!userInfo.invite_code)
            {
                //创建一个invite_code
                let inviteForkRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,space:'in',extra_data:user_id})
                if(inviteForkRet && inviteForkRet.ret)
                {
                    userInfo.invite_code = inviteForkRet.token_x.split('_')[1]
                    tmpUserInfo.invite_code = userInfo.invite_code
                    let assertInviteRet  = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:inviteForkRet.token_x,opcode:'assert',
                       opval:JSON.stringify(userInfo), extra_data:user_id})
                    if(!assertInviteRet || !assertInviteRet.ret) return (userInfo.invite_code = null)

                    let assertUserInviteRet  = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:tmpUserInfo.user_id,
                        opcode:'assert', opval:JSON.stringify(tmpUserInfo), extra_data:tmpUserInfo.phone})
                    if(!assertUserInviteRet || !assertUserInviteRet.ret) return (tmpUserInfo.invite_code = null)
                }
            }
        }





    });

    let obj = {rmb, cashout_rmb,vip_info:vipInfo, gsb,pcash_info:pcashInfo,score,user_info:userInfo,
        invite_code:userInfo.invite_code,ret:true,msg:'success',shoplist:userObjList,vip_used_num}
    //fix the bug 2024-4-8
    obj.user_info.user_id = user_id
    return res.json(obj)
}

/**
 * 查询人民币订单流水
 * @type {queryRmbOrders}
 */
window.user_c.queryRmbOrders =queryRmbOrders;
async function queryRmbOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    // let s_str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    // if(!s_str) return res.json({ret:false,msg:"session error"})
    // if(!isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let rmbListRet = await rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_ROOT,opcode:'send',begin:begin*len,len:len})
    if(rmbListRet &&rmbListRet.ret)
    {
        let i =0;
        for(;i<rmbListRet.list.length;i++)
        {
            rmbListRet.list[i].txjson = JSON.parse(rmbListRet.list[i].txjson)
            rmbListRet.list[i].val = rmbListRet.list[i].txjson.token_state
            rmbListRet.list[i].opval = rmbListRet.list[i].txjson.opval
            rmbListRet.list[i].send_val = rmbListRet.list[i].txjson.token_x == RMB_TOKEN_ROOT ? '-'+rmbListRet.list[i].opval : '+'+rmbListRet.list[i].opval;
            // rmbListRet.list[i].recv_val = rmbListRet.list[i].txjson.token_x == userRmbToken ? '' : rmbListRet.list[i].opval;
            try {
                rmbListRet.list[i].txjson.extra_data = JSON.parse(rmbListRet.list[i].txjson.extra_data)
                rmbListRet.list[i].order_name = rmbListRet.list[i].txjson.extra_data.order_name
                rmbListRet.list[i].order_id = rmbListRet.list[i].txjson.extra_data.order_id
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.timestamp_i)
                // rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.extra_data.order_time)
            }catch(ex)
            {
                rmbListRet.list[i].order_name = ''
                rmbListRet.list[i].order_id = rmbListRet.list[i].txjson.extra_data
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.timestamp_i)
            }
        }
        res.json({ret:true,msg:'success',list:rmbListRet.list})
    }
    else{
        res.json({ret:false,msg:'rmb orders is empty'})
    }
}

window.user_c.queryAccountRmbOrders =queryAccountRmbOrders;
async function queryAccountRmbOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let userRmbToken = RMB_TOKEN_NAME+"_"+user_id.split('_')[1]
    let rmbListRet = await rpc_query(RMB_API_BASE+'/chain/opcode',{token:userRmbToken,opcode:'send',begin:begin*len,len:len})
    if(rmbListRet &&rmbListRet.ret)
    {
        let i =0;
        for(;i<rmbListRet.list.length;i++)
        {
            rmbListRet.list[i].txjson = JSON.parse(rmbListRet.list[i].txjson)
            rmbListRet.list[i].val = rmbListRet.list[i].txjson.token_state
            rmbListRet.list[i].opval = rmbListRet.list[i].txjson.opval
            rmbListRet.list[i].send_val = rmbListRet.list[i].txjson.token_x == userRmbToken ? '-'+rmbListRet.list[i].opval : '+'+rmbListRet.list[i].opval;
            // rmbListRet.list[i].recv_val = rmbListRet.list[i].txjson.token_x == userRmbToken ? '' : rmbListRet.list[i].opval;
            try {
                rmbListRet.list[i].txjson.extra_data = JSON.parse(rmbListRet.list[i].txjson.extra_data)
                rmbListRet.list[i].order_name = rmbListRet.list[i].txjson.extra_data.order_name
                rmbListRet.list[i].order_id = rmbListRet.list[i].txjson.extra_data.order_id
                // rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.extra_data.order_time)
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.timestamp_i)
            }catch(ex)
            {
                rmbListRet.list[i].order_name = ''
                rmbListRet.list[i].order_id = rmbListRet.list[i].txjson.extra_data
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.timestamp_i)
            }
        }
        res.json({ret:true,msg:'success',list:rmbListRet.list})
    }
    else{
        res.json({ret:false,msg:'rmb order is empty'})
    }
}

/**
 * 查询邀请了哪些用户等。
 * @type {queryAccountInviteUsers}
 */
window.user_c.queryAccountInviteUsers =queryAccountInviteUsers;
async function queryAccountInviteUsers(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let userAssertRet  = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!userAssertRet || !userAssertRet.ret) return res.json({ret:false,msg:"query user-info error"})

    let invite_code = JSON.parse(JSON.parse(userAssertRet.list[0].txjson).opval).invite_code
    if(!invite_code) return res.json({ret:false,msg:"user-info-invite-code error"})

    let orderToken = ORDER_TOKEN_NAME+"_"+invite_code

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:orderToken,opcode:'send',begin:begin*len,len:len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].txjson.opval =  JSON.parse(listRet.list[i].txjson.opval)
            //时间，用户名，奖励数额
            listRet.list[i].user_name = listRet.list[i].txjson.opval.user_name+'（'+listRet.list[i].txjson.opval.phone.substring(0,5)+'****'+listRet.list[i].txjson.opval.phone.substring(9,11)+'）'
            listRet.list[i].invite_time = str_filter.GetDateTimeFormat(listRet.list[i].txjson.opval.invite_time)
            listRet.list[i].gsb = listRet.list[i].txjson.opval.gsb ? listRet.list[i].txjson.opval.gsb: 0
            listRet.list[i].rmb = listRet.list[i].txjson.opval.rmb ? listRet.list[i].txjson.opval.rmb: 0
            listRet.list[i].invite_order_name = listRet.list[i].txjson.opval.invite_order_name ? listRet.list[i].txjson.opval.invite_order_name: ''
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'invite-list is empty'})
    }
}

/**
 * 查询系统消息。
 * @type {querySysMsg}
 */
window.user_c.querySysMsg =querySysMsg;
async function querySysMsg(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let userMsgToken = MSG_TOKEN_NAME+"_"+user_id.split('_')[1]
    let listRet = await rpc_query(MSG_API_BASE+'/chain/opcode',{token:userMsgToken,opcode:'send',begin:begin*len,len:len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            let senderIsMe = listRet.list[i].txjson.token_x == userMsgToken
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].opval = listRet.list[i].txjson.opval
            listRet.list[i].send_time = str_filter.GetDateTimeFormat(listRet.list[i].txjson.timestamp_i)
            listRet.list[i].msg_userid = senderIsMe ? listRet.list[i].txjson.token_y : listRet.list[i].txjson.token_x
            listRet.list[i].user_name = listRet.list[i].msg_userid == MSG_TOKEN_ROOT ? '[系统消息]':'[用户消息]'
            listRet.list[i].sender_isme = senderIsMe
            listRet.list[i].send_kind = senderIsMe ?'发送':'接收'
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'sysmsg is empty'})
    }
}


/**
 * 查询用户订单清单。
 * @type {queryOrders}
 */
window.user_c.queryOrders =queryOrders;
async function queryOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let userOrderToken = ORDER_TOKEN_NAME+"_"+user_id.split('_')[1]
    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userOrderToken,opcode:'send',begin:begin*len,len:len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].orderInfo = JSON.parse(listRet.list[i].txjson.opval)

            listRet.list[i].order_id = listRet.list[i].orderInfo.order_id
            listRet.list[i].order_name = listRet.list[i].orderInfo.order_name
            listRet.list[i].order_time = str_filter.GetDateTimeFormat(listRet.list[i].orderInfo.order_time)
            listRet.list[i].pay_time = str_filter.GetDateTimeFormat(listRet.list[i].orderInfo.pay_time)
            listRet.list[i].pay_type = listRet.list[i].orderInfo.pay_type =='rmb'?'余额支付':(listRet.list[i].orderInfo.pay_type =='vip'?'会员特权':'其它')
            listRet.list[i].order_price = listRet.list[i].orderInfo.price
            listRet.list[i].pay_money= listRet.list[i].orderInfo.pay_money_real?listRet.list[i].orderInfo.pay_money_real:listRet.list[i].orderInfo.pay_money

            delete listRet.list[i].txjson
            delete listRet.list[i].orderInfo
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'orderlist is empty'})
    }
}

/**
 * 查询认证的申请纪录
 * @type {queryUserRoleOrders}
 */
window.user_c.queryUserRoleOrders =queryUserRoleOrders;
async function queryUserRoleOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    //查询用户资料，看是否已经有rold_order_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.role_order_id)
    {
        return res.json({ret: false, msg: "user-bind-role-list is empty"});
    }

    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userInfo.role_order_id,opcode:'send',begin:begin*len,len:len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].bindInfo = JSON.parse(listRet.list[i].txjson.opval)

            listRet.list[i].tips = listRet.list[i].bindInfo.tips
            listRet.list[i].role_kind = listRet.list[i].bindInfo.role_kind
            listRet.list[i].role_name = listRet.list[i].bindInfo.role_name
            listRet.list[i].bind_time = str_filter.GetDateTimeFormat(listRet.list[i].txjson.timestamp_i)

            listRet.list[i].paper_kind = listRet.list[i].bindInfo.paper_kind
            listRet.list[i].paper_code = listRet.list[i].bindInfo.paper_code
            listRet.list[i].filename = listRet.list[i].bindInfo.filename

            delete listRet.list[i].txjson
            delete listRet.list[i].bindInfo
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-bind-role-list is empty'})
    }
}


/**
 * 查询GSB清单 。
 * @type {queryAccountGsbOrders}
 */
window.user_c.queryAccountGsbOrders =queryAccountGsbOrders;
async function queryAccountGsbOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let userGSBToken = GSB_TOKEN_NAME+"_"+user_id.split('_')[1]
    let list = await rpc_query(GSB_API_BASE+'/chain/opcode',{token:userGSBToken,opcode:'send',begin:begin*len,len:len})
    if(list &&list.ret)
    {
        let i =0;
        for(;i<list.list.length;i++)
        {
            list.list[i].txjson = JSON.parse(list.list[i].txjson)
            list.list[i].val = list.list[i].txjson.token_state
            list.list[i].opval = list.list[i].txjson.opval
            list.list[i].send_val = list.list[i].txjson.token_x == userGSBToken ? '-'+list.list[i].opval : '+'+list.list[i].opval;
            // rmbListRet.list[i].recv_val = rmbListRet.list[i].txjson.token_x == userRmbToken ? '' : rmbListRet.list[i].opval;
            try {
                list.list[i].txjson.extra_data = JSON.parse(list.list[i].txjson.extra_data)
                list.list[i].order_name = list.list[i].txjson.extra_data.order_name
                list.list[i].order_id = list.list[i].txjson.extra_data.order_id
                // list.list[i].order_time = str_filter.GetDateTimeFormat(list.list[i].txjson.extra_data.buy_time)
                list.list[i].order_time = str_filter.GetDateTimeFormat(list.list[i].txjson.timestamp_i)
            }catch(ex)
            {
                list.list[i].order_name = ''
                list.list[i].order_id = list.list[i].txjson.extra_data
                list.list[i].order_time = str_filter.GetDateTimeFormat(list.list[i].txjson.timestamp_i)
            }
        }
        res.json({ret:true,msg:'success',list:list.list})
    }
    else{
        res.json({ret:false,msg:'gsb order is empty'})
    }
}

//---------------------------------------------------------------用户签到。
/**
 * 得到签到的列表。
 */
window.user_c.queryAccountSignedOrders =queryAccountSignedOrders;
async function queryAccountSignedOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let userGSBInfo = await s_querySignListIDS(user_id);
    let userSignToken = userGSBInfo.sign_list_id;

    let list = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userSignToken,opcode:'send',begin:begin*len,len:len})
    if(list &&list.ret)
    {
        let i =0;
        for(;i<list.list.length;i++)
        {
            list.list[i].txjson = JSON.parse(list.list[i].txjson)
            list.list[i].signinfo = JSON.parse(list.list[i].txjson.opval)
            list.list[i].sign_time = str_filter.GetDateTimeFormat(list.list[i].txjson.timestamp_i)
            list.list[i].sign_date = list.list[i].signinfo.sign_date
            list.list[i].sign_score = list.list[i].signinfo.sign_score
            list.list[i].signed_days = list.list[i].signinfo.signed_days//连续签到天数。
            delete list.list[i].txjson
        }
        res.json({ret:true,msg:'success',list:list.list})
    }
    else{
        res.json({ret:false,msg:'list is empty'})
    }
}


/**
 * 得到gsb-list-ids
 * @type {s_queryGSBListIDS}
 */
window.user_c.s_querySignListIDS =s_querySignListIDS;
async function s_querySignListIDS(user_id) {
    let gsbUserId = GSB_TOKEN_NAME+'_'+user_id.split('_')[1]

    let userInfoRet = await rpc_query(GSB_API_BASE+'/chain/opcode',{token:gsbUserId,opcode:'config',begin:0,len:1})
    let userGSBInfo = userInfoRet&&userInfoRet.ret ? JSON.parse(JSON.parse(userInfoRet.list[0].txjson).opval):{}


    let update_flag = false;
    if(!userGSBInfo.sign_list_id)
    {
        let forkRet = await rpc_query(ORDER_API_BASE + '/fork', {token: ORDER_TOKEN_ROOT,space:'signlist'})
        if(!forkRet || !forkRet.ret) return null;

        userGSBInfo.sign_list_id = forkRet.token_x;
        update_flag = true;
    }

    if(update_flag)
    {
        let assertOBJRet = await rpc_query(GSB_API_BASE+'/op',{token_x:GSB_TOKEN_ROOT,token_y:gsbUserId,opcode:'config',
            opval:JSON.stringify(userGSBInfo),extra_data: gsbUserId})
        if(!assertOBJRet || !assertOBJRet.ret) return null;
    }

    return userGSBInfo;
}

/**
 * 连续签到的天数。
 * @type {s_querySignedSerialDays}
 */
window.user_c.s_querySignedSerialDays =s_querySignedSerialDays;
async function s_querySignedSerialDays(sign_list_id,ischeck) {

    let userSignToken = sign_list_id;
    let nowTime = parseInt(new Date().getTime()/1000)
    let nowDate = str_filter.GetDateTimeFormat(nowTime).substring(0,10);

    let listRet = await rpc_query(ORDER_API_BASE+'/chain/opcode',{token:userSignToken,opcode:'send',begin:0,len:1000})
    console.log('signed-listRet:'+JSON.stringify(listRet))
    if(listRet &&listRet.ret && listRet.list.length>0){

        let lastSignInfo = JSON.parse(JSON.parse(listRet.list[0].txjson).opval)
        let signedDate = str_filter.GetDateTimeFormat(lastSignInfo.sign_time).substring(0,10);
        let lastDate = str_filter.GetDateTimeFormat(nowTime-24*60*60).substring(0,10)

        let compareTime = ischeck ? nowTime : nowTime-24*60*60

        console.log('signedDate:'+signedDate)
        if(ischeck && signedDate!=nowDate)
        {
            return 0;
        }

        //如果是签到动作接口查询，signedDate不是昨天的话，明天就是连续签到天数为0了。
        if(!ischeck && signedDate!=lastDate)
        {
            return 0//res.json({ret: false, msg: "user already signed"})
        }

        let cnt= 1
        for(let i=1;i<listRet.list.length;i++)
        {
            let compareDate = str_filter.GetDateTimeFormat(compareTime).substring(0,10)
            let lastSignInfo = JSON.parse(JSON.parse(listRet.list[i].txjson).opval)
            let subSignedDate = str_filter.GetDateTimeFormat(lastSignInfo.sign_time).substring(0,10);

            if(compareDate!=subSignedDate)
            {
                break;//res.json({ret: false, msg: "user already signed"})
            }
            compareTime = compareTime-60*60*24
            cnt++
        }

        return cnt;
    }

    return 0;
}

/**
 * 判断连续签到的天数。
 * @type {checkUserTodaySigned}
 */
window.user_c.checkUserTodaySigned =checkUserTodaySigned;
async function checkUserTodaySigned(req, res) {
    let {user_id, s_id, shop_id, random, sign} = str_filter.get_req_data(req);


    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})

    let userGSBInfo = await s_querySignListIDS(user_id);
    let cnt = await s_querySignedSerialDays(userGSBInfo.sign_list_id,true)
    res.json({ret:true,msg:'success',signed_days:cnt})
}
/**
 * 今天签到。
 * @type {userSignToday}
 */
window.user_c.userSignToday =userSignToday;
async function userSignToday(req, res) {
    //order_id ，pay_type（余额、支付宝、微信、积分、代金券、会员特权）,pay_type_id（例如代金券id）
    let {user_id, s_id,shop_id, random, sign} = str_filter.get_req_data(req);

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":userSignToday:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":userSignToday:"+user_id+random,random,120)

    //锁定签到处理（特别是支付特权等）----使用redis加lock操作。
    let orderTime = await user_redis.get(ll_config.redis_key+":userSignToday_lock:"+user_id)
    if(orderTime && parseInt(new Date().getTime()/1000) - orderTime <120)
    {
        return res.json({ret: false, msg: "sign is locked failed"});
    }
    user_redis.set(ll_config.redis_key+":userSignToday_lock:"+user_id,parseInt(new Date().getTime()/1000) ,120)

    let userGSBInfo = await s_querySignListIDS(user_id);
    let userSignToken = userGSBInfo.sign_list_id;
    let nowTime = parseInt(new Date().getTime()/1000)
    let nowDate = str_filter.GetDateTimeFormat(nowTime).substring(0,10);

    // let listRet = await rpc_query(GSB_API_BASE+'/chain/opcode',{token:userSignToken,opcode:'send',begin:0,len:1})
    // if(listRet &&listRet.ret ){
    //     let lastSignInfo = JSON.parse(JSON.parse(listRet.list[0].txjson).opval)
    //     let signedDate = str_filter.GetDateTimeFormat(lastSignInfo.sign_time).substring(0,10);
    //     if(nowDate==signedDate)
    //     {
    //         return res.json({ret: false, msg: "user already signed"})
    //     }
    // }
    if(await s_querySignedSerialDays(userSignToken,true)>0)
    {
        return res.json({ret: false, msg: "user already signed"})
    }

    let signScore = 10;
    let signed_days = await s_querySignedSerialDays(userSignToken,false)
    let shopInfo = null;
    //如果是商铺用户，获得商铺的积分奖励细则。
    if(!shop_id)
    {
        //查询shop_info;
        let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: shop_id, opcode: 'assert', begin: 0, len: 1})
        if (assertInfoRet && assertInfoRet.ret){
            shopInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval);
            if(shopInfo.sign_score)
            {
                shopInfo.signed_days_score = shopInfo.signed_days_score?shopInfo.signed_days_score:0
                signScore = shopInfo.sign_score + signed_days *shopInfo.signed_days_score;
            }
        }else{
            return res.json({ret: false, msg: "shopInfo is empty"})
        }
    }

    //保存签到的相关情况。
    signed_days+=1;
    let signedInfo = {sign_time:nowTime,sign_date:nowDate,user_id,sign_score:signScore,signed_days};
    if(shopInfo)
    {
        signedInfo.shop_sign_info = {sign_score:shopInfo.sign_score ,signed_days_score:shopInfo.signed_days_score};
    }

    let sendGSBRet = await rpc_query(GSB_API_BASE+'/send',{token_x:GSB_TOKEN_ROOT,token_y:GSB_TOKEN_NAME+'_'+user_id.split('_')[1],
        opval:signScore,extra_data:JSON.stringify(signedInfo)})
    if(!sendGSBRet && !sendGSBRet.ret) return res.json({ret: false, msg: "get sign-score failed"})

    let sendRet = await rpc_query(ORDER_API_BASE+'/send',{token_x:ORDER_TOKEN_ROOT,token_y:userSignToken,
        opval:JSON.stringify(signedInfo),extra_data:user_id})

    if(!sendRet && !sendRet.ret) return res.json({ret: false, msg: "save signedInfo failed"})
    signedInfo.ret =true;
    signedInfo.msg='success';
    res.json(signedInfo)
}
