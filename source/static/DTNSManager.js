/**
 * 新增一个DTNS连接管理器（主要用于映射解析、增加RPCClient实例、管理RPCClient实例等）
 */
class DTNSManager
{
    constructor()
    {
        this.clientMap = new Map()
        this.DTNS_ROOT_TOKEN = 'dtns_00000000000000000000000000000000'
        this.web3nameDTNSMap = new Map()
        this.networkInfoMap  = new Map()
        this.web3apps = null
        this.queryDTNSAll()

        let This = this
        setTimeout(async function(){
            // let rets = await This.queryDTNSAll()
            // console.log('queryDTNSAll-rets:',rets)
            testDTNSManager(This)
        }
        ,1000)//一启动就映射所有（得到dtns-cached缓存）
    }
    getOriginRoomID(roomid)
    {
        if(!roomid) return roomid
        if(roomid.indexOf('|')>=0)
        { 
            roomid =  roomid.split('|')[0] 
            roomid = roomid.indexOf(':')>=0 ? roomid.split(':')[1] :roomid
        }
        return roomid
    }
    addRPCClient(client)
    {
        if(!client || !client.roomid) return false
        
        let roomid = this.getOriginRoomID(client.roomid)
        // if(client.roomid.indexOf('|')>=0)
        // { 
        //     roomid =  client.roomid.split('|')[0] 
        //     roomid = roomid.indexOf(':')>=0 ? roomid.split(':')[1] :roomid
        // }
        console.log('DTNSManager-addRPCClient-client.roomid:',client.roomid,roomid)

        this.clientMap.set(roomid,client)
        return true
    }
    removeRPCClient(web3name)
    {
        this.clientMap.delete(web3name)
        return true
    }
    /**
     * 连接到web3app
     * @param {*} dtnsUrl 
     * @returns 
     */
    async connect(dtnsUrl)
    {
        // if(!dtnsUrl) return null
        // if(dtnsUrl.indexOf('dtns://web3:')!=0){
        //     // let nsRet = await this.nslookup('dtns',dtnsUrl)
        //     return null
        // } 
        // let idx = dtnsUrl.indexOf('/','dtns://web3:'.length)
        // let web3name = dtnsUrl.substring('dtns://web3:'.length,idx>0?idx:dtnsUrl.length)
        // console.log('connect-url,idx-web3name',dtnsUrl,idx,web3name)

        //2023-10-9前置，如有则直接返回，不须查询nslookup（因网络故障可能会导致超时等待时间过长）
        let web3name = this.nslookupIB3ID(dtnsUrl).web3name
        let client = this.clientMap.get(web3name)
        if(client) return client

        let iCnt = 30 //2023-10-9  避免死循环等待事件的发生
        //while(!this.web3apps && rpc_client && (iCnt--)>=0) await rpc_client.sleep(100)
        while(!this.web3apps && (iCnt--)>=0) await new Promise((resolve)=>setTimeout(resolve,100))
        let web3appInfo = await this.nslookup(dtnsUrl) //先查询，是否存在于cached中
        if(window.g_dtns_network_static_hosts && window.g_dtns_network_static_hosts[web3name])
        {
            web3appInfo = {web3name,network_info:window.g_dtns_network_static_hosts[web3name]}
        }
        if(web3name && web3name.indexOf('dev')>=0)
        {
            web3appInfo = {web3name,network_info:window.g_dtns_network_static_hosts['dev.dtns']}
        }
        else if(web3name && web3name.indexOf('loc')>=0)
        {
            web3appInfo = {web3name,network_info:window.g_dtns_network_static_hosts['loc.dtns']}
        }

        console.log('connect-web3appInfo:',web3appInfo)
        web3name = web3appInfo ? web3appInfo.web3name :null
        if(!web3name || web3name.length<=0) return null
        // return null
        // ### 2023-5-26 下述不能很好有效的连接，先暂时关闭该自动连接功能。

        //可用于changeSvrNode.vue中
        client = new RTCClient(web3name)
        // client.init()
        this.addRPCClient(client)
        return client
    }
    /**
     * 从cache中读取 2024-12-27
     * @param {*} dtnsUrl 
     * @param {*} params 
     */
    async queryRunCache(dtnsUrl,params = null)
    {
        if(dtnsUrl.indexOf('/dweb/xmsg/list')<0) return null
        if(!window.imDb) 
        {
            g_dchatManager.switchIMDB(rpc_client.roomid)
            console.log('queryRunCache-imDb-switchIMDB:',rpc_client.roomid,window.imDb)
        }
        if(!window.imDb) return null
        let item  = await imDb.getDataByKey('dtns-run-cache:'+dtnsUrl)
        console.log('queryRunCache-item:',item,dtnsUrl)
        if(!item || !item.data) return null;
        return item.data
    }
    async saveRunCache(dtnsUrl,runRet,param= null) 
    {
        if(dtnsUrl.indexOf('/dweb/xmsg/list')<0) return false
        imDb.deleteDataByKey('dtns-run-cache:'+dtnsUrl)
        imDb.addData({key:'dtns-run-cache:'+dtnsUrl,data:runRet})
        return true;
    }
    /**
     * 请求url，例如dtns://web3:name/path
     * @param {*} dtnsUrl 
     * @param {*} params 
     * @returns 
     */
    async run(dtnsUrl,params)
    {
        const dtnsUrlOrigin = dtnsUrl
        let client = await this.connect(dtnsUrl)
        if(!client) return this.queryRunCache(dtnsUrl,params)//null //2024-12-27新增

        let iCnt = 100
        while(!client.pingpong_flag && iCnt-- >=0) await client.sleep(10) //100 2024-12-27原来是100，即10秒。现修改为1秒 //等待pingpong_flag is true
        //仅当超时未连接时 2024-12-27
        let peerNow  = client.peer()
        if(iCnt<0 || !peerNow || !peerNow._pc )// || client && client.mywallet && client.mywallet.empty_key_flag )
        {
            let xret =await this.queryRunCache(dtnsUrl,params) //仅成功时方返回缓存
            if(xret && xret.ret) return xret
        }
        let oldParams = params
        {
            let {params,dtns_url} = this.nslookupIB3ID(dtnsUrl) //局域变量
            console.log('nslookupIB3ID:',dtnsUrl,params,oldParams,dtns_url)
            if(params){
                oldParams = Object.assign({},params, oldParams)
                dtnsUrl = dtns_url //去掉参数
            } 
        }
        params = oldParams

        //解析得到真正的path（去掉参数之后）
        let idx = dtnsUrl.indexOf('/','dtns://web3:'.length)
        if(idx<0) return null;
        let url = dtnsUrl.substring(idx,dtnsUrl.length) //得到urlPath

        //先从localStorage中读取（大大提升速度）
        if((!params.user_id || !params.s_id) && localStorage.s_id && localStorage.user_id)
        {
            params.user_id = localStorage.user_id
            params.s_id = localStorage.s_id 
        }
        //查询缓存的user-id和s-id（以便确保融入了user_id和session-id）
        if((!params.user_id || !params.s_id) && window.iSessionDb)
        {
            if(!client.user_session)
            {
                //从iSessionDb中获取
                let sessionInfoCached = await iSessionDb.getDataByKey('session:'+client.roomid)
                console.log('dtns-manager-sessionInfoCached:',sessionInfoCached)
                //补充session-id至params
                if(sessionInfoCached && sessionInfoCached.data)
                {
                    sessionInfoCached = sessionInfoCached.data 
                    params.user_id = sessionInfoCached.user_id
                    params.s_id = sessionInfoCached.s_id
                    //缓存至rpc-client
                    client.user_session = sessionInfoCached
                }
            }else{
                params.user_id = client.user_session.user_id
                params.s_id = client.user_session.s_id
            }
        }

        console.log('run-params:'+dtnsUrl+' params:'+JSON.stringify(params))
        // if(url && url.indexOf('9000')) url = url.split('9000')[1]
        params = !params ?{}:params
        let runRet = await new Promise((resolve)=>{
            if(!params) return resolve({ret:false,msg:'param is null'})
            console.log('dtns-run-url:'+url,params,dtnsUrl)
            if(url!='/file')
            {
                client.send(url,params,null,function(rdata){
                console.log('dtns-run-rdata:'+JSON.stringify(rdata))
                    if(rdata)
                        resolve(rdata.data)
                    else{
                        console.log('DTNSManager.run-client-init:re-connect to host-web3name:',client.roomid)
                        // setTimeout(()=>client.init(),300)//尝试重启连接 //2023-6-17
                        resolve(null)
                    }
                })
            }else{//must be '/file'
                console.log('dtns-manager-run-into-download:')
                params.file_kind = 'file'
                client.download(params,async function(data){
                    console.log('dtns-manager-run().download-file-data:',data,data.data)
                    if(data){
                        resolve(data)
                    }else{
                        resolve(null)
                    }
                })
            }
            setTimeout(()=>resolve(null),30000)
        })
        console.log('DTNSManager-runRet:',runRet,dtnsUrl,params)
        //如果session-error，尝试基于/user/device/login使用web3sign签名实现重新登录（rpc_client.mywallet）
        if(runRet && !runRet.ret && runRet.msg == 'session error')
        {
            let qSessionRet = await g_dchatManager.loginIB3Device(client.roomid)
            console.log('dtns-manager-run-->g_dchatManager.loginIB3Device:',qSessionRet)
            if(qSessionRet && qSessionRet.ret){
                client.user_session = qSessionRet
            }else{
                delete client.user_session //删除掉旧的无用的session
            }
        }
        //仅在返回结果ok时
        if(params.begin == 0 && runRet && runRet.ret)
        {
            this.saveRunCache(dtnsUrlOrigin,runRet)
        }
        return runRet
    }
    nslookupIB3ID(dtnsUrl)
    {
        let ibappPrefixStr = 'dtns://ibapp:' 
        dtnsUrl = dtnsUrl.replace('dtns://web3:',ibappPrefixStr)
        let dtnsUrlHttp = dtnsUrl.replace(ibappPrefixStr,'http://')
        let url = new URL(dtnsUrlHttp)//利用上这个解析库进行查询。
        //console.log('url:'+JSON.stringify(url));
        let path = url.pathname
        let params = {}//token_x:context[token_x],token_y:context[token_y],opcode,opval:JSON.stringify(context[opval]),token_key,extra_data:context[extra_data]}
        for (const [key, value] of url.searchParams) {
            params[key] =value
        }
        console.log('nslookup-path:',path,params,url)
        dtnsUrl = ibappPrefixStr +url.hostname+path //去掉了参数后的结果
        
        let domainName = null
        let result = {params,dtns_url:dtnsUrl,path,protocol:'dtns',domainName,web3name:url.hostname}

        if(dtnsUrl.indexOf(ibappPrefixStr)!=0){
            // let nsRet = await this.nslookup('dtns',dtnsUrl)
            let tmpUrl = dtnsUrl.replace('dtns://','')
            let begin = tmpUrl.indexOf('/')
            begin = begin >= 0 ? begin: tmpUrl.length
            domainName = tmpUrl.substring(0,begin)
            if(!domainName || domainName.length<=0) domainName = null;
            result.web3name = domainName.indexOf('.')>=0 ? domainName.substring(0,domainName.indexOf('.')) :domainName
            result.domainName = domainName
        }

        console.log('nslookupIB3ID:result:',result)
        return result
    }
    /**
     * 解析dtnsUrl---例如domain、nft、证书编码、会员证书等（待完善/nslooup接口）
     * @param {*} dtnsWeb3Name 使用哪个client进行web3-dtns请求（默认应该使用rpc_client（web3app）进行请求）
     * @param {*} dtnsUrl 
     * @returns 
     */
    async nslookup(dtnsUrl) //dtnsWeb3Name,
    {
        // let client = this.connect('dtns://web3:'+dtnsWeb3Name)
        // if(!client) return null
        // return this.run('dtns://web3:'+dtnsWeb3Name+'/nslookup',{url:dtnsUrl})
        if(!dtnsUrl) return null
        let dtnsResult = this.nslookupIB3ID(dtnsUrl)
        if(!dtnsResult) return null
        dtnsUrl = dtnsResult.dtns_url
        let {web3name,domainName,params} = dtnsResult
        console.log('connect-url,web3name',dtnsUrl,web3name,domainName)
        if(!web3name || web3name.length<=0) return null

        let dtnsInfo = this.web3nameDTNSMap.get(web3name)
        if(window.g_dtns_network_static_hosts && g_dtns_network_static_hosts[web3name])
        {
            dtnsInfo = {web3name,network_info:g_dtns_network_static_hosts[web3name],params}
            return dtnsInfo
        }
        if(web3name && web3name.indexOf('dev')>=0)
        {
            dtnsInfo = {web3name,network_info:window.g_dtns_network_static_hosts['dev.dtns'],params}
            return dtnsInfo
        }
        else if(web3name && web3name.indexOf('loc')>=0)
        {
            dtnsInfo = {web3name,network_info:window.g_dtns_network_static_hosts['loc.dtns'],params}
            return dtnsInfo
        }
        console.log('nslookup-web3name:'+web3name+' dtns-info:',dtnsInfo)
        //检测输入domainName是否正确
        if(!dtnsInfo || dtnsInfo && dtnsUrl.indexOf('.')>0 && web3name +'.'+dtnsInfo.network!= domainName){
            console.log('domainName Error:',domainName,web3name,dtnsInfo)
            //这里还有下一步（查询domain对应的dtns-id，然后获得对应的network）
            let domainMapInfoRet = await this.queryDTNSNetwork('/chain/map/value',
                {token:this.DTNS_ROOT_TOKEN,map_key:'domain:'+domainName})
            console.log('domainMapInfoRet:',domainMapInfoRet)
            if(!domainMapInfoRet || !domainMapInfoRet.ret){
                this.queryDTNSAll() //更新dtns-all
                return null
            }
            let ibappid = domainMapInfoRet.map_value
            let is_ibappid = ibappid.indexOf('_')>0
            for(let i=0;this.web3apps && i<this.web3apps.length ; i++)
            {
                let web3appInfo = this.web3apps[i]
                if(web3appInfo && (is_ibappid && web3appInfo.web3_id == ibappid  //是web3_id
                    || !is_ibappid && web3appInfo.web3name == ibappid)) //或者是web3name
                {
                    console.log('query-result-domain-map-ibapp-info:',web3appInfo)
                    web3appInfo.params = params
                    return web3appInfo
                } 
            }
            return null
        }

        //判断是否使用静态指向的dtns（2023-6-16新增）
        if(dtnsInfo && typeof g_dtns_network_static_hosts!='undefined' && g_dtns_network_static_hosts[web3name])
        {
            dtnsInfo.network_info = g_dtns_network_static_hosts[web3name]
        }else if(web3name.startsWith('devtools')){
            dtnsInfo.network_info = g_dtns_network_static_hosts['main'] //强制为main默认指向的hosts
        }
        dtnsInfo.params = params
        return dtnsInfo
    }
    async queryDTNSNetwork(url,reqdata)
    {
        if(typeof g_axios =='undefined'){
            console.log('[Error] g_axios is undefined'  )
            return null
        }
        let statisDTNSUrls = typeof g_dtns_nslookup_static_urls !='undefined' ? g_dtns_nslookup_static_urls : ['http://static.dtns.nftlist.com.cn','http://static.dtns.forklist.nftlist.com.cn']

        let dtnsUrl = statisDTNSUrls[parseInt(Math.random()*159999)%statisDTNSUrls.length]
        try{
            let ret = await g_axios.get(dtnsUrl+url,{params:reqdata,headers:{'Content-Type': 'application/x-www-form-urlencoded'}})
            if(!ret){
                dtnsUrl = statisDTNSUrls[parseInt(Math.random()*159999)%statisDTNSUrls.length]
                ret = await g_axios.get(dtnsUrl+url,{params:reqdata,headers:{'Content-Type': 'application/x-www-form-urlencoded'}})
            }
            return ret && ret.data ? ret.data : ret
        }catch(ex){
            console.log('DTNSManager.queryDTNSNetwork-exception:'+ex,ex)
            return null
        }
    }
    async queryIBAppListStatus()
    {
        if(typeof g_axios =='undefined'){
            console.log('[Error] g_axios is undefined'  )
            return null
        }
        let result = {}
        if(this.networkInfoMap)
        for(let key of this.networkInfoMap.keys())
        {
            let statisDTNSUrls = typeof g_ibapp_status_urls !='undefined' ? g_ibapp_status_urls : ['https://groupbuying.opencom.cn:446/hosts']
            statisDTNSUrls = key && this.networkInfoMap.get(key) ? this.networkInfoMap.get(key).tns_urls : statisDTNSUrls
            let dtnsUrl = statisDTNSUrls[parseInt(Math.random()*159999)%statisDTNSUrls.length]
            dtnsUrl = dtnsUrl.endsWith('hosts') ? dtnsUrl : dtnsUrl+'/hosts'
            let ret = await g_axios.get(dtnsUrl,{params:{},headers:{'Content-Type': 'application/x-www-form-urlencoded'}})
            let tmpRet = ret && ret.data ? ret.data : ret
            console.log('queryIBAppListStatus-key:'+key,this.networkInfoMap.get(key))
            console.log('tmpRet:',tmpRet,result)
            if(tmpRet) result = Object.assign({},result,tmpRet)
            console.log('tmpRet:',tmpRet,result)
        }
        // let result = ret && ret.data ? ret.data : ret
        console.log('queryIBAppListStatus:results:',result)
        return result
    }
    async queryDTNSAllStatic()
    {
        if(typeof g_axios =='undefined'){
            console.log('[Error] g_axios is undefined'  )
            return null
        }
        let static_url = window.g_dtns_ibapps_static_url ? window.g_dtns_ibapps_static_url: 'https://static.dtns.top/ibapps.json'
        let result = await g_axios.get(static_url,{params:{a:Math.random()},headers:{'Content-Type': 'application/x-www-form-urlencoded'}})
        console.log('queryDTNSAllStatic:result:',result)
        // process.exit(1)
        if(result && result.data){
            result = result.data
        }
        if(result){
            this.web3nameDTNSMap = new Map()
            this.networkInfoMap  = new Map()
            this.web3apps = result.list
            for(let key in result.networks)
            {
                console.log('networks-key:'+key,result.networks[key])
                this.networkInfoMap.set(key,result.networks[key])
            }
            for(let i=0;i<this.web3apps.length;i++)
            {
                console.log('web3name:'+this.web3apps[i].web3name,this.web3apps[i])
                this.web3nameDTNSMap.set(this.web3apps[i].web3name,this.web3apps[i])
            }
            // process.exit(1)
            return true
        }
        return false
    }
    async queryDTNSAll()
    {
        let staticRet = await this.queryDTNSAllStatic()
        console.log('queryDTNSAll-queryDTNSAllStatic-staticRet:',staticRet)
        if(staticRet) return this.web3apps

        let web3appList = await this.queryDTNSNetwork('/chain/relations',{token:this.DTNS_ROOT_TOKEN,opcode:'relw',begin:0,len:10000})
        console.log('queryDTNSAll-web3appList-ret:',web3appList)
        if(!web3appList||!web3appList.list || web3appList.list.length<=0){
            return null
        }
        let web3idsQueryM = []
        for(let i=0;i<web3appList.list.length;i++)
        {
            web3idsQueryM.push(this.queryDTNSNetwork('/chain/opcode',{token:web3appList.list[i].token_y,'opcode':'assert',begin:0,len:1}))
        }
        let rets = await Promise.all(web3idsQueryM)
        console.log('queryDTNSAll-web3ids-assert-results:',rets)
        let networkInfoQueryM = [],networkKinds = [],web3apps = []
        for(let i=0;i<rets.length;i++)
        {
            let obj = rets[i]
            try{
                if(obj && obj.ret){
                    obj = JSON.parse(JSON.parse(obj.list[0].txjson).opval)
                }
            }catch(ex){
                console.log('rets-i:'+i+' exception:'+ex,ex)
                obj = null;
            }
            web3apps.push(obj)

            if(!obj) continue
            let  network = obj.network 
            network = !network ? 'main.dtns':network
            if(!obj.network) obj.network  = network //更新network
            if(networkKinds.indexOf(network)>=0) continue
            networkInfoQueryM.push(this.queryDTNSNetwork('/chain/map/value',
                {token:this.DTNS_ROOT_TOKEN,map_key:'network:'+network}))
            networkKinds.push(network)
        }
        let networkTokenIDRets = await Promise.all(networkInfoQueryM)
        console.log('networkTokenIDRets:',networkTokenIDRets)
        let networkTokenIDRetsList = [],networkInfoQueryM2 = []
        for(let i=0;i<networkTokenIDRets.length;i++)
        {
            let idRet = networkTokenIDRets[i]
            if(idRet && idRet.ret){
                networkTokenIDRetsList.push(idRet.map_value)
                networkInfoQueryM2.push(this.queryDTNSNetwork('/chain/opcode',{token:idRet.map_value,opcode:'assert',begin:0,len:1}))
            } else{
                networkTokenIDRetsList.push(null)
                networkInfoQueryM2.push(null)
            }
        }
        console.log('web3apps:',web3apps)

        //得到配置信息
        let networkTokenIDInfoRets = await Promise.all(networkInfoQueryM2)
        console.log('networkTokenIDInfoRets:',networkTokenIDInfoRets)
        let networkTokenInfos = [], networkInfoMap = new Map() ,networkInfoMapObj = {}
        for(let i=0;i<networkTokenIDInfoRets.length;i++)
        {
            let tokenInfo = networkTokenIDInfoRets[i]
            if(!tokenInfo) {
                networkTokenInfos.push(null)
                continue
            }
            try{
                tokenInfo = JSON.parse(JSON.parse(tokenInfo.list[0].txjson).opval)
            }catch(ex){
                console.log('tokenInfo-parse-json-exception:'+ex,ex)
                tokenInfo = null;
            }
            networkTokenInfos.push(tokenInfo)
            if(tokenInfo){
                networkInfoMap.set(tokenInfo.network,tokenInfo)
                networkInfoMapObj[tokenInfo.network] = tokenInfo
            }
        }
        console.log('networkTokenInfos:',networkTokenInfos)
        let web3nameDTNSMap = new Map()
        for(let i=0;i<web3apps.length;i++)
        {
            let obj = web3apps[i]
            if(!obj) continue
            obj.network_info = networkInfoMap.get(obj.network)
            web3nameDTNSMap.set(obj.web3name,obj)
        }
        console.log('web3apps-and-network_info-all-results:',web3apps)
        this.web3nameDTNSMap = web3nameDTNSMap
        this.networkInfoMap  = networkInfoMap
        this.web3apps = web3apps
        // let file_util = require('../libs/file_util')
        // file_util.writeFile('./ibapps.json',JSON.stringify({list:this.web3apps,networks:networkInfoMapObj}))
        return web3apps
    }
}

