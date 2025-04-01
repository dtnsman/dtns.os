/**
 * create by poplang on 2022/9/27
 */

// const TokenUtil = require('../../../dnalink.protocol/DNALinkProtocol').TokenUtil
// const RPCApiUtil= require('../../RPCApiUtil')
// const str_filter = require('../../../libs/str_filter');
// const file_util = require('../../../libs/file_util')

// const file_config = require('../file/FileController').config
// var fs = require("fs");

// const puppeteer = require('puppeteer');

 //系统函数
const metaSystemMethods={
     refresh:'refresh',//call and start or restart 
     close:'close',//关闭page-tab页面
     screenshot:'screenshot',//get screen_hot by file-token
     content:'content',
}

class MetaController{
    constructor(protocol)
    {
        this.protocol = protocol
        this.fsm_config = protocol.fsm_config
        this.root_config= protocol.root_config
        this.token_util = new TokenUtil(this.protocol)
        this.rpc_api_util = new RPCApiUtil(this.protocol)

        this.TOKEN_ROOT = protocol.root_config.TOKEN_ROOT
        this.TOKEN_NAME = protocol.root_config.TOKEN_NAME
        this.DOMAIN_PORT = this.root_config.DOMAIN_PORT

        this.web3metaBaseUrl = 'web3.meta.pop.lang'
        this.web3WebSocketDomain = '127.0.0.1:'+this.DOMAIN_PORT

        this.wsEndpoint = null;
        this.browser = null;
        this.pages = {}
    }
    meta_c_index(app) {
        let This = this
        app.all('/super/meta/set',function(req,res){This.setMetaFunction(req,res)});//设置超维合约函数（web3.meta）
        app.all('/super/meta/call',function(req,res){This.callMetaFunction(req,res)});//opcode=web3.meta.call
    }
    /**
     * 设置合约函数
     * 将外部文件设置为自身合约的运行文件---暂时不可行（尽量不跨域；简化复杂性）。
     * 将token_x自身的file设置为超维合约执行，【允许】（简化复杂性）！me-file
     * 将parent-token自身的file设置为超维合约执行，暂时【不允许】，但可直接调用！parent-file
     * 将children-token的file设置为超维合约执行，【允许】！children-file
     * 
     * http://127.0.0.1:60000/super/meta/set?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_z3nbw9r1uHG7wctf&token_y=valuetest_z3nbw9r1uHG7wctf&opcode=web3.meta&opval=%7B%22file_id%22:%22valuetest_file2z3BFt27W6it%22,%22methods%22:%7B%22screenshot%22:%22screenshot%22%7D,%22width%22:480,%22height%22:960%7D&extra_data=wslisten-helloworld
     */
    async setMetaFunction(req,res)
    {
        let {token,token_x,token_y,opval,extra_data,next} =  str_filter.get_req_data(req)
        token = (''+token).length>5? token:null;
        if( !this.token_util.validateTokenID(token))
            return res.json({ret:true,msg:'token error'})
    
        if(!opval) return res.json({ret:false,msg:'opval error'})
        let opvalJSON = null;
        try{
            opvalJSON = JSON.parse(opval)
        }catch(ex)
        {
            console.log('opvalJSON-ex:'+ex)
            return res.json({ret:false,msg:'opval json-parse failed',opval})
        }
        let {file_id,methods,width,height} = opvalJSON
    
        opvalJSON.width = !width || parseInt(height)<=0 ? 1280:width
        opvalJSON.height = !height || parseInt(height)<=0 ? 960:height
    
        let fileInfo = await this.rpc_api_util.s_query_token_info('',file_id,this.fsm_config.OP_FILE)//await rpc_query('/chain/opcode',{token:file_id,opcode:OP_FILE,})
        if(!fileInfo || !fileInfo.path) return res.json({ret:false,msg:'file-info error'})
        opvalJSON.fileInfo = fileInfo;
        let setRet = await this.rpc_api_util.s_save_token_info('',token,token,
            this.fsm_config.OP_WEB3_META,JSON.stringify(opvalJSON),extra_data);
        if(setRet) {
            if(next)
            {
                let param = {token_x,token_y,opcode:this.fsm_config.OP_WEB3_META_SET,//这里是保存纪录（持续纪录）
                    opval:JSON.stringify(opvalJSON),extra_data,set_call:true};
                let opRet =await this.rpc_api_util.rpc_query('/op',param)
                console.log('OP_WEB3_META_SET-opRet:'+JSON.stringify(opRet))
                opRet = !opRet? {ret:false,msg:'unexpect error'}:opRet;
                opRet.fileInfo = fileInfo
                res.json(opRet)
                return ;
            }else{
                return res.json({ret:true,msg:'success',log:'failed'})
            }
        }
        else return res.json({ret:true,msg:'set meta-info failed'})
    }
    
