/**
 * Created by lauo.li on 2020/4/23.
 */
const str_filter = require('../libs/str_filter');
const config = require('../config').config;
const user_redis = require('../config').user_redis;
const rpc_query = require('../rpc_api_config').rpc_query
const groupchat_c = require('./groupchat_c');
const {vip_filter,vip_filter_visit,vip_filter_send,vip_filter_invite,vip_filter_manager,GROUPCHAT_PM_INVITE,GROUPCHAT_PM_SEND,GROUPCHAT_PM_VISIT,GROUPCHAT_PM_MANAGER,MANAGER_VIP_LEVEL,NORMAL_VIP_LEVEL} = require('../middleware/common_interceptor')
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSGA_API_BASE,MSGA_TOKEN_NAME,MSGA_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

const rpc_api_util = require('../rpc_api_util')
const http_post = require('../libs/http_request').http_post

const CONSOLE_USER_LIST_ID = USER_TOKEN_NAME+'_consoleuser00000';


/**
 * 统计30天内注册的用户数量
 * @type {cout_user_last30days}
 */
module.exports.cout_user_last30days =cout_user_last30days;
async function cout_user_last30days(req, res) {
    let {random, sign} = str_filter.get_req_data(req);

    // // 防重放攻击
    // let str = await user_redis.get(config.redis_key+":cout_user_last30days:"+random)
    // if(str)
    // {
    //     return res.json({ret: false, msg: "muti call failed"});
    // }
    // user_redis.set(config.redis_key+":cout_user_last30days:"+random,random,120)

    let ended_flag  =false; 
    let days_cnt = 32;
    let time_i = parseInt(new Date().getTime()/1000);
    let last32days_time_i = time_i - days_cnt * 24 * 60 * 60 //24小时*60分钟*60秒钟 * 32天（包含了完整的31天和不完整的32天--因为当前时间不可能恰好是00：00分）
    let month_str = str_filter.GetDateFormat('y-m',time_i)
    let month_cnt = 0;
    let all_cnt = 0;

    let begin = 0, len = 1000;//分页查询 
    let resultList=[], resultObjs = {};
    //统计数组
    for(let i=0;i<days_cnt;i++)
    {
        now_date = str_filter.GetDateFormat('y-m-d',time_i - i*24*60*60);
        resultObjs[now_date] = {date:now_date,cnt:0};
        resultList.push(resultObjs[now_date])
    }
    //开始递归深入统计
    while(true)
    {
        let listRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:USER_TOKEN_ROOT,opcode:'fork',begin,len})
        if(!listRet || !listRet.ret || !listRet.list) break;

        let i =0, list = listRet.list;
        for(;i<list.length;i++)
        {
            list[i].txjson = JSON.parse(list[i].txjson)

            all_cnt ++;

            if(list[i].txjson.timestamp_i < last32days_time_i)
            {
                ended_flag = true;
                continue;
            }

            //判断是否是新创建的user_id
            if(list[i].txjson.token_x.indexOf(USER_TOKEN_NAME+'_phone')!=0)
            {
                now_date = str_filter.GetDateFormat('y-m-d',list[i].txjson.timestamp_i);
                if(resultObjs[now_date])
                {
                    resultObjs[now_date].cnt ++;
                    if(now_date.indexOf(month_str)==0) month_cnt ++;
                }else{
                    resultObjs[now_date] = {date:now_date,cnt:1}
                }
            }
        }
        //游标
        begin+=len;
    }
    
    let today_cnt = resultList[0].cnt;
    let yesterday_cnt  = resultList[1].cnt;
    resultList.reverse();
    res.json({ret:true,msg:'success',list:resultList,all_cnt,today_cnt,yesterday_cnt,month_cnt})
}


/**
 * 统计30天内发送的消息数量
 * @type {cout_msg_last30days}
 */
module.exports.cout_msg_last30days =cout_msg_last30days;
async function cout_msg_last30days(req, res) {
    let {random, sign} = str_filter.get_req_data(req);

    let ended_flag  =false; 
    let days_cnt = 32;
    let time_i = parseInt(new Date().getTime()/1000);
    let last32days_time_i = time_i - days_cnt * 24 * 60 * 60 //24小时*60分钟*60秒钟 * 32天（包含了完整的31天和不完整的32天--因为当前时间不可能恰好是00：00分）
    let month_str = str_filter.GetDateFormat('y-m',time_i)
    let month_cnt = 0;
    let all_cnt = 0;

    let begin = 0, len = 1000;//分页查询 
    let resultList=[], resultObjs = {};
    //统计数组
    for(let i=0;i<days_cnt;i++)
    {
        now_date = str_filter.GetDateFormat('y-m-d',time_i - i*24*60*60);
        resultObjs[now_date] = {date:now_date,cnt:0};
        resultList.push(resultObjs[now_date])
    }
    //开始递归深入统计
    while(true)
    {
        let listRet = await rpc_query(MSGA_API_BASE+'/chain/opcode',{token:MSGA_TOKEN_ROOT,opcode:'fork',begin,len})
        if(!listRet || !listRet.ret || !listRet.list) break;

        let i =0, list = listRet.list;
        for(;i<list.length;i++)
        {
            list[i].txjson = JSON.parse(list[i].txjson)

            all_cnt ++;

            if(list[i].txjson.timestamp_i < last32days_time_i)
            {
                ended_flag = true;
                break;//这里统计完就停止了
            }

            //判断是否是新创建的user_id
            if(list[i].txjson.token_x.indexOf(MSGA_TOKEN_NAME+'_chat')!=0)
            {
                now_date = str_filter.GetDateFormat('y-m-d',list[i].txjson.timestamp_i);
                if(resultObjs[now_date])
                {
                    resultObjs[now_date].cnt ++;
                    if(now_date.indexOf(month_str)==0) month_cnt ++;
                }else{
                    resultObjs[now_date] = {date:now_date,cnt:1}
                }
            }
        }
        if(ended_flag) break;
        //游标
        begin+=len;
    }
    
    let today_cnt = resultList[0].cnt;
    let yesterday_cnt  = resultList[1].cnt;
    resultList.reverse();
    res.json({ret:true,msg:'success',list:resultList,/*all_cnt,*/today_cnt,yesterday_cnt,month_cnt})
}


