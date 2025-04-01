/**
 * Created by lauo.li on 2020/1/8.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const user_redis = require('../config').user_redis;
// const burnlist_redis = require('../config').burnlist_redis
// const config = require('../config').config;
// const shop_c = require('./shop_c')
// const {vip_filter,vip_filter_visit,vip_filter_send,vip_filter_invite,vip_filter_manager,GROUPCHAT_PM_INVITE,GROUPCHAT_PM_SEND,GROUPCHAT_PM_VISIT,GROUPCHAT_PM_MANAGER,MANAGER_VIP_LEVEL,NORMAL_VIP_LEVEL} = require('../middleware/common_interceptor')
// const rpc_query = require('../rpc_api_config').rpc_query
// const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
//     ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
//     GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
//     PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
//     RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
//     SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
//     OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
//     MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
//     VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME, rpc_client } = require('../rpc_api_config')

// const rpc_api_util = require('../rpc_api_util')

window.groupchat_c = {}
/**
 * 添加联系人
 */
window.groupchat_c.addContact =addContact;
async function addContact(req, res) {
    let {user_id,s_id,user_b, random, sign} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user_id error'})
    if(!user_b ) return res.json({ret:false,msg:'user_b error'})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let add_contact_flag = await rpc_api_util.s_save_into_token_list(USER_API_BASE,user_id,user_b,'relm','add to contact list');
    console.log('添加联系人：'+add_contact_flag)

    if(!add_contact_flag) res.json({ret:false,msg:'add contact failed!'})
    else res.json({ret:true,msg:'success'})
}

/**
 * 删除联系人
 */
window.groupchat_c.delContact =delContact;
async function delContact(req, res) {
    let {user_id,s_id,user_b, random, sign} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user_id error'})
    if(!user_b ) return res.json({ret:false,msg:'user_b error'})


    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let is_contact_flag = await rpc_api_util.s_check_token_list_related(USER_API_BASE,user_id,user_b,'relm');
    console.log('联系人状态：'+is_contact_flag)
    if(!is_contact_flag) return res.json({ret:true,msg:'success'});

    let del_flag = await rpc_api_util.s_del_from_token_list(USER_API_BASE,user_id,user_b,'relm','del contact');

    if(!del_flag) res.json({ret:false,msg:'del contact failed!'})
    else res.json({ret:true,msg:'success'})
}
/**
 * 获得联系人列表
 */
window.groupchat_c.queryContactList =queryContactList;
async function queryContactList(req, res) {
    let {user_id,s_id, random, sign} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user-id error'})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let list= await rpc_api_util.s_query_token_list(USER_API_BASE,user_id,'relm',0,100000);
    for(let i=0;list &&i<list.length;i++)
    {
        delete list[i].pwd;
        delete list[i].salt;
    }
    res.json({ret:true,msg:'success',list})
}

/**
 * 获得联系人列表和群列表
 */
window.groupchat_c.userAndChatList =userAndChatList;
async function userAndChatList(req, res) {
    let {user_id,s_id, random, sign, begin, len} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user-id error'})
    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    // 获取联系人列表
    let userList= await rpc_api_util.s_query_token_list(USER_API_BASE,user_id,'relm',0,100000);
    for(let i=0;userList &&i<userList.length;i++)
    {
        delete userList[i].pwd;
        delete userList[i].salt;
    }
    // 获取群列表
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let groupList =  await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',begin*len,len);
    for(let i=0;i<groupList.length;i++)
    {
        let obj = groupList[i]
        if(obj.chat_type=='single' )
        {
            obj.chatname = obj.user_a == user_id ? obj.name_b:obj.name_a;
            obj.chatlogo = null;
        }
    }
    res.json({ret:true,msg:'success',userList,groupList})
}


/**
 * 创建单聊窗口（或者查找单聊窗口）--返回一个聊天室token-id（即群聊token-id）
 * 如果已经创建，就返回查询到的单聊的聊天室。
 * @type {singleChat}
 */
window.groupchat_c.singleChat =singleChat;
async function singleChat(req, res) {
    let {user_id,s_id,user_b, random, sign} = str_filter.get_req_data(req);
    if(!user_id || !user_b) return res.json({ret:false,msg:'user-id error'})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    let mult_key = ll_config.redis_key+":singleChat:"+user_id+':'+user_b
    str = await user_redis.get(mult_key)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(mult_key,random,120)

    let aInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    let bInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_b,'assert');
    if(!aInfo || !bInfo){
        user_redis.del(mult_key)
        return res.json({ret: false, msg: "query user info failed"});
    } 

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?
        await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT, user_id.split('_')[1]):user_id;
    let msg_user_b = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?
        await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT, user_b.split('_')[1]):user_b;

    let list = await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',0,100000);
    let list2= await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_b,'relm',0,100000);
    let listall = list.concat(list2)
    for(let i=0;i<listall.length;i++)
    {
        let obj = listall[i];
        if(obj.chat_type == 'single' && ( ( obj.user_a==user_id && obj.user_b==user_b) || (obj.user_a==user_b && obj.user_b==user_id) ) ) {
            user_redis.del(mult_key)

            rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,obj.token_y,'relm','readd to chatid-mem-list');
            rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_b,obj.token_y,'relm','readd to chatid-mem-list');

            return res.json({ret: true, msg: 'success', chatid: obj.token_y,
                chatname:(obj.user_a==user_id?bInfo.user_name:aInfo.user_name),
                chatlogo:(obj.user_a==user_id?bInfo.logo:aInfo.logo),chat_time_i:obj.create_time_i,chat_time:obj.create_time})
        }
    }

    let time_i = parseInt(new Date().getTime()/1000);

    let obj = {chat_type:'single',chatname:aInfo.user_name+' 私信 '+bInfo.user_name,// chatlogo:(obj.user_a==user_id?bInfo.logo:aInfo.logo),
        user_a:user_id,name_a:aInfo.user_name,name_b:bInfo.user_name,user_b,
        create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i)}
    let chatid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'chat01');
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet)
    {
        user_redis.del(mult_key)
        return res.json({ret: false, msg: "save chat-info failed"});
    } 

    let add_contact_flag = await rpc_api_util.s_save_into_token_list(USER_API_BASE,user_id,user_b,'relm','add to contact list');
    console.log('添加联系人：'+add_contact_flag)

    let join_a = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,chatid,'relm','add to list');
    if(!join_a) {
        user_redis.del(mult_key)
        return res.json({ret: false, msg: "save chatid to user_id-chatlist failed"});
    } 
    let join_b = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_b,chatid,'relm','add to list');
    if(!join_b) {
        user_redis.del(mult_key)
        return res.json({ret: false, msg: "save chatid to user_b-chatlist failed"});
    } 

    // let join_c = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,msg_user_id,'relm','add to list');
    // if(!join_c)  return res.json({ret: false, msg: "save chatid to user_id-chatlist failed-2"});
    // let join_d = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,msg_user_b,'relm','add to list');
    // if(!join_d)  return res.json({ret: false, msg: "save chatid to user_b-chatlist failed-2"});

    user_redis.del(mult_key)
    return res.json({ret:true,msg:'success',add_contact_flag,chatid,chatname:bInfo.user_name,chatlogo:null,chat_time_i:time_i,chat_time:str_filter.GetDateTimeFormat(time_i)})
}
/**
 * 修改聊天室的forkids
 */
