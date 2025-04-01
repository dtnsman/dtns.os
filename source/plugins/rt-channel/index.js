

window.rtchannel_c = {}
// const rtchannel_c_token_name = OBJ_TOKEN_NAME
// const rtchannel_c_api_base   = OBJ_API_BASE
// const rtchannel_c_token_root = OBJ_TOKEN_ROOT

rtchannel_c.routers =function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtchannel/create',urlParser,session_filter,rtchannel_c.create)
    app.all('/rtchannel/focus',urlParser,session_filter,rtchannel_c.focus) //订阅
    app.all('/rtchannel/unfocus',urlParser,session_filter,rtchannel_c.unfocus)//取消订阅
    app.all('/rtchannel/send',urlParser,session_filter,rtchannel_c.send)//发送xmsg---以xtype为核心（只要有focus权限，就有发送权限）
}
function query_g_rt_channels()
{
    if(typeof g_rt_channel_peers == 'undefined')
    {
        window.g_rt_channels = new Map() //使用kmmDb
        window.g_rt_channels_pm = new Map()//user-channel
        window.g_rt_channel_peers = new Map()
    }
    return g_rt_channels
}
//支持vip_level、chatids、xmsgids、forkids等方式控制权限----类似file-lock
window.rtchannel_c.create = rtchannel_create
async function rtchannel_create(req,res)
{
    let {user_id,channel,vip_level,chatids,xmsgids,forkids,expire,limit,limit_type,ban_users,allow_send_users} = str_filter.get_req_data(req)
    if(!req.peer){
        return res.json({ret:false,msg:'Error: RPCHost version is old, need param : req.peer'})
    }
    if(!channel) {
        return res.json({ret:false,msg:'param channel error'})
    }
    expire = !expire ? -1 : expire

    let objInfo = {user_id,channel,expire,vip_level,chatids,xmsgids,forkids,limit,limit_type,ban_users,allow_send_users,time_i:parseInt(Date.now()/1000)}

    query_g_rt_channels()
    
    if(g_rt_channels.has(channel))
    {
        return res.json({ret:false,msg:'channel is exist!'})
    }

    let channelInfo = await kmmDb.get(channel)
    if(channelInfo)
    {
        g_rt_channels.set(channel,JSON.parse(channelInfo))
        g_rt_channel_peers.set(channel,[])
        return res.json({ret:false,msg:'channel is exist!'})
    }

    //持久化--但控制时间
    let ret = await kmmDb.set('rtchannel:'+channel,JSON.stringify(objInfo),expire)
    if(ret) g_rt_channels.set(channel,objInfo)
    if(ret) return res.json({ret:true,msg:'success'})
    res.json({ret:false,msg:'save channel-info failed'})
}
window.rtchannel_c.queryChanneInfo = rtchannel_queryChanneInfo
async function rtchannel_queryChanneInfo(channel)
{
    query_g_rt_channels()
    if(g_rt_channels.has(channel))
    {
        return g_rt_channels.get(channel)
    }
    else{
        let channelInfo = await kmmDb.get('rtchannel:'+channel)
        if(channelInfo)
        {
            channelInfo = JSON.parse(channelInfo)
            g_rt_channels.set(channel,channelInfo)
            g_rt_channel_peers.set(channel,[])
            return channelInfo
        }
        else  return null
    }
}
/**
 * 订阅
 */