/**
 * 统计30天内创建群聊的数量
 * @type {cout_chat_last30days}
 */
module.exports.cout_chat_last30days =cout_chat_last30days;
async function cout_chat_last30days(req, res) {
    let {random, sign} = str_filter.get_req_data(req);

    let ended_flag  =false; 
    let days_cnt = 32;
    let time_i = parseInt(new Date().getTime()/1000);
    let last32days_time_i = time_i - days_cnt * 24 * 60 * 60 //24小时*60分钟*60秒钟 * 32天（包含了完整的31天和不完整的32天--因为当前时间不可能恰好是00：00分）
    let month_str = str_filter.GetDateFormat('y-m',time_i)
    let month_cnt = 0;
    let all_cnt = 0;

    let begin = 0, len = 1000;//分页查询 
    let resultList=[], resultObjs = {};
    //统计数组
    for(let i=0;i<days_cnt;i++)
    {
        now_date = str_filter.GetDateFormat('y-m-d',time_i - i*24*60*60);
        resultObjs[now_date] = {date:now_date,cnt:0,s_cnt:0,g_cnt:0};//s_cnt单聊，g_cnt群聊
        resultList.push(resultObjs[now_date])
    }
    //开始递归深入统计
    while(true)
    {
        let listRet = await rpc_query(MSGA_API_BASE+'/chain/opcode',{token:MSGA_TOKEN_ROOT,opcode:'fork',begin,len})
        if(!listRet || !listRet.ret || !listRet.list) break;

        let i =0, list = listRet.list;
        for(;i<list.length;i++)
        {
            list[i].txjson = JSON.parse(list[i].txjson)

            all_cnt ++;

            if(list[i].txjson.timestamp_i < last32days_time_i)
            {
                ended_flag = true;
                break;//这里统计完就停止了
            }

            //判断是否是新创建的user_id
            if(list[i].txjson.token_x.indexOf(MSGA_TOKEN_NAME+'_chat')==0)
            {
                now_date = str_filter.GetDateFormat('y-m-d',list[i].txjson.timestamp_i);
                resultObjs[now_date] = !resultObjs[now_date] ? {date:now_date,cnt:0} : resultObjs[now_date] 
                resultObjs[now_date].cnt ++;
                resultObjs[now_date].s_cnt += list[i].txjson.token_x.indexOf(MSGA_TOKEN_NAME+'_chat01')==0 ? 1:0;
                resultObjs[now_date].g_cnt += list[i].txjson.token_x.indexOf(MSGA_TOKEN_NAME+'_chat02')==0 ? 1:0;
                if(now_date.indexOf(month_str)==0) month_cnt ++;
            }
        }
        if(ended_flag) break;
        //游标
        begin+=len;
    }
    
    let today_cnt = resultList[0].cnt;
    let yesterday_cnt  = resultList[1].cnt;
    resultList.reverse();
    res.json({ret:true,msg:'success',list:resultList,/*all_cnt,*/today_cnt,yesterday_cnt,month_cnt})
}


/**
 * 所有用户
 * @type {query_all_user}
 */
module.exports.query_all_user =query_all_user;
async function query_all_user(req, res) {
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
                newInfo.vip_level = 0;
                newObjs.push(newInfo)
            }else{
                newObjs.push({user_id:users[i],user_name:''})
            }

            let vipInfo = rets[i+1]
            if(vipInfo)
            {
                newInfo.vip_level = vipInfo.vip_level
                newInfo.vip_timeout = vipInfo.vip_timeout
            }
        }
    })
    return res.json({ret:true,msg:'success',list:newObjs})
}

/**
 * 封禁用户
 */
module.exports.ban_user =ban_user;
async function ban_user(req, res) {
    let {user_id,dst_user_id,random, sign} = str_filter.get_req_data(req);

    //判断是否是客服
    let existsRet = await rpc_api_util.s_check_token_list_related(USER_API_BASE,CONSOLE_USER_LIST_ID,dst_user_id,'relc')
    if(existsRet || dst_user_id == require('../middleware/common_interceptor').INIT_CONSOLE_USER) return res.json({ret:false,msg:'console-user can not ban!'})

    //拿到用户信息
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,dst_user_id,'assert')
    if(!userInfo) return res.json({ret:false,msg:'user-info is empty'})

    if(userInfo.is_baned) return res.json({ret:false,msg:'this user-id is already baned'})

    userInfo.is_baned = true;
    userInfo.ban_time_i = parseInt(new Date().getTime()/1000); 
    userInfo.ban_user_id = user_id

    let assertRet = await rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,dst_user_id,'assert',JSON.stringify(userInfo),'ban the user')
    if(!assertRet) return res.json({ret:false,msg:'ban the user failed'})

    res.json({ret:true,msg:'success'})
}

/**
 * 解封用户
 */
module.exports.unban_user =unban_user;
async function unban_user(req, res) {
    let {user_id,dst_user_id,random, sign} = str_filter.get_req_data(req);

    //拿到用户信息
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,dst_user_id,'assert')
    if(!userInfo) return res.json({ret:false,msg:'user-info is empty'})

    if(!userInfo.is_baned) return res.json({ret:false,msg:'this user-id is not baned'})

    userInfo.is_baned = false; //解封
    userInfo.unban_time_i = parseInt(new Date().getTime()/1000); 
    userInfo.unban_user_id = user_id

    let assertRet = await rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,dst_user_id,'assert',JSON.stringify(userInfo),'unban the user')
    if(!assertRet) return res.json({ret:false,msg:'unban the user failed'})

    res.json({ret:true,msg:'success'})
}

/**
 * 所有会员
 * @type {query_all_vip_user}
 */
