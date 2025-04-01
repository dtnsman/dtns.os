/**
 * Created by lauo.li on 2019/3/21.
 */
var fs = require("fs");

const str_filter = require('../libs/str_filter');
const gnode_format_util = require('../libs/gnode_format_util');
const notice_util = require('../libs/notice_util');
const huawei_notice_util = require('../libs/huawei_notice_util');
const config = require('../config').config;
const user_redis = require('../config').user_redis;
// const order_c = require('./order_c');
const rpc_query = require('../rpc_api_config').rpc_query
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME,
    SMS_API_BASE,SMS_TOKEN_ROOT,SMS_TOKEN_NAME,} = require('../rpc_api_config')

const rpc_api_util = require('../rpc_api_util');
// const rpc_api_util = rpc_api_util


function get_token_user_name(user_name)
{
    let len = user_name.length;
    if(len>0) return USER_TOKEN_ROOT.substring((USER_TOKEN_NAME+"_").length+len,USER_TOKEN_ROOT.length)+user_name
    return user_name;
}


//以下bindDevice仅在DTNS连接下才可用（亦即ll-con-kmm账户下，roomid=dtns或者dtns-inner-room）
module.exports.bindDevice = bindDevice
async function bindDevice(req,res)
{
    let {phoneHash,deviceName,sign,sign2,phoneEnInfo,public_key,web3name,invite_code} = str_filter.get_req_data(req)
    console.log(phoneHash,deviceName,sign,phoneEnInfo,public_key,web3name,invite_code)
    web3name = !web3name ? 'dtns':web3name
    //#0 先行验证
    let deviceHash = await eccryptoJS.sha256(eccryptoJS.utf8ToBuffer(deviceName))
    console.log('deviceHash',deviceHash,deviceHash.length)
    let recoverKey = await eccryptoJS.recover(deviceHash,key_util.bs58Decode(sign),true)
    recoverKey = key_util.bs58Encode(recoverKey)
    let recoverKey2 = sign2 ? await eccryptoJS.recover(deviceHash,key_util.bs58Decode(sign2),true):null
    recoverKey2 =recoverKey2? key_util.bs58Encode(recoverKey2) :null
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
        let invite_code=null
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
    let noticeRet = await sendNotice(obj,'bind_device_notice')
    if(!noticeRet || !noticeRet.ret)
    {
        //延迟10秒,再发一次.
        setTimeout(()=>{
            sendNotice(obj,'bind_device_notice')
        },10000)
    }
}

async function sendNotice(obj,noticeType){
    console.log('into sendNotice:')
    // return false
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

module.exports.loginDevice = loginDevice
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
    if(dtns_device_id.split('_')[1].indexOf(web3name)!=0 && web3name!='dtns')  
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
    user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id,3*24*60*60)//3天超时

    // delete obj.pwd
    // delete obj.salt
    obj.ret = true
    obj.msg = 'success'
    obj.s_id = s_id
    obj.dtns_device_id = dtns_device_id

    res.json(obj)

    //发送通知(登录设备)
    obj.s_id = null //避免使用上述的s_id
    let noticeRet = await sendNotice(obj,'login_device_notice')
    if(!noticeRet || !noticeRet.ret)
    {
        //延迟10秒,再发一次.
        setTimeout(()=>{
            sendNotice(obj,'login_device_notice')
        },10000)
    }
}
/**
 * 发送通知
 */
module.exports.sendWeb3Notice = sendWeb3Notice
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
module.exports.queryWeb3NoticeList = queryWeb3NoticeList
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
module.exports.queryUsersPublicKeys = queryUsersPublicKeys
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
module.exports.setUsersWeb3Keys = setUsersWeb3Keys
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
module.exports.setObjWeb3Key = setObjWeb3Key
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
module.exports.queryObjWeb3Key = queryObjWeb3Key
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
module.exports.queryUserWeb3Key = queryUserWeb3Key
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

module.exports.syncWeb3Keys = syncWeb3Keys
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