    /**
     * 调用超维合约函数
     * 子域调用---token_x与token_y都是token父域之下；跨域调用，同处更高级别的token_parent之下
     * 需要把权限理清楚
     * 1、自身调用自身（设置了opcode=web3.meta的token，使用token_x-token_y均为自身token，拥有完整权限）me
     * 2、子域token调用父域自身（允许本meta-token拥有了合约的所有权限，不需要调用者的token权限即可完成合约执行和签名）children
     * 3、超维域调用自身，这个属于父域调用自身，也是安全和可信的（父级权限肯定比自身和子级高，所以允许调用）//parent
     * 4、平行域调用自身，这个涉及比较多的安全风险和不可控的内容，需要重点考虑如何创建安全访问--建议由父域或者token-root调用）//brother
     * 5、平行空间domain调用自身，这个超过了想像（由父域或者根域完成DNS、MNS等转化后，由内部parent域调用完成调用）。
     *
     *http://127.0.0.1:60000/super/meta/call?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_z3nbw9r1uHG7wctf&token_y=valuetest_z3nbw9r1uHG7wctf&opcode=web3.meta&opval=%7B%22method%22:%22screenshot%22%7D&extra_data=wslisten-helloworld 
    * 
    * //设置vip.html有web3.meta超维合约
    * http://127.0.0.1:60000/super/meta/set?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_file22axi6p2k5Y5&token_y=valuetest_file22axi6p2k5Y5&opcode=web3.meta&opval=%7B%22file_id%22%3A%20%22valuetest_file22axi6p2k5Y5%22%2C%22methods%22%3A%20%7B%22screenshot%22%3A%20%22screenshot%22%2C%22setProfile%22%3A%22setProfile%22%7D%2C%22width%22%3A%20480%2C%22height%22%3A%20960%7D&extra_data=wslisten-helloworld
    * //调用setProfile函数
    * http://127.0.0.1:60000/super/meta/call?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_file22axi6p2k5Y5&token_y=valuetest_file22axi6p2k5Y5&opcode=web3.meta.call&opval=%7B%22method%22%3A%22setProfile%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%91%E9%BE%99%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
    * //获得动态生成的算法图片
    * http://127.0.0.1:60000/super/meta/call?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_file22axi6p2k5Y5&token_y=valuetest_file22axi6p2k5Y5&opcode=web3.meta.call&opval=%7B%22method%22%3A%22screenshot%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%8F%E9%BE%99%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
    * //关闭或者刷新页面（当上传文件时，可使用method=refreh刷新页面）
    * http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file24ifDv2GvUdL&token_y=valuetest_file24ifDv2GvUdL&opcode=web3.meta.call&opval=%7B%22method%22%3A%22close%22%2C%22params%22%3A%7B%22name%22%3A%22%E4%BD%95%E5%B0%91%E5%86%9B%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
    * 
    */
    async callMetaFunction(req,res)
    {
        let {token,token_x,token_y,opval,next,extra_data} =  str_filter.get_req_data(req)
        token = (''+token).length>5? token:null;
        if(!this.token_util.validateTokenID(token))
            return res.json({ret:true,msg:'file-id or token error'})
    
        if(!opval) return res.json({ret:false,msg:'opval error'})
        let opvalJSON = null;
        try{
            opvalJSON = JSON.parse(opval)
        }catch(ex)
        {
            console.log('opvalJSON-ex:'+ex)
            return res.json({ret:false,msg:'opval error,can not parse to JSON'})
        }
        let {method,params} = opvalJSON
        let loaded = false;
    
        let metaInfo  =  await this.rpc_api_util.s_query_token_info('',token,this.fsm_config.OP_WEB3_META)
        if(!metaInfo || !metaInfo.file_id) return res.json({ret:false,msg:'meta-info is empty'})
    
        let {file_id,methods,fileInfo,width,height} = metaInfo;
        if(!method || !methods )  return res.json({ret:false,msg:'callFunc or methods error'})
        if(!methods[method]){
            if(!metaSystemMethods[method]) return res.json({ret:false,msg:'methods have no  callFunc'})
        } 
    
        fileInfo = await this.rpc_api_util.s_query_token_info('',file_id,this.fsm_config.OP_FILE)//await rpc_query('/chain/opcode',{token:file_id,opcode:OP_FILE,})
        if(!fileInfo || !fileInfo.path) return res.json({ret:false,msg:'file-info error'})
    
        //
        if(!this.browser)//!wsEndpoint || 
        {
            //'--no-sandbox', '--disable-setuid-sandbox',
            this.browser = await puppeteer.launch({headless:true,args: ['--no-sandbox', '--disable-setuid-sandbox']});
            /*browser = await puppeteer.launch({headless:true,
                blockAds:false,//https://docs.browserless.io/docs/chrome-flags.html#:~:text=By%20default%20puppeteer%20specifies%20a%20certain%20number%20of,chromium%20to%20become%20unstable%20or%20refuse%20to%20launch.
                args: [
                // '--no-sandbox', '--disable-setuid-sandbox',
            //     '--disable-extensions',
            //     '--disable-extensions-http-throttling',
            //     '--testing',
            //     '--tether-host-scans-ignore-wired-connections',
            //     '--allow-insecure-localhost ',
            //     '--loading-predictor-allow-local-request-for-testing',
            //     '--disallow-policy-block-dev-mode',
            //
            //      '--disable-web-security',
            //  '--disable-features=IsolateOrigins,site-per-process',
            ]});
            */
            this.wsEndpoint = this.browser.wsEndpoint()
        }
        //得到page
        if((!this.pages[token] || this.pages[token].isClosed()) && method!='close')
        {
            await this.initPage(fileInfo,token,width,height)
            loaded = true;
        }
    
        console.log('wsEndpoint:'+this.wsEndpoint)
        let cookie =await this.pages[token].cookies()
        console.log('cookies:'+JSON.stringify(cookie))
    
        let uploadFileUrl =  'http://127.0.0.1:'+this.DOMAIN_PORT+'/super/file/upload'
        let content = '';
        if(method == 'refresh')
        {
            console.log('refresh-url:'+this.pages[token].url())
            if(!loaded) await this.pages[token].reload();//pages[token].goto(pages[token].url())//
            opvalJSON.callResult = {ret:true,msg:'success'}
        }else if(method == 'close'){
            if(this.pages[token] && !this.pages[token].isClosed())
            {
                console.log("close page:"+token)
                this.pages[token].close()
                delete this.pages[token]
                opvalJSON.callResult = {ret:true,msg:'success'}
            }else{
                opvalJSON.callResult = {ret:true,msg:'success',tips:'page is already closed'}
            }
        }
        //将返回图片
        else if(method == 'screenshot')
        {
            let filename = 'screenshot'+str_filter.randomBytes(16)+'.png'
            let save_path = file_config.file_temp+filename
            console.log('save_path:'+save_path)
            await this.pages[token].screenshot({path: save_path,type:'png', fullPage:true})
            //直接返回二进制文件？
            let upFileId = await this.rpc_api_util.s_fork_token_id('',token,'file');
            if(!upFileId)  return res.json({ret:false,msg:'fork screenshot-file-id failed'})
            let params = {token:upFileId,appid:this.root_config.appids[0],secret_key:this.root_config.secret_keys[0]}
            console.log('upload-file-params:'+JSON.stringify(params))
            let uploadRet = await file_util.uploadMutipartFile(uploadFileUrl,params,save_path,'image/png')
            console.log('uploadRet:'+JSON.stringify(uploadRet))
            file_util.unlink(save_path);
            opvalJSON.callResult = uploadRet
            if(!uploadRet||!uploadRet.ret) return res.json({ret:false,msg:'upload screenshot-file failed'})
            // else result.callResult = uploadRet//return res.json(uploadRet);
        }else if(method == 'content')
        {
            content = await this.pages[token].content();
            //opvalJSON.content = content;
            res.setHeader("Access-Control-Allow-Origin",'*');
            res.setHeader("ETag",'666666');
            res.setHeader("Cache-Control","max-age=-1, public");
            res.setHeader("Expires", '-1')
            res.setHeader("Content-Type", 'text/html');
        }
        else 
        {
            console.log('method:'+method+' params:'+JSON.stringify(params))
            try{
                let callResult = await this.pages[token].evaluate(async (method,params,token)=>{
                    window.token = token;
                    // console.log('getWeb3Meta-token:'+token)
                    // window.web3meta = window.getWeb3(token)
                    // console.log('window.web3meta:'+window.web3meta)
                    console.log('windown-method:'+method)
                    return  window[method](params)//await eval(method+'('+JSON.stringify(params)+')')//
                },method,params,token);
                opvalJSON.callResult = callResult ;
                console.log('window[method]-callResult:'+JSON.stringify(callResult))
            }catch(ex){
                console.log('pages[token].evaluate-exception:'+ex)
            }
            // let retJson = await rpc_api_util.s_save_token_info('',token,token,OP_WEB3_META_CALL,JSON.stringify(opvalJSON),extra_data)
            // if(retJson )  return res.json({ret:true,msg:'success',callResult})
            // else return res.json({ret:false,msg:'save call-result failed',callResult})
        }
        //处理其他的callMethods请求。
        //res.json({ret:true,msg:'call other func'})
        //是否纪录数据---来自于标准/op请求
        if(next)
        {
            let param = {token_x,token_y,opcode:this.fsm_config.OP_WEB3_META_CALL,
                opval:JSON.stringify(opvalJSON),extra_data,set_call:true};
            let opRet =await this.rpc_api_util.rpc_query('/op',param)
            console.log('OP_WEB3_META_CALL-opRet:'+JSON.stringify(opRet))
            opRet = !opRet? {ret:false,msg:'unexpect error'}:opRet;
            opRet.metaInfo = metaInfo
            opRet.callResult = opvalJSON.callResult
            if(method == 'content')
            {
                res.write(content)
                res.end();
                return ;
            }
            else return res.json(opRet)
        }else{
            opvalJSON.ret = true;
            opvalJSON.msg = 'success'
            return res.json(opvalJSON)//.callResult)
        }
    }
    
