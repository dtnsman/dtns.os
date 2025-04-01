/**
 * system-cmd的插件代码
 */
window.fintechsdk_c = {}
// const fintechsdk_c_token_name = OBJ_TOKEN_NAME
// const fintechsdk_c_api_base   = OBJ_API_BASE
// const fintechsdk_c_token_root = OBJ_TOKEN_ROOT

const  HttpApi = require('./http-api')
// const http2 = require('http2-wrapper');
if(!globalThis.window) globalThis.window = globalThis
let fintechsdk_setting = require( config.runtime_current_dir+ '/setting/fintechsdk.json')
// for(key in fintechsdk_setting) window[key] = fintechsdk_setting[key]
const BASE_URL= fintechsdk_setting.fintechsdk_BASE_URL
const API_KEY = fintechsdk_setting.fintechsdk_API_KEY
const API_SECRET= fintechsdk_setting.fintechsdk_API_KEY
const API_PASS= fintechsdk_setting.API_PASS
const opt = BASE_URL ? { baseURL: BASE_URL } : {};

const httpApi = new HttpApi(API_KEY, API_SECRET, API_PASS, { ...opt})
window.g_fintechsdk_httpapi = httpApi

fintechsdk_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/fintechsdk/addr',urlParser,fintechsdk_c.queryAddr)//查询地址
    app.all('/fintechsdk/pay/ok',urlParser,session_filter,fintechsdk_c.payOk)//如已到账自动充值---已经重点判断是否在notice-list中（如在则提示in_notice_list）---主要的接口--可供轮询用
    app.all('/fintechsdk/txid/details',urlParser,session_filter,fintechsdk_c.txidDetails)//查询是否支付成功和订单状态
    app.all('/fintechsdk/txid/detail',urlParser,session_filter,fintechsdk_c.txidDetail)//查询是否支付成功和订单状态
    app.all('/fintechsdk/txid/clear',urlParser,console_filter,fintechsdk_c.clearTxid)//管理员清理旧已支付状态的kmmDb信息
    app.all('/fintechsdk/txid/notice',urlParser,session_filter,fintechsdk_c.txidNotice)//一般情况下使用该接口（可结合txid/detail轮询判断）
}
fintechsdk_c.queryAddr = queryAddr
async function queryAddr(req,res)
{
    let {ccy} = str_filter.get_req_data(req)
    let addr =await httpApi.getAddr(ccy)
    if(addr && addr.length>0)
        res.json({ret:true,msg:'success',addr,ccy})
    else
        res.json({ret:false,msg:'addr-list is empty',addr,ccy})
}
fintechsdk_c.clearTxid = clearTxid
async function clearTxid(req,res)
{
    let {txid} = str_filter.get_req_data(req)
    let delRet = await kmmDb.del('txid:'+txid)
    let ret = await kmmDb.get('txid:'+txid)
    if(ret) return res.json({ret:false,msg:'del txid failed',txid})
    return res.json({ret:true,msg:'success'})
}
/**
 * 查询txid的状态
 */
fintechsdk_c.txidDetail = txidDetail
async function txidDetail(req,res)
{
    let {txid} = str_filter.get_req_data(req)

    let chargeHistory = await httpApi.getChargeHistory(100)
    if(!chargeHistory || chargeHistory.length<=0) return res.json({ret:false,msg:'can not find your txid!',txid})

    let chargeInfo = null
    for(let i =0;i<chargeHistory.length;i++)
    {
        if(chargeHistory[i].txId == txid)
        {
            chargeInfo = chargeHistory[i]
        }
    }
    if(!chargeInfo) return res.json({ret:false,msg:'can not find your txid!',txid})
    console.log('payOk-chargeInfo:',chargeInfo)

    let txidExist = await kmmDb.get('txid:'+txid)
    res.json({ret:true,msg:'success',tx_info:chargeInfo,txid,payed:txidExist!=null})
}
/**
 * 查询一批txids的状态
 */