module.exports.query_all_vip_user =query_all_vip_user;
async function query_all_vip_user(req, res) {
    let {random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})

    begin = parseInt(begin)
    len = parseInt(len)

    let list =await rpc_api_util.s_query_token_list(VIP_API_BASE,VIP_TOKEN_ROOT,'relv',begin,len)//
    let queryInfoP = [];
    for(let i=0;list && i<list.length;i++)
    {
        let tmp_id = USER_TOKEN_NAME+'_'+list[i].token_y.split('_')[1]
        queryInfoP.push(rpc_api_util.s_query_token_info(USER_API_BASE,tmp_id,'assert'))
    }

    await Promise.all(queryInfoP).then(function(rets){
        // console.log('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<rets.length;i++)
        {
            let newInfo = rets[i]
            newInfo = newInfo ? newInfo :{user_id:users[i],user_name:''}
            delete newInfo.salt
            delete newInfo.pwd

            let vipInfo = {vip_level:list[i].vip_level,vip_timeout:list[i].vip_timeout}
            list[i] = Object.assign({},vipInfo,newInfo);
        }
    })

    if(list && list.length>0)
        return res.json({ret:true,msg:'success',list})
    else
        return res.json({ret:false,msg:'list is empty'})
}
/**
 * 将所有的vip-user关联到vip-list
 */
module.exports.relate_all_vip_user =relate_all_vip_user;
async function relate_all_vip_user(req, res) {
    let listRet = await rpc_query(VIP_API_BASE+'/chain/opcode',{token:VIP_TOKEN_ROOT,opcode:'assert',begin:0,len:100000})
    if(!listRet || !listRet.ret) return res.json({ret:false,msg:'query-list is empty'})
    
    let list = listRet.list, existMap = {}, cnt = 0;
    for(let i=0;i<list.length;i++)
    {
        let txjson = JSON.parse( list[i].txjson);
        let token_y = txjson.token_y;
        if(!existMap[token_y])
        {
            existMap[token_y] = 1;
            let relVIPList = await rpc_api_util.s_save_into_token_list(VIP_API_BASE,VIP_TOKEN_ROOT,token_y,'relv','add to vip-list');
            if(!relVIPList) relVIPList = await rpc_api_util.s_save_into_token_list(VIP_API_BASE,VIP_TOKEN_ROOT,token_y,'relv','add to vip-list');
            cnt +=relVIPList ? 1:0;
        }
    }

    console.log('cnt:'+cnt);
    res.json({ret:true,msg:'success',cnt})
}

/**
 * 所有客服
 * @type {query_all_console_user}
 */
module.exports.query_all_console_user =query_all_console_user;
async function query_all_console_user(req, res) {
    let {random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})
    begin = parseInt(begin)
    len = parseInt(len)

    //得到客服列表
    let list = await rpc_api_util.s_query_token_list(USER_API_BASE,CONSOLE_USER_LIST_ID,'relc',begin,len)

    let queryInfoP = [];
    for(let i=0;list && i<list.length;i++)
    {
        let tmp_id = VIP_TOKEN_NAME+'_'+list[i].token_y.split('_')[1]
        queryInfoP.push(rpc_api_util.s_query_token_info(VIP_API_BASE,tmp_id,'assert'))
    }

    await Promise.all(queryInfoP).then(function(rets){
        // console.log('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<rets.length;i++)
        {
            let newInfo = list[i]
            newInfo = newInfo ? newInfo :{user_id:users[i],user_name:''}
            delete newInfo.salt
            delete newInfo.pwd

            let vipInfo = rets[i]  ? {vip_level:rets[i].vip_level,vip_timeout:rets[i].vip_timeout}:{vip_level:0}
            list[i] = Object.assign({},vipInfo,newInfo);
        }
    })

    return res.json({ret:true,msg:'success',list})
}

/**
 * 添加客服
 */
module.exports.add_console_user =add_console_user;
async function add_console_user(req, res) {
    let {dst_user_id,random, sign} = str_filter.get_req_data(req);

    //判断是否是客服
    let isExists = await rpc_api_util.s_check_token_list_related(USER_API_BASE,CONSOLE_USER_LIST_ID,dst_user_id,'relc')
    if(isExists) return res.json({ret:false,msg:'dst_user_id is already the console-user'})

    let addRet =  await rpc_api_util.s_save_into_token_list(USER_API_BASE,CONSOLE_USER_LIST_ID,dst_user_id,'relc','add to console-user-list')
    if(addRet) return res.json({ret:true,msg:'success'})

    res.json({ret:false,msg:'add to console-user-list failed'})
}

/**
 * 删除客服
 */
module.exports.del_console_user =del_console_user;
async function del_console_user(req, res) {
    let {dst_user_id,random, sign} = str_filter.get_req_data(req);

    //判断是否是客服
    let isExists = await rpc_api_util.s_check_token_list_related(USER_API_BASE,CONSOLE_USER_LIST_ID,dst_user_id,'relc')
    if(!isExists) return res.json({ret:false,msg:'dst_user_id is not the console-user'})

    let delRet =  await rpc_api_util.s_del_from_token_list(USER_API_BASE,CONSOLE_USER_LIST_ID,dst_user_id,'relc','add to console-user-list')
    if(delRet) return res.json({ret:true,msg:'success'})

    res.json({ret:false,msg:'del from console-user-list failed'})
}

/**
 * 所有群聊
 * @type {query_all_chatroom}
 */
