window.rtstandard_c = {}
// const rtstandard_c_token_name = OBJ_TOKEN_NAME
// const rtstandard_c_api_base   = OBJ_API_BASE
// const rtstandard_c_token_root = OBJ_TOKEN_ROOT
//【资格】以mark数量来控制资格
//【在线】以实时在线为条件，控制委托下单等
//订单状态，回传
rtstandard_c.routers =function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtstandard/create',urlParser,console_filter,rtstandard_c.create)//mark-stdx100z01 stdx200 price
    app.all('/rtstandard/list',urlParser,session_filter,rtstandard_c.list) 
    app.all('/rtstandard/buy',urlParser,session_filter,rtstandard_c.buy) //订阅
    app.all('/rtstandard/sell',urlParser,session_filter,rtstandard_c.sell)//发送xmsg---以xtype为核心（只要有focus权限，就有发送权限）

    window.g_stdmark_list = []
    window.g_stdmark_settings = new Map()

    let init = async function()
    { 
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        while(!window.g_rtmarket_inited) await new Promise((res)=>setTimeout(res,200))
        setTimeout(()=>rtstandard_list({params:{}},{json:function(data){}}),5000)
        setTimeout(()=>recoverStdOrderList(),5000)
        setTimeout(()=>autoTradeStd(),6000)
    }
    init()
}
/**
 * 带有std-price的mark，以name为核心
 */
rtstandard_c.create = rtstandard_create
async function rtstandard_create(req,res)
{
    let {mark,name,logo,desc,std_price,number,number_type,tax_type,tax,user_id} = str_filter.get_req_data(req)
    if(!isFinite(std_price) || std_price<=0)  res.json({ret:false,msg:'param std_price is error'})
    let tmpreq = {params:{mark,name,logo,desc,tax_type,tax,std_price,number,number_type,user_id}} 
    let ret = await new Promise((res)=>{
        rtmarket_c.createMark(tmpreq,{json:function(data){
            res(data)
        }})
    })
    if(!ret || !ret.ret) return res.json({ret:false,msg:ret ? ret.msg:'unkown network reason!'})
    res.json({ret:true,msg:'success'})//,remove_mark_list:del_flag})
    //更新列表
    setTimeout(async ()=>{
        await rtstandard_list({params:{}},{json:function(data){}})
        console.log('g_stdmark_list:',g_stdmark_list)
    },1000)
    rtmarket_c.get_mark_list(1000)
}
/**
 * stdmark-列表
 */
rtstandard_c.list = rtstandard_list
async function rtstandard_list(req,res)
{
    // let {begin,len} = str_filter.get_req_data(req)
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,'relt',0,100000,false)
    if(!list ||list.length<=0) return res.json({ret:false,msg:'std-mark-list is empty'})
    window.g_stdmark_list = list
    window.g_stdmark_settings = new Map()
    for(let i=0;i<list.length;i++)
    {
        g_stdmark_settings.set(list[i].mark,list[i])
        //fix the tax-bug 
        if(typeof g_mark_settings=='undefined') window.g_mark_settings = new Map()
        if(typeof g_mark_settings !='undefined') g_mark_settings.set(list[i].mark,list[i])
    }
    res.json({ret:true,msg:'success',list})
}
/**
 * 购买（须购买标准数量）
 */
rtstandard_c.buy = rtstandard_buy
async function rtstandard_buy(req,res)
{
    let {mark,number,user_id} = str_filter.get_req_data(req)
    //price = std_price   ,number=1
    let markInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,rtmarket_c.get_mark_default_root_token(mark),'assert')
    if(!markInfo) return res.json({ret:false,msg:'mark-info is empty'})
    if(typeof g_mark_settings=='undefined') window.g_mark_settings = new Map()
    g_mark_settings.set(mark,markInfo)
    req.markInfo = markInfo

    let ret = await new Promise((res)=>{
        rtmarket_c.buyMark({params:{mark,user_id,number,price:markInfo.std_price}},{json:function(data){
            res(data)
        }})
    })
    if(ret && ret.order_id) 
    {
        ret.channel_ret = await createAndFocusChannel(ret.order_id)
        let focusRet = await new Promise((res)=>
        {
            rtchannel_c.focus({params:{channel:'rtstandard-channel:'+ret.order_id,user_id},peer:req.peer},{json:function(data){
                res(data)
            }})
        })
        ret.channel_focus_ret = focusRet && focusRet.ret
    }
    res.json(ret)
}
/**
 * 销售（须拥有mark对应的数量）
 */
