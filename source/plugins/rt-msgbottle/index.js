window.rtmsgbottle_c = {}
// const rtmsgbottle_c_token_name = OBJ_TOKEN_NAME
// const rtmsgbottle_c_api_base   = OBJ_API_BASE
// const rtmsgbottle_c_token_root = OBJ_TOKEN_ROOT

const msgBottlePeersMap = new Map()
const msgbottle_channel_system_user_id = 'rtmsgbottle-system-default-user'
const msgbottle_channel_name = 'rtmsgbottle-channel'
const msgbottleObj = {rtgift:null}
const msgbottle_gifts = ['flower','bicycle','motorcycle','car','roadster','jets']
const msgbottle_prices= [0.1,1,10,30,100,500]

rtmsgbottle_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtmsgbottle/send',urlParser,session_filter,rtmsgbottle_c.send)//发送后，在系统保留10-60s，以待对方pick起来！
    app.all('/rtmsgbottle/reconnect',urlParser,session_filter,rtmsgbottle_c.reconnect)//重连，须使用private_key再次证实身份
    app.all('/rtmsgbottle/pick',urlParser,session_filter,rtmsgbottle_c.pick) //暂不支持防止中间人攻击--如须防--须使用dtns.did.ecc-key会泄露隐私）对方在线方能捡起（使用ecc非对称加密方法）距离限制，超出距离无法捞起等！
    app.all('/rtmsgbottle/web3key/sync',urlParser,session_filter,rtmsgbottle_c.syncWeb3key)
    app.all('/rtmsgbottle/reply',urlParser,session_filter,rtmsgbottle_c.reply) //仅在客户端存储，如退出，则不再可见
    app.all('/rtmsgbottle/info',urlParser,session_filter,rtmsgbottle_c.info) //查看相应的public_key等
    // app.all('/rtmsgbottle/filter',urlParser,session_filter,rtmsgbottle_c.filter)//过滤器
    app.all('/rtmsgbottle/gift/send',urlParser,session_filter,rtmsgbottle_c.sendGift)

    if(true)
    {
        // g_node_side_event_bus.on('api-monitor',apiMonitor)
        // g_node_side_event_bus.on('api_monitor_unlock',unlockPeer)
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initMsgBottleChannelFlag = await creatMsgBottleChannel()
        console.log('initMsgBottleChannelFlag:',initMsgBottleChannelFlag)
        while(!window.MARK_TOKEN_NAME) await new Promise((res)=>setTimeout(res,1000))
        msgbottleObj.rtgift = new RTGift(msgbottle_gifts,msgbottle_prices)
    }
}
//重点考虑，是否使用多重安全签名和aes256加密机制？
rtmsgbottle_c.send = msgbottle_send
async function msgbottle_send(req,res)
{
    //密文 en_msg （为xmsg类型的消息，转为字符串后使用aes256加密）
    //msgid //消息id（由客户端创建即可）---reply时可用！
    //msgid+time_i使用private_key签名得到sign，可论证所有人关系（断线重连可证明所有者关系？）
    //user_id是会被隐藏的！使用public_key来证实身份信息
    //msgid---owner_public_key <-> picker_public_key（回应者公钥）----保存于kmmDb中（用于恢复连接reconnect）
    let {xmsgid,xtype,time_i,en_msg,web3key_hash,msg_sign,user_id} = str_filter.get_req_data(req)
    if(!xmsgid) return res.json({ret:false,msg:'xmsgid is error'})
    if(!isFinite(time_i)) return res.json({ret:false,msg:'time_i is error'})
    if(parseInt(time_i) + 60 < parseInt(Date.now()/1000)) return res.json({ret:false,msg:'time_i is error'})
    let owner_public_key = null;
    try{ 
        owner_public_key = await key_util.recoverPublickey(msg_sign,await key_util.hashVal(xmsgid+':'+time_i))
    }catch(ex){
        console.log('recoverPublickey-failed:'+ex,ex)
        owner_public_key = null
        return res.json({ret:false,msg:'msg_sign is error'})
    } 
    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(msginfo) return res.json({ret:false,msg:'xmsgid is existed'})  
    msginfo = JSON.parse(msginfo)

    let body = {xmsgid,time_i,en_msg,web3key_hash,msg_sign,owner_public_key}
    let setFlag = await kmmDb.set('msgbottle:'+xmsgid,JSON.stringify(body))
    if(!setFlag){
        res.json({ret:false,msg:'save failed'})
    }
    //通知所有人....有新的瓶子（主要是以msgid为key通知）

    msgBottlePeersMap.set(xmsgid,{owner_peer:req.peer,owner_user_id:user_id})
    sendMsgBottleChannelMsg({xmsgid,xtype})
    res.json({ret:true,msg:'success'})
}

