window.rtchess_c = {}
// const rtchess_c_token_name = OBJ_TOKEN_NAME
// const rtchess_c_api_base   = OBJ_API_BASE
// const rtchess_c_token_root = OBJ_TOKEN_ROOT
try{
if(typeof Buffer=='undefined')
{
    window.xrequire('./plugins/rt-chess/zh-chess.browser.min.js')
}else{
    window.xrequire('../rt-chess/zh-chess.browser.min.js')
}}catch(ex)
{
    console.log('xrequire-rt-chess-exception:ex:'+ex,ex)
    process.exit(1)
}

const rtchessMatchMap = new Map()
const rtchessObj = {matchList: [],last_chess_list:[],rtgift:null}
const rtchess_channel_system_user_id = 'rtchess-system-default-user'
const rtchess_channel_name = 'rtchess-channel'
const rtchess_channel_agent_name = 'agent-zhchess'
const rtchess_channel_notify_matched = 'chess_matched'
const rtchess_channel_notify_moved = 'chess_moved'
const rtchess_gifts = ['flower','bicycle','motorcycle','car','roadster','jets']
const rtchess_prices= [0.1,1,10,30,100,500]

rtchess_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtchess/match',urlParser,session_filter,rtchess_c.match)
    app.all('/rtchess/action',urlParser,session_filter,rtchess_c.action)
    app.all('/rtchess/info',urlParser,session_filter,rtchess_c.info)
    app.all('/rtchess/please',urlParser,session_filter,rtchess_c.please)
    app.all('/rtchess/view',urlParser,session_filter,rtchess_c.view)
    app.all('/rtchess/send',urlParser,session_filter,rtchess_c.send)
    app.all('/rtchess/gift/send',urlParser,session_filter,rtchess_c.sendGift)

    if(true)
    {
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        while(!window.ZhChess) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initRTChessChannelFlag = await creatRTChessChannel()
        console.log('initRTChessChannelFlag:',initRTChessChannelFlag)
        let initAgentChannelFlag = await creatRTChessAgentChannel()
        console.log('initAgentChannelFlag:',initAgentChannelFlag)
        // autoSendCode()
        if(typeof g_node_side_event_bus!='undefined')
        {
            g_node_side_event_bus.on('*****',function(data){
                console.log('*****:',data)
            })
        }

        while(!window.MARK_TOKEN_NAME) await new Promise((res)=>setTimeout(res,1000))
        rtchessObj.rtgift = new RTGift(rtchess_gifts,rtchess_prices)
    }
}
rtchess_c.saveChessInfo2Db = saveChessInfo2Db
async function saveChessInfo2Db(chessInfo)
{
    let delRet = await kmmDb.del('zhchess-info:'+chessInfo.chess_id)
    let saveRet= await kmmDb.set('zhchess-info:'+chessInfo.chess_id,JSON.stringify(chessInfo))
    console.log('saveChessInfo2Db-rets:',delRet,saveRet)
    return saveRet
}
//zh-chess匹配系统
rtchess_c.match = rtchess_match
async function rtchess_match(req,res)
{
    let {user_id} = str_filter.get_req_data(req)
    
    //unmatch  clear the success_cnt
    // if(!rtchessMatchMap.has(user_id))
    if(true) //无论如何，均更新这个peer
    {
        rtchessMatchMap.set(user_id,{user_id,peer:req.peer})
    }

    if(rtchessObj.matchList.indexOf(user_id)<0) rtchessObj.matchList.push(user_id)
    const removeUserIdFromMatchList = function(user_id)
    {
        const newList = []
        for(let i=0;i<rtchessObj.matchList.length;i++)
        {
            if(rtchessObj.matchList[i] !=user_id)
                newList.push(rtchessObj.matchList[i])
        }
        rtchessObj.matchList = newList
    }

    if(rtchessObj.matchList.length>1)
    {
        //创建对局信息
        let chess_id = sign_util.newTXID().replace('txid_','rtchess_')
        if(rtchessMatchMap.has(chess_id))  chess_id = sign_util.newTXID().replace('txid_','rtchess_')
        if(rtchessMatchMap.has(chess_id)) return res.json({ret:false,msg:"new chess-id failed"})
        
        let chess_user_id = rtchessObj.matchList[0]
        let chess_side = parseInt( Math.random()*10000) %2 == 0?'RED':'BLACK'
        let user_side  = chess_side == 'RED' ? 'BLACK':'RED'
        let start_side = parseInt( Math.random()*10000) %2 == 0?'RED':'BLACK'
        //硬编码，由用户先行棋（避免机器人先行棋）
        if([user_id,chess_user_id].indexOf('user_rb7fEHhdQwUXJExW')>=0)
        {
            // start_side = user_id == 'user_rb7fEHhdQwUXJExW' ? chess_side : user_side
        }
        let time_i = parseInt( Date.now()/1000 )
        let chessInfo = {chess_user_id,user_id,chess_id,chess_side,user_side,start_side,time_i}
        rtchessMatchMap.set(chess_id,chessInfo)
        // kmmDb.set('zhchess-info:'+chess_id,JSON.stringify(chessInfo))
        saveChessInfo2Db(chessInfo)

        removeUserIdFromMatchList(user_id)
        removeUserIdFromMatchList(chess_user_id)
        //发送匹配通知
        sendRTChessChannelMsg(chessInfo,rtchess_channel_notify_matched)
        startGame(chess_id)
        let result = Object.assign({},chessInfo)
        result.ret = true
        result.msg = 'success'
        result.matched=true
        delete result.game
        return res.json(result)
    }else{
        setTimeout(()=>{
            robot_match()
        },5*1000)
    }

    res.json({ret:true,msg:'success'})
}
async function robot_http_get(api_url) 
{
	const rp = require('request-promise');
    let res = null;
    await rp.post({ url: api_url, form: {}, timeout: 30000 })
        .then((body) => {
            res = body;
        }).catch((err) => {
            res = null;
        })
    return res;
}
//实现robot的匹配，以user-id=user_rb7fEHhdQwUXJExW为系统用户标识
//自动连接远程的ai代码，实现move指令解析
async function robot_match()
{
    let user_id = 'user_rb7fEHhdQwUXJExW'
    if( !(rtchessObj && rtchessObj.matchList && rtchessObj.matchList.length == 1)) return false
    let res = await new Promise((resolve)=>
    rtchess_match({params:{user_id},peer:{send:recvRTChessClientUserChannelMsg}},{json:function(data){
        resolve(data)
    }}))
    console.log('robot-match-res:',res)
    if(res && res.matched)
    {
        if(window.g_node_side_event_bus) g_node_side_event_bus.on('zhchess-action:'+res.chess_id,function(data){
            req_best_move_callback(res.chess_id,data)
        })
    }
}
async function req_best_move_callback(chess_id,result,user_id = 'user_rb7fEHhdQwUXJExW')
{
    if(result.user_id==user_id) return false
    //请求动作---进行下一步操作的请求
    let ret =window.g_rt_chess_robot_env_ok ? null: await robot_http_get('https://www.chessdb.cn/chessdb.php?action=queryall&learn=1&showall=0&board='+result.user_pen_code.replace(' ','%20'))
    console.log('robot-result:',ret)
    if(true || !ret || ret.indexOf('move:')<0)
    {
        ret = window.g_rt_chess_robot_env_ok ? await robot_best_move(result.user_pen_code) :  await robot_best_move2(result.user_pen_code)
    }
    else ret = (ret.split(',')[0]).split('move:')[1]
    ret = ret.trim()
    console.log('robot-next-step:',ret,ret?ret.length:0)
    if(ret && ret.length>4) ret = ret.slice(0,4)
    let chessInfo = rtchessMatchMap.get(chess_id)
    if(!chessInfo.game || chessInfo.game_over) return  false
    let posInfo  = ZhChess.parse_PEN_Point_Str(ret)
    console.log('robot-posInfo:',posInfo)
    await new Promise((resolve)=>setTimeout(resolve,100))//等待3s后再反应
    let actionRet = await new Promise((resolve)=>{
        rtchess_action({params:{chess_id,user_id,x0:posInfo.point.x,y0:posInfo.point.y,x1:posInfo.move.x,y1:posInfo.move.y},peer:{send:recvRTChessClientUserChannelMsg}},{json:function(data){
            resolve(data)
        }})
    })
    console.log('robot-action-ret:',actionRet)
    if(!actionRet ||!actionRet.ret) return false
    console.log('robot-action-success-ret:',actionRet)
}
// 输出当前目录（不一定是代码所在的目录）下的文件和文件夹
async function robot_best_move(fen_str)
{
    const { exec } = require('child_process');
    let time = Date.now()
    let result = await new Promise((resolve)=>{
        //'type '+filename+"|
        let childP = exec(__dirname+"\\pikafish-modern.exe", (err, stdout, stderr) => {
            if(err) {
                console.log(err);
                return;
            }
            if(!stdout) return resolve(null)
            // console.log(`stdout: ${stdout}`,stdout);
            // console.log(`stderr: ${stderr}`);
            let ret = stdout.split('ponder')[0].split('bestmove')[1].trim()
            console.log('ret:',ret,Date.now()-time)
            resolve(ret)
        })
        // console.log('childP:',childP)
        childP.stdin.write('position fen '+fen_str+'\n')
        childP.stdin.write('go depth 20\n')
        setTimeout(()=>childP.stdin.write('quit\n'),2000)
        // childP.stdin.write('go ponder\n')
        // setTimeout(()=>childP.stdin.write('stop\n'),1300)
        setTimeout(()=>resolve(null),10000)
    })
    return result
}
//请求agent得到结果
async function robot_best_move2(fen_str)
{
    let user_id = rtchess_channel_system_user_id
    let channel = rtchess_channel_agent_name
    let params = {user_pen_code:fen_str,reqid:'reqid-best-move-'+Date.now()+'-'+Math.random()}
    let ret = await new Promise((res)=>
    {
        // setTimeout(()=>
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(params),notify_type:"req"}},{json:function(data){
            res(data)
        }})
        // ,100)
    })
    console.log('send-agent-ret:',ret)
    let result = await new Promise((resolve)=>{
        if(window.g_node_side_event_bus) 
        g_node_side_event_bus.on(params.reqid,function(data){
            console.log('best-move-result-data:',data)
            resolve(data.xobj.best_move)
        })
        setTimeout(()=>resolve(null),15000)
    })
    return result
}
/**
 * action操作棋的动作
 */