window.rtchannel_c.focus = rtchannel_focus
async function rtchannel_focus(req,res) 
{
    let {channel,user_id} = str_filter.get_req_data(req)
    let channelInfo = await rtchannel_queryChanneInfo(channel)
    if(!channelInfo) return res.json({ret:false,msg:'channel-info is empty'})

    query_g_rt_channels()
    let peerTmpArray = g_rt_channel_peers.get(channel)
    if(channelInfo.ban_users && channelInfo.ban_users.indexOf(user_id)>=0)
    {
        return res.json({ret:false,msg:'no pm to focus the channel, you are in the ban-list'})
    }
    //仅限一次peer
    if(channelInfo.limit_type == 'once' && peerTmpArray && peerTmpArray.length>0)
    {
        return res.json({ret:false,msg:'limit_type is once, and the peers.length>0'})
    }
    //仅限一个user-id
    if(channelInfo.limit_type == 'single' && peerTmpArray && peerTmpArray.length>0)
    {
        for(let i=0;i<peerTmpArray.length;i++){
            if(user_id !=peerTmpArray[i].channel_user_id)
                return res.json({ret:false,msg:'limit_type is single, and the users.length>0'})
        } 
    }
    //按用户数量限制
    else if(channelInfo.limit_type == 'user' && peerTmpArray && peerTmpArray.length>0)
    {
        let map = new Map(),cnt = 0
        for(let i=0;i<peerTmpArray.length;i++){
            //用户的唯一性计数
            if(map.has(peerTmpArray[i].channel_user_id)) continue
            //更新计数
            map.set(peerTmpArray[i].channel_user_id,'yes')
            cnt++
        } 
        let addFlag = !map.has(user_id)
        if(addFlag && cnt>=channelInfo.limit) 
            return res.json({ret:false,msg:'limit_type is user, and the users.length>='+channelInfo.limit})
    }
    else if(channelInfo.limit_type=='users' && channelInfo.limit && channelInfo.limit.indexOf(user_id)<0)
    {
        return res.json({ret:false,msg:'limit_type is users, and you are not in users-list'})
    }
    //仅按peer连接数计算
    else if(channelInfo.limit_type == 'peer' && peerTmpArray && peerTmpArray.length>=channelInfo.limit)
    {
            return res.json({ret:false,msg:'limit_type is peer, and the peers.length>='+channelInfo.limit})
    }

    //判断管理员权限和资源拥有者权限
    let is_console_user = await new Promise(async (resolve)=>{
        let oldResJsonFunc = res.json
        //hack the res.json
        res.json = function(data){
            // console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
            res.json = oldResJsonFunc
            resolve(false)
        }
        console_filter(req,res,function(){
            res.json = oldResJsonFunc
            resolve(true)
        })
    })
    console.log('rtchannel-focus-is_console_user:',is_console_user,channelInfo.user_id == user_id)

    //如是管理员和资源拥有者，直接返回
    let focus_pm_ok = !(channelInfo.vip_level >0 || channelInfo.chatids || channelInfo.forkids || channelInfo.xmsgids)
    
    if(is_console_user || channelInfo.user_id == user_id)
    {
        focus_pm_ok = true 
    }
    
    //判断vip_level权限
    if(!focus_pm_ok && channelInfo.vip_level >0 )
    {
        let vipInfo = await rpc_api_util.s_query_token_info(VIP_API_BASE,VIP_TOKEN_NAME+'_'+user_id.split('_')[1],'assert');
        let now_time = parseInt(new Date().getTime()/1000);
        vipInfo = !vipInfo ? {vip_level:NORMAL_VIP_LEVEL,send_vip_level:NORMAL_VIP_LEVEL,invite_vip_level:NORMAL_VIP_LEVEL,vip_timeout:0}:vipInfo;
        if(now_time< vipInfo.vip_timeout && vipInfo.vip_level >= channelInfo.vip_level)
            focus_pm_ok = true
    }
    //判断chatids权限
    if(!focus_pm_ok && channelInfo.chatids)
    {
        let chatids = channelInfo.chatids.split(';')
        //依次判断权限
        for(let i=0;i<chatids.length;i++)
        {
            req.params.chatid = chatids[i]
            if(!req.params.chatid) continue
            let nextFlag = await new Promise(async (resolve)=>{
                let oldResJsonFunc = res.json
                //hack the res.json
                res.json = function(data){
                    console.log('rtchannel-focus-vip-filter-call-oldResJsonFunc-res-json:',data)
                    // oldResJsonFunc(data)//权判断权限，不返回
                    res.json = oldResJsonFunc
                    resolve(false)
                }
                // vip_filter_manager(req,res,function(){
                    vip_filter(req,res,function(){
                        res.json = oldResJsonFunc
                        resolve(true)
                    })
                // })
            })
            if(nextFlag)
            {
                console.log('rtchannel-focus-chatid:'+req.params.chatid,'pm is ok',channelInfo)
                focus_pm_ok = true
                break
                // return res.json({ret:true,msg:'success',web3key,web3hash})
            }
        }
    }
    //判断forkids权限
    let userInfo =  req.userInfo ? req.userInfo :  await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!focus_pm_ok && !userInfo)
    {
        let result = {ret:false,msg:'user-info is empty'}
        console.log('rtchannel-focus-userInfo-result:'+JSON.stringify(result))
        return res.json(result)
    }
    if(!focus_pm_ok && channelInfo.forkids)
    {
        let forkids_visit_flag = false
        if(userInfo.dtns_user_id)
        {
            let forkidsArray = channelInfo.forkids.split(';')
            let reqs = []
            for(let i=0;i<forkidsArray.length;i++){
                reqs.push(rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:forkidsArray[i]}))
            }
            let rets = await Promise.all(reqs)
            console.log('forkid-map-key-value-query-rets:',rets)
            //web3InfoRet && web3InfoRet.map_value
            let reqs2 = []
            for(let i=0;i<rets.length;i++)
            {
                reqs2.push(rets[i] && rets[i].ret && rets[i].map_value ? 
                        rpc_api_util.s_check_token_list_related(DTNS_API_BASE,userInfo.dtns_user_id,rets[i].map_value,'relf'):false)
            }
            let rets2 = await Promise.all(reqs2)
            console.log('forkids-check-relations-rets2:',rets2)
            for(let i=0;i<rets2.length;i++)
            {
                if(rets2[i]){
                    forkids_visit_flag = true
                    break;
                }
            }
        }
        if(forkids_visit_flag)
        {
            console.log('rtchannel-focus-forkids-pm is ok',channelInfo)
            focus_pm_ok = true
        }
    }
    //判断xmsgids权限
    if(!focus_pm_ok && channelInfo.xmsgids)
    {
        let xmsgids_visit_flag = false

        let xmsgidsArray = channelInfo.xmsgids.split(';')
        let reqs = []

        let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;


        for(let i=0;i<xmsgidsArray.length;i++){
            reqs.push(rpc_api_util.s_check_token_list_related(MSG_API_BASE,xmsgidsArray[i],msg_user_id,'relb'))
        }
        let rets = await Promise.all(reqs)
        console.log('xmsgids--query-rets:',rets)
        for(let i=0;i<rets.length;i++)
        {
            if(rets[i]){
                xmsgids_visit_flag = true
                break;
            }
        }
        if(xmsgids_visit_flag)
        {
            console.log('rtchannel-focus-xmsgsid-pm is ok',channelInfo)
            focus_pm_ok = true
        }
    }

    if(!focus_pm_ok) return res.json({ret:false,msg:'focus channel have no pm!'})

    req.peer.channel_user_id = user_id
    if(g_rt_channel_peers.has(channel))
    {
        let peerArray = g_rt_channel_peers.get(channel)
        if(peerArray.indexOf(req.peer)>=0)
        {
            console.log('[double rtchannel-peer]req.peer is exits in g_rt_channel_peers',channel,req.peer)
        }
        else{
            peerArray.push(req.peer)
        }
    }else{
        g_rt_channel_peers.set(channel,[req.peer])
    }

    //设置权限
    g_rt_channels_pm.set(user_id+':'+channel,'ok')

    let channel_peers = g_rt_channel_peers.get(channel)
    console.log('channel_peers:',channel_peers ? channel_peers.length : channel_peers,channel)
    res.json({ret:true,msg:'success',channel_peers_size:channel_peers.length,channel})
