
window.rtmarket_c = {}
// const rtmarket_c_token_name = OBJ_TOKEN_NAME
// const rtmarket_c_api_base   = OBJ_API_BASE
// const rtmarket_c_token_root = OBJ_TOKEN_ROOT
if(typeof Buffer=='undefined')
{
    xrequire('./plugins/rt-market/market-score.js')
    xrequire('./plugins/rt-market/market-all.js') //可封装一个函数xrequire
}else{
    // xrequire('./market-score.js')
    let mark_setting = require(window.config.runtime_current_dir + '/setting/mark.json')
    for(key in mark_setting) window[key] = mark_setting[key]
    xrequire('./market-all.js') //可封装一个函数xrequire
}
window.xrequire = xrequire
function xrequire(path)//兼容browser
{
    if(typeof Buffer !='undefined') return require(path)
    else console.log('xrequire-'+path+' not load, brower is not supported now!')

    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.onload = function(){
        console.log('xrequire-loaded-path:',path)//pluginsObj,typeof window[pluginsObj.index])
        // if(pluginsObj.index && window[pluginsObj.index] && typeof window[pluginsObj.index].routers=='function')
        // {
        //     window[pluginsObj.index].routers(app)
        // }
        if(path.indexOf('market-all.js')>0)
        {
            initConfig()
        }
    }
    script.src = path
    document.body.appendChild(script);
}

async function initConfig()
{
    while(typeof mark_config =='undefined') await new Promise((res)=>setTimeout(res,200))
    window.MARK_API_BASE = 'http://127.0.0.1:'+mark_config.root_config.DOMAIN_PORT //'https://c6.forklist.dtns/node.'+NODEID+'.'+SCORE_TOKEN_NAME,
    window.MARK_TOKEN_NAME = mark_config.root_config.TOKEN_NAME
    window.MARK_TOKEN_ROOT = mark_config.root_config.TOKEN_ROOT
    window.MARK_CODE_LEN = 10
    window.g_rtmarket_tax_type_default = 'tax'
    window.g_rtmarket_tax_default = 0.001
    window.g_rtmarket_mark_default= ll_config.defaultRTCRoomID ? ll_config.defaultRTCRoomID :window.defaultRTCRoomID
    window.g_rtmarket_mark_default_transfer=ll_config.defaultRTCRoomID ? ll_config.defaultRTCRoomID :window.defaultRTCRoomID
    window.g_rtmarket_mark_price = 'fi'//dtns-fi，标志位符号为∫
    window.g_rtmarket_trade_number_min_default = 0.01 //最少5f num*price
    window.TOKEN_CLT_TIPS_STR = mark_config.root_config.TOKEN_CLT_TIPS_STR //const 
    window.g_rtmarket_num_util = new CoinNumUtil(mark_config.root_config.COIN_PRECISION_MAX)
    window.g_rtmarket_inited = true
    window.g_mark_list = []
    window.g_mark_settings = new Map()
    query_g_rtmarket_list()
}
if(typeof Buffer!='undefined') initConfig()

async function initRTMarketSetting(mark = null)
{
    mark = !mark ? window.g_rtmarket_mark_default : mark
    let req = {params:{name:mark,mark:mark,tax_type:g_rtmarket_tax_type_default,tax:g_rtmarket_tax_default},init_setting_flag:true}
    let {name,logo,desc,tax_type,tax,user_id} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return {ret:false,msg:'param mark is error'}

    let space = MARK_TOKEN_NAME+'_'+mark+mark_config.root_config.TOKEN_CLT_TIPS_STR
    let dst_token = space + MARK_TOKEN_ROOT.substring(space.length,MARK_TOKEN_ROOT.length)
    
    //不要重复配置
    let sInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,dst_token,'assert')
    if(sInfo) return {ret:false,msg:'mark is existed'}

    sInfo = {token:dst_token,name,mark,logo,desc,tax_type,tax,time_i:parseInt(Date.now()/1000),create_user_id:user_id} 
    let forkRet = await rpc_api_util.s_query_token_id(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token)
    if(!forkRet) return {ret:false,msg:'fork mark-dst-token failed!'}
    
    let saveRet =await rpc_api_util.s_save_token_info(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'assert',JSON.stringify(sInfo),'create-mark')
    if(!saveRet) return {ret:false,msg:'save mark-info failed'}

    let bindRet = g_rtmarket_mark_price==mark ? 'default-price-not-need-bind': await rpc_api_util.s_save_into_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'relm','bind2list mark:'+mark)

    return {ret:true,msg:'success',info:sInfo,bind_ret:bindRet}
}
async function recvClientUserChannelMsg(xobj)
{
    console.log('recvClientUserChannelMsg:',xobj)
}
async function creatMarkChannel()
{
    let rtmarketUser = 'rtmarket-system-default-user'
    let channel = 'rtmarket-channel'
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id:rtmarketUser},peer:{send:recvClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatMarkChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id:rtmarketUser},peer:{
            send:recvClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatMarkChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendMarkChannelMsg(rtmarketUser,'allow_send_users')
    console.log('rt-market:setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}
async function sendMarkChannelMsg(xobj,notify_type = 'rtmarket-channel')
{
    let user_id = 'rtmarket-system-default-user'
    let channel = 'rtmarket-channel'
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendMarkChannelMsg-ret:',ret)
    return ret
}
async function loadMarkDnalinkNode()
{
    while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
    while(!window.g_rtmarket_inited) await new Promise((res)=>setTimeout(res,200))
    // await new Promise((res)=>setTimeout(res,2000))
    console.log('loadMarkDnalinkNode-defaultRTCRoomID:',ll_config.defaultRTCRoomID)
    mark_main(ll_config.defaultRTCRoomID)

    //初始化配置
    setTimeout(async ()=>{
       let initRet = await initRTMarketSetting()
       console.log('rtmarket-initRet:',initRet,g_rtmarket_mark_price,g_rtmarket_mark_default)

       if(g_rtmarket_mark_price!=g_rtmarket_mark_default)
       {
        initRet = await initRTMarketSetting(g_rtmarket_mark_price)
        console.log('rtmarket-mark-price-initRet:',initRet)
       }

       let markList = await get_mark_list()
       console.log('rtmarket-mark-list:',markList)

    //    let loadRet = loadMarkReadyListFromDNALink('t1')
    //    console.log('loadRet:',loadRet)
       let recoverResults = await recoverOrderList()
       console.log('recoverResults:',recoverResults)

       let createRet = await creatMarkChannel()
       console.log('creatMarkChannel-result:',createRet)
       
       if(createRet && typeof g_node_side_event_bus!='undefined'){
            g_node_side_event_bus.emit('rt_market_inited')
            window.g_rt_market_inited = true
       }

       autoTrade()//自动开始交易(实时交易撮合)
    },3000)
}
loadMarkDnalinkNode()

rtmarket_c.routers =function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtmarket/test',urlParser,session_filter,rtmarket_c.test)
    app.all('/rtmarket/test2',urlParser,session_filter,rtmarket_c.test2)
    app.all('/rtmarket/test3',urlParser,session_filter,rtmarket_c.test3)
    app.all('/rtmarket/mark/create',urlParser,console_filter,rtmarket_c.createMark) //创建mark标志（例如BTC）
    app.all('/rtmarket/mark/set',urlParser,console_filter,rtmarket_c.setMark)//设置mark的配置（简介、符号、图标、手续率等）
    app.all('/rtmarket/mark/charge',urlParser,console_filter,rtmarket_c.chargeMark)//充值mark
    app.all('/rtmarket/mark/account/history',urlParser,session_filter,rtmarket_c.history)//充值mark
    app.all('/rtmarket/mark/info',urlParser,session_filter,rtmarket_c.infoMark)//查看mark的配置信息
    app.all('/rtmarket/mark/list',urlParser,session_filter,rtmarket_c.listMark)//查看mark的配置信息
    app.all('/rtmarket/mark/channel/create',urlParser,session_filter,async function(req,res){
        let ret = await creatMarkChannel()
        console.log('creatMarkChannel-call-ret:',ret)
    })
    app.all('/rtmarket/mark/channel/send',urlParser,session_filter,async function(req,res){
        let ret = await sendMarkChannelMsg({type:'test',msg:'test-msg'})
        console.log('creatMarkChannel-call-ret:',ret)
    })
    app.all('/rtmarket/mark/account/create',urlParser,session_filter,rtmarket_c.createAccount)
    app.all('/rtmarket/mark/account/query',urlParser,session_filter,rtmarket_c.queryAccount)
    app.all('/rtmarket/mark/transfer',urlParser,session_filter,rtmarket_c.transfer)//交易账户入账g_rtmarket_mark_default（这个是交易的中介账户），可将dtns-user-int的奖金账户转入任意金额
    app.all('/rtmarket/mark/buy',urlParser,session_filter,rtmarket_c.buyMark)//buy-ccy，数量，定价等（会冻结本币mark_int000***金额）---委托挂买单
    app.all('/rtmarket/mark/sell',urlParser,session_filter,rtmarket_c.sellMark)//sell-ccy，数量，定价（会冻结mark_***000---金额）---委托挂买单
    app.all('/rtmarket/mark/cancel',urlParser,session_filter,rtmarket_c.cancelList)//撤消委托
    app.all('/rtmarket/mark/list/all',urlParser,session_filter,rtmarket_c.listAllMarkOrder)//内存态的委托--buy-list和sell-list（只返回价格-数量-total）
    app.all('/rtmarket/mark/list/buy',urlParser,session_filter,rtmarket_c.listBuyMark)//买单委托列表
    app.all('/rtmarket/mark/list/sell',urlParser,session_filter,rtmarket_c.listSellMark)//卖委托单列表
    app.all('/rtmarket/mark/list/buy/my',urlParser,session_filter,rtmarket_c.listMyBuyMark)//买单委托列表（我的）
    app.all('/rtmarket/mark/list/sell/my',urlParser,session_filter,rtmarket_c.listMySellMark)//卖委托单列表（我的）
    app.all('/rtmarket/mark/order/info',urlParser,session_filter,rtmarket_c.orderInfo)//买单委托列表（我的）
    app.all('/rtmarket/mark/price',urlParser,session_filter,rtmarket_c.priceMark)//查询当前ccy的价格（成交价格）
    app.all('/rtmarket/mark/price/list',urlParser,session_filter,rtmarket_c.priceListMark)//历史成交纪录
    // app.all('/rtmarket/mark/price/now',urlParser,session_filter,rtmarket_c.priceNowMark)//查询实时级别的曲线
    // app.all('/rtmarket/mark/price/m',urlParser,session_filter,rtmarket_c.priceMinuteMark)//查询分钟级别的曲线
    // app.all('/rtmarket/mark/price/15m',urlParser,session_filter,rtmarket_c.price15MinuteMark)//查询15分钟级别的曲线
    // app.all('/rtmarket/mark/price/h',urlParser,session_filter,rtmarket_c.priceHourMark)//查询小时级别的曲线
    // app.all('/rtmarket/mark/price/D',urlParser,session_filter,rtmarket_c.priceDayMark)//查询天级别的曲线
    // app.all('/rtmarket/mark/price/W',urlParser,session_filter,rtmarket_c.priceWeekMark)//查询周级别的曲线
    // app.all('/rtmarket/mark/price/M',urlParser,session_filter,rtmarket_c.priceMonthMark)//查询月级别的曲线
    // app.all('/rtmarket/mark/price/Y',urlParser,session_filter,rtmarket_c.priceYearMark)//查询年级别的曲线
}

rtmarket_c.test = test
async function test(req,res)
{
    let ret = await rpc_query(MARK_API_BASE+'/chain/opcode',{token:'mark_000000000000000000000000000000',begin:0,len:10}) // g_dtnsManager.run('dtns://web3:'+defaultRTCRoomID+'/chain/opcode',{token:'mark_0000000000000000000000000000',rpc_port:81,begin:0,len:10})
    res.json(ret)
}

rtmarket_c.test2 = test2
async function test2(req,res)
{
    let ret = await rpc_query(MARK_API_BASE+'/fork',{token:'mark_000000000000000000000000000000',space:'test000'}) // g_dtnsManager.run('dtns://web3:'+defaultRTCRoomID+'/chain/opcode',{token:'mark_0000000000000000000000000000',rpc_port:81,begin:0,len:10})
    res.json(ret)
}

rtmarket_c.test3 = test3
async function test3(req,res)
{
    let {token} = str_filter.get_req_data(req)
    let saveRet = await rpc_api_util.s_save_token_info(MARK_API_BASE,MARK_TOKEN_ROOT,token,'assert',JSON.stringify({test:3,time_i:Date.now()}),'save-test3-api-info')
    if(!saveRet) return res.json({ret:false,msg:'save-failed'})
    let qRet =await rpc_api_util.s_query_token_info(MARK_API_BASE,token,'assert');
    //let ret = await rpc_query(MARK_API_BASE+'/chain/',{token:'mark_000000000000000000000000000000',space:'test000'}) // g_dtnsManager.run('dtns://web3:'+defaultRTCRoomID+'/chain/opcode',{token:'mark_0000000000000000000000000000',rpc_port:81,begin:0,len:10})
    res.json(qRet)
}

rtmarket_c.validateMarkID = validateMarkID
function validateMarkID(mark)
{
    let regExp = new RegExp("^[a-zA-Z]+[a-zA-Z0-9]{1," + MARK_CODE_LEN + "}$")
    if(!mark || !regExp.test(mark) || mark.length<2 || MARK_CODE_LEN.length>MARK_CODE_LEN) return false
    if(mark.endsWith('0') || mark.indexOf(TOKEN_CLT_TIPS_STR)>=0) return false //不能为0结尾或者内包含了000分割符
    return true
}
/**
 * 创建一个mark标识符（售卖的券或标准量商品--例如标准003大米）
 */
rtmarket_c.createMark = createMark
async function createMark(req,res)
{
    let {name,mark,logo,desc,tax_type,tax,std_price,number,number_type,user_id} = str_filter.get_req_data(req)
    if(!name) return res.json({ret:false,msg:'param name is error'})

    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(std_price && (!g_rtmarket_num_util.validateCoinNumNUM(std_price) || std_price<=0)) return res.json({ret:false,msg:'param std_price is error'})
    if(number && (!g_rtmarket_num_util.validateCoinNumNUM(number) || number<0)) return res.json({ret:false,msg:'param number is error'})
    
    let space = MARK_TOKEN_NAME+'_'+mark+mark_config.root_config.TOKEN_CLT_TIPS_STR
    let dst_token = space + MARK_TOKEN_ROOT.substring(space.length,MARK_TOKEN_ROOT.length)

    let sInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,dst_token,'assert')
    if(sInfo) return res.json({ret:false,msg:'mark is existed'})

    sInfo = {token:dst_token,name,mark,logo,desc,tax_type,tax,std_price,number,number_type,time_i:parseInt(Date.now()/1000),create_user_id:user_id} 
    let forkRet = await rpc_api_util.s_query_token_id(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token)
    if(!forkRet) return res.json({ret:false,msg:'fork mark-dst-token-failed',mark})
    
    let saveRet =await rpc_api_util.s_save_token_info(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'assert',JSON.stringify(sInfo),'create-mark')
    if(!saveRet) return res.json({ret:false,msg:'save mark-info failed'})

    let bindRet = std_price?false: await rpc_api_util.s_save_into_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'relm','bind2list mark:'+mark)
    if(std_price)
    {
        bindRet = await await rpc_api_util.s_save_into_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'relt','bind2std-list mark:'+mark)
        if(!bindRet) return res.json({ret:false,msg:'bind mark-std failed'})
    }
    get_mark_list(1000)
    res.json({ret:true,msg:'success',info:sInfo,bind_ret:bindRet})
}
/**
 * 设置mark的配置信息
 */
