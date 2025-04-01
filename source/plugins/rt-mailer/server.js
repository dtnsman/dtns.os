//2025-3-27
//------------------------------
const app = require('express')();
let port = 30555
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
   console.log('mailer-server Using https.');
} else {
   server = require('http').createServer(app);
   console.log('mailer-server Using http.');
}

server.listen(port, () => {
   console.log('mailer-sever running on port ' + port);
});

const { rejects } = require('assert');
// app.get('/', function (req, res) {
//    var sum = 0;
//    rooms.forEach((v, k) => sum = sum + v.size);
//    res.send('Lobby server<br/>rooms: ' + rooms.size + '<br/>members: ' + sum);
// });

// var loginfo = {records:[],logstr:''}
const nodemailer = require("nodemailer");
const rtmailer_setting = require('../../setting/rtmailer_setting.json')
const transporter = nodemailer.createTransport(rtmailer_setting);
//http://127.0.0.1:30555/mail/send?to=251499600@qq.com&text=%E4%BD%A0%E5%A5%BD&subject=%E5%91%8A%E8%AF%89%E4%BD%A0%E4%B8%80%E4%B8%AA%E6%96%B0%E7%9A%84%E5%86%85%E5%AE%B9%E4%BA%86&html=%3Ch1%3E%E5%93%88%E5%93%88%3C/h1%3E
app.all('/mail/send',async function (req, res) {
   let params = {}
   Object.assign(params,req.query, req.body, req.params)
   console.log('req-params:'+JSON.stringify(params))
   let dst_params = Object.assign({},params,{from:rtmailer_setting.from})
   try{
      if(dst_params.attachments) dst_params.attachments = JSON.parse( dst_params.attachments)
   }catch(ex){
      console.log('params-attachments-JSON.parse-ex:'+ex,ex)
   }
   let info = await transporter.sendMail(dst_params);
   console.log('info:',info)
   if(info && info.accepted && info.accepted.length>0)
      res.json({ret:true,msg:'success'})
   else
      res.json({ret:false,msg:'rejected',rejected:info.rejected})
})