module.exports.query_all_chatroom =query_all_chatroom;
async function query_all_chatroom(req, res) {
    let {random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})
    len = parseInt(len)
    begin = parseInt(begin)

    let cnt = 0,now_pos=0, chats = [],queryInfoP = [],page_len=1000;
    while(true)
    {
        let listRet = await rpc_query(MSGA_API_BASE+'/chain/opcode',{token:MSGA_TOKEN_ROOT,opcode:'fork',begin:now_pos,len:page_len})
        if(!listRet || !listRet.ret || !listRet.list) break;

        let i =0, list = listRet.list;
        for(;i<list.length;i++)
        {
            list[i].txjson = JSON.parse(list[i].txjson)

            //判断是否是新创建的user_id---不区分单聊和群聊（2020-5-9）_chat02
            if(list[i].txjson.token_x.indexOf(MSGA_TOKEN_NAME+'_chat0')==0)
            {
                if(cnt>=begin && cnt<begin+len)
                {
                    chats.push(list[i].txjson.token_x)
                    queryInfoP.push(rpc_api_util.s_query_token_info(MSGA_API_BASE,list[i].txjson.token_x,'assert'));
                }
                cnt++;
            }
        }
        if(cnt>=begin+len) break;
        //游标
        now_pos+=page_len;
    }
    
    let newObjs = []
    //查询分类数据
    await Promise.all(queryInfoP).then(function(rets){
        // JSON.stringify('queryUserInfoP-rets:'+JSON.stringify(rets))
        for(let i =0;i<chats.length;i++)
        {
            let newInfo = rets[i]
            if(newInfo)
            {
                newInfo.chatid = chats[i]
                newObjs.push(newInfo)
            }else{
                newObjs.push({chatid:chats[i],chatname:''})
            }
        }
    })
    if(newObjs && newObjs.length>0) res.json({ret:true,msg:'success',list:newObjs})
    else res.json({ret:false,msg:'list is empty'})
}


/**
 * 封禁社群
 */
module.exports.ban_chat =ban_chat;
async function ban_chat(req, res) {
    let {user_id,chatid,random, sign} = str_filter.get_req_data(req);

    //拿到聊天室信息
    let chatInfo = await rpc_api_util.s_query_token_info(MSGA_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat-info is empty'})

    chatInfo.is_baned = true;
    chatInfo.ban_time_i = parseInt(new Date().getTime()/1000); 
    chatInfo.ban_user_id = user_id

    let assertRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'ban the chatroom')
    if(!assertRet) return res.json({ret:false,msg:'ban the chatroom failed'})

    res.json({ret:true,msg:'success'})
}

/**
 * 解封社群
 */
module.exports.unban_chat =unban_chat;
async function unban_chat(req, res) {
    let {user_id,chatid,random, sign} = str_filter.get_req_data(req);

    //拿到聊天室信息
    let chatInfo = await rpc_api_util.s_query_token_info(MSGA_API_BASE,chatid,'assert')
    if(!chatInfo) return res.json({ret:false,msg:'chat-info is empty'})

    chatInfo.is_baned = false; //解封
    chatInfo.unban_time_i = parseInt(new Date().getTime()/1000); 
    chatInfo.unban_user_id = user_id

    let assertRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,chatid,'assert',JSON.stringify(chatInfo),'ban the chatroom')
    if(!assertRet) return res.json({ret:false,msg:'unban the chatroom failed'})

    res.json({ret:true,msg:'success'})
}

/**
 * 所有消息
 * @type {query_all_msg}
 */