module.exports.createWeb3App = createWeb3App
async function createWeb3App(req,res)
{
    let {user_id,s_id,web3name,web3desc} = str_filter.get_req_data(req);

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

    let dtnsUserStates = await rpc_query(DTNS_API_BASE+'/chain/states',{token:dtns_user_id})
    console.log('dtnsUserStates',dtnsUserStates)
    if(!dtnsUserStates || !dtnsUserStates.ret) return res.json({ret:false,msg:'query dtns_user_id token states failed'})
    const public_key = dtnsUserStates.web3_key ? dtnsUserStates.web3_key  :dtnsUserStates.public_key
    
    let setWeb3KeyRet = await rpc_query(DTNS_API_BASE+"/op",
        {token_x:web3_id,token_y:web3_id,opval:public_key,opcode:dtns_config.fsm_config.OP_WEB3_KEY,extra_data:"set web3-key"});
    if(!setWeb3KeyRet || !setWeb3KeyRet.ret) return res.json({ret: false, msg: "set web3_id web3-key failed"})

    let objInfo = {dtns_user_id,web3name,web3desc,public_key,web3_id, create_time_i:parseInt(Date.now()/1000)}
    objInfo.create_time = str_filter.GetDateTimeFormat(objInfo.create_time_i)
    let saveInfoRet = await rpc_api_util.s_save_token_info(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'assert',JSON.stringify(objInfo),dtns_user_id)
    if(!saveInfoRet) return res.json({ret:false,msg:'save web3-obj-info to web3_id failed'})

    //保存关系
    let bindListRet = await rpc_api_util.s_save_into_token_list(DTNS_API_BASE,DTNS_TOKEN_ROOT,web3_id,'relw',dtns_user_id)
    if(!bindListRet) return res.json({ret:false,msg:'bind web3_id to DTNS_TOKEN_ROOT failed'})

    bindListRet = await rpc_api_util.s_save_into_token_list(DTNS_API_BASE,dtns_user_id,web3_id,'relw',dtns_user_id)
    if(!bindListRet) return res.json({ret:false,msg:'bind web3_id to dtns_user_id failed'})

    let bindWeb3IDRet = await rpc_query(DTNS_API_BASE+'/op',
    {token_x:DTNS_TOKEN_ROOT,token_y:DTNS_TOKEN_ROOT,opcode:'map',opval:'add',
    extra_data:JSON.stringify({map_key:'web3:'+web3name,map_value:web3_id})})
    if(!bindWeb3IDRet || !bindWeb3IDRet.ret) return res.json({ret:false,msg:'map web3name to web3_id failed'})

    objInfo.ret = true
    objInfo.msg = 'success'
    res.json(objInfo)
}

module.exports.setWeb3AppPublicKey = setWeb3AppPublicKey
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
module.exports.queryWeb3AppInfo = queryWeb3AppInfo
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
 * 注册用户
 * @type {regist_user}
 *
 *
 */
module.exports.regist_phone_user =regist_phone_user;
async function regist_phone_user(req, res) {
    let {nation_code,phone,sms_code,user_name,pwd,random,sign} = str_filter.get_req_data(req);
    nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;

    if(!user_name || user_name.length<1 || user_name.length>16) return res.json({ret: false, msg: "user_name is error"});
    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!pwd || pwd.length<16) return res.json({ret: false, msg: "pwd is error"});
    if(!sms_code || sms_code.length!=6 || sms_code!=sms_code*1) return res.json({ret: false, msg: "sms_code is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    // 防重放攻击
    let str = await user_redis.get(config.redis_key+":regist_phone_user:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":regist_phone_user:"+phone+random,random,120)

    //校验短信（是否已经存在链上）
    let smsCode = await user_redis.get(config.redis_key+":sms_code:"+phone)
    if(sms_code!=smsCode)  return res.json({ret: false, msg: "sms_code unmatch"});
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
    let obj = {phone,nation_code,user_name,pwd:newPwd,user_id:newAccountRet.token_x,salt,regist_time}

    //默认头像
    obj.logo = 'obj_imgopen2z3hcdR1x'

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:newAccountRet.token_x,opcode:'assert',opval:JSON.stringify(obj),extra_data:phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert phone-info failed"})

    // let assertUserRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:token_user_name,opcode:'assert',opval:JSON.stringify(obj),extra_data:phone});
    // if(!assertUserRet || !assertUserRet.ret) return res.json({ret: false, msg: "assert user_name-info failed"})

    //登记帐户相关信息（在链上）。
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:newAccountRet.token_x});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "regist_user failed"})

    //生成session-id
    let s_id = str_filter.randomBytes(16);
    user_redis.set(config.redis_key+":session:"+newAccountRet.token_x+"-"+s_id,s_id)

    await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:newAccountRet.token_x,opcode:'config',opval:s_id,extra_data:"session"});

    //创建一个人民币帐户
    rpc_query(RMB_API_BASE+'/fork',{token:RMB_TOKEN_ROOT,dst_token: RMB_TOKEN_NAME+"_"+newAccountRet.token_x.split('_')[1]})
        

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = 'success'
    obj.s_id = s_id
    obj.regist_time = str_filter.GetDateTimeFormat(regist_time)

    user_redis.del(config.redis_key+":sms_code:"+phone)
    return res.json(obj)
}















