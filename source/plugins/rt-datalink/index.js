if(typeof window == 'undefined') globalThis.window = globalThis
window.rtdatalink_c = {}
// const rtdatalink_c_token_name = OBJ_TOKEN_NAME
// const rtdatalink_c_api_base   = OBJ_API_BASE
// const rtdatalink_c_token_root = OBJ_TOKEN_ROOT
const rtdatalink_setting = require('../../setting/rtdatalink_setting.json')

rtdatalink_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtdatalink/send',urlParser,session_filter,rtdatalink_c.send)//
}
const http_req = require('../../libs/http_request')
const str_filter = require('../../libs/str_filter')
rtdatalink_c.send = async function(req,res)
{
    let params = str_filter.get_req_data(req)
    res.json({ret:true,msg:'success'})
}

const app = require('express')();
const expressWs = require('express-ws')(app);
let port = rtdatalink_setting.port
//允许cors跨域
app.use(function (req, res, next) {
res.header("Access-Control-Allow-Origin", "*");
res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
next();
});
app.set('x-powered-by',false) //去掉x-powered-by，避免服务器泄露信息。

app.ws('/datalink', function(ws, req) {
    console.log('ws:',ws)
  if(typeof g_rpcHostArray!='undefined')
  {  
    let rpcHost = g_rpcHostArray[0]
    ws.channelName = 'datalink'
    ws._channel = {bufferedAmount:10}
    ws._pc = {sctp:{maxMessageSize:1024*1024*1024*1024}}
    rpcHost.onPeer(ws)
    ws.on('message', function(msg) {
        console.log('datalink-websocket-msg:',typeof msg);
        if(typeof msg =='object')
        {
            msg = new Uint8Array(msg) 
            console.log('hash256:',str_filter.hashVal(msg))
            console.log('binary-msg:',msg,msg.byteLength)
            msg = Buffer.from(msg.buffer)//new ArrayBuffer(msg)///Buffer.from(msg)
            console.log('buffer-msg:',msg,msg.length,msg.byteLength,(msg).slice(0,30))
        } 
        ws.emit('data',msg)
    });
    console.log('datalink-socket', req.testing);
    }
});

app.all('/', function(req, res, next){
  console.log('datalink-get route', req.testing);
  res.json({'ret':true})
});

app.listen(port, () => {
    console.log('rtdatalink-sever running on port ' + port);
 });

