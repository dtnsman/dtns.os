/**
 * system-cmd的插件代码
 */
window.fintechsdk_c = {}
// const fintechsdk_c_token_name = OBJ_TOKEN_NAME
// const fintechsdk_c_api_base   = OBJ_API_BASE
// const fintechsdk_c_token_root = OBJ_TOKEN_ROOT

var fintechsdk_user = require( config.runtime_current_dir+ '/setting/fintechsdk.json').fintechsdk_user
window.g_fintechsdk_user = fintechsdk_user
window.g_fintechsdk_user_session = null

const m_noticeListObj = {list:''};

async function loginFintechSdkUser()
{
    console.log('into loginFintechSdkUser:')
    console.log('ok2-g_dtnsManager:',g_dtnsManager)
    if(typeof g_fintechsdk_user=='undefined') return
    let fintechsdk_user =  g_fintechsdk_user

    while(!g_dtnsManager.web3apps) await new Promise((res)=>setTimeout(res,300))
    
    //特殊的连接方式
    let web3name = g_fintechsdk_user.web3name
    let fintechsdk_roomid = web3name
    let roomid = 'web3:'+ fintechsdk_roomid+'|'+ parseInt(Date.now()/1000)
    console.log('forklist_roomid:',roomid)
    let hash = await key_util.hashVal(roomid)
    let sign = await key_util.signMsg(hash,fintechsdk_user.private_key)
    let protocol_roomid = roomid+'|'+sign+'|'+fintechsdk_user.token
    let p_client = new RTCClient(protocol_roomid,null,null,false)
    p_client.origin_roomid = fintechsdk_roomid
    if(typeof g_dtnsManager!='undefined') addFlag= g_dtnsManager.addRPCClient(p_client)
    console.log('add-ld-client:',addFlag)

    const fintechsdkClient = await  g_dtnsManager.connect('dtns://web3:'+web3name)
    if(!fintechsdkClient) return console.log('loginFintechSdkUser-fintechsdkClient-connect-failed,web3name:'+web3name)
    console.log('fintechsdkClient.pingpong_flag:',fintechsdkClient.pingpong_flag)
    while(!fintechsdkClient.pingpong_flag){
        await new Promise((res)=>setTimeout(res,1000))
        console.log('fintechsdkClient.pingpong_flag:',fintechsdkClient.pingpong_flag)
    } 
    

    let timestamp = parseInt( Date.now()/1000)
    hash = await key_util.hashVal(web3name+':'+timestamp)
    sign = await key_util.signMsg(hash,fintechsdk_user.private_key) //使用的是dtns-device-id设备id的密钥

    let ret = await g_dtnsManager.run('dtns://web3:'+web3name+'/user/device/login',{timestamp,web3name,sign})
    console.log('loginFintechSdkUser-sessinon-ret:'+web3name+'-/user/device/login--ret:'+JSON.stringify(ret))

    if(!ret || !ret.ret) return 
    window.g_fintechsdk_user_session = ret
    console.log('g_fintechsdk_user_session:',g_fintechsdk_user_session)
    // ret = await g_dtnsManager.run('dtns://web3:'+web3name+'/forklist/pay/channel',{web3name:defaultRTCRoomID})
    // console.log(web3name+'-/forklist/pay/channel--ret:'+JSON.stringify(ret))
}
loginFintechSdkUser()

