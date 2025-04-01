window.rtvideoroom_c = {}
// const rtvideoroom_c_token_name = OBJ_TOKEN_NAME
// const rtvideoroom_c_api_base   = OBJ_API_BASE
// const rtvideoroom_c_token_root = OBJ_TOKEN_ROOT

const rtvideoroomMatchMap = new Map()
const rtvideoroomObj = {matchList: [],last_room_list:[],rtgift:null}
const rtvideoroom_channel_system_user_id = 'rtvideoroom-system-default-user'
const rtvideoroom_channel_name = 'rtvideoroom-channel'
const rtvideoroom_gifts = ['flower','bicycle','motorcycle','car','roadster','jets']
const rtvideoroom_prices= [0.1,1,10,30,100,500]
// const rtvideoroom_channel_notify_matched = 'room_matched'
// const rtvideoroom_channel_notify_moved = 'room_moved'

rtvideoroom_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtvideoroom/match',urlParser,session_filter,rtvideoroom_c.match)
    app.all('/rtvideoroom/create',urlParser,session_filter,rtvideoroom_c.create)
    app.all('/rtvideoroom/info',urlParser,session_filter,rtvideoroom_c.info)
    app.all('/rtvideoroom/rooms',urlParser,session_filter,rtvideoroom_c.rooms)
    // app.all('/rtvideoroom/please',urlParser,session_filter,rtvideoroom_c.please)
    // app.all('/rtvideoroom/view',urlParser,session_filter,rtvideoroom_c.view)
    app.all('/rtvideoroom/send',urlParser,session_filter,rtvideoroom_c.send)
    app.all('/rtvideoroom/gift/send',urlParser,session_filter,rtvideoroom_c.sendGift)

    if(true)
    {
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initRTVideoRoomChannelFlag = await creatRTVideoRoomChannel()
        console.log('initRTVideoRoomChannelFlag:',initRTVideoRoomChannelFlag)

        let rooms = await rtvideorooms_recover()
        console.log('rtvideorooms_recover:rooms:',rooms)

        // autoSendCode()
        if(typeof g_node_side_event_bus!='undefined')
        {
            g_node_side_event_bus.on('*****',function(data){
                console.log('*****:',data)
            })
        }

        while(!window.MARK_TOKEN_NAME) await new Promise((res)=>setTimeout(res,1000))
        rtvideoroomObj.rtgift = new RTGift(rtvideoroom_gifts,rtvideoroom_prices)
    }
}
rtvideoroom_c.saveRtVideoRoomInfo2Db = saveRtVideoRoomInfo2Db
async function saveRtVideoRoomInfo2Db(roomInfo)
{
    let delRet = await kmmDb.del('rtvideoroom-info:'+roomInfo.room_id)
    let saveRet= await kmmDb.set('rtvideoroom-info:'+roomInfo.room_id,JSON.stringify(roomInfo))
    console.log('saveRtVideoRoomInfo2Db-rets:',delRet,saveRet)
    return saveRet
}
rtvideoroom_c.saveRtVideoRooms2Db = saveRtVideoRooms2Db
async function saveRtVideoRooms2Db()
{
    let delRet = await kmmDb.del('rtvideorooms')
    let saveRet= await kmmDb.set('rtvideorooms',JSON.stringify(rtvideoroomObj.last_room_list))
    console.log('saveRtVideoRooms2Db-rets:',delRet,saveRet)
    return saveRet
}
//room匹配系统
rtvideoroom_c.match = rtvideoroom_match
async function rtvideoroom_match(req,res)
{
    // let {user_id} = str_filter.get_req_data(req)
    if(rtvideoroomObj.last_room_list.length<=0) return res.json({ret:false,msg:'last-room is empty'})
    let room_id = rtvideoroomObj.last_room_list[rtvideoroomObj.last_room_list.length-1]
    let roomInfo= await rtvideoroom_info_recover(room_id)
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
rtvideoroom_c.create = rtvideoroom_create
async function rtvideoroom_create(req,res)
{
    let {user_id,room_name,user_name,allow_users,logo} = str_filter.get_req_data(req)
    
    let now_time_i = parseInt( Date.now()/1000 )
    if(!room_name || !(room_name.trim())) room_name = user_name+'创建的语聊房'
    let room_id = sign_util.newTXID().replace('txid_','rtvideoroom_')
    if(rtvideoroomMatchMap.has(room_id))  room_id = sign_util.newTXID().replace('txid_','rtvideoroom_')
    if(rtvideoroomMatchMap.has(room_id)) return res.json({ret:false,msg:"new room-id failed"})
    let roomInfo = {room_id,user_id,user_name,time_i:now_time_i,room_name,allow_users,logo}
    rtvideoroomMatchMap.set(room_id,roomInfo)
    saveRtVideoRoomInfo2Db(roomInfo)
    let result = Object.assign({},roomInfo)
    result.ret = true
    result.msg = 'success'
    res.json(result)
    push2rtvideoroom_list(room_id)
}
//得到roomInfo
async function rtvideoroom_info_recover(room_id)
{
    let roomInfo = rtvideoroomMatchMap.get(room_id)
    if(!rtvideoroomMatchMap.has(room_id)){
        let roomInfoStr =await kmmDb.get('rtvideoroom-info:'+room_id)
        if(!roomInfoStr) return null//res.json({ret:false,msg:'rtvideoroom-info is empty'})
        try{
            roomInfo = JSON.parse(roomInfoStr)
        }catch(ex){
            console.log('parse rtvideoroom-info-str failed! exception:'+ex,ex,room_id)
            return null;//res.json({ret:false,msg:'parse rtvideoroom-info-str failed!'})
        }
        rtvideoroomMatchMap.set(room_id,roomInfo) //恢复至内存
    }
    return roomInfo
}
/**
 * 从db中恢复过来
 * @returns 
 */
async function rtvideorooms_recover()
{
    let rooms = []
    let roomInfoStr =await kmmDb.get('rtvideorooms')
    if(!roomInfoStr) return []//res.json({ret:false,msg:'rtvideoroom-info is empty'})
    try{
        rooms = JSON.parse(roomInfoStr)
        for(let i=0;rooms && i<rooms.length;i++)
        {
            push2rtvideoroom_list(rooms[i], i == rooms.length-1 ) //最后一个，才保存至kmmDb中
        }
        return rooms
    }catch(ex){
        console.log('parse rtvideoroom-info-str failed! exception:'+ex,ex,room_id)
        return null;//res.json({ret:false,msg:'parse rtvideoroom-info-str failed!'})
    }
}
/**
 * 如从kmmDb中恢复，则直接设置棋盘值 game.setPenCodeList(roomInfo.now_pen_code)---于startGame中
 */
rtvideoroom_c.info = rtvideoroom_info 
async function rtvideoroom_info(req,res)
{
    let {user_id,room_id} = str_filter.get_req_data(req)
    let roomInfo = await rtvideoroom_info_recover(room_id)
    if(!roomInfo) return res.json({ret:false,msg:'rtvideoroom-info is empty'})
    let result = Object.assign({},roomInfo)
    delete result.game
    result.ret = true
    result.msg = 'success'
    res.json(result)
}
/**
 * 查询rooms
 */
rtvideoroom_c.rooms = rtvideoroom_rooms 
async function rtvideoroom_rooms(req,res){
    let {user_id} = str_filter.get_req_data(req)
    let reqs = []
    for(let i=0;rtvideoroomObj.last_room_list && i<rtvideoroomObj.last_room_list.length;i++)
    {
        reqs.push(rtvideoroom_info_recover(rtvideoroomObj.last_room_list[i]))
    }

    let rets = await Promise.all(reqs)
    if(rets) rets = rets.reverse()
    let result = {rooms:rets,ret:true,msg:'success'}
    res.json(result)
}
function push2rtvideoroom_list(room_id, save2db = true)
{
    //添加至last_room_list中
    if(rtvideoroomObj.last_room_list.indexOf(room_id)>=0)
    {
        if(rtvideoroomObj.last_room_list.length>100)//长度超过
            rtvideoroomObj.last_room_list = rtvideoroomObj.last_room_list.filter(function(item) {
                return item != room_id && item!=rtvideoroomObj.last_room_list[0]
            });
        else
            rtvideoroomObj.last_room_list = rtvideoroomObj.last_room_list.filter(function(item) {
                return item != room_id
            });
    }
    rtvideoroomObj.last_room_list.push(room_id)//放到末尾 
    if(save2db)
    saveRtVideoRooms2Db()
}
/**
 * 发送消息
 */
rtvideoroom_c.send = rtvideoroom_send
async function rtvideoroom_send(req,res)
{
    let {user_id,name,room_id,msg} = str_filter.get_req_data(req)
    let roomInfo = await rtvideoroom_info_recover(room_id)
    if(!roomInfo)return res.json({msg:'room-info is empty'})

    let msgid = sign_util.newTXID().replace('txid_','rtmsg_')
    let ret = await sendRTVideoRoomChannelMsg({room_id,msg,user_id,name,msgid},'msg')
    console.log('rtvideoroom_send-sendRTVideoRoomChannelMsg-ret:',ret)
    res.json(ret)

    push2rtvideoroom_list(room_id)
}
/**
 * 发送礼品
 */
rtvideoroom_c.sendGift = rtvideoroom_send_gift
async function rtvideoroom_send_gift(req,res)
{
    let {user_id,gift,user_name,room_id} = str_filter.get_req_data(req)
    let roomInfo = await rtvideoroom_info_recover(room_id)
    if(!roomInfo)return res.json({msg:'room-info is empty'})
    let recv_user_id = roomInfo.user_id

    let giftid = sign_util.newTXID().replace('txid_','rtgift_')
    //处理转账
    let sendRet = await rtvideoroomObj.rtgift.sendGift(gift,user_id,recv_user_id,JSON.stringify({room_id,user_name,giftid}))
    sendRet.user_id = user_id
    sendRet.recv_user_id = recv_user_id
    sendRet.gift = gift
    if(!sendRet.ret) return res.json(sendRet)
    res.json(sendRet)

    //发送gift的消息（以便在客户端显示出来）
    let ret = await sendRTVideoRoomChannelMsg({room_id,gift,price:sendRet.price,user_id,recv_user_id,name:user_name,giftid},'gift')
    console.log('rtvideoroom_sendGift-sendRTVideoRoomChannelMsg-ret:',ret)
    // res.json(sendRet)

    push2rtvideoroom_list(room_id)
}

async function recvRTVideoRoomClientUserChannelMsg(data)
{

}
async function creatRTVideoRoomChannel()
{
    let user_id = rtvideoroom_channel_system_user_id
    let channel = rtvideoroom_channel_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvRTVideoRoomClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTVideoRoomChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvRTVideoRoomClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTVideoRoomChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendRTVideoRoomChannelMsg(user_id,'allow_send_users')
    console.log('setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}
async function sendRTVideoRoomChannelMsg(xobj,notify_type = 'rtvideoroom')
{
    let user_id = rtvideoroom_channel_system_user_id
    let channel = rtvideoroom_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendRTVideoRoomChannelMsg-ret:',ret)
    return ret
}