module.exports.query_all_msg =query_all_msg;
async function query_all_msg(req, res) {
    let {random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})
    begin = parseInt(begin)
    len = parseInt(len)

    let cnt = 0,now_pos=0, msgs = [],queryInfoP = [];
    while(true)
    {
        let listRet = await rpc_query(MSGA_API_BASE+'/chain/opcode',{token:MSGA_TOKEN_ROOT,opcode:'fork',begin:now_pos,len:len})
        if(!listRet || !listRet.ret || !listRet.list) break;

        let i =0, list = listRet.list;
        for(;i<list.length;i++)
        {
            list[i].txjson = JSON.parse(list[i].txjson)

            if(list[i].txjson.token_x.indexOf(MSGA_TOKEN_NAME+'_msg')==0)
            {
                if(cnt>=begin && cnt<begin+len)
                {
                    msgs.push(list[i].txjson.token_x)
                    queryInfoP.push(rpc_api_util.s_query_token_info(MSGA_API_BASE,list[i].txjson.token_x,'assert'));
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
        for(let i =0;i<msgs.length;i++)
        {
            let newInfo = rets[i]
            if(newInfo)
            {
                newInfo.msgid = msgs[i]
                newObjs.push(newInfo)
            }else{
                newObjs.push({msgid:msgs[i],msg:''})
            }
        }
    })
    return res.json({ret:true,msg:'success',list:newObjs})
}


const BATCH_MSGA_LIST_ID = 'batchlist0000000'
/**
 * 新建群发
 * @type {new_batch_send_msg}
 */
module.exports.new_batch_send_msg =new_batch_send_msg;
async function new_batch_send_msg(req, res) {
    //img_name,img_id,img_fmt, url    //图片
    //file_id,title,fmt, url,filename  //文件
    //time_sec,record_id,fmt,url,record_name //语音  record
    //time_sec,video_id,fmt,url,name //short_video
    let param = str_filter.get_req_data(req);
    let {user_id,s_id,msg,type,recv_type,random, sign} = param;
    if(type!='text' && type!='img' && type!='file' && type!='record'&& type!='short_video' && type!='video')
        return res.json({ret:false,msg:'type error'})
    
    if(recv_type!='user' && recv_type!='vipuser' && recv_type!='console_user' && recv_type!='chat')
        return res.json({ret:false,msg:'recv_type error'})

    // 防重放攻击
    let str = await user_redis.get(config.redis_key+":new_batch_send_msg:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(config.redis_key+":new_batch_send_msg:"+user_id+random,random,120)

    let tmpBody = Object.assign({},param);
    delete tmpBody.user_id;
    delete tmpBody.s_id;
    // delete tmpBody.msg;
    delete tmpBody.type;
    delete tmpBody.recv_type;

    let time_i = parseInt(new Date().getTime()/1000);
    let obj = {user_id,type,msg,recv_type,time_i,time:str_filter.GetDateTimeFormat(time_i),body:tmpBody};
    let batchId = await rpc_api_util.s_fork_token_id(MSGA_API_BASE,MSGA_TOKEN_ROOT,'batch');
    if(!batchId) return res.json({ret:false,msg:'fork batch-id failed'})
    obj.batch_id = batchId;

    let batch_list_id = await rpc_api_util.s_query_token_id(MSGA_API_BASE,MSGA_TOKEN_ROOT,BATCH_MSGA_LIST_ID)
    let relateRet = await rpc_api_util.s_save_into_token_list(MSGA_API_BASE,batch_list_id,batchId,'relb','add to batchlist');
    if(!relateRet) return res.json({ret:false,msg:'relate batch-id to batch-list-id failed'})
    
    //获得要发送的收信人列表。
    let base_url = 'http://'+config.host+':'+config.port;
    let recv_list_url = recv_type=='user' ? '/chat/console/all/user':(recv_type=='vipuser'?'/chat/console/all/vipuser':
        (recv_type=='console_user'?'/chat/console/all/console_user':(recv_type=='chat'?'/chat/console/all/chatroom':null)));
    recv_list_url  =  base_url+recv_list_url;
    let userListRet = await http_post(recv_list_url,{user_id,s_id,begin:0,len:1000000,random:Math.random()})
    let userList = userListRet && userListRet.ret ? userListRet.list :[];

    console.log('userListRet:'+JSON.stringify(userListRet))

    obj.batch_cnt = userList.length;
    obj.batch_success_cnt = 0;
    let assertRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,batchId,'assert',JSON.stringify(obj),'save batch-info');
    if(!assertRet) return res.json({ret:false,msg:'assert batch-info failed'})

    //不等待处理完，而是直接返回。
    if(recv_type=='chat')
    {
        batch_send_chat_msg(user_id,obj,userList,type,param)
    }else{
        batch_send_user_msg(user_id,obj,userList,type,param)
    }

    obj.ret = true;
    obj.msg = 'success'
    res.json(obj)
}
/**
 * 查询batch的信息（如成功与否，成功的个数等）
 */
module.exports.query_batch_info =query_batch_info;
async function query_batch_info(req, res) {
    let {batch_id} = str_filter.get_req_data(req)
    if(!batch_id) return res.json({ret:false,msg:'batch_id failed'})

    let info = await rpc_api_util.s_query_token_info(MSGA_API_BASE,batch_id,'assert');
    if(!info) res.json({ret:false,msg:'batch-info is empty'})
    else {
        info.ret = true;
        info.msg = 'success';
        res.json(info)
    }
}

/**
 * 批量发放消息（针对群聊）
 */
async function batch_send_chat_msg(user_id,batchInfo,chatlist,type,param)
{
    let base_url = 'http://'+config.host+':'+config.port;
    let reqPath = type=='text'?'/chat/msg/send/text':(type=='file'?'/chat/msg/send/file':(type=='img'?'/chat/msg/send/img':
        (type=='record'?'/chat/msg/send/record':type=='short_video'?'/chat/msg/send/short_video':(type=='vide'?'/chat/msg/send/video':null))))
    if(!reqPath) return null;
    reqPath = base_url + reqPath;

    let msg_user_id = MSGA_TOKEN_NAME == USER_TOKEN_NAME ? user_id : MSGA_TOKEN_NAME+'_'+user_id.split('_')[1];
    let cnt = 0;
    for(let i=0;i<chatlist.length;i++)
    {
        let chatid = chatlist[i].chatid;
        //先join，再send
        let existsRet = await rpc_api_util.s_check_token_list_related(MSGA_API_BASE,msg_user_id,chatid,'relm')
        if(!existsRet)
        {
            let joinRet = await rpc_api_util.s_save_into_token_list(MSGA_API_BASE,msg_user_id,chatid,'relm')
            console.log(chatid+'--joinRet:'+joinRet);
        }

        //发送消息。
        param.chatid = chatid;
        param.random = Math.random();
        let sendRet = await http_post(reqPath,param)
        console.log('send chatid:'+chatid+' sendRet:'+JSON.stringify(sendRet));

        //发完就退群（原来不在群里的话）
        if(!existsRet)
        {
            let unjoinRet = await rpc_api_util.s_del_from_token_list(MSGA_API_BASE,msg_user_id,chatid,'relm')
            console.log(chatid+'--unjoinRet:'+unjoinRet);
        }

        if(sendRet && sendRet.ret) cnt++;
    }

    let batchId = batchInfo.batch_id;
    batchInfo.batch_success_cnt = cnt;
    batchInfo.end_time_i= parseInt(new Date().getTime()/1000);
    batchInfo.end_time  = str_filter.GetDateTimeFormat(batchInfo.end_time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,batchId,'assert',JSON.stringify(batchInfo),'save batch-success-cnt');
    console.log('save success-cnt assertRet:'+assertRet)

    return assertRet
}

/**
 * 批量发放消息（针对用户列表）
 */
async function batch_send_user_msg(user_id,batchInfo,userList,type,param)
{
    let base_url = 'http://'+config.host+':'+config.port;
    let reqPath = type=='text'?'/chat/msg/send/text':(type=='file'?'/chat/msg/send/file':(type=='img'?'/chat/msg/send/img':
        (type=='record'?'/chat/msg/send/record':type=='short_video'?'/chat/msg/send/short_video':(type=='vide'?'/chat/msg/send/video':null))))
    if(!reqPath) return null;
    reqPath = base_url + reqPath;

    let singleChatUrl = base_url+'/chat/single'

    // let msg_user_id = MSGA_TOKEN_NAME == USER_TOKEN_NAME ? user_id : MSGA_TOKEN_NAME+'_'+user_id.split('_')[0];
    let cnt = 0;
    for(let i=0;i<userList.length;i++)
    {
        param.user_b = userList[i].user_id;
        //single-chat
        param.random = Math.random();
        let singleRet = await http_post(singleChatUrl,param)
        console.log('singleRet:'+JSON.stringify(singleRet))
        let chatid = singleRet && singleRet.ret ? singleRet.chatid : null;
        if(!chatid) continue;

        //发送消息。
        param.chatid = chatid;
        param.random = Math.random();
        let sendRet = await http_post(reqPath,param)
        console.log('send chatid:'+chatid+' sendRet:'+JSON.stringify(sendRet));
        if(sendRet && sendRet.ret) cnt++;
    }

    let batchId = batchInfo.batch_id;
    batchInfo.batch_success_cnt = cnt;
    batchInfo.end_time_i= parseInt(new Date().getTime()/1000);
    batchInfo.end_time  = str_filter.GetDateTimeFormat(batchInfo.end_time_i)

    let assertRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,batchId,'assert',JSON.stringify(batchInfo),'save batch-success-cnt');
    console.log('save success-cnt assertRet:'+assertRet)

    return assertRet
}

