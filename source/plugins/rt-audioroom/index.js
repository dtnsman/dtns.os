window.rtaudioroom_c = {}
// const rtaudioroom_c_token_name = OBJ_TOKEN_NAME
// const rtaudioroom_c_api_base   = OBJ_API_BASE
// const rtaudioroom_c_token_root = OBJ_TOKEN_ROOT

const rtaudioroomMatchMap = new Map()
const rtaudioroomObj = {matchList: [],last_room_list:[],rtgift:null}
const rtaudioroom_channel_system_user_id = 'rtaudioroom-system-default-user'
const rtaudioroom_channel_name = 'rtaudioroom-channel'
const rtaudioroom_gifts = ['flower','bicycle','motorcycle','car','roadster','jets']
const rtaudioroom_prices= [0.1,1,10,30,100,500]
// const rtaudioroom_channel_notify_matched = 'room_matched'
// const rtaudioroom_channel_notify_moved = 'room_moved'

rtaudioroom_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtaudioroom/match',urlParser,session_filter,rtaudioroom_c.match)
    app.all('/rtaudioroom/create',urlParser,session_filter,rtaudioroom_c.create)
    app.all('/rtaudioroom/info',urlParser,session_filter,rtaudioroom_c.info)
    app.all('/rtaudioroom/rooms',urlParser,session_filter,rtaudioroom_c.rooms)
    // app.all('/rtaudioroom/please',urlParser,session_filter,rtaudioroom_c.please)
    // app.all('/rtaudioroom/view',urlParser,session_filter,rtaudioroom_c.view)
    app.all('/rtaudioroom/send',urlParser,session_filter,rtaudioroom_c.send)
    app.all('/rtaudioroom/gift/send',urlParser,session_filter,rtaudioroom_c.sendGift)

    if(true)
    {
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initRTAudioRoomChannelFlag = await creatRTAudioRoomChannel()
        console.log('initRTAudioRoomChannelFlag:',initRTAudioRoomChannelFlag)

        let rooms = await rtaudiorooms_recover()
        console.log('rtaudiorooms_recover:rooms:',rooms)

        // autoSendCode()
        if(typeof g_node_side_event_bus!='undefined')
        {
            g_node_side_event_bus.on('*****',function(data){
                console.log('*****:',data)
            })
        }

        while(!window.MARK_TOKEN_NAME) await new Promise((res)=>setTimeout(res,1000))
        rtaudioroomObj.rtgift = new RTGift(rtaudioroom_gifts,rtaudioroom_prices)
    }
}
rtaudioroom_c.saveRtAudioRoomInfo2Db = saveRtAudioRoomInfo2Db
async function saveRtAudioRoomInfo2Db(roomInfo)
{
    let delRet = await kmmDb.del('rtaudioroom-info:'+roomInfo.room_id)
    let saveRet= await kmmDb.set('rtaudioroom-info:'+roomInfo.room_id,JSON.stringify(roomInfo))
    console.log('saveRtAudioRoomInfo2Db-rets:',delRet,saveRet)
    return saveRet
}
rtaudioroom_c.saveRtAudioRooms2Db = saveRtAudioRooms2Db
async function saveRtAudioRooms2Db()
{
    let delRet = await kmmDb.del('rtaudiorooms')
    let saveRet= await kmmDb.set('rtaudiorooms',JSON.stringify(rtaudioroomObj.last_room_list))
    console.log('saveRtAudioRooms2Db-rets:',delRet,saveRet)
    return saveRet
}
//room匹配系统
rtaudioroom_c.match = rtaudioroom_match
async function rtaudioroom_match(req,res)
{
    // let {user_id} = str_filter.get_req_data(req)
    if(rtaudioroomObj.last_room_list.length<=0) return res.json({ret:false,msg:'last-room is empty'})
    let room_id = rtaudioroomObj.last_room_list[rtaudioroomObj.last_room_list.length-1]
    let roomInfo= await rtaudioroom_info_recover(room_id)
    if(!roomInfo) return res.json({ret:false,msg:'last-room-info is empty'})
    let result = Object.assign({},roomInfo)
    result.ret = true
    result.msg = 'success'
    // result.view_flag=true
    res.json(result)
}
/**
 * action操作棋的动作
 */