window.groupchat_c.modChatFORKIDS = modChatFORKIDS
async function modChatFORKIDS(req,res)
{
    let {user_id,s_id, chatid,forkids,random, sign} = str_filter.get_req_data(req);
    // if(!forkids) return res.json({ret:false,msg:"forkids error"})
    if(forkids && forkids.length>0)
    {
        let forkidsArray = forkids.split(';')
        // if(forkidsArray.length<=0) return res.json({ret:false,msg:"forkids list is empty"})
        for(let i=0;i<forkidsArray.length;i++)
        {
            let forkid = forkidsArray[i]
            if(forkid.indexOf('FORK')!=0) return res.json({ret:false,msg:"forkids list haved error FORKID:"+forkid})
        }
    }

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo
    if(chatInfo.chat_type=='single' ) return res.json({ret:false,msg:"can not modify single-chat forkids"});
    
    if(forkids)
        chatInfo.forkids = forkids
    else //清理forkids权限
        delete chatInfo.forkids

    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update forkids');
    if(!assertFlag) return res.json({ret:false,msg:"update chat-forkids failed"})

    forkids = forkids ? forkids:''

    let msg = userInfo.user_name+'修改了群聊的福刻访问权限（forkids：'+forkids+'）';
    sendChatInfoModifyMsg(user_id,msg,chatid,'forkids',forkids,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 修改聊天室的xmsgids
 */
window.groupchat_c.modChatXmsgids = modChatXmsgids
async function modChatXmsgids(req,res)
{
    let {user_id,s_id, chatid,xmsgids,random, sign} = str_filter.get_req_data(req);

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo
    if(chatInfo.chat_type=='single' ) return res.json({ret:false,msg:"can not modify single-chat xmsgids"});
    
    if(xmsgids)
        chatInfo.xmsgids = xmsgids
    else //清理xmsgids权限
        delete chatInfo.xmsgids

    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update xmsgids');
    if(!assertFlag) return res.json({ret:false,msg:"update chat-xmsgids failed"})

    xmsgids = xmsgids ? xmsgids:''

    let msg = userInfo.user_name+'修改了群聊的福刻访问权限（xmsgids：'+xmsgids+'）';
    sendChatInfoModifyMsg(user_id,msg,chatid,'xmsgids',xmsgids,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 修改聊天室的头像
 */
window.groupchat_c.modChatLogo =modChatLogo;
async function modChatLogo(req, res) {
    let {user_id,s_id, chatid,logo,random, sign} = str_filter.get_req_data(req);
    if(!logo) return res.json({ret:false,msg:"logo error"})

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo

    if(chatInfo.chat_type=='single' && chatInfo.user_a != user_id && chatInfo.user_b!=user_id ) return res.json({ret:false,msg:"user_id is not owner"});
    if(chatInfo.chat_type!='single' && chatInfo.create_user_id != user_id) return res.json({ret:false,msg:"user_id is not manager"});

    chatInfo.chatlogo = logo;
    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update logo to '+logo);
    if(!assertFlag) return res.json({ret:false,msg:"update chat-info failed"})

    
    let msg = userInfo.user_name+'修改了群头像';
    sendChatInfoModifyMsg(user_id,msg,chatid,'chatlogo',logo,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 修改聊天室的阅后即焚过期时间
 */
// window.groupchat_c.modChatBurntime =modChatBurntime;
// async function modChatBurntime(req, res) {
//     console.log('-------------------------------------------------------------------------------------阅后即焚呀呀呀呀呀呀')
// }
window.groupchat_c.modChatBurntime =modChatBurntime;
async function modChatBurntime(req, res) {
    let {user_id,s_id, chatid,burn_time_type,random, sign} = str_filter.get_req_data(req);
    if(!burn_time_type) return res.json({ret:false,msg:"burntime error"})

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo
    let burnTimes = [5, 10, 30, 60, 60*5, 60*30, 60*60, 60*60*6, 60*60*12, 60*60*24, 60*60*24*7]//11种类型的过期时间
    if(chatInfo.chat_type=='single' && chatInfo.user_a != user_id && chatInfo.user_b!=user_id ) return res.json({ret:false,msg:"user_id is not owner"});
    
    //对时间进行判断
    if(!burn_time_type) return res.json({ret:false,msg:"burn_time_type is not set"});
    let timeFlag = false
    for(let i = 0; i < burnTimes.length; i++){
        if(burn_time_type == burnTimes[i]){
            timeFlag = true;
            break;
        }
    }
    //修改的时间不在设置范围
    if(!timeFlag) return res.json({ret:false,msg:"burn_time_type is not legal"}); 
    //若果没有修改却提交，直接返回成功消息
    if(chatInfo && chatInfo.burn_time_type == burn_time_type) return res.json({ret:true,msg:'success'});

    chatInfo.burn_time_type = burn_time_type;
    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update burn_time_type to '+burn_time_type);
    if(!assertFlag) return res.json({ret:false,msg:"update chat-info failed"})

    let tipTime
    if( parseInt( burn_time_type/(24*60*60*7))  ){
        tipTime = burn_time_type/(24*60*60*7) + '星期'
    }else if( parseInt(burn_time_type/(24*60*60) )){
        tipTime = burn_time_type/(24*60*60) + '天'
    }else if(  parseInt(burn_time_type/(60*60)) ){
        tipTime = burn_time_type/(60*60) + '小时'
    }else if( parseInt(burn_time_type/(60)) ){
        tipTime = burn_time_type/60 + '分'
    }else{
        tipTime = burn_time_type + '秒'
    }

    let msg = userInfo.user_name+'设置阅后即焚时间为'+tipTime;
    sendChatInfoModifyMsg(user_id,msg,chatid,'burn_time_type',burn_time_type,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 阅后即焚定时器（每秒扫描）
 * 
 */
if(false)
setInterval(async function(){
    let i = 0;
    let obj;
    let burnListLen = await burnlist_redis.llen(ll_config.redis_key+':msg_burn_list:')
    if(burnListLen)
        console.log('the length msg_burn_list in redis is:'+burnListLen)
    let flag =false //用来记录这次扫描是否有消息需要删除
    for(;i < parseInt( burnListLen); i++){
        obj = await burnlist_redis.lindex(ll_config.redis_key+':msg_burn_list:', i);//根据下标从redis里取阅后即焚消息
        let objJson = JSON.parse(obj);
        let time_i = parseInt( new Date().getTime()/1000);
        console.log('objJson:'+JSON.stringify(objJson))
        if(time_i >= objJson['burn_time']){ //当前时间大于消息过期时间，进行标记
            console.log('into timeout-deal-process')
            flag = true
            if(objJson && (typeof objJson['msgid']!='object'))
            {
                let msgInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,objJson['msgid'],'assert')   
                if(!msgInfo) return {ret: false, msg: 'msg-info is empty'}
                    
                msgInfo.status = 2//burn-status
                msgInfo.type = 'text'
                msgInfo.msg = '该消息已过期'
                msgInfo.body =null;
                
                let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,objJson['msgid'],'assert',JSON.stringify(msgInfo),'recall msg by '+obj['msg_user_id'])
                if(!assertRet) return {ret: false, msg: 'update msg-info status failed!'}

                
                notifyDeleteMsg(objJson['user_id'],objJson['msg_user_id'],objJson['msgid'],objJson['chatid']);
            }
            await burnlist_redis.lset(ll_config.redis_key+':msg_burn_list:', i, 'del') //标记需要删除的消息
        }
        if(flag)
            await burnlist_redis.lrem(ll_config.redis_key+':msg_burn_list:', 0, 'del')//0代表删除列表中所有为‘del’的记录
    }
},1000)
//扫描30分钟过期的redis，并把该消息放进另外一个每秒扫描删除的redis队列（30分钟扫描一次）
if(false)
setInterval(async function(){
    console.log('30 minute timer start')
    let begin = 0,len = 1000
    let list = []
    let flag = true
    while(flag){
        let list2 = await rpc_api_util.s_query_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,'relb',begin, len)
        list = list.concat(list2)
        let obj = list2[begin+len-1]
        if( !obj || obj.burn_time >= 60*60*24*8) flag = false;//扫描到第8天的停止扫描
       
        begin = begin+len
    }
    
    for(let i=0;i<list.length;i++)
    {
        let obj = list[i]
        let time_i = parseInt( new Date().getTime()/1000);
        if(obj.burn_time - time_i <= 60*30 && obj.msgid != null && obj.status != 2){
            let burnMsgObj = {'user_id': obj.user_id, 'msg_user_id':obj.from, 'chatid':obj.to, 'msgid': obj.msgid, 'burn_time': obj.burn_time}
            let redisRet = burnlist_redis.rpush(ll_config.redis_key+':msg_burn_list:', JSON.stringify(burnMsgObj));
            if(!redisRet) return res.json({ret:false, msg:'put the greater than msg to redis-list failed!'})
        
            let delRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,obj.msgid,'relb','remove the msg from msg_burn_list')
            if(!delRet) return res.json({ret:false, msg:'delete the msg from msg_delete_list failed!'})
        }
    }
},60*30*1000) 
//同步删除消息
async function notifyDeleteMsg(user_id,msg_user_id,msgid,chatid)
{
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    let userName = userInfo?userInfo.user_name:'';
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'msg_delete'
    let msg = userName+'已删除该消息'

    let obj = {type,msg,from:msg_user_id,to:chatid,body:{burn_delete:msgid},is_encrypted:false,encrypt_method:'aes256',status:2}//当前消息状态为2
    
    let newMsgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!newMsgid){
        console.log('notifyDeleteMsg-ret: get msgid failed')
        return {ret: false, msg: "get msgid failed"}
    } 
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,newMsgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) {
        console.log('notifyDeleteMsg-ret: set msgid-info failed')
        return {ret: false, msg: "set msgid-info failed"}
    }

    let msgObj = {msgid:newMsgid,msg,type,time_i}
    let sendRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet) return {ret: false, msg: "send msgObj to chatroom failed"}

    return {ret:true,msg:'success'}
}
/**
 * 修改聊天室的背景图片
 */
window.groupchat_c.modChatBackgroupImg =modChatBackgroupImg;
async function modChatBackgroupImg(req, res) {
    let {user_id,s_id, chatid,backgroup_img,random, sign} = str_filter.get_req_data(req);
    if(!backgroup_img) return res.json({ret:false,msg:"backgroup_img error"})

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo
    console.log('---------------------------------------------------------------------------------------------------'+chatInfo+'-------------------------------------------------------------------------------------------------------------------------------');
    if(chatInfo.chat_type=='single' && chatInfo.user_a != user_id && chatInfo.user_b!=user_id ) return res.json({ret:false,msg:"user_id is not owner"});
    if(chatInfo.chat_type!='single' && chatInfo.create_user_id != user_id) return res.json({ret:false,msg:"user_id is not manager"});

    chatInfo.backgroup_img = backgroup_img;
    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update backgroup_img to '+backgroup_img);
    if(!assertFlag) return res.json({ret:false,msg:"update chat-info failed"})
    
    let msg = userInfo.user_name+'修改了群背景';
    sendChatInfoModifyMsg(user_id,msg,chatid,'backgroup_img',backgroup_img,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 修改聊天室的分享权限
 * 默认为允许分享（私下聊除外---永远不允许分享）--1，不允许分享--0（非）
 */
window.groupchat_c.modChatSharePM =modChatSharePM;
async function modChatSharePM(req, res) {
    let {user_id,s_id, chatid,share_pm,random, sign} = str_filter.get_req_data(req);
    // if(!share_pm) return res.json({ret:false,msg:"share_pm error"})

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo

    if(chatInfo.chat_type=='single' ) return res.json({ret:false,msg:"user_id is not owner"});
    if(chatInfo.chat_type!='single' && chatInfo.create_user_id != user_id) return res.json({ret:false,msg:"user_id is not manager"});

    chatInfo.share_pm = share_pm && parseInt(share_pm)!=0 ?1:0;
    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update share_pm to '+share_pm);
    if(!assertFlag) return res.json({ret:false,msg:"update chat-info failed"})
    
    let msg = userInfo.user_name+'修改了群分享设置';
    sendChatInfoModifyMsg(user_id,msg,chatid,'share_pm',share_pm,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 修改聊天室的名称
 */
window.groupchat_c.modChatName =modChatName;
async function modChatName(req, res) {
    let {user_id,s_id, chatid,name,random, sign} = str_filter.get_req_data(req);
    if(!name) return res.json({ret:false,msg:"name error"})

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo

    if(chatInfo.chat_type=='single' && chatInfo.user_a != user_id && chatInfo.user_b!=user_id ) return res.json({ret:false,msg:"user_id is not owner"});
    if(chatInfo.chat_type!='single' && chatInfo.create_user_id != user_id) return res.json({ret:false,msg:"user_id is not manager"});

    chatInfo.chatname = name;
    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update name to '+name);
    if(!assertFlag) return res.json({ret:false,msg:"update chat-info failed"})

    let msg = userInfo.user_name+'将群名称修改为'+name;
    sendChatInfoModifyMsg(user_id,msg,chatid,'chatname',name,chatInfo);

    return res.json({ret:true,msg:'success'})
}

/**
 * 修改聊天室的会员等级
 */
window.groupchat_c.modChatVipLevel =modChatVipLevel;
async function modChatVipLevel(req, res) {
    let {user_id,s_id, chatid,vip_level,vip_type,random, sign} = str_filter.get_req_data(req);

    vip_type = !vip_type ? 'vip_level':vip_type;
    if(vip_type!=GROUPCHAT_PM_VISIT && vip_type!=GROUPCHAT_PM_SEND && vip_type!=GROUPCHAT_PM_INVITE) return res.json({ret:false,msg:"vip_type error"})
    let tips = vip_type== GROUPCHAT_PM_VISIT?'访问权限':(vip_type== GROUPCHAT_PM_SEND?'发消息权限':'拉人入群权限');

    //判断会员等级参数
    if(!vip_level || vip_level*1 !=vip_level) return res.json({ret:false,msg:"vip_level error"})
    vip_level = parseInt(vip_level);
    if(vip_level<NORMAL_VIP_LEVEL || vip_level>MANAGER_VIP_LEVEL) return res.json({ret:false,msg:"vip_level is not ok"})

    let userInfo = req.userInfo
    let chatInfo  = req.chatInfo

    //单聊无法修改会员等级
    if(chatInfo.chat_type=='single') return res.json({ret:false,msg:"single chat can not modify vip_level"});

    chatInfo[vip_type] = vip_level;
    let assertFlag = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update vip-level to '+vip_level);
    if(!assertFlag) return res.json({ret:false,msg:"update "+vip_type+" failed"})

    let vip_tips = vip_level==NORMAL_VIP_LEVEL ? '普通成员':(vip_level==MANAGER_VIP_LEVEL?'管理员':'VIP'+vip_level)
    let msg =  userInfo.user_name+'将'+tips+'修改为'+vip_tips;

    sendChatInfoModifyMsg(user_id,msg,chatid,vip_type,vip_level,chatInfo);

    return res.json({ret:true,msg:'success'})
}
//create_vip_level 创建群聊的权限（0-10），0为普通用户，10为客服；
//share_filter：1-1-根据群聊设置   2-不允许分享到外部
//gsb_fee：创建群聊的GSB扣费
//rmb_fee：创建群聊的rmb扣费
const default_groupchat_setting = {group:{create_vip_level:NORMAL_VIP_LEVEL,share_filter:1,gsb_fee:0,rmb_fee:0},
                            group_live:{create_vip_level:NORMAL_VIP_LEVEL,share_filter:1,gsb_fee:0,rmb_fee:0},
                            group_shop:{create_vip_level:NORMAL_VIP_LEVEL,share_filter:1,gsb_fee:0,rmb_fee:0}}
//获得群聊的配置信息
window.groupchat_c.get_groupchat_setting =get_groupchat_setting;
async function get_groupchat_setting() {
    let setting = await rpc_api_util.s_query_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,'config')
    if(!setting) setting = default_groupchat_setting;
    return setting;
}
/**
 * 得到群聊的配置信息
 */
window.groupchat_c.query_groupchat_setting =query_groupchat_setting;
async function query_groupchat_setting(req, res) {
    let setting = await get_groupchat_setting()
    setting.ret = true;
    setting.msg = 'success'
    res.json(setting)
}

/**
 * 判断群聊的创建权限（包含直播间）
 * @param {}} req 
 * @param {*} res 
 */
async function checkGroupchatCreatePM(req,res,setting)
{
    let {user_id} = str_filter.get_req_data(req)
    let userInfo =  await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!userInfo)
    {
        let result = {ret:false,msg:'need pm: user-info is empty'}
        console.log('checkGroupchatCreatePM-result:'+JSON.stringify(result))
        res.json(result)
        return false;
    }
    //是否被封
    if(userInfo.is_baned)
    {
        let result = {ret:false,msg:'need pm: you is already baned by console-user'}
        console.log('checkGroupchatCreatePM-result:'+JSON.stringify(result))
        res.json(result)
        return false;
    }
    req.userInfo = userInfo;

    if(setting.create_vip_level==NORMAL_VIP_LEVEL) return true;
    //判断是否是客服
    if(setting.create_vip_level == MANAGER_VIP_LEVEL)
    {
        if(user_id == ll_config.init_console_user) return true;
        let console_user_list_id = await rpc_api_util.s_query_token_id(USER_API_BASE,USER_TOKEN_ROOT,'consoleuser00000')
        let relateRet = await rpc_api_util.s_check_token_list_related(USER_API_BASE,console_user_list_id,user_id,'relc')
        if(!relateRet)
        {
            let result = {ret:false,msg:'need pm: is not console_user'}
            console.log('checkGroupchatCreatePM-result:'+JSON.stringify(result))
            res.json(result)
            return false;
        }
        return true;
    }

    let vipInfo = await rpc_api_util.s_query_token_info(VIP_API_BASE,VIP_TOKEN_NAME+'_'+user_id.split('_')[1],'assert');
    let now_time = parseInt(new Date().getTime()/1000);
    //如果是manager则是：vip10
    //以下此行代码判断管理员，但是在前面已经对管理员进行了放过
    //vipInfo = is_manager ? {vip_level:MANAGER_VIP_LEVEL,send_vip_level:MANAGER_VIP_LEVEL,invite_vip_level:MANAGER_VIP_LEVEL,vip_timeout:now_time+100*60*60*24}:vipInfo
    vipInfo = !vipInfo ? {vip_level:NORMAL_VIP_LEVEL,send_vip_level:NORMAL_VIP_LEVEL,invite_vip_level:NORMAL_VIP_LEVEL,vip_timeout:0}:vipInfo;
    req.vipInfo = vipInfo;
    if(vipInfo.vip_level< setting.create_vip_level)
    {
        let result = {ret:false,msg:'need pm: your vip_level is lower than create_vip_level'}
        console.log('checkGroupchatCreatePM-result:'+JSON.stringify(result))
        res.json(result)
        return false;
    }
    if(vipInfo.vip_timeout <= now_time)
    {
        let result = {ret:false,msg:'need pm: your vip is timeout'}
        console.log('checkGroupchatCreatePM-result:'+JSON.stringify(result))
        res.json(result)
        return false;
    }

    return true;
}
/**
 * 创建一个群聊---不需要创建群聊名称，只需要创建即可
 * @type {groupChat}
 * 新增参数：group_type,chatname,backgroup_img
 * group_type：为空或者'group'时，代表普通群聊，如果是'group_live'代表直播
 * chatname是群聊的名称（可用于直播间创建）
 * backgroup_img是群聊的背景图（可用于直播间创建）
 */
window.groupchat_c.groupChat =groupChat;
async function groupChat(req, res) {
    let {user_id,s_id, group_type,chatname,backgroup_img,chatlogo,desc,join_uids,random, sign} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user-id error'})
    group_type = !group_type ? 'group':group_type
    //群聊现在有两种类型，一个是【群聊】，一个是直播间--【group_live】
    if(group_type!='group' && group_type!='group_live' && group_type!='group_shop')  return res.json({ret:false,msg:'group_type error'})
    if(group_type == 'group_live')
    {
        if(!chatname ) return res.json({ret:false,msg:'chatname error'})
        if(!backgroup_img ) return res.json({ret:false,msg:'backgroup_img error'})
    }
    if(group_type == 'group_shop')
    {
        if(!chatname ) return res.json({ret:false,msg:'chatname error'})
        if(!chatlogo ) return res.json({ret:false,msg:'chatlogo error'})
        if(!desc)  return res.json({ret:false,msg:'desc error'})
    }else{
        // const fengjing_imgs = await require('../fengjing_imgs').get_list();
        let fengjing_imgs_list = await fengjing_imgs.get_list()
        chatlogo = fengjing_imgs_list[ Math.floor(Math.random()*13999)%fengjing_imgs_list.length]
    }

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //权限判断开始 
    let  setting = (await get_groupchat_setting())[group_type]
    setting = setting ? setting:default_groupchat_setting[group_type]
    console.log('group_type:'+group_type+' groupchat-setting:'+JSON.stringify(setting))
    let check = await checkGroupchatCreatePM(req,res,setting)
    if(!check) return ;

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":groupChat:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":groupChat:"+user_id+random,random,120)

    let uInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!uInfo ) return res.json({ret: false, msg: "query user info failed"});
    let time_i = parseInt(new Date().getTime()/1000);

    let obj = {chat_type:group_type,chatname:chatname?chatname:uInfo.user_name+'新建的群聊',backgroup_img,share_pm:1,
        create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),create_user_id:user_id}
    let token_pre = group_type=='group_live'?'chat02L':(group_type=='group'?'chat02G':'chat02S');
    let chatid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,token_pre);
    //创建小店
    if(group_type == 'group_shop'){
        let shop_id = OBJ_TOKEN_NAME+'_'+chatid.split('_')[1]
        let newShopRet = await shop_c.s_newShop(shop_id,user_id,chatname,desc,chatlogo);
        if(!newShopRet) return res.json({ret: false, msg: "new shop failed"});
        obj.shop_id = shop_id;
    }
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "save chat-info failed"});

    //扣费开始
    let orderInfo ={order_name:'创建'+(group_type=='group'?'群聊':(group_type=='group_live'?'直播间':'小店'))}
    if(setting.gsb_fee*1 > 0 )
    {
        let gsb_user_id = GSB_TOKEN_NAME+'_'+user_id.split('_')[1]
        let sendRet = await rpc_api_util.s_save_token_info(GSB_API_BASE,gsb_user_id,GSB_TOKEN_ROOT,'send',setting.gsb_fee,JSON.stringify(orderInfo))
        if(!sendRet) return res.json({ret: false, msg: "send gsb_fee failed"});
    }
    if(setting.rmb_fee*1>0)
    {
        let rmb_user_id = RMB_TOKEN_NAME+'_'+user_id.split('_')[1]
        let sendRet = await rpc_api_util.s_save_token_info(RMB_API_BASE,rmb_user_id,RMB_TOKEN_ROOT,'send',setting.rmb_fee,JSON.stringify(orderInfo))
        if(!sendRet) return res.json({ret: false, msg: "send rmb_fee failed"});
    }


    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?
        await rpc_api_util.s_query_token_id(MSG_API_BASE,MSG_TOKEN_ROOT, user_id.split('_')[1]):user_id;
    let join_a = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,chatid,'relm','add to list');
    if(!join_a)  return res.json({ret: false, msg: "save chatid to user_id-group-chatlist failed"});

    //拉人一起建群（新建群）。
    let join_uids_success_cnt = 0;
    if(join_uids)
    {
        console.log('join_uids:'+join_uids)
        try{
            join_uids = JSON.parse(join_uids)
        }catch(ex)
        {
            join_uids = [];
            console.log('join_uids-error:'+join_uids+' error:'+JSON.stringify(ex));
            //return res.json({ret:false,msg:'join_uids format error'})
        }
        let i=0;
        for(;i<join_uids.length;i++)
        {
            console.log(join_uids[i]+' join:');
            if(!join_uids[i]) continue;
            let tmp_msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?  MSG_TOKEN_NAME+'_'+join_uids[i].split('_')[1] :join_uids[i];
            let jflag  =  await rpc_api_util.s_check_token_list_related(MSG_API_BASE,tmp_msg_user_id,chatid,'relm')//await rpc_api_util.s_save_into_token_list(MSG_API_BASE,tmp_msg_user_id,chatid,'relm','add to list');
            if(!jflag) jflag = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,tmp_msg_user_id,chatid,'relm','add to list');
            console.log(tmp_msg_user_id +' join chat:'+chatid+' flag:'+jflag)
            join_uids_success_cnt += jflag?1:0;
        }
    }
    // let join_b = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,msg_user_id,'relm','add to list');
    // if(!join_b)  return res.json({ret: false, msg: "save chatid to user_id-group-chatlist failed-2"});

    let retJSON = {ret:true,msg:'success',join_uids_success_cnt,chatid,chatname:obj.chatname,chatlogo:null,chat_time_i:time_i,chat_time:str_filter.GetDateTimeFormat(time_i)}

    //返回直播间的基础信息（rtmp推流地址--创建人和管理员可见； live_cdn_url  这个是播放器播放内容的地址）
    if(group_type=='group_live')
    {
        const md5 = require('crypto').createHash('md5');
        let key = ll_config.live_auth_secret;
        let exp = (Date.now() / 1000 | 0) + 60;
        let streamId = '/live/'+chatid
        let sign = exp+'-'+md5.update(streamId+'-'+exp+'-'+key).digest('hex')
        console.log('sign:'+sign);


        let session_param = '?user_id='+user_id+"&s_id="+s_id;
        retJSON.live_rtmp_url = ll_config.live_rtmp_url+chatid+session_param;//当且仅仅当是直播间创建人才有用
        retJSON.live_http_url = ll_config.live_http_url+chatid+'/index.m3u8?sign='+sign
        retJSON.live_cdn_url = ll_config.live_cdn_url+chatid+'/index.m3u8?sign='+sign
        retJSON.chat_share_url= ll_config.chat_share_url+chatid
    }

    return res.json(retJSON)
}

/**
 * 绑定小店
 */
window.groupchat_c.bindShop =bindShop;
async function bindShop(req,res){
    let {user_id,s_id,chatid,chat_shopid,random, sign} = str_filter.get_req_data(req);

     //校验session
     let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
     if(!str) return res.json({ret:false,msg:"session error"})

     let bindRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,chat_shopid,'rels','bind shop to groupchat');
     if(!bindRet) return res.json({res:false, msg:'bind shop to groupchat failed!'})

     //把小店id保存在chatInfo里
     let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
     if(!chatInfo) return res.json({ret:false,msg:'chat info is empty'})
     chatInfo.shop_id = chat_shopid

     let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update the chatInfo')
     if(!assertRet) return res.json({ret:false, msg:'update failed'})

     return res.json({ret:true, msg:'success'});

}

/**
 * 直播间解绑小店
 */
window.groupchat_c.unBoundShop = unBoundShop;
async function unBoundShop(req,res){
    let {user_id,s_id,chatid,chat_shopid,random, sign} = str_filter.get_req_data(req);

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let unBindRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,chat_shopid,'rels','Unbounding the shop to the groupchat_live')
    if(!unBindRet) return res.json({res:false, msg:'unbound shop to groupchat_live failed!'})

    //把小店id从chatInfo里去掉
    let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat info is empty'})
    delete chatInfo.shop_id

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update the chatInfo')
    if(!assertRet) return res.json({ret:false, msg:'update failed'})

    return res.json({ret:true, msg:'success'})
}

/**
 * 添加联系人到群聊(由通讯录导入)
 */
window.groupchat_c.groupChatByContact =groupChatByContact;
async function groupChatByContact(req, res) {
    let {user_id,s_id,chatid,join_uids,random, sign} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user-id error'})
    if(!chatid ) return res.json({ret:false,msg:'chatid error'})
    if(!join_uids ) return res.json({ret:false,msg:'join_uids error'})

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":groupChat:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":groupChat:"+user_id+random,random,120)

    if(chatid.indexOf(MSG_TOKEN_NAME+'_chat01')==0 ) 
        return res.json({ret:false,msg:'groupChatByContact api call failed!  chatid is the single-chatid ! please use the groupChat-api !'})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let join_uids_success_cnt = 0;

    console.log('join_uids:'+join_uids)
    try{
        join_uids = JSON.parse(join_uids)
    }catch(ex)
    {
        console.log('join_uids-error:'+join_uids+' error:'+JSON.stringify(ex));
        return res.json({ret:false,msg:'join_uids format error'})
    }

    let i=0;
    for(;i<join_uids.length;i++)
    {
        console.log(join_uids[i]+' join:');
        if(!join_uids[i]) continue;
        let tmp_msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?  MSG_TOKEN_NAME+'_'+join_uids[i].split('_')[1] :join_uids[i];
        let jflag  =  await rpc_api_util.s_check_token_list_related(MSG_API_BASE,tmp_msg_user_id,chatid,'relm')//await rpc_api_util.s_save_into_token_list(MSG_API_BASE,tmp_msg_user_id,chatid,'relm','add to list');
        if(!jflag) jflag = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,tmp_msg_user_id,chatid,'relm','add to list');
        console.log(tmp_msg_user_id +' join chat:'+chatid+' flag:'+jflag)
        join_uids_success_cnt += jflag?1:0;
    }
    
    if(join_uids_success_cnt>0) res.json({ret:true,msg:'success',join_uids_success_cnt})
    else res.json({ret:false,msg:'let contact-user join to chat failed',join_uids_success_cnt})
}
/**
 * 加入群聊
 * @type {joinChat}
 */