/**
 *  * 查询用户信息---由手机号码查询
 *   * @type {queryUserInfoByPhone}
 *    */
module.exports.queryUserInfoByPhone =queryUserInfoByPhone;
async function queryUserInfoByPhone(req, res) {
    let {user_id,s_id,phone} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!phone) return res.json({ret:false,msg:"phone error"}) 
    
    let phoneInfoRet = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!phoneInfoRet || !phoneInfoRet.ret) return res.json({ret: false, msg: "phone-user un-regist!"});
    let phoneInfo = JSON.parse(JSON.parse(phoneInfoRet.list[0].txjson).opval);

    let dst_user_id = phoneInfo.user_id;
    if(!dst_user_id) return res.json({ret:false,msg:"get phone-user-info's user-id failed"})

    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:dst_user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    obj.ret = true;
    obj.msg = "success"
    delete obj.salt
    delete obj.pwd
    res.json(obj)
}

/**
 * 发送短信。
 * http://127.0.0.1:63000/user/send_sms?phone=18675516875
 * @type {send_sms}
 */
module.exports.send_sms =send_sms;
async function send_sms(req, res) {
    let {nation_code, phone, random, sign} = str_filter.get_req_data(req);
    nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;
	

    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
	
	console.log('phone:'+phone);
	if(phone*1==15767044123 || phone=='15767044123') return res.json({ret: false, msg: "send this phone failed"});

    // if (sign != str_filter.md5("" + nation_code + phone + random)) {
    //     console.log("str:"+("" + nation_code + phone + random)+" md5-val:"+str_filter.md5("" + nation_code + phone + random))
    //     return res.json({ret: false, msg: "sign is error"});
    // }

    // 防重放攻击
    let str = await user_redis.get(config.redis_key+":send_sms:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":send_sms:"+phone+random,random,120)

    //送短信
    let code = str_filter.randomNum(8);
    let flag = await huawei_notice_util.send_sms(nation_code, phone, code);
    console.log("send sms:" + phone + " code:" + code + " flag:" + flag);

    //记录在链上。
    //http://node.opencom.user.c1.forklist.dtns/chain/opcode?token=user_phone18675516875&appid=1001&secret_key=Jcv78NmxiO&begin=0&len=10&opcode=fork
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'fork',begin:0,len:10});
    if(!ret || !ret.ret)
    {
        await rpc_query(USER_API_BASE+"/fork",{token:USER_TOKEN_ROOT,dst_token:USER_TOKEN_NAME+'_phone'+phone,opval:phone});
    }
    await rpc_query(USER_API_BASE+"/send",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+phone,opval:code,extra_data:"sms_code"});

    //存放于redis中(10分钟）
    user_redis.set(config.redis_key+":sms_code:"+phone,code,10*60)
    res.json({ret: flag, msg: flag ? "success" : "send sms failed"})
}

/**
 * 发送安全邮箱以及安全手机的验证码。
 * @type {send_bind_code}
 */
module.exports.send_bind_code =send_bind_code;
async function send_bind_code(req, res) {
    let {user_id,s_id,email, random, sign} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    // 防重放攻击
    let str = await user_redis.get(config.redis_key+":send_bind_code:"+user_id)
    if(str)
    {
        return res.json({ret: false, msg: "send code wait 60s"});
    }
    user_redis.set(config.redis_key+":send_bind_code:"+user_id,user_id,60)

    let email_code = str_filter.randomNum(6);
    let code = str_filter.randomNum(6);

    //查询手机号码
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    let phone = userInfo.phone

    let flag = await notice_util.send_sms(userInfo.nation_code,phone,code)
    if(!flag) return res.json({ret: false, msg: "send sms failed"});

    user_redis.set(config.redis_key+":sms_code:bind:"+phone,code,10*60)

    let emailFlag = await notice_util.send_email(email,'【请查收安全邮箱验证码】您在dtns云绑定安全邮箱','【请查收安全邮箱验证码】您在dtns云绑定安全邮箱，安全验证码为：'+email_code)
    if(!emailFlag) return res.json({ret: false, msg: "send email failed"});

    user_redis.set(config.redis_key+":sms_code:bind:"+email,email_code,10*60)

    console.log("email_code:"+email_code)
    console.log("code:"+code)

    return res.json({ret: true, msg: "success",email})
}

