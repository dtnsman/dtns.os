const io = require('socket.io-client')
const SimpleSignalClient = require('simple-signal-client')
// For testing on node, we must provide a WebRTC implementation
const wrtc = require('wrtc')
const str_filter = require('../libs/str_filter')
const http_req = require('../libs/http_request')
// const rpc_query = require('../rpc_api_config')

// const file_util = require('../libs/file_util')
function get_RTCHOST_TNS_SERVER_URL(){
const RTCHOST_TNS_SERVER_URL = g_tns_urls ? g_tns_urls[0] : 
    (typeof g_tns_default_url!='undefined' ? g_tns_default_url : 'https://groupbuying.opencom.cn:446') //'http://127.0.0.1:3000'//'https://groupbuying.opencom.cn:441'// 'http://127.0.0.1:3000'//
    return RTCHOST_TNS_SERVER_URL
}
async function queryTurnPwd(tns_url = null)
{
    if(ll_config.roomid=='dtns')
    {
        let time_x = ''+Date.now()
        let sign =  sign_util.getInnerMsgSign(time_x,g_dtns_hmac_key)
        let time_sign_base64 = sign//encodeURIComponent(sign)
        console.log('time_sign_base64:',time_sign_base64,time_x)
        window.g_turn_pwd = await
            http_req.http_post(tns_url ? tns_url+'/c' : get_RTCHOST_TNS_SERVER_URL()+'/c',//?timestamp='+time_x+'&sign='+encodeURIComponent(time_sign_base64), 
            {
                timestamp:time_x ,
                sign: time_sign_base64
            },{
                headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        return g_turn_pwd
    }else{
        var time_x = Date.now()
        var time_hash = await key_util.hashVal(''+time_x)
        console.log('queryTurnPwd-time_x:',time_x,time_hash)
        var sign = await key_util.signMsg(time_hash,dtns_root_keys.private_key)
        var time_sign_base64 = typeof Buffer!='undefined' ? Buffer.from(sign).toString('base64') : time_hash.toString(CryptoJS.enc.Base64)
        console.log('time_sign_base64:',time_sign_base64,time_x,sign)
        window.g_turn_pwd = await
            http_req.http_post(tns_url ? tns_url+'/c' : get_RTCHOST_TNS_SERVER_URL()+'/c',//?timestamp='+time_x+'&sign='+encodeURIComponent(time_sign_base64), 
            {
                timestamp:time_x ,
                sign: sign,
                web3name:ll_config.roomid
            },{
                headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        return g_turn_pwd
    }
}


const rtchost_iceconfig = {
    iceServers: typeof g_turn_server_config!='undefined' ? g_turn_server_config : [
      {
        urls:[
            'turn:groupbuying.opencom.cn:3478',
          ],
          username: 'user1',
          credential: 'YjXverJx231vJPok',
      }
    ],
    sdpSemantics: 'unified-plan'
  }
const defaultRTCHostRoomid = 'room'
const defaultRTCHostOptions = { forceNew:true,reconnection: true,timeout:3000,rejectUnauthorized: false,
    transports: ['websocket'],config:rtchost_iceconfig }

const defaultRTCHostRPCName = 'default'
class RTCHost
{
    constructor(roomid,tns_server_url,options)
    {
        this.roomid = roomid ? roomid:defaultRTCHostRoomid
        this.tns_server_url = tns_server_url?tns_server_url:get_RTCHOST_TNS_SERVER_URL()
        this.options = options ? options:defaultRTCHostOptions
        this.options.wrtc = wrtc
        this.initSvr()
        // setInterval(()=>{
        //     console.log('timer-client:',this.client,this.socket)
        // },2000)
    }
    setRPC(rpc,name=defaultRTCHostRPCName)
    {
        this.rpcMap.set(name,rpc)
        //this.rpc = rpc
    }
    rpc(name=defaultRTCHostRPCName){
        return this.rpcMap.get(name)
    }

    all(url,...etc)
    {
        this.rounterMap.set(url,async function(req,res){
            let i = 1, flag = true
            while(etc[i] && flag){
                if(i!=etc.length-1)
                {
                    flag = false
                    await new Promise((resolve)=>{
                        etc[i](req,res,function(){
                            flag = true
                            resolve(true)
                        })
                        setTimeout(()=>resolve(false),60000)
                    })
                }
                else etc[i](req,res)
                i++
            }
        })
    }
    //判断是否需要重连（可被sendData当peer is closed??!!时调用）
    async check_and_reconnect()
    {
        console.log('into check_and_reconnect',this.is_checking_flag)
        if(this.is_checking_flag) return 
        if(this.socket && this.socket.connected) return 
        // if(this.peer()) return //依然判断是否是peer已连接成功，如未连接成功，
        //而this.socket.connected = true，则依然有机构在5-10秒内进行再次this.init重试peer连接

        this.is_checking_flag = true
        let iCnt = 0
        while(this.is_checking_flag)
        {
            iCnt ++ 
            console.log('check_and_reconnect-iCnt:'+iCnt ,'socket-connected:',
                this.socket && this.socket.connected)
            try{await this.initSvr()}
            catch(ex){console.log('initSvr-exception:'+ex,ex)}
            await this.sleep(1000)
            if(this.socket && this.socket.connected)//2023-6-19，只要连接上了socket，则代表不是网络连接的问题 //以是否成功拿到turn-pwd为标志
            {
                await this.sleep(5000) //5秒内是否连是对应的client，如果无法连上，重启连接
                this.is_checking_flag = !(this.socket && this.socket.connected)// false// !(this.peer() || false) //如果是peer!=null，is_checking_flag则为false，不再继续循环
            }else{
                await this.sleep(2000)
                this.is_checking_flag = true //继续循环
            }
        }
    }
    async initSvr()
    {
        try{
            if(this.socket){
                this.socket.close()
            }

            this.dataCallBackSession = new Map()
            this.rpcMap = new Map()
            this.rounterMap = !this.rounterMap ? new Map() :this.rounterMap

            while(typeof g_dtnsManager == 'undefined' || !g_dtnsManager.web3apps)
                await this.sleep(100)
            let web3appInfo = await g_dtnsManager.nslookup('dtns://web3:'
                +g_dtnsManager.getOriginRoomID(this.roomid))
            if(window.g_dtns_network_static_hosts && window.g_dtns_network_static_hosts[this.roomid])
            {
                web3appInfo = {web3name:this.roomid,network_info:window.g_dtns_network_static_hosts[this.roomid]}
            }
            this.web3appInfo = web3appInfo
            console.log('rpc-client--init--web3appInfo:',web3appInfo,this.roomid)

            if(g_dtnsManager.getOriginRoomID(this.roomid)!='dtns' && (typeof g_rpc_host_muti_flag =='undefined' || typeof g_rpc_host_muti_flag !='undefined' && !g_rpc_host_muti_flag))
            this.tns_server_url = web3appInfo  && web3appInfo.network_info 
                && web3appInfo.network_info.tns_urls && web3appInfo.network_info.tns_urls.length>0
                ? web3appInfo.network_info.tns_urls[parseInt(Math.random()*159999)
                %web3appInfo.network_info.tns_urls.length]:this.tns_server_url

            //先获得turn-pwd
            let turnPWD = await queryTurnPwd(this.tns_server_url)
            console.log('turnPWD:',turnPWD)
            turnPWD = turnPWD && turnPWD.data ?turnPWD.data :turnPWD
            this.options.config.iceServers[0].username = turnPWD.username
            this.options.config.iceServers[0].credential = turnPWD.password
            this.options.config.iceServers[0].urls = g_turn_urls?g_turn_urls: this.options.config.iceServers[0].urls

            console.log('this.options:',this.options)

            this.socket =  io.connect(this.tns_server_url,this.options)

            let This =this;
            this.socket.on("connection", (socket) => {
                console.log('socket-connection:'+socket.id); // ojIckSD2jqNzOqIrAGzL
                if(socket  && socket.id)
                    This.discoverRoom()
            });
            this.socket.on("connect_error", async (err) => {
                //reconnection: true  保证了自动重连
                console.log('connect_error:'+err,err)
                await This.sleep(2000)
                This.check_and_reconnect()
                // if(!This.reconnect_flag)
                // {
                //     This.reconnect_flag = true;
                //     setTimeout(()=>{
                //         let iCnt = 150
                //         while(iCnt>0)
                //         {
                //             if(This.socket  && This.socket.id)
                //                     break;
                //             This.sleep(1000)
                //             iCnt = iCnt - 1
                //             console.log('retest socket-connection last-cnt:' + iCnt)
                //         }
                //         //尝试了多次之后，如果还是未能恢复连接，并重启
                //         if(!This.socket || !This.socket.id)
                //         {
                //             This.initSvr()
                //         }
                //         //不做自锁操作
                //         This.reconnect_flag = false;
                //     },3000) //延迟6秒重试
                // }
                // setTimeout(()=>This.initSvr(),3000)
            });
            
            // client-side
            this.socket.on("connect", () => {
                console.log('socket-connected:'+This.socket.id); // ojIckSD2jqNzOqIrAGzL

                //重连之后，要汇报当前的socket-id @2022-12-14-2
                //this.client.discover(this.roomid+'::host')
                if(This.socket  && This.socket.id)
                    This.discoverRoom()
            });
            
            console.log('io-connect:yes')
            this.client = new SimpleSignalClient(this.socket)
            console.log('SimpleSignalClient:yes')
            this.peerMap = new Map()
            
            this.client.on('request', async (request) => {
                console.log('request.initiator:'+JSON.stringify(request.initiator))
                console.log('request.metadata:'+JSON.stringify(request.metadata))
            
                // const { peer, metadata } = await request.accept({ test: 'b' }, config)
                // peer.on('connect', () => { // connect event still fires
                // })
            
                console.log('requested', request)
                const { peer } = await request.accept({}, This.options)
                let obj = {remoteAddress:peer.remoteAddress,remotePort:peer.remotePort}
                console.log('accepted:'+ JSON.stringify(obj));
                // if(obj.remoteAddress)
                    This.onPeer(peer)
                // else{
                //-----------2022-12-14不再创建多个peer（特别是host-client方向的peer）--一个就很稳定可靠
                    // if(peer.remoteAddress!='127.0.0.1')
                    // setTimeout(async function(){
                    //     let newPeer = await This.connectToPeer(request.initiator)
                    //     console.log('newPeer:'+newPeer)
                    //     This.onPeer(newPeer)
                    // },1500)
                // }
                //     try{
                //         peer.destroy()
                //     }catch(ex){console.log('peer.destory()-ex:'+ex)}
                // }
            })
            // this.discoverRoom()
        }catch(ex)
        {
            console.log('RPCHost.js--initSvr:ex:'+ex,ex)
        }
    }
    async discoverRoom()
    {
        if(this.roomid.indexOf('dtns-inner-room')==0)
        {
            this.client.discover(this.roomid+'::host')
        }else{
            let that = this
            let setRoomFunc = async function(){
                console.log('dtns_root_keys',dtns_root_keys)
                let roomid = 'web3:'+that.roomid+'|'+ parseInt(Date.now()/1000)
                console.log('web3-roomid:',roomid)
                let hash = await key_util.hashVal(roomid)
                let sign = await key_util.signMsg(hash,dtns_root_keys.private_key)
                that.client.discover(roomid+'|'+sign+'|::host')
            }
            if(typeof dtns_root_keys!='undefined')
            {
                setRoomFunc()
            }else 
                setTimeout(setRoomFunc,1500)
        }
    }

    async connectToPeer(peerID) {
        if (peerID == this.socket.id) return;
        try {
            console.log('Connecting to peer');
            const { peer } = await this.client.connect(peerID, this.roomid, this.options);
            this.peerMap.set(peer.channelName,peer)//将peer保存在map中，避免被回收。
            this.onPeer(peer)
            return peer
        } catch (e) {
            console.log('Error connecting to peer:'+e);
            return null;
        }
    }

    async getCallSessionData(data)
    {
        // let This = this
        let posKey = data.callid+':'+data.pos
        let writerKey = data.callid+':writer'
        let lastData = this.dataCallBackSession.get(data.callid)
        if(lastData=='') return //判断是否被清空，代表是重传的数据，不保存
        if(!lastData){ 
            data.recved_list = [data]
            this.dataCallBackSession.set(data.callid,data)
            this.dataCallBackSession.set(posKey,data)//first element
            lastData = data
            lastData.recved_size = data.len
            if(data.begin_str=='=file'){
                // let file_temp = __dirname + '/../dnalink.rpc/superdimension/file/file_temp/'+data.callid+'-'+Math.random()
                // let stream = require('fs').createWriteStream(file_temp)
                // let writer = {nowPos:-1,file_temp,stream,fileInfo:data.fileInfo,saved_size:0}
                // this.dataCallBackSession.set(writerKey,writer)

                // stream.on('open', () => {
                //     console.log('文件已被打开', stream.pending)
                // })
                // stream.on('ready', () => {
                //     console.log('文件已为写入准备好', stream.pending)
                // })
                // stream.on('close', () => {
                //     console.log('文件已被关闭')
                //     console.log("总共写入:"+ stream.bytesWritten)
                //     console.log('写入的文件路径是'+ stream.path)
                //     if(typeof stream.endCallback == 'function')
                //     {
                //         console.log('call stream-endCallback function now!')
                //         stream.endCallback()
                //     }else{
                //         console.log('do not have stream-endCallback function, stream may close not correct??!!!')
                //     }
                // })
            }
            // //如果长期收不到消息，将自动清理（因udp速度传输非常快，如果30s都恢复不了，则清理掉session-data--避免内存满）
            // let xid = setInterval(function(){
            //     let usedTime = new Date().getTime() - lastData.callsession_last_update_time
            //     if(usedTime >=30000)
            //     {
            //         clearInterval(xid)
            //         console.log('[notice]some error happen: we will clear the call-session-data:'+lastData.callid)
            //         This.dataCallBackSession.delete(xid)
            //     }
            // },5000)
        }else{
            lastData.recved_size0 += data.len
            if(this.dataCallBackSession.has(posKey))
                console.log('this pos is recved, posKey:'+posKey)
            else{
                lastData.recved_size += data.len
                lastData.recved_list.push(data)
                this.dataCallBackSession.set(posKey,data)//not first element
            }   
        }
        lastData.callsession_last_update_time = new Date().getTime()

        let recved_list=  lastData.recved_list
        // let writer = this.dataCallBackSession.get(writerKey)
        // //遍历快速写入数据
        // if(data.begin_str=='=file' && this.dataCallBackSession.has(writerKey)){
        //     let {nowPos,stream} = writer
        //     //先写入当前试试（如果pos不对，再遍历查询一次至多次）
        //     nowPos++//查找下一个
        //     let nowData = data.pos == nowPos ? data : null
        //     while(this.dataCallBackSession.has(data.callid+':'+nowPos)){//原来是true
        //         if(!nowData) nowData = this.dataCallBackSession.get(data.callid+':'+nowPos)
        //         // for(let i=0;i<recved_list.length;i++){ //因为没有排序之前，是乱序的，所有i=0开始查找
        //         //     if(nowPos == recved_list[i].pos){
        //         //         nowData = recved_list[i]
        //         //         break
        //         //     }
        //         // }
        //         if(nowData){ //成功写入数据
        //             stream.write(nowData.data)
        //             writer.saved_size += nowData.data.length
        //             console.log('当前写入：'+nowData.data.length)
        //             this.dataCallBackSession.set(data.callid+':'+nowPos,'') //清理掉关联映射的data，但是依然保留pos位置判断
        //             writer.nowPos++ //成功的计数
        //             nowPos++//查找下一个
        //             delete nowData.data //释放内存
        //             nowData.data = null
        //             nowData = null
        //         }
        //         else{
        //             console.log('unmatch pos:'+nowPos)
        //             break
        //         } 
        //     }
        // }

        if(data.max_pos == lastData.recved_list.length)
        {
            let newDataStr ='' , u8arr = data.begin_str=='=file' ?  new Uint8Array(data.fileInfo.size):null
            recved_list.sort((a,b)=>{
                return a.pos - b.pos
            })
            if(true)//lastData.begin_str!='=file')
            {
                for(let i=0,s=0;i<recved_list.length;i++)
                {
                    if(recved_list[i].pos!=i){
                        console.log('recved_list-data-error, by callid:'+recved_list[i].callid+' pos:'+i+' need-pos:'+lastData.recved_list[i].pos)
                        break;
                    } 
                    //处理binary-file
                    if(u8arr){
                        let tmpData = recved_list[i].data //避免多次对象访问（减少速度损耗）
                        let n = tmpData.length
                        u8arr.set(tmpData,s)//直接复制
                        s+=n
                        delete recved_list[i].data
                    }
                    else 
                        newDataStr += recved_list[i].data

                    this.dataCallBackSession.delete(recved_list[i].callid+':'+i)
                }
            }
            else{
                if(writer.nowPos+1!= lastData.max_pos || data.fileInfo.size != writer.saved_size)
                {
                    console.log('recved_list-data-error, unsaved enough data. now-saved-size:'+writer.saved_size+' need:'+data.fileInfo.size)
                }
                //等待文件正确的写入完整，然后关闭之。
                // await new Promise((resolve)=>{
                //     writer.stream.endCallback = function(){
                //         resolve(true)
                //     }
                //     writer.stream.end()
                //     writer.stream.close()
                // })
            }
            delete data.data
            delete lastData.recved_list
            console.log('recved-data-info:',data)//+JSON.stringify(data))
            // if(data.begin_str =='=file') data.fileInfo.file_temp = writer.file_temp
            // else 
            // data.data =u8arr ? u8arr : this.parseJSON( newDataStr)//this.parseJSON( newDataStr)// this.parseJSON( newDataStr)//
            if(u8arr && u8arr.length>0){ //文件的保存位置是path
                data.fileInfo.path = u8arr
                delete data.data
            }else{
                data.data = this.parseJSON( newDataStr)
            }

            //console.log('recved-data-info:',data)//+JSON.stringify(data))
			if(data.fileInfo)
            {
                // let tmpObj = Object.assign({},data)
                // delete tmpObj.fileInfo.path
                console.log('recved-data-info:',
                data.fileInfo && data.fileInfo.path ? data.fileInfo.path.length : data)//+JSON.stringify(data))
            }else console.log('recved-data-info:',data)

            // this.dataCallBackSession.delete(data.callid)
            this.dataCallBackSession.set(data.callid,'') //清空了
            // let This = this
            // setTimeout(function(){ //10s后再清理，因为有部分重传的包会导致重复出现文件打开和写入问题（网络不好的情况下问题较严重）
            //     delete lastData.recved_list
            //     This.dataCallBackSession.delete(data.callid)
            // },10000)

            console.log('recved-all-data:'+(data.fileInfo ? data.fileInfo.size:newDataStr.length))
            // let recvedData
            // console.log('recved-all-data:'+JSON.stringify(data).substring(0,10))
            return data;
        }

        return null;
    }
    async dataCallBack(peer,xdata)
    {
        // console.log('dataCallBack-xdata',xdata)
        let This = this
        // let xdata = this.parseJSON(data)
        let callid = xdata.callid
        console.log('dataCallBack-xdata-url:'+xdata.url+' callid:'+callid)
        if(xdata.url )//&& xdata.url.indexOf('/')==0)
        {
            let req = {params:xdata.data,files:[xdata.fileInfo]}
            if(xdata.fileInfo && xdata.fileInfo.size>0 && xdata.fileInfo.filename)
            {
                xdata.fileInfo.data = xdata.data
                delete xdata.data
                req.params = xdata.fileInfo.params //recover from the fileInfo
                delete xdata.fileInfo.params //清理掉密钥信息。
                //let fileInfo = {fieldname:"file",originalname:nowFile.name,mimetype:nowFile.mimetype,filename:nowFile.name,path:'file-path',size:nowFile.size,
                //data:base64file.substring(base64file.indexOf(',')+1,base64file.length)}
                xdata.fileInfo.originalname = xdata.fileInfo.originalname ? xdata.fileInfo.originalname : xdata.fileInfo.filename
                if(xdata.begin_str=='=file')
                {
                    //已经流式写入，不需要在一个地方统一写入了（减少时间等待和内存损耗）2022-12-6
                    // xdata.fileInfo.path = xdata.data ///xdata.fileInfo.file_temp//
                    // delete xdata.data//xdata.fileInfo.file_temp //删除掉
                }else{
                    //转存文件(base64)
                    let bstr = atob(xdata.fileInfo.data), n = bstr.length, u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    xdata.fileInfo.path = u8arr
                    delete xdata.fileInfo.data
                    // console.log('file-xdata:',xdata,xdata.fileInfo.path)
                    // let buff =  xdata.fileInfo.path atob(xdata.fileInfo.data)//fileInfo.data)////Buffer.from(xdata.fileInfo.data, 'base64'); 
                    // // let file_temp = __dirname+'/../dnalink.rpc/superdimension/file/file_temp/'+xdata.callid+'.'+Math.random()
                    // xdata.fileInfo.path =  buff//file_temp//在上述地方采用random来防止多个写入导致了问题
                    // await file_util.writeFile(file_temp,buff) //wait write file end!
                }
                delete xdata.fileInfo.data // must delete , if not ,will save to the token-chain-opval-fileInfo
            }
            let res = {}
            let func =async function(rdata,fileInfo=null)
            {
                if(!peer._pc){
                    console.log('peer is closed??!!!')
                    return 
                }
                //let rdataStr = JSON.stringify(rdata)
                let isFileBase64 = typeof rdata.fileInfo !='undefined'
                console.log('RPCHost-res.json:func-rdata-isFileBase64:',isFileBase64)
                let jsonStr =fileInfo?rdata: JSON.stringify(rdata);//JSON.stringify(rdata).length
                let ziped = false
                if(!fileInfo && jsonStr.length>200*1024 && !isFileBase64)//压缩普通json字符串
                {
                    let begin=Date.now()
                    var zip = new JSZip();
                    zip.file('json.txt',jsonStr)
                    let newjsonStr = await zip.generateAsync({
                        type: "base64",
                        compression: "DEFLATE", 
                        compressionOptions: {
                           level: 5 
                        }
                     })
          
                    // let newjsonStr= await zip.generateAsync({type : "string"});
                    console.log('zip-jsonStr.len:',jsonStr.length)//,jsonStr) //2024-6-17
                    console.log('zip-newjsonStr.len:',newjsonStr.length)//,newjsonStr)
                    if(jsonStr.length>newjsonStr.length){
                        jsonStr = newjsonStr
                        rdata = jsonStr //更新rdata
                        ziped = true
                    } 
                    console.log('zip-used-time:'+(Date.now()-begin))
                }
                let backData = {callid,ziped,max_len:jsonStr.length,len:jsonStr.length,pos:-1,max_pos:-1,fileInfo,data:rdata}
                //if(fileInfo) backData.fileInfo = fileInfo
                console.log('token_op_block-res.json:'+jsonStr.length)
                console.log('maxPkgSize:'+peer._pc.sctp.maxMessageSize)
                try{
                    if(jsonStr.length<peer._pc.sctp.maxMessageSize-1024*10){
                        //while(peer._channel.readyState!='open') await str_filter.sleep(5)
                        while(peer._channel.bufferedAmount>10*1024*1024) await str_filter.sleep(5)
                        //console.log('req.url:'+req.url+' ret-json:'+JSON.stringify(backData))
                        peer.send(JSON.stringify(backData))//jsonStr)
                    }
                    else{
                        console.log('into split rdata')
                        //peer.send(JSON.stringify({callid,data:{ret:false,msg:'json-length too length,size:'+jsonStr.length}}))
                        let rdataTmpSize =parseInt(peer._pc.sctp.maxMessageSize/2)+50*1024// parseInt((peer._pc.sctp.maxMessageSize+1023)/1024)*1024/2;// -1024*60 ;//1024*160// parseInt(peer._pc.sctp.maxMessageSize*3/2)//-128
                        let max_pos =  Math.floor((jsonStr.length+rdataTmpSize-1) /rdataTmpSize)
                        backData.max_pos=max_pos
                        for(let pos = 0,i=0;pos<jsonStr.length;pos+=rdataTmpSize,i++)
                        {
                            console.log('_channel.bufferedAmount:'+peer._channel.bufferedAmount)
                            backData.pos = i
                            let subStr = jsonStr.substring(pos,pos+rdataTmpSize)
                            backData.len = subStr.length
                            console.log('pos:'+i+' substr.len:'+subStr.length)
                            backData.data = subStr
                            //while(peer._channel.readyState!='open') await str_filter.sleep(5)
                            while(peer._channel.bufferedAmount>10*1024*1024) await str_filter.sleep(5)
                            peer.send(JSON.stringify(backData))
                        }
                    }
                    if(typeof g_node_side_event_bus!='undefined')
                    g_node_side_event_bus.emit('api-monitor',{url:xdata.url,req,result:backData})
                }catch(ex){
                    console.log('peer.send-exception:'+ex)
                }
            }
            res.json = res.file = func
            req.peer = peer
            res.stream = async function(rdata,pos,max_pos,fileInfo)
            {
                if(!peer._pc){
                    console.log('peer is closed??!!!')
                    return 
                }
                if(pos==-1)
                {
                    console.log('res.stream end.')
                    return 
                }
                //let rdataStr = JSON.stringify(rdata)
                let jsonStr =rdata//: JSON.stringify(rdata);//JSON.stringify(rdata).length
                let backData = {callid,max_len:fileInfo.size,
                    len:parseInt(rdata.length/4*3),pos,max_pos,fileInfo,data:rdata}
                //if(fileInfo) backData.fileInfo = fileInfo
                console.log('res.stream:'+jsonStr.length)
                console.log('maxPkgSize:'+peer._pc.sctp.maxMessageSize)
                try{
                    if(jsonStr.length<peer._pc.sctp.maxMessageSize-1024*10)
                    {
                        //while(peer._channel.readyState!='open') await str_filter.sleep(5)
                        while(peer._channel.bufferedAmount>10*1024*1024) await str_filter.sleep(5)
                        console.log('req.url:'+req.url+' ret-stream:'+rdata.length)
                        peer.send(JSON.stringify(backData))//jsonStr)
                    }else{
                        console.log('res.stream error:maxPkgSize > peer._pc.sctp.maxMessageSize??!!')
                    }
                }catch(ex){
                    console.log('peer.send-exception:'+ex)
                }
            }
            //未经base64转码的二进制字节流
            res.streamByte = async function(rdata,pos,max_pos,fileInfo)
            {
                if(!peer._pc){
                    console.log('peer is closed??!!!')
                    return 
                }
                if(pos==-1)
                {
                    console.log('res.stream end.')
                    return 
                }
                //let rdataStr = JSON.stringify(rdata)
                //let jsonStr =rdata//: JSON.stringify(rdata);//JSON.stringify(rdata).length
                let backData = {callid,max_len:fileInfo.size,
                    len:rdata.length,pos,max_pos,fileInfo}
                let jsonStr = JSON.stringify(backData)
                let jsonBuff= Buffer.from(jsonStr,'utf8')
                let strBegin = '=file'
                let writeBuffer = Buffer.alloc(strBegin.length+2+(''+jsonBuff.length).length//原来是jsonStr.length，这里在遇到utf8时有ubg
                    +(''+rdata.length).length)//+jsonStr.length)//+rdata.length)
                writeBuffer.write(strBegin,0,strBegin.length,'ascii')
                writeBuffer.writeUInt8((''+jsonBuff.length).length,strBegin.length)//write-length-string.size
                writeBuffer.writeUInt8((''+rdata.length).length,strBegin.length+1)
                writeBuffer.write(''+jsonBuff.length,strBegin.length+2,(''+jsonBuff.length).length,'ascii')//write-length-string
                writeBuffer.write(''+rdata.length,strBegin.length+2+(''+jsonBuff.length).length,
                    strBegin.length+2+(''+jsonBuff.length).length+(''+rdata.length).length,'ascii')
                //writeBuffer.write(jsonStr,'utf8')
                writeBuffer = Buffer.concat([writeBuffer, jsonBuff,rdata])

                //if(fileInfo) backData.fileInfo = fileInfo
                console.log('res.streamByte:'+writeBuffer.length)
                console.log('maxPkgSize:'+peer._pc.sctp.maxMessageSize)
                try{
                    if(writeBuffer.length<peer._pc.sctp.maxMessageSize-1024*10)
                    {
                        //while(peer._channel.readyState!='open') await str_filter.sleep(5)
                        while(peer._channel.bufferedAmount>10*1024*1024) await str_filter.sleep(5)
                        console.log('req.url:'+req.url+' ret-stream-len:'+writeBuffer.length)
                        peer.send(writeBuffer)//jsonStr)
                    }else{
                        console.log('res.stream error:maxPkgSize > peer._pc.sctp.maxMessageSize??!!')
                    }
                }catch(ex){
                    console.log('peer.send-exception:'+ex)
                }
                // await str_filter.sleep(100)
            }
            // this.rpc.token_op_block(req,res)
            if(!xdata.rpc_name)//优先从req中读取。
                req.rpc_name = xdata.url.indexOf('::')>0 ? xdata.url.split('::')[0]:defaultRTCHostRPCName
            else req.rpc_name = xdata.rpc_name
            req.url = xdata.url.indexOf('::')>0 ?xdata.url.split('::')[1]:xdata.url
            
            //由于websocket的Link连接使用的是token校验，不需要使用common_interceptor进行鉴权
            let lock_ret = typeof g_monitor_url_lock_filter =='function' ?  g_monitor_url_lock_filter(req):0
            if( lock_ret > 0 )
            {
                console.log('g_monitor_url_lock_filter-is-locked:',req.url,lock_ret)
                return res.json({ret:false,msg:'baned by api-monitor',lock:lock_ret})
            }else 
            if(req.url.indexOf('/ws/svr')>=0)
            {
                let ws = {ws_token:req.params.token}
                console.log('op-websocket-link-params:'+JSON.stringify(req.params))
                ws.on =function(msg,func){
                    switch(msg){
                        case 'message':
                            peer.wsMessageMap = peer.wsMessageMap ? peer.wsMessageMap:new Map()
                            peer.wsMessageMap.set(ws.ws_token,func)
                            break;
                        case 'close':
                            peer.closeWSList = peer.closeWSList ? peer.closeWSList:[];//break;
                            peer.closeWSList.push({ws,close:func})
                            break;
                    }
                }
                //返回结果。
                ws.send = function(msg)
                {
                    console.log('ws-send:'+JSON.stringify(msg))
                    msg = This.parseJSON(msg)
                    let msgObj = {ws:true,ws_token:ws.ws_token,data:msg}
                    try{
                        if(peer)
                        peer.send(JSON.stringify(msgObj))
                    }catch(ex)
                    {
                        console.log('RPCHost---ws.send-exception:'+ex,msgObj, ws)
                    }
                }
                ws.close = function(){
                    console.log('ws-close is called! on peer we will do nothing !!!')
                    if(typeof ws.closePeer == 'function')
                    ws.closePeer()
                }
                ws.closePeer=function(){
                    console.log('peer-ws-close is called!')
                    if(peer && peer.wsMessageMap)
                    peer.wsMessageMap.delete(ws.ws_token)

                    let closeWSList = peer.closeWSList
                    let tmpCloseWSList = []
                    for(let i=0;closeWSList&& i<closeWSList.length;i++ )
                    {
                        let tmp = closeWSList[i]
                        if(tmp.ws != ws) tmpCloseWSList.push(tmp)
                    }
                    peer.closeWSList = tmpCloseWSList
                }
                if(this.groupchat_c)
                    return this.groupchat_c.websocket_add_listener(ws,req)  //this.rpc.websocket_c.svr_service(ws,req)       
                else
                    return res.json({ret:false,msg:'[error]can not find matched-groupchat-websocket-controller'})
            }else{
                //先进行common_interceptor的过滤器和权限判断（含web3）2022-12-2
                console.log('now call common_interceptor, rpc_name:'+req.rpc_name+' req.url='+req.url)
                req.roomid = this.roomid
                if(this.rounterMap.has(req.url))//请求的是connector的接口
                {
                    let func = this.rounterMap.get(req.url)
                    if(typeof func =='function')
                    {
                        func(req,res)
                    }
                    else res.json({ret:false,msg:'[error]url-router-func is not function'})
                }else{
                    //查询链信息（3-17追加支持op接口---以便websocket可订阅消息）
                    if(req.url  && this.roomid.indexOf('dtns-inner-room') == 0 )
                    {
                        if(req.url.indexOf('/chain')==0)  //dtns-inner-room时
                        {
                            //使用了【根权限】进行查询
                            let ret = await rpc_query( DTNS_API_BASE+req.url,str_filter.get_req_data(req))
                            console.log('call dtns-req:',ret)
                            res.json(ret)
                        }
                        else res.json({ret:false,msg:'[error]url-router unmatch  url:'+req.url})
                    }
                    // else if(req.url && this.roomid == 'dtns'){  //直接外置了一个dtns.network（需验证相应的sign权限）
                    //     //需要自己的权限
                    //     //if( req.url == '/op' || req.url == '/send' || req.url == '/fork')

                    // }
                    else {
                        //2023-11-17新增，用于客户端进行ecc-keys转账等操作（并且支持通过ib3.node查询和操作dtns.network功能）
                        let params = str_filter.get_req_data(req)
                        console.log('into RPCHost-console_filter-url:',req.url,'params:',params)
                        let rpc_port = params.rpc_port
                        delete params.token_key
                        delete params.rpc_port 
                        //如果dtns.network的请求，则开放任其请求（注意rpc_port=80端口）
                        if(typeof g_ib3_node_open_inner_chain_flag !='undefined' && g_ib3_node_open_inner_chain_flag ||(''+rpc_port) == (''+window.dtns_config.root_config.DOMAIN_PORT))
                        {
                            if(!req.url) return res.json({ret:false,msg:'req.url is empty'})
                            //DTNS.NETWORK链查询操作
                            if(req.url.startsWith('/chain'))
                            {
                                //本地查询
                                let ret = await rpc_query( 'http://127.0.0.1:'+rpc_port+req.url,params)
                                console.log('call chain-query-req:',ret)
                                return res.json(ret)
                            }
                            //进行op、fork、send操作
                            else
                            {
                                let is_web3app = typeof g_dtns_network_client!='undefined' && g_dtns_network_client
                                if(is_web3app)
                                {
                                    if((''+rpc_port) == (''+window.dtns_config.root_config.DOMAIN_PORT))
                                    {
                                        let ret = await dtns_network_rtc_api.rpc_query(req.url,params)//TXINFO
                                        return res.json(ret)
                                    }else if(typeof g_ib3_node_open_inner_chain_flag !='undefined' && g_ib3_node_open_inner_chain_flag){
                                        req.rpc_name = ''+rpc_port
                                        //连接第一个dtns.network，这里须判断权限的
                                        if(defaultRTC.rpc(req.rpc_name))
                                        {
                                            defaultRTC.rpc(req.rpc_name).common_interceptor(req,res,function(){
                                                defaultRTC.rpc_index_call(req,res)})
                                        }
                                        else res.json({ret:false,msg:'[error]can not find matched-rpc'})
                                        // 
                                    }else{
                                        res.json({ret:false,msg:'[error]can not find matched-rpc'})
                                    }
                                }else{
                                    req.rpc_name = ''+rpc_port
                                    //连接第一个dtns.network，这里须判断权限的
                                    if(g_defaultDTNSRTCArray[0].rpc(req.rpc_name))
                                    {
                                        g_defaultDTNSRTCArray[0].rpc(req.rpc_name).common_interceptor(req,res,function(){
                                            g_defaultDTNSRTCArray[0].rpc_index_call(req,res)})
                                    }
                                    else res.json({ret:false,msg:'[error]can not find matched-rpc'})
                                }
                                return 
                            }
                        }
                        //判断是不是控制台管理员权限 on 2023-3-29-----用于客户端的备份工作
                        //2023-6-20新增，如不须管理员权限，则谁都可访问（亦支持vip模式）
                        //非dtns.network的请求（则须判断权限）
                        let chainSyncFunc = async function(){
                            if(req.url.indexOf('/chain')==0)  //仅支持查询功能----用于归档节点数据等。
                            {
                                let ret = await rpc_query( 'http://127.0.0.1:'+rpc_port+req.url,params)
                                console.log('call chain-query-req:',ret)
                                res.json(ret)
                            }else if(req.url=='/op' && params.opcode=='websocket')//仅支持订阅websocket通道 
                            {
                                let ret = await rpc_query( 'http://127.0.0.1:'+rpc_port+req.url,params)
                                console.log('call chain-query-req:',ret)
                                res.json(ret)
                            }
                            else if(req.url=='/super/websocket/link')
                            {
                                let ws_token = params.token
                                console.log('into RPCHost-console-/super/websocket/link:',ws_token)
                                //做一下ws_token绑定回调，方便接收ws-send消息
                                rpc_client.setWs(ws_token,function(msg){
                                    console.log('RPCHost-console-ws-send:'+JSON.stringify(msg))
                                    msg = This.parseJSON(msg)
                                    let msgObj = {ws:true,ws_token:ws_token,data:msg}
                                    try{
                                    if(peer)
                                        peer.send(JSON.stringify(msgObj))
                                    }catch(pex)
                                    {
                                        console.log('RPCHost-websocket.ws-send-exception:'+pex)
                                    }
                                })
                                rpc_query( 'http://127.0.0.1:'+rpc_port+req.url,params)
                            }
                            else res.json({ret:false,msg:'[error]url-router unmatch  url:'+req.url})
                        }
                        if(! ( (typeof g_dnalink_node_allow_user_sync != 'undefined' && g_dnalink_node_allow_user_sync)
                            || (typeof g_dnalink_node_allow_vip_sync != 'undefined'  && g_dnalink_node_allow_vip_sync) ) )
                        {   
                            console.log('g_dnalink_node_allow_user_sync is false, and call console_filter->chainSyncFunc')
                            console_filter(req,res,chainSyncFunc)
                        }
                        else if(typeof g_dnalink_node_allow_vip_sync != 'undefined' && g_dnalink_node_allow_vip_sync){
                            console.log('g_dnalink_node_allow_vip_sync is true, and call vip_filter->chainSyncFunc')
                            //强制指定须vip访问权限判断的chatid（主要是判断是否是该chatid成员，并且判断VIP权限）
                            req.params.chatid = typeof g_dnalink_node_allow_vip_sync_params_chatid !='undefined' ? g_dnalink_node_allow_vip_sync_params_chatid : null 
                            vip_filter(req,res,chainSyncFunc)
                        }
                        else if(typeof g_dnalink_node_allow_user_sync != 'undefined'  && g_dnalink_node_allow_user_sync)
                        {
                            console.log('g_dnalink_node_allow_user_sync is true, and call direct->chainSyncFunc')
                            //须检查是否有登录状态--session校验
                            if(typeof g_dnalink_node_allow_user_sync_no_login !='undefined' && g_dnalink_node_allow_user_sync_no_login)
                            {
                                let {user_id,s_id} = str_filter.get_req_data(req)
                                let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
                                if(!str)
                                {
                                    let result = {ret:false,msg:"session error"}
                                    console.log('chainSyncFunc--check-session-result:'+JSON.stringify(result))
                                    return res.json(result)
                                }
                            }
                            chainSyncFunc()
                        }
                        else res.json({ret:false,msg:'chainSyncFunc-->[error]url-router unmatch  url:'+req.url})
                    }
                }
            }       
        }
    }
    //关联
    setChatC(groupchat_c)
    {
        this.groupchat_c = groupchat_c
    }
    setPeerRefreshCallback(func)
    {
        this.peerRefreshCallback = func
    }
    onPeer(peer) {
        try{
            var This = this;
            console.log('onPeer1111');
            peer.on('connect', () => {
                console.log('peer is connected')
                if(typeof This.peerRefreshCallback =='function'){
                    This.peerRefreshCallback()
                }
            })
            peer.on('error',(err)=>{
                console.log('RPCHost---error:'+err,peer)
                // setTimeout(()=>This.initSvr(),3000) //这个客户端被断开（退出登录等），也会重连（故注释掉）
            })
			//2023-5-16尝试修复Error: cannot signal after peer is destroyed(at Peer.signal (/home/www/forklist.network/node_modules/simple-peer/index.js:184:39))的BUG
            peer.oldSignalFunc =  peer.signal
            peer.signal = function(data)
            {
                try{
                    peer.oldSignalFunc(data)
                }catch(ex){
                    console.log('peer.signal-exception:'+ex,ex)
                    if((''+ex).indexOf('cannot signal after peer is destroyed')>=0)
                    {
                        console.log('reinit the host-node')
                        This.initSvr()
                    }
                }
            }
            peer.on('close', () => {
                console.log('RPCHost---rtc-peer-close now!',peer)
                setTimeout(function(){
                    try{
                        peer.send('test-alive')
                    }catch(ex)
                    {
                        console.log('send-alive-test:exception:'+ex,ex)
                        This.peerMap.delete(peer.channelName)

                        let closeWSList = peer.closeWSList
                        for(let i=0;closeWSList&& i<closeWSList.length;i++ )
                        {
                            let tmp = closeWSList[i]
                            if(typeof tmp.close == 'function')
                                    tmp.close()
                            tmp.ws.closePeer()//这里使用的是closePeer（on-peer里的close()）
                        }
                    }
                },1000)
                // setTimeout(()=>This.initSvr(),3000)
            });
            /*let xid = setInterval(() => {
                if(!peer.writable) clearInterval(xid)
                console.log('send msg to peer')
                try{
                    if(peer.localAddress && peer.remoteAddress && peer.writable)
                    peer.send('my-ip:'+peer.localAddress+'('+peer.localPort+') your-ip:'+peer.remoteAddress+'('+peer.remotePort+')')
                    // var crypto = require('crypto');
                    // var buf = crypto.randomBytes(1024*30)
                    // peer.send(buf.toString('hex'))
                    //支持发送大文本数据
                }catch(ex)
                {
                    console.log('ex:'+ex)
                    console.log(peer)
                    clearInterval(xid)
                }
            }, 3000);
    
            peer.on('data',(data)=>{
                    console.log('recv data:'+data)
                    if(data.indexOf('recv')<0 && peer.writable)
                    peer.send('recved---'+data)
                    // that.log(peer)
                })
                */
            peer._channel.onerror = (event) => { 
                console.log('_channel.onerror',event)
            };
            peer.on('data', async (data)=>{
                console.log('recv data:'+data.length)//+' is:'+data.slice(0,2).indexOf('{'))
                if(data.slice(0,2).indexOf('{')==0)//.indexOf('{')==0)
                {
                    data = This.parseJSON(data)
                    console.log('data-ws_token:'+data.ws_token+' data=parseJson:',data,data.data)
                    if(data.ws_token && (data.ws_token).length>12)//判断是否是websocket的标志。
                    {
                        if(!peer.wsMessageMap){
                            peer.send(JSON.stringify({ws_token:data.ws_token,
                                ret:false,msg:'websocket not link'}))
                            return 
                        }
                        let recv = peer.wsMessageMap.get(data.ws_token)
                        if(typeof recv !='function'){
                            peer.send(JSON.stringify({ws_token:data.ws_token,
                                ret:false,msg:'websocket not link, recv-function undefined'}))
                            return 
                        }
                        //收到消息
                        recv(data.msg)
                    }
                    //处理普通消息----主要是其他的url的其他消息
                    else{
                        if(data.len == data.max_len){
                            This.dataCallBack(peer,data)
                        }else{
                            let receivedData= await This.getCallSessionData(data)
                            console.log('receivedData:',receivedData)//+JSON.stringify(receivedData))
                            if(receivedData){
                                This.dataCallBack(peer,receivedData)
                            }
                        }
                    }
                }else if(data.slice(0,8).indexOf('=file')==0){
                    console.log('recv-binary:'+data.length)
                    // console.log('typeof'+(typeof data))
                    let strBegin='=file'
                    let paramsSize =data.readUInt8(strBegin.length)//strBegin.length]// parseInt()
                    let pkgSize = data.readUInt8(strBegin.length+1)//data[strBegin.length+1]//parseInt(data[])
                    // console.log('paramsSize:'+paramsSize)
                    // console.log('pkgSize:'+pkgSize)

                    let paramLength = parseInt(data.slice(strBegin.length+2,strBegin.length+2+paramsSize).toString('ascii'))
                    let pkgLength = parseInt(data.slice(strBegin.length+2+paramsSize,strBegin.length+2+paramsSize+pkgSize).toString('ascii'))
                    // console.log('paramLength:'+paramLength)
                    // console.log('pkgLength:'+pkgLength)
                    
                    let paramStr = data.slice(strBegin.length+2+paramsSize+pkgSize,strBegin.length+2+paramsSize+pkgSize+paramLength).toString()
                    let buff = data.slice(strBegin.length+2+paramsSize+pkgSize+paramLength,strBegin.length+2+paramsSize+pkgSize+paramLength+pkgLength)
                    
                    let params = JSON.parse(paramStr)
                    if(strBegin.length+2+paramsSize+pkgSize+paramLength+pkgLength!= data.length && !This.dataCallBackSession.has(params.callid+':'+params.pos))
                    {
                        console.log('read data pkg error! happen on length:'+(strBegin.length+2+paramsSize+pkgSize+paramLength+pkgLength)+' need:'+data.length)
                        console.log('params-len:'+params.len+' buff-length:'+buff.length+' pos:'+params.pos)
                        
                        if(!peer._pc){
                            console.log('peer is closed??!!! send readSlice back')
                            return 
                        }
                        // 这里使用readslice模式进行判断了，不再需要此处逻辑
                        //let strBegin = '=file'

                        // if(This.dataCallBackSession.has(params.callid)){
                        //     console.log('read data pkg error! but this pos has already recved, pos='+params.pos)
                        //     return 
                        // } 

                        let strParams = JSON.stringify({callid:params.callid,read_slice:params.pos})
                        let writeBuffer = Buffer.alloc(strBegin.length+strParams.length)
                        writeBuffer.write(strBegin,0,strBegin.length,'ascii')
                        writeBuffer.write(strParams,strBegin.length,strBegin.length+strParams.length,'ascii')
 						peer.send(writeBuffer)
                        // setTimeout(function(){
                        //     peer.send(writeBuffer)
                        // },100)//100ms后再发送一次，共发送两次（确保能收到readSlice消息）

                        return //这里数据收集不全，不能进入session记录环节，会导致数据包保存为文件时文件大小出错（也会导致下载失败）。
                    }
                    //console.log('params:'+JSON.stringify(params))
                    params.data =buff// btoa(encodeURI(buff))
                    params.begin_str = '=file'
                    
                    let receivedData= await This.getCallSessionData(params)
                    //console.log('receivedData:'+JSON.stringify(receivedData))
                    // let cntID = null, nowListLen = 0, failedCnt = 0
                    if(receivedData){
                        // console.log('receivedData:',receivedData)//+JSON.stringify(receivedData))
                        clearInterval(receivedData.cntID)
                        This.dataCallBack(peer,receivedData)
                    }
                    // else
                    {//返回速度计算（每收到一个包，就返回一个确认包，确保上传的正确性
                        let lastData = This.dataCallBackSession.get(params.callid)//params;//
                        if(lastData=='') { //hack the data  ；返回确认的结果（避免使用setTimeout函数）
                            lastData = {callid:params.callid,recved_size:params.max_len,recved_list:{length:params.max_pos}}
                        } 
                        // if(!lastData.cntID)
                        {
                            if(!peer._pc){
                                console.log('peer is closed??!!! send cnt back')
                                return 
                            }
                            //if(!lastData || !lastData.recved_list || lastData.recved_list.length<=1) return 
                            let strBegin = '=file'
                            let strParams = JSON.stringify({callid:lastData.callid,
                                    recved_size:lastData.recved_size,recved_len:lastData.recved_list.length,pos:params.pos})
                            let writeBuffer = Buffer.alloc(strBegin.length+strParams.length)
                            writeBuffer.write(strBegin,0,strBegin.length,'ascii')
                            writeBuffer.write(strParams,strBegin.length,strBegin.length+strParams.length,'ascii')
                            peer.send(writeBuffer)
                        }
                    }
                }
            })
            this.peerMap.set(peer.channelName,peer)
        }catch(ex)
        {
            console.log('ex:'+ex)
        }
    }
    rpc_index_call(req,res)
    {
        if(!this.rpc(req.rpc_name)) return res.json({ret:false,msg:'inner error:RPC instance not inited'})
        switch(req.url)
        {
            case '/fork':return this.rpc(req.rpc_name).fork_token_block(req,res);
            case '/send':return this.rpc(req.rpc_name).token_send_block(req,res);
            case '/op':return this.rpc(req.rpc_name).token_op_block(req,res);
            case '/chain/query':return this.rpc(req.rpc_name).query_chain(req,res);
            case '/chain/opcode':return this.rpc(req.rpc_name).query_token_chain_bytoken_opcode(req,res);
            case '/chain/relations':return this.rpc(req.rpc_name).query_token_relations(req,res);
            case '/chain/relations/exists':return this.rpc(req.rpc_name).check_token_relations(req,res);
            case '/chain/map/keys':return this.rpc(req.rpc_name).query_token_map_keys(req,res);
            case '/chain/map/values':return this.rpc(req.rpc_name).query_token_map_key_values(req,res);
            case '/chain/map/value':return this.rpc(req.rpc_name).query_token_map_value(req,res);
            case '/chain/token':return this.rpc(req.rpc_name).query_token_chain_bytoken(req,res);
            case '/chain/txid':return this.rpc(req.rpc_name).query_token_chain_bytxid(req,res);
            case '/chain/states':return this.rpc(req.rpc_name).query_token_states(req,res);
            default:
                if(req.url.indexOf('/chain/file/')==0)return this.rpc(req.rpc_name).file_c.download_file(req,res);
                else return res.json({ret:false,msg:'url:'+req.url+' have no rpc-function'})
        }
    }
    parseJSON(d)
    {
        try{
            return JSON.parse(d)
        }catch(ex)
        {
            console.log('parseJSON-ex:'+ex)
            return d
        }
    }
    sleep(ms){
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

window.RTCHost = RTCHost