window.groupchat_c.joinChat =joinChat;
async function joinChat(req, res) {
    let {user_id, s_id, chatid, random, sign} = str_filter.get_req_data(req);
    if (!user_id ) return res.json({ret: false, msg: 'user-id  error'})
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})
    //校验sign(暂无)

    //防重放攻击
    // str = await user_redis.get(config.redis_key + ":joinChat:" + user_id + random)
    // if (str) {
    //     return res.json({ret: false, msg: "muti call failed"});
    // }
    // user_redis.set(config.redis_key + ":joinChat:" + user_id + random, random, 120)

    let cInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert');
    if(!cInfo) return res.json({ret: false, msg: "query chat info failed"});
    if(cInfo.chat_type=='single') return res.json({ret: false, msg: "can't join single-chat"});

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let list = await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',0,100000);
    let listall = list
    for(let i=0;i<listall.length;i++)
    {
        let obj = listall[i];
        if(obj.chat_type == 'group' && obj.token_y == chatid  ) {
            return res.json({ret: true, msg: 'success',chatid,chatname:cInfo.chatname,chatlogo:null,chat_mem_cnt:0})
        }
    }

    let joinRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,chatid,'relm',user_id);
    if(!joinRet) res.json({ret: false, msg: "join chat failed"});

    return res.json({ret: true, msg: 'success',chatid,chatname:cInfo.chatname,chatlogo:null,chat_mem_cnt:0})
}

/**
 * 退出群聊
 * @type {unjoinChat}
 */
window.groupchat_c.unjoinChat =unjoinChat;
async function unjoinChat(req, res) {
    let {user_id, s_id, chatid, random, sign} = str_filter.get_req_data(req);
    if (!user_id ) return res.json({ret: false, msg: 'user-id  error'})
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    //校验session
    let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!str) return res.json({ret: false, msg: "session error"})
    //校验sign(暂无)

    //防重放攻击
    // str = await user_redis.get(config.redis_key + ":unjoinChat:" + user_id + random)
    // if (str) {
    //     return res.json({ret: false, msg: "muti call failed"});
    // }
    // user_redis.set(config.redis_key + ":unjoinChat:" + user_id + random, random, 120)

    // let cInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert');
    // if(!cInfo) return res.json({ret: false, msg: "query chat info failed"});

    // if(cInfo.chat_type=='single') return res.json({ret: false, msg: "can't unjoin single-chat"});
 //   if(cInfo.create_user_id ==  user_id) return res.json({ret: false, msg: "owner can't unjoin chatroom"});  //2020-5-16 允许退出自己创建的群聊

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let unjoinRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,chatid,'relm',user_id);
    if(!unjoinRet) res.json({ret: false, msg: "unjoin chat failed"});

    // let unjoinRet2 = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,msg_user_id,'relm',user_id);
    // if(!unjoinRet2) res.json({ret: false, msg: "unjoin chat failed-2"});

    return res.json({ret: true, msg: 'success'})
}

/**
 * 获得小店列表
 */
window.groupchat_c.getShopList = getShopList;
async function getShopList(req,res){
    let {user_id, s_id, random, sign} = str_filter.get_req_data(req);

    if(!user_id ) return res.json({ret:false,msg:'user-id error'})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let list =  await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',0,10000);
    let shoplist = []
    for(let i=0;i<list.length;i++)
    {
        let obj = list[i]
        if(obj.chat_type=='group_shop' )
            shoplist = shoplist.concat(obj)
    }

    return res.json({res:true, msg:'success',shoplist})
}

/**
 * 获得聊天室列表
 * @type {getChatList}
 */
window.groupchat_c.getChatList =getChatList;
async function getChatList(req, res) {

    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let list =  await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',begin*len,len);
    for(let i=0;i<list.length;i++)
    {
        let obj = list[i]
        if(obj.chat_type=='single' )
        {
            obj.chatname = obj.user_a == user_id ? obj.name_b:obj.name_a;
            obj.chatlogo = null;
        }
    }
    
    res.json({ret:true,msg:'success',list})
}

/**
 * 获得聊天室信息
 * @type {getChatInfo}
 */
window.groupchat_c.getChatInfo =getChatInfo;
async function getChatInfo(req, res) {

    let {user_id, s_id, chatid, random,sign} = str_filter.get_req_data(req);

    if (!chatid) return res.json({ret: false, msg: "chatid format error"})

     let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})


    let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat info is empty'})
    chatInfo.ret = true;
    chatInfo.msg = 'success';

    //非单聊（即群聊情况下）
    if(chatInfo.chat_type!='single')
    {
        let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
        chatInfo.is_manager = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,msg_user_id,'relx')
        chatInfo.is_join = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm')
        chatInfo.is_owner = user_id == chatInfo.create_user_id

        //直播间的播放地址
        if(chatInfo.chat_type == 'group_live')
        {
            let setting = (await get_groupchat_setting()).group_live

            chatInfo.share_filter = setting.share_filter*1

            const md5 = require('crypto').createHash('md5');
            let key = ll_config.live_auth_secret;
            let exp = (Date.now() / 1000 | 0) + 60;
            let streamId = '/live/'+chatid
            let sign = exp+'-'+md5.update(streamId+'-'+exp+'-'+key).digest('hex')
            console.log('sign:'+sign);

            if(s_str || (chatInfo.share_pm*1==1 && setting.share_filter*1==1))
            {
                let session_param = s_str ? '?user_id='+user_id+"&s_id="+s_id :''
                chatInfo.live_rtmp_url = ll_config.live_rtmp_url+chatid+session_param;//当且仅仅当是直播间创建人才有用
                chatInfo.live_http_url = ll_config.live_http_url+chatid+'/index.m3u8?sign='+sign
                chatInfo.live_cdn_url = ll_config.live_cdn_url+chatid+'/index.m3u8?sign='+sign
                chatInfo.chat_share_url= ll_config.chat_share_url+chatid
            }else{
                chatInfo.live_rtmp_url = ''
                chatInfo.live_http_url = ''
                chatInfo.live_cdn_url = ''
            }
        }
    }
    
    res.json(chatInfo);
}

/**
 * 变更群创建人（仅建群人可设置）
 */
window.groupchat_c.changeChatOwner =changeChatOwner;
async function changeChatOwner(req, res) {

    let {user_id, s_id, chatid, mem_user_id,random,sign} = str_filter.get_req_data(req);

    if (!chatid) return res.json({ret: false, msg: "chatid format error"})
    if(!mem_user_id) return res.json({ret: false, msg: "mem_user_id format error"})

    let new_user_id = mem_user_id.indexOf(USER_TOKEN_NAME+'_')==0?mem_user_id:USER_TOKEN_NAME+'_'+mem_user_id.split('_')[1];
    if(new_user_id == user_id) return res.json({ret:false,msg:'change error : your is already owner of chatroom '})

    //msg-token-name
    mem_user_id = mem_user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ? mem_user_id: MSG_TOKEN_NAME+'_'+mem_user_id.split('_')[1];

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat info is empty'})

    if(chatInfo.create_user_id!=user_id)  return res.json({ret:false,msg:'pm error : your is not owner of chatroom '})

    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,mem_user_id,chatid,'relm');
    if(!isJoin) return res.json({ret:false,msg:'member error : mem-user-id not the member of chatroom '})

    chatInfo.create_user_id = new_user_id;
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'update create_user_id from uid='+user_id);
    if(!assertRet) return res.json({ret:false,msg:'update error : mem-user-id to be owner of chatroom failed! '})

    //如果它自己是管理员，删除之。
    rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,mem_user_id,'relx','del manager')

    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,new_user_id,'assert');
    if(userInfo)
    {
        let msg = userInfo.user_name+'成为了新的群主';
        sendChatInfoModifyMsg(user_id,msg,chatid,'create_user_id',new_user_id,chatInfo);
    }

    res.json({ret:true,msg:'success'});
}
/**
 * 对某个群成员进行禁言（仅建群人可设置）
 */
window.groupchat_c.banSpeaking =banSpeaking;
async function banSpeaking(req, res){
    let {user_id, s_id, chatid, mem_user_id,random,sign} = str_filter.get_req_data(req);

    if(!chatid) return res.json({ret: false, msg: "chatid format error"})
    if(!mem_user_id) return res.json({ret: false, msg: "mem_user_id format error"})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})
    //获取将要被禁言的用户信息
    let memInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,mem_user_id,'assert');

    mem_user_id = mem_user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ? mem_user_id: MSG_TOKEN_NAME+'_'+mem_user_id.split('_')[1];

    let chatInfo = req.chatInfo
    let userInfo = req.userInfo
    //判断该用户是否已经被禁言
    let inBanSpeakList = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,mem_user_id,'relb')
    if(inBanSpeakList)  return res.json({ret: false, msg:memInfo.user_name + " is already baned to speaking!"})
    //将用户放入禁言列表里
    let flag = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,mem_user_id,'relb', 'is baned to Speaking!')
    
    if(!flag)  return res.json({ret: false, msg:"ban the member is failed"})
    msg = memInfo.user_name + '被'+ userInfo.user_name+'管理员禁言';
    sendChatInfoModifyMsg(user_id,msg,chatid,'ban_speak_user_id',mem_user_id,chatInfo);
    
    res.json({ret:true,msg:'success'});
}

/**
 * 解除禁言
 */
window.groupchat_c.relieveSpeaking =relieveSpeaking;
async function relieveSpeaking(req, res){
    let {user_id, s_id, chatid, mem_user_id,random,sign} = str_filter.get_req_data(req);

    if(!chatid) return res.json({ret: false, msg: "chatid format error"})
    if(!mem_user_id) return res.json({ret: false, msg: "mem_user_id format error"})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    //获取将被解封禁言的用户信息
    let memInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,mem_user_id,'assert');
    //判断用户是否在禁言列表
    mem_user_id = mem_user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ? mem_user_id: MSG_TOKEN_NAME+'_'+mem_user_id.split('_')[1];
    let is_contact_flag = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,mem_user_id,'relb');
    if(!is_contact_flag) return res.json({ret: false, msg: memInfo.user_name + " not in ban_speak_list"})
    //将该用户从禁言列表移除
    let delRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,mem_user_id,'relb',memInfo.user_name + 'is removed from ban_speak_list')
    if(!delRet) return res.json({ret: false, msg: 'remove '+ memInfo.user_name + "from ban_speak_list is failed!"})

    res.json({ret:true,msg:'success'});
}


/**
 * 添加群管理员（仅建群人可设置）
 */
window.groupchat_c.addChatManager =addChatManager;
async function addChatManager(req, res) {

    let {user_id, s_id, chatid, mem_user_id,random,sign} = str_filter.get_req_data(req);

    if (!chatid) return res.json({ret: false, msg: "chatid format error"})
    if(!mem_user_id) return res.json({ret: false, msg: "mem_user_id format error"})

    mem_user_id = mem_user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ? mem_user_id: MSG_TOKEN_NAME+'_'+mem_user_id.split('_')[1];

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})


    let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat info is empty'})

    if(chatInfo.create_user_id!=user_id)  return res.json({ret:false,msg:'pm error : your is not owner of chatroom '})
    let msg_user_id = user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ?user_id: MSG_TOKEN_NAME+'_'+user_id.split('_')[1];
    if(msg_user_id == mem_user_id) return res.json({ret:false,msg:'add error : your is already owner of chatroom '})

    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,mem_user_id,chatid,'relm');
    if(!isJoin) return res.json({ret:false,msg:'member error : mem-user-id not the member of chatroom '})

    isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,mem_user_id,'relx');
    if(isJoin) return res.json({ret:false,msg:'member error : mem-user-id is already the manager of chatroom '})

    let addRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,mem_user_id,'relx','add new manager');
    if(!addRet) return res.json({ret:false,msg:'let member add to manager-list failed'});

    let new_user_id = mem_user_id.indexOf(USER_TOKEN_NAME+'_')==0?mem_user_id:USER_TOKEN_NAME+'_'+mem_user_id.split('_')[1];
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,new_user_id,'assert');
    if(userInfo)
    {
        let msg = userInfo.user_name+'成为了新的管理员';
        sendChatInfoModifyMsg(user_id,msg,chatid,'manage_user_id',new_user_id,chatInfo);
    }


    res.json({ret:true,msg:'success'});
}

/**
 * 删除群管理员（仅建群人可设置）
 */
window.groupchat_c.delChatManager =delChatManager;
async function delChatManager(req, res) {

    let {user_id, s_id, chatid, mem_user_id,random,sign} = str_filter.get_req_data(req);

    if (!chatid) return res.json({ret: false, msg: "chatid format error"})
    if(!mem_user_id) return res.json({ret: false, msg: "mem_user_id format error"})

    mem_user_id = mem_user_id.indexOf(MSG_TOKEN_NAME+'_')==0 ? mem_user_id: MSG_TOKEN_NAME+'_'+mem_user_id.split('_')[1];

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat info is empty'})

    if(chatInfo.create_user_id!=user_id)  return res.json({ret:false,msg:'pm error : your is not owner of chatroom '})

    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,mem_user_id,'relx');
    if(!isJoin) return res.json({ret:false,msg:'member error : mem-user-id not the manager of chatroom '})

    let delRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,mem_user_id,'relx','delete manager');
    if(!delRet) return res.json({ret:false,msg:'let member delete from manager-list failed'});

    let new_user_id = mem_user_id.indexOf(USER_TOKEN_NAME+'_')==0?mem_user_id:USER_TOKEN_NAME+'_'+mem_user_id.split('_')[1];
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,new_user_id,'assert');
    if(userInfo)
    {
        let msg = userInfo.user_name+'已经不再是管理员';
        sendChatInfoModifyMsg(user_id,msg,chatid,'del_manage_user_id',new_user_id,chatInfo);
    }

    res.json({ret:true,msg:'success'});
}

/**
 * 获得聊天室的管理员列表
 * @type {getChatManagerList}
 */
window.groupchat_c.getChatManagerList =getChatManagerList;
async function getChatManagerList(req, res) {
    let {user_id, s_id,chatid,random, sign, begin, len} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    //如果已经加入，可以查看群聊管理员列表。---使用function来进行回调查询对应的assert信息（rpc_api_util.s_query_token_list的函数升级了）
    let list =  await rpc_api_util.s_query_token_list(MSG_API_BASE,chatid,'relx',begin,len,false, function(msg_user_id){
        console.log('function:'+msg_user_id)
        if(!msg_user_id) return null;
        let user_id0 = USER_TOKEN_NAME+'_'+msg_user_id.split('_')[1];
        console.log('user_id0:'+user_id0)
        return rpc_api_util.s_query_token_info(USER_API_BASE,user_id0,'assert');
    });

    for(let i=0;i<list.length;i++)
    {
        let obj = list[i]
        delete obj.salt ;
        delete obj.pwd ;
    }

    res.json({ret:true,msg:'success',list})
}
/**
 * 删除群管理员
 */
window.groupchat_c.delChatMember =delChatMember;
async function delChatMember(req, res) {

    let {user_id, s_id,chatid,mem_user_id,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    if(!mem_user_id) return res.json({ret: false, msg: 'dst_user_id error'})

    mem_user_id = USER_TOKEN_NAME+'_'+mem_user_id.split('_')[1]
    if(mem_user_id == user_id) return res.json({ret:false,msg:'error: can not del yourself'})
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,mem_user_id,'assert')

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+mem_user_id.split('_')[1]:mem_user_id;
    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin ) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否已经加入群聊

    //如果是群管理，先删除群管理（由群主权限删除）
    let isManager = mem_user_id == req.chatInfo.create_user_id || await rpc_api_util.s_check_token_list_related(MSG_API_BASE,chatid,msg_user_id,'relx');
    if(isManager)
    {
        if(!req.is_owner) return res.json({ret: false, msg: "only the owner of chatroom can del the manager"})
        let delManagerRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,msg_user_id,'relx','delete the manager:'+msg_user_id)
        if(!delManagerRet) return res.json({ret: false, msg: "del manager from chat-manager-list failed"})

        let msg = userInfo.user_name+'已经不再是管理员';
        sendChatInfoModifyMsg(user_id,msg,chatid,'del_manage_user_id',msg_user_id,req.chatInfo);
    }

    if(!req.is_manager) return res.json({ret: false, msg: "only the manager of chatroom can del the member"})

    let delMemberRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,chatid,'relm','del chat member:'+msg_user_id);
    if(!delMemberRet) return res.json({ret: false, msg: "del member from chat-mem-list failed"})

    let msg = userInfo.user_name+'已被群管理移出本群';
    sendChatInfoModifyMsg(user_id,msg,chatid,'del_member_user_id',msg_user_id,req.chatInfo);

    return res.json({ret:true,msg:'success'})
}
/**
 * 获得聊天室的成员列表
 * @type {getChatMemList}
 */
window.groupchat_c.getChatMemList =getChatMemList;
async function getChatMemList(req, res) {
    let {user_id, s_id,chatid,random, sign, begin, len} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    //如果已经加入，可以查看群聊成员列表。---使用function来进行回调查询对应的assert信息（rpc_api_util.s_query_token_list的函数升级了）
    let list =  await rpc_api_util.s_query_token_list(MSG_API_BASE,chatid,'relm',begin,len,true, function(msg_user_id){
        console.log('function:'+msg_user_id)
        if(!msg_user_id) return null;
        let user_id0 = USER_TOKEN_NAME+'_'+msg_user_id.split('_')[1];
        console.log('user_id0:'+user_id0)
        return rpc_api_util.s_query_token_info(USER_API_BASE,user_id0,'assert');
    });

    for(let i=0;i<list.length;i++)
    {
        let obj = list[i]
        delete obj.salt ;
        delete obj.pwd ;
        // if(obj.chat_type=='single' )
        // {
        //     obj.chatname = obj.user_a == user_id ? obj.name_b:obj.name_a;
        //     obj.chatlogo = null;
        // }
    }

    res.json({ret:true,msg:'success',list})
}

/**
 * 获得聊天室的消息列表
 * @type {getChatMsgList}
 */