rtstandard_c.sell = rtstandard_sell
async function rtstandard_sell(req,res)
{
    let {mark,number,user_id} = str_filter.get_req_data(req)
    //price = std_price   ,number=1
    let markInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,rtmarket_c.get_mark_default_root_token(mark),'assert')
    if(!markInfo) return res.json({ret:false,msg:'mark-info is empty'})
    if(typeof g_mark_settings=='undefined') window.g_mark_settings = new Map()
    g_mark_settings.set(mark,markInfo)
    req.markInfo = markInfo

    let ret = await new Promise((res)=>{
        rtmarket_c.sellMark({params:{mark,user_id,number,price:markInfo.std_price}},{json:function(data){
            res(data)
        }})
    })
    if(ret && ret.order_id) 
    {
        ret.channel_ret = await createAndFocusChannel(ret.order_id)
        let focusRet = await new Promise((res)=>
        {
            rtchannel_c.focus({params:{channel:'rtstandard-channel:'+ret.order_id,user_id},peer:req.peer},{json:function(data){
                res(data)
            }})
        })
        ret.channel_focus_ret = focusRet && focusRet.ret
    }
    
    res.json(ret)
}

window.g_rtmarket_buy_order_notify_callback = async function (buyOrderInfo)
{
    sendSTDMarkChannelOrderMsg(buyOrderInfo,'buy-order')
}

window.g_rtmarket_sell_order_notify_callback = async function (sellOrderInfo)
{
    sendSTDMarkChannelOrderMsg(sellOrderInfo,'sell-order')
}   

async function recvSTDClientUserChannelMsg(xobj)
{
    console.log('recvSTDClientUserChannelMsg:',xobj)
}
async function createAndFocusChannel(order_id)
{
    let user_id = 'rtstandard-system-default-user'
    let channel = 'rtstandard-channel:'+order_id
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id},peer:{send:recvSTDClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('createAndFocusChannel-ret:',ret)
    if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvSTDClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('createAndFocusChannel-focus:',ret)
    if(!ret || !ret.ret) return false

    let setAllowSendUsersRet = await sendSTDMarkChannelOrderMsg({order_id,user_id},'allow_send_users')
    console.log('rt-market-standard:setAllowSendUsersRet:',setAllowSendUsersRet)

    return true
}

async function sendSTDMarkChannelOrderMsg(xobj,notify_type = 'rtstandard-channel')
{
    let user_id = 'rtstandard-system-default-user'
    let channel = 'rtstandard-channel'
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel:channel+':'+xobj.order_id,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendSTDMarkChannelOrderMsg-ret:',ret)
    return ret
}

async function autoTradeStd()
{
    let pCnt = 30
    while(true)
    {
        let marks = typeof g_stdmark_list !='undefined' ? g_stdmark_list:[]
        let trades = []
        // console.log('autoTradeStd-marks:',marks)
        for(let i=0;i<marks.length;i++)
        {
            // console.log('autoTradeStd-mark:',marks[i].mark)
            trades.push(rtmarket_c.autoMarkTrade(marks[i].mark))
        }
        let tradeRets = await Promise.all(trades)
        // console.log('autoTradeStd-rets:',tradeRets)
        // console.log('tradeRets:',tradeRets)
        if(!trades || trades.length<=0 ) await new Promise((res)=>setTimeout(res,10)) //如无，则等待10秒
        let cnt = 0;
        for(let i=0;i<tradeRets.length;i++)
        {
            cnt+=tradeRets[i]>0 ? tradeRets[i] :0
        }
        if( (pCnt--) <=0)
        {
            console.log('rtstd--autoTrade:cnt:',cnt)
            pCnt = 30
        }
        if(cnt>0) await new Promise((res)=>setTimeout(res,1))
        else await new Promise((res)=>setTimeout(res,100))//2秒轮询一次（如无成功纪录）
    }
}

async function recoverStdOrderList()
{
    while(!window.g_loginDtnsAndForklist_started) await new Promise((res)=>setTimeout(res,1000))//30s后开始处理
    await new Promise((res)=>setTimeout(res,5000))//依旧等待20s之后运行
    let marks = typeof g_stdmark_list !='undefined' ? g_stdmark_list:[]
    if(!marks || marks.length<=0) return false
    let results = []
    for(let i=0;i<marks.length;i++)
    {
        let mark = marks[i].mark
        console.log('recoverStdOrderList:'+mark,'now!')
        let sellOrderRecoverRet = await rtmarket_c.loadMarkReadyListFromDNALink(mark,'sell')
        let buyOrderRecoverRet = await rtmarket_c.loadMarkReadyListFromDNALink(mark,'buy')
        console.log('recoverStdOrderList:'+mark,sellOrderRecoverRet,buyOrderRecoverRet)
        results.push({sellOrderRecoverRet,buyOrderRecoverRet,mark})
    }
    return results
}