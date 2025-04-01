

// const TokenUtil = require('../../../dnalink.protocol/DNALinkProtocol').TokenUtil
// const RPCApiUtil= require('../../RPCApiUtil')
// const str_filter = require('../../../libs/str_filter');
// const file_util = require('../../../libs/file_util')
// const key_util = require("../../../dnalink.protocol/key_util")


class WebSocketController{
    constructor(rpc)
    {
        this.rpc = rpc
        this.engine = rpc.engine
        this.kvdb = this.engine.kvdb
        this.wallet_m=this.engine.wallet_m
        this.chain_m =this.engine.chain_m

        this.protocol = this.engine.protocol
        this.fsm_config = this.protocol.fsm_config
        this.root_config= this.protocol.root_config
        this.tx_util    = rpc.tx_util
        this.token_util = rpc.token_util
        this.rpc_api_util = rpc.rpc_api_util//new RPCApiUtil(this.protocol)

        this.TOKEN_ROOT = this.protocol.root_config.TOKEN_ROOT
        this.TOKEN_NAME = this.protocol.root_config.TOKEN_NAME
        this.DOMAIN_PORT = this.root_config.DOMAIN_PORT

        this.allDataSockList = []
        this.tokenDataSocketList = {}

        //token-parent
        this.ws = {}//require("ws");
        this.sock = null
        this.reCallCnt = 0;
        this.ws_listen_token =   this.TOKEN_ROOT

        console.log('this.DOMAIN_PORT:'+this.DOMAIN_PORT+' TOKEN_NAME:'+this.TOKEN_NAME)
        if(this.TOKEN_ROOT.indexOf('_0000000000000000')<0)
             this.linkParentWS()
    }
    websocket_index(app) {
        let This = this;
        if(app && (typeof app.ws =='function'))
            app.ws('/super/websocket/link', function(req,res){This.svr_service(req,res)});
        else
            console.log('websocket_index:app.ws is not function')
    }
    async svr_service (ws,req)
    {
        let {token} = str_filter.get_req_data(req)
        let str = await this.kvdb.get(token);
        if(!str)
        {
            console.log('token error');
            ws.send(JSON.stringify({ret:false,msg:'token error'}))
            ws.close()
            return ;
        }
        //一个token只能连接一次。
        this.kvdb.del(token);

        //添加到队列中。
        if(token == str)
            this.allDataSockList.push(ws);
        else{
            this.tokenDataSocketList[str] = ws;
            ws.token = str;
        }


        let This = this;
        console.log('you are in')
        ws.on('message', async function (msg) {
            This.recvWebsocketClientMsg(ws,msg)
        })
        ws.on('close',function(){
            console.log('client socket-close!');
            //是token订阅，还是全局订阅
            if(ws.token)
            {
                //删除连接
                delete This.tokenDataSocketList[ws.token];
            }else{
                let newList = []
                for(let i=0;i<This.allDataSockList.length;i++)
                {
                    if(This.allDataSockList[i]!=ws)
                    {
                        newList.push(This.allDataSockList[i])
                    }
                    else
                    {
                        continue;
                    }
                }
                This.allDataSockList = newList;
            }
        })
        try{
            ws.send({ret:true,msg:'link is ok'})
        }catch(ex){
            
        }
    }
    async sendWebsocketClientMsg(ws,obj)
    {
        try{
            console.log('sendWebsocketClientMsg:'+JSON.stringify(obj))
            ws.send(JSON.stringify(obj))
        }catch(ex){console.log('sendWebsocketClientMsg exception:'+ex)}
    }
    async recvWebsocketClientMsg(ws,msg)
    {
        // 业务代码
        console.log('msg:'+msg);
        if(msg=='keepalive') return ws.send('back:'+msg);
        //接收来自children-token的消息（主要是写入到主token中
        console.log('recvWebsockClientMsg-token:'+ws.token)
        console.log('GLOBAL_WEBSOCKET_WRITE_MAP:'+JSON.stringify(this.rpc.GLOBAL_WEBSOCKET_WRITE_MAP))

        //如果不是token的client，则代表其无写入权限。
        if(!(ws.token && this.rpc.GLOBAL_WEBSOCKET_WRITE_MAP[ws.token] 
            && (''+this.rpc.GLOBAL_WEBSOCKET_WRITE_MAP[ws.token]).indexOf('http')==0))
        {
            return this.sendWebsocketClientMsg(ws,{ret:false,msg:'no pm to write,use websocket.token.write'})
        }

        //获得token的state
        let myTokenState = await this.engine.queryTokenState(ws.token)
        console.log('tokenState:'+myTokenState)
        if(!myTokenState) return this.sendWebsocketClientMsg(ws,{ret:false,msg:'token state error'})
        // let public_key = myTokenState.web_key ? myTokenState.web_key :myTokenState.public_key
        let msgInfo = null
        try{
            msgInfo = JSON.parse(msg);
        }catch(ex){console.log('msgInfo parse failed:'+ex)
            return this.sendWebsocketClientMsg(ws,{ret:false,msg:'recv-msg-info error'})
        }

        // if(msgInfo instanceof Array){
        //     return sendWebsocketClientMsg(ws,{ret:false,msg:'no sign and etc'})
        // } 

        // let hash = 
        // if(key_util.verifySignMsg(msgInfo.sign,))

        let tokenWriteMap = {}
        let list = msgInfo;//.list  不再制造复杂化数据结构（靠自身的token_key等进行有效访问，不再密钥检测
        for(let i=0;list && i<list.length;i++)
        {
            let objInfo = list[i]
            hash = await key_util.hashVal(this.tx_util.toTXJSONString(objInfo.txjson));
            let tokenState = await this.engine.queryTokenState(objInfo.token)
            tokenWriteMap[objInfo.token] = tokenState;

            let public_key = tokenState.web_key ? tokenState.web_key : tokenState.public_key
            if(hash!=objInfo.hash  || !(await key_util.verifySignMsg(hash,objInfo.sign,public_key)))
                return this.sendWebsocketClientMsg(ws,{ret:false,msg:'error sign or hash by write-row:'+JSON.stringify(objInfo)})
            
            if(!tokenWriteMap[objInfo.txjson.token_x]) tokenWriteMap[objInfo.txjson.token_x] = await this.engine.queryTokenState(objInfo.txjson.token_x)
            if(!tokenWriteMap[objInfo.txjson.token_y]) tokenWriteMap[objInfo.txjson.token_y] = await this.engine.queryTokenState(objInfo.txjson.token_y)
        }

        //判断是否为子群（token需为子token才有权限写入），超过权限不给写入
        if(ws.token != this.TOKEN_ROOT)
        for(var key in tokenWriteMap)
        {
            if(!(tokenWriteMap[key].token_state_p.indexOf(ws.token)>=0  
                || myTokenState.token_state_p == tokenWriteMap[key].token_state_p))
                return this.sendWebsocketClientMsg(ws,{ret:false,msg:'token-state_p out of myToken by write-rows'})
        }

        //先保存txinfo
        //====先等chain_m.saveTXQueue2TokenChain写完后，再通过save_tx来做存储。


        //-----------这里需要按本Node节点的wallet进行重新签名生成密钥的（按理说），但是也可以直接写入。
        ///*
        //要看一下websocket.token.write是否已经拥有写入权限----向父节点写入数据的权限（给父节点同步数据权限）
        try{
            //return false;//现在有了global-write-map
            //应该还要进行校验。如果签名成功，写入到持久化队列
            //不核验是没办法敢于写入数据的，特别是要判断全部是子token数据
            let iNum = await this.chain_m.saveTXQueue2TokenChain(JSON.parse(msg));
            console.log('save token-children-rowns:'+iNum)
            //ws.send(JSON.stringify({ret:true,num:iNum,msg:'success'}))
        }catch(ex)
        {
            console.log('get children tx-rows write to mydisk failed')
            return this.sendWebsocketClientMsg(ws,{ret:false,msg:'chain-write-rows failed'})
        }
        //*/
        //生成token_x或者token_y-parent之后的数据纪录再写入到数据库，然后更新token_state等。
        //除了fork其他都需要生成。
        //复杂的补parent数据同步，这个后续再补问题也不大（可删除），最重要是当前节点保存了children集群的数据

        //by 2022-8-6 完成了基于websocket的children2parent写入数据多节点同步

    }
    //在
    // async query_websocket_write_map()
    // {
    //     let list = await this.rpc_api_util.s_query_token_list('',this.TOKEN_ROOT,this.fsm_config.OP_RELW,0,100000,false,async function(token_y){
    //         let opval =  await this.rpc_api_util.s_query_token_info('',token_y,this.fsm_config.OP_WEBSOCKET_TOKEN_WRITE);
    //         return {token_x:this.TOKEN_ROOT,token_y,opval}
    //     })
    //     console.log(this.fsm_config.OP_WEBSOCKET_TOKEN_WRITE+'websocket-write-token-list:'+JSON.stringify(list));
    //     GLOBAL_WEBSOCKET_WRITE_MAP = {flag:'loaded'}//更改为新的map
    //     for(let i =0;list && i<list.length;i++)
    //     {
    //         //刷新数据
    //         GLOBAL_WEBSOCKET_WRITE_MAP[list[i].token_y] = ""+list[i].opval;
    //     }
    //     return GLOBAL_WEBSOCKET_WRITE_MAP
    // }
    async send_msg2all_client(list)
    {
        let msg = JSON.stringify(list)
        for(let i=0;i<this.allDataSockList.length;i++)
        {
            if(this.allDataSockList[i] && this.allDataSockList[i].send)
            {
                this.allDataSockList[i].send(msg);
            }
        }
        //同步给已经订阅的token-ws-map
        try{
            let sendTokenMsgCnt = 0;
            let sendTokenMap = {}
            for(let i=0;list && list.length>0 && i<list.length;i++)
            {
                let tmpJSON = list[i]
                //是否已经订阅（由token来判断）
                if(!sendTokenMap[tmpJSON.token] && this.tokenDataSocketList[tmpJSON.token])
                {
                    console.log('tokenDataSocketList[tmpJSON.token]:'+tmpJSON.token)
                    this.tokenDataSocketList[tmpJSON.token].send(msg)
                    sendTokenMap[tmpJSON.token] = true
                    sendTokenMsgCnt++
                }
            }
            console.log('sendTokenMsgCnt:'+sendTokenMsgCnt)
        }catch(ex)
        {
            console.log(ex)
        }
        console.log('send webosock client cnt:'+this.allDataSockList.length)
    }