/**
 *
 * @type {bind_role}
 */
module.exports.bind_role =bind_role;
async function bind_role(req, res) {
    let {phone,user_id,s_id,role_kind,role_name,paper_kind,paper_code,code,filename, random, sign} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    if(!role_kind)  return res.json({ret:false,msg:"role_kind error"})
    if(!role_name || role_name.length<2)  return res.json({ret:false,msg:"role_name error"})
    if(!paper_kind)  return res.json({ret:false,msg:"paper_kind error"})
    if(!paper_code || paper_code.length<8)  return res.json({ret:false,msg:"paper_code error"})

    //校验短信（是否已经存在链上）
    let smsCode = await user_redis.get(config.redis_key+":sms_code:"+phone)
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
    if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send role-order-info to allorder failed"});

    notice_util.send_email('251499600@qq.com','【dtns云】有新的认证用户申请认证','认证内容为：'+
        JSON.stringify(obj)+'<img src="https://cloud.forklist.dtns/image/view?filename='+filename+
        '" width="100%" height="100%">处理链接为：<a href="http://cloud.forklist.dtns/user/role/bind_success?order_id='+userInfo.role_order_id+'">审核通过</a>')

    notice_util.send_sms(86,18675516875,'【dtns云】有新的认证用户申请认证'+'认证内容为：'+
        JSON.stringify(obj)+'<img src="https://cloud.forklist.dtns/image/view?filename='+filename+'" width="100%" height="100%">处理链接为：<a href="http://cloud.forklist.dtns/user/role/bind_success?order_id='+userInfo.role_order_id+'">审核通过</a>')

    user_redis.del(config.redis_key+":sms_code:"+phone)

    return res.json({ret:true,msg:'success'})
}


/**
 * 绑定安全邮箱
 * @type {bind_email}
 */
module.exports.bind_email =bind_email
async function bind_email(req, res) {

    let {user_id,s_id,email, email_code,code,random, sign} = str_filter.get_req_data(req);

    let ustr = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!ustr) return res.json({ret:false,msg:"session error"})

    if(!email) return res.json({ret:false,msg:"email error"})
    if(!email_code) return res.json({ret:false,msg:"email_code error"})
    if(!code) return res.json({ret:false,msg:"code error"})

    // 防重放攻击
    let str = await user_redis.get(config.redis_key+":send_bind_code:"+email+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":send_bind_code:"+email+random,random,120)

    //查询手机号码
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    let phone = userInfo.phone


    let email_codeStr = await user_redis.get(config.redis_key+":sms_code:bind:"+email)
    let phone_codeStr = await user_redis.get(config.redis_key+":sms_code:bind:"+phone)

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

    user_redis.del(config.redis_key+":sms_code:bind:"+email)
    user_redis.del(config.redis_key+":sms_code:bind:"+phone)
    return res.json({ret: true, msg: "success",email})
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
    obj.gsb = 100 //奖励的数值
    obj.invite_time = parseInt(new Date().getTime()/1000)
    obj.invite_order_name = '首次注册奖励100 GSB'
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
    console.log("send GSB success ");

    //发送消息纪录
    rpc_query(MSG_API_BASE+"/send",{token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_NAME+"_"+userTokenID,opval:'成功邀请用户（'+userInfo.user_name+"），获得100 GSB奖励",
        extra_data:JSON.stringify(obj)});
}

/**
 * 登录手机，由短信。
 * @type {login_user_sms}
 */