window.groupchat_c.getChatMsgList =getChatMsgList;
async function getChatMsgList(req, res) {
    let {user_id, s_id,chatid,random, sign, begin, len} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})
    begin = parseInt(begin)
    len = parseInt(len)

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    //如果已经加入，可以查看群聊消息列表。
    let listRet = await rpc_query(MSG_API_BASE+'/chain/opcode',{token:chatid,opcode:'send',begin:begin*len,len:len})
    if(!listRet || !listRet.ret) return res.json({ret:false,msg:'msg list is empty'})

    let list = listRet.list;

    let queryObjInfoP = []
    let i = 0
    for(;i<list.length;i++)
    {
        let info = list[i]
        info.txjson = JSON.parse(info.txjson)
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        let msgObj = JSON.parse(info.txjson.opval);
        info.msg_obj = msgObj;
        delete info.txjson;
        // delete info.hash
        // delete info.sign 
        queryObjInfoP.push(  rpc_api_util.s_query_token_info(MSG_API_BASE,msgObj.msgid,'assert') )
    }

    let newObjs = []
    //查询分类数据
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))

        newObjs = rets;
        for(let k=0;k<rets.length;k++)
        {
            list[k].msg_info = newObjs[k];

            // //判断消息是否已被撤回。
            if(list[k].msg_info.status == 1)
            {
                list[k].msg_obj.msg = '该消息已被撤回';
                list[k].msg_obj.type = 'text'
                list[k].msg_info.type = 'text'
                //msgInfo.body = null;
            }
            // //判断消息是否已过期
            if(list[k].msg_info.status == 2)
            {
                list[k].msg_obj.msg = '该消息已过期';
                list[k].msg_obj.type = 'text'
                list[k].msg_info.type = 'text'
                //msgInfo.body = null;
            }
        }
    })

    res.json({ret:true,msg:'success',list})
}

/**
 * 获得聊天室的特定的消息列表
 * @type {getChatTypeMsgList}
 */
window.groupchat_c.getChatTypeMsgList =getChatTypeMsgList;
async function getChatTypeMsgList(req, res) {
    let {user_id, s_id,chatid,msg_type,random, sign, begin, len} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})

    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let tmpList = []
    let queryObjInfoP = []

    let ibegin =0, page_len = 100;
    let iPos = 0;

    //遍历消息，直到拿到相应的数据为止---相当于搜索数据。
    while(true)
    {
        let listRet = await rpc_query(MSG_API_BASE+'/chain/opcode',{token:chatid,opcode:'send',begin:ibegin,len:ibegin+page_len})
        //数据集为空就结束
        if(!listRet || !listRet.ret) break;
        let list = listRet.list;

        let i = 0
        for(;i<list.length;i++)
        {
            let info = list[i]
            info.txjson = JSON.parse(info.txjson)
            // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
            //放到数组中，等待处理。
            let msgObj = JSON.parse(info.txjson.opval);
            info.msg_obj = msgObj;
            //如果类型不相符
            if(msgObj.type != msg_type) continue;
            iPos++;
            //如果不在指定的下标范围内
            if(iPos<begin || iPos>=begin+len) break;

            delete info.txjson;
            tmpList.push(info)
            queryObjInfoP.push(  rpc_api_util.s_query_token_info(MSG_API_BASE,msgObj.msgid,'assert') )
        }
        //游标移动
        ibegin += page_len;
    }

    let newObjs = []
    //查询分类数据
    await Promise.all(queryObjInfoP).then(function(rets){
        JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))

        newObjs = rets;
        for(let k=0;k<rets.length;k++)
        {
            tmpList[k].msg_info = newObjs[k];
        }
    })

    res.json({ret:true,msg:'success',list:tmpList})
}
/**
 * 得到消息体
 */
window.groupchat_c.getChatMsgInfo =getChatMsgInfo;
async function getChatMsgInfo(req, res) {
    let {user_id, s_id,chatid,msgid,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    if(!msgid)  return res.json({ret: false, msg: 'msgid error'})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let msgInfo  = await rpc_api_util.s_query_token_info(MSG_API_BASE,msgid,'assert');
    if(!msgInfo) return res.json({ret: false, msg: "msg-info is empty"})

    // if(msgInfo.status==1)
    // {
    //     msgInfo.msg = '该消息已被撤回';
    //     msgInfo.body = null;
    // }

    if(msgInfo.chatid!=chatid && msgInfo.to!=chatid) return res.json({ret: false, msg: "query msg-info no permission"})
    msgInfo.ret  = true;
    msgInfo.xmsg = 'success';
    res.json(msgInfo);
}
/**
 * 得到最新的聊天窗口（包含最新聊天信息）。
 */
window.groupchat_c.getUserRecentMsgs =getUserRecentMsgs;
async function getUserRecentMsgs(req, res) {
    let {user_id, s_id,random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let chatList = await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',0,100000);
    if(!chatList) return res.json({ret:true,msg:'success',lisg:[]});
    
    // const mc_logos_list =mc_logos.get_list()// await require('../mc_logos').get_list();
    const fengjing_imgs_list =await fengjing_imgs.get_list()//[]// await require('../fengjing_imgs').get_list();

    let queryRecentMsgP = [];
    let keys = []
    for(let i =0;i<chatList.length;i++)
    {
        let chatObj = chatList[i]
        //rpc_api_util.s_query_token_info(MSG_API_BASE,chatObj.token_y,'send')
        queryRecentMsgP.push(rpc_query(MSG_API_BASE+'/chain/opcode',{token: chatObj.token_y,opcode:'send',begin:0,len:1})  );

        //得到chatlogo
        if(!chatList[i].chatlogo )
        {
            chatList[i].chatlogo = fengjing_imgs_list[chatList[i].token_y.split('_')[1].substring(15,17).charCodeAt()%fengjing_imgs_list.length]
        }
        keys.push(ll_config.redis_key+':readed_height:'+user_id+chatList[i].token_y)
    }

    //请求最新的聊天纪录
    await Promise.all(queryRecentMsgP).then(function(rets){
        JSON.stringify('queryRecentMsgP-rets:'+JSON.stringify(rets))
        for(let i =0;i<chatList.length;i++)
        {
            if(rets[i] && rets[i].ret) {
                chatList[i].recent_msg = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)//rets[i];
                chatList[i].height = rets[i].list[0].height;
                chatList[i].create_time_i = chatList[i].recent_msg.time_i;
                chatList[i].create_time = str_filter.GetDateTimeFormat(chatList[i].recent_msg.time_i)
            }else{
                chatList[i].recent_msg = {time_i:chatList[i].create_time_i,msg:''};//{time_i:-1};
            }
        }
    })

    //得到已读高度--在缓存中读取
    let results = await user_redis.mget(keys);
    // console.log('keys:'+keys)
    // console.log('results:'+results)
    for(let i=0;results && i<results.length;i++)
    {
        chatList[i].readed_height = results[i] ? results[i] :0;
    }

    //倒序排序----聊天窗口。
    chatList.sort(function(a,b)
    {
        return b.create_time_i - a.create_time_i;
    })

    res.json({ret:true,msg:'success',list:chatList});
}
/**
 * 获得已读高度
 */
window.groupchat_c.getUserRecentReadedHeight =getUserRecentReadedHeight;
async function getUserRecentReadedHeight(req, res) {
    let {user_id, s_id,chatid,msgid,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    if(!msgid)  return res.json({ret: false, msg: 'msgid error'})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    //let setRet =await user_redis.set(config.redis_key+':readed_height:'+user_id+chatid,readed_height,-1);/
    let heightStr = await user_redis.get(ll_config.redis_key+':readed_height:'+user_id+chatid)
    let readed_height = !heightStr ? 0 : heightStr*1;
    return res.json({ret:true,msg:'success',readed_height})
}
/**
 * 获得所有keys的名称--保存在文件中时需要加module.exports=  文件名为：readed_height_list.js
 */
window.groupchat_c.getUserRecentReadedHeightListFromRedis =getUserRecentReadedHeightListFromRedis;
async function getUserRecentReadedHeightListFromRedis(req, res) {
    let keysRet = await user_redis.redis_client.keysAsync(ll_config.redis_key+":readed_*");
    console.log('keysRet:'+JSON.stringify(keysRet))

    if(!keysRet) return res.json({ret:false,msg:'keys command failed'})
    let results = await user_redis.mget(keysRet)

    if(!results) return res.json({ret:false,msg:'mget command failed'})

    let tmpList = []
    for(let i=0;i<results.length;i++)
    {
        let obj = {key:keysRet[i],value:results[i]}
        tmpList.push(obj)
    }

    let retObj = {ret:true,msg:'success',list:tmpList};
    console.log('retObj:'+JSON.stringify(retObj))
    res.json(retObj);
}
/**
 * 将已读高度，重新加载回redis中，---方便redis的迁移
 */
window.groupchat_c.loadUserRecentReadedHeightListToRedis =loadUserRecentReadedHeightListToRedis;
async function loadUserRecentReadedHeightListToRedis(req, res) 
{
    let readedHeightList = null//ifileDb.getDataByKey('readed_height_list')// require('../file_temp/readed_height_list');
    console.log('readedHeightList:'+JSON.stringify(readedHeightList))
    if(!readedHeightList || !readedHeightList.ret || !readedHeightList.list)
    {
        return res.json({ret:false,msg:'readedHeightList is error'})
    }

    let list = readedHeightList.list;
    let cnt = 0;
    for(let i=0;i<list.length;i++)
    {
        let setRet = await user_redis.set(list[i].key,list[i].value);
        console.log('key:'+list[i].key+' value:'+list[i].value+' set-ret:'+setRet)
        cnt+= setRet ? 1:0;
    }
    console.log('set-success-cnt:'+cnt+" list-cnt:"+list.length)
    if(cnt>0) res.json({ret:true,msg:'success',cnt,data_size:list.length})
    else res.json({ret:false,msg:'set key-value failed',cnt,data_size:list.length})
}
// getUserRecentReadedHeightListFromRedis();
// loadUserRecentReadedHeightListToRedis();
///-----------------------------------------------------------------------------------------
window.groupchat_c.sendChatInfoModifyMsg=sendChatInfoModifyMsg
async function sendChatInfoModifyMsg(user_id,msg,chatid,mod_type,new_val,chatInfo) 
{
    // let userInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,user_id,'assert')
    // let msg = !msg ?userInfo.user_name+'修改了群资料':msg;
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;

    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'chat_mod'
    let obj = {type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{mod_type,new_val,chat_info:chatInfo},is_encrypted:false,encrypt_method:'aes256',status:0}

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) {
        console.log('sendChatInfoModifyMsg-RET: get msgid failed')
        return {ret: false, msg: "get msgid failed"}
    }

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet){
        console.log('sendChatInfoModifyMsg-RET: set msgid-info failed')
        return {ret: false, msg: "set msgid-info failed"}
    } 

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet){
        console.log('sendChatInfoModifyMsg-RET: send msgid2chat-msglist failed')
        return {ret: false, msg: "send msgid2chat-msglist failed"}
    } 

    console.log('sendChatInfoModifyMsg-RET: success')
    return {ret:true,msg:'success'}
}
/**
 * 修改了用户资料
 */
window.groupchat_c.sendUserInfoModifyMsg =sendUserInfoModifyMsg;
async function sendUserInfoModifyMsg(user_id,msg,userInfo) 
{
    userInfo = !userInfo ?  await rpc_api_util.s_query_token_info(MSG_API_BASE,user_id,'assert') :userInfo;
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;

    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'user_mod'
    let obj = {type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{user_info:userInfo},is_encrypted:false,encrypt_method:'aes256',status:0}

    let msgObj = {msgid,msg,type,time_i};

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid){
        console.log('sendUserInfoModifyMsg-ret: get msgid failed')
        return {ret: false, msg: "get msgid failed"}
    } 

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) {
        console.log('sendUserInfoModifyMsg-ret: set msgid-info failed')
        return {ret: false, msg: "set msgid-info failed"}
    }

    // let msg = !msg ?userInfo.user_name+'修改了用户资料':msg;
    //遍历该用户参与的所有的群，告知个人资料状态修改。
    let chatlist = await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'relm',0,100000);
    let i=0, cnt=0;
    for(;i<chatlist.length;i++)
    {
        let chatid =    chatlist[i].token_y;
        let sendRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
        cnt += sendRet ? 1:0;
    }

    console.log('sendUserInfoModifyMsg-ret: send mod-msg success, send_cnt:'+cnt+' chats_cnt:'+chatlist.length)

    return {ret:true,msg:'success',send_cnt:cnt,chats_cnt:chatlist.length};
}
/**
 * 阅后即焚公共函数
 */
window.groupchat_c.burnAfterReading =burnAfterReading;
async function burnAfterReading(user_id,msg_user_id,chatid,msgid,burn_time,burn_time_type){
    //把消息的id和过期时间缓存到redis
    //if( parseInt( burn_time_type) <= 60*60*30){
    let burnMsgObj = {'user_id':user_id,'msg_user_id':msg_user_id, 'chatid':chatid, 'msgid': msgid, 'burn_time': burn_time}
    if(parseInt( burn_time_type) <= 60*30){
         user_redis.rpush(ll_config.redis_key+':msg_burn_list:', JSON.stringify(burnMsgObj));//JSON.stringify(burnMsgObj)
    }
    else{//大于三十分钟的存到G节点msg_delete_list队列中
        let addRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'relb','add to msg_delete_list')
        if(!addRet) return res.json({ret:false, msg:'put this msg to msg_delete_list is failed!'})
        console.log('----------------------------------------消息成功放入g节点')
    }
}

/**
 * 撤回消息
 */
window.groupchat_c.recallMsg =recallMsg;
async function recallMsg(req, res) {
    let {user_id, s_id,chatid,msgid, random, sign} = str_filter.get_req_data(req);
    if(!msgid) return res.json({ret: false, msg: 'msgid error'})

    let msgInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,msgid,'assert');
    if(!msgInfo) return res.json({ret: false, msg: 'msg-info is empty'})
    if(chatid!=msgInfo.to) return res.json({ret: false, msg: 'param(chatid) unmatch'})
    if(msgInfo.status ==1 ) return res.json({ret: false, msg: 'this msg is already recalled!'})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;

    if(!req.is_manager && msgInfo.from!=msg_user_id && !req.is_console_user) return res.json({ret: false, msg: 'no permision to recall msg!'})

    //判断是否是系统消息
    let types = ['user_mod','msg_recall','chat_mod']
    for(let i=0;i<types.length;i++)
    {
        if(types[i] == msgInfo.type) return res.json({ret: false, msg: 'can not recall system-msg!'})
    }

    msgInfo.status = 1//recall-status
    msgInfo.type = 'text'
    msgInfo.msg = '该消息已被撤回'
    msgInfo.body =null;

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(msgInfo),'recall msg by '+msg_user_id)
    if(!assertRet) return res.json({ret: false, msg: 'update msg-info status failed!'})

    
    //同步消息
    notifyRecallMsg(user_id,msg_user_id,msgid,chatid);

    res.json({ret:true,msg:'success'})
}
//同步撤回消息的消息，通过 body来标记上一条消息。
async function notifyRecallMsg(user_id,msg_user_id,msgid,chatid)
{
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    let userName = userInfo?userInfo.user_name:'';
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'msg_recall'
    let msg = userName+'撤回了一条消息'

    let obj = {type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{recall_msgid:msgid},is_encrypted:false,encrypt_method:'aes256',status:0}//当前消息状态为0
    
    let newMsgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!newMsgid){
        console.log('notifyRecallMsg-ret: get msgid failed')
        return {ret: false, msg: "get msgid failed"}
    } 
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,newMsgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) {
        console.log('notifyRecallMsg-ret: set msgid-info failed')
        return {ret: false, msg: "set msgid-info failed"}
    }

    let msgObj = {msgid:newMsgid,msg,type,time_i}
    let sendRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet) return {ret: false, msg: "send msgObj to chatroom failed"}

    return {ret:true,msg:'success'}
}
/**
 * 发送复合消息（xmsg---重点是推送至头榜）
 * 
 * 兼容：话题、微头条、微博、群聊消息转发、付费消息、话题-帖子、评论、点赞、回复、赞赏（待完成扣费逻辑）等
 */
