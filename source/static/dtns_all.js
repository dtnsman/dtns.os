/**
 * Created by poplang on 2023/3/13
 */
const express = require('express');
var expressWs = require('express-ws');
const bodyParser = require('body-parser');
var multer  = require('multer');
const fs = require('fs');

class DTNSRPCMain
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
        // let that  = this
        // if(typeof onbeforeunload_list =='undefined')
        // {
        //     window.onbeforeunload_list = []
        // }
        // //window.onbeforeunload = 
        // let xfunc = function(){
        //     console.log('[notice]save db-data before close window')
        //     let dbname = that.protocol.roomid+'_'+that.protocol.root_config.TOKEN_NAME+'.db'
        //     let data = chainDao.db_chain.export()
        //     console.log('save-db-data:',data)
        //     let bakName = dbname+'.'+new Date().getTime()+'.bak'
        //     let flag = ifileDb.addData({key:bakName,data:data})
        //     let item_name = that.protocol.roomid+'_'+that.protocol.root_config.TOKEN_NAME+'_last_db'
        //     localStorage.setItem(item_name,bakName)
        //     if(m_onbeforeunload_results){
        //         //保存到results，以便返回。
        //         m_onbeforeunload_results.push({key:bakName,data:null,size:data.length})
        //     }
        //     // localStorage.setItem(item_name+'-size',''+data.length)
        //     // localStorage.setItem(item_name+'-flag',''+flag)
        //     // ifileDb.deleteDataByKey(dbname)
        //     // ifileDb.addData({key:dbname,data:data})
        //     // ifileDb.updateData({key:dbname,data:data})
        // }
        // onbeforeunload_list.push(xfunc)
        // window.m_onbeforeunload = async function(){
        //     //遍历
        //     if(onbeforeunload_list && onbeforeunload_list.length>0)
        //     for(let i=0;i<onbeforeunload_list.length;i++)
        //     {
        //         onbeforeunload_list[i]()
        //         // alert('i:'+i)
        //     }
        //     // await str_filter.sleep(10000)
        //     // ifileDb.closeDB()
        // }
        // console.log('onbeforeunload_list-len:'+onbeforeunload_list.length)

        this.rpc = new DNALinkRPC(this.engine)
        // this.rpc.file_c.setSQLDB(db) //这里是保存在数据库中（需要定期保存到indexDB中）
        this.rtcSvr = defaultRTC//new RTCService(this.protocol.roomid)
        this.rtcSvr.setRPC(this.rpc,''+this.DOMAIN_PORT)
        this.rtcSvr.setRPC(this.rpc)//default也设置为它

        //连接公网 on 2023/3/17
        console.log('DTNSRPCMain-init-this.rtcDTNSSvr->typeof g_defaultDTNSRTCArray',typeof g_defaultDTNSRTCArray!='undefined')
        if(typeof g_defaultDTNSRTCArray!='undefined' && g_defaultDTNSRTCArray.length>0)
        {
            this.rpc.g_chain_open_access = true

            // this.rtcDTNSSvr = g_defaultDTNSRTCArray[0]
            for(let i=0;i<g_defaultDTNSRTCArray.length;i++)
            {
                console.log('DTNSRPCMain-init-this.rtcDTNSSvr:',g_defaultDTNSRTCArray[i])
                this.rtcDTNSSvr = g_defaultDTNSRTCArray[i]
                this.rtcDTNSSvr.setRPC(this.rpc,''+this.DOMAIN_PORT)
                this.rtcDTNSSvr.setRPC(this.rpc)
            }
        }else{
            //并不连接公网，直接内网访问而已
        }
        let that  = this
        if(!window.dtns_root_keys) window.dtns_root_keys = await walletDao.queryTokenKeys(that.root_config.TOKEN_ROOT)
        //如失败，再次请求
        if(!window.dtns_root_keys)
        setTimeout(async function(){
            window.dtns_root_keys = await walletDao.queryTokenKeys(that.root_config.TOKEN_ROOT)
            console.log('dtns_root_keys:',dtns_root_keys)
        },600)

        this.rpc.g_chain_open_access = true
        const app = express();
        //允许cors跨域
        app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
        app.set('x-powered-by',false) //去掉x-powered-by，避免服务器泄露信息。
        // app.use(express.static('doc'))
        //require('../superdimension/file/file_config').file_temp
        app.use(multer({ dest:'file_tmp'}).array('file'))
        app.use(bodyParser.urlencoded({ extended: false }));
        let This =this
        app.use(function(req,res,next){
            This.rpc.common_interceptor(req,res,next)
        });
        // 路由
        expressWs(app)
        //新增-forklist-pay-c.js的相关接口-------以支持ib3-qw的SDK收款通道实现
        if(typeof g_forklist_user=='undefined'){
            const routes = require('../routes');
            routes(app)
        }
        //-------------------
        this.rpc.rpc_c_index(app);
        this.app = app;
        
        const config = {
            debug: true,
            description: 'dnalink.pop',
            host: '127.0.0.1',
            port: window.g_dtns_http_port ? window.g_dtns_http_port : 6666,//this.DOMAIN_PORT,//统一使用6666这个端口
            log_path:window.config.runtime_current_dir+"/logs/"+this.root_config.TOKEN_NAME+"_"//+this.root_config.TOKEN_NAMESPACE+"_"
        };
        
        app.listen(config.port, //this.DOMAIN_PORT,
        function() {
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

async function dtns_main(defaultRTCRoomID = 'room')
{
    // while(!ifileDb.db)  await str_filter.sleep(100)
    // await str_filter.sleep(300)

    dtns_config.dbBuff = null;// await loadDB2Buffer(defaultRTCRoomID,dtns_config.root_config.TOKEN_NAME)
    let config = dtns_config//require('../dnalink.protocol/lianxian_gsb_59872')
    protocol = new DNALinkProtocol(config.root_config,config.fsm_config)
    protocol.roomid= defaultRTCRoomID
    rpcm = new DTNSRPCMain(protocol)

    await rpcm.init({type:'file',filepath:require('../config').config.dtns_db_path+'dtns.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                 {type:'map',path:'leveldb_cache1',vtype:'json'})
    // await rpcm.init({type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
    //             {type:'map',path:'leveldb_cache1',vtype:'json'})// {type:'sql',path:'leveldb_cache1',vtype:'json'})//'map'

    delete dtns_config.dbBuff
    return rpcm
}

window.DTNSRPCMain = DTNSRPCMain
window.dtns_main = dtns_main
// main()

 

 