fintechsdk_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/fintechsdk/addr',urlParser,fintechsdk_c.queryAddr)//查询地址console_filter
    app.all('/fintechsdk/pay/ok',urlParser,session_filter,fintechsdk_c.payOk)//如已到账自动充值---已经重点判断是否在notice-list中（如在则提示in_notice_list）---主要的接口--可供轮询用
    app.all('/fintechsdk/txid/details',urlParser,session_filter,fintechsdk_c.txidDetails)
    app.all('/fintechsdk/txid/detail',urlParser,session_filter,fintechsdk_c.txidDetail)//查询是否支付成功和订单状态
    app.all('/fintechsdk/txid/clear',urlParser,console_filter,fintechsdk_c.clearTxid)//管理员清理旧已支付状态的kmmDb信息
    app.all('/fintechsdk/txid/notice',urlParser,session_filter,fintechsdk_c.txidNotice)//一般情况下使用该接口（可结合txid/detail轮询判断）
}
fintechsdk_c.queryAddr = queryAddr
async function queryAddr(req,res)
{
    // const fintechsdkClient = await  g_dtnsManager.connect('dtns://web3:qw')
    // console.log('fintechsdkClient:',fintechsdkClient)
    // if(!fintechsdkClient.pingpong_flag)
    // {
    //     loginFintechSdkUser()
    // }

    let {ccy} = str_filter.get_req_data(req)
    let ret = await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/addr',{ccy,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    if(!ret) res.json({ret:false,msg:'connect to fintecksdk-user-api failed'})
    res.json(ret)
}
fintechsdk_c.clearTxid = clearTxid
async function clearTxid(req,res)
{
    let {txid} = str_filter.get_req_data(req)
    let delRet = await kmmDb.del('txid:'+txid)
    let ret = await kmmDb.get('txid:'+txid)
    if(ret) return res.json({ret:false,msg:'del txid failed',txid})
    return res.json({ret:true,msg:'success'})
    // return res.json({ret:false,msg:'[client-mode]can not use this api'})
}
/**
 * 查询txid的状态
 */
fintechsdk_c.txidDetail = txidDetail
async function txidDetail(req,res)
{
    let {txid} = str_filter.get_req_data(req)

    let ret = await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/txid/detail',{txid,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    if(!ret) res.json({ret:false,msg:'connect to fintecksdk-user-api failed'})
    res.json(ret)
}
/**
 * 查询txids的状态
 */
fintechsdk_c.txidDetails = txidDetails
async function txidDetails(req,res)
{
    let {txids} = str_filter.get_req_data(req)

    let ret = await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/txid/details',{txids,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    if(!ret) res.json({ret:false,msg:'connect to fintecksdk-user-api failed'})
    res.json(ret)
}
/**
 * 设置监听的txid
 */
fintechsdk_c.txidNotice = txidNotice
async function txidNotice(req,res)
{
    let {txid,user_id} = str_filter.get_req_data(req)
    //判断是否已经被使用过（不能在多个web3name中重复使用）
    let payedRet = await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/txid/detail',{txid,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    if(payedRet && payedRet.payed) return res.json({ret:false,msg:'txid is payed'})

    //先行在根api-ib3.node进行订阅，才能在本节点订阅
    let ret = await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/txid/notice',{txid,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    if(!ret) res.json({ret:false,msg:'connect to fintecksdk-user-api failed'})

    let flag = await addNoticeList(txid,user_id)
    console.log('addNoticeList-flag:',flag,txid,user_id)
    if(!flag) return res.json({ret:false,msg:'add to m_noticeList failed'})

    res.json(ret)
}
/**
 * 根据txid判断是否支持成功，如是支持成功并给目标用户充值
 */
fintechsdk_c.payOk = payOk
async function payOk(req,res)
{
    let {txid} = str_filter.get_req_data(req)

    let ret = await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/pay/ok',{txid,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    if(!ret) res.json({ret:false,msg:'connect to fintecksdk-user-api failed'})
    res.json(ret)
}
/**
 * 发送
 * @param {*} req 
 * @param {*} res 
 * @param {*} chargeInfo 
 * @returns 
 */
async function sendMoney(req,res,chargeInfo)
{
    let {txid,user_id} = str_filter.get_req_data(req)
    let rmbUserId = RMB_TOKEN_NAME+'_'+user_id.split('_')[1]
    //payed---send--dtns-user-int-id
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(txid)
    let money = 0
    let usdP = 7.1 //U价格
    switch(chargeInfo.ccy)
    {
        case 'USDT':
            money = chargeInfo.amt *1
            break;
        case 'BTC':
            money = chargeInfo.amt *40000 
            break;
        case 'ETH':
            money = chargeInfo.amt *2300 
            break;
        case 'FIL':
            money = chargeInfo.amt *4 
            break;
        case 'XCH':
            money = chargeInfo.amt *30 
            break;
        case 'ICP':
            money = chargeInfo.amt *5
            break;
        default:
            money = 0
            break;
    }
    money = money*1// usdP //转换定价---以U计价
    
    if((''+money).indexOf('.')>=0)
    {
        let moneyStr = ''+money
        money = ''+parseFloat(moneyStr.split('.')[0]+'.'+moneyStr.split('.')[1].substring(0,3))
    }

    let txidExist = await kmmDb.get('txid:'+txid)
    console.log('sendMoney-txidExist:'+txid,txidExist)
    if(txidExist)
    {
        return res.json({ret:false,msg:'txid is payed',txid})
    }

    //设置标志位
    kmmDb.set('txid:'+txid,'payed')
    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:RMB_TOKEN_ROOT,token_y:rmbUserId,opval:money, extra_data:txid})
    if(!sendRet || !sendRet.ret){
        kmmDb.del('txid:'+txid)
        return res.json({ret: false, msg: "send account-int failed"})
    } 

    res.json({ret:true,msg:'success',state:chargeInfo.state,detail:chargeInfo,payed:true,txid})
}