window.groupchat_c.sendXMsg =sendXMsg
async function sendXMsg(req,res)
{
    //注xobj为扩展的json
    let {user_id,chatid,xtype,xmsg,p_xmsgid,xobj,random,good_fee,label_type} = str_filter.get_req_data(req)

    if(!xmsg || xmsg.length>200) return res.json({ret:false,msg:'xmsg is error,len is 0 or len >200'})
    if(!xtype) return res.json({ret:false,msg:'xtype is error'})

    if(!chatid && label_type && label_type.startsWith(MSG_TOKEN_NAME+'_chat02')) 
    {
        chatid = label_type //强制设置为label_type
        req.params = req.params ? req.params :{}
        req.params.chatid = label_type
    }

    //判断是否是系统管理员
    let oldResJsonFunc = res.json
    let is_console_user = await new Promise(async (resolve)=>{
        //hack the res.json
        res.json = function(data){
            console.log('sendXMSG-console_filter-call-oldResJsonFunc-res-json:',data)
            resolve(false)
        }
        console_filter(req,res,function(){
            resolve(true)
        })
    })
    res.json = oldResJsonFunc

    //判断chatid的权限（系统管理员权限最大，无视群规则）
    if(chatid){
        let nextFlag = is_console_user || await new Promise(async (resolve)=>{
            let oldResJsonFunc = res.json
            //hack the res.json
            res.json = function(data){
                console.log('sendXMsg-vip-filter-call-oldResJsonFunc-res-json:',data)
                oldResJsonFunc(data)
                resolve(false)
            }
            vip_filter_send(req,res,function(){
                vip_filter(req,res,function(){
                    res.json = oldResJsonFunc
                    resolve(true)
                })
            })
        })
        console.log('sendXMsg-nextFlag:',nextFlag)
        if(!nextFlag){
            console.log('sendXMsg-vip-filter-no-pm:',nextFlag)
            return 
        }
    }

    //保存的可拓展json-obj的值
    xobj = !xobj? null : xobj.trim()
    if(xobj )
    try{
        //实现了aes256加密的兼容
        xobj = !xobj.startsWith('aes256') ? JSON.parse(xobj) :{aes256_objstr:xobj}
    }catch(ex){
        console.log('sendXMsg-parse-xobj-json:exception:'+ex,ex)
        return res.json({ret:false,msg:'xobj parse to json failed'})
    }
    xobj = !xobj? {} : xobj

    //查询操作的parent_xmsg（父xmsg）
    let p_xmsgInfo = null
    if(p_xmsgid){
        p_xmsgInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,p_xmsgid,'assert')
        if(!p_xmsgInfo){
            return res.json({ret:false,msg:'pxmsg-info is empty'})
        }
        // 去掉，普通用户也可点赞、评论、转发标签---使用的是rels的子评论op_relate，而不是reld（这点注意） //公共的标签亦禁止评论点赞等（可以收藏，但是不能点赞、评论、转发---避免干扰到label-reld---xmsg-items
        // if(!is_console_user && p_xmsgid.indexOf('xmsgl')>0)//标签禁止评论点赞等（除了收藏操作可以）--管理员可评论点赞转发
        // {
        //     return res.json({ret:false,msg:'p-xmsgid is label , can not operate by user!'})
        // }
    }

    let idPrefix = 'xmsg'
    if(label_type && label_type == 'newp') 
    {
        idPrefix = 'xmsglp'
    }
    else if(label_type && label_type == 'newm')
    {
        idPrefix = 'xmsglm'
        if(!is_console_user) return res.json({ret:false,msg:'[no pm] you are not system-manager , can not create xmsg-manager-label!'})
    }else if(label_type && label_type == 'newu')//创建的是用户标签
    {
        idPrefix = 'xmsglu'
    }

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let xmsgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,idPrefix);
    if(!xmsgid) return res.json({ret: false, msg: "get xmsgid failed"})

    //保存内容
    xobj.xtype = xtype
    xobj.xmsg  = xmsg
    xobj.xmsgid = xmsgid
    xobj.chatid = chatid
    xobj.user_id= user_id
    xobj.p_xmsgid = p_xmsgid //操作的父话题（父微博、父头条内容）
    //避免因评论、点赞、转发计数，而影响到父xmsg的p_xmsg_info被设置为空 2023-6-1
    xobj.p_xmsg_info = p_xmsgInfo ? Object.assign({},p_xmsgInfo) :null 
    //避免直接上传这些参数 2023-10-16修复
    delete xobj.good_cnt
    delete xobj.reply_cnt
    delete xobj.retw_cnt
    delete xobj.xbuyed
    delete xobj.xbuyed_xprice
    if(xobj.p_xmsg_info)
    {
        delete xobj.p_xmsg_info.p_xmsg_info //不进行递归存储，否则会越来越大（数据量）
    }
    xobj.time_i = parseInt(Date.now()/1000)
    xobj.time_str= str_filter.GetDateTimeFormat(xobj.time_i)

    //如果存在着价值，则给对方转账
    if(p_xmsgInfo && isFinite(p_xmsgInfo.xprice) && p_xmsgInfo.xprice>0 
        && ['retw','good','reply'].indexOf(xtype)<0)//不是点赞、评论、转发，xtype应为rels
    {
        if(p_xmsgInfo.user_id == user_id) return res.json({ret:false,msg:'[Error]can not buy your owner xmsg!'})
        let rmbUserId = await order_c.s_queryUserRMBToken(user_id)
        let userSendRet = await rpc_query(RMB_API_BASE + "/send", {
            token_x: rmbUserId,
            token_y: RMB_TOKEN_ROOT.split('_')[0]+'_'+p_xmsgInfo.user_id.split('_')[1],
            opval: p_xmsgInfo.xprice , //1元或100DTNS
            extra_data: JSON.stringify(p_xmsgInfo) //支付的订单信息
        })
        if(!userSendRet|| !userSendRet.ret){
            return res.json({ret:false,msg:'buy p-xmsg-id need: '+p_xmsgInfo.xprice+'$ ,but your account is not enougth'})
        }
        xobj.xbuyed = true //设置为已购
        xobj.xbuyed_xprice = p_xmsgInfo.xprice//已购的价格金额为父xprice
        //用于判断是否已购 ***
        let relBuyedRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,p_xmsgInfo.xmsgid,msg_user_id,'relb',xobj)
        if(!relBuyedRet) return res.json({ret:false,msg:'user-id relate to buyed-list failed'})
    }
    
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,xmsgid,'assert',JSON.stringify(xobj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set xmsgid-info failed"})

    //判断是新建标签，还是添加至标签  2023-10-17
    if(label_type &&( label_type == 'newp' || label_type=='newm'))//新建了一个标签
    {
        if(!is_console_user) return res.json({ret:false,msg:'no pm to new label'})
        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,xmsgid,'rell','xmsg-label')
        if(!relLabelRet) return res.json({ret:false,msg:'xmsgid relate to system-label-list failed'})
    }
    else if(label_type && label_type =='newu')//新建一个用户标签
    {
        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,xmsgid,'rell','user-xmsg-label')
        if(!relLabelRet) return res.json({ret:false,msg:'xmsgid relate to user-label-list failed'})
    }
    else if(label_type && label_type.indexOf('xmsgl')>0) //用户标签、公共标签、管理员标签
    {
        // let label_list = JSON.parse('label_type') ---仅支持一个xmsgl列表ID添加
        //如果是非公共的，须管理员权限的才能添加（标签xmsgid中包含了xmsglm为manager-label，否则为公共标签）
        if(label_type.indexOf('xmsglm')>0 && !is_console_user) return res.json({ret:false,msg:'no pm to add xmsg to label'})
        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,label_type,xmsgid,'reld','add-xmsg-to-label')
        if(!relLabelRet) return res.json({ret:false,msg:'xmsgid relate to label failed'})
    }
    else if(label_type && label_type.startsWith(MSG_TOKEN_NAME+'_chat02'))//群标签
    {
        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,label_type,xmsgid,'reld','add-xmsg-to-groupchat-label')
        if(!relLabelRet) return res.json({ret:false,msg:'xmsgid relate to groupchat-label failed'})
    }
    else if(label_type)
    {
        return res.json({ret:false,msg:'label_type('+label_type+') is error'})
    }

    //添加至我的发布----相当于草稿箱（relp）---在下榜cancelXMsg操作时，不会被移除 2023-10-17新增
    let relUserPostRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,xmsgid,'relp','my-xmsg-post-list')
    if(!relUserPostRet) return res.json({ret:false,msg:'xmsgid relate to msg_userid-post-list failed'})

    let relUserRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,xmsgid,'reld','xmsg')
    if(!relUserRet) return res.json({ret:false,msg:'xmsgid relate to msg_userid failed'})

    //评论、转发、点赞等
    let op_relate = null
    let pxmsg_cnt_update_ret = false
    if(p_xmsgid){
        switch(xtype){
            case 'good':op_relate = 'relo';//赞的消息体纪录列表，relg为user绑定列表（不一样--去重了）
                break
            case 'reply':op_relate = 'relr' //评论
                break
            case 'retw':op_relate = 'rele' //转发
                break;
            default: op_relate = 'rels'//null---可用于表单引擎和购买p-xmsg-id
        }
        if(!op_relate) return res.json({ret:false,msg:'xtype('+xtype+') is error'})

        let listRet = await rpc_query(MSG_API_BASE+'/chain/relations',{token:p_xmsgid,opcode: xtype=='good'?'relg':op_relate,isx:true,begin:0,len:10000000})
        let list = !listRet ||!listRet.ret ? [] : listRet.list;
        p_xmsgInfo[xtype+'_cnt'] = list.length+1

        //如果是点赞，用户侧也要关联
        if(xtype=='good'){
            let relGoodRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,p_xmsgid,msg_user_id,'relg','pxmsg-good operation')
            if(!relGoodRet) return res.json({ret:false,msg:'xmsgid relate-good to p_xmsgid failed'})
        }

        //关联（评论、点赞、转发）
        let relPXmsgRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,p_xmsgid,xmsgid,op_relate,'relate to p_xmsg - xtype:'+xtype)
        if(!relPXmsgRet) return res.json({ret:false,msg:'xmsgid relate-'+xtype+' to p_xmsgid failed'})

        //2023-6-2-关联父p_xmsgid（所有的子评论、子点赞、子转发均关联该p_xmsgid）---用于形成树结构（类似dweb-xmsgs-tree）
        relPXmsgRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,p_xmsgid,xmsgid,'rels','relate to p_xmsg')
        if(!relPXmsgRet) return res.json({ret:false,msg:'xmsgid relate to p_xmsgid failed'})

        //更新计数
        let assertCntRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,p_xmsgid,'assert',JSON.stringify(p_xmsgInfo),xmsgid);
        console.log('assertCntRet:pxmsg_cnt_update_ret:',assertCntRet)
        pxmsg_cnt_update_ret = assertCntRet
    }
    //须扣费（不是管理员均须扣费---VIP用户待考虑优惠情形）
    //2023-11-16新增xobj.send_dweb_flag参数，用于开关是否推送至头榜
    if(window.g_dweb_fee && !is_console_user && xobj.send_dweb_flag)// !(await manager_c.isManagerUid(user_id))){
    {
        //计算发送头榜的费用
        let fee = good_fee && ''+parseInt(good_fee) == good_fee ? parseInt(good_fee) : g_dweb_fee//1
        //fee不能过小（过小则不利于内容付费）
        if(p_xmsgid && p_xmsgInfo.min_good_fee && p_xmsgInfo.min_good_fee > fee)
        {
            return res.json({ret:false,msg:'good_fee error: good_fee < pxmsg-min-good-fee'})
        }
        let rmbUserId = await order_c.s_queryUserRMBToken(user_id)
        let userSendRet = await rpc_query(RMB_API_BASE + "/send", {
            token_x: rmbUserId,
            token_y: RMB_TOKEN_ROOT,
            opval: fee , //1元或100DTNS
            extra_data: JSON.stringify(xobj)
        })
        if(!userSendRet|| !userSendRet.ret){
            return res.json({ret:false,msg:'xmsg need fee: 1$ ,but your account is not enougth'})
        }
    }
    //推荐至头榜
    let relTBangRet =!xobj.send_dweb_flag ? true: await rpc_api_util.s_save_into_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,xmsgid,'reld','xmsg')
    if(!relTBangRet) return res.json({ret:false,msg:'xmsgid relate to toubang-list failed'})

    let ret = {ret:true,msg:'success',xmsgid}
    //关联聊天室
    if(chatid){ //这里重复进行chatid关联xmsgid（chatid亦起到一个标签的作用）
        let relChatRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,chatid,xmsgid,'reld','xmsg')
        ret.relate_chat_ret = relChatRet
    }
    if(op_relate){
        ret.pxmsg_cnt_update_ret  = pxmsg_cnt_update_ret
    }

    res.json(ret)
}
/**
 * 判断是否已购xmsgid
 */
window.groupchat_c.buyedXMsg = buyedXMsg
async function buyedXMsg(req,res)
{
    let {user_id,xmsgid} = str_filter.get_req_data(req)
    let is_console_user = await new Promise(async (resolve)=>{
        let oldResJsonFunc = res.json
        //hack the res.json
        res.json = function(data){
            console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
            res.json = oldResJsonFunc
            resolve(false)
        }
        console_filter(req,res,function(){
            res.json = oldResJsonFunc
            resolve(true)
        })
    })
    console.log('cancelXMsg-is_console_user:',is_console_user)
    let bFlag = is_console_user
    let xmsgInfo =  await rpc_api_util.s_query_token_info(MSG_API_BASE,xmsgid,'assert')
    // if(bFlag) return res.json({ret:true,msg:'success',is_console_user})
    //判断是否是头榜发送人
    if(!xmsgInfo) return res.json({ret:false,msg:'xmsg is empty'})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let is_buyed_flag = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,xmsgid,msg_user_id,'relb')
    if(is_buyed_flag || is_console_user || xmsgInfo.user_id==user_id) return res.json({ret:true,msg:'success',is_console_user,is_buyed_flag,is_owner_flag:xmsgInfo.user_id==user_id})
    else return res.json({ret:false,msg:'not buyed'})
}
/**
 * 撤消头榜
 */
window.groupchat_c.cancelXMsg = cancelXMsg
async function cancelXMsg(req,res)
{
    let {user_id,xmsgid,label_type} = str_filter.get_req_data(req)

    //判断是否是控制台权限（系统用户管理员）---不直接返回json，依然判断xmsgInfo.user_id与chatid是否拥有用户或群管理员权限
    let is_console_user = await new Promise(async (resolve)=>{
        let oldResJsonFunc = res.json
        //hack the res.json
        res.json = function(data){
            console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
            res.json = oldResJsonFunc
            resolve(false)
        }
        console_filter(req,res,function(){
            res.json = oldResJsonFunc
            resolve(true)
        })
    })
    console.log('cancelXMsg-is_console_user:',is_console_user)
    let bFlag = is_console_user
    let xmsgInfo =  await rpc_api_util.s_query_token_info(MSG_API_BASE,xmsgid,'assert')
    let chatid = null ;//xmsgInfo.chatid //不默认从群中 清理该内容（应在群标签下进行下榜[群标签]）操作更友好

    if(!bFlag){
        //判断是否是头榜发送人
        if(!xmsgInfo) return res.json({ret:false,msg:'xmsg is empty'})
        bFlag = xmsgInfo.user_id == user_id

        //判断是否是管理员（当前状态为群主方可）
        if(!bFlag){
            if(chatid)
            {
                let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
                bFlag = chatInfo && chatInfo.create_user_id ==user_id
            }
        }
    }
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+xmsgInfo.user_id.split('_')[1]:xmsgInfo.user_id;//删除的是发送头榜的用户的内容（下榜，避免通过联系人主页看到头榜内容）
    //仅清理标签，不清理dweb头榜、我的发布等头榜列表内容 2023-10-17新增
    let delLabelRet = true
    if(label_type)
    {
        delLabelRet = false
        //msg_user_id须为当前用户
        msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
        if(label_type=='relf' || label_type == 'relp') //删除用户标签在此
        {
            delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,xmsgid,label_type,user_id+' cancel xmsg from user-'+label_type)
        }
        else if(label_type == 'rels')
        {
            if(!xmsgInfo || !xmsgInfo.p_xmsgid || !xmsgInfo.p_xmsg_info) return res.json({ret:false,msg:'it is not sub-xmsg'})
            //判断权限，是自己的子榜或者是父榜是自己的，或者自己是管理员
            if(xmsgInfo.user_id != user_id && xmsgInfo.p_xmsg_info.user_id != user_id && !is_console_user) return res.json({ret:false,msg:'no pm to remove this label-type-rels'})
            delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,xmsgInfo.p_xmsgid,xmsgid,'rels',user_id+' cancel xmsg from user-'+label_type)
            rpc_api_util.s_del_from_token_list(MSG_API_BASE,xmsgInfo.p_xmsgid,xmsgid,'relg',user_id+' cancel xmsg from user-good-'+label_type)
            rpc_api_util.s_del_from_token_list(MSG_API_BASE,xmsgInfo.p_xmsgid,xmsgid,'relr',user_id+' cancel xmsg from user-reply'+label_type)
            rpc_api_util.s_del_from_token_list(MSG_API_BASE,xmsgInfo.p_xmsgid,xmsgid,'rele',user_id+' cancel xmsg from user-retw'+label_type)
        }
        else if(label_type == 'rell')
        {
            //是用户标签，须判断是否是本人操作
            let labelInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,xmsgid,'assert')
            console.log('cancelXMsg-labelInfo:',labelInfo,xmsgid,label_type)
            if(!labelInfo) return res.json({ret:false,msg:'user-label-info is empty'})
            if(labelInfo.user_id != user_id) return res.json({ret:false,msg:'this user-label-info not your'})
            delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,xmsgid,label_type,user_id+' cancel user-label from my-user-label-list')
        }
        else if(label_type == 'user-all'){
            delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,xmsgid,'relf',user_id+' cancel xmsg from user-relf-'+label_type)
            let xdelLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,xmsgid,'relp',user_id+' cancel xmsg from user-relp-'+label_type)
            delLabelRet = delLabelRet && xdelLabelRet
        }else if(label_type == 'list')//从list中清理标签（删除标签）
        {
            if(!is_console_user) return res.json({ret:false,msg:'no pm to remove label from labels-list'})
            delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,MSG_TOKEN_ROOT, xmsgid,'rell',user_id+' cancel label from system:'+label_type)
        }
        //清除掉标签关联
        else if(label_type.indexOf('xmsgl')>0)
        {
            if(is_console_user)
            {
                delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,label_type,xmsgid,'reld',user_id+'manager cancel xmsg from label:'+label_type)
            }
            //不是管理员，标签是公共的，但是xmsg不是自己发布的
            else if(label_type.indexOf('xmsglp')>0 )
            {
                if(xmsgInfo.user_id != user_id) return res.json({ret:false,msg:'no pm: this xmsg is not your, can not remove it'})
                delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,label_type,xmsgid,'reld',user_id+' cancel xmsg from public-label:'+label_type)
            }
            //不是管理员，标签是管理员的
            else if(label_type.indexOf('xmsglm')>0)
            {
                return res.json({ret:false,msg:'no pm: you are not system-manager, cat remove xmg from manager-label'})
            }
            //普通用户标签----标签是自己的就是移除xmsgid，不管是管理员关联过来的，还是自己关联的
            else if(label_type.indexOf('xmsglu')>0)
            {
                let labelInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,label_type,'assert')
                console.log('cancelXMsg-labelInfo:',labelInfo,label_type)
                if(!labelInfo) return res.json({ret:false,msg:'user-label-info is empty'})
                if(labelInfo.user_id != user_id) return res.json({ret:false,msg:'this user-label-info not your'})
                delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,label_type,xmsgid,'reld',user_id+' cancel xmsg from user-label:'+label_type)
            }
            else 
            {
                console.log('cancelXMsg-error-label_type:',label_type)
                delLabelRet = false
            }
        }
        else if(label_type.startsWith(MSG_TOKEN_NAME+'_chat02'))//群标签
        {
            //判断管理员权限
            req.params = req.params ? req.params :{}
            req.params.chatid = label_type
            //系统管理员权限，有权力清除群的头榜内容
            let nextFlag = is_console_user || await new Promise(async (resolve)=>{
                let oldResJsonFunc = res.json
                //hack the res.json
                res.json = function(data){
                    console.log('sendXMsg-vip-filter-call-oldResJsonFunc-res-json:',data)
                    oldResJsonFunc(data)
                    resolve(false)
                }
                vip_filter_manager(req,res,function(){
                    vip_filter(req,res,function(){
                        res.json = oldResJsonFunc
                        resolve(true)
                    })
                })
            })
            if(!nextFlag) return false
            delLabelRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,label_type,xmsgid,'reld',user_id+' cancel xmsg from user-label:'+label_type)
        }
        return res.json({ret:delLabelRet,msg:delLabelRet ? 'success':'remove xmsg-item from label failed!'})
    }

    //普通的下榜须是自己是xmsg作者或是管理员
    if(!bFlag){
        return res.json({ret:false,msg:'[failed]no pm to cancel dweb-xmsg!',chatid})
    }

    let delRelDweb =  await rpc_api_util.s_del_from_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,xmsgid,'reld',user_id+' cancel xmsg')
    let delRelChatRet = !chatid ? true: await rpc_api_util.s_del_from_token_list(MSG_API_BASE,chatid,xmsgid,'reld',user_id+' cancel xmsg')
    let delRelUserRet = await rpc_api_util.s_del_from_token_list(MSG_API_BASE,msg_user_id,xmsgid,'reld',user_id+' cancel xmsg')
    if(delRelDweb && delRelChatRet && delRelUserRet){
        return res.json({ret:true,msg:'success',chatid})
    }else{
        return res.json({ret:false,msg:'cancel dweb xmsg failed',delRelDweb,delRelChatRet,delRelUserRet,chatid})
    }
}
/**
 * 添加xmsg to label-list
 */