/**
 * 查询群发列表（控制台功能）
 * @type {query_batch_msg_list}
 */
module.exports.query_batch_msg_list =query_batch_msg_list;
async function query_batch_msg_list(req, res) {
    let {begin,len,random, sign} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})
    begin = parseInt(begin)
    len = parseInt(len)

    let list = await rpc_api_util.s_query_token_list(MSGA_API_BASE,MSGA_TOKEN_NAME+'_'+BATCH_MSGA_LIST_ID,'relb',begin,len)
    if(!list) return res.json({ret:false,msg:'query batch-msg-list failed'})

    res.json({ret:true,msg:'success',list})
}



//-----------------邀请码设置和vip设置
/**
 * 这里是邀请码的设置
 */
module.exports.set_invite_setting =set_invite_setting;
async function set_invite_setting(req, res) {
    let {invite_type,score_reward,vip_reward,rmb_reward} = str_filter.get_req_data(req)

    if(invite_type!=parseInt(invite_type) || invite_type<=0 || invite_type>3) return res.json({ret:false,msg:'invite_type error'})
    if(score_reward!=parseInt(score_reward) || score_reward<0 ) return res.json({ret:false,msg:'score_reward error'})
    if(vip_reward!=parseInt(vip_reward) || vip_reward<0 || vip_reward>100) return res.json({ret:false,msg:'vip_reward error'})
    if(rmb_reward!=parseInt(rmb_reward) || rmb_reward<0 ) return res.json({ret:false,msg:'rmb_reward error'})

    let time_i = parseInt(new Date().getTime()/1000);
    let obj = {invite_type,score_reward,vip_reward,rmb_reward,time_i,time:str_filter.GetDateTimeFormat(time_i)} 
    let saveRet = await rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_ROOT,'config',JSON.stringify(obj),'set invite-setting')
    if(!saveRet) return res.json({ret:false,msg:'save invite-setting failed'})
    res.json({ret:true,msg:'success'})
}

/**
 * 这里是VIP的设置
 */
module.exports.set_vip_setting =set_vip_setting;
async function set_vip_setting(req, res) {
    let {setting} = str_filter.get_req_data(req)

    try{
        setting = JSON.parse(setting)
    }catch(ex)
    {
        console.log('set_vip_setting-exception:'+ex)
        return res.json({ret:false,msg:'setting error'})
    }

    for(let i=0;i<setting.length;i++)
    {
        let obj = setting[i]
        let {vip_level,price,vip_rights} = obj;
        vip_level = !vip_level ? i:vip_level;

        if(vip_level!=parseInt(vip_level) || vip_level<0 || vip_level> 9 ) return res.json({ret:false,msg:'vip_level-'+i+' error'})
        if(price!=parseInt(price) || price<0 ) return res.json({ret:false,msg:'price-'+i+' error'})
        if(!vip_rights) return res.json({ret:false,msg:'vip_rights-'+i+' error'})
        obj.vip_level = vip_level;
    }

    let saveRet = await rpc_api_util.s_save_token_info(VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_ROOT,'config',JSON.stringify(setting),'set vip-setting')
    if(!saveRet) return res.json({ret:false,msg:'save vip-setting failed'})
    res.json({ret:true,msg:'success'})
}


const about_app_id = OBJ_TOKEN_NAME+'_aboutapp00000000'
/**
 * 这里是关于软件的设置
 */
module.exports.set_about_app_info =set_about_app_info;
async function set_about_app_info(req, res) {
    let {info} = str_filter.get_req_data(req)
    if(!info) return res.json({ret:false,msg:'info error'})

    let update_time_i = parseInt(new Date().getTime()/1000)
    let obj = {info,update_time_i,update_time:str_filter.GetDateTimeFormat(update_time_i)}

    let about_id = await rpc_api_util.s_query_token_id(OBJ_API_BASE,OBJ_TOKEN_ROOT,about_app_id)
    if(!about_id)
    {
        return res.json({ret:false,msg:'query token-id failed'})
    }

    let saveRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,about_id,'assert',JSON.stringify(obj),'set about-app info')
    if(!saveRet)
    {
        return res.json({ret:false,msg:'set about-app info failed'})
    }
    return res.json({ret:true,msg:'success'})
}
/**
 * 得到关于软件的信息。
 */
module.exports.query_about_app_info =query_about_app_info;
async function query_about_app_info(req, res) {
    let obj = await rpc_api_util.s_query_token_info(OBJ_API_BASE,about_app_id,'assert')
    if(!obj) return res.json({ret:false,msg:'about-app info is empty'})

    obj.ret  = true;
    obj.msg = 'success'
    res.json(obj)
}

//-----------------------------------------------
/**
 * 这里是群聊的设置
 * const default_groupchat_setting = {create_vip_level:0,share_filter:1,gsb_fee:0,rmb_fee:0}
 */
