window.monitor_c = {}
// const monitor_c_token_name = OBJ_TOKEN_NAME
// const monitor_c_api_base   = OBJ_API_BASE
// const monitor_c_token_root = OBJ_TOKEN_ROOT

const monitorPeerMap = new Map()
const monitorPeerSecCntMap=new Map()
const monitorPeerMinCntMap=new Map()//minute分钟统计
const monitorPeerLockMap=new Map()
const monitor_channel_name  = 'monitor-agent'
const monitor_system_user_id= 'monitor-system-default-user'
let monitor_news_list = []
const monitor_news_urls = ['/dweb/xmsg/send']

monitor_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    // app.all('/monitor/question',urlParser,session_filter,monitor_c.question)
    // app.all('/monitor/answer',urlParser,session_filter,monitor_c.answer) //订阅
    app.all('/monitor/news',urlParser,session_filter,monitor_c.news)
    query_server_side_event_bus()
    if(typeof g_node_side_event_bus !='undefined')
    {
        g_node_side_event_bus.on('api-monitor',apiMonitor)
        g_node_side_event_bus.on('api_monitor_unlock',unlockPeer)

        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initMonitorChannelFlag = await creatMonitorAgentChannel()
        console.log('initMonitorChannelFlag:',initMonitorChannelFlag)
    }
}
//得到g_node_side_event_bus
function query_server_side_event_bus()
{
    if(typeof g_node_side_event_bus=='undefined')
    window.g_node_side_event_bus = new EventEmitter()
    return g_node_side_event_bus
}
function unlockPeer(xobj)
{
    console.log('call-unlockPeer-now:')
    if(!xobj ||!xobj.peer) return  false
    monitorPeerMinCntMap.delete(xobj.peer)
    monitorPeerLockMap.delete(xobj.peer) 
    console.log('call-unlockPeer-end!')
    return true
}
async function apiMonitor(xobj)
{
    let {url,req,result} = xobj
    let {user_id,s_id} = str_filter.get_req_data(req)
    console.log('apiMonitor:',url,user_id)
    save2MonitorPeerMap(req,user_id)
    countSecMonitorPeer(req)
    countMinMonitorPeer(req)
    if(result.data.ret && monitor_news_urls.indexOf(url)>=0)//仅调用成功的才进行订阅的发送
    monitor_send_news(req,user_id,result)
}
function countSecMonitorPeer(req)
{
    if(!req || !req.peer) return false
    let cntObj = {time_i:parseInt(Date.now()/1000),cnt:0}
    if(monitorPeerSecCntMap.has(req.peer)) cntObj = monitorPeerSecCntMap.get(req.peer)
    let nowTimeI = parseInt(Date.now()/1000)
    if(nowTimeI != cntObj.time_i)
    {
        cntObj = {time_i:nowTimeI,cnt:1}
    }else{
        cntObj.cnt++
    }
    //max_cnt为配置的每秒不能超过的api请求数量----例如默认为60（1秒请求不能多于60，否则会被baned-api-result）
    let max_cnt = typeof g_api_monitor_sec_max_cnt =='undefined' ? 60: g_api_monitor_sec_max_cnt
    if(cntObj.cnt>max_cnt) //如果超过频率，req.peer会被锁定
    {
        cntObj.locked = true
        console.log('countMonitorPeer-locked-req:',req.url,req.params.user_id)
    }
    monitorPeerSecCntMap.set(req.peer,cntObj)
    return true
}
function countMinMonitorPeer(req)
{
    if(!req || !req.peer) return false
    let cntObj = {time_m:parseInt(Date.now()/60000),cnt:0}
    if(monitorPeerMinCntMap.has(req.peer)) cntObj = monitorPeerMinCntMap.get(req.peer)
    let nowTimeM = parseInt(Date.now()/60000)
    if(nowTimeM != cntObj.time_m)
    {
        cntObj = {time_m:nowTimeM,cnt:1}
    }else{
        cntObj.cnt++
    }
    //max_cnt为配置的每秒不能超过的api请求数量----例如默认为1000（1分钟请求不能多于1000，否则会被baned-api-result）
    let max_cnt = typeof g_api_monitor_min_max_cnt =='undefined' ? 1000: g_api_monitor_min_max_cnt
    if(cntObj.cnt>max_cnt) //如果超过频率，req.peer会被锁定
    {
        // cntObj.locked = true
        //永久锁定，除非采用验证码解码或者支付dtns
        monitorPeerLockMap.set(req.peer,{time_m:nowTimeM,time_i:parseInt(Date.now()/1000),locked:true})
        console.log('countMonitoMinrPeer-locked-req:',req.url,req.params.user_id)
        if( (cntObj.cnt-max_cnt) %3 == 0) //必通知，避免客户端漏过验证过程
        req.peer.send(JSON.stringify({notify_type:'need_captcha',channel:monitor_channel_name,user_id:monitor_system_user_id,xobj:{max_cnt,cnt:cntObj.cnt,locked:true}}))
    }
    monitorPeerMinCntMap.set(req.peer,cntObj)
    return true
}
//返回是否被locked
window.g_monitor_url_lock_filter = apiMonitorUrlFilter
function apiMonitorUrlFilter(req)
{
    //防止恶意攻击行为
    if(monitorPeerLockMap.has(req.peer))  //这个是持久锁定，除非解锁（例如使用验证码解锁）
    {
        if(req.url && req.url.startsWith('/captcha')) return 0 
        return 2
    } 
    if(!monitorPeerSecCntMap.has(req.peer))  return 0
    let cntObj = monitorPeerSecCntMap.get(req.peer)
    let nowTimeI = parseInt(Date.now()/1000)
    return cntObj.time_i == nowTimeI && cntObj.locked ? 1: 0 //是否被锁
}
async function save2MonitorPeerMap(req,user_id)
{
    if(!monitorPeerMap.has(req.peer))
    {
        monitorPeerMap.set(req.peer,req)
        let cret = await creatMonitorAgentChannel(user_id,req.peer)
        console.log('apiMonitor-cret:',cret)
        if(!cret) return monitorPeerMap.delete(req.peer)

        //fix the bux 2024-1-4
        if(!window.g_monitor_tid)
        window.g_monitor_tid = setInterval(()=>{
            sendMonitorAgentChannelMsg({'monitor-notice-str':Date.now()})
        },30000)
    }
}
//订阅最新的dweb-news动态等（也包含其它的动态--例如xxx动态）
monitor_c.news = async function(req,res)
{
    let {user_id} = str_filter.get_req_data(req)
    save2MonitorPeerMap(req,user_id)//保持订阅monitor频道信息
    for(let i=0;i<monitor_news_list.length;i++)
    {
        if(monitor_news_list[i].req.peer == req.peer)
            return res.json({ret:true,msg:'success'})
    }
    monitor_news_list.push({req,user_id,time_i:Date.now()})
    res.json({ret:true,msg:'success'})
}
async function monitor_send_news(req,user_id,result)
{
    let channel = monitor_channel_name
    let params = str_filter.get_req_data(req)
    delete params.s_id
    let xobj = {url:req.url,user_id,params}
    let delList = []
    //返回apiresult结果给前端
    let apiresult = JSON.stringify(result.data)
    apiresult = apiresult.length>=10*1024 ? '{}':apiresult
    xobj.apiresult = JSON.parse(apiresult)
    for(let i=0;i<monitor_news_list.length;i++)
    {
        let peer = monitor_news_list[i].req.peer
        let user_id = monitor_system_user_id
        try{
            peer.send(JSON.stringify({notify_type:'news',channel,user_id,xobj}))
        }catch(ex)
        {
            delList.push(monitor_news_list[i])
        }
    }
    let results = []
    monitor_news_list.forEach((val,i,list)=>{
        if(delList.indexOf(val)>=0) return 
        results.push(val)
    })
    monitor_news_list = results
}
async function sendMonitorAgentChannelMsg(xobj,notify_type = monitor_channel_name)
{
    let user_id = monitor_system_user_id
    let channel = monitor_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendMonitorAgentChannelMsg-ret:',ret)
    return ret
}
function recvMonitorClientUserChannelMsg(data)
{
    console.log('recvMonitorClientUserChannelMsg-data:',data)
}
async function creatMonitorAgentChannel(user_id = null,peer = null)
{
    let system_user_id = user_id?user_id: monitor_system_user_id
    let defaultPeer = peer ? peer:{send:recvMonitorClientUserChannelMsg}
    let channel = monitor_channel_name
    let ret = user_id?{ret:true}: await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id:system_user_id},peer:defaultPeer},{json:function(data){
            res(data)
        }})
    })
    console.log('creatMonitorAgentChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id:system_user_id},peer:defaultPeer},{json:function(data){
            res(data)
        }})
    })
    console.log('creatMonitorAgentChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    if(!user_id)
    {
        let monitorAllowSendUsersRet = await sendMonitorAgentChannelMsg(monitor_system_user_id,'allow_send_users')
        console.log('monitorAllowSendUsersRet:',monitorAllowSendUsersRet)
    }
    return true
}