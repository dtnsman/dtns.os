
// const RPCApiUtil = require('../pop.lite.dnalink.engine/dnalink.rpc/RPCApiUtil');
// const str_filter = require('../pop.lite.dnalink.engine/libs/str_filter');


//const pop = poplang()

class PopRuntime{
    //新增了递归函数的最大不能超过的递归深度（this.ctxList数组的深度）
    constructor(context = null,safeFlag = true,commentRetainFlag = true,maxDeep = 1000100)
    {
       // console.log('safeFlag:'+safeFlag)
        this.safeFlag = safeFlag
        this.token_key = null;
        let popTmp = this;
        if(safeFlag)//如果是true，将过滤掉非安全的函数---暂时如此处理
        {
            const vm = require('vm');
            const contextifiedObject = vm.createContext({
                console: console,
                popTmp:this
            });
            //这里对process.exit进行了屏蔽
            vm.runInNewContext('popTmp.$ = typeof globalThis != "undefined" ? globalThis : ( typeof global !="undefined" ?global :( typeof window !="undefined" ? window :{} ) );',contextifiedObject)
                //console.log('newvm-keys:'+' globalThis:'+Object.keys(globalThis))`);
        }
        else 
            popTmp.$ =  typeof globalThis != "undefined" ? globalThis : ( typeof global !="undefined" ?global :( typeof window !="undefined" ? window :{} ) );//并非完全安全（有不少是非安全的，所以需要一个map来确保可靠与安全；例如process.exit）。
        popTmp.$$={}
        //这里内置了一个context，如果未传参数，可以使用pop这个默认的内置的context。
        popTmp.context = context ? context :new Object();
        popTmp.ctxList = []
        popTmp.maxDeep = maxDeep
        popTmp.commentRetainFlag = commentRetainFlag

        this.protocolMap = new Map()
        this.initFuncs()
    }
    //切换protocol
    setProtocol(protocol,name='default')
    {
        this.protocol = this.protocolMap.get(name)
        if(!this.protocol)
        {
            this.protocol = protocol
            this.loadProtocol(name,protocol)
        }
        this.rpc_api_util = this.rpc_api_util && this.protocol==this.rpc_api_util.protocol 
                    ? this.rpc_api_util:    new RPCApiUtil(this.protocol)
        this.fsm_config = this.protocol.fsm_config
        this.OPCODES = this.swapFSMCONFIG(this.fsm_config)
        return true
    }
    //加载到map中（保存起来）
    loadProtocol(name,protocol)
    {
        return this.protocolMap.set(name,protocol)
    }
    setTokenKey(key){this.token_key = key}//访问域为token（特别适合gnode节点的token.web3.pop相关接口的安全访问）
    getContext()
    {
        return this.context
    }
    /***
    * 执行js库，例如JSON.parse，例如parseInt

    //---------[注意]不同的执行环境需求，导致了对安全的不同认知，故需要谨慎看待安全问题
    //---------（仅使用web的js-api是一种方式；但能访问node.js的环境也是一种插件开发的“优势”）
    //这里展示非安全的$.global.func执行的结果（结果表明，这是非常不安全的）。
    //安全map---浏览https://262.ecma-international.org/13.0/ 的ECMASCRIPT标准。
    //特别是：https://262.ecma-international.org/13.0/#sec-ecmascript-standard-built-in-objects
    a = await pop.op({},'c1','c2','$.process.exit','');
    console.log('alreadly exit , you can not go here!')

    */
    jsrun(context,opcode,...etc)//token_x,opval,extra_data,
    {
        if(!context) context = this.context;
        let opList = (opcode).split('.');
        // console.log('jsrun-this:'+this)
        let popFunc = this.$;
        //从$.之后开始遍历
        for(let i=1;opList && i<opList.length;i++)
        {
            // console.log('i:'+opList[i]+' info:'+popFunc[opList[i]])
            if(typeof popFunc != 'undefined')
                popFunc = popFunc[opList[i]]
            else
                break
        }

        // console.log('popFunc:'+popFunc)
        if(!popFunc|| (typeof popFunc) != 'function') return false;
        
        //传入参数和执行(使用...展开参数数组)
        let ret = null;
        if(etc.length>=1)//>=2
        {
            // console.log('opret etc:'+JSON.stringify(etc))
           // let opret = etc.pop();
            let params = []
            // console.log('opret:'+opret+' etc:'+JSON.stringify(etc))
            for(let i=0;i<etc.length;i++){
                if((''+etc[i]).indexOf('@')>=0)
                {
                    console.log('@event:'+etc[i])
                    let This = this;
                    let func = async function(...ps)
                    {
                        // alert('event-func-call:' + JSON.stringify(ps))
                        console.log('0-event-params:'+JSON.stringify(ps))
                        let ps0 = []
                        for(let j=0;ps&&j<ps.length;j++) ps0.push(ps[j])
                        This.context.$event_params = ps0
                        console.log('0-event-params:'+JSON.stringify(This.context.$event_params))
                        This.context.$even_ret = await This.op(This.context,etc[i].split('@')[1])
                    }
                    params.push(func)
                }else{
                    params.push(context[etc[i]])
                }
            } 
            // context[opret] = popFunc(...params) //(typeof context[token_x]) != 'Array' ?  popFunc(context[token_x]): popFunc(context[token_x])// !context[token_x] || !(typeof context[token_x] == 'Array') ?
            // //  popFunc(context[token_x]):
            // ret = context[opret]
            ret = popFunc(...params)
        }else{
            ret =popFunc()//etc.length>0 ? popFunc( context[etc[0]]):
        }
        context['$ret'] = ret
        return ret
    }
    async jsrun2Self(context,opcode,token_x,...etc)//token_y,opval,extra_data,
    {
        if(!context) context = this.context;
        let opList = (opcode).split('.');
        let parent = context[token_x] 
        //从$.之后开始遍历
        for(let i=1;opList && i<opList.length-1;i++)
        {
            let tmpP = parent
            if(typeof parent != 'undefined')
                parent = parent[opList[i]]
            else
                break
            // parent = parent ? parent:tmpP
        }
        let popFunc = parent[opList[opList.length-1]]
        //这里可能结果为0，所以更需要判断undefined(特别处理$.$.length)
        if((typeof popFunc) == 'undefined') return false;//|| (typeof popFunc) != 'function'

        let ret = null;
        if((typeof popFunc) == 'function')
        {
            if(etc.length>=1)//>=2
            {
                // console.log('opret etc:'+JSON.stringify(etc))
                // let opret = etc.pop();
                let params = []
                // console.log('opret:'+opret+' etc:'+JSON.stringify(etc))
                for(let i=0;i<etc.length;i++)  params.push(context[etc[i]])
                ret =  await parent[opList[opList.length-1]](...params)//context[opret] = 
            }else{
                ret = await parent[opList[opList.length-1]]() // etc.length>0 ?parent[opList[opList.length-1]](etc[0]):
            }
        }else{
            // let opret = etc.pop();
            // if(opret) {
            //     ret = context[opret] = parent[opList[opList.length-1]]
            // }else{
                ret = parent[opList[opList.length-1]]
            // }
        }
        context['$ret'] = ret
        return ret
    }
    /**
     * 执行binderRun，主要是本机的一些函数。
     * @param {*} context 
     * @param {*} token_x 
     * @param {*} token_y 
     * @param {*} opcode 
     * @param {*} opval 
     * @param {*} extra_data 
     */
    binderRun(context,opcode,...etc)
    {
        if(!context) context = this.context;
        // console.log('typeof op:'+opcode+' is '+(typeof this.$$[opcode]))
        if(!this.$$[opcode] || (typeof this.$$[opcode]) != 'function') return false;
        return this.$$[opcode](context,opcode,...etc)
    }