rtchess_c.action = rtchess_action 
async function rtchess_action(req,res)
{
    let {user_id,chess_id,x0,y0,x1,y1} = str_filter.get_req_data(req)
    x0 = parseInt(x0)
    y0 = parseInt(y0)
    x1 = parseInt(x1)
    y1 = parseInt(y1)
    let chessInfo = await rtchess_info_recover(chess_id)
    if(!chessInfo) return res.json({ret:false,msg:'chess-info is empty'})
    if(!chessInfo.game) return res.json({ret:false,msg:'chess-info-game is empty'})
    if(chessInfo.game_over) return res.json({ret:false,msg:'chess-info-game is over'})
    let now_user_pen_code = chessInfo.game.getCurrentPenCode(chessInfo.game.getCurrentSideVal())
    // let chessInfo = rtchessMatchMap.get(chess_id)
    if(user_id!= chessInfo.user_id && user_id!=chessInfo.chess_user_id) return res.json({ret:false,msg:'no pm to op',now_pen_code:now_user_pen_code,side:chessInfo.game.getCurrentSideVal()})
    let user_side = user_id == chessInfo.user_id ? chessInfo.user_side : chessInfo.chess_side
    let chess_side= user_side == 'RED' ? 'BLACK' : 'RED'
    const game = chessInfo.game
    if(!game) return res.json({ret:false,msg:'game is empty'})
    if(chessInfo.game_over) return res.json({ret:false,msg:'game is over'})
    let now_time_i = parseInt( Date.now()/1000 )
    if(now_time_i - chessInfo.time_i > 60 *60 ) //超时60分钟，即为结局
        return res.json({ret:false,msg:'game over by timeout'})
    // if(chessInfo.need_do_side != user_side) return res.json({ret:false,msg:'not your side to op'})
    let chess_pen_code = game.now_pen_code;// game.getCurrentPenCode(chess_side)
    let moveRes = game.update({x:x0,y:y0}, {x:x1,y:y1}, user_side, true)
    if(!moveRes || !moveRes.flag) return  res.json({ret:false,msg:'move failed',move_res:moveRes,n0:{x:x0,y:y0}, n1:{x:x1,y:y1}, user_side})
    let user_pen_code = game.getCurrentPenCode(chess_side)
    // if( user_pen_code == chess_pen_code) //未走棋成功
    // {
    //     console.log('safe-pen-code:',user_pen_code,chess_pen_code)
    //     return res.json({ret:false,msg:'move-result pen-code is same',user_pen_code,chess_pen_code})
    // }
    console.log('chess_pen_code:'+chess_pen_code+',user_pen_code:'+user_pen_code)
    res.json({ret:true,msg:'success',chess_pen_code,user_pen_code})
    // chessInfo.need_do_side =  chess_side
    chessInfo.now_pen_code = user_pen_code
    //计算步数、保存执行的步信息（以便旁观，或者回放、直播用）
    if(!chessInfo.step_cnt) chessInfo.step_cnt = 1
    else chessInfo.step_cnt++
    if(!chessInfo.steps) chessInfo.steps =[]
    let stepInfo = {user_id,x0,y0,x1,y1,user_side,user_pen_code}
    chessInfo.steps.push(stepInfo)
    
    saveChessInfo2Db(chessInfo)
    //通知围观的，或者是运棋方
    let result = {user_id,chess_id,x0,y0,x1,y1,user_side,chess_side,user_pen_code,chess_pen_code}
    sendRTChessChannelMsg(result,rtchess_channel_notify_moved)
    if(chessInfo.user_id == 'user_rb7fEHhdQwUXJExW' || chessInfo.chess_user_id == 'user_rb7fEHhdQwUXJExW')
    {
        if(window.g_node_side_event_bus){
            g_node_side_event_bus.emit('zhchess-action:'+chess_id,result)
        }
    }
    //添加至last_chess_list中
    if(rtchessObj.last_chess_list.indexOf(chess_id)>=0)
    {
        if(rtchessObj.last_chess_list.length>100)//长度超过
            rtchessObj.last_chess_list = rtchessObj.last_chess_list.filter(function(item) {
                return item != chess_id && item!=rtchessObj.last_chess_list[0]
            });
        else
            rtchessObj.last_chess_list = rtchessObj.last_chess_list.filter(function(item) {
                return item != chess_id
            });
    }
    rtchessObj.last_chess_list.push(chess_id)//放到末尾 
}
//得到chessInfo
async function rtchess_info_recover(chess_id)
{
    let chessInfo = rtchessMatchMap.get(chess_id)
    if(!rtchessMatchMap.has(chess_id)){
        let chessInfoStr =await kmmDb.get('zhchess-info:'+chess_id)
        if(!chessInfoStr) return null//res.json({ret:false,msg:'chess-info is empty'})
        try{
            chessInfo = JSON.parse(chessInfoStr)
        }catch(ex){
            console.log('parse chess-info-str failed! exception:'+ex,ex,chess_id)
            return null;//res.json({ret:false,msg:'parse chess-info-str failed!'})
        }
        rtchessMatchMap.set(chess_id,chessInfo) //恢复至内存
        startGame(chess_id)
        //如果是机器人，则匹配之（恢复事件订阅）
        if([chessInfo.user_id,chessInfo.chess_user_id].indexOf('user_rb7fEHhdQwUXJExW')>=0)
        if(window.g_node_side_event_bus) g_node_side_event_bus.on('zhchess-action:'+chess_id,function(data){
            req_best_move_callback(chess_id,data)
        })
    }
    return chessInfo
}
/**
 * 如从kmmDb中恢复，则直接设置棋盘值 game.setPenCodeList(chessInfo.now_pen_code)---于startGame中
 */