rtmarket_c.setMark = setMark
async function setMark(req,res)
{
    let {name,mark,logo,desc,tax_type,tax,std_price,number,number_type,user_id} = str_filter.get_req_data(req)
    if(!name) return res.json({ret:false,msg:'param name is error'})
    
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})

    // let space = MARK_TOKEN_NAME+'_'+mark+mark_config.root_config.TOKEN_CLT_TIPS_STR
    let dst_token = get_mark_default_root_token(mark)// space + MARK_TOKEN_ROOT.substring(space.length,MARK_TOKEN_ROOT.length)

    let markInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,dst_token,'assert')
    if(!markInfo) return res.json({ret:false,msg:'mark-info is empty'})
    // || g_rtmarket_num_util.toCoinNumNUM( markInfo.std_price ) != g_rtmarket_num_util.toCoinNumNUM(std_price)))
    if( (!markInfo.std_price && std_price) || ( markInfo.std_price && (!std_price) ) )
        return res.json({ret:false,msg:'change mark-type failed!'})

    sInfo = {token:dst_token,name,mark,logo,desc,tax_type,tax,std_price,number,number_type,time_i:parseInt(Date.now()/1000),create_user_id:user_id} 
    let forkRet = await rpc_api_util.s_query_token_id(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token)
    if(!forkRet) return res.json({ret:false,msg:'mark-dst-token is unexist',mark})
    
    let saveRet =await rpc_api_util.s_save_token_info(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'assert',JSON.stringify(sInfo),'create-mark')
    if(!saveRet) return res.json({ret:false,msg:'save mark-info failed'})

    let bindRet = std_price ? false : await rpc_api_util.s_save_into_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'relm','bind2list mark:'+mark)
    let unbindRet=std_price ? await rpc_api_util.s_del_from_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,dst_token,'relm','unbind from list mark:'+mark):false
    get_mark_list(1000)
    res.json({ret:true,msg:'success',info:sInfo,bind_ret:bindRet,unbind_ret:unbindRet})
}

/**
 * 查看mark的配置信息
 */
rtmarket_c.infoMark = infoMark
async function infoMark(req,res)
{
    let {mark} = str_filter.get_req_data(req)

    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})

    let dst_token = get_mark_default_root_token(mark)

    let sInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,dst_token,'assert')
    if(!sInfo) return res.json({ret:false,msg:'mark is unexist!'})
    sInfo.ret = true
    sInfo.msg = 'success'
    res.json(sInfo)
}
/**
 * 列出所有的mark
 * @param {*} req 
 * @param {*} res 
 */
rtmarket_c.listMark = listMark
async function listMark(req,res)
{
    res.json({ret:true,msg:'success',marks:g_mark_list})
}

/**
 * 充值mark的数量
 */
rtmarket_c.chargeMark = chargeMark
async function chargeMark(req,res)
{
    let {mark,number,user_id} = str_filter.get_req_data(req)

    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!isFinite(number) ||number<=0) return res.json({ret:false,msg:'param number is error'})
    if(mark == 'price') mark = g_rtmarket_mark_price

    let accountRet = await createUserMarkAccount(user_id,mark)
    if(!accountRet || !accountRet.ret) return res.json({ret:false,msg:'get-user-account failed',accountRet})
    let mark_account_id = accountRet.mark_account_id

    let order_extra_data = 'charge-mark-'+user_id+'-'+mark+'-'+Date.now()
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
    let sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:MARK_TOKEN_ROOT,token_y:mark_account_id,opval:number, extra_data:order_extra_data})
    if(!sendRet || !sendRet.ret) return res.json({ret: false, msg: "sell-mark send number failed"})

    res.json({ret:true,msg:'success',mark_account_id,number})
}