module.exports.login_user_sms =login_user_sms;
async function login_user_sms(req, res) {
    let {nation_code,phone,sms_code,random} = str_filter.get_req_data(req);
    nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;

    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!sms_code || sms_code.length!=6 || sms_code!=sms_code*1) return res.json({ret: false, msg: "sms_code is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    // //防重放攻击
    let str = await user_redis.get(config.redis_key+":login_user_sms:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":login_user_sms:"+phone+random,random,120)

    //校验手机号码和短信（是否已经存在链上）
    let smsStr = await user_redis.get(config.redis_key+":sms_code:"+phone)
    if(!smsStr) res.json({ret: false, msg: "sms_code unmatch"});

    //查询帐户信息
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "phone unregist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    //生成session-id，将session-id存在链上和redis上。
    //生成session-id
    let s_id = str_filter.randomBytes(16);
    user_redis.set(config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id)

    rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'config',opval:s_id,extra_data:"session"});

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"
    obj.s_id = s_id

    user_redis.del(config.redis_key+":sms_code:"+phone)

    return res.json(obj)
}

/**
 * 登录帐户（靠密码）
 * @type {login_user_pwd}
 */
module.exports.login_user_pwd =login_user_pwd;
async function login_user_pwd(req, res) {
    let {nation_code,phone,pwd,random} = str_filter.get_req_data(req);

    // nation_code = notice_util.check_nation_code(nation_code) == null ? 86 : nation_code;
    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!pwd ) return res.json({ret: false, msg: "pwd is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    //防重放攻击
    let str = await user_redis.get(config.redis_key+":login_user_pwd:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":login_user_pwd:"+phone+random,random,120)

    //查询帐户信息
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "phone unregist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(str_filter.md5(pwd+obj.salt)!=obj.pwd)  return res.json({ret: false, msg: "pwd error"});
    //生成session-id，将session-id存在链上和redis上。
    //生成session-id
    let s_id = str_filter.randomBytes(16);
    user_redis.set(config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id)

    rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'config',opval:s_id,extra_data:"session"});

    delete obj.pwd
    delete obj.salt

    obj.regist_time = obj.regist_time ? str_filter.GetDateTimeFormat(obj.regist_time) : null;
    if(!obj.regist_time) delete obj.regist_time;

    obj.ret = true;
    obj.msg = "success"
    obj.s_id = s_id

    //查询用户帐户信息
    let rmb = 0;

    let sendInfoRet = await rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_NAME+"_"+obj.user_id.split('_')[1],opcode:'send',begin:0,len:1})
    if(sendInfoRet && sendInfoRet.ret){
        rmb = JSON.parse(sendInfoRet.list[0].txjson).token_state * 1;
    }else {
        //创建一个人民币帐户
        rpc_query(RMB_API_BASE+'/fork',{token:RMB_TOKEN_ROOT,dst_token: RMB_TOKEN_NAME+"_"+obj.user_id.split('_')[1]})
    }

    obj.rmb = rmb

    return res.json(obj)
}

/**
 * 修改用户密码--通过手机号码和短信
 * @type {modify_user_pwd}
 */
module.exports.modify_user_pwd_sms =modify_user_pwd_sms;
async function modify_user_pwd_sms(req, res) {
    let {nation_code,phone,sms_code,random,pwd} = str_filter.get_req_data(req);
    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});
    if(!pwd ) return res.json({ret: false, msg: "pwd is error"});
    if(!sms_code || sms_code.length!=6 || sms_code!=sms_code*1) return res.json({ret: false, msg: "sms_code is error"});
    if(!random ) return res.json({ret: false, msg: "random is error"});

    //校验key和random
    let str = await user_redis.get(config.redis_key+":modify_phone_user_pwd:"+phone+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":modify_phone_user_pwd:"+phone+random,random,120)

    //校验手机号码和短信（是否已经存在链上）
    let smsStr = await user_redis.get(config.redis_key+":sms_code:"+phone)
    // if(!smsStr) return res.json({ret: false, msg: "sms_code unmatch"});

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

    user_redis.del(config.redis_key+":sms_code:"+phone)

    return res.json({ret:true,msg:"success"})
}

/**
 * 查询用户信息。
 * @type {queryUserInfo}
 */
