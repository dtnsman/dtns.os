// const str_filter = require('../libs/str_filter');
// const url = require('url')
// const http = require('http')
// const http_req = require('../libs/http_request')
// const {TXUtil,TokenUtil} = require('../dnalink.protocol/DNALinkProtocol')

class RPCApiUtil{
    constructor(protocol,isLocalReq = true){
        this.protocol = protocol
        this.root_config = this.protocol.root_config
        this.fsm_config = this.protocol.fsm_config
        // this.fsm_p = new DNALinkFSMContractProcessor(this.protocol)
        // this.tx_util = new TXUtil(this.protocol)
        // this.token_util = new TokenUtil(this.protocol)
        //this.coin_num_util = new CoinNumUtil(this.protocol)
        this.TOKEN_NAME = this.root_config.TOKEN_NAME
        this.TOKEN_ROOT = this.root_config.TOKEN_ROOT
        this.TOKEN_ID_LENGTH = this.root_config.TOKEN_ID_LENGTH
        this.DOMAIN_PORT = this.root_config.DOMAIN_PORT
        this.appids     = this.root_config.appids
        this.secret_keys= this.root_config.secret_keys

        console.log('this.rtc_client----roomid:'+this.protocol.roomid)
        this.rtc_client = isLocalReq ? null :new RTCClient(this.protocol.roomid,null,null,isLocalReq)
        this.isLocalReq = isLocalReq
    }


    /**
     * 封装的rpc请求。
     * @type {rpc_query}
     */
    async rpc_query(url,reqdata){
        reqdata = !reqdata ? {}:reqdata;

        //url = (''+url).indexOf('http')!=0 ? 'http://127.0.0.1:'+this.DOMAIN_PORT+url:url;

        if((!reqdata.token_key || !reqdata.access_key) && (!reqdata.appid || !reqdata.secret_key)
             && !(typeof g_dtns_network_client!='undefined' && g_dtns_network_client)) {
            reqdata.appid = this.appids[0]
            reqdata.secret_key = this.secret_keys[0]
        }
        reqdata.rpc_name = ''+this.DOMAIN_PORT
        // let ret = await http_req.http_post(url,reqdata);
        // console.log("rpc_query-url:"+url)
        // console.log("rpc_query-reqdata:"+JSON.stringify(reqdata))
        // // console.log("rpc_query-ret:"+ret)
        // // try {
        // // if (ret && ret.length != ('' + ret).length)
        // console.log("rpc_query-ret:" + JSON.stringify(ret))
        // }catch(ex)
        // {
        //     console.log('ex:'+ex)
        // }
        let obj = {callid:new Date().getTime()+'.'+parseInt(Math.random()*1000000000),
                url:this.DOMAIN_PORT+'::'+url,data:reqdata}
        obj.data.rpc_name=''+this.DOMAIN_PORT

        //2023-2-17新增，直接请求，不再经由网络请求。
        if(this.isLocalReq)
        {
            let req = {url,rpc_name:''+this.DOMAIN_PORT,params:reqdata}
            let ret = await new Promise((resolve)=>{
                defaultRTC.rpc_index_call(req,{is_dnalink_node_manager:true,json:function(obj){
                    resolve(obj)
                }})
                setTimeout(()=>resolve(null),30000)
            })
            return ret
        }
        else{
            let peerNow = this.rtc_client.peer()
            let This = this
            let ret = await new Promise((resolve)=>{
                This.rtc_client.sendData(peerNow,obj.url,obj.data,null,function(data){
                    console.log('send-data-callback:',data)
                    if(data && data.data)
                        resolve(data.data)
                    else
                        resolve(null)
                })
            })
            return ret;
        }
    }
    async rpc_file(url,reqdata,path){
        reqdata = !reqdata ? {}:reqdata;

        url = (''+url).indexOf('http')!=0 ? 'http://127.0.0.1:'+this.DOMAIN_PORT+url:url;

        if((!reqdata.token_key || !reqdata.access_key) && (!reqdata.appid || !reqdata.secret_key)) {
            reqdata.appid = this.appids[0]
            reqdata.secret_key = this.secret_keys[0]
        }

        let ret = await http_req.http_file(url,reqdata,path);
        console.log("rpc_query-url:"+url)
        console.log("rpc_query-reqdata:"+JSON.stringify(reqdata))
        // console.log("rpc_query-ret:"+ret)
        // try {
        // if (ret && ret.length != ('' + ret).length)
        console.log("rpc_query-ret:" + JSON.stringify(ret))
        // }catch(ex)
        // {
        //     console.log('ex:'+ex)
        // }

        return ret;
    }