if(typeof window != 'undefined')
window.DTNSManager = DTNSManager

async function testDTNSManager(dtnsManager = null)
{
    dtnsManager = dtnsManager ? dtnsManager : new DTNSManager()

    let lookRet = await dtnsManager.nslookup('dtns://web3:ld/xxx')
    console.log('lookRet:',lookRet)

    lookRet = await dtnsManager.nslookup('dtns://web3:dtns/xxx')
    console.log('lookRet:',lookRet)

    lookRet = await dtnsManager.nslookup('dtns://web3:forklist/xxx')
    console.log('lookRet:',lookRet)

    lookRet = await dtnsManager.nslookup('dtns://web3:svr/xxx')
    console.log('lookRet:',lookRet)

    lookRet = await dtnsManager.nslookup('dtns://web3:nftlist/xxx')
    console.log('lookRet:',lookRet)

    
    let a = await dtnsManager.nslookup('dtns://ibapp:a/')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://a.b.dtns/')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://a.main.dtns/')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://a.main.dtns/')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://a.main.dtns/')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://JJUNXKKDEIJMERMMDF')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://JJUNXKKDEIJMERMMDF////')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://我是认证，我在这里了')
    console.log('a:',a)

    a = await dtnsManager.nslookup('dtns://我是认证，我在这里了/a/aa')
    console.log('a:',a)
}

testDTNSManager()