rtmsgbottle_c.pick = msgbottle_pick
async function msgbottle_pick(req,res)
{
    let {xmsgid,time_i,picker_sign,user_id} = str_filter.get_req_data(req)
    if(!xmsgid) return res.json({ret:false,msg:'xmsgid is error'})
    if(!isFinite(time_i)) return res.json({ret:false,msg:'time_i is error'})
    if(parseInt(time_i) + 60 < parseInt(Date.now()/1000)) return res.json({ret:false,msg:'time_i is error'})
    let picker_public_key = null;
    try{ 
        picker_public_key = await key_util.recoverPublickey(picker_sign,await key_util.hashVal(xmsgid+':'+time_i))
    }catch(ex){
        console.log('recoverPublickey-failed:'+ex,ex)
        picker_public_key = null
        return res.json({ret:false,msg:'picker_sign is error'})
    } 

    //得到picker_public_key
    // let picker_public_key = await key_util.recoverPublickey(picker_sign,await key_util.hashVal(xmsgid+':'+time_i))
    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(!msginfo) return res.json({ret:false,msg:'xmsgid is unexist!'})
    msginfo = JSON.parse(msginfo)
    if(msginfo.picker_sign) return res.json({ret:false,msg:'xmsgid is picked'})
    msginfo.picker_sign = picker_sign
    msginfo.pick_time_i = time_i
    msginfo.picker_public_key = picker_public_key
    let setFlag = await kmmDb.set('msgbottle:'+xmsgid,JSON.stringify(msginfo))
    if(!setFlag) return res.json({ret:false,msg:'update msg-bottle-info failed'})
    let peers = msgBottlePeersMap.get(xmsgid)
    if(!peers) return res.json({ret:false,msg:'peers is empty'})
    peers.picker_peer = req.peer
    peers.picker_user_id=user_id
    //发送指令给目标用户，使之同步xmsgid的对应的aes-256key给目标picker_public_key对应的用户。
    try{
        peers.owner_peer.send(JSON.stringify({notify_type:'need_aes256key',channel:msgbottle_channel_name,user_id:msgbottle_channel_system_user_id,xobj:{xmsgid,picker_public_key}}))
        sendMsgBottleChannelMsg({xmsgid,picker_public_key},'picked')
    }catch(ex){
        console.log('msgbottle-pick-exception:'+ex,ex)
        return res.json({ret:false,msg:'notice owner_peer failed! may be offline'})
    }
    res.json({ret:true,msg:'success'})
}
rtmsgbottle_c.syncWeb3key = msgbottle_syncWeb3key
async function msgbottle_syncWeb3key(req,res)
{
    let {xmsgid,time_i,sign,en_msg} = str_filter.get_req_data(req)
    if(!xmsgid) return res.json({ret:false,msg:'xmsgid is error'})
    if(!en_msg) return res.json({ret:false,msg:'en_msg is error'})
    if(!isFinite(time_i)) return res.json({ret:false,msg:'time_i is error'})
    if(parseInt(time_i) + 60 < parseInt(Date.now()/1000)) return res.json({ret:false,msg:'time_i is error'})
    let owner_public_key = null;
    try{ 
        owner_public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    }catch(ex){
        console.log('recoverPublickey-failed:'+ex,ex)
        owner_public_key = null
        return res.json({ret:false,msg:'sign is error'})
    } 
    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(!msginfo) return res.json({ret:false,msg:'xmsgid is unexist!'})
    msginfo = JSON.parse(msginfo)
    if(!msginfo.picker_sign) return res.json({ret:false,msg:'xmsgid is not picked'})

    if(owner_public_key != msginfo.owner_public_key) return res.json({ret:false,msg:'sign-pulic-key not equal owner_public_key'})
    let peers = msgBottlePeersMap.get(xmsgid)
    if(!peers) return res.json({ret:false,msg:'peers is empty'})
    //发送指令给目标用户，使之同步xmsgid的对应的aes-256key给目标picker_public_key对应的用户。
    try{
        peers.picker_peer.send(JSON.stringify({notify_type:'sync_aes256key',channel:msgbottle_channel_name,user_id:msgbottle_channel_system_user_id,xobj:{xmsgid,en_msg}}))
    }catch(ex){
        console.log('msgbottle-syncWeb3key-exception:'+ex,ex)
        return res.json({ret:false,msg:'sync-web3key failed! picker may be offline'})
    }
    res.json({ret:true,msg:'success'})
}
rtmsgbottle_c.reply = msgbottle_reply
async function msgbottle_reply(req,res)
{
    let {xmsgid,time_i,sign,en_msg} = str_filter.get_req_data(req)
    if(!xmsgid) return res.json({ret:false,msg:'xmsgid is error'})
    if(!isFinite(time_i)) return res.json({ret:false,msg:'time_i is error'})
    if(parseInt(time_i) + 60 < parseInt(Date.now()/1000)) return res.json({ret:false,msg:'time_i is error'})
    let public_key = null;
    try{ 
        public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    }catch(ex){
        console.log('recoverPublickey-failed:'+ex,ex)
        public_key = null
        return res.json({ret:false,msg:'sign is error'})
    } 
    // let public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(!msginfo) return res.json({ret:false,msg:'msgbottle is unexist!'})
    msginfo = JSON.parse(msginfo)
    if(!msginfo.picker_public_key) return res.json({ret:false,msg:'msgbottle need pick first!'})
    console.log('[msginfo.picker_public_key,msginfo.owner_public_key]:',[msginfo.picker_public_key,msginfo.owner_public_key],public_key)
    if([msginfo.picker_public_key,msginfo.owner_public_key].indexOf(public_key)<0)
        return res.json({ret:false,msg:'sign unmatch owner or picker public_key!'})

    let is_picker = msginfo.picker_public_key == public_key
    let peers = msgBottlePeersMap.get(xmsgid)
    if(!peers) return res.json({ret:false,msg:'peers is empty'})
    let peer = is_picker ? peers.owner_peer :peers.picker_peer
    //发送消息至目标用户
    try{
        peer.send(JSON.stringify({notify_type:'reply',channel:msgbottle_channel_name,user_id:msgbottle_channel_system_user_id,xobj:{xmsgid,time_i,en_msg,sign,is_picker}}))
    }catch(ex){
        console.log('msgbottle-reply-exception:'+ex,ex)
        return res.json({ret:false,msg:'reply msgbottle failed! may be offline',is_picker})
    }
    res.json({ret:true,msg:'success',is_picker})
}
/**
 * 发送礼品
 */