    //2022-8-6设置为订阅token模式（可以是parent，也可以仅仅是普通订阅者模式）。
    //-------------------以下是监听相关数据的ws-lisen-server（收到推送流之后，再给关注chatid的想着的user-id一个实时的反馈信息）。
    reCallListen()
    {
        this.reCallCnt++
        console.log('reCallListen-reCallCnt:'+this.reCallCnt)
        setTimeout(function(){
            this.wait(); 
        },5000+this.reCallCnt*1000)
    }

    async wait() {
        await str_filter.sleep(5000)
        let token  =  this.ws_listen_token// TOKEN_ROOT
        //需要维护一个token的http路由表（2022-8-6--全局的）
        //但是否公开，还是需要acckey和token_key或者是appid-secret_key等权限控制呢？
        // let parent_base_url =  'http://127.0.0.1:'+DOMAIN_PORT 
        let parent_base_url =  'http://127.0.0.1:'+this.DOMAIN_PORT //'http://ec2-52-81-96-59.cn-north-1.compute.amazonaws.com.cn:61000/node.lauo.valuetest'
        let wsRet = await  this.rpc_api_util.rpc_query(parent_base_url+'/op',
            {opcode:this.fsm_config.OP_WEBSOCKET_TOKEN,token_x:token,token_y:token,opval:'listen the msg from websocket',extra_data:''});

        console.log('wsRet:'+JSON.stringify(wsRet));
        wsRet.rpc_func_ret = JSON.parse(wsRet.rpc_func_ret);

        if(!wsRet|| !wsRet.ret || !wsRet.rpc_func_ret || !wsRet.rpc_func_ret.token) {
            this.reCallListen();
            return false;
        }

        //参考示例。
        // var sock = new ws("wss://cloud.forklist.dtns/cloud/ws/svr?token=e90562720a5be8c366376cab2699d28c6b5bb7e2f50202ff1509af17178e260f");
        this.sock = new ws(parent_base_url+'/super/websocket/link?token='+wsRet.rpc_func_ret.token);
        this.sock.on("open", function () {
            console.log("client open connect success !!!!");
            // sock.send("HelloWorld1");
        });

        this.sock.on("error", function(err,data) {
            console.log("client-socket-error: "+JSON.stringify( err)+" data:"+JSON.stringify(data));
        });

        let This = this
        this.sock.on("close", function(e) {
            console.log("client close:"+JSON.stringify(e));
            This.sock = null;
            //restart client 
            This.wait();
        });

        this.sock.on("message",async function(data) {
            console.log("client-socket-recv:"+data);

            //just test
            if(false)
            {
                let sentTest = This.sock.send(data);
            }


            //要将所有的订阅得到的数据，写入到本数据库中，要判断是否是经过核验的真实有效数据。
            if(This.ws_listen_token.indexOf('_0000000000000000') >0 )
                    return false;
            try{
                //return false;//现在有了global-write-map
                //应该还要进行校验。如果签名成功，写入到持久化队列
                //不核验是没办法敢于写入数据的，特别是要判断全部是子token数据
                let iNum = await This.chain_m.saveTXQueue2TokenChain(JSON.parse(data));//这个格式可能还需要判断2022-8-15
                console.log('save parent-token-rows-iNum:'+iNum)
                This.ws.send(JSON.stringify({ret:true,num:iNum,msg:'success'}))
            }catch(ex)
            {
                console.log('tx-rows from parent write to mydisk failed,ex:'+ex)
            }
        });

        //保持心跳包（5秒1次，保持不断开），否则1分钟之后会自动断开。
        setInterval(function(){
            try{
                if(This.sock)
                This.sock.send('keepalive')
            }catch(ex)
            {
                console.log('send keepalive failed,ex:'+ex)
                This.sock =null
                This.reCallListen()
            }
        },10000);
    }
    linkParentWS()
    {   
        console.log('linkParentWS now:')
        this.wait();
    }
    async send_msg2all_parent(list)
    {
        //如果连接父结点正确，发送内容。
        if(this.sock) this.sock.send(JSON.stringify(list))
    }

}

// module.exports = WebSocketController
window.WebSocketController = WebSocketController

    
    //if(!(TOKEN_ROOT.indexOf('_0000000000000000')>=0))
    //wait();