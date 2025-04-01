window.rtcode_c = {}
// const rtcode_c_token_name = OBJ_TOKEN_NAME
// const rtcode_c_api_base   = OBJ_API_BASE
// const rtcode_c_token_root = OBJ_TOKEN_ROOT

const codesMap = new Map()
const rtcode_channel_system_user_id = 'rtcode-system-default-user'
const rtcode_channel_name = 'rtcode-channel'
const rtcode_channel_notify_user_info = 'user_info'
const rtcode_channel_notify_code = 'code'
const rtcode_channel_notify_code_matched = 'code_matched'
const rtcode_success_cnts    = [1,5,20,50,100,200,500]
const rtcode_success_rewards = [0.0001,0.001,0.01,0.1,1,1.5,2]

rtcode_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtcode/send',urlParser,session_filter,rtcode_c.send)//发送后，在系统保留10-60s，以待对方pick起来！
    // app.all('/rtcode/reconnect',urlParser,session_filter,rtcode_c.reconnect)//重连，须使用private_key再次证实身份
    // app.all('/rtcode/pick',urlParser,session_filter,rtcode_c.pick) //暂不支持防止中间人攻击--如须防--须使用dtns.did.ecc-key会泄露隐私）对方在线方能捡起（使用ecc非对称加密方法）距离限制，超出距离无法捞起等！
    // app.all('/rtcode/web3key/sync',urlParser,session_filter,rtcode_c.syncWeb3key)
    // app.all('/rtcode/reply',urlParser,session_filter,rtcode_c.reply) //仅在客户端存储，如退出，则不再可见
    app.all('/rtcode/info',urlParser,session_filter,rtcode_c.info) //查看相应的public_key等
    // app.all('/rtcode/filter',urlParser,session_filter,rtcode_c.filter)//过滤器

    if(true)
    {
        // g_node_side_event_bus.on('api-monitor',apiMonitor)
        // g_node_side_event_bus.on('api_monitor_unlock',unlockPeer)
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initRTCodeChannelFlag = await creatRTCodeChannel()
        console.log('initRTCodeChannelFlag:',initRTCodeChannelFlag)

        rtcode_autoSendCode()
    }
}
//计算奖励
function calcRTCodeRewards(cnt)
{
    if(cnt <=0) return 0
    let cnts = typeof g_rtcode_success_cnts !='undefined' ? g_rtcode_success_cnts : rtcode_success_cnts
    let rewards = typeof g_rtcode_success_rewards !='undefined' ? g_rtcode_success_rewards : rtcode_success_rewards
    let reward = rewards&& rewards.length>0 ? rewards[0] :0 //按1次的进行奖励
    for(let i=0;i<cnts.length;i++)
    {
        //仅相等才奖励，其它情况按1次的进行奖励
        if(cnt==cnts[i]) return rewards[i]
    }
    return reward
}
//重点考虑，是否使用多重安全签名和aes256加密机制？
rtcode_c.send = rtcode_send
async function rtcode_send(req,res)
{
    let {user_id,code} = str_filter.get_req_data(req)
    if(!code) return res.json({ret:false,msg:'code is error'})
    code = (''+code).toLowerCase()
    
    //unmatch  clear the success_cnt
    if(!codesMap.has(code))
    {
        let userInfo = await kmmDb.get('rtcode:'+user_id)
        if(userInfo)
        {
            userInfo = JSON.parse(userInfo)
            userInfo.success_cnt = 0
            let setFlag = await kmmDb.set('rtcode:'+user_id,JSON.stringify(userInfo))
            if(!setFlag){
                setFlag = await kmmDb.set('rtcode:'+user_id,JSON.stringify(userInfo))
                if(!setFlag) return res.json({ret:false,msg:'code unmatch, and save failed'})
            }
            sendRTCodeChannelMsg(userInfo,rtcode_channel_notify_user_info)
            return res.json({ret:false,msg:'code unmatch, save success!'})
        }else{
            userInfo = {top_cnt:0,success_cnt:0,user_id}
            //kmmDb.set('rtcode:'+user_id,JSON.stringify(userInfo))
        }
        sendRTCodeChannelMsg(userInfo,rtcode_channel_notify_user_info)
        return res.json({ret:false,msg:'code unmatch!'})
    } 

    let codeid = codesMap.get(code)
    codesMap.delete(code) //删除掉这个code
    let userInfo = await kmmDb.get('rtcode:'+user_id)
    if(!userInfo){
        userInfo = {top_cnt:1,success_cnt:1,user_id}
    }else{
        userInfo = JSON.parse(userInfo)
        userInfo.success_cnt ++
        if(userInfo.success_cnt> userInfo.top_cnt) userInfo.top_cnt = userInfo.success_cnt
    }
    let setFlag = await kmmDb.set('rtcode:'+user_id,JSON.stringify(userInfo))
    if(!setFlag){
        setFlag = await kmmDb.set('rtcode:'+user_id,JSON.stringify(userInfo))
        if(!setFlag) return res.json({ret:false,msg:'code matched, but save failed'})
    }
    //通知所有人....有新的瓶子（主要是以msgid为key通知）
    sendRTCodeChannelMsg(userInfo,rtcode_channel_notify_user_info)
    sendRTCodeChannelMsg({codeid,msg:'code matched'},rtcode_channel_notify_code_matched)
    //发送奖励
    let reward = calcRTCodeRewards(userInfo.success_cnt)
    let userAccount = await rtmarket_c.createUserMarkAccount(user_id,g_rtmarket_mark_default)
    let extra_obj = Object.assign({},userInfo)
    extra_obj.tips = 'rtcode_reward'
    let extra_data = JSON.stringify(extra_obj)
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(extra_data)
    let sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:rtmarket_c.get_mark_default_root_token(g_rtmarket_mark_default),token_y:userAccount.mark_account_id,opval:reward, extra_data})
    //返回结果
    res.json({ret:true,msg:'success',reward,reward_ret:sendRet && sendRet.ret})
}
rtcode_c.info = rtcode_info
async function rtcode_info(req,res)
{
    let {user_id} = str_filter.get_req_data(req)
    let userInfo = await kmmDb.get('rtcode:'+user_id)
    if(!userInfo) return res.json({ret:false,msg:'user-info is empty!'})
    userInfo = JSON.parse(userInfo)
    userInfo.ret = true
    userInfo.msg = 'success'
    res.json(userInfo)
}
async function rtcode_autoSendCode()
{
    try{
    while(true)
    {
        //智能判断peers数量,是否超过1,如未超过1,则不生成code以及发送code,避免影响性能!
        let peers = typeof g_rt_channel_peers != 'undefined' ? g_rt_channel_peers.get(rtcode_channel_name) :[]
        // console.log('autoSendCode:peers:cnt:',peers ? peers.length:0)
        if(!peers || (window.g_dev_port && typeof Buffer != 'undefined' ?  peers.length<3 :  peers.length<2)){
            await new Promise((resolve)=>setTimeout(resolve,500))
            // console.log('autoSendCode:peers:cnt:',peers ? peers.length:0)
            continue
        }
        
        let ret = await g_axios.get('http://captcha.dtns.top/q')
        console.log('captcha-ret:',ret )//?ret.true:'network-error',ret && ret.data ? ret.data.substring(0,32):'code-svg-is-null')
        if(typeof Buffer == 'undefined') ret = ret ? ret.data :ret
        let code = (''+ret.text).toLowerCase()
        if(codesMap.has(code)) continue
        const codeid = sign_util.newTXID().replace('txid_','rtcode_')
        codesMap.set(code,codeid)
        sendRTCodeChannelMsg({data:ret.data,code:'***',codeid,reward_flag:rtcode_success_rewards &&rtcode_success_rewards.length>0},rtcode_channel_notify_code)
        setTimeout(()=>codesMap.delete(code),60*1000)//60秒之后,自动清理
        await new Promise((resolve)=>setTimeout(resolve,3000))//3秒1个
        console.log('autoSendCode:code:'+code)
    }}catch(ex)
    {
        console.log('autoSendCode-exception:'+ex,ex)
    }
}
async function recvRTCodeClientUserChannelMsg(data)
{
    // console.log('recvRTCodeClientUserChannelMsg:',data)
    if(!data ||!data.channel ||!data.notify_type ||!data.xobj) return false
    let xobj = data.xobj
    if(notify_type == 'sync_aes256key')
    {
    }
}
async function creatRTCodeChannel()
{
    let user_id = rtcode_channel_system_user_id
    let channel = rtcode_channel_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvRTCodeClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTCodeChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvRTCodeClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTCodeChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendRTCodeChannelMsg(user_id,'allow_send_users')
    console.log('setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}

async function sendRTCodeChannelMsg(xobj,notify_type = 'rtcode')
{
    let user_id = rtcode_channel_system_user_id
    let channel = rtcode_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendRTCodeChannelMsg-ret:',ret)
    return ret
}



