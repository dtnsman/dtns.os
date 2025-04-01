//2025-2-6
require('./turn.js')
//----------------------------
window.rtturn_c = {}
rtturn_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtturn',urlParser,session_filter,function(req,res){
        res.json({ret:true,msg:'success'})
    })//发送后，在系统保留10-60s，以待对方pick起来！
}

//------------------------------
const app = require('express')();
//允许cors跨域
app.use(function (req, res, next) {
res.header("Access-Control-Allow-Origin", "*");
res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
next();
});
app.set('x-powered-by',false) //去掉x-powered-by，避免服务器泄露信息。

let server = {};

if (process.argv[2] && process.argv[2] === '-ssl') {
   var fs = require('fs');
   var options = {
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
      requestCert: false,
      rejectUnauthorized: false
   };
   server = require('https').createServer(options, app);
   log('Using https.');
} else {
   server = require('http').createServer(app);
   log('Using http.');
}

const io = require('socket.io')(server, { cors: true, origins: false });
const signalServer = require('simple-signal-server')(io)
const port = process.env.PORT || 3100;
const rooms = new Map()
const roomHosts = new Map()

io.on("connection", (socket) => {
   console.log('socket.id-2022-7-11:'+socket.id)
 });

server.listen(port, () => {
   log('Lobby server running on port ' + port);
});

app.get('/', function (req, res) {
   var sum = 0;
   rooms.forEach((v, k) => sum = sum + v.size);
   res.send('Lobby server<br/>rooms: ' + rooms.size + '<br/>members: ' + sum);
});

var loginfo = {records:[],logstr:''}

app.all('/a', function (req, res) {
   let params = {}
   Object.assign(params,req.query, req.body, req.params)
   console.log('req-params:'+JSON.stringify(params))
   loginfo.logstr += loginfo.logstr.length>0 ? '---'+ JSON.stringify(params) :JSON.stringify(params)
   loginfo.records = loginfo.logstr.split('---')
   if(loginfo.records.length>20)
   {
      loginfo.logstr = loginfo.logstr.substring(loginfo.logstr.indexOf('---')+3,loginfo.logstr.length)
   }
   res.send('a-api is ok:\t'+JSON.stringify(params))//+JSON.stringify(loginfo.records));
});

app.all('/b', function (req, res) {
   res.setHeader('Content-Type','text/plain;charset=utf-8')
   for(let i=0;i<loginfo.records.length;i++)
      res.write(i+':\t'+loginfo.records[i]+'\n');
   res.end()
});
// require('./config')
const sign_util = require('./sign_util')
const key_util = require('./key_util')
const { randomBytes } = require('crypto');
app.all('/c', function (req, res) {

   let pwd1 = {username: 'user1',//'1678502396:user1',
   password:'1'}
   //{username: 'username',
   // password: 'password'}//
   //{username: 'username',password: 'password'}//
    let pwd = pwd1//sign_util.getTURNCredentialsPWD(key_util.bs58Encode( randomBytes(6)),g_turn_credentials_pwd_key)
    pwd.ret = true
    pwd.msg = 'success'
    res.json(pwd)
 });

signalServer.on('discover', (request) => {
   log('discover','data--'+request.discoveryData);
   let memberId = request.socket.id;
   let discoveryData = ''+request.discoveryData;
   let roomId = discoveryData.indexOf('::')>0 ? discoveryData.split('::')[0] :discoveryData
   let tnsHost =discoveryData.indexOf('::')>0 ? discoveryData.split('::')[1]:null 
   let web3name = roomId.indexOf('|')>0 ? roomId.split('|')[0] : roomId

   if(tnsHost)
   {
      //2024-4-22新增
      const configs = {'web3:dev003d':'cr1xFdLjy3BBRubSmhUWCSPyJzHEvNEE7TKi8B9Lfn9z'}//require('./test_tns_config')
      console.log('configs:',configs, configs[web3name] ,web3name)
      if(roomId.indexOf('|')>0 && configs  && configs[web3name] )
      {
         let datas = roomId.split('|')
         let public_key = null
         let hash = key_util.hashVal( datas[0]+'|'+datas[1])
         let sign = datas[2]
         let recoverKey = key_util.recoverPublickey(sign,hash)
         console.log('recoverKey:'+recoverKey+" need-public-key:"+configs[web3name])
         if( configs[web3name] != recoverKey)
         {
            console.log(web3name+' public-key is not ok!recoverKey:'+recoverKey+",need-public-key:"+configs[web3name] )
            return request.socket.disconnect(web3name+' public-key is not ok!recoverKey:'+recoverKey+",need-public-key:"+configs[web3name] )
         }
      }
      roomHosts.set(web3name,memberId)
   }


   let members = rooms.get(web3name);
   let hostid = roomHosts.get(web3name)
   if (!members) {
      members = new Set();
      rooms.set(web3name, members);
   }
   members.add(memberId);
   request.socket.roomId = web3name;
   request.discover({
      peers: [],//Array.from(members), //在做e2ee的视频、语音聊天时用到
      roomid:web3name,  //方便client标识访问的是哪个room（允许client同时连接多个room）
      nowtime:new Date().getTime(), //标识时间，用于encrypto等
      hostid //告诉client该room的hostid，方便访问各种资源。
   });
   log('joined ' + web3name + ' ' + memberId+' ,hostid:'+hostid)
})

signalServer.on('disconnect', (socket) => {
   let memberId = socket.id;
   let roomId = socket.roomId;
   let members = rooms.get(roomId);
   if (members) {
      members.delete(memberId)
   }
   log('left ' + roomId + ' ' + memberId)
})

signalServer.on('request', (request) => {
   request.forward()
   log('requested')
})

function log(message, data) {
   if (true) {
      console.log(message);
      if (data != null) {
         console.log(data);
      }
   }
}