rtmsgbottle_c.sendGift = msgbottle_send_gift
async function msgbottle_send_gift(req,res)
{
    let {xmsgid,time_i,sign,en_msg,gift} = str_filter.get_req_data(req)
    if(!xmsgid) return res.json({ret:false,msg:'xmsgid is error'})
    if(!isFinite(time_i)) return res.json({ret:false,msg:'time_i is error'})
    if(parseInt(time_i) + 60 < parseInt(Date.now()/1000)) return res.json({ret:false,msg:'time_i is error'})
    let public_key = null;
    try{ 
        public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    }catch(ex){
        console.log('recoverPublickey-failed:'+ex,ex)
        public_key = null
        return res.json({ret:false,msg:'sign is error'})
    } 
    // let public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(!msginfo) return res.json({ret:false,msg:'msgbottle is unexist!'})
    msginfo = JSON.parse(msginfo)
    if(!msginfo.picker_public_key) return res.json({ret:false,msg:'msgbottle need pick first!'})
    console.log('[msginfo.picker_public_key,msginfo.owner_public_key]:',[msginfo.picker_public_key,msginfo.owner_public_key],public_key)
    if([msginfo.picker_public_key,msginfo.owner_public_key].indexOf(public_key)<0)
        return res.json({ret:false,msg:'sign unmatch owner or picker public_key!'})

    let is_picker = msginfo.picker_public_key == public_key
    let peers = msgBottlePeersMap.get(xmsgid)
    if(!peers) return res.json({ret:false,msg:'peers is empty'})

    let giftid = sign_util.newTXID().replace('txid_','rtgift_')
    let user_id= is_picker ? peers.picker_user_id :peers.owner_user_id
    let recv_user_id= is_picker ? peers.owner_user_id :peers.picker_user_id

    //处理转账---这个不匿名
    let sendRet = await msgbottleObj.rtgift.sendGiftBySafe(gift,user_id,recv_user_id,JSON.stringify({xmsgid,giftid,gift}))
    // sendRet.user_id = user_id
    // sendRet.recv_user_id = recv_user_id
    sendRet.gift = gift
    if(!sendRet.ret) return res.json(sendRet)
    res.json(sendRet)


    let peer = is_picker ? peers.owner_peer :peers.picker_peer
    let peer1= is_picker ? peers.picker_peer :peers.owner_peer
    //发送消息至目标用户（显示被赠送了礼物）
    try{
        peer.send(JSON.stringify({notify_type:'gift',channel:msgbottle_channel_name,user_id:msgbottle_channel_system_user_id,xobj:{xmsgid,time_i,en_msg,sign,is_picker,gift,gift_owner:false}}))
        peer1.send(JSON.stringify({notify_type:'gift',channel:msgbottle_channel_name,user_id:msgbottle_channel_system_user_id,xobj:{xmsgid,time_i,en_msg,sign,is_picker,gift,gift_owner:true}}))
    }catch(ex){
        console.log('msgbottle-reply-exception:'+ex,ex)
        // return res.json({ret:false,msg:'reply msgbottle failed! may be offline',is_picker})
    }
}

