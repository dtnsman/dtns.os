// const io = require('socket.io-client')
// const SimpleSignalClient = require('simple-signal-client')
// // For testing on node, we must provide a WebRTC implementation
// const wrtc = require('wrtc')
const CLIENT_CONFIG_TNS_SERVER_URL = 'https://groupbuying.opencom.cn:441'//'http://127.0.0.1:3000'// 'http://127.0.0.1:3000'//

const rpcclient_iceconfig = {
    iceServers: typeof g_turn_server_config!='undefined' ? g_turn_server_config : [
      {
        urls: [
            'turn:groupbuying.opencom.cn:3478',
          ],
          username: 'user1',
          credential: 'YjXverJx231vJPok',
      }
    ],
    sdpSemantics: 'unified-plan'
  }
const defaultRPCClientRoomid = 'room'
const defaultRPCClientOptions = { forceNew:true,reconnection: true,timeout:3000,rejectUnauthorized: false,
    transports: ['websocket'],config:rpcclient_iceconfig,stream: false,streams: [],
    //channelConfig:{ordered:false} 
 }

class RPCClient
{
    constructor(roomid,tns_server_url,options,isLocalReq = true)
    {
        this.roomid = roomid ? roomid:defaultRPCClientRoomid
        this.tns_server_url = tns_server_url?tns_server_url:CLIENT_CONFIG_TNS_SERVER_URL
        this.options = options ? options:defaultRPCClientOptions
        // this.options.wrtc = wrtc
        this.chunkSize = 150*1024
        this.isLocalReq = isLocalReq
        this.init()
    }

    init()
    {
        if(this.socket){
            this.socket.close()
        }
        this.socket = this.isLocalReq ? null: io.connect(this.tns_server_url,this.options)
        this.dataCallBackSession = new Map()
        this.dataCallBackFunctions=new Map()
        this.fastPeer = null
        this.peerMap = new Map()
        this.pingTestCnt = 0
        this.pingTestAllCnt=4
        this.hostid = null
        this.clientPeer = null
        this.fastPeer = null
        this.hostPeer = null
        this.wsMap = new Map()
        if(this.isLocalReq) return 

        let This =this
        this.socket.on("connection", (socket) => {
            console.log('socket.id:'+socket.id,socket); // ojIckSD2jqNzOqIrAGzL
          });
        this.socket.on("connect_error", (err) => {
            console.log('connect_error:'+JSON.stringify(err))
            // setTimeout(()=>This.init(),3000)
        });
          
        // client-side
        this.socket.on("socket-connect", () => {
            console.log('connect:'+This.socket.id,This.socket); // ojIckSD2jqNzOqIrAGzL
            // This.testQuery(function(data){
            //     console.log('connected - download-data-length:'+data.length)
            // })
        });
        
        console.log('io-connect:yes')
        this.client = new SimpleSignalClient(this.socket)
        console.log('SimpleSignalClient:yes')
        
        this.client.on('request', async (request) => {
            console.log('request.initiator:'+JSON.stringify(request.initiator))
            console.log('request.metadata:'+JSON.stringify(request.metadata))
            if(request.initiator!=This.hostid )
            {
                console.log('[Error]request.initiator is not hostid:'+This.hostid)
                request.reject('[Error]request.initiator is not hostid:'+This.hostid)
                return 
            }
        
            // const { peer, metadata } = await request.accept({ test: 'b' }, config)
            // peer.on('connect', () => { // connect event still fires
            // })
        
            console.log('requested', request)
            const { peer } = await request.accept({}, This.options)
            let obj = {remoteAddress:peer.remoteAddress,remotePort:peer.remotePort}
            console.log('accepted:'+ JSON.stringify(obj),peer);
            This.hostPeer = peer
            This.onPeer(peer)
        })

        this.client.on('discover', (discoveryData) => {
            console.log('discovered', discoveryData)
            if(discoveryData.hostid){ 
                This.hostid = discoveryData.hostid
                This.connectToPeer(discoveryData.hostid)
                // setTimeout(()=>{
                //     This.connectToPeer(discoveryData.hostid)
                // },1000)
                // setTimeout(()=>{
                //     This.connectToPeer(discoveryData.hostid)
                // },2000)
            }
            else{ 
                console.log('error: hostid-unexist-in-the-room')
                setTimeout(()=>This.init(),3000)
            }
        });

        this.client.discover(this.roomid)
    }