rtchess_c.info = rtchess_info 
async function rtchess_info(req,res)
{
    let {user_id,chess_id} = str_filter.get_req_data(req)
    let chessInfo = await rtchess_info_recover(chess_id)
    if(!chessInfo) return res.json({ret:false,msg:'chess-info is empty'})
    let result = Object.assign({},chessInfo)
    delete result.game
    result.ret = true
    result.msg = 'success'
    res.json(result)
}
/**
 * 催促
 */
rtchess_c.please = rtchess_please
async function rtchess_please(req,res)
{
    let {user_id,chess_id} = str_filter.get_req_data(req)
    let chessInfo = await rtchess_info_recover(chess_id)
    if(!chessInfo || !chessInfo.game)return res.json({msg:'game is empty'})
    if(chessInfo.game_over)return res.json({msg:'game is over'})
    const users = [chessInfo.user_id,chessInfo.chess_user_id]
    const sides = [chessInfo.user_side,chessInfo.chess_side]
    const now_side=chessInfo.game.getCurrentSideVal()
    const pos = users.indexOf(user_id)
    if(pos<0) return res.json({msg:'no pm to please'})
    const user_side=sides[pos]
    let result = Object.assign({},chessInfo)
    delete result.game
    result.ret = true
    result.msg = 'success'
    if(user_side == now_side) return res.json(result)
    //对方出棋
    if(users.indexOf('user_rb7fEHhdQwUXJExW')>=0)
    {
        //触发best_move2
        g_node_side_event_bus.emit('zhchess-action:'+chess_id,{user_id,user_pen_code:chessInfo.game.getCurrentPenCode(now_side)})
    }else
    {
        //通知对方进度
    }
    result.emit_flag = true 
    res.json(result)
}
/**
 * 围观棋局
 */