rtmarket_c.history = history
async function history(req,res)
{
    let {mark,user_id,begin,len} = str_filter.get_req_data(req)
    if(mark=='price') mark = g_rtmarket_mark_price
    if(!isFinite(begin) ||!isFinite(len)) return res.json({ret:false,msg:'param len or begin is error'})

    let accountRet = await createUserMarkAccount(user_id,mark)
    if(!accountRet || !accountRet.ret) return res.json({ret:false,msg:'get-user-account failed'})
    let mark_account_id = accountRet.mark_account_id

    let ret = await rpc_query(MARK_API_BASE+'/chain/opcode',{token:mark_account_id,opcode:'send',begin,len})

    if(!ret ||!ret.ret ||!ret.list || ret.list.length<=0) return res.json({ret:false,msg:'list is empty'})

    let list = ret.list
    let results = []
    for(let i=0;i<list.length;i++)
    {
        try{
            results.push( JSON.parse(list[i].txjson))
            results[i].add_op = results[i].token_y == mark_account_id //add or minus
        }catch(ex)
        {
            console.log('priceListMark-exception:'+ex,ex,list[i])
        }
    }
    return res.json({ret:true,msg:'success',list:results})
}

rtmarket_c.get_mark_default_root_token = get_mark_default_root_token
function get_mark_default_root_token(mark)
{
    // let mark = g_rtmarket_mark_default
    if(!validateMarkID(mark)) return null
    let space = MARK_TOKEN_NAME+'_'+mark+mark_config.root_config.TOKEN_CLT_TIPS_STR
    let dst_token = space + MARK_TOKEN_ROOT.substring(space.length,MARK_TOKEN_ROOT.length)
    return dst_token
}
rtmarket_c.get_mark_list = get_mark_list
async function get_mark_list(delay = 0)
{
    if(delay)
    await new Promise((res)=>setTimeout(res,delay))

    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,MARK_TOKEN_ROOT,'relm',0,100000,false)
    let result = []
    if(!list || list.length<=0) return result
    for(let i=0;i<list.length;i++)
    {
        let token = list[i].token_y
        let mark = (token.split('_')[1]).split(TOKEN_CLT_TIPS_STR)[0] 
        if(!mark) continue
        result.push( mark )
        g_mark_settings.set(mark,list[i])
    }
    window.g_mark_list = result
    return result
}
/**
 * 创建一个mark对应的mark-account-id，如已存在，则不创建
 * @param {*} user_id 
 * @param {*} mark 
 * @returns 
 */
rtmarket_c.createUserMarkAccount = createUserMarkAccount
async function createUserMarkAccount(user_id,mark)
{
    if(!validateMarkID(mark)) return {ret:false,msg:'param mark is error'}

    if(typeof g_rtmarket_user_map =='undefined') g_rtmarket_user_map = new Map()
    if(g_rtmarket_user_map.has(user_id+':'+mark)) return g_rtmarket_user_map.get(user_id+':'+mark)
    let returnUserA = function(userA)
    {
        g_rtmarket_user_map.set(user_id+':'+mark,userA)
        return userA
    }

    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    if(!userInfo) return {ret:false,msg:'user-info is empty'}
    if(!userInfo.dtns_user_id)  return {ret:false,msg:'user-info have not dtns_user_id'}
    let dtns_user_id = userInfo.dtns_user_id

    let mapInfoRet = await rpc_query(MARK_API_BASE+'/chain/map/value',{token:MARK_TOKEN_ROOT,map_key:'mark-account:'+dtns_user_id}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('query-mark-account-map-info:',mapInfoRet,dtns_user_id)
    if(!mapInfoRet ||! mapInfoRet.map_value)
    {
        //默认用户先关联的是default-mark
        let forkid = await rpc_api_util.s_fork_token_id(MARK_API_BASE,get_mark_default_root_token(g_rtmarket_mark_default))
        if(!forkid) return {ret:false,msg:'fork default-mark-account-token failed',user_id}
        let bindDTNSIDRet = await rpc_query(MARK_API_BASE+'/op',
        {token_x:MARK_TOKEN_ROOT,token_y:MARK_TOKEN_ROOT,opcode:'map',opval:'add',
        extra_data:JSON.stringify({map_key:'mark-account:'+dtns_user_id,map_value:forkid})})
        if(!bindDTNSIDRet || !bindDTNSIDRet.ret) return {ret:false,msg:'map dtns-user-id failed'}
        if(mark==g_rtmarket_mark_default) return returnUserA({ret:true,msg:'success',account_id:forkid,mark_account_id:forkid,mark})
    }
    let account_id = mapInfoRet.map_value
    let mark_id = get_mark_default_root_token(mark)
    if(mark==g_rtmarket_mark_default) return returnUserA({ret:true,msg:'success',account_id,mark_account_id:account_id,mark})
    let markInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,mark_id,'assert')
    if(!markInfo) return {ret:false,msg:'mark-info is empty'}
    //先查询是否存在
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,account_id,'hold',0,100000,false,function(){return false})
    console.log('user-account-relate-list:',list)
    if(list && list.length>0)
    {
        for(let i=0;i<list.length;i++)
        {
            if(list[i].token_y.startsWith(MARK_TOKEN_NAME+'_'+mark+mark_config.root_config.TOKEN_CLT_TIPS_STR))
            {
                return returnUserA({ret:true,msg:'success',existed:true,account_id,mark_account_id:list[i].token_y,mark})
            }
        }
    }

    //fork ，然后关联-rela
    let forkid = await rpc_api_util.s_fork_token_id(MARK_API_BASE,mark_id)
    if(!forkid) forkid = await rpc_api_util.s_fork_token_id(MARK_API_BASE,mark_id)
    if(!forkid) return {ret:false,msg:'fork-account-id failed',mark}
    console.log('forkid:',forkid,mark,user_id,account_id)
    let relRet = await rpc_api_util.s_save_into_token_list(MARK_API_BASE,account_id,forkid,'hold','hold mark-account-id:'+mark)
    if(!relRet) return {ret:false,msg:'bind account-mark-id failed'}
    return returnUserA({ret:true,msg:'success',account_id,mark_account_id:forkid,mark})
}
rtmarket_c.createAccount = createAccount
async function createAccount(req,res){
    let {mark,user_id} = str_filter.get_req_data(req)
    let createAccountRet = await createUserMarkAccount(user_id, mark)
    res.json(createAccountRet)
}

rtmarket_c.queryAccount = queryAccount
async function queryAccount(req,res){
    let {mark,user_id} = str_filter.get_req_data(req)
    let createAccountRet = await createUserMarkAccount(user_id, mark)
    //查询账户余额：
    if(createAccountRet && createAccountRet.ret)
    {
        let statesRet = await rpc_query(MARK_API_BASE+ '/chain/states',{token:createAccountRet.mark_account_id})
        if(statesRet && statesRet.ret)
        {
            createAccountRet.number = statesRet.val
        }
    }
    
    res.json(createAccountRet)
}

/**
 * 资金账户=>交易账户
 */
rtmarket_c.transfer = transfer
async function transfer(req,res)
{
    //transfer的数量
    let {number,user_id} = str_filter.get_req_data(req)
    if(!isFinite(number)) return res.json({ret:false,msg:'number is error!',number})

    let createAccountRet = await createUserMarkAccount(user_id, g_rtmarket_mark_default_transfer)
    console.log('createAccountRet:',createAccountRet)
    if(!createAccountRet || !createAccountRet.ret) return res.json({ret:false,msg:'create-account failed',mark:g_rtmarket_mark_default_transfer})

    let account_id = createAccountRet.account_id
    //充值转账
    //充值金额----状态修改需要在此之前（否则也空间被攻击）
    let rmbUserId = await order_c.s_queryUserRMBToken(user_id)
    //充值订单，不进行分账处理2023-11-28-bak
    let order_extra_data = 'transfer-'+user_id+'-'+Date.now()
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
    let sendRet = await rpc_query(RMB_API_BASE+"/send",{token_x:rmbUserId,token_y:RMB_TOKEN_ROOT,opval:number, extra_data:order_extra_data})
    if(!sendRet || !sendRet.ret) return res.json({ret: false, msg: "transfer-number failed"})

    order_extra_data = 'transfer-mark-account-'+user_id+'-'+Date.now()
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
    sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:MARK_TOKEN_ROOT,token_y:account_id,opval:number, extra_data:order_extra_data})
    if(!sendRet || !sendRet.ret) return res.json({ret: false, msg: "transfer-mark-account-number failed"})

    res.json({ret:true,msg:'success'})
}

function query_g_rtmarket_list()
{
    if(typeof g_markListMap == 'undefined')
    {
        window.g_markListMap = new Map()
    }
    return g_markListMap
}
//按价格买价-高-低（卖价-低-高）；时间旧-新排序（以便撮合交易）
function sort_list(list,type='buy')
{
    if(!list) return list
    if(type=='sell') list.sort(function(a,b){
        if(a.price != b.price) return a.price-b.price //高价在后面
        return a.time_i - b.time_i //时间更新的在后面（先下单的在前面）
    })
    else list.sort(function(a,b){
        if(a.price != b.price) return b.price-a.price //高价在前面（购买列表是高价优先结算）
        return a.time_i - b.time_i
    })
    return list
}
function validateSTDMarkInfo(number,price,markInfo,type='buy')
{
    console.log('validateSTDMarkInfo:',number,price,markInfo,type)
    if(markInfo.std_price)
    {
        if( g_rtmarket_num_util.toCoinNumNUM( price ) != g_rtmarket_num_util.toCoinNumNUM( markInfo.std_price))
        {
            console.log('price!=std_price')
            return false
        }
        if(!markInfo.number && g_rtmarket_num_util.toCoinNumNUM( number) == '1') return true
        if(!markInfo.number && g_rtmarket_num_util.toCoinNumNUM( number) !='1')
        {
            console.log('number!=1')
            return false
        }
        if(type == 'buy' && g_rtmarket_num_util.lt( markInfo.number,number) )//仅sell支持超过此数
        {
            console.log('number>markInfo.number')
            return false
        }
        if(!g_rtmarket_num_util.lt(0, g_rtmarket_num_util.toCoinNumNUM(number)))
        {
            console.log('number<=0')
            return false
        }
        if(markInfo.number_type == 'int' &&  (''+parseInt(number))!=(''+number))
        {
            console.log('parseInt(number)!=number')
            return false
        }
    }
    return true
}
/**
 * 购买mark
 */
