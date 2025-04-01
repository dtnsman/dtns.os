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
// const RTCService = require('../dnalink.rtc/RTCService')
// const defaultRTCRoomID = 'linkline-cell'
// const defaultRTC = new RTCService(defaultRTCRoomID)

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
        //加载缓存
        // if(!dbopt || !dbopt.buffer || dbopt.buffer.length==0 )
        // {
        //     console.log('load sqljs-dbBuffer now:')
        //     //加载缓存
        //     let item_name = this.protocol.roomid+'_'+this.protocol.root_config.TOKEN_NAME+'_last_db'
        //     console.log('item_name:'+item_name)
        //     let bakName = localStorage.getItem(item_name) 
        //     console.log('bakName:'+bakName)
        //     let dbBuff = await ifileDb.getDataByKey(bakName)
        //     dbBuff = dbBuff ? dbBuff.data :null
        //     console.log('item_name:'+item_name)
        //     console.log('db:'+bakName+'----cached-buffer.len:'+(dbBuff?dbBuff.length:0))
        //     if(dbopt) dbopt.buffer = dbBuff
        // }
        await db.initDB(dbopt,'',kvopt)
        let chainDao = new DNALinkChainDAO(db,this.protocol)
        let walletDao = new DNALinkWalletDAO(db,this.protocol)//与
        this.engine = new DNALinkEngine(db,walletDao,chainDao,this.protocol)
        window['g_engine_'+this.root_config.TOKEN_NAME] = this.engine
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
        if(typeof onbeforeunload_list =='undefined')
        {
            window.onbeforeunload_list = []
        }
        //window.onbeforeunload = 
        let xfunc = function(){
            console.log('[notice]save db-data before close window')
            let dbname = that.protocol.roomid+'_'+that.protocol.root_config.TOKEN_NAME+'.db'
            let data = chainDao.db_chain.export()
            console.log('save-db-data:',data)
            let bakName = dbname+'.'+new Date().getTime()+'.bak'
            let flag = ifileDb.addData({key:bakName,data:data})
            let item_name = that.protocol.roomid+'_'+that.protocol.root_config.TOKEN_NAME+'_last_db'
            localStorage.setItem(item_name,bakName)
            if(m_onbeforeunload_results){
                //保存到results，以便返回。
                m_onbeforeunload_results.push({key:bakName,data:null,size:data.length})
            }
            // localStorage.setItem(item_name+'-size',''+data.length)
            // localStorage.setItem(item_name+'-flag',''+flag)
            // ifileDb.deleteDataByKey(dbname)
            // ifileDb.addData({key:dbname,data:data})
            // ifileDb.updateData({key:dbname,data:data})
        }
        onbeforeunload_list.push(xfunc)
        window.m_onbeforeunload = async function(){
            //遍历
            if(onbeforeunload_list && onbeforeunload_list.length>0)
            for(let i=0;i<onbeforeunload_list.length;i++)
            {
                onbeforeunload_list[i]()
                // alert('i:'+i)
            }
            // await str_filter.sleep(10000)
            // ifileDb.closeDB()
        }
        console.log('onbeforeunload_list-len:'+onbeforeunload_list.length)

        this.rpc = new DNALinkRPC(this.engine)
        // this.rpc.file_c.setSQLDB(db) //这里是保存在数据库中（需要定期保存到indexDB中）
        this.rtcSvr = defaultRTC//new RTCService(this.protocol.roomid)
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

async function loadDB2Buffer(roomid,TOKEN_NAME)
{
    console.log('load sqljs-dbBuffer now:')
    //加载缓存
    let item_name = roomid+'_'+TOKEN_NAME+'_last_db'
    console.log('item_name:'+item_name)
    let bakName = localStorage.getItem(item_name) 
    console.log('bakName:'+bakName)
    let dbBuff = await ifileDb.getDataByKey(bakName)
    dbBuff = dbBuff ? dbBuff.data :[]
    console.log('item_name:'+item_name)
    console.log('db:'+bakName+'----cached-buffer.len:'+(dbBuff?dbBuff.length:0))
    return dbBuff
}
// module.exports= RPCMain