rtchess_c.view = rtchess_view
async function rtchess_view(req,res)
{
    if(rtchessObj.last_chess_list.length<=0) return res.json({ret:false,msg:'last-chess is empty'})
    let chess_id = rtchessObj.last_chess_list[rtchessObj.last_chess_list.length-1]
    let chessInfo= await rtchess_info_recover(chess_id)
    if(!chessInfo) return res.json({ret:false,msg:'last-chess-info is empty'})
    let result = Object.assign({},chessInfo)
    result.ret = true
    result.msg = 'success'
    result.view_flag=true
    res.json(result)
}
/**
 * 发送消息
 */
rtchess_c.send = rtchess_send
async function rtchess_send(req,res)
{
    let {user_id,name,chess_id,msg} = str_filter.get_req_data(req)
    let chessInfo = await rtchess_info_recover(chess_id)
    if(!chessInfo || !chessInfo.game)return res.json({msg:'game is empty'})
    if(chessInfo.game_over)return res.json({msg:'game is over'})

    let msgid = sign_util.newTXID().replace('txid_','rtmsg_')
    let ret = await sendRTChessChannelMsg({chess_id,msg,user_id,name,msgid},'msg')
    console.log('rtchess_send-sendRTChessChannelMsg-ret:',ret)
    res.json(ret)
}