    async connectToPeer(peerID) {
        if (peerID == this.socket.id) return;
        try {
            console.log('Connecting to peer');
            const { peer } = await this.client.connect(peerID, this.roomid, this.options);
            console.log('connectToPeer-ok:',peer)
            this.clientPeer = peer
            this.onPeer(peer)
            
            //this.map.set(peer,peer)//将peer保存在map中，避免被回收。
            //this.peerMap.set(peer.channelName,peer)
            return peer
        } catch (e) {
            console.log('Error connecting to peer:'+e);
            this.init()
            return null;
        }
    }

    async dataCallBack(peer,data)
    {
        if(this.dataCallBackFunctions.has(data.callid))
        {
            if(data.ziped)
            {
                let begin = Date.now()
                let zip = new JSZip();
                let oldData = data.data
                let binaryData = this.dataURLtoBinary(oldData).buffer
                let fileZip = await zip.loadAsync(binaryData)//zip.file("tmp.txt",oldData)
                let newData = await (fileZip.file("json.txt").async("string"))
                console.log('zip-oldData-len:',oldData.length)
                console.log('zip-newData-len:',newData.length)
                try{
                    data.data = JSON.parse( newData )
                }catch(ex){
                    console.log('zip-data-JSON.parse-ex:'+x)
                    data.data = newData
                }
                console.log('zip-used-time:'+(Date.now()-begin))
            }
            let callback =  this.dataCallBackFunctions.get(data.callid)
            if(typeof callback == 'function')
            {
                callback(data)
            }
        }
        let that = this
        let usedTime = new Date().getTime()- data.callid
        console.log('usedTime:'+usedTime+' channelName:'+peer.channelName)
        if(that.pingTestCnt > that.pingTestAllCnt) return 

        let timeObj = that.peerMap.get(peer.channelName)
        //console.log('timeObj:'+timeObj,peer,timeObj)//onPeer this.peerMap.set(peer.channelName,peer)
        if(!timeObj.usedTime || timeObj.usedTime>usedTime ) timeObj.usedTime = usedTime//(usedTime +(timeObj.usedTime?timeObj.usedTime:0))/2 //更新用时
        
        that.pingTestCnt ++
        if(that.pingTestCnt==that.pingTestAllCnt)
        {
            let keyPeer = null,minTime = 0;
            that.peerMap.forEach(function(value, key) {
                    if(!keyPeer) {
                        keyPeer = key
                        minTime = value.usedTime
                    }else{
                        if(value.usedTime<minTime)
                        {
                            keyPeer = key
                            minTime = value.usedTime
                        }
                    }
                    console.log('key:'+key+' minTime:'+minTime+' value.usedTime:'+value.usedTime)
                })
                that.fastPeer = that.peerMap.get(keyPeer)
                console.log('minTime:'+minTime+' fastPeer:',that.fastPeer)

            //为了确保连接，暂时不清理。
            //that.client.peers().forEach((peer)=>{if(that.fastPeer!=peer) peer.destroy()})
        }
    }
    getCallSessionData(data)
    {
        if(data.begin_str == '=count')//统计速率
        {
            let timeUsed =  parseInt((new Date().getTime()- data.callid )/1000) //按秒计算
            let radio = Math.round( data.recved_size*1.0 / timeUsed ,2) //速率
            this.dataCallBackSession.set(data.callid+':radio',radio)

            //得到当前的调用的callback.
            let func = this.dataCallBackFunctions.get(data.callid+':check')
            if(typeof func == 'function'){
                func(data)
            }

            return 
        }
        else if(data.begin_str == '=slice')//读取对应的偏移位置的数据。
        {
            // console.log('not need resend by server =slice req!')
            this.sendSliceFile(data.callid,data.read_slice)////已经使用readSlice模式进行每个chunkSize的发送确认，不再需要此重发逻辑
            return ;
        }
        // let This = this
        let posKey = data.callid+':'+data.pos
        let lastData = this.dataCallBackSession.get(data.callid)
        if(!lastData){ 
            data.recved_list = [data]
            this.dataCallBackSession.set(data.callid,data)
            this.dataCallBackSession.set(posKey,'')//first element
            lastData = data
        }else{
            if(this.dataCallBackSession.has(posKey)){
                lastData.muti_recved_cnt = lastData.muti_recved_cnt ? lastData.muti_recved_cnt+1 :1
                console.log('this pos is recved, posKey:'+posKey+', size:'+data.data.length)
            }
            else{
                lastData.recved_list.push(data)
                this.dataCallBackSession.set(posKey,'')//not first element
            }   
        }
        console.log('max_pos:'+data.max_pos+' now-recved-list-len:'+lastData.recved_list.length)
        // lastData.callsession_last_update_time = new Date().getTime()

        if(data.max_pos == lastData.recved_list.length)
        {
            let newDataStr ='' , u8arr = data.begin_str=='=file' ?  new Uint8Array(data.fileInfo.len ? data.fileInfo.len:data.fileInfo.size):null
            let recved_list = lastData.recved_list
            recved_list.sort((a,b)=>{
                return a.pos - b.pos
            })
            let s = 0
            for(let i=0;i<recved_list.length;i++)
            {
                if(recved_list[i].pos!=i){
                    for(let k=i;k<recved_list.length;k++)
                        console.log('need-pos:'+k+' but is '+recved_list[k].pos)
                    console.log('recved_list-data-error, by callid:'+lastData.recved_list[i].callid+' pos:'+i+' need-pos:'+lastData.recved_list[i].pos)
                    break;
                } 
                //处理binary-file
                if(u8arr){
                    let tmpData = lastData.recved_list[i].data //避免多次对象访问（减少速度损耗）
                    let n = tmpData.length
                    u8arr.set(tmpData,s)//直接复制
                    s+=n
                    delete lastData.recved_list[i].data
                }
                else newDataStr += lastData.recved_list[i].data
                this.dataCallBackSession.delete(lastData.recved_list[i].callid+':'+i)
            }
            delete data.data
            delete lastData.recved_list
            clearInterval(lastData.call_xid)
            u8arr = s>0 && s!=u8arr.length ? u8arr.slice(0,s):u8arr //特别针对readSlice--服务端的情况下
            console.log('recved-data-info:'+JSON.stringify(data))
            data.data = u8arr ? u8arr : this.parseJSON( newDataStr)
            this.dataCallBackSession.delete(data.callid)
            console.log('recved-all-data:'+newDataStr.length)//JSON.stringify(data))
            data.muti_recved_cnt = lastData.muti_recved_cnt
            return data;
        }
        return null;
    }
    countPeerCnt()
    {
        let iCnt = 0
        this.peerMap.forEach(()=>iCnt++)
        return iCnt
    }
    onPeer(peer) {
        try{
            var This = this,that = this
            console.log('onPeer1111');
            peer.on('error',(err)=>{
                console.log('error:'+err)
                try{
                    This.client.peers().forEach((peer)=>peer.destroy())
                    This.socket.close()
                }catch(ex){
                    console.log('destroy all peers')
                }
                // setTimeout(function(){
                console.log('[restart]reconect peers,socket,etc...')
                This.init()
                // },1000)
            })
            peer.on('connect', () => {
                console.log('peer is connected')
                This.peerMap.set(peer.channelName,peer)
                if(typeof This.peerRefreshCallback =='function'){
                    This.peerRefreshCallback()
                }
            })
            peer.on('close', () => {
                console.log('rtc-peer-close now!')
                This.peerMap.delete(peer.channelName)

                let closeWSList = peer.closeWSList
                for(let i=0;closeWSList&& i<closeWSList.length;i++ )
                {
                   let tmp = closeWSList[i]
                   if(typeof tmp.close == 'function')
                        tmp.close()
                   tmp.ws.closePeer()//这里使用的是closePeer（on-peer里的close()）
                }
            });
            peer._channel.onerror = (event) => { 
                console.log('_channel.onerror',event)
            };
            peer.on('data', async (data)=>{
                console.log('recv data.len:'+data.length)
                let strBegin = '=file'
                // console.log('begin-str-is:'+new String(data.slice(0,strBegin.length)))
                if(data.slice(0,8).indexOf(strBegin)==0){//slice(0,strBegin.length).toString()
                    // console.log('len:'+data.length)
                    // console.log('typeof:'+typeof data)
                    //console.log('charAt[0]:',data)
                    if(data.length<100) //统计接收速度
                    {
                        let cntParams = that.parseJSON(data.slice(strBegin.length,data.length))
                        console.log('recved-cnt-from-server:'+JSON.stringify(cntParams))
                        cntParams.begin_str = cntParams.read_slice ? '=slice' :'=count'
                        // if(cntParams.begin_str=='=slice') return console.log('[Error]not need server-side send =slice pkg')
                        return that.getCallSessionData(cntParams)
                    }
                    let paramsSize =data[strBegin.length]// parseInt()
                    let pkgSize = data[strBegin.length+1]//parseInt(data[])
                    let paramLength = parseInt(''+(data.slice(strBegin.length+2,strBegin.length+2+paramsSize)))
                    let pkgLength = parseInt(''+(data.slice(strBegin.length+2+paramsSize,strBegin.length+2+paramsSize+pkgSize)))
                    let paramStr = data.slice(strBegin.length+2+paramsSize+pkgSize,strBegin.length+2+paramsSize+pkgSize+paramLength)
                    let buff = data.slice(strBegin.length+2+paramsSize+pkgSize+paramLength,strBegin.length+2+paramsSize+pkgSize+paramLength+pkgLength)
                    let params = JSON.parse(paramStr)
                    if(strBegin.length+2+paramsSize+pkgSize+paramLength+pkgLength!= data.length)
                    {
                        console.log('read data pkg error! happen on length:'+(strBegin.length+2+paramsSize+pkgSize+paramLength+pkgLength)+' need:'+data.length+' pos:'+params.pos)
                        // let lastData = This.dataCallBackSession.get(params.callid)
                        // if(lastData) lastData.muti_recved_cnt = lastData.muti_recved_cnt? lastData.muti_recved_cnt+1 : 1

                        let callback =  This.dataCallBackFunctions.get(params.callid)
                        if(typeof callback == 'function')
                        {
                            callback(null)
                        }
                        // let strParams = JSON.stringify({callid:params.callid,read_slice:params.pos})
                        // let writeBuffer = Buffer.alloc(strBegin.length+strParams.length)
                        // writeBuffer.write(strBegin,0,strBegin.length,'ascii')
                        // writeBuffer.write(strParams,strBegin.length,strBegin.length+strParams.length,'ascii')
                        // peer.send(writeBuffer)

                        return //这里数据收集不全，不能进入session记录环节，会导致数据包保存为文件时文件大小出错（也会导致下载失败）。
                    }
                    
                    //console.log('params:'+JSON.stringify(params))
                    params.data =buff// btoa(encodeURI(buff))
                    params.begin_str = '=file'
                    let receivedData= that.getCallSessionData(params)
                    if(receivedData){
                        that.dataCallBack(peer,receivedData)
                    }
                }else if(data.slice(0,2).indexOf('{')==0)
                {
                    console.log('111charAt[0]:',data)
                    //console.log('receivedData:'+data)
                    data = that.parseJSON(data)
                    if(data.ws_token)
                    {
                        console.log('recv-websocket-data:'+JSON.stringify(data))
                        let wsMsg = that.qWS(data.ws_token)
                        if(typeof wsMsg == 'function')
                            wsMsg(data.data)
                        else
                            console.log('[Error] websocket have no message-function callback')
                    }
                    else{
                        if(data.len == data.max_len){
                            that.dataCallBack(peer,data)
                        }else{
                            let receivedData= that.getCallSessionData(data)
                            if(receivedData){
                                that.dataCallBack(peer,receivedData)
                            }
                        }
                    }
                }
            })
            
        }catch(ex)
        {
            console.log('ex:'+ex)
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async testQuery(end){
        // let This = this
        let peerNow = this.fastPeer
        console.log('peers()-:'+this.client.peers())
        if(!peerNow) this.client.peers().forEach(peer => {peerNow=peer})
        if(!peerNow) return null

        let params = {appid:10001,secret_key:'',opcode:'file.download',
                        token_x:'rmb_0000000000000000',token_y:'rmb_0000000000000000',
                        opval:'new',extra_data:'fork-new-rmb-token',begin1:0,len1:3}

                        
       for(let i=0;i<6;i++)
       {
        let list = this.client.peers()
        peerNow = list[i%list.length]
        this.sendData(peerNow,'/chain/query',params,null,function(readData){
            if(typeof end == 'function') end(readData)
            //console.log('test-query-ret-data:'+readData.data.list.length)
        })
        await this.sleep(1000)
        }
    }
    dataURLtoBlob(dataurl,name) {//name:文件名
        var mime = name.substring(name.lastIndexOf('.')+1)//后缀名
        var bstr = atob(dataurl), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }
    dataURLtoBinary(dataurl) {//name:文件名
        var bstr = atob(dataurl), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return u8arr
    }
    downloadFile(url,name='默认文件名'){
        var a = document.createElement("a")//创建a标签触发点击下载
        a.setAttribute("href",url)//附上
        a.setAttribute("download",name)
        a.setAttribute("target","_blank")
        let clickEvent = document.createEvent("MouseEvents");
        clickEvent.initEvent("click", true, true);
        a.dispatchEvent(clickEvent);
    }
    //主函数
    downloadFileByBase64(name,base64){
        var myBlob = this.dataURLtoBlob(base64,name)
        var myUrl = URL.createObjectURL(myBlob)
        this.downloadFile(myUrl,name)
    }
    downloadFileByBinary(name,data){
        var mime = name.substring(name.lastIndexOf('.')+1)//后缀名
        let myBlob = new Blob([data], { type: mime });
        var myUrl = URL.createObjectURL(myBlob)
        this.downloadFile(myUrl,name)
    }
    async download(end){
        let This = this;
        let peerNow = this.fastPeer
        console.log('peers()-:'+this.client.peers())
        if(!peerNow) this.client.peers().forEach(peer => {peerNow=peer})
        if(!peerNow) return null

        let params = {appid:10001,secret_key:'39f01b58558ba38d831744a0d353d7a3',opcode:'file.download',
                        token_x:'rmb_0000000000000000',token_y:'rmb_0000000000000000',opval:'new',extra_data:'fork-new-rmb-token'}

        let iCnt = 0,begin = 0,len = this.chunkSize, dataList = [],recved_slice_size = 0//,fileInfo = null150*1024*1
        params.len = len
        let begin_time = new Date().getTime()
        let unfast_mode = false;
        while(params)
        {
            // if(!this.fastPeer)
            {
                let list = this.client.peers()
                peerNow =list[parseInt(Math.random()*1000)%list.length]// this.clientPeer;//  this.hostPeer//this.clientPeer// this.hostPeer//list[0]//[this.pingTestCnt %list.length]
            }
            peerNow = this.clientPeer
            // else 
            //     peerNow = this.fastPeer// ? this.fastPeer :peerNow
            params.begin = begin
            params.len = len //滑动窗口控制（当data.muti_recved_cnt<=0时，则+=this.chunkSize，如果>=3则减少一个单位chunkSize
            let data = await new Promise((resolve)=>
            {
                This.sendData(peerNow,'/op',params,null,function(readData){
                    resolve(readData)
                })
                //setTimeout(()=>resolve(null),unfast_mode ? 60000:6000)
            })
            if(!peerNow._pc) {
                console.log('peerNow is closed!')
                dataList =null
                break
            }
            if(!data){ 
                unfast_mode = true
                continue //这里将重试
            }
            if(data.data.length!=len && begin+len<=data.fileInfo.size)
            {
                unfast_mode = true
                continue
            }
            // if(!unfast_mode && new Date().getTime()-data.callid>1000 && len==this.chunkSize)
            // {
            //     unfast_mode = true
            //     console.log('into unfast_mode because usedtime>1000')
            // }
            //收集结果
            dataList.push(data)
            iCnt++
            console.log('file-data-length:'+data.data.length+' byte-length:'+data.data.byteLength)
            recved_slice_size+= data.data.length
            console.log('data-list-cnt:'+ dataList.length+' iCnt:'+iCnt)
            console.log('recved_slice_size:'+recved_slice_size+' begin:'+begin+' file.size:'+data.fileInfo.size)
            //已收集到足够的结果-----这个是确认成功的结果
            if(recved_slice_size>=data.fileInfo.size)
            {
                console.log('end the download now:'+data.begin_str)
                if(data.begin_str!='=file')
                {
                    if(typeof end == 'function') end(data)
                }else if(data.begin_str=='=file'){
                    let u8arr = new Uint8Array(data.fileInfo.size),s=0
                    for(let i=0;i<dataList.length;i++){
                        u8arr.set(dataList[i].data,s)
                        s += dataList[i].data.length
                        delete dataList[i].data
                    }
                    data.data = u8arr
                    if(s!=data.fileInfo.size)
                    {
                        console.log('reved-size:'+s+' not ok, need file.size:'+data.fileInfo.size)
                    }
                    if(typeof end == 'function') end(data)
                }
                console.log('download-file-slice-mode usedTime(ms):'+(new Date().getTime()-begin_time))
                break;
            }
            //如果没下载完，继续下载
            begin += len
            console.log('data.muti_recved_cnt:'+data.muti_recved_cnt)
            // if(unfast_mode){
            //     len=this.chunkSize
            //     continue
            // }
            //【控制代码】2022-12-14以下在Node.js环境下，只有网络环境比较好才非常高效（特别针对网速好的动态提速）
            if(!data.muti_recved_cnt || data.muti_recved_cnt <=0)  //滑动窗口控制（当data.muti_recved_cnt<=0时，则+=this.chunkSize，如果>=3则减少一个单位chunkSize
            {
                len+=this.chunkSize
            }else if(data.muti_recved_cnt>=3){
                len-=this.chunkSize
                len = len<=this.chunkSize ? this.chunkSize : len
            }
        }
        return true;
        
    }
    sendFile(fileInfo,callback){
        let peerNow = this.fastPeer
        if(!peerNow) this.client.peers().forEach(peer => {peerNow=peer})

        let data = {appid:10001,secret_key:'39f01b58558ba38d831744a0d353d7a3',opcode:'file.upload',
                    token_x:'rmb_0000000000000000',token_y:'rmb_0000000000000000',opval:'new',extra_data:'fork-new-rmb-token'}
        
        fileInfo.params = data
        let rdata = fileInfo.data 
        delete fileInfo.data //put to the rdata ( in order to split )

        if(fileInfo.encoding!='fromfile_binary')
            this.sendData(peerNow,'/op',rdata,fileInfo,callback)
        else
            this.sendDataBinary(peerNow,'/op',rdata,fileInfo,callback)//sendDataBinaryD
    }
    async sendSliceFile(callid,pos)
    {
        let This = this
        let {peer,params,file} = this.dataCallBackFunctions.get(callid+':queue')//,{peer,params:backData,file})

        let begin = pos*this.chunkSize
        let len = this.chunkSize
        let pkgSize = this.chunkSize
        let stream = require('fs').createReadStream(file,{
            highWaterMark:pkgSize, start:begin,end:begin+len-1,//start:i*pkgSize,end:(i+perlen)*pkgSize-1,//文件一次读多少字节,默认 64*1024
        })
    
        stream.on('readable',async function(){//一样是非阻塞的，但是速度更快，减少了buffer的拼接
            let chunk = stream.read(pkgSize)
            if(!chunk) return console('[error]read file pkgSize failed!')

            let result = new Uint8Array(chunk)
            await This.sendSliceFileBinary(peer,params,result,pos)//, send(result)
            console.log('sendSliceFile-length:'+result.length);
            setTimeout(function(){
                This.sendSliceFileBinary(peer,params,result,pos)//, send(result) //发送2次
            },100)
        })
        stream.on('end', function() {
            //stream.close()
            console.log('stream is end!')
            //resolve(true)
        })
        stream.on('close',function(){
            console.log('stream is closed')
            //resolve(true)
        })
    }
    async sendSliceFileBinary(peer,backData,data,pos)
    {
        backData.pos = pos
        backData.len = data.length

        console.log('sendSliceFileBinary-pos:'+pos+ ' data-len:'+data.length)

        var encoder = new TextEncoder();
        let jsonStr = JSON.stringify(backData)
        let jsonBuff= encoder.encode(jsonStr)
        // console.log('jsonBuff.len:'+jsonBuff.length)

        let strBegin = '=file'
        let strBeginBuff = encoder.encode(strBegin)
        // console.log('strBeginBuff.len:'+strBeginBuff.length)
        console.log('data.len:'+data.length)

        let writeBuffer = new Uint8Array(strBegin.length+2+(''+jsonBuff.length).length
            +(''+data.length).length)//+jsonStr.length)//+rdata.length)

        
        writeBuffer.set(strBeginBuff,0,strBeginBuff.length)//,'ascii')
        writeBuffer[strBeginBuff.length] = (''+jsonBuff.length).length
        writeBuffer[strBeginBuff.length+1] = (''+data.length).length

        let x = encoder.encode(''+jsonBuff.length)
        let y = encoder.encode(''+data.length)
        console.log('x-len:'+x.length+' y-len:'+y.length)

        writeBuffer.set(x,strBeginBuff.length+2)
        writeBuffer.set(y,strBeginBuff.length+2+x.length)

        let allBuffer = new Uint8Array(writeBuffer.length+jsonBuff.length+data.length)
        allBuffer.set(writeBuffer,0)
        allBuffer.set(jsonBuff,writeBuffer.length)
        allBuffer.set(data,writeBuffer.length+jsonBuff.length)

        //writeBuffer.write(jsonStr,'utf8')
        console.log('allBuffer-len:'+allBuffer.length)
        while(peer._channel.bufferedAmount>10*1024*1024) await this.sleep(5)
        peer.send(allBuffer)//new ArrayBuffer(allBuffer))
        //pos++
    }
    async sendDataBinary(peer,url,rdata,fileInfo=null,callback=null)
    {
        if(!peer._pc){
            console.log('peer is closed??!!!')
            return 
        }

        let offset =0 , file = rdata, chunkSize =  this.chunkSize//150*1024
        let max_pos =Math.floor( (fileInfo.size+ chunkSize-1)/chunkSize)
        let backData = {callid:new Date().getTime()+'.'+parseInt(Math.random()*1000000000),url,
                            max_len:fileInfo.size,len:0,pos:0,max_pos,fileInfo}
        console.log('send-max_pos:'+max_pos+' backData.max_pos:'+max_pos)
        if(callback) this.dataCallBackFunctions.set(backData.callid,callback)
        this.dataCallBackFunctions.set(backData.callid+':queue',{peer,params:backData,file})
        let This = this
        // let perLen = 10
        let sended_size = 0

        for(let pos = 0;pos<max_pos;)
        {
            await new Promise((presolve)=>{
                let begin = pos*this.chunkSize
                let len = this.chunkSize
                let pkgSize = this.chunkSize
                let stream = require('fs').createReadStream(file,{
                    highWaterMark:pkgSize, start:begin,end:begin+len-1,//start:i*pkgSize,end:(i+perlen)*pkgSize-1,//文件一次读多少字节,默认 64*1024
                })
                stream.on('readable',async function(){//一样是非阻塞的，但是速度更快，减少了buffer的拼接
                    let chunk = stream.read(pkgSize)
                    if(!chunk) return;// console.log('[error]read file pkgSize failed!')

                    let result = chunk;//new Uint8Array(chunk)
                    console.log('sendSliceFile-length:'+result.length);
                    await This.sendSliceFileBinary(peer,backData,result,pos)//, send(result)
                    let iFailedCnt = 0, begin_count_time = new Date().getTime()
                    let flag = await new Promise((resolve)=>{//= pos%perLen ==0 ? 
                        let xid = setTimeout(()=>resolve(false),5000)
                        This.dataCallBackFunctions.set(backData.callid+':check',function(cdata){
                            console.log('recved-check-pos:'+cdata.pos+
                                ' reved-len:'+cdata.recved_len+' now-pos:'+pos+' max_pos:'+max_pos)
                            if(cdata.recved_len==pos+1 && cdata.pos == pos) //cdata.pos == pos)
                            {
                                resolve(true)
                                clearTimeout(xid)
                            }
                            else{
                                iFailedCnt++
                                console.log('need-pos:'+pos+' iFailedCnt:'+iFailedCnt)
                                if(new Date().getTime()-begin_count_time>5000){
                                    console.log('check-failed, and is timeout, resend now!')
                                    resolve(false)
                                }
                            } 
                        }) 
                        
                    })//:true  //每10次确认一次是否成功的包
                    pos+= flag ? 1:0 //增加
                    //offset += flag ? e.target.result.byteLength :0
                    sended_size+= flag ? result.length:0
                    console.log('FileRead.onload-byteLength:'+result.length+' result.length:'+result.length
                        +' sended-size:'+sended_size+' file-size:'+fileInfo.size);
                    presolve(true)
                })
                stream.on('end', function() {
                    //stream.close()
                    console.log('stream is end!')
                    //resolve(true)
                })
                stream.on('close',function(){
                    console.log('stream is closed')
                    //resolve(true)
                })
            })
        }
        This.dataCallBackSession.delete(backData.callid+':radio')
    }
    peer(){
        if(!this.client || this.client.peers().length==0) return null;
        return this.client.peers()[0]
    }
    async send(url,rdata,fileInfo=null,callback=null)
    {
        let peerNow = this.peer()
        this.sendData(peerNow,url,rdata,fileInfo,callback)
    }
    setWs(token,callback=null)
    {
        this.wsMap.set(token,callback)
    }
    qWS(token)
    {
        return  this.wsMap.get(token)
    }
    setPeerRefreshCallback(func)
    {
        this.peerRefreshCallback = func
        //如果是本地请求，直接连接。
        if(this.isLocalReq && typeof func =='function'){
            func()
        }
    }
    async sendData(peer,url,rdata,fileInfo=null,callback=null)
    {
        if(!peer || !peer._pc){
            console.log('peer is closed??!!!')
            return 
        }
        //let rdataStr = JSON.stringify(rdata)
        let jsonStr =fileInfo?rdata: JSON.stringify(rdata);//JSON.stringify(rdata).length
        let backData = {callid:new Date().getTime()+'.'+parseInt(Math.random()*1000000000),url,
                            rpc_name:rdata.rpc_name,
                            max_len:jsonStr.length,len:jsonStr.length,pos:-1,max_pos:-1,fileInfo,data:rdata}
        delete rdata.rpc_name
        if(callback) this.dataCallBackFunctions.set(backData.callid,callback)
        //if(fileInfo) backData.fileInfo = fileInfo
        console.log('sendData()-jsonStr-length:'+jsonStr.length)
        console.log('maxPkgSize:'+peer._pc.sctp.maxMessageSize)
        try{
            if(jsonStr.length<peer._pc.sctp.maxMessageSize-1024*10){
                //while(peer._channel.readyState!='open') await str_filter.sleep(5)
                while(peer._channel.bufferedAmount>10*1024*1024) await this.sleep(5)
                peer.send(JSON.stringify(backData))//jsonStr)
            }
            else{
                console.log('into split rdata')
                //peer.send(JSON.stringify({callid,data:{ret:false,msg:'json-length too length,size:'+jsonStr.length}}))
                let rdataTmpSize =parseInt(peer._pc.sctp.maxMessageSize/2)// parseInt((peer._pc.sctp.maxMessageSize+1023)/1024)*1024/2;// -1024*60 ;//1024*160// parseInt(peer._pc.sctp.maxMessageSize*3/2)//-128
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
                    while(peer._channel.bufferedAmount>10*1024*1024) await this.sleep(5)
                    peer.send(JSON.stringify(backData))
                }
            }
        }catch(ex){
            console.log('peer.send-exception:'+ex)
        }
    }
}

// module.exports= RTCClient

async function test()
{
    let client = new RTCClient('room2')
    //client.sendData()
    //while(!client.client._pc) await str_filter.sleep(300)
    while( client.countPeerCnt()>0)//<2) //client.client.peers().length<2)
    {
        //console.log('req:'+client.client.peers())
        await client.sleep(1000)
    }

    if(0&&true)
    {
        // await str_filter.sleep(5000)
        // client.testQuery(function(data){
        //     console.log('testQuery-data:',data)
        // })
        // // await str_filter.sleep(10000)
        // return 
        await client.sleep(5000)
        
        client.download(function(data){
            console.log('download-data-len:'+data.data.length+' begin_str:'+data.begin_str)
            if(data.begin_str!='file'){
                data.data = Buffer.from(data.data,'base64')
            }
            let stream = require('fs').createWriteStream('C:\\Users\\LMC\\Downloads\\download--'+new Date().getTime()+'--'+data.fileInfo.originalname)
            stream.write(data.data)
            stream.end()
        })
        return 
        let fileInfo = {fieldname:"file",encoding:'fromfile_binary',originalname:'SecureCRT-2021-4-7.zip',
                                mimetype:'zip',filename:'SecureCRT-2021-4-7.zip',path:'file-path',size:29252796,
                                data:'D:\\工作软件\\SecureCRT-2021-4-7.zip'}
        client.sendFile(fileInfo,function(data){
            console.log('sendFile-callback-data:'+JSON.stringify(data))
        })
        return 
    }
    // else
    {
        let obj = {callid:new Date().getTime()+'.'+parseInt(Math.random()*1000000000),url:'/op',
        data:{appid:10001,secret_key:'39f01b58558ba38d831744a0d353d7a3',
        opcode:'fork',
        token_x:'rmb_0000000000000000',token_y:'rmb_0000000000000000',opval:60*60*24,extra_data:'fork-new-rmb-token'}}
        obj.data.opcode ='fork'// 'assert'
        obj.url= '80::/op'//'80::/chain/token'//'/chain/token'//'80::/chain/token'
        obj.data.rpc_name='80'
        obj.data.token = obj.data.token_x
        obj.data.begin =0
        obj.data.len =100;//that.pingTestCnt>that.pingTestAllCnt ?  100000:200// 200//

        let peerNow =  client.clientPeer ;// client.fastPeer
        console.log('peers()-:'+client.client.peers())
        

        setInterval(()=>{
            //if(!peerNow) 
            client.client.peers().forEach(peer => {peerNow=peer})
            client.sendData(peerNow,obj.url,obj.data,null,function(data){
                console.log('send-data-callback:'+data.length,data)
            })
        },30000)
    }

}

window.RPCClient =RPCClient
// test()