async function addNoticeList(txid,user_id)
{
    let existRet = await kmmDb.get('txid:'+txid)
    console.log('addNoticeList-existRet:',existRet,txid,user_id)
    if(existRet) return false
    if(m_noticeListObj.list.indexOf(txid)>=0) return true
    m_noticeListObj.list = m_noticeListObj.list ? m_noticeListObj.list+':'+txid :txid
    let ret = await kmmDb.set('txid-notice:'+txid,user_id,60*60*24*30) //30天才超时
    if(ret){
        let setListRet = await kmmDb.set('txid-notice-list',m_noticeListObj.list)
        console.log('addNoticeList-setListRet:',setListRet)
    }
    return ret
}
/**
 * 自动通知
 */
async function autoNotice()
{  
    if(! m_noticeListObj.list ||  m_noticeListObj.list.length<=0)
    {
        let list = await kmmDb.get('txid-notice-list')
        if(!list) return console.log('autoNotice():txid-notice-list is empty')
        m_noticeListObj.list = list
    }
    //遍历，如果超时不存在了的，则清理掉
    let noticeList = m_noticeListObj.list.split(':')
    if(!noticeList || noticeList.length<=0) return console.log('autoNotice():txid-notice-list is empty')
    let tmpList = '' , resultsMap = new Map()
    for(let i=0;i<noticeList.length;i++)
    {
        let txid = noticeList[i]
        let user_id = await kmmDb.get('txid-notice:'+txid)//还未超时
        if(user_id)
        {
            tmpList =tmpList ?  tmpList+':'+txid :txid
            resultsMap.set(txid,user_id)
        }
    }
    let list = await kmmDb.get('txid-notice-list')
    if(list == m_noticeListObj.list && tmpList!=list)//仅notice-list相同且tmpList有超时txids时才更新---更原子性一些
    {
        let setListRet = await kmmDb.set('txid-notice-list',tmpList)
        console.log('autoNotice-update-setListRet:',setListRet)
    }
    if(!tmpList)
    {
        return console.log('autoNotice:notice-list is emoty!')
    }

    //查询结果
    let resultsRet = await await g_dtnsManager.run('dtns://web3:'+fintechsdk_user.web3name+'/fintechsdk/txid/details',{txids:tmpList,user_id:g_fintechsdk_user_session.user_id,s_id:g_fintechsdk_user_session.s_id})
    console.log('autoNotice-resultsRet:',resultsRet)
    if(!resultsRet || !resultsRet.ret) return false
    let results = resultsRet.results
    let sendRets = [] ,iCnt = 0
    for(let i=0;results && i<results.length;i++)
    {
        let tmpRet = results[i]
        let txid = tmpRet.txid
        if(tmpRet && tmpRet.ret && tmpRet.payed)
        {
            let sendRet = await new Promise((reslove)=>{
                sendMoney({params:{txid,user_id:resultsMap.get(txid)}},{json:function(data){
                    console.log('sendMoney-ret-data:',data)
                    reslove(data)
                }},tmpRet.tx_info)
            })
            console.log('sendRet:',sendRet,tmpRet)
            if(sendRet.ret)
            {
                kmmDb.del('txid-notice:'+tmpRet.txid)
                iCnt++
            }
            sendRet.txid =txid
            sendRets.push(sendRet)
        }else{
            sendRets.push({ret:false,msg:'txid is not payed',txid})
        }
    }
    console.log('sendRets:',sendRets,iCnt)
    return iCnt
}


setInterval(()=>autoNotice(),10000)