/**
 * 发送礼品
 */
rtchess_c.sendGift = rtchess_send_gift
async function rtchess_send_gift(req,res)
{
    let {user_id,gift,user_name,chess_id} = str_filter.get_req_data(req)
    let chessInfo = await rtchess_info_recover(chess_id)
    if(!chessInfo || !chessInfo.game)return res.json({msg:'game is empty'})
    if(chessInfo.game_over)return res.json({msg:'game is over'})
    let recv_user_id = chessInfo.chess_user_id //不是user_id

    let giftid = sign_util.newTXID().replace('txid_','rtgift_')
    //处理转账
    let sendRet = await rtchessObj.rtgift.sendGift(gift,user_id,recv_user_id,JSON.stringify({chess_id,user_name,giftid}))
    sendRet.user_id = user_id
    sendRet.recv_user_id = recv_user_id
    sendRet.gift = gift
    if(!sendRet.ret) return res.json(sendRet)
    res.json(sendRet)

    //发送gift的消息（以便在客户端显示出来）
    let ret = await sendRTChessChannelMsg({chess_id,gift,price:sendRet.price,user_id,recv_user_id,name:user_name,giftid},'gift')
    console.log('rtchess_sendGift-sendRTChessChannelMsg-ret:',ret)
    // res.json(sendRet)
}