rtaudioroom_c.create = rtaudioroom_create
async function rtaudioroom_create(req,res)
{
    let {user_id,room_name,user_name,allow_users,logo} = str_filter.get_req_data(req)
    
    let now_time_i = parseInt( Date.now()/1000 )
    if(!room_name || !(room_name.trim())) room_name = user_name+'创建的语聊房'
    let room_id = sign_util.newTXID().replace('txid_','rtaudioroom_')
    if(rtaudioroomMatchMap.has(room_id))  room_id = sign_util.newTXID().replace('txid_','rtaudioroom_')
    if(rtaudioroomMatchMap.has(room_id)) return res.json({ret:false,msg:"new room-id failed"})
    let roomInfo = {room_id,user_id,user_name,time_i:now_time_i,room_name,allow_users,logo}
    rtaudioroomMatchMap.set(room_id,roomInfo)
    saveRtAudioRoomInfo2Db(roomInfo)
    let result = Object.assign({},roomInfo)
    result.ret = true
    result.msg = 'success'
    res.json(result)
    push2rtaudioroom_list(room_id)
}
//得到roomInfo
async function rtaudioroom_info_recover(room_id)
{
    let roomInfo = rtaudioroomMatchMap.get(room_id)
    if(!rtaudioroomMatchMap.has(room_id)){
        let roomInfoStr =await kmmDb.get('rtaudioroom-info:'+room_id)
        if(!roomInfoStr) return null//res.json({ret:false,msg:'rtaudioroom-info is empty'})
        try{
            roomInfo = JSON.parse(roomInfoStr)
        }catch(ex){
            console.log('parse rtaudioroom-info-str failed! exception:'+ex,ex,room_id)
            return null;//res.json({ret:false,msg:'parse rtaudioroom-info-str failed!'})
        }
        rtaudioroomMatchMap.set(room_id,roomInfo) //恢复至内存
    }
    return roomInfo
}
/**
 * 从db中恢复过来
 * @returns 
 */
async function rtaudiorooms_recover()
{
    let rooms = []
    let roomInfoStr =await kmmDb.get('rtaudiorooms')
    if(!roomInfoStr) return []//res.json({ret:false,msg:'rtaudioroom-info is empty'})
    try{
        rooms = JSON.parse(roomInfoStr)
        for(let i=0;rooms && i<rooms.length;i++)
        {
            push2rtaudioroom_list(rooms[i], i == rooms.length-1 ) //最后一个，才保存至kmmDb中
        }
        return rooms
    }catch(ex){
        console.log('parse rtaudioroom-info-str failed! exception:'+ex,ex,room_id)
        return null;//res.json({ret:false,msg:'parse rtaudioroom-info-str failed!'})
    }
}
/**
 * 如从kmmDb中恢复，则直接设置棋盘值 game.setPenCodeList(roomInfo.now_pen_code)---于startGame中
 */
rtaudioroom_c.info = rtaudioroom_info 
async function rtaudioroom_info(req,res)
{
    let {user_id,room_id} = str_filter.get_req_data(req)
    let roomInfo = await rtaudioroom_info_recover(room_id)
    if(!roomInfo) return res.json({ret:false,msg:'rtaudioroom-info is empty'})
    let result = Object.assign({},roomInfo)
    delete result.game
    result.ret = true
    result.msg = 'success'
    res.json(result)
}
/**
 * 查询rooms
 */