    async initPage(fileInfo,token,width,height)
    {
        console.log('brower create newPage')
        let url = 'http://'+this.web3metaBaseUrl+'/chain/file/'+fileInfo.file_id// 'http://'+file_config.host+':'+file_config.port+'/chain/file/'+file_id
        console.log('method-url:'+url)
    
        this.pages[token] = await this.browser.newPage();
        this.pages[token].setViewport({width,height})
        
        //请求拿到token_key，方便js调用token之超维合约的支持函数（fork、op、chain、websocket等等）
        let params = {token_x:token,token_y:token,opcode:this.fsm_config.OP_TOKEN_ACCESS,opval:60*60*24*10000}//1万天超时
        let tokenRet = await this.rpc_api_util.rpc_query('/op',params)
        console.log('tokenKeyRet:'+JSON.stringify(tokenRet))

        // tokenRet.rpc_func_ret = tokenRet.rpc_func_ret ? JSON.parse(tokenRet.rpc_func_ret):null
        if(tokenRet.ret && tokenRet.rpc_func_ret && tokenRet.rpc_func_ret.ret)
            this.pages[token].token_key = tokenRet.rpc_func_ret.token_key;
        
        this.pages[token].on('console', msg => console.log('[puppeteer] '+msg.text()));
        //return  eval(method+'('+JSON.stringify(params)+')')
        // await pages[token].evaluate((token)=>{  return  eval('window.token="'+token+'"')},token)//为window加上token属性。
        //await pages[token].addScriptTag({content:'window.token="'+token+'"',type:'module'})
        // await initAllFunctions(token);//no usage 2022-8-15
        //await getWeb3Meta(token)//
        await this.pages[token].setRequestInterception(true)

        let This = this
        this.pages[token].on('request',  async req=>{
            return await  This.redirectFunc(req,token)
        })
        // //这里做websocket的拦截
        // const client = await this.pages[token].target().createCDPSession();
        // console.log('client:'+JSON.stringify(client))
        // await client.send('Network.enable');
        // let fetchP = {patterns:[{urlPattern:'/super/websocket/link'}]}
        // await client.send('Fetch.enable',fetchP);
        // //{"id":28,"error":{"code":-32602,"message":"Cannot intercept resources of type 'WebSocket'"},"sessionId":"F2609E5A1D0F66961573DDCAC1E17864"}
        // let matchMap = {patterns:[{urlPattern:'*',resourceType:'WebSocket'}]}//interceptionStage:'HeadersReceived'}]}
        // //await client.send('Network.setRequestInterception',matchMap);//JSON.stringify(matchMapArray))
        // client.on('Network.webSocketCreated', (params) => {
        //     console.log('Network.webSocketCreated-params:'+JSON.stringify(params))
        //     // await client.send('Animation.getPlaybackRate');
        // });
        // //
    
        // client.on('Network.webSocketWillSendHandshakeRequest', (params) => {
        //     console.log('Network.webSocketWillSendHandshakeRequest-params:'+JSON.stringify(params))
        //     // await client.send('Animation.getPlaybackRate');
        // });
        // //Network.requestIntercepted
        // client.on('Network.requestIntercepted', (params) => {
        //     console.log('Network.requestIntercepted-params:'+JSON.stringify(params))
        //     // await client.send('Animation.getPlaybackRate');
        // });
        // client.on('*', async (method,params) => {
        //     try{console.log('createCDPSession-params:'+method+' params:'+JSON.stringify(params))}catch(e){}
        //     if(method == 'Network.webSocketCreated')
        //     {
        //         let url = ''+params.url
        //         let matchStr = this.web3metaBaseUrl
        //         console.log('redirect url:'+url);
        //         if(url.indexOf(matchStr)>=0)
        //         {
        //             url = url.replace(matchStr,'127.0.0.1:'+this.DOMAIN_PORT)
        //         }
        //         console.log('redirect url and websocket continue-req-url:'+url);
        //         let modParam = {requestId:params.requestId,url}
        //         //await client.send('Fetch.continueRequest',modParam)
        //     }
        //     // await client.send('Animation.getPlaybackRate');
        // });
        // console.log('client:'+JSON.stringify(client))
        
        //await pages[token].setBypassCSP(true)//---safe是否关键，这里要注意一下。
        //if((fileInfo.mimetype+'').indexOf('html'))
        await this.pages[token].goto(url)
        let cookie = await this.pages[token].cookies()
        console.log('cookies:'+JSON.stringify(cookie))
    
        //初始化一些变量
        await this.pages[token].evaluate(async (token,web3metaBaseUrl,web3WebSocketDomain)=>{
            window.token = token;
            window.web3metaBaseUrl = web3metaBaseUrl
            window.web3WebSocketDomain = web3WebSocketDomain
        },token,this.web3metaBaseUrl,this.web3WebSocketDomain);
        
        return true;
    }
    //由TNS(token-domain-name-service决定是否安全)
    async isTNSSafeUrl(url)
    {
        let urlMatchs = '/'+this.root_config.TNS_NAMESPACE+this.root_config.TOKEN_NAME+'/'
        return url && url instanceof String &&  url.indexOf(urlMatchs)>=0
        // let tnsSafeHosts = await root_redis.get('')
    }
    async redirectFunc(req,token)
    {
        console.log('req.resourceType:'+req.resourceType())
        if(true)//)//true)// 
        {
            let url = ''+req.url()
            let matchStr =this.web3metaBaseUrl //'//web3.meta.pop.lang'
            console.log('redirect url:'+url);
            console.log('redirect url and post-data');
            // if(url.indexOf(matchStr)>=0)//true)// 应该使用TNS来保障安全（只有特定的域节点，才能发送这个token-key）。
            // {
            //     url = url.replace(matchStr,file_config.host+':'+file_config.port)
                let postData = req.postData()
                console.log('postData:'+postData)
                
                //postData = Object.assign({token_key:pages[token].token_key},postData)
                // if(req.isNavigationRequest())//url.indexOf('/super/websocket/link')>0 || 
                //  req.continue({url})
                let isMatch =false;
                if(url.indexOf(matchStr)>=0)//true)// 应该使用TNS来保障安全（只有特定的域节点，才能发送这个token-key）。
                {
                    isMatch = true;
                    url = url.replace(matchStr,'127.0.0.1:'+this.DOMAIN_PORT)

                    if(isMatch || this.isTNSSafeUrl(url))
                    {
                        let bHaveTokenKey = (''+postData).indexOf('name="token_key"')>0 || url.indexOf('?token_key=')>0|| url.indexOf('&token_key=')>0
                        if(!bHaveTokenKey) url =  url+(url.indexOf('?')>0 ? '&':'?')+'token_key='+this.pages[token].token_key
                        console.log('url:'+url)
                    }
                    
                }
                if(req.resourceType()=='xhr'){//注意，如何处理文件。---应该采用文件的数据处理方式。
                    //不用添加appid和密钥（上述代码中在url中添加token_key参数）。
                    //只有安全了，才能给予特定的token_key授权。---如果合约开发者，或者设置者故意将token_key泄露，这是没办法的事情了。
                    // if(isMatch || this.isTNSSafeUrl(url))
                    // {
                    //     bHaveTokenKey = (''+postData).indexOf('name="token_key"')>0 || url.indexOf('?token_key=')>0|| url.indexOf('&token_key=')>0
                    //     if(!bHaveTokenKey) url =  url+(url.indexOf('?')>0 ? '&':'?')+'token_key='+this.pages[token].token_key
                    //     console.log('url:'+url)
                    // }
                    //console.log("(''+request.method()).toLowerCase():"+req.method())
                    // && ((''+req.method()).toLowerCase() == 'post') 
                    //这里通过postData判断是否是Post请求（post请求和get请求使用不同的内部函数调用）。
                    try{
                        let retJson = postData?await this.rpc_api_util.postReq(url,postData) : await this.rpc_api_util.rpc_query(url,{})
                        req.respond({
                            status:200,headers:{"Access-Control-Allow-Origin":"*"},
                            contentType:'text/json',body:JSON.stringify(retJson)
                        })
                    }catch(ex){
                        console.log('redirect-req-type=xhr,exception:'+ex)
                    }
                }else {//资源型内容，直接修改这个链接再请求。
                    req.continue({url})
                }
            // }
            // else  req.continue()
        }else{
            req.continue();
        }
    }
    /**
     * 为Page绑定上函数。
     * @param  token 
     */
    