//   //开始测试 2023-5-11
//   setTimeout(()=>{
//     forklist_channel_notify('1|2|3:forklist')
//     forklist_channel_notify('xxxxxxxxxxx:forklist')
//   },3000)
//   user_redis.set('forklist_channel:4','3|4|5:forklist',300)
//   user_redis.set('forklist_channel:yyyyy','yyyyy:forklist',300)
//   setTimeout(()=>{

//     let req = {body:{body:'3|4|5'},params:{trade_status:'TRADE_SUCCESS'}}
//     let req2 = {body:{body:'yyyyy'},params:{trade_status:'TRADE_SUCCESS'}}
//     let res = {json:function(data){
//       console.log('test-notify-data-res:',data)
//     }}
//     notify(req,res)
//     h5_notify(req2,res)
//   },6000)
}
/**
 * 取消订阅
 * 目的：从channel队列中删除该req.peer
 */
window.rtchannel_c.unfocus = rtchannel_unfocus
async function rtchannel_unfocus(req,res) 
{
    let {channel,user_id} = str_filter.get_req_data(req)
    let channelInfo = await rtchannel_queryChanneInfo(channel)
    if(!channelInfo) return res.json({ret:false,msg:'channel-info is empty'})

    query_g_rt_channels()

    let channels = g_rt_channel_peers.get(channel)
    let iCnt = 0;
    let new_channels = []
    for(let i=0;i<channels.length;i++)
    {
        if(channels[i] && channels[i] ==req.peer){
            iCnt ++
            continue //不再保存
        } 
        new_channels.push(channels[i])
    }
    g_rt_channel_peers.set(channel,new_channels)//更新
    res.json({ret:true,msg:'success',cnt:iCnt})
}
/**
 * 发送xobj---内含有xtype-----须前后端支持rtchannel_xobj==true的协议
 */