async function lx_main()
{
    // let config =  rmb_protocol_config//require('../public/rmb_test')
    // let protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    // protocol.roomid = roomid// 'room2' //以便rpc_api_util启用client-rtc-util来实现与之连接。
    // let rpcm = new RPCMain(protocol)

    // while(!ifileDb.db)  await str_filter.sleep(100)
    // await str_filter.sleep(300)

    // lgsb_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lgsb_config.root_config.TOKEN_NAME)
    // lmsg_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lmsg_config.root_config.TOKEN_NAME)

    // lobj_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lobj_config.root_config.TOKEN_NAME)
    // lorder_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lorder_config.root_config.TOKEN_NAME)

    // lrmb_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lrmb_config.root_config.TOKEN_NAME)
    // lscore_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lscore_config.root_config.TOKEN_NAME)

    // luser_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,luser_config.root_config.TOKEN_NAME)
    // lvip_config.dbBuff = await loadDB2Buffer(defaultRTCRoomID,lvip_config.root_config.TOKEN_NAME)
    // let bakName = localStorage.getItem(protocol.roomid+'_last_db') 

    // let db = await ifileDb.getDataByKey(bakName)
    // db = db ? db.data :null
    
    // await rpcm.init({type:'buffer',buffer:db,dbtype:'sqljs'},//{type:'file',filepath:'rmb_test.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
    //             {type:'map',path:'leveldb_cache1',vtype:'json'})

    let config = lgsb_config//require('../dnalink.protocol/lianxian_gsb_59872')
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'gsb.db',dbtype:'sqlite3'},//{type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                {type:'map',path:'leveldb_cache1',vtype:'json'})// {type:'sql',path:'leveldb_cache1',vtype:'json'})//'map'


    config = lmsg_config//require('../dnalink.protocol/lianxian_msg_59876')
    //  config.root_config.DOMAIN_PORT = 59999
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'msg.db',dbtype:'sqlite3'},//{type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
            {type:'map',path:'leveldb_cache1',vtype:'json'})// {type:'sql',path:'leveldb_cache1',vtype:'json'})//'map'

    config = lscore_config//require('../dnalink.protocol/lianxian_score_59873')
    //  config.root_config.DOMAIN_PORT = 59997
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'score.db',dbtype:'sqlite3'},//{type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                {type:'map',path:'leveldb_cache1',vtype:'json'})// {type:'sql',path:'leveldb_cache1',vtype:'json'})//'map'


    // config = luser_config//require('../dnalink.protocol/lianxian_user_59877')
    // //  config.root_config.DOMAIN_PORT = 59997
    // protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    // protocol.roomid= defaultRTCRoomID
    // rpcm = new RPCMain(protocol)
    // await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'user.db',dbtype:'sqlite3'},//{type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
    //         {type:'map',path:'leveldb_cache1',vtype:'json'})// {type:'sql',path:'leveldb_cache1',vtype:'json'})//'map'

    config = lvip_config//require('../dnalink.protocol/lianxian_vip_59870')
    //  config.root_config.DOMAIN_PORT = 59997
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'vip.db',dbtype:'sqlite3'},//{type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                {type:'map',path:'leveldb_cache1',vtype:'json'})// {type:'sql',path:'leveldb_cache1',vtype:'json'})//'map'

    //2024-3-18新增-----------------------------------------------
    config = lobj_config
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'obj.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3-better'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
    delete config.dbBuff

    config = luser_config
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'user.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3-better'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
    delete config.dbBuff

    
    config = lrmb_config
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'rmb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3-better'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
    delete config.dbBuff
 

    config = lorder_config//require('../dnalink.protocol/lianxian_gsb_59872')
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new RPCMain(protocol)
    await rpcm.init({type:'file',filepath: require('../config').config.hub_db_path+'order.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3-better'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
    delete config.dbBuff 
    // delete lgsb_config.dbBuff
    // delete lmsg_config.dbBuff

    // delete lobj_config.dbBuff
    // delete lorder_config.dbBuff

    // delete lrmb_config.dbBuff
    // delete lscore_config.dbBuff

    // delete luser_config.dbBuff
    // delete lvip_config.dbBuff
}
window.lx_main = lx_main

// main()

 

 