module.exports.queryUserInfo =queryUserInfo;
async function queryUserInfo(req, res) {
    let {user_id,s_id,dst_user_id} = str_filter.get_req_data(req);
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!dst_user_id) return res.json({ret:false,msg:"dst_user_id error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:dst_user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let is_contact = await rpc_api_util.s_check_token_list_related(USER_API_BASE,user_id,dst_user_id,'relm');

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
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
 module.exports.s_queryUserInfo =s_queryUserInfo;
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
 * 修改链上资料
 * @type {modifyUserInfo}
 */
module.exports.modifyUserInfo =modifyUserInfo;
async function modifyUserInfo(req, res) {
    let {user_id,s_id,user_name} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!user_name || user_name.length<2 || user_name.length>16) return res.json({ret:false,msg:"user_name error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(obj.user_name == user_name) return res.json({ret: false, msg: "new-name equal old-name!"});
    obj.user_name = user_name;

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    //登记帐户相关信息（在链上）。
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    return res.json(obj)
}

/**
 * 修改用户介绍
 * @type {modifyUserDesc}
 */
module.exports.modifyUserDesc =modifyUserDesc;
async function modifyUserDesc(req, res) {
    let {user_id,s_id,desc} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!desc) return res.json({ret:false,msg:"desc error"})

    //查询链上资料
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    if(obj.desc == desc) return res.json({ret: false, msg: "new-name equal old-name!"});
    obj.desc = desc;

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    //登记帐户相关信息（在链上）。
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    return res.json(obj)
}
 

/**
 * 修改用户资料（内部调用函数）
 */
module.exports.s_modifyUserInfo =s_modifyUserInfo;
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

    // let assertNameRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:str_filter.create_token_name_last(USER_TOKEN_ROOT,obj.user_name),
    //     opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    // if(!assertNameRet || !assertNameRet.ret)
    // {
    //     console.log(JSON.stringify({ret: false, msg: "assert name-info failed"}))
    //     return false;
    // }

    return true
}

/**
 * http://127.0.0.1:63000/user/send_email?email=251499600@qq.com&subject=test-email-code&content=codeis355535
 * @type {send_email}
 */
module.exports.send_email =send_email;
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
 * 查询用户的账户余额。
 * @type {queryAccountRmb}
 */
module.exports.queryAccountRmb =queryAccountRmb;
async function queryAccountRmb(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    //校验key和random
    let str = await user_redis.get(config.redis_key+":queryAccountRmb:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":queryAccountRmb:"+user_id+random,random,120)

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
module.exports.queryAccountInfo =queryAccountInfo;
async function queryAccountInfo(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    //校验key和random
    let str = await user_redis.get(config.redis_key+":queryAccountInfo:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":queryAccountInfo:"+user_id+random,random,120)

    //批量查询用户帐户信息
    let rmb = 0,sms=0, vipInfo = null, gsb = 0,pcashInfo = null,score =0,userInfo = null ,gnode_used_num=0;
    await Promise.all([
        // rpc_query(VIP_API_BASE+'/chain/opcode',{token:VIP_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1}),
        rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        // rpc_query(GSB_API_BASE+'/chain/opcode',{token:GSB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        // rpc_query(PCASH_API_BASE+'/chain/opcode',{token:PCASH_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'assert',begin:0,len:1}),
        // rpc_query(SCORE_API_BASE+'/chain/opcode',{token:SCORE_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1}),

        // rpc_query(MSG_API_BASE+'/chain/opcode',{token:MSG_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1}),
        // order_c.s_queryVipGnodeUsedNum(user_id),
        // rpc_query(SMS_API_BASE+'/chain/opcode',{token:SMS_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'send',begin:0,len:1}),
        rpc_query(RMB_API_BASE+'/chain/opcode',{token:RMB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1}),
        // rpc_query(GSB_API_BASE+'/chain/opcode',{token:GSB_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1}),
        // rpc_query(PCASH_API_BASE+'/chain/opcode',{token:PCASH_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1}),
        // rpc_query(SCORE_API_BASE+'/chain/opcode',{token:SCORE_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1}),
        ]
    ).then(async function(rets)
    {
        // if(rets[0] && rets[0].ret)
        // {
        //     vipInfo = JSON.parse(JSON.parse(rets[0] .list[0].txjson).opval)
        //     vipInfo.vip_timeout_str = str_filter.GetDateTimeFormat(vipInfo.vip_timeout)
        // }else {
        //     rpc_query(VIP_API_BASE+'/fork',{token:VIP_TOKEN_ROOT,dst_token: VIP_TOKEN_NAME+"_"+user_id.split('_')[1]})
        // }
        if(rets[0] && rets[0].ret)
        {
            rmb = JSON.parse(rets[0].list[0].txjson).token_state * 1;
        }else {
            //创建一个人民币帐户
            rpc_query(RMB_API_BASE+'/fork',{token:RMB_TOKEN_ROOT,dst_token: RMB_TOKEN_NAME+"_"+user_id.split('_')[1]})
        }
        // if(rets[2] && rets[2].ret)
        // {
        //     gsb = JSON.parse(rets[2].list[0].txjson).token_state * 1;
        // }else {
        //     //创建一个GSB帐户
        //     rpc_query(GSB_API_BASE+'/fork',{token:GSB_TOKEN_ROOT,dst_token: GSB_TOKEN_NAME+"_"+user_id.split('_')[1]})
        // }
        // if(rets[3] && rets[3].ret)
        // {
        //     pcashInfo = JSON.parse(JSON.parse(rets[3].list[0].txjson).opval)
        // }else{
        //     //创建一个代金券帐户
        //     rpc_query(PCASH_API_BASE+'/fork',{token:PCASH_TOKEN_ROOT,dst_token: PCASH_TOKEN_NAME+"_"+user_id.split('_')[1]})
        // }
        // if(rets[4] && rets[4].ret)
        // {
        //     score = JSON.parse(rets[4].list[0].txjson).token_state * 1;
        // }else{
        //     //创建一个积分帐户
        //     rpc_query(SCORE_API_BASE+'/fork',{token:SCORE_TOKEN_ROOT,dst_token: SCORE_TOKEN_NAME+"_"+user_id.split('_')[1]})
        // }

        // if(!rets[6] || !rets[6].ret)
        // {
        //     rpc_query(MSG_API_BASE+'/fork',{token:MSG_TOKEN_ROOT,dst_token: MSG_TOKEN_NAME+"_"+user_id.split('_')[1]})
        // }

        if(rets[1] && rets[1].ret)
        {
            userInfo = JSON.parse(JSON.parse(rets[1].list[0].txjson).opval)
            let tmpUserInfo = JSON.parse(JSON.parse(rets[1].list[0].txjson).opval)
            delete userInfo.pwd
            delete userInfo.salt

            // if(!userInfo.invite_code)
            // {
            //     //创建一个invite_code
            //     let inviteForkRet = await rpc_query(ORDER_API_BASE+'/fork',{token:ORDER_TOKEN_ROOT,space:'in',extra_data:user_id})
            //     if(inviteForkRet && inviteForkRet.ret)
            //     {
            //         userInfo.invite_code = inviteForkRet.token_x.split('_')[1]
            //         tmpUserInfo.invite_code = userInfo.invite_code
            //         let assertInviteRet  = await rpc_query(ORDER_API_BASE+'/op',{token_x:ORDER_TOKEN_ROOT,token_y:inviteForkRet.token_x,opcode:'assert',
            //             opval:JSON.stringify(userInfo), extra_data:user_id})
            //         if(!assertInviteRet || !assertInviteRet.ret) return (userInfo.invite_code = null)

            //         let assertUserInviteRet  = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:tmpUserInfo.user_id,
            //             opcode:'assert', opval:JSON.stringify(tmpUserInfo), extra_data:tmpUserInfo.phone})
            //         if(!assertUserInviteRet || !assertUserInviteRet.ret) return (tmpUserInfo.invite_code = null)
            //     }
            // }
        }

        // gnode_used_num = rets[7];

        // if(rets[8] && rets[8].ret)
        // {
        //     sms = JSON.parse(rets[8].list[0].txjson).token_state * 1;
        // }else {
        //     //创建一个人民币帐户
        //     // rpc_query(SMS_API_BASE+'/fork',{token:SMS_TOKEN_ROOT,dst_token: SMS_TOKEN_NAME+"_"+user_id.split('_')[1]})
        //     // setTimeout(function(){
        //     //     rpc_query(SMS_API_BASE+'/send',{token_x:SMS_TOKEN_ROOT,token_y: SMS_TOKEN_NAME+"_"+user_id.split('_')[1],opval:100,extra_data:'系统赠送短信100条'})
        //     // },1000);
        // }

    });

    let obj = {rmb,user_info:userInfo,ret:true,msg:'success'}
    return res.json(obj)
}


//修改头像
module.exports.modifyUserInfoLogo =modifyUserInfoLogo;
async function modifyUserInfoLogo(req, res) {
    let {user_id,s_id,logo} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!logo || logo.length<16 ) res.json({ret:false,msg:"logo error"})

    
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    
    obj.logo = logo;
    obj.mod_time  = parseInt(new Date().getTime()/1000)

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    return res.json(obj)
}


//修改背景图片
module.exports.modifyUserInfoBg =modifyUserInfoBg;
async function modifyUserInfoBg(req, res) {
    let {user_id,s_id,user_bg} = str_filter.get_req_data(req);

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!user_bg || user_bg.length<16 ) res.json({ret:false,msg:"user_bg error"})

    
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:user_id,opcode:'assert',begin:0,len:1});
    if(!ret || !ret.ret) return res.json({ret: false, msg: "user_id unexist now!"});

    let obj = JSON.parse(JSON.parse(ret.list[0].txjson).opval);
    
    obj.user_bg = user_bg;
    obj.mod_time  = parseInt(new Date().getTime()/1000)

    let assertRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:obj.user_id,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.phone});
    if(!assertRet || !assertRet.ret) return res.json({ret: false, msg: "assert info failed"})

    
    let registRet = await rpc_query(USER_API_BASE+"/op",{token_x:USER_TOKEN_ROOT,token_y:USER_TOKEN_NAME+'_phone'+obj.phone,opcode:'assert',opval:JSON.stringify(obj),extra_data:obj.user_id});
    if(!registRet || !registRet.ret) return res.json({ret: false, msg: "modify phone info failed"})

    delete obj.pwd
    delete obj.salt
    obj.ret = true;
    obj.msg = "success"

    return res.json(obj)
}