    binderAddOpcode(opcode,func)
    {
        this.$$[opcode] = func;
        return true;
    }

    initFuncs(){
        this.binderAddOpcode('typeof',function(context,opcode,token_x,token_y,...etc){
            context[token_y] =  typeof context[token_x]
            return context[token_y];
        })
        this.binderAddOpcode('+',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] =    context[token_x]+ context[token_y]
            return context[opval];
        })
        this.binderAddOpcode('-',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] -  context[token_y]
            return context[opval];
        })
        this.binderAddOpcode('*',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] *  context[token_y]
            return context[opval];
        })
        this.binderAddOpcode('/',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] / context[token_y]
            return context[opval];
        })
        this.binderAddOpcode('|',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] |  context[token_y]
            return context[opval];
        })

        this.binderAddOpcode('&',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] &  context[token_y]
            return context[opval];
        })

        this.binderAddOpcode('!',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[token_y] = !context[token_x] 
            return context[token_y];
        })
        this.binderAddOpcode('~',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[token_y] = ~context[token_x] 
            return context[token_y];
        })
        this.binderAddOpcode('?=',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[extra_data] = context[token_x] ? context[token_y]:context[opval]
            return context[extra_data];
        })

        //判断或者否
        this.binderAddOpcode('||',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            // context[token_x] = opvalObj.left &  opvalObj.right;
            // return context[token_x];
            context[opval] = context[token_x] ||  context[token_y]
            return context[opval];
        })

        this.binderAddOpcode('&&',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            // let opvalObj = JSONParse(opval)
            // context[token_x] = opvalObj.left &&  opvalObj.right;
            // return context[token_x];
            context[opval] = context[token_x] &&  context[token_y]
            return context[opval];
        })


        this.binderAddOpcode('!',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[token_y] = !context[token_x]
            return context[token_y];
        })


        this.binderAddOpcode('>',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] >  context[token_y]
            return context[opval];
        })

        this.binderAddOpcode('>=',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] >=  context[token_y]
            return context[opval];
        })


        this.binderAddOpcode('<',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] <  context[token_y]
            return context[opval];
        })


        this.binderAddOpcode('<=',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] <=  context[token_y]
            return context[opval];
        })
        this.binderAddOpcode('@',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            let ret = null;
            try
            {
                ret = context[token_x][context[token_y]]
            }catch(ex){console.log('@-exception:'+ex)}
            if(opval) context[opval] = ret
            else context['$ret']  =ret
            return ret
        })
        //赋值语句（非对象拷贝）
        this.binderAddOpcode('=',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            // let opvalObj = JSONParse(opval)
            context[token_x] =  context[token_y]
            return context[token_x];
        })
        //赋值语句
        this.binderAddOpcode('set',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            let opvalObj = JSONParse(token_y)
            context[token_x] =  opvalObj
            return context[token_x];
        })
        this.binderAddOpcode('get',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            return context[token_x];
        })
        this.binderAddOpcode('this.assign',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            let opvalObj = JSONParse(token_x)
            // console.log('this.assign:opvalObj:'+opvalObj)
            // console.log('this.context:'+JSON.stringify(this.context)+' context:'+context)
            Object.assign(context,opvalObj)
            // console.log('this.context:'+JSON.stringify(this.context)+' context:'+JSON.stringify(context))
            return context
        })
        this.binderAddOpcode('this.get',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            return context
        })
        //deep-copy 深度拷贝
        this.binderAddOpcode('object.assign',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[token_x] = Object.assign({},context[token_x],context[token_y])
            // console.log('this.context:'+JSON.stringify(this.context)+' context:'+JSON.stringify(context))
            return context[token_x]
        })
        //循环递归设置属性（修改的是对象的深度属性）
        this.binderAddOpcode('object.set',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
           // let opvalObj = JSONParse(opval)
            let opList = token_x.split('.') //(context[token_x]).split('.');
            let parent = context//[token_x] 
            //从$.之后开始遍历
            for(let i=0;opList && i<opList.length-1;i++)
            {
                if(typeof parent != 'undefined') parent = parent[opList[i]]
                else break
            }
            // console.log('parent:'+JSON.stringify(parent))
            parent[opList[opList.length-1]] =  context[token_y]//opvalObj;
            // console.log('parent-length-1:'+opList[opList.length-1])
            // console.log('parent:'+JSON.stringify(parent))
            return context[token_y];
        })
        ////循环递归获得属性值（获得的是对象的深度属性）
        this.binderAddOpcode('object.get',function(context,opcode,token_x,token_y,opval,extra_data,...etc)
        {
            let opList = (token_x).split('.');
            let parent = context//[token_x] 
            for(let i=0;opList && i<opList.length;i++)
            {
                //console.log('object.get.parent:'+JSON.stringify(parent))
                if(typeof parent != 'undefined') parent = parent[opList[i]]
                else break
            }
            context[token_y] = parent;
            return context[token_y];
        })
        //切换当前context至目标的子context
        this.binderAddOpcode('.',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            let flag = false;
            if(context && context!=This.context){//对context与this.context不一致的进行压栈处理
                let tmpX = This.context
                This.context = context;
                This.ctxList.push(tmpX);
                flag =true
            }
            //递归去设置新的This.context
            let tmpCtx = This.context;context = tmpCtx
            let opList = token_x ?  token_x.split('.'):[]
            let parent = context
            //从$.之后开始遍历
            for(let i=0;opList && i<opList.length;i++)
            {
                // console.log('object.get.parent:'+JSON.stringify(parent))
                if(typeof parent != 'undefined') parent = parent[opList[i]]
                else break
            }
            This.context = parent
            if(!flag) This.ctxList.push(tmpCtx)
            return true
        })

        this.binderAddOpcode('pwd',function(context){
            return This.ctxList
        })

        this.binderAddOpcode('..',function(context){
            let tmpCtx = This.ctxList.pop()
            This.context = tmpCtx ? tmpCtx : This.context 
            return true
        })

        this.binderAddOpcode('==',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            // let opvalObj = JSON.parse(opval)
            context[opval] = context[token_x] ==  context[token_y]
            return context[opval];
        })

        this.binderAddOpcode('===',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            context[opval] = context[token_x] ===  context[token_y]
            return context[opval];
        })
        //token_y指向了iswait(是否按顺序处理--使用await语法)
        let This = this
        this.binderAddOpcode('func',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            //let opvalObj = JSONParse(opval)
            context[token_x] = async function(c)//由context进行传入参数//params,extra_data)
            {
                //c[token_y]未定义时,使用iswait默认为true,否则为c[token_y]的值．
                return await This.opbatch(c,context[token_y],(typeof c[opval]) == 'undefined'?true:c[opval])
            }
            return {ret:true,msg:'func-define-ok',pop_op:'func',func:context[token_x]}
        })
        //是否支持嵌套if-else定义？（按理说是需要的）
        this.binderAddOpcode('pop.ifelse',async function(context,opcode,token_x,token_y,opval,...etc){
            if(context[token_x]) return await This.op(context,token_y,...etc)
            else return await This.op(context,opval,...etc)
        })
        this.binderAddOpcode('pop.while',async function(context,opcode,token_x,token_y,...etc){
            while(context[token_x]) await This.op(context,token_y,...etc)
            return {ret:true,msg:'pop.while run end'}
        })
        this.binderAddOpcode('pop.sleep',async function(context,opcode,token_x,token_y,...etc){
            return await str_filter.sleep(token_x)
        })
        this.binderAddOpcode('pop.do.until',async function(context,opcode,token_x,token_y,...etc){
            let flag = (''+token_x).indexOf('@')==0?This.$$[token_x.split('@')[1]]: context[token_x]
            while(!flag){await This.op(context,token_y,...etc);flag = (''+token_x).indexOf('@')==0?This.$$[token_x.split('@')[1]]: context[token_x]} 
            return {ret:true,msg:'pop.do.until run end'}
        })
        this.binderAddOpcode('pop.do.while',async function(context,opcode,token_x,token_y,...etc){
            do{
                await This.op(context,token_y,...etc)
            }
            while(context[token_x])
            return {ret:true,msg:'pop.do.while run end'}
        })
        /**
         * ifelse 的函数封装
         */
        this.binderAddOpcode('func.ifelse',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            console.log('into func.ifelse-binder:'+JSON.stringify(context)+' token_x:'+token_x)
            // let opvalObj = JSONParse(opval)

            context[token_x] = async function(c)//由context进行传入参数//params,extra_data)
            {
                if(context[token_y]) await context[token_x].ifdo(c)
                else await context[token_x].elsedo(c)
            }

            context[token_x].ifdo = async function(c)//由context进行传入参数//params,extra_data)
            {
                await This.opbatch(c,context[opval].ifdo,true)
            }
            context[token_x].elsedo = async function(c)//由context进行传入参数//params,extra_data)
            {
                await This.opbatch(c,context[opval].elsedo,true)
            }

            return {ret:true,msg:'func-define-ok',pop_op:'func.ifelse',func:context[token_x]}

            // return context[token_x];
        })

        /**
         * while 的函数封装
         */
        this.binderAddOpcode('func.while',function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            //let opvalObj = JSONParse(opval)
            context[token_x] = async function(context)//由context进行传入参数//params,extra_data)
            {
                let maxSepCnt = 100000
                while(context[token_y] && maxSepCnt>0){
                    maxSepCnt--
                    await This.opbatch(context,context[opval],true)
                }
                return {ret:true,msg:'while-func.call success'};
            }

            return {ret:true,msg:'func-define-ok',pop_op:'func.while',func:context[token_x]}//context[token_x];
        })

        this.binderAddOpcode('func.call',async function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            // let opvalObj = JSONParse(opval)
            //console.log('func.call--context[token_x]:'+token_x+' func:'+context[token_x])
            if(!context[token_x] || (typeof context[token_x]) != 'function') return false;
            let ret = await context[token_x](context)
            return ret ; // context[token_x];
        })
        //新建一个全新的对象，赋值给token_x指向的context变量
        this.binderAddOpcode('new',function(context,opcode,token_x,token_y,opval,extra_data){
            let ret = null;
            switch((token_x).toLowerCase())
            {
                case 'obj':
                case 'object':ret = new Object();break;
                case 'list':
                case 'array':ret = [];break;
                case 'double':
                case 'float': ret = 0.0;break;
                case 'str':
                case 'string':ret = '';break;
                case 'int':ret=0;break;
                case 'date':ret = new Date();break;
                case 'map':ret = new Map();break;
                case 'pop':ret = new PopRuntime();break;
                default:ret = {};
            }
            if(token_y) return context[token_y] = ret
            else return ret
        })
        //删除指向的对象属性等---这个功能是比较危险的，比如说del $pop.$（删除库函数）。
        this.binderAddOpcode('del',function(context,...etc){
            for(let i=0;etc&& i<etc.length;i++)
                delete context[etc[i]]
            return true
        })

        this.binderAddOpcode('clear',function(context,...etc){
            //这个在切换上下文context时会失效，请使用key
            delete This.context
            This.context = {}
            return true
        })

        //上传文件（这个函数重新封装了上传）
        //【注意】需要进行本地化处理，所以放在这里，而不是直接rpc接口的再封装（优雅性不够）
        this.binderAddOpcode('local.file.upload',async function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            let save_path = context[opval]
            let mine_type = context[token_y]
            let params = {token:context[token_x]}
            let p = Object.assign({},params,context[extra_data])
            for(let i=0;etc && i<etc.length;i++) p[etc[i]] = context[etc[i]]
            let uploadFileUrl = p.url
            console.log('upload-p:'+JSON.stringify(p))
            const file_util = require('../libs/file_util')
            context.op_ret = await file_util.uploadMutipartFile(uploadFileUrl,p,save_path,mine_type);
            console.log('uploadRet:'+JSON.stringify(context.op_ret))
            // if(context.op_ret && context.op_ret.ret) file_util.unlink(save_path);
            return context.op_ret 
        })
        //下载文件s
        this.binderAddOpcode('local.file.download',async function(context,opcode,token_x,token_y,opval,extra_data,...etc){
            let url = context[token_x];
            let params =context[token_y]
            let path = context[opval]
            let p = Object.assign({},params,context[extra_data])
            for(let i=0;etc && i<etc.length;i++) p[etc[i]] = context[etc[i]]
            context.op_ret = await this.rpc_api_util.rpc_file(url,p,path)
            console.log('download-ret:'+JSON.stringify(context.op_ret))
            return context.op_ret 
        })

        /**
         * 与import一样需要设计（不安全）
         */
        this.binderAddOpcode('require',function(context,opcode,token_x,token_y,opval,extra_data){
            if(This.safeFlag) return false;//仅当safeFlag = false时，才允许使用require
            context[token_x] = require(token_y);
            return context[token_x];
        })
        /**
         * 执行一段文本脚本。
         */
        this.binderAddOpcode('script',async function(context,opcode,token_x,token_y,opval,extra_data){
            let script = token_x
            let isAwait = !token_y
            let sret =isAwait ? await This.runScript(context,script,isAwait):This.runScript(context,script,false)
            if(opval) context[opval] = sret;
            return sret ;
        })
        //得到返回的值（可以返回多个），多个的话会形成数组。
        this.binderAddOpcode('return',async function(context,opcode,...etc){
            let rets =[]
            for(var i=0;i<etc.length;i++) rets.push(context[etc[i]])
            if(etc.length<=1) return {ret:true,msg:'obj',result:rets[0]}
            else return {ret:true,msg:'list',result:rets}
        })
        //退出，但不返回结果
        this.binderAddOpcode('pop.exit',async function(context,opcode,...etc){
            return {ret:true,msg:'pop.exit'}
        })
        //永远的注释（不会被编译器去掉，//会受到this.commmentRetainFlag影响
        this.binderAddOpcode('##',async function(context,opcode,...etc){
            return true;
        })
        //重命名opcode指令
        this.binderAddOpcode('alias',async function(context,opcode,token_x,token_y,...etc){
            This.binderAddOpcode(token_y,This.$$[token_x])
            return typeof This.$$[opcode]!='undefined'
        })
        //设置protocol
        this.binderAddOpcode('::',async function(context,opcode,token_x,token_y,...etc){
            if(!context[token_y]) return This.setProtocol(null,token_x)
            else return This.setProtocol(context[token_y],token_x)
        })
    }
    /**
     * 封装了的标准的操作原语
     * 还需要封装文件操作---【重要】在libs/file_utils.js中有封装本机文件上传至远程（node.js版本）。
     * 考虑：提供一个sqlite本机/浏览器版本
     * 一点：是否将token_x、token_y、opcode、opval等字符全部设置为动态执行（亦即变量引用--变量指针）
     * @param {*} context 
     * @param {*} token_x 
     * @param {*} token_y 
     * @param {*} opcode 
     * @param {*} opval 
     * @param {*} extra_data 
     * @returns 
     */
    async op(context,opcode,...etc){
        if(!context) context = this.context;
        if(!opcode) return false

        try{
            // token_x.length>16 && token_y.length>16;// 
            //以下的语句，不是最佳选择，应该使用tns模式，例如：lauo.msg://xxxxx (etc)---这里需要重新设计
            //【注意1】有一个设计方法，考虑web3的相互兼容特性，则可考虑使用opcode来区分是否RPC远程，例如/chain /op /fork等。
            //【注意2】如果不是【注意1】所示的远程，则为本机处理的opcode--1：是local变量的操作（例如+-*/、func、etc等）、如是fork、send、assert则考虑直接兼容gnode-FSM状态机，以形成兼容规范。
            //let isRpcReq = token_util.validateTokenID(token_x) && token_util.validateTokenID(token_y)
            //请求远程地址（查询与op操作得到了统一，反正远程都统一用这个）----类似http的post、get、del等都是统一的操作，而不是查询又特别使用特别的接口什么的。
            //console.log('is_opcode_exists(opcode):'+is_opcode_exists(opcode)+' opcode:'+opcode)
            let token_key = this.token_key || !this.safeFlag ? this.token_key :'notset'  //context.token_key || !this.safeFlag ? context.token_key:'notset';//适应rpc_c中的实现
            if((opcode).startsWith('/') || (opcode).startsWith('http://') || (opcode).startsWith('https://')) {//这个是查询函数的绑定（也是直接解析的后端查询）
                //这里应该增加TNS域名支持、keys支持
                let url = new URL((opcode).startsWith('/')  ?'http://127.0.0.1'+opcode:opcode)//利用上这个解析库进行查询。
                //console.log('url:'+JSON.stringify(url));
                let path = url.pathname
                let params = {}//token_x:context[token_x],token_y:context[token_y],opcode,opval:JSON.stringify(context[opval]),token_key,extra_data:context[extra_data]}
                for (const [key, value] of url.searchParams) {
                    params[key] =value
                }
                //这里取特定的token
            // params.token =  params.token? params.token :token_x 
            //一般而言，token_x指向的变量保存参数，token_y保存的是appid_key等信息，同时保存了urlbase等。
                let ps ={}// Object.assign({extra_data:context[extra_data]},context[token_x],context[token_y],params)
                //添加更多参数进来
                let opret = (etc.length>=2) ? etc.pop():'$ret';//参数须为2个以上。
                for(let i=0;etc && i<etc.length;i++) ps = Object.assign({},ps,context[etc[i]])
                //安全密钥：token_key
                //console.log('path:'+path+' params:'+JSON.stringify(ps))
                path = (opcode).startsWith('/')  && ps.urlbase ? ps.urlbase +path :opcode.split('?')[0]; //重写。
                if(path.startsWith('/')) ps.token_key = token_key
                //将结果放入到opval指向的变量中。
                context[opret]  = await this.rpc_api_util.rpc_query(path,ps);//这里配置了本机及远程的访问(暂时缺少对文件的支持)
                return context[opret] 
            }
            else if(this.is_opcode_exists(opcode)){//if((opcode).startsWith('/op')){//这里是本机变量的操作local-var
                //保存在这个变量中，然后再使用=赋值操作进行数值移动等----因为本等式已经用尽。
                let token_x = etc[0],token_y = etc[1],opval=etc[2],extra_data=etc[3]
                let param = {token_x:context[token_x],token_y:context[token_y]?context[token_y]:context[token_x],
                    opcode,opval:typeof context[opval]!='string'?JSON.stringify(context[opval]):context[opval],token_key,extra_data:context[extra_data]}
                let opret = (etc.length>=5) ? etc.pop():'$ret';
                for(let i=4;etc && i<etc.length;i++) ps[etc[i]] = context[etc[i]]
                context[opret] =  await this.rpc_api_util.rpc_query('/op',param)
                return context[opret]
            } 
            //执行op指令
            else if((opcode).startsWith('$$.'))
            {
                return await this.jsrun2Self(context,opcode,...etc)
            }
            else if((opcode).startsWith('$.'))
            {
                return this.jsrun(context,opcode,...etc)
            }else{
                return this.binderRun(context,opcode,...etc)
            }
        }catch(ex)
        {
            //console.log('ex-stack:'+ex.stack)
            return ex//ex.stack;
        }
        // return 'pop-unhandle-result'
    }
    async opbatch(context,list,iswait=true)
    {
        let results = []
        let ret = null
        let $pop_func_define = false,$pop_func_area =false,$pop_func = null, $pop_func_name = null,$pop_func_async = false,$pop_func_param_names=[];
        let $log_result_flag = true;
        try{
            if(!context) context = this.context;
            if(!list || !(list instanceof Array)) return {ret:false,msg:'pop-opbatch-list is empty'};
            for(let i=0;i<list.length;i++)
            {
                if(!list[i] || !list[i][0]) continue
                if(list[i][0].startsWith('//')) continue
                //编译指令，不收集结果（特别用于递归函数时---得到的结果嵌套非常深，会导致JSON.stringify崩溃）2022-9-16
                if( list[i][0]=='#') $log_result_flag = !$log_result_flag,ret={ret:true,msg:'# !flag'}
                //进入函数定义区。
                else if(!$pop_func_area &&  (list[i][0]=='pop.func' || list[i][0]=='pop.func.define'))
                {
                    $pop_func_area = true;$pop_func_name = list[i][1];$pop_func = [];
                    $pop_func_async = false;//list[i].length>=3 ? list[i][2] : false;
                    $pop_func_param_names = list[i].length>2 ? list[i].slice(2,list[i].length):[]
                    //console.log('pop_func_param_names:'+JSON.stringify($pop_func_param_names))
                    ret = {ret:true,msg:'pop.func define begin'};
                    $pop_func_define = list[i][0]=='pop.func.define'
                }
                else if($pop_func_area &&  list[i][0]!='pop.func.end')
                {
                    $pop_func.push(list[i])//这里将记录op-line压入栈中。
                    ret = {ret:true,msg:'pop.func define now'};
                }
                //执行define类型的函数（直接操作全局context，不设置形参和传递参数）。
                else if($pop_func_area && $pop_func_define && list[i][0]=='pop.func.end') 
                {
                    let This = this;
                    if($pop_func_name){
                        let func_name = $pop_func_name,funcs = $pop_func,func_async = $pop_func_async;
                        this.binderAddOpcode(func_name,async function(c)
                        {
                            return !func_async ? await This.opbatch(c,funcs,true):This.opbatch(c,funcs,false);
                        })
                    }
                    $pop_func_define = false,$pop_func_area=false;$pop_func_name = null;$pop_func = null;$pop_func_async = false,$pop_func_param_names=[];
                    ret = {ret:true,msg:'pop.func.define end'};
                }
                else if($pop_func_area && list[i][0]=='pop.func.end')
                {
                    let This = this;
                    if($pop_func_name){
                        let func_name = $pop_func_name,funcs = $pop_func,func_async = $pop_func_async,func_param_names = $pop_func_param_names
                        this.binderAddOpcode(func_name,async function(c,opcode,...etc)
                        {
                            //切换上下文。
                            let oldc = c ? c: This.context
                            // console.log('This.ctxList.length:'+This.ctxList.length+' maxDeep:'+This.maxDeep)
                            if(This.ctxList.length> This.maxDeep) throw "[exception]too deep call funcs"
                            This.ctxList.push(oldc)
                            c = {}//将环境变量设置为空（这里完全是本地化的函数）
                            for(var i=0;i<func_param_names.length && i<etc.length;i++)  c[func_param_names[i]] = oldc[etc[i]]
                            let bret =  await This.opbatch(c,funcs,true)//!func_async ? :This.opbatch(c,funcs,false);
                            c = This.ctxList.pop()
                            if(etc.length>func_param_names.length  && etc[func_param_names.length]) 
                            {
                                //得到返回的结果---匹配多个。
                                let bret0 =bret.results[bret.results.length-1]
                                if(etc.length-func_param_names.length>1  &&  bret0.msg=='list')
                                {
                                    for(var i=0;i<etc.length-func_param_names.length;i++)
                                        c[etc[func_param_names.length+i]] = bret0.result[i]
                                }
                                else c[etc[func_param_names.length]] = bret0.result;
                            }
                            return bret;
                        })
                    }
                    $pop_func_define = false,$pop_func_area=false;$pop_func_name = null;$pop_func = null;$pop_func_async = false;$pop_func_param_names =[]
                    ret = {ret:true,msg:'pop.func define end'};
                }
                else{ //正常执行一般语句
                    if(iswait && list[i][0].indexOf('&')!=0) ret = await this.op(context,...list[i])
                    else{
                        //以下方法将得到异步执行的opcode真正的值。
                        ret = list[i][0]//list[i][0].indexOf('&')==0  ? list[i][0] :'async-func{'+list[i][0]+'}'
                        list[i][0] = list[i][0].indexOf('&')==0 ? list[i][0].split('&')[1]:list[i][0]
                        this.op(context,...list[i])
                    } 
                }
                if($log_result_flag) results.push( this.deepCopy(ret) )//进行了结果对象的复制--否则会导致stringify拿到的一般情况下是context的重复
                //这个一旦return，即刻结束opbatch的执行(不能在函数定义区直接执行return--bug-fix)
                if(!$pop_func_area && (list[i][0] == 'return' || list[i][0] == 'pop.exit')) break;
            }
            return {ret:true,msg:'success',results}
        }catch(ex){
            console.log('opbatch-ex:'+ex)
            return {ret:false,msg:ex,results}//.stack
        }
    }

    parseLine(line)
    {
        let words = [] 
        let tmp = ''
        if(!line || !line.trim()) return words
        line = line.trim()
        for(let i=0;i<line.length;i++)
        {
            if(line[i].trim().length == line[i].length ) tmp+=line[i]
            else {
                if(tmp.trim().length == tmp.length){words.push(tmp)}
                tmp = ''
            }
        }
        if(tmp.trim().length>0) words.push(tmp.trim())
        return words;
    }
    parseScript(script)
    {
        let strs = script.split('\n')
        let oplines = []
        for(let i=0;i<strs.length;i++)
        {
            let str = strs[i].trim()
            if(!str) continue;//|| 
            if(!this.commentRetainFlag && str.startsWith('//')) continue //如果不保留，则去掉
            else if(str.startsWith('{'))//这里将得到一行的值，将this.assign（用于构建复杂的json），可用于context恢复等。
            {
                let jsonval = JSONParse(str)
                if(jsonval && jsonval!=str) oplines.push(['this.assign',jsonval])
            }
            else if(str.startsWith('['))//多行命令（使用JSON-Array方式直接引入），可用于库函数定义等。
            {
                let jsonval = JSON.parse(str)
                if(jsonval && jsonval!=str )
                    oplines.push(...jsonval) //push进去多条指令。
            }
            else{
                let words = this.parseLine(str)
                //如果有内容才处理。
                if(words.length>0){
                    oplines.push(words)
                }
            }
        }
        return oplines
    }
    async runScript(context,script,iswait=true)
    {
        if(!script) return {ret:false,msg:'script is empty'};
        if(!context) context = this.context;

        let results = []
        try{
            let oplines = this.parseScript(script)
            //照样调用的是opbatch指令（适用于函数定义、调用、if-else语句的处理等）。
            console.log('oplines:'+JSON.stringify(oplines))
            results = await this.opbatch(context,oplines,iswait)
            return results
        }catch(ex)
        {
            return {ret:false,msg:ex,results}//.stack
        }
    }

    swapFSMCONFIG()
    {
        let tmpFSMCONFIG ={}
        for(var key in this.fsm_config ) tmpFSMCONFIG[this.fsm_config[key]] = key
        return tmpFSMCONFIG
    }
    is_opcode_exists(opcode)
    {
        return this.OPCODES[opcode]!=null;
    }
    deepCopy(target) {
        if (target instanceof PopRuntime) return null
        if (target == this.$) return null //window 或者globalThis变量不可复制
        // return Object.assign({},target)
        if (typeof target == 'object') {
            try{
                return Object.assign({},target)
            }catch(ex)
            {
                console.log('deepCopy-exception:'+ex)
            }
            const result = Array.isArray(target) ? [] : {}
            for (const key in target) {
                if (typeof target[key] == 'object') {
                    result[key] = this.deepCopy(target[key])
                } else {
                    result[key] = target[key]
                }
            }
            return result
        }
        return target
    }
}

function JSONParse(opval)
{
    let tmpObj = opval;
    try{
        tmpObj = JSON.parse(opval)
    }catch(ex){console.log('ex:'+ex)}
    return tmpObj;
}

// module.exports = PopRuntime;
// module.exports.JSONParse = JSONParse


async function testFunc0(a,...c)
{
    console.log('0'+a+' c:'+JSON.stringify(c))
}
// module.exports.poplang = poplang
async function testFunc(a,b,...c)
{
    console.log('a:'+a+' b:'+b)
    console.log('c:'+JSON.stringify(arguments))
    console.log('c:'+JSON.stringify(c))
    console.log('c:'+c[0])
    console.log('c:'+c[1])
    testFunc0(a,b,...c)
}

async function test2()
{
    testFunc('a','10',1,13,5,7,11,100)
    testFunc('】','10','c')
    testFunc('d','10','c',1,13,5,7,11,100)
    let arr = ['x','d','10','c',1,13,5,7,11,100]
    testFunc('zzzzz','zz',...arr)
}

// test2();
window.PopRuntime = PopRuntime