module.exports.set_groupchat_setting =set_groupchat_setting;
async function set_groupchat_setting(req, res) {
    let {group_type,create_vip_level,share_filter,gsb_fee,rmb_fee} = str_filter.get_req_data(req)

    group_type = !group_type ? 'group':group_type
    //群聊现在有两种类型，一个是【群聊】，一个是直播间--【group_live】
    if(group_type!='group' && group_type!='group_live' && group_type!='group_shop')  return res.json({ret:false,msg:'group_type error'})

    if(create_vip_level!=parseInt(create_vip_level) || create_vip_level*1<NORMAL_VIP_LEVEL || create_vip_level*1>MANAGER_VIP_LEVEL) return res.json({ret:false,msg:'create_vip_level error'})
    if(share_filter!=parseInt(share_filter) || share_filter*1<=0 || share_filter*1>2 ) return res.json({ret:false,msg:'share_filter error'})
    if(gsb_fee!=gsb_fee*1 || gsb_fee*1<0 ) return res.json({ret:false,msg:'gsb_fee error'})
    if(rmb_fee!=rmb_fee*1 || rmb_fee*1<0 ) return res.json({ret:false,msg:'rmb_fee error'})

    let setting = await groupchat_c.get_groupchat_setting();

    let time_i = parseInt(new Date().getTime()/1000);
    let obj = {create_vip_level,share_filter,gsb_fee,rmb_fee,time_i,time:str_filter.GetDateTimeFormat(time_i)} 
    setting[group_type] = obj; //只修改制定类型

    let saveRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,MSGA_TOKEN_ROOT,'config',JSON.stringify(setting),'set groupchat-setting')
    if(!saveRet) return res.json({ret:false,msg:'save groupchat-setting failed'})
    res.json({ret:true,msg:'success'})
}




const TASK_LIST_ID = MSGA_TOKEN_NAME+'_robottask0000000';
/**
 * 机器人所有任务
 */
module.exports.query_all_robot_task = query_all_robot_task;
async function query_all_robot_task(req, res) {
    let {random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"begin error"})
    if(len !=len*1) return res.json({ret:false,msg:"len error"})
    begin = parseInt(begin)
    len = parseInt(len)

    //得到任务列表
    let list = await rpc_api_util.s_query_token_list(MSGA_API_BASE,TASK_LIST_ID,'relt',begin,len)
 
    //得到任务绑定的客服信息
    let query_info_console_user = [];
    for(let i=0;list && i<list.length;i++)
    {
        let console_user_id = list[i].console_user_id
        query_info_console_user.push(rpc_api_util.s_query_token_info(USER_API_BASE,console_user_id,'assert'))

    }
    //取出客服名字和头像
    await Promise.all(query_info_console_user).then(function(rets){
        for(let i =0;i<rets.length;i++)
        {
            list[i].console_user_name = rets[i].user_name
            list[i].console_user_head = rets[i].logo
        }
    })

    //console.log('测试：'+list[0].eventlist)
    //test
    //auto_add_new_user('user_29YmfnRQc6ndfsiF', 'afterRegister');

    return res.json({ret:true,msg:'success',list})
}


/**
 * 机器人新建任务
 * 
 */
module.exports.add_robot_task = add_robot_task;
async function add_robot_task(req, res) {
    let param = str_filter.get_req_data(req);
    let {console_user_id, task_name, eventlist, random, sign} = param;//console_user_id:客服，task_name:任务名称，eventlist：事件列表
    

    //判断是否绑定客服
    let console_info = await rpc_api_util.s_query_token_info(USER_API_BASE,console_user_id,'assert')
    if(!console_info) return res.json({ret:false, msg:'binding console user error'})

    //判断任务名格式
    if(task_name == '') return res.json({ret:false,msg:'task_name error'})

    
    let obj = {console_user_id, task_name, eventlist};
    
    let task_id = await rpc_api_util.s_fork_token_id(MSGA_API_BASE,MSGA_TOKEN_ROOT,'task');
    if(!task_id) return res.json({ret:false,msg:'fork task-id failed'})
    obj.task_id = task_id;

    let task_list_id = await rpc_api_util.s_query_token_id(MSGA_API_BASE,MSGA_TOKEN_ROOT,TASK_LIST_ID)
    let relateRet = await rpc_api_util.s_save_into_token_list(MSGA_API_BASE,task_list_id,task_id,'relt','add to tasklist');
    if(!relateRet) return res.json({ret:false,msg:'relate task to batch-list-id failed'})

    let assertRet = await rpc_api_util.s_save_token_info(MSGA_API_BASE,MSGA_TOKEN_ROOT,task_id,'assert',JSON.stringify(obj),'save task');
    if(!assertRet) return res.json({ret:false,msg:'assert task failed'})

    return res.json({ret:true,msg:'success',obj})
}

/**
 * 删除机器人任务
 */
module.exports.del_robot_task = del_robot_task;
async function del_robot_task(req, res) {
    let {dst_task_id,random, sign} = str_filter.get_req_data(req);
    //console.log("测试"+dst_task_id)
    let delRet =  await rpc_api_util.s_del_from_token_list(MSGA_API_BASE,TASK_LIST_ID,dst_task_id,'relt','del from robot-task-list')
    if(!delRet) return res.json({ret:false,msg:'del from robot-task-list failed'})

    return res.json({ret:true,msg:'success'})


}

/**
 * 机器人客服自动加新注册的用户
 */
