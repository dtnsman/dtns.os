window.rtshopping_c = {}
// const rtshopping_c_token_name = OBJ_TOKEN_NAME
// const rtshopping_c_api_base   = OBJ_API_BASE
// const rtshopping_c_token_root = OBJ_TOKEN_ROOT

const rtshoppingCodesMap = new Map()
const rtshopping_channel_system_user_id = 'rtshopping-system-default-user'
const rtshopping_channel_name = 'rtshopping-channel'
const rtshopping_channel_notify_user_info = 'user_info'
const rtshopping_channel_notify_code = 'code'
const rtshopping_channel_notify_code_matched = 'code_matched'

rtshopping_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtshopping/send',urlParser,session_filter,rtshopping_c.send)//发送后，在系统保留10-60s，以待对方pick起来！

    if(true)
    {
        while(!window.rpcHost) await new Promise((res)=>setTimeout(res,200))
        await new Promise((res)=>setTimeout(res,10000))

        let initRTShoppingChannelFlag = await creatRTShoppingChannel()
        console.log('initRTShoppingChannelFlag:',initRTShoppingChannelFlag)

        // autoSendCode()
        if(typeof g_node_side_event_bus!='undefined')
        {
            g_node_side_event_bus.on('rt_shopping_sell_event',function(data){
                console.log('rt_shopping_sell_event:',data)
                if(!data ||!data.cnt ||!data.mark) return false;
                autoSendCode(data)
            })
        }
    }
}
//重点考虑，是否使用多重安全签名和aes256加密机制？
rtshopping_c.send = rtshopping_send
async function rtshopping_send(req,res)
{
    let {user_id,code} = str_filter.get_req_data(req)
    if(!code) return res.json({ret:false,msg:'code is error'})
    code = (''+code).toLowerCase()
    
    //unmatch  clear the success_cnt
    if(!rtshoppingCodesMap.has(code))
    {
        return res.json({ret:false,msg:'code unmatch!'})
    } 

    let {codeid,mark} = rtshoppingCodesMap.get(code)
    rtshoppingCodesMap.delete(code) //删除掉这个code

    let ret = await new Promise((res)=>
    {
        rtstandard_c.buy({params:{mark,number:1,user_id},peer:{send:recvRTShoppingOrderChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    if(ret && ret.ret)
    {
        rtshoppingCodesMap.set(ret.order_id,{user_id,codeid})
        res.json({ret:true,msg:'success'})
    } 
    else res.json({ret:false,msg:'buy-order failed! msg:'+(ret ?ret.msg:'未知网络原因')})
}

async function autoSendCode(data)
{
    if(!data||!data.markInfo) return -1
    let {mark,cnt,markInfo} = data
    let iCnt = cnt
    while(iCnt>0)
    {
        //智能判断peers数量,是否超过1,如未超过1,则不生成code以及发送code,避免影响性能!
        let peers = typeof g_rt_channel_peers != 'undefined' ? g_rt_channel_peers.get(rtshopping_channel_name) :[]
        if(!peers || peers.length<2){
            await new Promise((resolve)=>setTimeout(resolve,500))
            // console.log('autoSendCode:peers:cnt:',peers ? peers.length:0)
            break
        }
        
        let ret = await g_axios.get('http://captcha.dtns.top/q')
        if(typeof Buffer == 'undefined') ret = ret ? ret.data :ret
        let code = (''+ret.text).toLowerCase()
        if(rtshoppingCodesMap.has(code)) continue
        const codeid = sign_util.newTXID().replace('txid_','rtshopping_')
        rtshoppingCodesMap.set(code,{codeid,mark,cnt,iCnt,std_price:markInfo.std_price,name:markInfo.name})
        sendRTShoppingChannelMsg({data:ret.data,code:'***',codeid,mark,cnt,iCnt,markInfo},rtshopping_channel_notify_code)
        setTimeout(()=>rtshoppingCodesMap.delete(code),60*1000)//60秒之后,自动清理
        await new Promise((resolve)=>setTimeout(resolve,3000))//3秒1个
        console.log('autoSendCode:code:'+code)
        iCnt--
    }
    return iCnt
}
async function recvRTShoppingClientUserChannelMsg(data)
{

}
async function recvRTShoppingOrderChannelMsg(data)
{
    // console.log('recvRTShoppingOrderChannelMsg:',data)
    try{
        data = JSON.parse(data)
    }catch(ex){
        console.log('recvRTShoppingOrderChannelMsg-ex:'+ex,ex,data)
    }
    if(!data ||!data.channel ||!data.notify_type ||!data.xobj) return false
    let xobj = data.xobj

    if(data.channel.startsWith('rtstandard-channel:'))
    {
        if(data.notify_type == 'buy-order' && rtshoppingCodesMap.has(xobj.order_id))
        {
            let {user_id,codeid} = rtshoppingCodesMap.get(xobj.order_id)
            rtshoppingCodesMap.delete(xobj.order_id)
            sendRTShoppingChannelMsg({codeid,msg:'code matched',user_id},rtshopping_channel_notify_code_matched)
        }
    }
}

async function creatRTShoppingChannel()
{
    let user_id = rtshopping_channel_system_user_id
    let channel = rtshopping_channel_name
    let ret = await new Promise((res)=>
    {
        rtchannel_c.create({params:{channel,user_id,allow_send_users:user_id},peer:{send:recvRTShoppingClientUserChannelMsg}},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTShoppingChannel-ret:',ret)
    // if(!ret || !ret.ret) return false
    ret = await new Promise((res)=>
    {
        rtchannel_c.focus({params:{channel,user_id},peer:{
            send:recvRTShoppingClientUserChannelMsg
        }},{json:function(data){
            res(data)
        }})
    })
    console.log('creatRTShoppingChannel-focus:',ret)
    if(!ret || !ret.ret) return false
    let setAllowSendUsersRet = await sendRTShoppingChannelMsg(user_id,'allow_send_users')
    console.log('setAllowSendUsersRet:',setAllowSendUsersRet)
    return true
}

async function sendRTShoppingChannelMsg(xobj,notify_type = 'rtshopping')
{
    let user_id = rtshopping_channel_system_user_id
    let channel = rtshopping_channel_name
    xobj = !xobj ? {}:xobj
    let ret = await new Promise((res)=>
    {
        rtchannel_c.send({params:{user_id,channel,xobj:JSON.stringify(xobj),notify_type}},{json:function(data){
            res(data)
        }})
    })
    console.log('sendRTShoppingChannelMsg-ret:',ret)
    return ret
}