rtmarket_c.buyMark = buyMark
async function buyMark(req,res)
{
    //transfer的数量
    let {mark,number,price,user_id} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!g_rtmarket_num_util.validateCoinNumNUM(number) || number<=0) return res.json({ret:false,msg:'param number is error'})
    if(!g_rtmarket_num_util.validateCoinNumNUM(price) || price<=0) return res.json({ret:false,msg:'param price is error'})

    number = g_rtmarket_num_util.toCoinNumNUM(number)
    price = g_rtmarket_num_util.toCoinNumNUM(price)
    let total = g_rtmarket_num_util.toCoinNumNUM(g_rtmarket_num_util.mul(number,price))

    let markInfo = req.markInfo ? req.markInfo: await rpc_api_util.s_query_token_info(MARK_API_BASE,rtmarket_c.get_mark_default_root_token(mark),'assert')
    if(!markInfo) return res.json({ret:false,msg:'mark-info is empty'})
    if(!validateSTDMarkInfo(number,price,markInfo)) return res.json({ret:false,msg:'buy-std-order:number or price is error'})

    let accountRet = await createUserMarkAccount(user_id,mark)
    if(!accountRet || !accountRet.mark_account_id || !accountRet.account_id) return res.json({ret:false,msg:'user-mark-account is empty'})

    let accountPriceRet = await createUserMarkAccount(user_id,g_rtmarket_mark_price)
    if(!accountPriceRet || !accountPriceRet.mark_account_id || !accountPriceRet.account_id) return res.json({ret:false,msg:'user-price-account is empty'})

    let account_id = accountPriceRet.mark_account_id// accountRet.account_id
    let root_account_id = get_mark_default_root_token(g_rtmarket_mark_price)//g_rtmarket_mark_default)
    let mark_account_id= accountRet.mark_account_id
    let mark_id = get_mark_default_root_token(mark)

    //保存委托订单
    let info = {type:'buy',mark,number,price,total,user_id,time_i:Date.now()}//挂单信息
    let orderid= await rpc_api_util.s_fork_token_id(MARK_API_BASE,mark_id,mark+TOKEN_CLT_TIPS_STR+'bo2')
    if(!orderid) return res.json({ret:false,msg:'fork buy-order-id failed'})
    info.order_id = orderid
    let saveRet = await rpc_api_util.s_save_token_info(MARK_API_BASE,MARK_TOKEN_ROOT,orderid,'assert',JSON.stringify(info),'save-buy-order')
    if(!saveRet) return res.json({ret:false,msg:'save buy-order-info failed'})

    //先行扣费
    let order_extra_data = 'buy-mark-'+user_id+'-'+mark+'-'+orderid+'-'+Date.now()
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
    let sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:account_id,token_y:root_account_id,opval:total, extra_data:order_extra_data})
    if(!sendRet || !sendRet.ret) return res.json({ret: false, msg: "buy-mark send number failed"})

    //扣费成功后，则将交易委托单写入至待购买列表中
    //绑定关系
    let relRet = await rpc_api_util.s_save_into_token_list(MARK_API_BASE,mark_id,orderid,'relb','bind mark-buy-order:'+mark)
    if(!relRet) return {ret:false,msg:'bind  mark-buy-order failed'}

    relRet = await rpc_api_util.s_save_into_token_list(MARK_API_BASE,mark_account_id,orderid,'relb','bind mark-buy-order:'+mark)
    if(!relRet) return {ret:false,msg:'bind  user-mark-buy-order failed'}


    //添加至购买列表中
    query_g_rtmarket_list()
    let list = g_markListMap.get(mark+':buy-list-ready')
    if(!list) {
        list = []
        g_markListMap.set(mark+':buy-list-ready',list)
    }
    list.push(info)
    sort_list(list,'buy')

    // sendMarkChannelMsg(listAllMarkOrderFunc(mark),'realtime_orders')
    setTimeout(()=>sendMarkChannelMsg(listAllMarkOrderFunc(mark),'realtime_orders'),1000)//1秒后通知

    res.json({ret:true,msg:'success',order_id:orderid})
}

/**
 * 销售mark
 */
rtmarket_c.sellMark = sellMark
async function sellMark(req,res)
{
    //transfer的数量
    let {mark,number,price,user_id} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!g_rtmarket_num_util.validateCoinNumNUM(number) || number<=0) return res.json({ret:false,msg:'param number is error'})
    if(!g_rtmarket_num_util.validateCoinNumNUM(price) || price<=0) return res.json({ret:false,msg:'param price is error'})

    number = g_rtmarket_num_util.toCoinNumNUM(number)
    price = g_rtmarket_num_util.toCoinNumNUM(price)
    let total = g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.mul(number,price) )

    let markInfo = req.markInfo ? req.markInfo: await rpc_api_util.s_query_token_info(MARK_API_BASE,rtmarket_c.get_mark_default_root_token(mark),'assert')
    if(!markInfo) return res.json({ret:false,msg:'mark-info is empty'})
    if(!validateSTDMarkInfo(number,price,markInfo,'sell')) return res.json({ret:false,msg:'sell-std-order:number or price is error'})

    let accountRet = await createUserMarkAccount(user_id,mark)
    if(!accountRet || !accountRet.mark_account_id || !accountRet.account_id) return res.json({ret:false,msg:'user-mark-account is empty'})

    let mark_id = get_mark_default_root_token(mark)
    //保存委托订单
    let info = {type:'sell',mark,number,price,total,user_id,time_i:Date.now()}//挂单信息
    let orderid= await rpc_api_util.s_fork_token_id(MARK_API_BASE,mark_id,mark+TOKEN_CLT_TIPS_STR+'so1')
    if(!orderid) return res.json({ret:false,msg:'fork sell-order-id failed'})
    info.order_id = orderid
    let saveRet = await rpc_api_util.s_save_token_info(MARK_API_BASE,MARK_TOKEN_ROOT,orderid,'assert',JSON.stringify(info),'save-sell-order')
    if(!saveRet) return res.json({ret:false,msg:'save sell-order-info failed'})

    let mark_account_id = accountRet.mark_account_id
    //先行扣费
    let order_extra_data = 'sell-mark-'+user_id+'-'+mark+'-'+Date.now()
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
    let sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:mark_account_id,token_y:mark_id,opval:number, extra_data:order_extra_data})
    if(!sendRet || !sendRet.ret) return res.json({ret: false, msg: "sell-mark send number failed"})
    //扣费成功，则将交易委托单写入至待购买列表中

    //绑定关系
    let relRet = await rpc_api_util.s_save_into_token_list(MARK_API_BASE,mark_id,orderid,'rels','bind mark-sell-order:'+mark)
    if(!relRet) return {ret:false,msg:'bind  mark-sell-order failed'}

    relRet = await rpc_api_util.s_save_into_token_list(MARK_API_BASE,mark_account_id,orderid,'rels','bind mark-sell-order:'+mark)
    if(!relRet) return {ret:false,msg:'bind  user-mark-sell-order failed'}

    //添加至购买列表中
    query_g_rtmarket_list()
    let list = g_markListMap.get(mark+':sell-list-ready')
    if(!list) {
        list = []
        g_markListMap.set(mark+':sell-list-ready',list)
    }
    list.push(info)
    sort_list(list,'sell')

    // sendMarkChannelMsg(listAllMarkOrderFunc(mark),'realtime_orders')
    setTimeout(()=>sendMarkChannelMsg(listAllMarkOrderFunc(mark),'realtime_orders'),1000)//1秒后通知
    if(markInfo.std_price)
    {
        //发送数量
        if(typeof g_node_side_event_bus!='undefined'){
            console.log('emit-rt_shopping_sell_event:',{mark,cnt:parseInt( number),markInfo})
            g_node_side_event_bus.emit('rt_shopping_sell_event',{mark,cnt:parseInt( number),markInfo})
        }
    }

    res.json({ret:true,msg:'success',order_id:orderid})
}

/**
 * 设计
 * 持久化买队列  mark-token-root - > relb （待完成列表） 、relc（成功队列）   ; 卖队列  rels （待完成队列） 、 relr（成功队列）
 * 内存化队列： markBuyListMap.set(mark,list) ;  卖队列：markSellListMap.set(mark,list) ; 
 *      成交队列：markSuccessListMap.set(mark,list) //sell-order-id、buy-order-id、success_price、sucess_number等等
 *      撤消队列：markCancelListMap.set(mark,list) //order_id、
 * 信息缓存：  markBuyInfoMap.set(id,info)
 * 重点：以内存为核心，更新至持久化队列
 */

