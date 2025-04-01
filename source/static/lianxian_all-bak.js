/**
 * Created by poplang on 2022/9/26
 * 应用入口文件.（用户运营）
 */
 const express = require('express');
 var expressWs = require('express-ws');
 const bodyParser = require('body-parser');
 var multer  = require('multer');
 const fs = require('fs');
 const str_filter = require('../libs/str_filter');
 
 
 const SQLDB = require('../../pop.sqldb/SQLDB')
 const DNALinkRPC = require('./DNALinkRPC')
 const DNALinkEngine= require('../dnalink.engine/DNALinkEngine')
 const DNALinkProtocol=require('../dnalink.protocol/DNALinkProtocol')
 const DNALinkChainDAO = require('../dnalink.dao/DNALinkChainDAO')
 const DNALinkWalletDAO = require('../dnalink.dao/DNALinkWalletDAO')
 
 const RTCService = require('../dnalink.rtc/RTCService')
 const defaultRTC = new RTCService('linkline-lmc')

 class RPCMain
 {
     constructor(protocol)
     {
         this.protocol = protocol;
         this.root_config = this.protocol.root_config
         this.DOMAIN_PORT = this.root_config.DOMAIN_PORT
     // this.rpc = new DNALinkRPC(this.protocol)
     }
     async init(dbopt,kvopt)
     {
         let db = new SQLDB();
         await db.initDB(dbopt,'',kvopt)
         let chainDao = new DNALinkChainDAO(db,this.protocol)
         let walletDao = new DNALinkWalletDAO(db,this.protocol)//与
         this.engine = new DNALinkEngine(db,walletDao,chainDao,this.protocol)
         try{
             this.engine = new DNALinkEngine(db,walletDao,chainDao,this.protocol)
             let testEnvFlag = await this.engine.testEnv();
             console.log('testEnvFlag:'+JSON.stringify(testEnvFlag))
         }catch(ex){console.log('ex:'+ex)}
         chainDao.setEngine(this.engine)//用于清理cache时使用到。
 
         let cntRet = await chainDao.db_chain.query('select count(1) as cnt from token_chain')
         console.log('cntRet:'+JSON.stringify(cntRet))
 
         cntRet = await chainDao.db_chain.query('select * from token_config')
         console.log('cntRet:'+JSON.stringify(cntRet))
 
         cntRet = await chainDao.db_chain.query('select count(1) as cnt from token_chain')
         console.log('cntRet:'+JSON.stringify(cntRet))
 
 
 
         this.rpc = new DNALinkRPC(this.engine)
         this.rtcSvr = defaultRTC //这个全局一致，为唯一（见文件头部）
         this.rtcSvr.setRPC(this.rpc,''+this.DOMAIN_PORT)//占用不同的rpc_name
        //  this.rtcSvr.setRPC(this.rpc)//default也设置为它
 
         const app = express();
         //允许cors跨域
         app.use(function (req, res, next) {
             res.header("Access-Control-Allow-Origin", "*");
             res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
             next();
         });
         app.set('x-powered-by',false) //去掉x-powered-by，避免服务器泄露信息。
         app.use(express.static('doc'))
         //require('../superdimension/file/file_config').file_temp
         app.use(multer({ dest:'file_tmp'}).array('file'))
         app.use(bodyParser.urlencoded({ extended: false }));
         let This =this
         app.use(function(req,res,next){
             This.rpc.common_interceptor(req,res,next)
         });
         // 路由
         expressWs(app)
         this.rpc.rpc_c_index(app);
         this.app = app;
         
         const config = {
             debug: true,
             description: 'dnalink.pop',
             host: '127.0.0.1',
             port: this.DOMAIN_PORT,//统一使用6666这个端口
             log_path:__dirname+"/logs/"+this.root_config.TNS_NAMESPACE+"_"+this.root_config.TOKEN_NAMESPACE+"_"
         };
         
         app.listen(this.DOMAIN_PORT, function() {
             console.log("You can debug your app with http://" + config.host + ':' + config.port);
         });
         
         const errorLogfile = fs.createWriteStream(config.log_path + str_filter.GetDateFormat('y-m-d')+'.log',
                             { flags: 'a', encoding: null, mode: '0777' });
         this.error_log = {}
         this.error_log.write = function(errmsg) {
             if (typeof errmsg != 'string') {
                 errmsg = JSON.stringify(errmsg);
             }
             let now = new Date();
             let time = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + ' ' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
             errorLogfile.write(time + '\r\n' + errmsg + '\r\n');
         }
     }
 }
 
 module.exports= RPCMain
 
 async function main()
 {
     let protocol_config = require('../dnalink.protocol/dnalink_protocol_config')
     let protocol = new DNALinkProtocol(protocol_config.root_config,protocol_config.fsm_config)
     let rpcm = new RPCMain(protocol)
    //  await rpcm.init({type:'file',filepath:'test.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
    //              {type:'map',path:'leveldb_cache1',vtype:'json'})
 
     let config = require('../dnalink.protocol/lianxian_gsb_59872')
     protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
     rpcm = new RPCMain(protocol)
     await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
 

     config = require('../dnalink.protocol/lianxian_msg_59876')
    //  config.root_config.DOMAIN_PORT = 59999
     protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
     rpcm = new RPCMain(protocol)
     await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_msg.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
 
 
     config = require('../dnalink.protocol/lianxian_obj_59875')
    //  config.root_config.DOMAIN_PORT = 59998
     protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
     rpcm = new RPCMain(protocol)
     await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_obj.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
     
     config = require('../dnalink.protocol/lianxian_order_59871')
    //  config.root_config.DOMAIN_PORT = 59997
     protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
     rpcm = new RPCMain(protocol)
     await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_order.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
 
     config = require('../dnalink.protocol/lianxian_rmb_59874')
    //  config.root_config.DOMAIN_PORT = 59996
    //  config.root_config.TOKEN_NAME = 'msga'
     protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
     rpcm = new RPCMain(protocol)
     await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_rmb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})

    config = require('../dnalink.protocol/lianxian_score_59873')
    //  config.root_config.DOMAIN_PORT = 59997
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_score.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                {type:'map',path:'leveldb_cache1',vtype:'json'})

    config = require('../dnalink.protocol/lianxian_user_59877')
    //  config.root_config.DOMAIN_PORT = 59997
        protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
        rpcm = new RPCMain(protocol)
        await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_user.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                    {type:'map',path:'leveldb_cache1',vtype:'json'})

    config = require('../dnalink.protocol/lianxian_vip_59870')
    //  config.root_config.DOMAIN_PORT = 59997
     protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
     rpcm = new RPCMain(protocol)
     await rpcm.init({type:'file',filepath:'chat02G32Zmqgh8P_vip.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
 
             

 
 }
 
 main()
 
  
 
  
  //错误处理
 //  process.on('uncaughtException', function(err) {
 //      console.log(err);
 //      console.log(err.stack);
 //      error_log.write(err);
 //      error_log.write(err.stack);
 //  })
  
 //  process.on('unhandledRejection', (reason, p) => {
 //      p.catch((err) => {
 //          console.log(err);
 //          console.log(err.stack);
 //          error_log.write(err.stack); //本地错误日志
 //      })
 //  });
  
  
 //  //2019.1.14重载console.log日志（这个挺有用的）
 //  console.log = (function (oriLogFunc) {
 //      return function (str) {
 //          //if(config.debug)
 //          {
 //              //error_log.write("[" + new Date() + "]:" + str)
 //              //oriLogFunc.call(console, "[" + new Date() + "]:" + str);
 //          }
 //      }
 //  })(console.log);
  
 //  //用于调试JSON解析，较为容易出现问题地方2019-1-24
 //  JSON.parse = (function (originFunc) {
 //      return function (str) {
 //          //console.log("[JSON.parse]:" + str)
 //          if (!str) return {}
 //          return originFunc.call(JSON, str);
 //      }
 //  })(JSON.parse);
  
  
 //  //改善字符串的处理。
 //  JSON.stringify = (function (originFunc) {
 //      return function (str) {
  
 //          //console.log("[JSON.stringify]:" + str+" typeof:"+(typeof str))
  
 //          if((typeof str)=='string')
 //              return str;
 //          else
 //              return originFunc.call(JSON, str);
 //      }
 //  })(JSON.stringify);
  
  // //检测环境。
  // require('./root/root_c').testEnv();
  
  //控并发数量（非常重要）
  process.env.UV_THREADPOOL_SIZE = 1000;
  
  //const udp_server = require('./udp/server')
  //const udp_client = require('./udp/udp_api')
  
  
  