fintechsdk_c.txidDetails = txidDetails
async function txidDetails(req,res)
{
    let {txids} = str_filter.get_req_data(req)

    let chargeHistory = await httpApi.getChargeHistory(100)
    if(!chargeHistory || chargeHistory.length<=0) return res.json({ret:false,msg:'can not find your txid!',txid})

    let chargeTXIDS = []
    for(let i =0;i<chargeHistory.length;i++)
    {
        chargeTXIDS.push(chargeHistory[i].txId)
    }
    let txidList = txids.split(':')
    let results = []
    let flag = false
    for(let i=0;i<txidList.length;i++)
    {
        let txid = txidList[i]
        let pos = chargeTXIDS.indexOf(txidList[i])
        if(pos>=0)
        {
            let txidExist = await kmmDb.get('txid:'+txid)
            results.push({ret:true,msg:'success',tx_info:chargeHistory[pos],txid,payed:txidExist!=null})
            flag = true
        }else{
            results.push({ret:false,msg:'can not find your txid!',txid})
        }
    }
    if(!flag) return res.json({ret:false,msg:'txids unexist in the charge-list'})
    res.json({ret:true,msg:'success',results})
}
/**
 * 设置监听的txid
 */
fintechsdk_c.txidNotice = txidNotice
async function txidNotice(req,res)
{
    let {txid,user_id} = str_filter.get_req_data(req)
    let noticeSetRet = await kmmDb.get('txid-notice:'+txid)
    if(!noticeSetRet)
    {
        let ret = await kmmDb.set('txid-notice:'+txid,user_id,60*60*24*30)//谁订阅的，如果
        if(ret) return res.json({ret:true,msg:'success',txid})
        else return res.json({ret:false,msg:'set notice-txid failed',txid})
    }

    res.json({ret:false,msg:'notice-txid-user_id is existed!',equal_flag:noticeSetRet==user_id})
}
/**
 * 根据txid判断是否支持成功，如是支持成功并给目标用户充值
 */
fintechsdk_c.payOk = payOk
async function payOk(req,res)
{
    let {txid,user_id} = str_filter.get_req_data(req)
    let txidExist = await kmmDb.get('txid:'+txid)
    console.log('txidExist:'+txid,txidExist)
    if(txidExist)
    {
        return res.json({ret:true,msg:'success',txid,payed:true})
    }

    let noticeSetRet = await kmmDb.get('txid-notice:'+txid)
    if(noticeSetRet)
    {
        return res.json({ret:false,msg:'txid is in txid-notice-list',txid})
    }

    let userInfo =  await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!userInfo) return res.json({ret:false,msg:'user-info is empty'})

    let chargeHistory = await httpApi.getChargeHistory(100)
    if(!chargeHistory || chargeHistory.length<=0) return res.json({ret:false,msg:'can not find your txid!',txid})

    let chargeInfo = null
    for(let i =0;i<chargeHistory.length;i++)
    {
        if(chargeHistory[i].txId == txid)
        {
            chargeInfo = chargeHistory[i]
        }
    }
    if(!chargeInfo) return res.json({ret:false,msg:'can not find your txid!',txid})
    console.log('payOk-chargeInfo:',chargeInfo)
    // if(txid=='0x83a0f170dc0a385119db9272ca833d67ee923767b3e17639e13b0052d93b0b46'){
    //     chargeInfo.state = '1'
    // }
    if(chargeInfo.state!='2')
    {
        //可添加至付款成功后通知结算队列
        let noticeSetRet = await kmmDb.get('txid-notice:'+txid)
        if(!noticeSetRet)
        {
            let setNoticeListRet = await kmmDb.set('txid-notice:'+txid,user_id,60*60*24*30)//谁订阅的，如果
        }

        noticeSetRet = await kmmDb.get('txid-notice:'+txid)

        return res.json({ret:false,msg:'pay-txid is processing',state:chargeInfo.state,detail:chargeInfo,in_notice_list:noticeSetRet!=null})
    }
    
    sendMoney(res,user_id,chargeInfo)
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

async function autoNotice()
{
    console.log('into autoNotice')
    let chargeHistory = await httpApi.getChargeHistory(10000)
    if(!chargeHistory || chargeHistory.length<=0) return false

    for(let i =0;i<chargeHistory.length;i++)
    {
        let chargeInfo = chargeHistory[i]
        let txid = chargeHistory[i].txId
        // if(txid=='0x83a0f170dc0a385119db9272ca833d67ee923767b3e17639e13b0052d93b0b46'){
        //     chargeInfo.state = '1'
        // }
        if(chargeInfo.state!='2') continue

        let txidExist = await kmmDb.get('txid:'+txid)
        console.log('autoNotice-txidExist:'+txid,txidExist)
        if(txidExist) continue
        let noticeSetRet = await kmmDb.get('txid-notice:'+txid)
        if(noticeSetRet)
        {
            let user_id = noticeSetRet
            sendMoney({params:{user_id,txid}},{json:function(data){
                console.log('autoNotice-sendMoney-ret:',data)
            }},chargeHistory[i])
        }
    }
}

setInterval(()=>autoNotice(),10000)