rtmarket_c.cancelList = cancelList
async function cancelList(req,res)
{
    let {order_id,user_id} = str_filter.get_req_data(req)

    let orderInfoRet = await new Promise((resolve)=>{
        orderInfo({params:{order_id,user_id}},{json:function(data){
            resolve(data)
        }})
    })
    if(!orderInfoRet || !orderInfoRet.ret) res.json(orderInfoRet?orderInfoRet:{ret:false,msg:'query-order-info failed!'})
    if(orderInfoRet.is_canceled) return res.json({ret:false,msg:'order is canceled'})
    if(orderInfoRet.is_processed) return res.json({ret:false,msg:'order is processed'})

    if(orderInfoRet.ok_orders && orderInfoRet.is_processing) //ok_orders.length>0)
    {
        orderInfoRet.del_last_total =  g_rtmarket_num_util.minus( g_rtmarket_num_util.mul( orderInfoRet.number,orderInfoRet.price ), orderInfoRet.processed_total)
    }else{
        orderInfoRet.del_last_total =  g_rtmarket_num_util.mul( orderInfoRet.number,orderInfoRet.price )
    }
    // let orderInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,order_id,'assert')
    // if(!orderInfo) return res.json({ret:false,msg:'order-info is empty'})
    let type = orderInfoRet.type
    let mark = orderInfoRet.mark

    // let xlist = await rpc_api_util.s_query_token_list(MARK_API_BASE,orderInfo.order_id,'relo',0,1,type == 'sell',function(){return false})
    // if(xlist && xlist.length>0) return res.json({ret:false,msg:'order is processed'})

    //添加至撤消列表中----以便合并处理
    query_g_rtmarket_list()
    let list = g_markListMap.get(mark+':'+type+'-list-cancel')
    if(!list) {
        list = []
        g_markListMap.set(mark+':'+type+'-list-cancel',list)
    }
    list.push(orderInfoRet)

    setTimeout(()=>sendMarkChannelMsg(listAllMarkOrderFunc(mark),'realtime_orders'),1000)//1秒后通知
    res.json({ret:true,msg:'success'})
}
function listAllMarkOrderFunc(mark)
{
    let list = g_markListMap.get(mark+':buy-list')
    let slist = g_markListMap.get(mark+':sell-list')
    sort_list(list,'buy')
    sort_list(slist,'sell')
    // list = copyOrderListZ(list) 
    // slist = copyOrderListZ(slist)
    list = compressOrderList(list)//必须复制，否则会修改buy-list和sell-list的内容
    slist= compressOrderList(slist)
    return {buy_list:list,sell_list:slist,mark,type:'realtime_orders'}
}
/**
 * 列出所有内存态的委托-压缩处理
 * @param {*} req 
 * @param {*} res 
 */
rtmarket_c.listAllMarkOrder = listAllMarkOrder
async function listAllMarkOrder(req,res)
{
    let {mark} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    let result = listAllMarkOrderFunc(mark)
    res.json({ret:true,msg:'success',result})
}
rtmarket_c.listBuyMark = listBuyMark
async function listBuyMark(req,res)
{
    let {mark,begin,len} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!isFinite(begin)) return res.json({ret:false,msg:'param begin is error'})
    if(!isFinite(len)) return res.json({ret:false,msg:'param len is error'})
    let mark_id = get_mark_default_root_token(mark)
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,mark_id,'relb',begin,len)
    await query_order_is_ok(mark_id,list,'buy')
    if(list && list.length>0) return res.json({ret:true,msg:'success',list})
    else res.json({ret:false,msg:'list is empty'})
}
rtmarket_c.listSellMark = listSellMark
async function listSellMark(req,res)
{
    let {mark,begin,len} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!isFinite(begin)) return res.json({ret:false,msg:'param begin is error'})
    if(!isFinite(len)) return res.json({ret:false,msg:'param len is error'})
    let mark_id = get_mark_default_root_token(mark)
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,mark_id,'rels',begin,len)
    await query_order_is_ok(mark_id,list,'sell')
    if(list && list.length>0) return res.json({ret:true,msg:'success',list})
    else res.json({ret:false,msg:'list is empty'})
}
/**
 * 查询成功交易的纪录 或 是否已被撤消（委托订单）
 * @param {*} mark_id 
 * @param {*} list 
 * @param {*} type 
 * @returns 
 */
async function query_order_is_ok(mark_id,list,type='sell')
{
    if(!list ||list.length<=0 ) return list
    let queryApis = []
    for(let i=0;i<list.length;i++)
    {
        let order_id = list[i].order_id
        queryApis.push(rpc_query(MARK_API_BASE+'/chain/opcode',{token:order_id,opcode:'relo',begin:0,len:100000}))
    }
    let rets = await Promise.all(queryApis)
    console.log('query_order_is_ok-rets:',rets)
    let unkownOrders = []
    let delCheckApis = []
    if(rets && rets.length>0)
    for(let i=0;i<rets.length;i++)
    {
        if(rets[i] && rets[i].ret)
        {
            let ok_orders = rets[i].list
            list[i].ok_orders = ok_orders
            try{
                let total = 0
                for(let k=0;k<ok_orders.length;k++)
                {
                    total = g_rtmarket_num_util.add(total,g_rtmarket_num_util.toCoinNumNUM(JSON.parse(JSON.parse(ok_orders[k].txjson).extra_data).total))
                }
                list[i].processed_total = total
                list[i].is_processing = g_rtmarket_num_util.lt(total,list[i].total)
                list[i].is_processed  = !list[i].is_processing
            }catch(ex)
            {
                console.log('parse-exception:'+ex,ex)
                list[i].is_processing = false
                list[i].is_processed  = !list[i].is_processing
            }
        } 
        if(list[i].is_processing || !list[i].ok_orders)
        {
            unkownOrders.push(list[i])
            delCheckApis.push(rpc_api_util.s_check_token_list_related(MARK_API_BASE,mark_id,list[i].order_id,type == 'sell'?'rels':'relb'))
        } 
    }
    rets = await Promise.all(delCheckApis)
    for(let i=0;i<rets.length;i++)
    {
        if(rets[i]) continue
        else unkownOrders[i].is_canceled = true
    }
    console.log('query_order_is_ok-list:',list)
    return list
}
rtmarket_c.listMyBuyMark = listMyBuyMark
async function listMyBuyMark(req,res)
{
    let {mark,begin,len,user_id} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!isFinite(begin)) return res.json({ret:false,msg:'param begin is error'})
    if(!isFinite(len)) return res.json({ret:false,msg:'param len is error'})
    let accountRet = await createUserMarkAccount(user_id,mark)
    let mark_account_id = accountRet.mark_account_id
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,mark_account_id,'relb',begin,len)
    await query_order_is_ok(get_mark_default_root_token(mark),list,'buy')
    if(list && list.length>0) return res.json({ret:true,msg:'success',list})
    else res.json({ret:false,msg:'list is empty'})
}
rtmarket_c.listMySellMark = listMySellMark
async function listMySellMark(req,res)
{
    let {mark,begin,len,user_id} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!isFinite(begin)) return res.json({ret:false,msg:'param begin is error'})
    if(!isFinite(len)) return res.json({ret:false,msg:'param len is error'})
    let accountRet = await createUserMarkAccount(user_id,mark)
    let mark_account_id = accountRet.mark_account_id
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,mark_account_id,'rels',begin,len)

    await query_order_is_ok(get_mark_default_root_token(mark),list,'sell')
    if(list && list.length>0) return res.json({ret:true,msg:'success',list})
    else res.json({ret:false,msg:'list is empty'})
}
/**
 * 查询订单信息，包含了成功的ok_list（成交纪录）
 */
rtmarket_c.orderInfo = orderInfo
async function orderInfo(req,res)
{
    let {order_id,user_id} = str_filter.get_req_data(req)
    if(!order_id) return res.json({ret:false,msg:'param order_id is error'})
    let orderInfo = await rpc_api_util.s_query_token_info(MARK_API_BASE,order_id,'assert')
    if(!orderInfo) return res.json({ret:false,msg:'order-info is empty'})
    await query_order_is_ok(get_mark_default_root_token(orderInfo.mark),[orderInfo],orderInfo.type)

    //查询user-info
    let results = []
    if(orderInfo.ok_orders && orderInfo.ok_orders.length>0)//&& orderInfo.ok_orders.list)
    {
        let list = orderInfo.ok_orders
        let queryUserApis = []
        for(let i=0;i<list.length;i++)
        {
            let tmpOrderInfo = JSON.parse( JSON.parse( list[i].txjson).extra_data)
            results.push(tmpOrderInfo)
            queryUserApis.push(rpc_api_util.s_query_token_info(USER_API_BASE,tmpOrderInfo.user_id,'assert'))
        }
        let rets = await Promise.all(queryUserApis)
        let successCnt = 0;
        for(let i=0;i<list.length;i++)
        {
            results[i].user_info = rets[i]
            if(res[i]) successCnt++
        }
        orderInfo.ok_orders_origin = orderInfo.ok_orders
        orderInfo.ok_orders = results
        orderInfo.query_user_info_ok = successCnt>0
    }
    
    orderInfo.ret = true
    orderInfo.msg = 'success'
    res.json(orderInfo)
}
/**
 * 从挂单（委托）列表中删除----避免关机重启后进入mem-order-list
 * @param {*} orderInfo 
 * @param {*} type 
 * @returns 
 */
