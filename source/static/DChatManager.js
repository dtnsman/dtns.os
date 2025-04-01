/**
 * 新增一个DChat聊天管理器（使用了DTNSManager作为网络中台/数据中台,构建多实例的分布式聊天系统
 * --整合dtns.connector的所有的api和功能等）---api版本的dtns.connector(无界面版本)
 * on 2023/3/27
 * 
 * class类名称:分布式聊天管理器(确实是一个管理器)
 * 替代:this.$api.teaback.xxxx等等
 */
class DChatManager{
    constructor(dtnsManager)
    {
        this.dtnsManager = dtnsManager
        this.restart_time = 1000
        this.websocks = new Map()
        this.web3keysMap = new Map()
        console.log('DChatManager-init:this.websocks',this.websocks)
    }
    async getWeb3Key(aes256Hash)
    {
        let web3key = this.web3keysMap.get(aes256Hash);
        if(!web3key){
            web3key= await iWalletDb.getDataByKey('web3key_hash:'+aes256Hash)
            if(!web3key) return null
            web3key = web3key.data
            this.web3keysMap.set(aes256Hash,web3key)
        }
        return web3key
    }
    isEncrypted(msg)
    {
      if(msg && msg.indexOf('aes256|')==0 
            && msg.indexOf('|') != msg.lastIndexOf('|'))
      {
        let lastStr = msg.substring('aes256|'.length,msg.length)
        let aes256Hash = lastStr.substring(0,lastStr.indexOf('|'))
        return aes256Hash && aes256Hash.length>10 
      }else{
        return false;
      }
    }
    async getDecryptWeb3Key(msg,chatWeb3Key=null)
    {
      // console.log('getDecryptWeb3Key-msg:',msg)
      if(msg && msg.indexOf('aes256|')==0 
            && msg.indexOf('|') != msg.lastIndexOf('|'))
      {
        let lastStr = msg.substring('aes256|'.length,msg.length)
        let aes256Hash = lastStr.substring(0,lastStr.indexOf('|'))
        if(aes256Hash && aes256Hash.length>10 )
        {
          if(chatWeb3Key && aes256Hash == await sign_util.hashVal(chatWeb3Key) )
          {
            return chatWeb3Key 
          }else{
            let web3key = await this.getWeb3Key(aes256Hash)
            if(web3key)
            {
              return web3key
            }else{//从网络中同步和获取
              console.log('【notice】aes-web3key do not in iWalletDb, need load from network ')
            //   this.$toast('【notice】aes-web3key do not in iWalletDb, need load from network ')
              return null
            }
          }
        }
      }
      return null
    }
    async decryptMsgInfo(msg,chatWeb3Key = null)
    {
      // console.log('decryptMsgInfo-msg:',msg)
      if(msg && msg.indexOf('aes256|')==0 
            && msg.indexOf('|') != msg.lastIndexOf('|'))
      {
        let lastStr = msg.substring('aes256|'.length,msg.length)
        let aes256Hash = lastStr.substring(0,lastStr.indexOf('|'))
        let xmsg = lastStr.substring(lastStr.indexOf('|')+1,lastStr.length)
        if(aes256Hash && aes256Hash.length>10 )
        {
          if(chatWeb3Key && aes256Hash == await sign_util.hashVal(chatWeb3Key) )
          {
            let {iv,aeskey} = sign_util.decodeWeb3keyAes256Str(chatWeb3Key)
            let text = await sign_util.decryptMessage(await sign_util.importSecretKey(aeskey),iv,xmsg)
            msg = text
            return msg
          }else{
            let web3key = await this.getWeb3Key(aes256Hash)
            if(web3key)
            {
              let {iv,aeskey} = sign_util.decodeWeb3keyAes256Str(web3key)
              let text = await sign_util.decryptMessage(await sign_util.importSecretKey(aeskey),iv,xmsg)
              msg = text
              return msg
            }else{//从网络中同步和获取
              console.log('【notice】aes-web3key do not in iWalletDb, need load from network ')
            //   this.$toast('【notice】aes-web3key do not in iWalletDb, need load from network ')
              return msg
            }
          }
        }
      }
      return msg
    }
    notice_user_ws_status(status)
    {
        console.log('DChatManager:into notice_user_ws_status,',status)
        // const client = window.rpc_client
        // user_keepalive = websock && client.qWS(websock.ws_token) ? 1:0//status;
        // for(let i=0;i<user_keepalive_funcs.length;i++)
        // {
        //     // console.log('user_keepalive_funcs:'+user_keepalive_funcs[i])
        //     user_keepalive_funcs[i](user_keepalive)
        // }
    }
    async initWebSocket(web3name){
        let websock = this.websocks.get(web3name)
        console.log('DChatManager:into initWebSocket function',websock,web3name)
        const client =await this.dtnsManager.connect('dtns://web3:'+web3name)
        console.log('DChatManager:initWebSocket-client:',client,client?client.roomid:'web3name is null')
        if(websock && client.qWS(websock.ws_token))
        {
            this.notice_user_ws_status(user_keepalive)
            return ;
        }
        // if(typeof(WebSocket) === "undefined"){
        //     console.error("您的浏览器不支持WebSocket")
        //     return false
        // }
        let This = this
        try{
            let sessionInfo = await iSessionDb.getDataByKey('session:'+web3name)
            if(!sessionInfo){
                console.log('DChatManager:sessionInfo is null,web3name:',web3name)
                return ;
            }
            sessionInfo = sessionInfo.data
            let params = {user_id:sessionInfo.user_id,s_id:sessionInfo.s_id};
            let tokenRet = await this.dtnsManager.run('dtns://web3:'+web3name+'/chat/ws/user/listen',params);//token
            console.log('DChatManager:index.js-websocket-lisenret:',tokenRet)
            if(tokenRet && tokenRet.ret && tokenRet.listen_token)
            {
                // let wsuri = urls.ws_host_path_0+'/userchatlist/ws/svr?token='+tokenRet.listen_token;
                client.setWs(tokenRet.listen_token,function(data){
                    This.websocketonmessage(data,web3name)
                })
                client.setPeerRefreshCallback(function(){
                    This.initWebSocket();
                    // if(typeof initChatWebsocket == 'function')
                    // {
                    //     initChatWebsocket()
                    // }
                })
                this.dtnsManager.run('dtns://web3:'+web3name+'/userchatlist/ws/svr',{token:tokenRet.listen_token})
                websock =  {ws_token:tokenRet.listen_token}
                this.websocks.set(web3name,websock)
                // websock = new WebSocket(wsuri)
                // websock.onopen = websocketonopen
                // websock.onmessage = websocketonmessage
                // websock.onerror = websocketonerror
                // websock.onclose = websocketclose
            }else{
                console.log('DChatManager:initWebSocket-get-ws-token failed:'+JSON.stringify(tokenRet))
                websock  = null;
                this.websocks.delete(web3name)
                setTimeout(this.initWebSocket,this.restart_time);
            }   
        }catch(ex){
            websock = null
            this.websocks.delete(web3name)
            console.log('DChatManager:start websocket-exception:'+ex)
            setTimeout(this.initWebSocket,this.restart_time);
        }
    }
    async websocketonmessage(e,web3name){ 
        let data = e// e.data;
        console.log('DChatManager:backgroud-index----websocketonmessage:',data,web3name)
    
        this.user_keepalive = 1;
        this.notice_user_ws_status(this.user_keepalive)
    
        let dataJson = data;
        if(!data.msg)
        try{
            dataJson = JSON.parse(data)
        }catch(ex){
            // console.log('dataJson parse failed:'+ex)
        }
    
        // console.log('dataJSON:'+JSON.stringify(dataJson))
        // if(newMsgObjFunc) newMsgObjFunc(dataJson)
        // else console.log('newMsgObjFunc is undefined')
        let need_public_key = null
        let private_key = null
        let msgObj = null;
        if(dataJson.opval.type=='text')
        {
            try{
                msgObj = JSON.parse(dataJson.opval.msg)
            }catch(Ex){
            }
            console.log('DChatManager:msgObj:',msgObj)
            if(msgObj.notice_msg_type=='query_ecc_keys_notice')
            {
                need_public_key = msgObj.need_public_key

                let keys = await iWalletDb.getAllDatas()
                console.log('keys:',keys)
                for(let i=0;i<keys.length;i++)
                {
                    if(keys[i].data && !keys[i].data.public_key)
                    {
                        try{
                            keys[i].data.public_key =  key_util.getPublicKey( keys[i].data.private_key )
                            iWalletDb.deleteDataByKey(keys[i].key)
                            iWalletDb.addData({key:keys[i].key,data:keys[i].data})
                            console.log('recreate-public_key:',keys[i])
                        }catch(exx){}
                    }
                    if(keys[i].data && keys[i].data.public_key == need_public_key)
                    {
                        private_key = keys[i].data.private_key
                        console.log('finded private-key from iWalletDb:'+private_key)
                        break;
                    }
                }
            }else if(msgObj.notice_msg_type=='query_ecc_keys_result_notice'){
                //如果得到结果,则解析结果
                let result = msgObj.notice_result
                let decrypt_public_key = msgObj.decrypt_public_key
                let keys = await iWalletDb.getAllDatas()
                console.log('keys:',keys)
                //hack the g_mywallet's bug
                if(!g_mywallet.public_key)
                {
                    try{
                    g_mywallet.public_key = key_util.getPublicKey( g_mywallet.private_key )
                    }catch(exxxx){}
                }
                if(decrypt_public_key == g_mywallet.public_key)
                {
                    private_key = g_mywallet.private_key
                }
                if(!private_key)
                for(let i=0;i<keys.length;i++)
                {
                    if(keys[i].data && keys[i].data.public_key == decrypt_public_key)
                    {
                        private_key = keys[i].data.private_key
                        console.log('finded decrypt_public_key-private-key from iWalletDb:'+private_key)
                        break;
                    }
                }
                if(private_key){
                    let need_private_key = await sign_util.decryptSomethingInfo(result,private_key)
                    let saveKeys = {private_key:need_private_key,public_key:msgObj.need_public_key}
                    iWalletDb.deleteDataByKey('net_mywallet:'+saveKeys.public_key)
                    iWalletDb.addData({key:'net_mywallet:'+saveKeys.public_key,data:saveKeys})//key:net_mywallet
                    console.log('[success]save-keys:',saveKeys)
                }else{
                    console.log('[error]:find decrypt_public_key-private-key failed',private_key)
                }
            }
        }
        console.log('DChatManager:keys:',need_public_key,private_key)
    
        if(bgMp3 && dataJson.txjson && need_public_key && private_key){
            bgMp3.play()
            console.log('DChatManager:call bgMp3.play()')
            if(typeof g_showTips == 'function'){
                //提示授权信息,并发送授权通知
                g_showTips(dataJson.opval.msg,function(){
                    return private_key
                })
            }
        }
        // 在这里使用后端返回的数据，对数据进行处理渲染
    }

