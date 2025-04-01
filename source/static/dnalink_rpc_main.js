/**
 * Created by poplang on 2022/9/26
 * 应用入口文件.（用户运营）
 */
// const express = require('express');
// var expressWs = require('express-ws');
// const bodyParser = require('body-parser');
// var multer  = require('multer');
// const fs = require('fs');
// const str_filter = require('../libs/str_filter');

// const SQLDB = require('../../pop.sqldb/SQLDB')
// const DNALinkRPC = require('./DNALinkRPC')
// const DNALinkEngine= require('../dnalink.engine/DNALinkEngine')
// const DNALinkProtocol=require('../dnalink.protocol/DNALinkProtocol')
// const DNALinkChainDAO = require('../dnalink.dao/DNALinkChainDAO')
// const DNALinkWalletDAO = require('../dnalink.dao/DNALinkWalletDAO')

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

        //在窗口关闭前，保存数据库。
        let that  = this
        window.onbeforeunload = function(){
            console.log('[notice]save db-data before close window')
            let dbname = that.protocol.roomid+'.db'
            let data = chainDao.db_chain.export()
            console.log('save-db-data:',data)
            let bakName = dbname+'.'+new Date().getTime()+'.bak'
            ifileDb.addData({key:bakName,data:data})
            localStorage.setItem(that.protocol.roomid+'_last_db',bakName)
            // ifileDb.deleteDataByKey(dbname)
            // ifileDb.addData({key:dbname,data:data})
            // ifileDb.updateData({key:dbname,data:data})
        }

        this.rpc = new DNALinkRPC(this.engine)
        // this.rpc.file_c.setSQLDB(db) //这里是保存在数据库中（需要定期保存到indexDB中）
        this.rtcSvr = new RTCService(this.protocol.roomid)
        this.rtcSvr.setRPC(this.rpc,''+this.DOMAIN_PORT)
        this.rtcSvr.setRPC(this.rpc)//default也设置为它

        // const app = express();
        // //允许cors跨域
        // app.use(function (req, res, next) {
        //     res.header("Access-Control-Allow-Origin", "*");
        //     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        //     next();
        // });
        // app.set('x-powered-by',false) //去掉x-powered-by，避免服务器泄露信息。
        // app.use(express.static('doc'))
        // //require('../superdimension/file/file_config').file_temp
        // app.use(multer({ dest:'file_tmp'}).array('file'))
        // app.use(bodyParser.urlencoded({ extended: false }));
        let This =this
        // app.use(function(req,res,next){
        //     This.rpc.common_interceptor(req,res,next)
        // });
        // // 路由
        // expressWs(app)
        // this.rpc.rpc_c_index(app);
        // this.app = app;
        
        // const config = {
        //     debug: true,
        //     description: 'dnalink.pop',
        //     host: '127.0.0.1',
        //     port: this.DOMAIN_PORT,//统一使用6666这个端口
        //     log_path:__dirname+"/logs/"+this.root_config.TNS_NAMESPACE+"_"+this.root_config.TOKEN_NAMESPACE+"_"
        // };
        
        // app.listen(this.DOMAIN_PORT, function() {
        //     console.log("You can debug your app with http://" + config.host + ':' + config.port);
        // });
        
        // const errorLogfile = fs.createWriteStream(config.log_path + str_filter.GetDateFormat('y-m-d')+'.log',
        //                     { flags: 'a', encoding: null, mode: '0777' });
        // this.error_log = {}
        // this.error_log.write = function(errmsg) {
        //     if (typeof errmsg != 'string') {
        //         errmsg = JSON.stringify(errmsg);
        //     }
        //     let now = new Date();
        //     let time = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + ' ' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
        //     errorLogfile.write(time + '\r\n' + errmsg + '\r\n');
        // }
    }
}

// module.exports= RPCMain

async function main(roomid = 'room')
{
    let config =  rmb_protocol_config//require('../public/rmb_test')
    let protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid = roomid// 'room2' //以便rpc_api_util启用client-rtc-util来实现与之连接。
    let rpcm = new RPCMain(protocol)

    while(!ifileDb.db)  await str_filter.sleep(100)
    await str_filter.sleep(300)

    let bakName = localStorage.getItem(protocol.roomid+'_last_db') 

    let db = await ifileDb.getDataByKey(bakName)
    db = db ? db.data :null
    
    await rpcm.init({type:'buffer',buffer:db,dbtype:'sqljs'},//{type:'file',filepath:'rmb_test.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                {type:'map',path:'leveldb_cache1',vtype:'json'})
}

// main()

window.RPCMain = RPCMain