rtmsgbottle_c.info = msgbottle_info
async function msgbottle_info(req,res)
{
    let {xmsgid,time_i,sign} = str_filter.get_req_data(req)
    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(!msginfo) return res.json({ret:false,msg:'msgbottle is unexist!'})
    msginfo = JSON.parse(msginfo)
    msginfo.ret = true
    msginfo.msg = 'success'
    res.json(msginfo)
}
//断线重连
rtmsgbottle_c.reconnect = msgbottle_reconnect 
async function msgbottle_reconnect(req,res)
{
    let {xmsgid,time_i,sign,user_id} = str_filter.get_req_data(req)
    if(!xmsgid) return res.json({ret:false,msg:'xmsgid is error'})
    if(!isFinite(time_i)) return res.json({ret:false,msg:'time_i is error'})
    if(parseInt(time_i) + 60 < parseInt(Date.now()/1000)) return res.json({ret:false,msg:'time_i is error'})
    let public_key = null;
    try{ 
        public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    }catch(ex){
        console.log('recoverPublickey-failed:'+ex,ex)
        public_key = null
        return res.json({ret:false,msg:'sign is error'})
    } 

    let msginfo = await kmmDb.get('msgbottle:'+xmsgid)
    if(!msginfo) return res.json({ret:false,msg:'msgbottle is unexist!'})
    msginfo = JSON.parse(msginfo)
    // let public_key = await key_util.recoverPublickey(sign,await key_util.hashVal(xmsgid+':'+time_i))
    let peers = msgBottlePeersMap.has(xmsgid) ?  msgBottlePeersMap.get(xmsgid) :{}
    if(msginfo.owner_public_key == public_key)
    {
        peers.owner_peer = req.peer
        peers.owner_user_id= user_id
    }else if(msginfo.picker_public_key == public_key){
        peers.picker_peer= req.peer
        peers.picker_user_id= user_id
    }
    else{
        return res.json({ret:false,msg:'sign is error'})
    }
    console.log('reconnect-peers-update:',peers)
    if(!msgBottlePeersMap.has(xmsgid)) msgBottlePeersMap.set(xmsgid,peers)
    res.json({ret:true,msg:'success',is_picker:msginfo.picker_public_key == public_key})
}

async function recvMsgBottleClientUserChannelMsg(data)
{
    console.log('recvMsgBottleClientUserChannelMsg:',data)
    if(!data ||!data.channel ||!data.notify_type ||!data.xobj) return false
    let xobj = data.xobj
    if(notify_type == 'sync_aes256key')
    {
        let {xmsgid,en_msg} = xobj
        let peers = msgBottlePeersMap.get(xmsgid)
        if(!peers)
        {
            console.log('sync_aes256key-failed: peers is empty')
            return false
        }
        //定向同步key
        try{
            peers.picker_peer.send(JSON.stringify({notify_type:'sync_aes256key',channel:msgbottle_channel_name,user_id:msgbottle_channel_system_user_id,xobj:{xmsgid,en_msg}}))
        }catch(ex){
            console.log('msgbottle-sync-key-exception:'+ex,ex,{ret:false,msg:'notice picker_peer failed!may be offline'})
            return false
        }
        return true
    }
}
async function creatMsgBottleChannel()
{
    let user_id =  msgbottle_channel_system_user_id
    let channel = msgbottle_channel_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvMsgBottleClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatMsgBottleChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvMsgBottleClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatMsgBottleChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendMsgBottleChannelMsg(user_id,'allow_send_users')
    console.log('setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}

async function sendMsgBottleChannelMsg(xobj,notify_type = 'msgbottle')
{
    let user_id = msgbottle_channel_system_user_id
    let channel = msgbottle_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendMsgBottleChannelMsg-ret:',ret)
    return ret
}