    /**
     * 发送DTNS通知
     * @param {*} msgWrapFunc 将消息转码
     * @param {*} failed 
     * @param {*} ok 
     * @returns 
     */
    async sendNotice(msgWrapFunc,failed,ok)
    {
        let mywallet = await iWalletDb.getDataByKey('g_mywallet')
          if(mywallet) mywallet = mywallet.data
          if(!mywallet){
            console.log('[Error]mywallet is empty')
            console.log('【错误】无法获得解析aes-key所用的私钥钱包!')
            // this.$toast('【错误】无法获得解析aes-key所用的私钥钱包!')
            // this.publicKeyNoticeMap.delete(public_key)
            if(typeof failed == 'function') failed('【错误】无法获得解析aes-key所用的私钥钱包!')
            return 
          }

          ///chat/msg/send/text
          ///chat/single
          let sessionInfo =null
          if(rpc_client.roomid =='dtns')
          {
            try{
            sessionInfo = JSON.parse(localStorage.getItem('userInfo'))
            }catch(ex){}
          }else{
            sessionInfo = await iSessionDb.getDataByKey('session:dtns')
            sessionInfo = sessionInfo ? sessionInfo.data:null
          }
          if(!sessionInfo)
          {
            let web3name = 'dtns'
            let timestamp = parseInt( Date.now()/1000)
            let hash = await key_util.hashVal(web3name+':'+timestamp)
            let sign = await key_util.signMsg(hash,mywallet.private_key) //使用的是dtns-device-id设备id的密钥

            //如未登录,则登录之
            sessionInfo = await this.dtnsManager.run('dtns://web3:dtns/user/device/login',{timestamp,web3name,sign})
            iSessionDb.deleteDataByKey('session:'+web3name)
            iSessionDb.addData({key:'session:'+web3name,data:sessionInfo}) 
            iSessionDb.addData({key:'session:'+web3name+':'+Date.now(),data:sessionInfo})
          }
          if(!sessionInfo)
          {
            console.log('【错误】无法发送ecc-private-key的notice授权请求,原因:登录失败!')
            // this.$toast('【错误】无法发送ecc-private-key的notice授权请求,原因:登录失败!')
            // this.publicKeyNoticeMap.delete(public_key)
            if(typeof failed == 'function') failed('【错误】无法发送ecc-private-key的notice授权请求,原因:登录失败!')
            return 
          }
          //发送单聊信息(自己给自己发送通知---多设备同步---优势)
          let chatRet = await this.dtnsManager.run('dtns://web3:dtns/chat/single',
            {user_id:sessionInfo.user_id,s_id:sessionInfo.s_id,user_b:sessionInfo.user_id,random:Date.now()})
          // let cReq = {params:{user_id:obj.user_id,s_id,user_b:obj.user_id,random:Date.now()}}
          if(!chatRet || !chatRet.ret)
          {
            console.log('【错误】无法发送ecc-private-key的notice授权请求,原因:创建通知用的聊天室失败!')
            // this.$toast('【错误】无法发送ecc-private-key的notice授权请求,原因:创建通知用的聊天室失败!')
            // this.publicKeyNoticeMap.delete(public_key)
            if(typeof failed == 'function') failed('【错误】无法发送ecc-private-key的notice授权请求,原因:创建通知用的聊天室失败!')
            return 
          }

          //发送的消息obj内容:请求private_key(请求的public_key对应的private_key,decrypt_public_key为结果解密public_key)
          let nowDeviceInfo = null;
          try{
            nowDeviceInfo = Object.assign({}, sessionInfo)//JSON.parse(localStorage.getItem('userInfo'))
          }catch(exxx){
          }
          // let obj =  {public_key,decrypt_public_key:g_mywallet.public_key,
          //     notice_msg_type:'query_ecc_keys_notice'}
        //   nowDeviceInfo.need_public_key = public_key
        //   nowDeviceInfo.notice_msg_type = 'query_ecc_keys_notice'
        //   nowDeviceInfo.s_id = null//没必要暴露这个session-id(安全起见)
        console.log('DChatManager:msgWrapFunc:',typeof msgWrapFunc)
          if(typeof msgWrapFunc =='function') await msgWrapFunc(nowDeviceInfo)
          let sendNoticeRet = await this.dtnsManager.run('dtns://web3:dtns/chat/msg/send/text',
            {user_id:sessionInfo.user_id,s_id:sessionInfo.s_id,chatid:chatRet.chatid,msg:JSON.stringify(nowDeviceInfo),random:Date.now()})
          console.log('DChatManager:sendNoticeRet:',sendNoticeRet)
          if(!sendNoticeRet|| !sendNoticeRet.ret)
          {
            // this.publicKeyNoticeMap.delete(public_key)
            if(typeof failed == 'function') failed('【错误】发送通知消息失败!')
          }
          if(typeof ok == 'function') ok()
    }
}