/**
 * 所有用户
 * @type {queryAllUser}
 */
module.exports.queryAllUser =queryAllUser;
async function queryAllUser(req, res) {
    let {random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})

    begin = parseInt(begin)
    len = parseInt(len)

    let cnt = 0,now_pos=0, users = [],queryInfoP = [];
    while(true)
    {
        let listRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_ROOT,opcode:'fork',begin:now_pos,len:len})
        if(!listRet || !listRet.ret || !listRet.list) break;

        let i =0, list = listRet.list;
        for(;i<list.length;i++)
        {
            list[i].txjson = JSON.parse(list[i].txjson)

            //判断是否是新创建的user_id
            if(list[i].txjson.token_x.indexOf(USER_TOKEN_NAME+'_phone')!= 0 && list[i].txjson.token_x.indexOf(USER_TOKEN_NAME+'_0000')!= 0)
            {
                if(cnt>=begin && cnt<begin+len)
                {
                    let tmp_id = list[i].txjson.token_x
                    users.push(tmp_id)
                    queryInfoP.push(rpc_api_util.s_query_token_info(USER_API_BASE,tmp_id,'assert'));
                    queryInfoP.push(rpc_api_util.s_query_token_info(VIP_API_BASE,VIP_TOKEN_NAME+'_'+tmp_id.split('_')[1],'assert'));
                }
                cnt++;
            }
        }
        if(cnt>=begin+len) break;
        //游标
        now_pos+=len;
    }
    
    let newObjs = []
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<rets.length;i+=2)
        {
            let newInfo = rets[i]
            if(newInfo)
            {
                delete newInfo.salt
                delete newInfo.pwd
                newInfo.user_id = users[parseInt(i/2)]
            //  newInfo.vip_level = 0;
                newObjs.push(newInfo)
            }else{
                newObjs.push({user_id:users[i],user_name:''})
            }

        //  let vipInfo = rets[i+1]
        //  if(vipInfo)
        //  {
        //      newInfo.vip_level = vipInfo.vip_level
        //      newInfo.vip_timeout = vipInfo.vip_timeout
        //  }
        }
    })
    return res.json({ret:true,msg:'success',list:newObjs})
}


module.exports.queryAccountRmbOrders =queryAccountRmbOrders;
async function queryAccountRmbOrders(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
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
                rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.timestamp_i)
                // rmbListRet.list[i].order_time = str_filter.GetDateTimeFormat(rmbListRet.list[i].txjson.extra_data.order_time)
                if(rmbListRet.list[i].txjson.extra_data.send_node){
                    rmbListRet.list[i].order_name = rmbListRet.list[i].txjson.extra_data.send_node
                }
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