    //http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_file24ifDv2GvUdL&token_y=valuetest_file24ifDv2GvUdL&opcode=web3.meta.call&opval=%7B%22method%22%3A%22setProfile%22%2C%22params%22%3A%7B%22name%22%3A%22%E5%BC%A0%E5%B0%91%E9%BE%99%22%2C%22date%22%3A%222022%2F08%2F12%22%7D%7D&extra_data=wslisten-helloworld
    async initAllFunctions(token)
    {
        let page = this.pages[token]
        let token_key = page.token_key
        // if(!page || page.isClosed()) return false;
    
        await page.exposeFunction('getWeb3',(token) =>{let x = this.getWeb3Meta(token);console.log('is getWeb3Meta:'+x);return x  });
        await page.exposeFunction('fork',async (token,space) => this.forkFunc(token_key,token,space));
        await page.exposeFunction('send',async (token_x,token_y,opval,extra_data) => this.sendFunc(token_key,token_x,token_y,opval,extra_data));
        await page.exposeFunction('op',async (token_x,token_y,opcode,opval,extra_data) => this.opFunc(token_key,token_x,token_y,opcode,opval,extra_data));
        await page.exposeFunction('query',async (path,req_path,params) => this.queryUrlFunc(token_key,path,req_path,params));
    }
    getWeb3Meta(token)//
    {
        let web3meta = {}///方法和属性的集合
        //window.web3meta =web3meta
        let page = pages[token]
        let token_key = page.token_key
    
        web3meta.fork = async function(token,space){
            return await this.forkFunc(token_key,token,space)//要注意这里的权限（使用token_key？，否则会导致meta超维合约跨安全范围访问权限）。
        }
        web3meta.send = async function(token_x,token_y,opval,extra_data){
            return await this.sendFunc(token_key,token_x,token_y,opval,extra_data)//要注意这里的权限（使用token_key？，否则会导致meta超维合约跨安全范围访问权限）。
        }
        web3meta.op =  async function(token_x,token_y,opcode,opval,extra_data) {
            return await this.opFunc(token_key,token_x,token_y,opcode,opval,extra_data)//要注意这里的权限（使用token_key？，否则会导致meta超维合约跨安全范围访问权限）。
        }
        web3meta.query = async function(path,req_path,params){
            return await this.queryUrlFunc(token_key,path,req_path,params)
        }
        return web3meta;
    }
    async forkFunc(token_key,token,space)
    {
        token_key = !token_key ||(''+token_key).length<=10?'token_key_is_empty':token_key
        let params = {token,space,token_key}
        return await this.rpc_api_util.rpc_query('/fork',params)
    }
    async sendFunc(token_key,token_x,token_y,opval,extra_data)
    {
        return await this.opFunc(token_key,token_x,token_y,this.fsm_config.OP_SEND,opval,extra_data)
    }
    async opFunc(token_key,token_x,token_y,opcode,opval,extra_data)
    {
        token_key = !token_key ||(''+token_key).length<=10?'token_key_is_empty':token_key
        let params = {token_x,token_y,opcode,opval,extra_data,token_key}
        return await this.rpc_api_util.rpc_query('/op',params)
    }
    async queryUrlFunc(token_key,path,req_path,lastParams)
    {
        token_key = !token_key ||(''+token_key).length<=10?'token_key_is_empty':token_key
        let params = {token_key}
        params = Object.assign(params,lastParams)
        return await this.rpc_api_util.rpc_query(path+'?'+req_path,params)
    }
    async  websocketLink(){
    
    }
    //查询访问的路径（使用TNS来实现----类似ENS）
    async queryTNSMap(token)
    {
    //return root_config.TNS = XXXXX;
    }
}
    
// module.exports = MetaController
window.MetaController = MetaController
 