window.rtchannel_c.send = rtchannel_send
async function rtchannel_send(req,res)
{
    let {user_id,channel,xobj,notify_type} = str_filter.get_req_data(req)
    query_g_rt_channels()

    let channelInfo = await rtchannel_queryChanneInfo(channel)
    if(!channelInfo) return res.json({ret:false,msg:'channel-info is empty'})

    let is_console_user = false
    if(['ban_user','allow_send_users'].indexOf(notify_type)>=0 || channelInfo.allow_send_users)
    {
        is_console_user = await new Promise(async (resolve)=>{
            let oldResJsonFunc = res.json
            //hack the res.json
            res.json = function(data){
                // console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
                res.json = oldResJsonFunc
                resolve(false)
            }
            console_filter(req,res,function(){
                res.json = oldResJsonFunc
                resolve(true)
            })
        })
    }
    if(notify_type == 'ban_user')
    {
        //判断管理员权限和资源拥有者权限
        console.log('rtchannel-ban_user-is_console_user:',is_console_user,channelInfo.user_id == user_id)
        if(is_console_user || channelInfo.user_id == user_id)
        {
            if(channelInfo.ban_users) channelInfo.ban_users += xobj
            else channelInfo.ban_users = xobj
            let updateRet = await kmmDb.set('rtchannel:'+channel,JSON.stringify(channelInfo),channelInfo.expire)
            return res.json({ret:true,msg:'success',updateRet})
        }else 
            return res.json({ret:false,msg:'update channel-ban-users failed: no pm!'})
    }
    else if(notify_type =='allow_send_users') //允许发送内容的用户列表设置（特别用于广播频道）
    {
        //判断管理员权限和资源拥有者权限
        console.log('rtchannel-ban_user-is_console_user:',is_console_user,channelInfo.user_id == user_id)
        if(is_console_user || channelInfo.user_id == user_id)
        {
            if(xobj) channelInfo.allow_send_users = xobj //设置
            else delete channelInfo.allow_send_users //删除
            let updateRet = await kmmDb.set('rtchannel:'+channel,JSON.stringify(channelInfo),channelInfo.expire)
            return res.json({ret:true,msg:'success',updateRet})
        }else 
            return res.json({ret:false,msg:'update channel-allow-send-users failed: no pm!'})
    }

    if(typeof g_rt_channels_pm == 'undefined' ||  !g_rt_channels_pm.has(user_id+':'+channel))
    {
        return res.json({ret:false,msg:'no pm to send ,please focus channel first!'})
    }

    if(typeof g_rt_channel_peers == 'undefined' || !g_rt_channel_peers.has(channel)){
        console.log('g_rt_channel_peers is undefined or not has this channel')
        return res.json({ret:false,msg:'[error]no pm to send ,please focus channel first!'})
    }

    //按允许发送列表限制用户
    if(channelInfo.allow_send_users)
    {
        //is_console_user（这里不允许系统管理员发--避免干扰到程序行为）
        if(!(channelInfo.user_id == user_id || channelInfo.allow_send_users.indexOf(user_id)>=0))
        {
            return res.json({ret:false,msg:'no pm: not in allow_send_users-list !'})
        }
    }

    let channels = g_rt_channel_peers.get(channel)
    let iCnt = 0;
    let new_channels = []
    xobj = JSON.parse(xobj)
    for(let i=0;i<channels.length;i++)
    {
        // if(channels[i] && channels[i].channel_user_id == user_id) continue //不给自己发送
        if(channels[i] && channels[i] == req.peer){
            new_channels.push(channels[i])//不能遗漏，否则会减少了订阅的peer数量 fix bug 2024-1-4
            continue //不给自己发送
        } 
        try{
            channels[i].send(JSON.stringify({notify_type:notify_type?notify_type:'rtchannel',channel,user_id,xobj}))
            iCnt+=1
            new_channels.push(channels[i])
        }catch(ex){
            console.log('send g_rt_channel_peers failed,exception:'+ex,ex)
        }
    }
    g_rt_channel_peers.set(channel,new_channels)

    console.log('g_rt_channel_peers-old-new-channels:',channels.length,new_channels.length)
    console.log('g_rt_channel_peers-send-cnt:'+iCnt)
    if(iCnt>0)
    {
        res.json({ret:true,msg:'success',cnt:iCnt})
    }
    res.json({ret:false,msg:'send failed:0'})
}