const m_orderLockMap = new Map()
async function delFromMarkOrderList(orderInfo,type='sell')
{
    let order_id = orderInfo.order_id
    let mark_id = get_mark_default_root_token(orderInfo.mark)
    // let xlist = await rpc_api_util.s_query_token_list(MARK_API_BASE,order_id,'relo',0,1,type == 'sell',function(){return false})
    // if(xlist && xlist.length>0) return {ret:false,msg:'order is processed',order_id}

    if(!m_orderLockMap.has(orderInfo.order_id))
    {
        m_orderLockMap.set(orderInfo.order_id,'ok')

        if(orderInfo.del_order_from_api)
        {
            await new Promise((resolve)=>setTimeout(resolve),500)//500ms后再行处理---以便纪录均写入dnalink
            //再次查询，避免处理错误
            let orderInfoRet = await new Promise((resolve)=>{
                rtmarket_c.orderInfo({params:{order_id}},{json:function(data){
                    resolve(data)
                }})
            })
            if(!orderInfoRet || !orderInfoRet.ret) orderInfoRet?orderInfoRet:{ret:false,msg:'query-order-info failed!'}
            if(orderInfoRet.is_canceled) return {ret:false,msg:'order is canceled'}
            if(orderInfoRet.is_processed) return {ret:false,msg:'order is processed'}

            if(orderInfoRet.ok_orders && orderInfoRet.is_processing) //ok_orders.length>0)
            {
                orderInfoRet.del_last_total =  g_rtmarket_num_util.minus( g_rtmarket_num_util.mul( orderInfoRet.number,orderInfoRet.price ), orderInfoRet.processed_total)
            }else{
                orderInfoRet.del_last_total =  g_rtmarket_num_util.mul( orderInfoRet.number,orderInfoRet.price )
            }
            //更新
            orderInfo.del_last_total = orderInfoRet.del_last_total
        }

        let del_flag = await rpc_api_util.s_del_from_token_list(MARK_API_BASE,mark_id,order_id,type=='sell'?'rels':'relb','del order from mark-'+type+'-order-list');
        console.log('delFromMarkOrderList-'+order_id+'-'+del_flag,orderInfo.mark,orderInfo)
        // if(!del_flag)
        // {
        //     return {ret:false,msg:'del-flag:delFromMarkOrderList:false'}
        // }
        if(del_flag)
        {
            let type = orderInfo.type
            let total = g_rtmarket_num_util.toCoinNumNUM(orderInfo.del_last_total) // g_rtmarket_num_util.mul(orderInfo.price ,orderInfo.number) //orderInfo.price * orderInfo.number
            let number= g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.div( orderInfo.del_last_total,orderInfo.price))
            let accountRet = await createUserMarkAccount(orderInfo.user_id,orderInfo.mark)
            let accounPriceRet = await createUserMarkAccount(orderInfo.user_id,g_rtmarket_mark_price)
            let order_extra_data = JSON.stringify(clearOrderInfo(orderInfo))
            if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)//
            let sendRet = await rpc_query(MARK_API_BASE+"/send", type == 'buy' ? {token_x:get_mark_default_root_token(g_rtmarket_mark_price),token_y:accounPriceRet.mark_account_id,opval:total, extra_data:order_extra_data}: {token_x:get_mark_default_root_token(orderInfo.mark),token_y:accountRet.mark_account_id,opval:number, extra_data:order_extra_data})
            if(!sendRet || !sendRet.ret) m_orderLockMap.delete(orderInfo.order_id)
            console.log('delFromMarkOrderList-sendRet:',sendRet)
        }
        return {ret:del_flag,msg:del_flag?'success':'del from mark-order-list failed',mark:orderInfo.mark,order_id}
    }
    return {ret:false,msg:'order_is is locked',orderInfo}
}
/**
 * 用于合并read与在运行队列（特别是sell与buy列表，暂时不涉及到cancel队列）
 * 二阶段提交，这是第二阶段（第一队列无论如何，均可任意提交至read-list等待队列）
 * @param {*} type 
 * @returns 
 */
function mergeOrderList(mark,type='sell')
{
    query_g_rtmarket_list()
    let readyList = g_markListMap.get(mark+':'+type+'-list-ready')
    let list = g_markListMap.get(mark+':'+type+'-list')
    let cancelList = g_markListMap.get(mark+':'+type+'-list-cancel')
    readyList = readyList && readyList.length ? readyList:[]
    list = list && list.length ? list:[]
    cancelList = cancelList && cancelList.length ? cancelList:[]

    list = list.concat(readyList)
    //建立一次循环的hash-map
    let map = new Map()
    for(let k= 0; k<list.length;k++)
    {
        if(map.has(list[k].order_id)) list[k].total = 0 //去重（避免因各种原因引入的，一个order_id出现多次
        else map.set(list[k].order_id,list[k])
    }
    let delCnt = 0
    //删除掉cancelList的列表
    for(let i=0;i<cancelList.length;i++)
    {
        let delInfo = cancelList[i]
        let orderInfo = map.get(delInfo.order_id)
        if(orderInfo && g_rtmarket_num_util.lt(0, g_rtmarket_num_util.toCoinNumNUM( orderInfo.total)))// == g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.mul(orderInfo.number, orderInfo.price)) )
        {
            //从list列表中删除
            orderInfo.del_last_total = orderInfo.total
            orderInfo.total = 0 //代表删除
            delCnt ++
            //从总列表中删除 ---dnalink  markid=sell-list或者markid-buy-list --不等待结果返回，直接处理之
            //let del_flag = rpc_api_util.s_del_from_token_list(MARK_API_BASE,,user_b,'relm','del contact');
            let del_flag = delFromMarkOrderList(orderInfo,type) //真正的清理（可延迟处理）
        }else{
            delInfo.del_order_from_api = true
            let del_flag = delFromMarkOrderList(delInfo,type)
        }
    }
    let retList = []
    if(delCnt >0)
    {
        for(let i=0;i<list.length;i++)
        {
            if(!g_rtmarket_num_util.lt(0, list[i].total)) continue
            retList.push(list[i])
        }
        list = retList
    }
    sort_list(list,type)
    g_markListMap.set(mark+':'+type+'-list-ready',[])//清空
    g_markListMap.set(mark+':'+type+'-list-cancel',[])//清空
    g_markListMap.set(mark+':'+type+'-list',list)//更新（添加了ready队列）
    return list
}
//复制列表，避免被篡改---用于订单处理失败后的恢复
function copyOrderList(list)
{
    if(!list || list.length<=0) return []
    let copyList = []
    for(let i=0;i<list.length;i++) copyList.push(Object.assign({},list[i]))
    return copyList
}
function copyOrderListZ(list)
{
    if(!list || list.length<=0) return []
    let copyList = []
    for(let i=0;i<list.length;i++)
    {
        let info = list[i]
        let tmp = {price:info.price,number:info.number,last_num:g_rtmarket_num_util.div(info.total,info.price),total:info.total}
        copyList.push(tmp)
    } 
    return copyList
}
function compressOrderList(list)
{
    if(!list || list.length<=0) return []
    let map = new Map()
    let retList = []
    for(let i=0;i<list.length;i++)
    {
        let info = list[i]
        if(map.has(""+info.price))//compress-list
        {
            let retInfo = map.get(""+info.price)
            retInfo.total = g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.add(retInfo.total,info.total))
            retInfo.last_num=g_rtmarket_num_util.toCoinNumNUM(g_rtmarket_num_util.div(retInfo.total,info.price))
        }else
        {
            let tmp = {price:info.price,number:info.number,last_num:g_rtmarket_num_util.toCoinNumNUM(g_rtmarket_num_util.div(info.total,info.price)),total:info.total}
            retList.push(tmp)
            map.set(""+info.price,tmp)
        }
    }
    return retList
}
/**
 * 批量处理，自动交易（核心算子，自动凑单与拆单）
 * 凑单：凑销售单-总价sum，目标价buy-total
 * 拆单：sell-order余量，买方buy-order余量
 * 
 * 注意：停机风险、原子操作风险（买卖的时候操作队列）---拆分为买、卖[待合并]队列（buy-list-ready、sell-list-ready）。
 */
const m_rtmarketLockMap = new Map() //确保操作的顺序性和原子性（特别是在await的情况下）
rtmarket_c.autoMarkTrade = autoMarkTrade
function returnTradeRet(mark,ret){ 
    m_rtmarketLockMap.delete(mark)
    return ret
}
async function autoMarkTrade(mark)
{
    try{
    if(m_rtmarketLockMap.get(mark)) {
        console.log('m_rtmarketLockMap is lock-mark:'+mark,m_rtmarketLockMap.get(mark))
        return -1
    }
    m_rtmarketLockMap.set(mark,'lock')

    let buyList = mergeOrderList(mark,'buy')// g_markListMap.get(mark+':buy-list')
    let sellList = mergeOrderList(mark,'sell')//g_markListMap.get(mark+':sell-list')
    let copyBuyList = copyOrderList(buyList)
    let copySellList = copyOrderList(sellList)
    if(!buyList || buyList.length<=0 || !sellList || sellList.length<=0) return returnTradeRet(mark,0)
    let buyOrderInfo = Object.assign({}, buyList[0])
    //价格不匹配
    if(g_rtmarket_num_util.lt(g_rtmarket_num_util.toCoinNumNUM(buyOrderInfo.price) , g_rtmarket_num_util.toCoinNumNUM(sellList[0].price) )) return returnTradeRet(mark,0)
    //最大化数量交易开始（以买方出价为核心）
    //价格匹配，开始以买方角度进行批量购买（价格以卖方为准---因买方是定总价（付出多少钱，买的数量可能超过目标数量）
    //开始凑单----将所有的卖家小于buy-price的全部凑一起，同时计算总价（不超过买单价）
    let selledList = [] , sum = 0 ,cnt =0 
    const  total = g_rtmarket_num_util.toCoinNumNUM( buyOrderInfo.total )  ,price = g_rtmarket_num_util.toCoinNumNUM(buyOrderInfo.price)
    for(let i=0;i<sellList.length;i++)
    {
        if(g_rtmarket_num_util.lt(price, g_rtmarket_num_util.toCoinNumNUM(sellList[i].price) ) )
        {
            //fix the bug ,结束了，但是未清空sell-list的bug
            if(cnt>0)
            {
                let newSellList = sellList.slice(  i , sellList.length)
                newSellList = newSellList &&newSellList.length>0 ? newSellList :[]
                g_markListMap.set(mark+':sell-list',newSellList)
            }
            break
        } 
        // if(sellList[i].total <=0) continue //为0的不进入此计算方列

        cnt ++ 
        //将列表移至已售队列
        selledList.push(sellList[i]) 

        //判断已购买数量，是否超过买方锁定的总价（已锁定金额）
        if(g_rtmarket_num_util.lte(total,g_rtmarket_num_util.toCoinNumNUM(g_rtmarket_num_util.add(sum,sellList[i].total) ) ) )//  sum+sellList[i].total >= total)//拆单操作
        {
            let lastInfo = Object.assign({},sellList[i])
            lastInfo.total = g_rtmarket_num_util.toCoinNumNUM(g_rtmarket_num_util.minus(g_rtmarket_num_util.add(sum,sellList[i].total),total ) )// sum+sellList[i].total - total //余下多少数量
            sellList[i].total = g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.minus(total ,sum) ) //余量---已经放放至selledList列表中
            sum = total
            //新的待售列表
            let newSellList = sellList.slice(  i+1 , sellList.length)
            newSellList = newSellList &&newSellList.length>0 ? newSellList :[]
            if(g_rtmarket_num_util.lt(0,lastInfo.total))
            {
                newSellList = [lastInfo].concat(newSellList)
            }
            g_markListMap.set(mark+':sell-list',newSellList)
            break
        }
        //汇总运算
        sum = g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.add( sum, sellList[i].total ) )
    }
    //判断sum是否与total一致
    let last_total_val =g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.minus(total, sum) )
    if(g_rtmarket_num_util.lt(0,last_total_val) ) //buy-拆单
    {
        buyList[0].total = last_total_val//直接扣除已购买总价sum即可
        g_markListMap.set(mark+':buy-list',buyList)
        console.log('autoMarkTrade-buy-last:',last_total_val,buyList)
        //如未超过
        if(cnt == sellList.length) //sum != total（不在此上处理逻辑中----g_rtmarket_num_util.lte）
        {
            g_markListMap.set(mark+':sell-list',[])
        }
    }else{//一致，不须拆单，直接移出列表
        let newBuyList = buyList.slice(1,buyList.length)
        newBuyList = newBuyList && newBuyList.length>0 ? newBuyList :[]
        g_markListMap.set(mark+':buy-list',newBuyList)
    }

    //去处理已购买订单(可能会超时，或者运算速度比较慢)
    let ret = await autoTradeSelledList(buyOrderInfo,sum,selledList)
    //回退
    if(!ret || !ret.ret){
        g_markListMap.set(mark+':buy-list',copyBuyList)
        g_markListMap.set(mark+':sell-list',copySellList)
        cnt = 0
    }

    //销锁
    m_rtmarketLockMap.delete(mark)

    //不回退
    return cnt
    }catch(ex)
    {
        console.log('autoMarkTrade-exception:'+ex,ex,mark)
        m_rtmarketLockMap.delete(mark)
        return 0
    }
}
/**
 * 批量处理凑单
 * 
 * 买单-卖单关系 relo(ok的意思)1对多，多对多关系
 * 
 * 
 * binlong纪录最后成功的[buy-orderid]以及[sell-order-id]即可！---使用kmmDb即可持久化---然后在关机重启时---恢复buy-sell-list
 * 挂单不能超过1天/1小时/1周-etc（重要---或限制了恢复历史的挂单总数--例如10万条-1万条-100万条等）---这是即时交易市场，不是长期挂单市场（重要特性）*******  影响的是停机恢复列表（重要）
 * @param {*} buyOrderInfo 
 * @param {*} sum 
 * @param {*} selledList 
 */