rtaudioroom_c.rooms = rtaudioroom_rooms 
async function rtaudioroom_rooms(req,res){
    let {user_id} = str_filter.get_req_data(req)
    let reqs = []
    for(let i=0;rtaudioroomObj.last_room_list && i<rtaudioroomObj.last_room_list.length;i++)
    {
        reqs.push(rtaudioroom_info_recover(rtaudioroomObj.last_room_list[i]))
    }

    let rets = await Promise.all(reqs)
    if(rets) rets = rets.reverse()
    let result = {rooms:rets,ret:true,msg:'success'}
    res.json(result)
}
function push2rtaudioroom_list(room_id, save2db = true)
{
    //添加至last_room_list中
    if(rtaudioroomObj.last_room_list.indexOf(room_id)>=0)
    {
        if(rtaudioroomObj.last_room_list.length>100)//长度超过
            rtaudioroomObj.last_room_list = rtaudioroomObj.last_room_list.filter(function(item) {
                return item != room_id && item!=rtaudioroomObj.last_room_list[0]
            });
        else
            rtaudioroomObj.last_room_list = rtaudioroomObj.last_room_list.filter(function(item) {
                return item != room_id
            });
    }
    rtaudioroomObj.last_room_list.push(room_id)//放到末尾 
    if(save2db)
    saveRtAudioRooms2Db()
}
/**
 * 发送消息
 */
rtaudioroom_c.send = rtaudioroom_send
async function rtaudioroom_send(req,res)
{
    let {user_id,name,room_id,msg} = str_filter.get_req_data(req)
    let roomInfo = await rtaudioroom_info_recover(room_id)
    if(!roomInfo)return res.json({msg:'room-info is empty'})

    let msgid = sign_util.newTXID().replace('txid_','rtmsg_')
    let ret = await sendRTAudioRoomChannelMsg({room_id,msg,user_id,name,msgid},'msg')
    console.log('rtaudioroom_send-sendRTAudioRoomChannelMsg-ret:',ret)
    res.json(ret)

    push2rtaudioroom_list(room_id)
}
/**
 * 发送礼品
 */
rtaudioroom_c.sendGift = rtaudioroom_send_gift
async function rtaudioroom_send_gift(req,res)
{
    let {user_id,gift,user_name,room_id} = str_filter.get_req_data(req)
    let roomInfo = await rtaudioroom_info_recover(room_id)
    if(!roomInfo)return res.json({msg:'room-info is empty'})
    let recv_user_id = roomInfo.user_id

    let giftid = sign_util.newTXID().replace('txid_','rtgift_')
    //处理转账
    let sendRet = await rtaudioroomObj.rtgift.sendGift(gift,user_id,recv_user_id,JSON.stringify({room_id,user_name,giftid}))
    sendRet.user_id = user_id
    sendRet.recv_user_id = recv_user_id
    sendRet.gift = gift
    if(!sendRet.ret) return res.json(sendRet)
    res.json(sendRet)

    //发送gift的消息（以便在客户端显示出来）
    let ret = await sendRTAudioRoomChannelMsg({room_id,gift,price:sendRet.price,user_id,recv_user_id,name:user_name,giftid},'gift')
    console.log('rtaudioroom_sendGift-sendRTAudioRoomChannelMsg-ret:',ret)
    // res.json(sendRet)

    push2rtaudioroom_list(room_id)
}

async function recvRTAudioRoomClientUserChannelMsg(data)
{

}
async function creatRTAudioRoomChannel()
{
    let user_id = rtaudioroom_channel_system_user_id
    let channel = rtaudioroom_channel_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvRTAudioRoomClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTAudioRoomChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvRTAudioRoomClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTAudioRoomChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendRTAudioRoomChannelMsg(user_id,'allow_send_users')
    console.log('setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}
async function sendRTAudioRoomChannelMsg(xobj,notify_type = 'rtaudioroom')
{
    let user_id = rtaudioroom_channel_system_user_id
    let channel = rtaudioroom_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendRTAudioRoomChannelMsg-ret:',ret)
    return ret
}