window.groupchat_c.addXMsgToLabel =addXMsgToLabel
async function addXMsgToLabel(req,res)
{
    //注xobj为扩展的json
    let {user_id,xmsgid,label_type,note} = str_filter.get_req_data(req)
    let xmsgInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,xmsgid,'assert');
    if(!xmsgInfo) return res.json({ret:false,msg:'xmsg-info is empty'})
    if(note && note.length>100) return res.json({ret:false,msg:'add-label-note.length max than 100'})

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    if(label_type=='relf')// || label_type == 'relp' || label_type=='user-all')
    {
        let relLabelRet = false
        relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,xmsgid,label_type,note?note:'')//'add-xmsg-to-my-label-'+label_type)
        // if(label_type == 'relp' || label_type=='relf') 
        // if(label_type=='user-all')
        if(!relLabelRet) return res.json({ret:false,msg:'xmsgid relate to my-label-'+label_type+' failed'})
        else return res.json({ret:true,msg:'success'})
    }else if(label_type =='rell')
    {
        if(xmsgid.indexOf('xmsglu') <0) return res.json({ret:false,msg:'xmsgid not user-label-id'})
        let labelInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,xmsgid,'assert')
        console.log('addXMsgToLabel-labelInfo:',labelInfo,label_type)
        if(!labelInfo) return res.json({ret:false,msg:'user-label-info is empty'})
        if(labelInfo.user_id != user_id) return res.json({ret:false,msg:'this user-label-info not your'})
        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,msg_user_id,xmsgid,'rell','add xmsg-label-id to user-label-list:'+label_type)
        if(relLabelRet) return res.json({ret:true,msg:'success'})
        else return res.json({ret:false,msg:'add label to user-label-list failed'})
    }

    let oldResJsonFunc = res.json
    let is_console_user = await new Promise(async (resolve)=>{
        //hack the res.json
        res.json = function(data){
            console.log('addXMsgToLabel-console_filter-call-oldResJsonFunc-res-json:',data)
            resolve(false)
        }
        console_filter(req,res,function(){
            resolve(true)
        })
    })
    res.json = oldResJsonFunc
    console.log('addXMsgToLabel-is_console_user:',is_console_user)
    if(label_type == 'dweb')//将xmsgid推荐至头榜
    {
        //须扣费（不是管理员均须扣费---VIP用户待考虑优惠情形）
        if(window.g_dweb_fee && !is_console_user)// !(await manager_c.isManagerUid(user_id))){
        {
            //计算发送头榜的费用
            let fee =  g_dweb_fee//1
            let rmbUserId = await order_c.s_queryUserRMBToken(user_id)
            let userSendRet = await rpc_query(RMB_API_BASE + "/send", {
                token_x: rmbUserId,
                token_y: RMB_TOKEN_ROOT,
                opval: fee , //1元或100DTNS
                extra_data: JSON.stringify(xmsgInfo)
            })
            if(!userSendRet|| !userSendRet.ret){
                return res.json({ret:false,msg:'xmsg need fee: 1$ ,but your account is not enougth'})
            }
        }
        let relTBangRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,xmsgid,'reld','xmsg')
        if(!relTBangRet) return res.json({ret:false,msg:'xmsgid relate to dweb-list failed'})
        else return res.json({ret:true,msg:'success'})
    }
    //将标签添加到labels-list
    else if(label_type && label_type == 'list')
    {
        if(xmsgid.indexOf('xmsgl') <0) return res.json({ret:false,msg:'add to system-label-failed, xmsgid('+xmsgid+') is error'})
        if(!is_console_user) return res.json({ret:false,msg:'no pm to add label_type to labels-list'})
        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,xmsgid,'rell','xmsg-label')
        if(!relLabelRet) return res.json({ret:false,msg:'xmsgid relate to system-label-list failed'})
        return res.json({ret:true,msg:'success'})
    }
    //将xmsgid关联到标签（label_type）
    else if(label_type && label_type.indexOf('xmsgl')>0)
    {
        //是管理员，或者是公共的标签（可供添加---除非是管理员，否则该xmsg须是自己发布的）
        if(label_type.indexOf('xmsglp')>0)
        {
            if(!is_console_user && xmsgInfo.user_id != user_id) return res.json({ret:false,msg:'no pm: this xmsg is not your, and you are not system-manager'})
            let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,label_type,xmsgid,'reld','add-xmsg-to-label')
            if(relLabelRet) //return res.json({ret:false,msg:'xmsgid relate to label('+label_type+') failed'})
            return res.json({ret:true,msg:'success'})
        }
        //管理员标签，仅管理员能操作
        else if(label_type.indexOf('xmsglm')>0)
        {
            if(!is_console_user)  return res.json({ret:false,msg:'no pm: you are not system-manager'})
            let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,label_type,xmsgid,'reld','add-xmsg-to-manager-label')
            if(relLabelRet) return res.json({ret:true,msg:'success'})
        }
        //普通用户标签----仅判断是否是管理员，或者用户标签是否是user-id的
        else if(label_type.indexOf('xmsglu')>0)
        {
            let labelInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,label_type,'assert')
            console.log('addXMsgToLabel-labelInfo:',labelInfo,label_type)
            if(!labelInfo) return res.json({ret:false,msg:'user-label-info is empty'})
            if(!is_console_user && labelInfo.user_id != user_id) return res.json({ret:false,msg:'this user-label-info not your'})
            let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,label_type,xmsgid,'reld','add xmsg to user-label:'+label_type)
            if(relLabelRet) return res.json({ret:true,msg:'success'})
        }
    }
    //标签是群（小店或直播间亦是群）
    else if(label_type && label_type.startsWith(MSG_TOKEN_NAME+'_chat02'))
    {
        //判断管理员权限
        req.params = req.params ? req.params :{}
        req.params.chatid = label_type
        let nextFlag =is_console_user || await new Promise(async (resolve)=>{
            let oldResJsonFunc = res.json
            //hack the res.json
            res.json = function(data){
                console.log('sendXMsg-vip-filter-call-oldResJsonFunc-res-json:',data)
                oldResJsonFunc(data)
                resolve(false)
            }
            //发送内容权限即可，不须管理员权限
            vip_filter_send(req,res,function(){
                vip_filter(req,res,function(){
                    res.json = oldResJsonFunc
                    resolve(true)
                })
            })
        })
        if(!nextFlag) return false

        let relLabelRet = await rpc_api_util.s_save_into_token_list(MSG_API_BASE,label_type,xmsgid,'reld',user_id+' add xmsg to chat-label:'+label_type)
        if(relLabelRet) return res.json({ret:true,msg:'success'})
    }
    //failed
    return res.json({ret:false,msg:'add xmsg to label-list failed , label_type:'+label_type})
}
/**
 * 列举复合型消息列表（头榜、评论、点赞、转发、群头榜dwebs列表）
 */
window.groupchat_c.listXMsgs = listXMsgs
async function listXMsgs(req,res)
{
    //注xobj为扩展的json
    let {user_id,label_type,chatid,p_xmsgid,p_userid,xtype,random,begin,len} = str_filter.get_req_data(req)

    let oldResJsonFunc = res.json
    let is_console_user = await new Promise(async (resolve)=>{
        //hack the res.json
        res.json = function(data){
            console.log('addXMsgToLabel-console_filter-call-oldResJsonFunc-res-json:',data)
            resolve(false)
        }
        console_filter(req,res,function(){
            resolve(true)
        })
    })
    res.json = oldResJsonFunc
    console.log('addXMsgToLabel-is_console_user:',is_console_user)
    //label_type标签查询 2023-10-17新增
    //1-relp为我的发表   2-relf为我的收藏  etc..
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    if(label_type == 'relp' || label_type=='relf' || label_type=='rell')
    {
        // let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
        let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,label_type,begin,len)
        if(listRet && listRet.length>0){
            return res.json({ret:true,msg:'success',list:listRet})
        } 
        return res.json({ret:false,msg:'my-label('+label_type+')-xmsg-list is empty'})
    }else if(label_type && (label_type.indexOf('xmsgl')>0 || label_type.startsWith(MSG_TOKEN_NAME+'_chat02'))) //标签（与普通xmsg无二致，仅是多了个l）2023-10-17
    {
        if(label_type.startsWith(MSG_TOKEN_NAME+'_chat02')) //判断群权限
        {
            if(!chatid || label_type!=chatid) //取label_type为要
            {
                req.params = req.params ? req.params :{}
                req.params.chatid = label_type
            }
            let nextFlag =is_console_user || await new Promise(async (resolve)=>{
                let oldResJsonFunc = res.json
                //hack the res.json
                res.json = function(data){
                    console.log('sendXMsg-vip-filter-call-oldResJsonFunc-res-json:',data)
                    oldResJsonFunc(data)
                    resolve(false)
                }
                vip_filter_visit(req,res,function(){
                    vip_filter(req,res,function(){
                        res.json = oldResJsonFunc
                        resolve(true)
                    })
                })
            })
            if(!nextFlag) return false //已经在代码中返回结果res.json
        }
        //【注意】，直接使用p_xmsgid为label-type更方便---但是不知道语义是查询标签【等价方法】
        let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,label_type,'reld',begin,len)
        if(listRet && listRet.length>0){
            return res.json({ret:true,msg:'success',list:listRet})
        } 
        return res.json({ret:false,msg:'label-xmsg-list is empty'})
    }
    else if(label_type == 'list')//查询所有的标签，置于root-rell的list之下
    {
        let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,'rell',begin,len)
        if(listRet && listRet.length>0){
            return res.json({ret:true,msg:'success',list:listRet})
        } 
        return res.json({ret:false,msg:'query-xmsg-all-labels-list is empty'})
    }
    // else if(label_type == 'ulist')----已使用label_type:rell来获取
    //三种情形：1-chatid之下的头榜内容、2-p_xmsgid之下的xtype类型的头榜内容（例如评论、点赞等）、3-广场的头榜内容列表
    if(!chatid && !p_xmsgid && !p_userid)
    {
        let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,MSG_TOKEN_ROOT,'reld',begin,len)
        if(!listRet || listRet.length<=0) return res.json({ret:false,msg:'list is empty'})
        // let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
        //遍历分析列表，是否是付费可见内容
        for(let i=0;i<listRet.length;i++)
        {
            let obj = listRet[i]
            if(obj.xtype == 'good_fee')//须打赏费用才能查看详细内容
            {
                let is_ok_flag = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,obj.xmsgid,msg_user_id,'relg')
                //如果未打赏，无法查阅该实体内容
                if(!is_ok_flag) delete obj.detail_xobj 
            }
        }
        if(listRet && listRet.length>0) return res.json({ret:true,msg:'success',list:listRet})
    }
    if(chatid){
        let nextFlag = is_console_user || await new Promise(async (resolve)=>{
            let oldResJsonFunc = res.json
            //hack the res.json
            res.json = function(data){
                console.log('listXMsgs-vip-filter-call-oldResJsonFunc-res-json:',data)
                oldResJsonFunc(data)
                resolve(false)
            }
            vip_filter_visit(req,res,function(){
                vip_filter(req,res,function(){
                    res.json = oldResJsonFunc
                    resolve(true)
                })
            })
        })
        console.log('listXMsgs-nextFlag:',nextFlag)
        if(!nextFlag){
            console.log('listXMsgs-vip-filter-no-pm:',nextFlag)
            return 
        }

        let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,chatid,'reld',begin,len)
        if(listRet && listRet.length>0) return res.json({ret:true,msg:'success',list:listRet})
        return res.json({ret:false,msg:'list is empty'})
    }
    else if(p_xmsgid){
        switch(xtype){
            case 'good':op_relate = 'relg';//赞的消息体纪录列表，relg为user绑定列表（不一样--去重了）
                break
            case 'reply':op_relate = 'relr' //评论
                break
            case 'retw':op_relate = 'rele' //转发
                break;
            default: op_relate = 'rels'//null //评论、转发、点赞等所有的xtype
        }
        if(!op_relate) return res.json({ret:false,msg:'xtype('+xtype+') is error'})
        if(xtype=='good'){
            let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,p_xmsgid,op_relate,begin,len,true,null)
            if(listRet && listRet.length>0) return res.json({ret:true,msg:'success',list:listRet})
            return res.json({ret:false,msg:'good-user-list is empty'})
        }else{
            let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,p_xmsgid,op_relate,begin,len)
            if(listRet && listRet.length>0){
                //如果显示的是子xmsg列表，仅第一个才返回p_info于index=0
                // if(op_relate=='rels' && parseInt(begin)==0){
                //     let p_info = await rpc_api_util.s_query_token_info(MSG_API_BASE,p_xmsgid,'assert')
                //     if(!p_info){
                //         return res.json({ret:false,msg:'pinfo is empty'})
                //     }
                //     listRet = [p_info].concat(listRet)
                //     p_info.me_is_pinfo_flag = true //显示为我是主信息
                // }
                return res.json({ret:true,msg:'success',list:listRet})
            } 
            return res.json({ret:false,msg:'pxmsg-xtype('+xtype+')-list is empty'})
        }
    }else if(p_userid)
    {
        let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+p_userid.split('_')[1]:p_userid;
        let listRet =  await rpc_api_util.s_query_token_list(MSG_API_BASE,msg_user_id,'reld',begin,len)
        if(listRet && listRet.length>0){
            return res.json({ret:true,msg:'success',list:listRet})
        } 
        return res.json({ret:false,msg:'puser-xmsg-list is empty'})
    }
}
/**
 * 发送消息
 * @type {sendMsgTypeText}
 */
window.groupchat_c.sendMsgTypeText =sendMsgTypeText;
async function sendMsgTypeText(req, res) {
    let {user_id, s_id,chatid,msg, random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    if(!msg) return res.json({ret: false, msg: 'msg error'})
    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeText:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeText:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'text'
    
    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:null,is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}
        
    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})
    
    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}


/**
 * 发送链接
 * @type {sendMsgTypeLink}
 * body:{title:’标题’,desc:’内容摘要’,url:’http://abc.com’}
 */