//方案2
async function autoTradeSelledList(buyOrderInfo,sum,selledList)
{
    if(!buyOrderInfo) return {ret:false,msg:'buyOrderInfo is empty'}
    if(!selledList || selledList.length<=0) return {ret:false,msg:'selledList is empty'}

    let buyUserAccount = await createUserMarkAccount(buyOrderInfo.user_id,buyOrderInfo.mark)

    //方案，顺序处理（1个订单-1个订单[顺序处理]，还是批量处理？顺序处理较案例可靠--可应对停机风险；批量处理【恢复】较为复杂，不能很好应对停机风险）
    //持久化 ---唯一锁（交易纪录锁---相当于是持久化的trade-tx，保存于了mathed-buy-sell-order-list上）
    let bindApis = []
    //持久化的binlog
    // let setBuyRet = await kmmDb.set('rtmarket-buy-order:'+buyOrderInfo.order_id,''+sum)//标识被处理过
    // if(!setBuyRet) return {ret:false,msg:'set rtmarket-buy-order-flag failed'}
    for(let i=0;i<selledList.length;i++)
    {
        //标识被处理过的销售单（如在历史中恢复，则不进入sell-list中）
        // let setSellRet = await kmmDb.set('rtmarket-sell-order:'+selledList[i].order_id,''+selledList[i].total)
        //会保存在token-chain上，所以extra_data也是有用的（类似assert中的extra_data的作用）***是查询交易成功纪录的关键
        bindApis.push(rpc_api_util.s_save_into_token_list(MARK_API_BASE,buyOrderInfo.order_id,selledList[i].order_id,'relo',JSON.stringify(selledList[i])))//''+selledList[i].total
    }
    let rets = await Promise.all(bindApis)
    console.log('autoTradeSelledList-rets:',rets,buyOrderInfo, selledList)

    //全部失败
    let successCnt = 0, need_sum = 0 , sellSendRets = [], lastSellSuccessOrderInfo = null
    for(let i=0;i<rets.length;i++)
    {
        if(rets[i]){
            successCnt++
            // kmmDb.set('rtmarket-sell-order:'+selledList[i].order_id,''+selledList[i].total)
            let sellInfo = Object.assign({}, selledList[i])
            //新增tax-opval的计算，以便获得扣除税之后的数量
            let tmp_total = sellInfo.total
            if(g_mark_settings.has(sellInfo.mark))
            {
                let setting = g_mark_settings.get(sellInfo.mark)
                console.log('mark-tax-setting:',sellInfo.mark,setting)
                sellInfo.origin_total = sellInfo.total
                sellInfo.tax_total = setting.tax_type == 'gas' ? setting.tax : g_rtmarket_num_util.mul( g_rtmarket_num_util.toCoinNumNUM(''+ setting.tax ),g_rtmarket_num_util.toCoinNumNUM(''+sellInfo.total))
                sellInfo.tax_type = setting.tax_type
                sellInfo.tax = setting.tax
                //减去税，才能拿到手
                sellInfo.total = g_rtmarket_num_util.minus( sellInfo.total ,sellInfo.tax_total)
                if(g_rtmarket_num_util.lte(g_rtmarket_num_util.toCoinNumNUM(''+ sellInfo.total) , 0))
                {
                    sellInfo.total = tmp_total
                    sellInfo.tax_total = 0 //重置为0
                }
            }
            
            sellInfo.selled_time_i = Date.now()
            let order_extra_data = JSON.stringify(sellInfo)
            let sellAccount = await createUserMarkAccount(sellInfo.user_id,g_rtmarket_mark_price )//sellInfo.mark)
            if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
            let sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:get_mark_default_root_token(g_rtmarket_mark_price),token_y:sellAccount.mark_account_id,opval:sellInfo.total, extra_data:order_extra_data})
            // let subTaxRet = await rpc_query(MARK_API_BASE+"/send",{token_x:sellAccount.mark_account_id,token_y:sellAccount.mark_account_id,opval:sellInfo.total, extra_data:order_extra_data})
            sellInfo.send_ret = sendRet && sendRet.ret
            sellSendRets.push(sellInfo)
            //if(!sendRet || !sendRet.ret) return res.json({ret: false, msg: "sell-mark send number failed"})
            need_sum = g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.add( need_sum, g_rtmarket_num_util.div(tmp_total,sellInfo.price)) )// 目标mark的数量
            lastSellSuccessOrderInfo = Object.assign({}, selledList[i])
            if(typeof g_rtmarket_sell_order_notify_callback =='function')  g_rtmarket_sell_order_notify_callback(lastSellSuccessOrderInfo)
            //sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:MARK_TOKEN_ROOT,token_y:buyUserAccount.mark_account_id,opval:sellInfo.total, extra_data:order_extra_data})
        }else{
            //退款（买方&卖方均须）
        }
    }
    if(successCnt<=0) 
    {
        //回退（在内存队列继续等待处理）---如果是停机了，因为kmmDb.set的存在，可能会错过，但是可申请恢复订单（自动审核后发放）
        return {ret:false,msg:'bind-ok-match-list failed'}
    }
    //以下是部分成功，纪录则退【$】为核心！---确保必定成功！
    else if(successCnt<rets.length)
    {
        //回滚操作（有非常大的可能，能解绑成功！）
        //收集成功的列表，进行解绑操作（有了处理过的标识，无所谓解绑与否----sell-buy订单列表会进行相应的判断，不超过10万条-不超过1条或1周等）
        //核心还是转账（确保转账成功即可！）---确保转账成功、或退款成功！
        for(let i=0;i<rets.length;i++)
        {
            if(rets[i]) continue
            let info  = selledList[i]
            if(g_rtmarket_num_util.toCoinNumNUM( info.total) == g_rtmarket_num_util.mul(info.price , info.number))//该sellInfo没有部分成功过！
            {
                //移回ready队列
                let list = g_markListMap.get(mark+':sell-list-ready')
                if(!list) {
                    list = []
                    g_markListMap.set(mark+':sell-list-ready',list)
                }
                list.push(info)
            }
        }
    }
    if(successCnt == rets.length) //全部成功
    {
        //从列表中解绑（以便不能重新恢复过来）
        //if(buyOrderInfo.total == sum)  //del_from_list ---从列表中删除（或者不删除，无所谓，因为已经有处理过的标识了）
        //处理转账操作等（核心还是转账）---确保转账成功
    }

    //成功了进行相应的收款（主要是mark对应的number数量--即sum数量）转账！
    let info = Object.assign({},buyOrderInfo)
    info.buy_success_number = need_sum
    info.buy_time_i = Date.now()
    //是否两边扣除？----暂时不做动作
    // if(g_mark_settings.has(info.mark))
    // {
    //     let setting = g_mark_settings.get(info.mark)
    //     info.origin_total0 = info.total
    //     info.origin_total = need_sum
    //     info.tax_total = setting.tax_type == 'gas' ? setting.tax : g_rtmarket_num_util.mul( setting.tax ,info.total)
    //     info.tax_type = setting.tax_type
    //     info.tax = setting.tax
    //     //减去税，才能拿到手
    //     info.total = g_rtmarket_num_util.minus( need_sum,info.tax_total)
    //     if(g_rtmarket_num_util.lte(info.opval , 0))
    //     {
    //         info.total = info.origin_total
    //         info.tax_total = 0 //重置为0
    //     }
    // }
    
    let order_extra_data = JSON.stringify(info)
    if(typeof g_rpcReactionFilterMapAdd == 'function') g_rpcReactionFilterMapAdd(order_extra_data)
    let sendRet = await rpc_query(MARK_API_BASE+"/send",{token_x:get_mark_default_root_token(info.mark),token_y:buyUserAccount.mark_account_id,opval:need_sum, extra_data:order_extra_data})
    info.send_ret = sendRet && sendRet.ret

    //更新mark对应的dst_token的最新报价
    let updatePriceRet = false
    if(lastSellSuccessOrderInfo)
    {
        updatePriceRet = await rpc_api_util.s_save_into_token_list(MARK_API_BASE,get_mark_default_root_token(buyOrderInfo.mark),lastSellSuccessOrderInfo.order_id,'relp',JSON.stringify(lastSellSuccessOrderInfo))//标的是total/price = number（可见数量）
        if(!updatePriceRet) console.log('update-mark-price failed!  lastSellSuccessOrderInfo:',lastSellSuccessOrderInfo)
        sendMarkChannelMsg({price:lastSellSuccessOrderInfo.price,total:lastSellSuccessOrderInfo.total,mark:lastSellSuccessOrderInfo.mark,order_id:lastSellSuccessOrderInfo.order_id},'realtime_price')
        if(typeof g_rtmarket_buy_order_notify_callback =='function')  g_rtmarket_buy_order_notify_callback(buyOrderInfo)
    }

    return {ret:true,msg:'success',buy_order_ret:info,sell_order_rets:sellSendRets,price_update_ret:updatePriceRet}
}
//方案1（是否采用binlog方式来进行----以内存为核心（则选择方案2--速度更快，避免复杂性导致崩溃），不以mark-id的订单列表为核心---主要是恢复困难--合并与查询等均困难！）
//如交易失败，则退回部分钱或代币给用户即可！（确保100%实现交易的速度）----***
async function autoTradeSelledListBak1(buyOrderInfo,sum,selledList)
{
    if(!buyOrderInfo) return {ret:false,msg:'buyOrderInfo is empty'}
    if(!selledList || selledList.length<=0) return {ret:false,msg:'selledList is empty'}

    //采用方案1，顺序处理（1个订单-1个订单[顺序处理]，还是批量处理？顺序处理较案例可靠--可应对停机风险；批量处理【恢复】较为复杂，不能很好应对停机风险）
    //先处理第一个selledList订单，再处理第2个，第三个，直接处理完，如果处理至第n个时失败，则回退部分的sell-list

}
/**
 * 自动化交易
 */
