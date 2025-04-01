/**
 * 2023.4.6
 * 将browser浏览器版本改为node.js版本的文件（static）。
 * @type {*|exports}
 */
globalThis.window = globalThis

window.crypto = require('crypto')
const eccryptoJS =  require('eccrypto-js')
window.eccryptoJS = eccryptoJS
const bs58 = require(`bs58`);
window.bs58 = bs58
const BigNumber = require('bignumber.js');
window.BigNumber = BigNumber

const JSZip = require(`jszip`);
window.JSZip = JSZip

require('./static/SQLDB')


const str_filter = require('./libs/str_filter')
window.str_filter = str_filter

const http_req = require('./libs/http_request')
window.http_req = http_req
require('./static/key_util_eccryptojs')
console.log('key_util',key_util)
require('./static/sign_util')
console.log('sign_util',sign_util)
window.groupchat_c = null

// require('./config_roomid.js')
const c_setting = require('./setting/c.json')
//遍历并设置
for(key in c_setting)
{
    window[key] = c_setting[key]
}

let dnalink_setting = require('./setting/gsb.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/msg.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/score.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/vip.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/obj.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/user.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/rmb.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]
dnalink_setting = require('./setting/order.json')
for(key in dnalink_setting) window[key] = dnalink_setting[key]

async function queryUrls()
{
    let tnsUrls = await
    http_req.http_get( typeof g_tns_nslookup_url!='undefined' ? g_tns_nslookup_url : 'https://static.dtns.top/tns-urls.json')//?timestamp='+time_x+'&sign='+encodeURIComponent(time_sign_base64), )
    window.g_tns_urls = tnsUrls ? (tnsUrls.data ? tnsUrls.data :tnsUrls) :null

    let turnUrls = await
    http_req.http_get( typeof g_turn_nslookup_url!='undefined' ? g_turn_nslookup_url : 'https://static.dtns.top/turn-urls.json')//?timestamp='+time_x+'&sign='+encodeURIComponent(time_sign_base64), 
    window.g_turn_urls = turnUrls ? (turnUrls.data ? turnUrls.data :turnUrls) :null

    let staticDtnsNetworkUrls = await
    http_req.http_get( typeof g_static_dtns_network_nslookup_url!='undefined' ? g_static_dtns_network_nslookup_url : 'https://static.dtns.top/static-dtns-network.json')//?timestamp='+time_x+'&sign='+encodeURIComponent(time_sign_base64), 
    window.g_dtns_nslookup_static_urls = staticDtnsNetworkUrls && staticDtnsNetworkUrls.data ? staticDtnsNetworkUrls.data:staticDtnsNetworkUrls

    console.log('g_tns_urls:',g_tns_urls,'g_turn_urls:',g_turn_urls,'g_dtns_nslookup_static_urls:',g_dtns_nslookup_static_urls)
}

async function main_now(){

await queryUrls()

require('./dlibs/ifiledb')
window.ifileDb = new IFileIndexDB()
require('./dlibs/localstorage')

require('./static/dnalink_api_util')
require('./static/dnalink_dao_chain')
require('./static/dnalink_dao_wallet')
require('./static/dnalink_engine')
require('./static/dnalink_protocol')
require('./static/dnalink_rpc')
require('./static/dnalink_rtc_client')
require('./static/dnalink_rtc_service')
require('./static/dnalink_super_file')
require('./static/dnalink_super_meta')
require('./static/dnalink_super_websocket')
require('./static/SQLDB')
// require('./static/dtns/dtns-score')
let dtns_dnalink_setting = require('./setting/dtns.json')
for(key in dtns_dnalink_setting) window[key] = dtns_dnalink_setting[key]
require('./static/dtns_all')

const config = require('./config').config;
window.config = config
config.runtime_current_dir = __dirname
//引入重新定义的forklist_c.js
require('./controller/forklist_c')
require('./controller/fork_order_c')
require('./controller/forklist_pay_c')

const routes = require('./routes');
require('./rpc_api_config')
require('./rpc_api_util')
console.log('window-rpc_query:',typeof rpc_query,typeof window.rpc_query)

require('./static/lx/middleware/common_interceptor')
require('./static/lx/controller/mc_logos.js')
require('./static/lx/controller/fengjing_imgs.js')
require('./static/lx/controller/address_c.js')
require('./static/lx/controller/cashout_c.js')
require('./static/lx/controller/classify_c.js')
require('./static/lx/controller/console_c.js')
require('./static/lx/controller/customer_c.js')
require('./static/lx/controller/fapiao_c.js')
require('./static/lx/controller/feedback_c.js')
require('./static/lx/controller/file_c.js')
require('./static/lx/controller/groupchat_c.js')
// <!-- require('./static/lx/controller/groupchat_live_c.js') -->
require('./static/lx/controller/gsbshop_c.js')
require('./static/lx/controller/manager_c.js')
require('./static/lx/controller/menu_c.js')
require('./static/lx/controller/obj_c.js')
require('./static/lx/controller/order_c.js')
require('./static/lx/controller/post_c.js')
require('./static/lx/controller/product_c.js')
// <!-- require('./static/lx/controller/pusher_c.js') -->
// <!-- require('./static/lx/controller/qrcode_c.js') -->
require('./static/lx/controller/shop_c.js')
require('./static/lx/controller/shopping_c.js')
require('./static/lx/controller/srcshop_c.js')
require('./static/lx/controller/store_c.js')
require('./static/lx/controller/user_c.js')
// <!-- require('./static/lx/controller/user_weixin_c.js') -->
require('./plugins/index.js')
require('./plugins/loadPlugins.js')
require('./static/lx/routes/index.js')
//------lx-dnalink.node-----------------//
//------lx-dnalink.node-----------------//
// require('./static/lx/lx_gsb_59872')
// require('./static/lx/lx_msg_59876')
// // require('./static/lx/lx_obj_59875')
// // require('./static/lx/lx_order_59871')
// // require('./static/lx/lx_rmb_59874')
// require('./static/lx/lx_score_59873')
// // require('./static/lx/lx_user_59877')
// require('./static/lx/lx_vip_59870')
// require('./static/lx/lx-obj')
// require('./static/lx/lx-user')
// require('./static/lx/lx-rmb')
// require('./static/lx/lx-order')
require('./static/lx_all')

require('./static/DTNSManager')
require('./dlibs/RPCHost')
require('./dlibs/RPCClient')


// //配置积分合约的名称、符号、汇率agio等
// window.g_score_setting = {
//     openflag:true,//是否启用
//     name:'',symbol:'$',emoji:'',logo:'',agio:100,//agio是1RMB->agio-$
//     web3app_token:dtns_root_keys.token,//fxradio
// }

global.ErrorLog = require('./libs/ErrorLog');

const defaultRTC = new RTCService(defaultRTCRoomID)
window.defaultRTC = defaultRTC

let time_i = Date.now()
var time_hash = sign_util.getInnerMsgSign(''+time_i, g_dtns_network_hmac_key)// CryptoJS.HmacSHA256(''+time_i, g_dtns_network_hmac_key);
var time_sign_base64 = time_hash//time_hash.toString(CryptoJS.enc.Base64)
console.log('time_sign_base64:',time_sign_base64,time_i)

if(defaultRTCRoomID=='dtns')
{
    //连接的是公网（包含可同步文件等完全的rtc-service）
    window.g_defaultDTNSRTCArray =  [] //defaultDTNSRTC
    if(typeof g_tns_urls!='undefined')
    for(let i=0;i<g_tns_urls.length;i++)
    {
        const defaultDTNSRTC = new RTCService('dtns.network|host|'+time_i+'|'+time_sign_base64+'|',g_tns_urls[i],null,false)
        g_defaultDTNSRTCArray.push(defaultDTNSRTC)
    }
    console.log('dtns.network-defaultDTNSRTCArray:',g_defaultDTNSRTCArray)
}

window.g_axios = {get:async function(url,options){
    return http_req.http_get(url,options ? options.params: {})
}}
const dtnsManager = new DTNSManager()
window.g_dtnsManager = dtnsManager
console.log('ok-g_dtnsManager:',g_dtnsManager)
window.g_loginDtnsAndForklist = loginDtnsAndForklist
window.g_loginDtnsAndForklist_started = false

const rpc_client = new RPCClient(defaultRTCRoomID,null,null,1)
window.rpc_client = rpc_client
//groupchat_c.js
rpc_client.setPeerRefreshCallback(function(){
    groupchat_c.wait()
    // wait()
    // loginDtnsAndForklist()
})

lx_main()

if(defaultRTCRoomID=='dtns')
{
    window.dtns_root_keys = undefined
    delete window.dtns_root_keys
    window.g_dtns_network_client = undefined
    delete window.g_dtns_network_client

    //启动dtns_all
    dtns_main(defaultRTCRoomID)
    //me:  app.js
    // let time_i = Date.now()
    // var time_hash = CryptoJS.HmacSHA256(''+time_i, 'GhFyf9JhRp5Pi3JuUfjLG');
    // var time_sign_base64 = time_hash.toString(CryptoJS.enc.Base64)
    // console.log('time_sign_base64:',time_sign_base64,time_i)
    const rpcDTNSInnerHost = new RTCHost();//new RTCHost('dtns-inner-room|host|'+time_i+'|'+time_sign_base64+'|')
    routes(rpcDTNSInnerHost)
    lx_routes(rpcDTNSInnerHost)
    rpcDTNSInnerHost.setChatC(groupchat_c)
    window.rpcDTNSInnerHost = rpcDTNSInnerHost

    //rpcDTNSInnerHost连接成功后，再设置rpcHost（因为这个依赖于此）
    // rpcDTNSInnerHost.setPeerRefreshCallback(function()
    {
        // const rpcHost = new RTCHost(defaultRTCRoomID)
        // routes(rpcHost)
        // rpcHost.setChatC(groupchat_c)
        // window.rpcHost = rpcHost
        window.g_rpcHostArray =  [] 
        if(typeof g_tns_urls!='undefined')
        for(let i=0;i<g_tns_urls.length;i++)
        {
            const rpcHost = new RTCHost(defaultRTCRoomID,g_tns_urls[i])
            routes(rpcHost)
            lx_routes(rpcHost)
            rpcHost.setChatC(groupchat_c)
            g_rpcHostArray.push(rpcHost)
            window.rpcHost = rpcHost
        }
        console.log('dtns-g_rpcHostArray:',g_rpcHostArray)


        //用于内部连接用（http请求当前的rpcHost服务）
        const http_client = new RPCClient(defaultRTCRoomID,null,null,1)
        window.http_client = http_client    

        console.log('into rpcDTNSInnerHost-peerRefreshCallback and call loginDtnsAndForklist()')
        loginDtnsAndForklist()
    }
    //) //end of rpcDTNSInnerHost.setPeerRefreshCallback(function()
}else
{
    dtns_main('dtns.network')    

    // const rpcHost = new RTCHost(defaultRTCRoomID)
    // rpcHost.setChatC(groupchat_c)
    // routes(rpcHost)
    // lx_routes(rpcHost)
    // window.rpcHost = rpcHost
    // setTimeout(()=>
    if(true){
        window.g_rpcHostArray =  [] 
        let len = typeof g_rpc_host_muti_flag !='undefined' && g_rpc_host_muti_flag  ? g_tns_urls.length :1
        if(typeof g_tns_urls!='undefined')
        for(let i=0;i<len;i++)
        {
            let roomid = window.g_dev_roomid ? window.g_dev_roomid: defaultRTCRoomID
            const rpcHost = new RTCHost(roomid,g_tns_urls[i])
            routes(rpcHost)
            lx_routes(rpcHost)
            rpcHost.setChatC(groupchat_c)
            g_rpcHostArray.push(rpcHost)
            window.rpcHost = rpcHost
        }
        console.log('dtns-g_rpcHostArray:',g_rpcHostArray)
    }
    // },60000)   
}


async function loginDtnsAndForklist()
{
    console.log('into loginDtnsAndForklist:',defaultRTCRoomID)
    if(defaultRTCRoomID=='nftlist')
        return ;

    //---------rpchost 在登录dtns.network之后再打开 
    if(false){
    window.g_rpcHostArray =  [] 
    let len = typeof g_rpc_host_muti_flag !='undefined' && g_rpc_host_muti_flag  ? g_tns_urls.length :1
    if(typeof g_tns_urls!='undefined')
    for(let i=0;i<len;i++)
    {
        const rpcHost = new RTCHost(defaultRTCRoomID,g_tns_urls[i])
        routes(rpcHost)
        lx_routes(rpcHost)
        rpcHost.setChatC(groupchat_c)
        g_rpcHostArray.push(rpcHost)
        window.rpcHost = rpcHost
    }
    console.log('dtns-g_rpcHostArray:',g_rpcHostArray)
    }
    //-----------------------------------------------------

    window.g_loginDtnsAndForklist_started = true
    console.log('ok2-g_dtnsManager:',g_dtnsManager)

    if(typeof dtns_network_rtc_api!='undefined' && false)
    {
        let sendRet = await dtns_network_rtc_api.rpc_query('/send',{appid:10001,secret_key:'*****',token_x:'dtns_00000000000000000000000000000000',token_y:'dtns_ld000intE77kDQiKv9VyP2FbKtKKayRM',opval:100,extra_data:'init int-score'})
        console.log('dtns_network_rtc_api-init-int-score-sendRet:',sendRet)
    }
    

    // let roomId = 'web3:'+that.roomId+'|'+ parseInt(Date.now()/1000)
    // console.log('web3-roomid:',roomId)
    // let hash = await key_util.hashVal(roomId)
    // let sign = await key_util.signMsg(hash,that.mywallet.private_key)
    // that.client.discover(roomId+'|'+sign)

    if(typeof g_forklist_user=='undefined' || window.g_dev_roomid) return //2024-6-5新增window.g_dev_roomid的判断
    let forklist_user =  g_forklist_user
    
    let dtns_roomid = 'dtns'
    let dtns_roomid_m = 'web3:'+dtns_roomid+'|'+ parseInt(Date.now()/1000)
    console.log('dtns_roomid_m:',dtns_roomid_m)
    let hash = await key_util.hashVal(dtns_roomid_m)
    let sign = await key_util.signMsg(hash,forklist_user.private_key)
    let dtns_protocol_roomid = dtns_roomid_m+'|'+sign +'|'+forklist_user.token
    let dtns_p_client = new RTCClient(dtns_protocol_roomid,null,null,false)
    dtns_p_client.origin_roomid = dtns_roomid
    let addFlag =false
    if(typeof g_dtnsManager!='undefined') addFlag = g_dtnsManager.addRPCClient(dtns_p_client)
    console.log('add-dtns-client:',addFlag)

    let forklist_roomid = 'nftlist'
    let roomid = 'web3:'+ forklist_roomid+'|'+ parseInt(Date.now()/1000)
    console.log('forklist_roomid:',roomid)
    hash = await key_util.hashVal(roomid)
    sign = await key_util.signMsg(hash,forklist_user.private_key)
    let protocol_roomid = roomid+'|'+sign+'|'+forklist_user.token
    let p_client = new RTCClient(protocol_roomid,null,null,false)
    p_client.origin_roomid = forklist_roomid
    if(typeof g_dtnsManager!='undefined') addFlag= g_dtnsManager.addRPCClient(p_client)
    console.log('add-ld-client:',addFlag)

    await dtns_p_client.sleep(3000)

    let web3name = 'dtns'
    let timestamp = parseInt( Date.now()/1000)
    hash = await key_util.hashVal(web3name+':'+timestamp)
    sign = await key_util.signMsg(hash,forklist_user.private_key) //使用的是dtns-device-id设备id的密钥

    let ret = await g_dtnsManager.run('dtns://web3:dtns/user/device/login',{timestamp,web3name,sign})
    console.log(web3name+'-/user/device/login--ret:'+JSON.stringify(ret))

    // if(!ret || !ret.ret) return 

    web3name = 'nftlist'
    timestamp = parseInt( Date.now()/1000)
    hash = await key_util.hashVal(web3name+':'+timestamp)
    sign = await key_util.signMsg(hash,forklist_user.private_key) //使用的是dtns-device-id设备id的密钥

    ret = await g_dtnsManager.run('dtns://web3:'+web3name+'/user/device/login',{timestamp,web3name,sign})
    console.log(web3name+'-/user/device/login--ret:'+JSON.stringify(ret))

    if(!ret || !ret.ret) return 
    window.g_forklist_user_session = ret

    ret = await g_dtnsManager.run('dtns://web3:'+web3name+'/forklist/pay/channel',{web3name:defaultRTCRoomID})
    console.log(web3name+'-/forklist/pay/channel--ret:'+JSON.stringify(ret))

    //启动dtns的消息接收器
    // dchatManager.initWebSocket(web3name)

    // let dtns_private_key = forklist_user.private_key

    // //不再自动化创建新设备（并绑定）2023-3-29
    // // if(true) return 

    // let user_id = ret.user_id
    // let s_id = ret.s_id
    // let deviceInfo = 'nodejs-desktop' +
    //         '('+ (Math.floor(new Date().getTime()/1000)).toString(36) +')'
    // let keyPair = eccryptoJS.generateKeyPair()
    // console.log('dtnsManager-connect->keyPair:',keyPair)
    // let private_key = bs58.encode( keyPair.privateKey)
    // let public_key = bs58.encode( eccryptoJS.getPublicCompressed(keyPair.privateKey))
    // const msg = deviceInfo//await key_util.hashVal(deviceInfo) //eccryptoJS.utf8ToBuffer(deviceInfo);
    // hash =  await key_util.hashVal(deviceInfo) //await eccryptoJS.sha256(msg)
    // sign = await key_util.signMsg(hash,private_key) //bs58.encode( await eccryptoJS.sign(keyPair.privateKey,hash,true))
    // let sign2 =  await key_util.signMsg(hash,forklist_user.private_key)// bs58.encode( await eccryptoJS.sign( bs58.decode(dtns_private_key),hash,true))

    // let splitStr = '|'
    // let copyData = splitStr+sign+splitStr
    //     +public_key.substring(public_key.length-4,public_key.length)
    //     +splitStr+deviceInfo+splitStr+rpc_client.roomid+splitStr
    // console.log('dtnsClient-connect-copyData:'+copyData)

    // // phoneHash,deviceName,sign,phoneEnInfo,public_key,web3name,invite_code
    // ret = await g_dtnsManager.run('dtns://web3:dtns/user/device/bind',
    //     {deviceName: deviceInfo ,public_key:public_key,web3name:'ld',sign:sign,sign2:sign2,user_id,s_id})
    // console.log('forklist-/user/device/bind--ret:'+JSON.stringify(ret))

    // if(ret && ret.ret){
    //     window.g_forklist_private_key = private_key
    //     window.g_forklist_public_key = public_key
    //     window.g_forklist_session = ret
    //     console.log('g_forklist_session:',g_forklist_session)
    // }
}
// const dchatManager = new  DChatManager(dtnsManager)
// window.g_dchatManager = dchatManager


//2024-12-20--如有测试端口dev-port，并保持http-api连接（采用dtns-api将更安全-并且可实现poplang分布式智体编程）
if(window.g_dev_port)
{
    try{
        const express = require('express');
        const app = express();
        const cors = require('cors');
        app.use(cors());

        // const bodyParser = require('body-parser');
        // app.use(bodyParser.urlencoded({ extended: false }));
        // app.use(bodyParser.json());

        app.use(express.static('dist'))
        app.use('/h5',express.static('h5'))

        // app.use(express.static('public'))

        // 路由
        // app.setChatC = true //兼容rpcHost的.setChatC
        routes(app);
        lx_routes(app)
        app.listen(g_dev_port, () => {
            console.log("You can debug your app with http://" + config.host + ':' + config.port);
        });
    }catch(ex){
        console.log('into express-listen:ex:'+ex,ex)
        process.exit(1)
    }

}
global.error_log = ErrorLog;


//错误处理
process.on('uncaughtException', function(err) {
    console.error(err);
    console.error(err.stack);
    let str = ''+err
    console.error('uncaughtException-str:',str)
    if(str && str.indexOf("Failed to execute 'setRemoteDescription' on 'RTCPeerConnection'")>=0){
        console.error("[Exit]Failed to execute 'setRemoteDescription' on 'RTCPeerConnection'------process.exit(1)")
        //2024-12-20 fix the unstable bug for video-record and single node process(not forever)
        if(window.g_dev_roomid && window.g_dev_roomid.length>0) 
        {
            if(window.rpcHost)
            {
                window.rpcHost.socket = null
                window.rpcHost.check_and_reconnect()
            }
            return console.error("[DEV-node]Failed to execute 'setRemoteDescription' on 'RTCPeerConnection'--but do not exit!")
        }
        process.exit(1);
    }
    ErrorLog.write(err);
    ErrorLog.write(err.stack);
})

process.on('unhandledRejection', (reason, p) => {
    p.catch((err) => {
        console.error(err);
        console.error(err ? err.stack:null);
        ErrorLog.write(err ? err.stack:null); //本地错误日志
    })
});
//2025-2-14新增----------------------------------
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
    console.log('readline-str:',input);
    if(input.startsWith('system-stop-now!'))
    {
        process.exit(1)
    }
  });
//--------------------------------------------------

if(window.g_dev_log_open_flag) ;
else console.log = function(){}
//2019.1.14重载console.log日志（这个挺有用的）
// console.log = (function (oriLogFunc) {
//     return function () {

//     var cache = new Map()
//       //[timeStr,...arguments]
//       var str = JSON.stringify(arguments, function(key, value) {
//           if (typeof value === 'object' && value !== null) {
//               if (cache.has(value)) //cache.indexOf(value) !== -1) 
//               {
//                   // 移除
//                   return;
//               }
//               // 收集所有的值
//               //cache.push(value);
//               cache.set(value,'')
//             //   if(value.length && value.length>1024*100)
//             //     return Buffer.from([])
//           }
//           return value;
//       });

//         if(config.debug)
//         {
//             ErrorLog.write("[" + new Date() + "]:" +str)
//             oriLogFunc.call(console, "[" + new Date() + "]:" ,...arguments);

//             if(str && str.indexOf('cannot signal after peer is destroyed')>=0){
//                 process.exit(1);
//             }
//         }
//     }
// })(console.log);

}

main_now()