module.exports.auto_add_new_user =auto_add_new_user;
async function auto_add_new_user(userid, trigger) {
    if(!userid ) return null;

    //得到任务列表
    let task_list = await rpc_api_util.s_query_token_list(MSGA_API_BASE,TASK_LIST_ID,'relt',0,1000)

    //遍历每个任务
    for(let i=0;task_list && i<task_list.length;i++)
    {
        let console_user_id = task_list[i].console_user_id
        
        /**
         * 调用
         * 
         * 创建单聊窗口（或者查找单聊窗口）--返回一个聊天室token-id（即群聊token-id）
         * 如果已经创建，就返回查询到的单聊的聊天室。
         * 会自动添加联系人
         */
        let base_url = 'http://'+config.host+':'+config.port;
        let reqPath = base_url + '/chat/single'

        //生成session-id
        let s_id = str_filter.randomBytes(16);
        user_redis.set(config.redis_key+":session:"+console_user_id+"-"+s_id,s_id)

        //let {user_id,s_id,user_b, random, sign} = str_filter.get_req_data(req);
        let reqparam = {}
        reqparam.user_id = console_user_id
        reqparam.s_id = s_id;
        reqparam.user_b = userid
        reqparam.random = Math.random();
        
        let sendRes = await http_post(reqPath, reqparam)
        console.log('single:'+console_user_id+'++++'+userid+' sendRet:'+JSON.stringify(sendRes));
    

        //完成每个任务的事件列表
        let event_list = task_list[i].eventlist;
        for(let j = 0; event_list && j < event_list.length; j++){
            /**
            * 1.触发条件
            * event_list[j].trigger_condition //触发条件
            */
           if(event_list[j].triggering_condition != trigger){
            continue;  //判断是否触发事件
           }

            /**
            * 2.执行动作
            * 
            * 2.1 发消息(sendMsg)
            * 2.2 自动加群(addGroup)
            * 
            */
            let action = event_list[j].perform_action //执行动作

            if(action == 'sendMsg'){
                let type = event_list[j].type //根据消息类型不同调用不同方法发送消息
                let base_url = 'http://'+config.host+':'+config.port;
                let reqPath = type=='text'?'/chat/msg/send/text':(type=='file'?'/chat/msg/send/file':(type=='img'?'/chat/msg/send/img':
                    (type=='record'?'/chat/msg/send/record':type=='short_video'?'/chat/msg/send/short_video':(type=='vide'?'/chat/msg/send/video':null))))
                if(!reqPath) return null;
                reqPath = base_url + reqPath;

                if(type == 'text'){
                    //发送文本：
                    //let {user_id, s_id, chatid,msg, random, sign} = str_filter.get_req_data(req);
                    let param = {}
                    param.user_id = console_user_id
                    param.s_id = s_id
                    param.chatid = sendRes.chatid
                    param.msg = event_list[j].content

                    param.random = Math.random();
                    let sendRet = await http_post(reqPath, param)
                    console.log('send chatid:'+sendRes.chatid+' sendRet:'+JSON.stringify(sendRet));

                }else if(type == 'img'){
                    //发送图片：
                    //let {user_id, s_id,chatid,msg,img_name,img_id,img_fmt, url,random, sign} = str_filter.get_req_data(req);
                    let param = {}
                    param.user_id = console_user_id
                    param.s_id = s_id
                    param.chatid = sendRes.chatid

                    param.img_name = event_list[j].img_name
                    param.img_id = event_list[j].img_id
                    param.img_fmt = event_list[j].img_fmt
                    param.url = event_list[j].url

                    param.random = Math.random();
                    let sendRet = await http_post(reqPath, param)
                    console.log('send chatid:'+sendRes.chatid+' sendImgRet:'+JSON.stringify(sendRet));

                }else if(type == 'file'){
                    //发送文件
                    //let {user_id, s_id,chatid,msg,file_id,title,fmt, url,filename,file_size,random, sign} = str_filter.get_req_data(req);
                    let param = {}
                    param.user_id = console_user_id
                    param.s_id = s_id
                    param.chatid = sendRes.chatid

                    param.file_id = event_list[j].file_id
                    param.title = event_list[j].title
                    param.fmt = event_list[j].fmt
                    param.url = event_list[j].url
                    param.filename = event_list[j].filename
                    param.file_size =  event_list[j].file_size

                    param.random = Math.random();
                    let sendRet = await http_post(reqPath, param)
                    console.log('send chatid:'+sendRes.chatid+' sendRet:'+JSON.stringify(sendRet));

                }
                //待扩展其他消息类型
                //。。。。。。。。。

            }else if(action == 'addGroup'){
                /**
                 * 自动加群
                 * 调用 “加入群聊” 服务
                 * 
                 */
                let base_url = 'http://'+config.host+':'+config.port;
                let reqPath = base_url + '/chat/join'

                //生成session-id
                let user_s_id = str_filter.randomBytes(16);
                user_redis.set(config.redis_key+":session:"+userid+"-"+user_s_id,user_s_id)

                // let {user_id, s_id, chatid, random, sign} = str_filter.get_req_data(req);
                let param = {}
                param.user_id = userid
                param.s_id = user_s_id
                param.chatid = event_list[j].chatid
                param.random = Math.random();
                
                let addGroupRes = await http_post(reqPath, param) //加入群聊
                console.log('addChatid:'+event_list[j].chatid+' addGroupRes:'+JSON.stringify(addGroupRes));

            }
            
        }
        
    }

}


/**
 * 获得群列表
 */
module.exports.group_chat_list =group_chat_list;
async function group_chat_list(req, res) {
    let {user_id,s_id, random, sign, begin, len} = str_filter.get_req_data(req);
    if(!user_id ) return res.json({ret:false,msg:'user-id error'})
    if (begin != begin * 1) return res.json({ret: false, msg: "begin format error"})
    if (len != len * 1) return res.json({ret: false, msg: "len format error"})

    //校验session
    //let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    //if(!str) return res.json({ret:false,msg:"session error"})

    // 获取群列表
    let msg_user_id = USER_TOKEN_NAME!=MSGA_TOKEN_NAME ?MSGA_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;
    let groupList =  await rpc_api_util.s_query_token_list(MSGA_API_BASE,msg_user_id,'relm',begin,len);
    let grouplist = []
    for(let i=0;i<groupList.length;i++)
    {
        let obj = groupList[i]
        if(obj.chat_type=='group' ) //获取群聊
        {
            grouplist.push(obj)
        }
    }

    res.json({ret:true, msg:'success', grouplist})
}
  /**
    * 根据手机号查找用户获得uder_id
    */
module.exports.query_user_by_phone =query_user_by_phone;
async function query_user_by_phone(req, res) {
    let {user_id, s_id, phone, random} = str_filter.get_req_data(req);
    if(!phone || phone.length!=11 || phone!=phone*1) return res.json({ret: false, msg: "phone is error"});

    //校验session
    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
     if(!str) return res.json({ret:false,msg:"session error"})
    let ret = await rpc_query(USER_API_BASE+"/chain/opcode",{token:USER_TOKEN_NAME+'_phone'+phone,opcode:'assert',begin:0,len:1});
    if(!ret && !ret.ret)  return res.json({ret: false, msg: "this phone is not registed"});

    ret.list[0].txjson = JSON.parse(ret.list[0].txjson);

    let list ={}, queryInfoP = [];
    list = JSON.parse(ret.list[0].txjson.opval);

    return res.json({ret:true,msg:'success',list:list});
}  