rtmarket_c.autoTrade = autoTrade
async function autoTrade()
{
    let pCnt = 30
    while(true)
    {
        let marks = typeof g_mark_list !='undefined' ? g_mark_list:[]
        let trades = []
        for(let i=0;i<marks.length;i++)
        {
            trades.push(autoMarkTrade(marks[i]))
        }
        let tradeRets = await Promise.all(trades)
        // console.log('tradeRets:',tradeRets)
        if(!trades || trades.length<=0 ) await new Promise((res)=>setTimeout(res,10)) //如无，则等待10秒
        let cnt = 0;
        for(let i=0;i<tradeRets.length;i++)
        {
            cnt+=tradeRets[i]>0 ? tradeRets[i] :0
        }
        if( (pCnt--) <=0)
        {
            console.log('autoTrade:cnt:',cnt)
            pCnt = 30
        }
        if(cnt>0) await new Promise((res)=>setTimeout(res,1))
        else await new Promise((res)=>setTimeout(res,100))//0.5秒轮询一次（如无成功纪录）
    }
}


function push2readyList(mark,addlist,type='sell')
{
    query_g_rtmarket_list()
    let list = g_markListMap.get(mark+':'+type+'-list-ready')
    if(!list) {
        list = []
        g_markListMap.set(mark+':'+type+'-list-ready',list)
    }
    list = list.concat(addlist)
    g_markListMap.set(mark+':'+type+'-list-ready',list)
}
function clearOrderInfo(info)
{
    if(!info) return info
    info = Object.assign({},info)
    delete info.is_processing
    delete info.is_processed
    delete info.is_canceled
    delete info.processed_total
    delete info.del_order_from_api
    delete info.ok_orders
    delete info.ok_orders_origin
    return info
}
/**
 * 由mark对应的sell或buy列表中恢复至内存（按时间过滤、按总长度10000进行过滤）
 * @param {*} mark 
 * @param {*} type 
 * @returns 
 */
rtmarket_c.loadMarkReadyListFromDNALink = loadMarkReadyListFromDNALink
async function loadMarkReadyListFromDNALink(mark,type='sell')
{
    console.log('into loadMarkReadyListFromDNALink:',mark)
    if(!mark) return -1
    let map = new Map()
    let mark_id = get_mark_default_root_token(mark)
    let expire_time = 60*60*24 *10 //10天超期

    let result = [] , now_time = parseInt(Date.now()/1000)
    let infoQs = []
    let list = await rpc_api_util.s_query_token_list(MARK_API_BASE,mark_id,'rel'+(type=='sell'?'s':'b'),0,1000,false)
    if(!list ||list.length<=0) return console.log('loadMarkReadyListFromDNALink-list is empty!',mark,type)
    await query_order_is_ok(mark_id,list,type)//查询ok-orders
    // console.log('loadMarkReadyListFromDNALink-list:',list,type,mark)
    // for(let i=0;list &&i< list.length;i++)
    // {
    //     if(!list[i] ||  !list[i].token_y) continue
    //     if(list[i].create_time_i + expire_time <= now_time) break

    //     //查询的是buy-sell-match-list（relo）
    //     let dealedList = await rpc_api_util.s_query_token_list(MARK_API_BASE,list[i].token_y,'relo',0,1,type == 'sell',function(){return false})// kmmDb.get('rtmarket-'+type+'-order:'+list[i].token_y)
    //     if(dealedList && dealedList.length>=1) continue

    //     // result.push( list[i].token_y)
    //     infoQs.push(rpc_api_util.s_query_token_info(MARK_API_BASE,list[i].token_y,'assert'))
    // }

    // if(infoQs.length<=0) return 0

    // //查询orderInfo以保存
    // console.log('loadMarkReadyListFromDNALink-infoQs:',infoQs)
    // let rets = await Promise.all(infoQs)
    // if(rets)
    // for(let i=0;i<rets.length;i++){
    //     if(rets[i]) result.push(rets[i])
    // }
    for(let i=0;i<list.length;i++)
    {
        let info = list[i]
        if(!info.ok_orders) result.push(info)
        //清理掉不用的数据
        if(info.ok_orders && info.is_processing)
        {
            info.total = g_rtmarket_num_util.toCoinNumNUM( g_rtmarket_num_util.minus(info.total,info.processed_total) )
            result.push(clearOrderInfo(info))
        }
    }
    push2readyList(mark,result,type)
    return result.length
}

async function recoverOrderList()
{
    while(!window.g_loginDtnsAndForklist_started) await new Promise((res)=>setTimeout(res,1000))//30s后开始处理
    await new Promise((res)=>setTimeout(res,5000))//依旧等待20s之后运行
    let marks = typeof g_mark_list !='undefined' ? g_mark_list:[]
    if(!marks || marks.length<=0) return false
    let results = []
    for(let i=0;i<marks.length;i++)
    {
        let mark = marks[i]
        console.log('recoverOrderList:'+mark,'now!')
        let sellOrderRecoverRet = await loadMarkReadyListFromDNALink(mark,'sell')
        let buyOrderRecoverRet = await loadMarkReadyListFromDNALink(mark,'buy')
        console.log('recoverOrderList:'+mark,sellOrderRecoverRet,buyOrderRecoverRet)
        results.push({sellOrderRecoverRet,buyOrderRecoverRet,mark})
    }
    return results
}
/**
 * 查询当前价格
 */
rtmarket_c.priceMark = priceMark
async function priceMark(req,res)
{
    let {mark} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    let token = get_mark_default_root_token(mark)

    let ret = await rpc_query(MARK_API_BASE+'/chain/opcode',{token,opcode:'relp',begin:0,len:1})
    if(!ret ||!ret.ret ||!ret.list || ret.list.length<=0) return res.json({ret:false,msg:'price-list is empty',price:0})

    let lastSellInfo =  null;
    let list = ret.list
    try{
        lastSellInfo = JSON.parse(JSON.parse(list[0].txjson).extra_data)
    }catch(ex)
    {
        console.log('priceMark-exception:'+ex,ex,list[0])
        return res.json({ret:false,msg:'parse last-sell-order-info failed',price:0})
    }

    return res.json({ret:true,msg:'success',price:lastSellInfo.price,last_sell_order_info:lastSellInfo})
}
/**
 * 查询历史成交价格（最新价）
 */
rtmarket_c.priceListMark = priceListMark
async function priceListMark(req,res)
{
    let {mark,begin,len} = str_filter.get_req_data(req)
    if(!validateMarkID(mark)) return res.json({ret:false,msg:'param mark is error'})
    if(!isFinite(begin)) return res.json({ret:false,msg:'param begin is error'})
    if(!isFinite(len)) return res.json({ret:false,msg:'param len is error'})

    let token = get_mark_default_root_token(mark)
    let ret = await rpc_query(MARK_API_BASE+'/chain/opcode',{token,opcode:'relp',begin,len})

    if(!ret ||!ret.ret ||!ret.list || ret.list.length<=0) return res.json({ret:false,msg:'list is empty'})

    let list = ret.list
    let results = []
    for(let i=0;i<list.length;i++)
    {
        try{
            results.push( JSON.parse(JSON.parse(list[i].txjson).extra_data))
        }catch(ex)
        {
            console.log('priceListMark-exception:'+ex,ex,list[i])
        }
    }
    return res.json({ret:true,msg:'success',prices:results})
}