async function startGame(chess_id)
{
    if(!rtchessMatchMap.has(chess_id)) return false
    let chessInfo = rtchessMatchMap.get(chess_id)
    const game = new ZhChess.default({ gameWidth: 375, gameHeight: 375 })
    game.gameStart(chessInfo.start_side)
    game.changeCurrentPlaySide(chessInfo.start_side)
    chessInfo.game  = game
    // chessInfo.need_do_side =  chessInfo.start_side
    if(chessInfo.now_pen_code)
    {
        game.setPenCodeList(chessInfo.now_pen_code)
    }
    else{
        chessInfo.now_pen_code = game.getCurrentPenCode(chessInfo.start_side)
    } 

    game.on("over",function(e,x){
        console.log('rtchess-game-over-e,x:',e,x)
        chessInfo.game_over = true
        chessInfo.victory_side = e
    })

    game.on('moveFail',function(e,x){
        console.log('rtchess-moveFail-e,x:',e,x)
    })
    game.on("move", function(e,x){
        console.log('rtchess-move-success-e,x:',e,x)
        console.log('rtchess-move-success-pencode:',game.getCurrentPenCode())
    })

    game.on("log",function(e,x){
        console.log('rtchess-log-e,x:',e,x)
    })
}

async function recvRTChessClientUserChannelMsg(data)
{

}
async function recvRTChessAgentChannelMsg(data)
{
    if(!data.notify_type)
    data = JSON.parse(data)
    console.log('recvRTChessAgentChannelMsg-data:',data)
    //recvRTChessAgentChannelMsg-data: {"notify_type":"ret","channel":"agent-zhchess","user_id":"user_8wSeyn7qNQsQEszf","xobj":{"best_move":"b2e2","reqid":"reqid-best-move-1706237816358-0.14575251067309858","user_pen_code":"rnbakabnr/9/1c5c1/p1p3p1p/4p4/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w"}}
    if(data.notify_type!='ret') return false
    console.log('recvRTChessAgentChannelMsg-emit-msg:',data)
    if(window.g_node_side_event_bus)
    window.g_node_side_event_bus.emit(data.xobj.reqid,data)
}

async function creatRTChessChannel()
{
    let user_id = rtchess_channel_system_user_id
    let channel = rtchess_channel_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvRTChessClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTChessChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvRTChessClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTChessChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendRTChessChannelMsg(user_id,'allow_send_users')
    console.log('setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}

async function creatRTChessAgentChannel(agent_user_id = 'user_7fEHhdQwUXJExWPY')
{
    let user_id = rtchess_channel_system_user_id
    let channel = rtchess_channel_agent_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvRTChessAgentChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTChessAgentChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvRTChessAgentChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTChessAgentChannel-focus:',ret)
    if(!ret || !ret.ret) return false

    let setAllowSendUsersRet = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(user_id+','+agent_user_id),notify_type:"allow_send_users"}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTChessAgentChannel-setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}

async function sendRTChessChannelMsg(xobj,notify_type = 'rtchess')
{
    let user_id = rtchess_channel_system_user_id
    let channel = rtchess_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendRTChessChannelMsg-ret:',ret)
    return ret
}