    async postReq(reqUrl,postData) {
        let urlObj = url.parse(reqUrl)
        let  boundaryKey = '';
        if((''+postData).length>6)
        {
            let fixBoundaryKey = (''+postData).split("\r\n")[0]
            boundaryKey = fixBoundaryKey.substring(2,fixBoundaryKey.length)
        }
        console.log('postReq-host:'+urlObj.hostname+' port:'+urlObj.port+' path:'+urlObj.path)
        var options = {
            host:urlObj.hostname,//远端服务器域名
            port:urlObj.port,
            method:'POST',
            path:urlObj.path,//上传服务路径
            headers:{
                'Content-Type':'multipart/form-data; boundary=' + boundaryKey,
                'Connection':'keep-alive'
            }
        };
        let ret = null;
        await new Promise((resolve, reject) => {
            var req = http.request(options,function(res){
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    //resolve(chunk)
                    ret = chunk
                    console.log('body: ' + chunk);
                });
                res.on('end',function(){
                    resolve(ret)
                    console.log('res end.res:'+JSON.stringify(ret));
                });
            });
            req.end(postData);
        }).then((data)=>{
            console.log('http-req-res-data:'+data)
            ret = data;
        }).catch((ex)=>{
            console.log('http-req-res-ex:'+ex)
        })
        try{
            ret = JSON.parse(ret)
        }catch(ex)
        {
            console.log('ret-json failed,ex:'+ex)
        }
        return ret;
    }
    /**
     * 创建类似xxx_00000000userlist的token-id
     */
    create_token_name_last(TOKEN_ROOT,name)
    {
        if(!name) return name;
        let TOKEN_NAME = TOKEN_ROOT.split('_')[0]

        let len = name.length;
        if(len>0) return TOKEN_NAME+"_"+TOKEN_ROOT.substring((TOKEN_NAME+"_").length+len,TOKEN_ROOT.length)+name

        return name;
    }
    /**
     * 创建类似xxx_userlist00000000的token-id
     */
    create_token_name_pre(TOKEN_ROOT,name)
    {
        if(!name) return name;
        let TOKEN_NAME = TOKEN_ROOT.split('_')[0]

        let len = name.length;
        if(len>0) return TOKEN_NAME+"_"+name+TOKEN_ROOT.substring((TOKEN_NAME+"_").length+len,TOKEN_ROOT.length)

        return name;
    }
    /**
     * 按模板生成token-id
     * @type {s_query_token_id}
     */
    async s_query_token_id(API,ROOT,DST_TOKEN_NAME)
    {
        let TOKEN_NAME_PREFIX = ROOT.split('_')[0]
        let TOKEN_NAME = DST_TOKEN_NAME.length > 16 ? TOKEN_NAME_PREFIX+'_'+DST_TOKEN_NAME.split('_')[1] : TOKEN_NAME_PREFIX+'_'+DST_TOKEN_NAME
        let queryRet = await rpc_query(API+'/chain/opcode',{token:TOKEN_NAME,opcode:'fork',begin:0,len:1})
        if(!queryRet ||!queryRet.ret)
        {
            let forkRet = await rpc_query(API+'/fork',{token:ROOT,dst_token:TOKEN_NAME})
            if(!forkRet ||!forkRet.ret) return null;
        }
        return TOKEN_NAME;
    }

    /**
     * 创建一个新的token_id
     * @type {s_fork_token_id}
     */   
    async s_fork_token_id(API,ROOT,space)
    {
        let forkRet = await this.rpc_query(API+'/fork',{token:ROOT,space:space})
        if(!forkRet ||!forkRet.ret) return null;

        return forkRet.token_x;
    }

    /**
     * 保存数据
     * @type {s_save_token_info}
     */
    async s_save_token_info(API,ROOT,token,opcode,opval,extra_data)
    {
        let opRet = await this.rpc_query(API+'/op',{token_x:ROOT,token_y:token,opcode:opcode,opval:opval,extra_data:extra_data})
        if(!opRet ||!opRet.ret) return false;

        return true;
    }
    // app.all(MODULE_PATH+"/chain/relations/exists", chain_c.check_token_relations);
    /**
     * 判断是否相关。
     * @type {function(*, *=, *=, *=): *}
     */
    async s_check_token_list_related(API,token_x,token_y,opcode)
    {
        let existsRet = await this.rpc_query(API+'/chain/relations/exists',{token_x:token_x,token_y:token_y,opcode:opcode})
        return existsRet && existsRet.ret;
    }


    /**
     * 由/chain/relations查询list
     * @type {function(*, *=): Array}
     */
    async s_query_token_list(API, list_id,opcode,begin,len,isy,queryInfoFunc)
    {
        let isx = !isy ? true: false;
        begin = begin-0;
        len = !len ? 100000 :len
        let listRet = await this.rpc_query(API+'/chain/relations',{token:list_id,opcode:opcode,isx,begin:begin,len:len})
        let list = !listRet ||!listRet.ret ? [] : listRet.list;

        let objs = []
        let queryObjInfoP = []
        let i = 0
        for(;i<list.length;i++)
        {
            let info = list[i]
            // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
            //放到数组中，等待处理。
            let q_token_id = isy ? info.token_x: info.token_y
            //queryInfoFunc = null;
            queryObjInfoP.push(queryInfoFunc ?  queryInfoFunc(q_token_id): this.s_query_token_info(API,q_token_id,'assert'))
                //rpc_query(API+'/chain/opcode',{token:isy ? info.token_x: info.token_y,opcode:'assert',begin:0,len:1}))

            objs.push(info)
        }

        let newObjs = []
        //查询分类数据
        await Promise.all(queryObjInfoP).then(function(rets){
            console.log('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<objs.length;i++)
            {
                if(rets[i] ) {//&& rets[i].ret && rets[i].list && rets[i].list[0].txjson
                    try {
                        //console.log("opval:"+JSON.parse(rets[i].list[0].txjson).opval)
                        let newInfo = rets[i];//JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                        newInfo.token_y = list[i].token_y
                        newInfo.token_X = list[i].token_X
                        newObjs.push(newInfo)
                        continue;
                    }catch(e){
                        //newObjs.push(objs[i])
                        console.log('excaption:'+e)
                    }
                }
                else 
            // newObjs.push({main_id:objs[i].token_y})
                newObjs.push(objs[i])
            }
        })
        return newObjs;
    }

    /**
     * 保存到列表
     * @type {s_save_into_token_list}
     */
    async s_save_into_token_list(API, token_x,token_y,opcode,extra_data)
    {
        let opRet = await this.rpc_query(API+'/op',{token_x:token_x,token_y:token_y,opcode:opcode,opval:'add',extra_data:extra_data})
        if(!opRet ||!opRet.ret) return false;

        return true;
    }

    /**
     * 移出list
     * @type {s_save_into_token_list}
     */
    async s_del_from_token_list(API, token_x,token_y,opcode,extra_data)
    {
        let opRet = await this.rpc_query(API+'/op',{token_x:token_x,token_y:token_y,opcode:opcode,opval:'del',extra_data:extra_data})
        if(!opRet ||!opRet.ret) return false;

        return true;
    }

    /**
     * 查询token的info
     * @type {s_query_token_info}
     */
    async s_query_token_info(API, token,opcode)
    {
        let infoRet = await this.rpc_query(API+'/chain/opcode',{token: token,opcode:opcode,begin:0,len:1})
        if(!infoRet || !infoRet.ret) return null;

        let obj = null;
        try{
            obj = JSON.parse(JSON.parse(infoRet.list[0].txjson).opval);
        }catch(ex)
        {
            try{
                obj = JSON.parse(infoRet.list[0].txjson).opval
                console.log('token:'+token+" txjson:"+infoRet.list[0].txjson)
            }catch(ex0){}
        }
        return obj;//JSON.parse(JSON.parse(infoRet.list[0].txjson).opval)
    }

    /**
     * 得到内置一个relate-id（以便作为队列list-id存在）
     * @type {s_query_token_innerid}
     */
    async s_query_token_innerid(INFO_API,INFO_ROOT,API,ROOT,tokenid,opcode,innerIDName)
    {
        let info = await this.s_query_token_info(INFO_API,tokenid,opcode)
        if(!info) return null;//res.json({ret:false,msg:"info is empty"})
        // let mainProductListName = innerIDName;
        if(!info[innerIDName] || info[innerIDName].split('_')[1].length!=16) {
            // info[innerIDName] = await s_query_token_id(API,ROOT,create_token_name_pre(ROOT,innerIDName))//这里有一个严重的bug（会大量重复，只能用于一个main-id中）
            info[innerIDName] = await this.s_fork_token_id(API,ROOT,innerIDName)
            if(!info[innerIDName]) return   null;

            let updateRet = await this.s_save_token_info(INFO_API,INFO_ROOT,tokenid,opcode,JSON.stringify(info),info[innerIDName])
            if(!updateRet)   return null;
        }
        return info[innerIDName]
    }

    async s_query_token_innerid_space(INFO_API,INFO_ROOT,API,ROOT,tokenid,opcode,innerIDName)
    {
        let info = await this.s_query_token_info(INFO_API,tokenid,opcode)
        if(!info) return null;//res.json({ret:false,msg:"info is empty"})
        // let mainProductListName = innerIDName;
        if(!info[innerIDName] || info[innerIDName].split('_')[1].length!=16) {
            info[innerIDName] = await this.s_fork_token_id(API,ROOT,innerIDName)
            if(!info[innerIDName]) return   null;

            let updateRet = await this.s_save_token_info(INFO_API,INFO_ROOT,tokenid,opcode,JSON.stringify(info),info[innerIDName])
            if(!updateRet)   return null;
        }
        return info[innerIDName]
    }
}

window.RPCApiUtil = RPCApiUtil