window.groupchat_c.sendMsgTypeLink =sendMsgTypeLink;
async function sendMsgTypeLink(req, res) {
    let {user_id, s_id,chatid,msg,link_id,title,desc, url,link_type,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    if(!msg) return res.json({ret: false, msg: 'msg error'})
    if(!link_id) return res.json({ret: false, msg: 'link_id error'})
    if(!title) return res.json({ret: false, msg: 'title error'})
    if(!desc) return res.json({ret: false, msg: 'desc error'})
    if(!url) return res.json({ret: false, msg: 'url error'})
    if(!link_type) return res.json({ret: false, msg: 'url error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeLink:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeLink:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'link';
    let obj = {chatid,type:'link',msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{link_id,title,desc, url,link_type},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}


/**
 * 发送文件
 * @type {sendMsgTypeFile}
 * body:{file_id:’11’,title:’文件名’,fmt:’内容格式’,url:’http://abc.com’,filename:’我的文档名称.doc’}
 */
window.groupchat_c.sendMsgTypeFile =sendMsgTypeFile;
async function sendMsgTypeFile(req, res) {
    let {user_id, s_id,chatid,msg,file_id,title,fmt, url,filename,file_size,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    //if(!msg) return res.json({ret: false, msg: 'msg error'})
    msg = '文件消息（'+filename+')';
    if(!file_id) return res.json({ret: false, msg: 'file_id error'})
    if(!title) return res.json({ret: false, msg: 'title error'})
    if(!fmt) return res.json({ret: false, msg: 'fmt error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})
    if(!filename) return res.json({ret: false, msg: 'filename error'})
    //if(!file_size || file_size!=parseInt(file_size)) return res.json({ret: false, msg: 'file_size error'})
    file_size = !file_size || file_size!=parseInt(file_size) ? 0:parseInt(file_size)

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeFile:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeFile:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'file'

    //这里是文件信息的保存
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,file_id,'assert');
    if(!fileInfo) return res.json({ret: false, msg: "get file-info failed"})
    fileInfo.chatid = chatid;
    let saveFileInfoRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,file_id,'assert',JSON.stringify(fileInfo),'save chatid to file-info');
    if(!saveFileInfoRet) return res.json({ret: false, msg: "save chatid to file-info failed"})

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{file_id,title,fmt, url,filename,file_size},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
    burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}

/**
 * 发送图片
 * @type {sendMsgTypeImg}
 * body:{img_id:’’,url:’’,img_fmt:’’,img_name:’’}
 */
window.groupchat_c.sendMsgTypeImg =sendMsgTypeImg;
async function sendMsgTypeImg(req, res) {
    let {user_id, s_id,chatid,msg,img_name,img_id,img_fmt, url,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    //if(!msg) return res.json({ret: false, msg: 'msg error'})
    msg = '图片消息'//+filename;
    if(!img_name) return res.json({ret: false, msg: 'img_name error'})
    if(!img_id) return res.json({ret: false, msg: 'img_id error'})
    if(!img_fmt) return res.json({ret: false, msg: 'img_fmt error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeImg:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeImg:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'img';

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{img_id,img_name,img_fmt,url},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)    

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

     //如果过期时间不为空，进行阅后即焚
     if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}


/**
 * 发送语音
 * @type {sendMsgTypeRecord}
 * body:{time_sec:100,record_id:’’,url:’’,fmt:’格式’,record_name:’’}
 */
window.groupchat_c.sendMsgTypeRecord =sendMsgTypeRecord;
async function sendMsgTypeRecord(req, res) {
    let {user_id, s_id,chatid,msg,time_sec,record_id,fmt,url,record_name,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    // if(!msg) return res.json({ret: false, msg: 'msg error'})
    msg ='语音消息'
    if(!time_sec) return res.json({ret: false, msg: 'time_sec error'})
    if(!record_id) return res.json({ret: false, msg: 'record_id error'})
    if(!fmt) return res.json({ret: false, msg: 'fmt error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})
    if(!record_name) return res.json({ret: false, msg: 'record_name error'})


    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeRecord:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeRecord:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'record'

    //这里是文件信息的保存
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,record_id,'assert');
    if(!fileInfo) return res.json({ret: false, msg: "get file-info failed"})
    fileInfo.chatid = chatid;
    let saveFileInfoRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,record_id,'assert',JSON.stringify(fileInfo),'save chatid to file-info');
    if(!saveFileInfoRet) return res.json({ret: false, msg: "save chatid to file-info failed"})

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{record_id,time_sec,fmt,url,record_name},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}
    
    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)    

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

     //如果过期时间不为空，进行阅后即焚
     if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}

/**
 * 发送音频文件
 * @type {sendMsgTypeAudio}
 * body:{time_sec:1000,audio_id:’’,url:’’,fmt:’amr/mp3’,name:’’}
 */
window.groupchat_c.sendMsgTypeAudio =sendMsgTypeAudio;
async function sendMsgTypeAudio(req, res) {
    let {user_id, s_id,chatid,msg,time_sec,audio_id,fmt,url,name,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    // if(!msg) return res.json({ret: false, msg: 'msg error'})
    msg ='音频消息'
    if(!time_sec) return res.json({ret: false, msg: 'time_sec error'})
    if(!audio_id) return res.json({ret: false, msg: 'audio_id error'})
    if(!fmt) return res.json({ret: false, msg: 'fmt error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})
    if(!name) return res.json({ret: false, msg: 'name error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeAudio:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeAudio:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'audio';

    //这里是文件信息的保存
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,audio_id,'assert');
    if(!fileInfo) return res.json({ret: false, msg: "get file-info failed"})
    fileInfo.chatid = chatid;
    let saveFileInfoRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,audio_id,'assert',JSON.stringify(fileInfo),'save chatid to file-info');
    if(!saveFileInfoRet) return res.json({ret: false, msg: "save chatid to file-info failed"})

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{audio_id,time_sec,fmt,url,name},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}


/**
 * 发送短视频
 * @type {sendMsgTypeShortVideo}
 * body:{time_sec:1000,audio_id:’’,url:’’,fmt:’amr/mp3’,name:’’}
 */
window.groupchat_c.sendMsgTypeShortVideo =sendMsgTypeShortVideo;
async function sendMsgTypeShortVideo(req, res) {
    let {user_id, s_id,chatid,msg,time_sec,video_id,fmt,url,name,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    // if(!msg) return res.json({ret: false, msg: 'msg error'})
    msg ='短视频消息'
    if(!time_sec) return res.json({ret: false, msg: 'time_sec error'})
    if(!video_id) return res.json({ret: false, msg: 'video_id error'})
    if(!fmt) return res.json({ret: false, msg: 'fmt error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})
    if(!name) return res.json({ret: false, msg: 'name error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeShortVideo:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeShortVideo:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    //这里是文件信息的保存
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,video_id,'assert');
    if(!fileInfo) return res.json({ret: false, msg: "get file-info failed"})
    fileInfo.chatid = chatid;
    let saveFileInfoRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,video_id,'assert',JSON.stringify(fileInfo),'save chatid to file-info');
    if(!saveFileInfoRet) return res.json({ret: false, msg: "save chatid to file-info failed"})

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'short_video';

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{video_id,time_sec,fmt,url,name,preview_img:fileInfo.preview_img},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}
    
    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);
    
    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}

/**
 * 发送视频文件
 * @type {sendMsgTypeVideo}
 * body:{time_sec:1000,video_id:’’,url:’’,fmt:’mp4/xx’,name:’’}
 */
window.groupchat_c.sendMsgTypeVideo =sendMsgTypeVideo;
async function sendMsgTypeVideo(req, res) {
    let {user_id, s_id,chatid,msg,time_sec,video_id,fmt,url,name,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    //if(!msg) return res.json({ret: false, msg: 'msg error'})
    msg ='视频消息'
    if(!time_sec) return res.json({ret: false, msg: 'time_sec error'})
    if(!video_id) return res.json({ret: false, msg: 'video_id error'})
    if(!fmt) return res.json({ret: false, msg: 'fmt error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})
    if(!name) return res.json({ret: false, msg: 'name error'})


    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeVideo:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeVideo:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    //这里是文件信息的保存
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,video_id,'assert');
    if(!fileInfo) return res.json({ret: false, msg: "get file-info failed"})
    fileInfo.chatid = chatid;
    let saveFileInfoRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,video_id,'assert',JSON.stringify(fileInfo),'save chatid to file-info');
    if(!saveFileInfoRet) return res.json({ret: false, msg: "save chatid to file-info failed"})

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'video'
    
    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{video_id,time_sec,fmt,url,name,preview_img:fileInfo.preview_img},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}

/**
 * 发送定位地址
 * @type {sendMsgTypeLocation}
 * body:{lng:13.33,lat:33.22,location:’地名’,addr:’详细地址’,country:’cn/usa’}
 */
window.groupchat_c.sendMsgTypeLocation =sendMsgTypeLocation;
async function sendMsgTypeLocation(req, res) {
    let {user_id, s_id,chatid,msg,lng,lat,location,addr,country,loc_type,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    if(!msg) return res.json({ret: false, msg: 'msg error'})
    if(lng*1!=lng) return res.json({ret: false, msg: 'lng error'})
    if(lat*1!=lat) return res.json({ret: false, msg: 'lat error'})
    if(!location) return res.json({ret: false, msg: 'location error'})
    if(!addr) return res.json({ret: false, msg: 'addr error'})
    if(!country) return res.json({ret: false, msg: 'country error'})
    if(!loc_type) return res.json({ret: false, msg: 'loc_type error'})//经纬度的类型（有几种编码格式的，百度地图的、GPS的、google地图的）

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeLocation:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeLocation:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'location'

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{lng,lat,location,addr,country,loc_type},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}

/**
 * 发送聊天室名片（单聊不发）
 */
window.groupchat_c.sendGroupChatCard =sendGroupChatCard;
async function sendGroupChatCard(req,res){
    let {user_id,s_id,chatid,msg,chat_b_id,group_type,random,sign} = str_filter.get_req_data(req);

    if(!user_id) return res.json({ret: false, msg: 'userid error'})
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    if(!chat_b_id)  return res.json({ret: false, msg: 'chatid error'})
    if(!msg) return res.json({ret: false, msg: 'msg error'})
    if(group_type == 'single')  return res.json({ret: false, msg: 'single_chat_card can`t send'})

    //防重防攻击
    str = await user_redis.get(ll_config.redis_key+":sendGroupChatCard:"+user_id+random)
    if(str) return res.json({ret: false, msg: "muti call failed"})
    user_redis.set(ll_config.redis_key+":sendGroupChatCard:"+user_id+random,random,120)

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'groupchat_card'

    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{group_type,chat_b_id},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state) retObj.height = sendRet.y_state.token_height;
    retObj.msgid = msgid
 
    return res.json(retObj);
}





/**
 * 发送名片
 * @type {sendMsgTypeNameCard}
 * body:{name:’姓名’,logo:’’,logo_url:’’,type:’weixin/inner’}
 */
window.groupchat_c.sendMsgTypeNameCard =sendMsgTypeNameCard;
async function sendMsgTypeNameCard(req, res) {
    // 获取相关数据
    let {user_id, s_id,chatid,msg,name,logo,logo_url,card_type,card_name,random,sign} = str_filter.get_req_data(req);
    /**
     * 判断获得的数据类型是否存在
    */
    if(!user_id) return res.json({ret: false, msg: 'userid error'}) // 新增判断user_id是否存在
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    if(!msg) return res.json({ret: false, msg: 'msg error'})
    if(!name) return res.json({ret: false, msg: 'name error'})
    if(!logo) return res.json({ret: false, msg: 'logo error'})
    //if(!logo_url) return res.json({ret: false, msg: 'logo_url error'})
    if(!card_type) return res.json({ret: false, msg: 'card_type error'})
    if(!card_name) return res.json({ret: false, msg: 'card_name error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    // 防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeNameCard:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeNameCard:"+user_id+random,random,120)

    // 判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    // 获取当前时间
    let time_i = parseInt(new Date().getTime()/1000);
    // 将名片信息封装到obj中
    let type = 'name_card';
    
    // 创建一个新的token_id
    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{name,logo,logo_url,card_type,card_name},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    // 保存数据
    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

     //如果过期时间不为空，进行阅后即焚
     if(burn_time_type)
     burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    // msg封装类
    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    // 最后的参数msg_info保存名片信息
    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
}

/**
 * 发送红包
 * @type {sendMsgTypeRedPaper}
 * body:{type:’random’,total:100,split_num:10,paper_type:’cny/..’}
 */
window.groupchat_c.sendMsgTypeRedPaper =sendMsgTypeRedPaper;
async function sendMsgTypeRedPaper(req, res) {
    let {user_id, s_id,chatid,msg,redpaper_id,title,redpaper_type,total,split_num,cash_type,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})
    // if(!msg_type) return res.json({ret: false, msg: 'msg_type error'})
    if(!msg) return res.json({ret: false, msg: 'msg error'})
    if(!redpaper_id) return res.json({ret: false, msg: 'redpaper_id error'})
    if(!title) return res.json({ret: false, msg: 'title error'})
    if(!redpaper_type) return res.json({ret: false, msg: 'redpaper_type error'})
    if(!total|| total!=total*1) return res.json({ret: false, msg: 'total error'})
    if(!split_num|| split_num!=split_num*1) return res.json({ret: false, msg: 'split_num error'})
    if(!cash_type) return res.json({ret: false, msg: 'cash_type error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypeRedPaper:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypeRedPaper:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type='red_paper'

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{edpaper_id,title,redpaper_type,total,split_num,cash_type},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}


/**
 * 发送文章（或者帖子）
 * @type {sendMsgTypePost}
 * body:{title:’文章标题’,desc:’简介’,post_id:’’,post_type:’news/form/act’,url:’’,author:’作者’}
 */
window.groupchat_c.sendMsgTypePost =sendMsgTypePost;
async function sendMsgTypePost(req, res) {
    let {user_id, s_id,chatid,msg,img_id,title,desc,post_id,post_type,url,author,random, sign} = str_filter.get_req_data(req);
    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    if(!msg) return res.json({ret: false, msg: 'msg error'})
   // if(!img_id) return res.json({ret: false, msg: 'img_id error'})
    if(!title) return res.json({ret: false, msg: 'title error'})
    if(!desc) return res.json({ret: false, msg: 'desc error'})
    if(!post_id) return res.json({ret: false, msg: 'post_id error'})
    if(!post_type) return res.json({ret: false, msg: 'post_type error'})
    //if(!url) return res.json({ret: false, msg: 'url error'})
    if(!author) return res.json({ret: false, msg: 'author error'})

    // let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":sendMsgTypePost:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":sendMsgTypePost:"+user_id+random,random,120)

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    // let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    // if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let chatInfo = req.chatInfo
    let burn_time_type = chatInfo ? chatInfo.burn_time_type :null;
    let time_i = parseInt(new Date().getTime()/1000);
    let type = 'post';

    let msgid = await rpc_api_util.s_fork_token_id(MSG_API_BASE,MSG_TOKEN_ROOT,'msg');
    if(!msgid) return res.json({ret: false, msg: "get msgid failed"})

    let obj = {chatid,type,msg,time_i:time_i,time:str_filter.GetDateTimeFormat(time_i),from:msg_user_id,to:chatid,
        body:{img_id,title,desc,post_id,post_type,url,author},is_encrypted:false,encrypt_method:'aes256',status:0,user_id:user_id,msgid:msgid}

    if(burn_time_type)//如果存在过期时间，把过期时间也保存在消息节点上
        obj.burn_time = ( parseInt(burn_time_type) +time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,msgid,'assert',JSON.stringify(obj),user_id);
    if(!assertRet) return res.json({ret: false, msg: "set msgid-info failed"})

    //如果过期时间不为空，进行阅后即焚
    if(burn_time_type)
        burnAfterReading(user_id,msg_user_id,chatid,msgid,( parseInt(burn_time_type) +time_i),burn_time_type);

    let msgObj = {msgid,msg,type,time_i};
    let sendRet = await rpc_query(MSG_API_BASE+'/send',{token_x:MSG_TOKEN_ROOT,token_y:chatid,opval:JSON.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util.s_save_token_info(MSG_API_BASE,MSG_TOKEN_ROOT,chatid,'send',JSON.stringify(msgObj),user_id);
    if(!sendRet ||  !sendRet.ret) return res.json({ret: false, msg: "send msgid2chat-msglist failed"})

    let retObj = {ret:true,msg:'success',txid:sendRet.txid,token:chatid,create_time_i:time_i,create_time:str_filter.GetDateTimeFormat(time_i),msg_obj:msgObj,msg_info:obj}
    //更新高度和内容。
    if(sendRet.y_state){
        retObj.height = sendRet.y_state.token_height;
        // obj.msgid = msgid;
    }
    retObj.msgid = msgid

    return res.json(retObj);
    //return res.json({ret:true,msg:'success',msgid});
}


//-------------------以下是监听相关数据的ws-lisen-server（收到推送流之后，再给关注chatid的想着的user-id一个实时的反馈信息）。
const ws = {}//require("ws");
// var sock;
// let reCallCnt = 0;
// function reCallListen()
// {
//     reCallCnt++
//     console.log('reCallListen-reCallCnt:'+reCallCnt)
//     setTimeout(function(){
//         wait(); 
//      },5000+reCallCnt*1000)
// }
async function recvWSMsg(data) {
    console.log("dnalink-engine-rsp:------client-socket-recv:"+JSON.stringify(data));
    // if(data  && data.indexOf('keepalive')>0) return ;
    // data =JSON.parse(data)
    //{"user_name":"donrain","token_name":"rmb","appid":"10001","list":[{"token":"rmb_0000000000000000","height":54,"token_relate":"token_x","token_x":"rmb_0000000000000000","token_y":"rmb_29ZHvBZy2uy9RrXU","opcode":"pay","opval":"{\"order_number\":\"obj_order2zG6HcsVyXs\",\"order_name\":\"充值101.12元钱\",\"pay_money\":0.1,\"auto\":1,\"version\":1,\"extra_data\":\"云支付自动充值\",\"xdtns_cloud_func_ret\":{\"ret\":true,\"msg\":\"success\",\"order_id\":\"order_rmb2wherkb6aWzKw\",\"pay_url\":\"https://cloud.dtns.opencom.cn/h5.","opval_len":286},{"token":"rmb_29ZHvBZy2uy9RrXU","height":26,"token_relate":"token_y","token_x":"rmb_0000000000000000","token_y":"rmb_29ZHvBZy2uy9RrXU","opcode":"pay","opval":"{\"order_number\":\"obj_order2zG6HcsVyXs\",\"order_name\":\"充值101.12元钱\",\"pay_money\":0.1,\"auto\":1,\"version\":1,\"extra_data\":\"云支付自动充值\",\"xdtns_cloud_func_ret\":{\"ret\":true,\"msg\":\"success\",\"order_id\":\"order_rmb2wherkb6aWzKw\",\"pay_url\":\"https://cloud.dtns.opencom.cn/h5.","opval_len":286},{"token":"rmb_0000000000000000","height":55,"token_relate":"token_y","token_x":"rmb_0000000000000000","token_y":"rmb_29ZHvBZy2uy9RrXU","opcode":"pay","opval":"{\"order_number\":\"obj_order2zG6HcsVyXs\",\"order_name\":\"充值101.12元钱\",\"pay_money\":0.1,\"auto\":1,\"version\":1,\"extra_data\":\"云支付自动充值\",\"xdtns_cloud_func_ret\":{\"ret\":true,\"msg\":\"success\",\"order_id\":\"order_rmb2wherkb6aWzKw\",\"pay_url\":\"https://cloud.dtns.opencom.cn/h5.","opval_len":286}],"count":"3"}
    let list = data;//data.list;
    let token = null;
    for(let i=0;list && i<list.length;i++)
    {
        //token_y = list[i].token_y;
        let msgObj = list[i]
        token = msgObj.token;
        
        //if(!token) continue;
        console.log('token:'+token+' index:'+token.indexOf(MSG_TOKEN_NAME+'_chat0') )
        if(token && token.indexOf(MSG_TOKEN_NAME+'_chat0') ==0)
        {
            try{
                console.log('get msg-opval:'+msgObj.opval)
                msgObj.opval = JSON.parse(msgObj.txjson.opval );
                console.log('get msg-opval:'+msgObj.opval)
            }catch(ex)
            {
                console.log('get-msg-parse-error:'+ex)
                continue;
            }
            console.log('get msg:'+JSON.stringify(list[i]))
            //发送未读消息的列表（以user_id为检索）

            //发送给在聊天的窗口的列表。
            let msgInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,msgObj.opval.msgid,'assert');
            if(!msgInfo) continue;
            msgInfo.token = token; //token-id
            msgInfo.height = msgObj.height; //高度
            msgInfo.msgid =msgObj.opval.msgid 
            //msgObj.msg_info = msgInfo; //其它内容
            
            //发送消息呢，还是连高度一起发送？(一起发送)
            console.log('msg_info:'+JSON.stringify(msgInfo));
            //发送消息给客户端。
            sendChatRoomMsg(token,msgInfo)   
            //发送到消息中心（聊天列表）
            console.log('msgObj:'+JSON.stringify(msgObj));
            sendChatMemRecentMsg(token,msgObj);         
        }
        //找到所有的user_id（已在线，并且在等待和接收chatid的消息流）。
        //let dealRet = await dealOrderPay(token_y);
        //console.log('dealRet:'+dealRet)
    }
}
window.groupchat_c.wait = wait
async function wait() {

    //wslisten
    let wsRet = await  rpc_query(MSG_API_BASE+'/op',
        {opcode:'websocket',token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_ROOT,opval:'listen chatroom msgid-list',extra_data:'msgids'});

    let iCnt = 0
    while((!wsRet|| !wsRet.ret || !wsRet.rpc_func_ret || !wsRet.rpc_func_ret.ret)&& iCnt <=3){
        iCnt++
        await str_filter.sleep(500)
        wsRet = await  rpc_query(MSG_API_BASE+'/op',
        {opcode:'websocket',token_x:MSG_TOKEN_ROOT,token_y:MSG_TOKEN_ROOT,opval:'listen chatroom msgid-list',extra_data:'msgids'});
    }
    console.log('wsRet:'+JSON.stringify(wsRet));

    ///xdtns_cloud_func_ret
    if(!wsRet|| !wsRet.ret || !wsRet.rpc_func_ret || !wsRet.rpc_func_ret.ret) {
        //reCallListen();
        console.log('wsRet is false',wsRet)
        return false;
    }

    //参考示例。
    // var sock = new ws("wss://cloud.dtns.opencom.cn/cloud/ws/svr?token=e90562720a5be8c366376cab2699d28c6b5bb7e2f50202ff1509af17178e260f");
    rpc_client.setWs(wsRet.rpc_func_ret.token,function(data){
        console.log('groupchat-dnalink-engine-websocket-res:',data)
        recvWSMsg(data)
    })
    let xret = await rpc_query(MSG_API_BASE+'/super/websocket/link',{token:wsRet.rpc_func_ret.token});
    console.log('groupchat-listen-super-link-xret:'+JSON.stringify(xret))
    
    // sock = new ws(MSG_API_BASE+'/super/websocket/link?token='+  wsRet.rpc_func_ret.token);
    // sock.on("open", function () {
    //     console.log("connect success !!!!");
    //     sock.send("HelloWorld1");
    //     sock.send("HelloWorld2");
    //     sock.send("HelloWorld3");
    //     sock.send("HelloWorld4");
    //     sock.send(Buffer.alloc(10));
    // });

    // sock.on("error", function(err,data) {
    //     console.log("client-socket-error: "+JSON.stringify( err)+" data:"+JSON.stringify(data));
    // });

    // sock.on("close", function(e) {
    //     console.log("client close:"+JSON.stringify(e));

    //     //restart client 
    //     wait();
    // });

//     sock.on("message",msgFunc);

// //保持心跳包（5秒1次，保持不断开），否则1分钟之后会自动断开。
//     setInterval(function(){
//         sock.send('keepalive')
//     },5000);

}
// rpc_client.setPeerRefreshCallback(function(){
//     groupchat_c.wait()
//     // wait()
// })
// setTimeout(()=>wait(),5000)
// wait();

//---------以下是监听客户端的websocket连接请求

window.groupchat_c.wsLisenReqKey =wsLisenReqKey;
async function wsLisenReqKey(req, res) {
    //pay_num订单金额，pay_type（支付类型：支付宝、微信、银行卡支付、短信支付）
    let {user_id,s_id,chatid, random,sign} = str_filter.get_req_data(req);

    if(!chatid)  return res.json({ret: false, msg: 'chatid error'})

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    //判断是否加入了聊天
    let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let isJoin = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
    if(!isJoin || false) return res.json({ret: false, msg: "user-id is not chat mem"});//判断是否是超级管理员或者已经加入群聊

    let listen_token = str_filter.randomBytes(32);
    let setting  = {chatid,user_id};
    let setRet =await user_redis.set(listen_token,JSON.stringify(setting),60*30);//半个钟
    console.log("set_ret:"+setRet);

    //发送成功。
    if(setRet)
        res.json({ret:true,msg:'success',listen_token})//,listen_url:"wss://cloud.dtns.opencom.cn/cloud/ws/svr?token="+listen_token})
    else
        res.json({ret:false,msg:'failed:'+setRet})

}
/**
 * 用户订阅消息（只同步缩略的最新消息）---用于更新最新的聊天列表（或者多窗口聊天--需要完整消息体）。
 */
window.groupchat_c.wsUserLisenReqKey =wsUserLisenReqKey;
async function wsUserLisenReqKey(req, res) {
    //pay_num订单金额，pay_type（支付类型：支付宝、微信、银行卡支付、短信支付）
    let {user_id,s_id, random,sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let listen_token = str_filter.randomBytes(32);
    let setting  = {user_id};
    let setRet =await user_redis.set(listen_token,JSON.stringify(setting),60*30);//半个钟
    console.log("set_ret:"+setRet);

    //发送成功。
    if(setRet)
        res.json({ret:true,msg:'success',listen_token})//,listen_url:"wss://cloud.dtns.opencom.cn/cloud/ws/svr?token="+listen_token})
    else
        res.json({ret:false,msg:'failed:'+setRet})
}
/**
 * 给聊天室发送消息
 * @param {*} chatid 
 * @param {*} msgInfo 
 */
async function sendChatRoomMsg(chatid,msgInfo)
{
    let ws_listen_key = 'wschat_'+chatid
    if(ws[ws_listen_key])
    {
        let socks = ws[ws_listen_key];
        // let msg ={user_name,token_name,appid,list:JSON.parse(list),count};
        for(let i=0;i<socks.length;i++)
        {
            try{
            socks[i].send(JSON.stringify(msgInfo));
            }catch(ex){
                console.log('sendChatRoomMsg-ex:'+ex,ex)
            }
        }
        console.log("ws-ws_listen_key send list-cnt:"+socks.length);
    }else{
        console.log("ws-ws_listen_key send empty-list");
    }
}
/**
 * 给chatroom的所有成员，发送最新消息（简体）。
 * @param {*} chatid 
 * @param {*} msgObj ---包含了高度等的信息，chatid，token等信息。 
 */
async function sendChatMemRecentMsg(chatid,msgObj)
{
    //这一行可写入缓存中，加快加载速度（后续优化）。
    let listRet = await rpc_query(MSG_API_BASE+'/chain/relations',{token:chatid,opcode:'relm',isx:false,begin:0,len:100000})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    for(let x=0;x<list.length;x++)
    {
        if(!list[x].token_x) continue;
        let user_id = USER_TOKEN_NAME+'_'+list[x].token_x.split('_')[1]
        let ws_listen_key = 'wsrecent_'+user_id
        if(ws[ws_listen_key])
        {
            let socks = ws[ws_listen_key];
            // let msg ={user_name,token_name,appid,list:JSON.parse(list),count};
            for(let i=0;i<socks.length;i++)
            {
                socks[i].send(JSON.stringify(msgObj));
            }
            console.log("ws-ws_listen_key send wsrecent_list-cnt:"+socks.length);
        }else{
            console.log("ws-ws_listen_key send wsrecent_empty-list");
        }
    }
}
/**
 * 得到在线的群成员列表（特别是对于直播间有用）
 */
window.groupchat_c.s_queryChatMemAliveCntAndList =s_queryChatMemAliveCntAndList;
async function s_queryChatMemAliveCntAndList(chatid) {
    if(!chatid) return  {ret:false,msg:'chatid error'}

    let ws_listen_key = 'wschat_'+chatid

    let cnt = ws &&ws[ws_listen_key] ?  ws[ws_listen_key].length:0
    let user_ids = [];
    for(let i=0;i<cnt  ;i++)
        user_ids.push(ws[ws_listen_key][i].user_id)

    return  {ret:true,msg:'success',cnt,user_ids}
}
/**
 * 得到在线的群成员列表（特别是对于直播间有用）
 */
window.groupchat_c.queryChatMemAliveCntAndList =queryChatMemAliveCntAndList;
async function queryChatMemAliveCntAndList(req, res) {
    let {chatid} = str_filter.get_req_data(req)
    if(!chatid) return res.json({ret:false,msg:'chatid error'})

    let retJson  =await s_queryChatMemAliveCntAndList(chatid);

    res.json(retJson)
}

/**
 * 得到基本状态
 */
window.groupchat_c.info_chat_stream =info_chat_stream;
async function info_chat_stream(req, res) {
  let {chatid} = str_filter.get_req_data(req);
  if(!chatid) return res.json({ret:false,msg:'chatid error'})

  let id = await user_redis.get(ll_config.redis_key+'live_chat:'+chatid);
  console.log('info_chat_stream-id:'+id)

  let retJson =  await s_queryChatMemAliveCntAndList(chatid)

  if(id) res.json({ret:true,msg:'success',publish_alive:true,mem_alive_cnt:retJson.cnt, mem_alive_list:retJson.user_ids})
  else res.json({ret:false,msg:'stream is die',publish_alive:false,mem_alive_cnt:retJson.cnt, mem_alive_list:retJson.user_ids})
}

// 启动基于websocket的服务器,监听我们的客户端接入进来。
// const ws0 = require("ws")
// const server = new ws0.Server({
//    // host: "127.0.0.1",//局域网设定。
//     port: config.ws_port,




// });

// 监听接入进来的客户端事件
window.groupchat_c.websocket_add_listener = websocket_add_listener
async function websocket_add_listener(client_sock,req) {
    console.log("websocket_add_listener-req:"+req);
    console.log("websocket_add_listener-client_sock:"+client_sock);
    console.log("websocket_add_listener-req.url:"+req.url);

    if(!req.url) {
        console.log("req.url error, close client");
        client_sock.close();
        return ;
    }
 
    // let params = req.url.split('=');
    let {token} = str_filter.get_req_data(req)
    if(!token)//params.length!=2) {
    {
        console.log("req.url-param error, close client");
        client_sock.close();
        return ;
    }

    let listen_token = token// params[1];
    let settingInfoStr = await user_redis.get(listen_token);
    if(!settingInfoStr)
    {
        console.log("settingInfoStr is empty, close client");
        client_sock.close();
        return ;
    }

    if(req.url.indexOf('userchatlist')>0)
    {
        let {user_id} = JSON.parse(settingInfoStr);
        client_sock.ws_listen_key = 'wsrecent_'+user_id
    }else{
        let {chatid,user_id} = JSON.parse(settingInfoStr);
        client_sock.ws_listen_key = 'wschat_'+chatid//+'_'+token_name;
        client_sock.user_id = user_id;
        client_sock.chatid = chatid;
    }

    //一个listen_token只能连接一次。
    user_redis.del(listen_token);
    
    if(!ws[client_sock.ws_listen_key])
    {
        ws[client_sock.ws_listen_key] = [];
    }
    //添加到队列中。
    ws[client_sock.ws_listen_key].push(client_sock);
    //在线的聊天室成员个数。---同步给客户端。
    if(client_sock.chatid)
    {
        let cnt = ws[client_sock.ws_listen_key] ? ws[client_sock.ws_listen_key].length :0;
        console.log('mem_alive_cnt:'+cnt+":into:"+client_sock.user_id)
        for(let i=0;i<cnt;i++)
        {
            if(ws[client_sock.ws_listen_key][i])
            ws[client_sock.ws_listen_key][i].send('mem_alive_cnt:'+cnt+":into:"+client_sock.user_id)
        }
    }

    // close事件
    client_sock.on("close", function() {
        console.log("client close:"+client_sock.ws_listen_key);
        //从队列中移除
        let newList = [];
        for(let i=0;ws[client_sock.ws_listen_key] && i<ws[client_sock.ws_listen_key].length;i++)
        {
            if(ws[client_sock.ws_listen_key][i] == client_sock)
            {
                console.log("client remove from listen-list success");
            }
            else{
                newList.push(ws[client_sock.ws_listen_key][i])
            }
        }
        ws[client_sock.ws_listen_key] = newList ;

        //在线的聊天室成员个数。
        if(client_sock.chatid)
        {
            let cnt = ws[client_sock.ws_listen_key] ? ws[client_sock.ws_listen_key].length :0;
            console.log('mem_alive_cnt:'+cnt+":quit:"+client_sock.user_id)
            for(let i=0;i<cnt;i++)
                ws[client_sock.ws_listen_key][i].send('mem_alive_cnt:'+cnt+":quit:"+client_sock.user_id)
        }
    });

    // error事件
    client_sock.on("error", function(err) {
        console.log("client error", err);
    });
    // end
    // message 事件, data已经是根据websocket协议解码开来的原始数据；
    // websocket底层有数据包的封包协议，所以，绝对不会出现粘包的情况。
    // 每解一个数据包，就会触发一个message事件;
    // 不会出现粘包的情况，send一次，就会把send的数据独立封包。
    // 如果我们是直接基于TCP，我们要自己实现类似于websocket封包协议就可以完全达到一样的效果；
    client_sock.on("message", async function(data) {
        console.log('client-data:'+data);

        //心跳判断，如果是心跳包，直接返回心跳应答包
        if(data == 'keepalive')
        {
            console.log('keepalive-is-ok')
            client_sock.send('keepalive-is-ok');
            return ;
        }

        //是当前聊天窗口，可得到已读聊天纪录。
        if(client_sock.ws_listen_key.indexOf('wschat_')==0)
        {
            
            let msgObj = null;
            try{
                msgObj = JSON.parse(data)
            }catch(e){return ;}

            let {user_id,chatid,readed_height} = msgObj;
            if(user_id!=client_sock.user_id || chatid!=client_sock.chatid) {
                console.log('not my-chat-room:'+client_sock.user_id +':::'+client_sock.chatid);
            }

            if(readed_height*1 !=readed_height){
                console.log('readed_height:'+readed_height+" not int");
            }

            let setRet =await user_redis.set(ll_config.redis_key+':readed_height:'+user_id+chatid,readed_height,-1);//半个钟
            console.log("set_ret:"+setRet);
            console.log('set-readed-height-is-ok')

            client_sock.send('set-readed-height-is-ok');
        }
        //client_sock.send("Thank you!");
    });
}
//统计websocket中的在线用户数、设备数（每个用户的设备数之和）、曾在线用户数（也就是最近登录过，但时现在不在线）
function count_alive_user_cnt()
{
    let statusCnt = 0
    let cnt = 0
    let deviceCnt =0
    if(!ws) return {cnt,deviceCnt,statusCnt,web3name:window.ll_config ? ll_config.roomid :'undefined'}
    for(let key in ws){
        if(key && key.indexOf('wsrecent_')==0){
            statusCnt ++
            cnt += ws[key].length>0 ? 1:0
            deviceCnt += ws[key].length
            console.log('count_alive_user_cnt:key:',key,'client-socket-cnt:',ws[key].length)
        }
    }
    return {cnt,deviceCnt,statusCnt,web3name:window.ll_config ? ll_config.roomid :'undefined'}
}

//统计ib3.node节点的用户数
window.groupchat_c.count_ib3_users = count_ib3_users
async function count_ib3_users(req,res)
{
    let aliveCntRet = count_alive_user_cnt()
    console.log('count_ib3_users-aliveCntRet:',aliveCntRet)
    let all_user_cnt = 0;
    await new Promise((resolve)=>{
        let req = {params:{begin:0,len:100000000}} 
        let res = {json:function(data){
            console.log('count_ib3_users-query_all_user-ret:',data)
            all_user_cnt = data && data.ret ? data.list.length:0
            resolve(true)
        }}
        console_c.query_all_user(req,res)
        setTimeout(()=>resolve(false),100000)
    })

    aliveCntRet.user_cnt = all_user_cnt
    aliveCntRet.ret = true
    aliveCntRet.msg = 'success'
    res.json(aliveCntRet)
}

// // connection 事件, 有客户端接入进来;
// function on_server_client_comming(client_sock,req) {
//     console.log("client comming");
//     websocket_add_listener(client_sock,req);
// }
// server.on("connection", on_server_client_comming);

// // error事件,表示的我们监听错误;
// function on_server_listen_error(err) {
//     console.log("on_server_listen_error err:"+err);
// }
// server.on("error", on_server_listen_error);

// // headers事件, 回给客户端的字符。
// function on_server_headers(data) {
//     // console.log(data);
//     console.log("on_server_headers data:"+data);
// }
// server.on("headers", on_server_headers);

//----------------------------------

/*


0a3730543e23a35e67da67df2d7e6b0209f13e9318e4838a79b3e4a9a87685f5
015e5b422fe00cf24ba68abb88a7e3c6e358999ba299f494bc412d957be3747f
2fd7d6dc4af68928489a618a0628940e385a437f8f69b487b0efc72f38b1cef1
5538ff01779b9963102a361a8a03bda609de77e565c80d06f5048e85042602d9
b7cfa2bdad9e5a9e8f9aec0cbe3f8cb64dbd5b83208492ab35a20c4ebb098d6e
*/

// //参考示例。
// var xsock = new ws("ws://127.0.0.1:63333/groupchat/ws/svr?token=b4500de5f26745291bb43772a7940a7ab070315d9b908e525dacd5a56d6dad4e");
// xsock.on("open", function () {
//     console.log("connect success !!!!");
//     xsock.send("HelloWorld1");
//     xsock.send("HelloWorld2");
//     xsock.send("HelloWorld3");
//     xsock.send("HelloWorld4");
//     xsock.send(Buffer.alloc(10));
// });

// xsock.on("error", function(err,data) {
//     console.log("client-socket-error: "+JSON.stringify( err)+" data:"+JSON.stringify(data));
// });

// xsock.on("close", function(e) {
//     console.log("client close:"+JSON.stringify(e));
// });

// xsock.on("message", function(data) {
//     console.log("client-socket-recv:"+data);
// });

// //保持心跳包（5秒1次，保持不断开）�����否则1分钟之后会自动断开。
// // setInterval(function(){
// //     xsock.send('keepalive')
// // },5000);

// /**
//  * 09b52ac748e857d5fcff2ebef614775c2ec88a4e94cc03b8ddb05b470cc40c10
//  * 1da3973a9580af10d8e04ccc8a819f56e5ffebc3462f1e0fced5a451a637ee59
//  * 3face56692867d4e5f323e299c0f63eee127429aa096bf589e69a98e09d876a5
//  * c06c190209fe934f398777f8f29aad97b2ebfcfad0fb6658837e05eb9752bca7
//  * 83235b54ae011f9bbb6e6069440557eced7a06f212f628de77387a09c914ef09
//  */

// //参考示例。
// var sockRecent = new ws("ws://127.0.0.1:63333/userchatlist/ws/svr?token=3fc64bc17227288bcec4a78e32b57e0d470a93c570dd37def0301513a36987ca");
// sockRecent.on("open", function () {
//     console.log("connect success !!!!");
//     sockRecent.send("HelloWorld1");
//     sockRecent.send("HelloWorld2");
//     sockRecent.send("HelloWorld3");
//     sockRecent.send("HelloWorld4");
//     sockRecent.send(Buffer.alloc(10));
// });

// sockRecent.on("error", function(err,data) {
//     console.log("client-socket-error: "+JSON.stringify( err)+" data:"+JSON.stringify(data));
// });

// sockRecent.on("close", function(e) {
//     console.log("client close:"+JSON.stringify(e));
// });

// sockRecent.on("message", function(data) {
//     console.log("client-socket-recv:"+data);
// });

// // //保持心跳包（5秒1次，保持不断开），否则1分钟之后会自动断开。
// // setInterval(function(){
// //     sockRecent.send('keepalive')
// // },5000);

















