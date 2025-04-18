const  http=require( 'http' );
const  https=require( 'https' );

/**
 * rt-ibchat智体聊的插件代码
 */
window.rtibchat_c = {}
// const rtibchat_c_token_name = OBJ_TOKEN_NAME
// const rtibchat_c_api_base   = OBJ_API_BASE
// const rtibchat_c_token_root = OBJ_TOKEN_ROOT
let ibchat_setting = null
let model = null
let host = null
let session_path = null
let deepseek_api_key = null
let ibchat_type = "ibchat"
let system_role_prompt = null
const file_util = require('../../libs/file_util');
const str_filter = require('../../libs/str_filter');

rtibchat_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtibchat/session/new',urlParser,session_filter,rtibchat_c.newSession)
    app.all('/rtibchat/session/recover',urlParser,session_filter,rtibchat_c.recoverSession)
    app.all('/rtibchat/session/chat',urlParser,session_filter,rtibchat_c.chat)
    app.all('/rtibchat/session/chat/stop',urlParser,session_filter,rtibchat_c.stopChat)//停下（思考）
    app.all('/rtibchat/session/history',urlParser,session_filter,rtibchat_c.history)
    app.all('/rtibchat/session/save',urlParser,session_filter,rtibchat_c.saveSession)
    app.all('/rtibchat/help',urlParser,rtibchat_c.help)

    //加载setting
    try{
        let setting = JSON.parse( await file_util.readFile(window.config.runtime_current_dir +'/setting/rtibchat_setting.json'))
        model   = setting.model
        host    = setting.host
        session_path = setting.session_path
        ibchat_type = setting.ibchat_type
        deepseek_api_key = setting.deepseek_api_key
        system_role_prompt = setting.system_role_prompt
        ibchat_setting = setting
    }catch(ex)
    {
        console.error('loadding rtibchat_setting.json failed!',ex)
    }
}
/**
 * 返回帮助文档
 * @param {*} req 
 * @param {*} res 
 */
rtibchat_c.help = async function(req,res) 
{
    let helpStr = (await file_util.readFile(window.config.runtime_current_dir +'/setting/rtibchat_help.md')).toString()
    res.json({ret:true,msg:'success',help:helpStr})
}

//避免隐私泄露（直接内存中保存，定时镜像至磁盘？！）
const sessionsMap = new Map()
rtibchat_c.newSession = async function(req,res) 
{
    let {user_id} = str_filter.get_req_data(req)
    let session_id = 'rtibchat-session-'+Date.now()+'-'+ parseInt( Math.random()*1000000 )
    let sessionInfo = {user_id,session_id,history:[],time: parseInt(Date.now()/1000),datetime:str_filter.GetDateTimeFormat(parseInt(Date.now()/1000))}
    sessionsMap.set(session_id,sessionInfo)
    return res.json({ret:true,msg:'success',session_id})
}
/**
 * 恢复会话（用于定义Prompt模板--以分享给其它用户继续提问，例如预设了很多背景信息，以便进一步提问并输出结果分享）
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
rtibchat_c.recoverSession = async function(req,res) 
{
    let {user_id,history,file_id} = str_filter.get_req_data(req)
    let session_id = 'rtibchat-session-'+Date.now()+'-'+ parseInt( Math.random()*1000000 )
    if(file_id)
    {
        let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,file_id,'assert');
        if(!fileInfo )return res.json({ret:false,msg:'file-info is empty'})
        let data = await ifileDb.getDataByKey(fileInfo.hash)
        if(data && data.data &&data.data.length>0)
        {
            let buffer = data.data
            let sessionStr = buffer.toString()
            try{
                let sessionInfo = JSON.parse(sessionStr)
                if(!sessionInfo || !sessionInfo.history || sessionInfo.history.length<=0) return res.json({ret:false,msg:'sessionInfo(history) is empty'})
                history = sessionInfo.history
            }catch(ex)
            {
                return res.json({ret:false,msg:'param(history) is error'})
            }
        }else{
            return res.json({ret:false,msg:'read file failed'})
        }
    }
    else
    {
        try{
            history = JSON.parse(history)
            if(!history || history.length<=0) return res.json({ret:false,msg:'param(history) is empty'})
        }catch(ex)
        {
            return res.json({ret:false,msg:'param(history) is error'})
        }
    }
    sessionsMap.set(session_id,{user_id,session_id,history:history})
    return res.json({ret:true,msg:'success',session_id})
}
/**
 * 聊天，支持历史纪录
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
rtibchat_c.chat = async function(req,res) 
{
    let {user_id,session_id,prompt,image_url,nostream,model} = str_filter.get_req_data(req)
    let sessionInfo =  sessionsMap.get(session_id)
    if(!sessionInfo) return res.json({ret:false,msg:'sessionInfo is empty'})
    if(sessionInfo.user_id != user_id) return res.json({ret:false,msg:'not your chat-session'})
    if(sessionInfo.http_req) return res.json({ret:false,msg:'you are chatting...please wait!'})
    let history = sessionInfo.history
    let old_size = history ? history.length:0
    let stream = nostream ? false:true
    if(stream)
    {
        res.json({ret:true,msg:'success',model:model ? model:ibchat_setting.model})
    }
    //2025-3-24新增#系统角色#创建system-role的agent的功能
    if(system_role_prompt && prompt.startsWith(system_role_prompt))
    {
        history.push({"role": "system", "content": prompt.substring(system_role_prompt.length,prompt.length)})
        setTimeout(()=>{
            req.peer.send(JSON.stringify({channel:'rtibchat',notify_type:sessionInfo.session_id,data:{created_at:new Date(),
                done: true,message:{content: 'ok',role: "assistant"},role: "assistant",model:model ? model :ibchat_setting.model}}))
        },300)
        return
    }
    let input_model = model ? model:ibchat_setting.model
    history =ibchat_setting['https'][input_model] //ibchat_type!='ollama' //(!model && ibchat_type == 'deepseek-chat' || ['deepseek-reasoner','deepseek-chat'].indexOf(model)>=0) 
         ? await ibchatDeepSeek(sessionInfo,req,model,prompt,image_url,history,stream): await ibchat(sessionInfo,req,model,prompt,history,stream)
    sessionInfo.history = history
    if(!stream)//如果非stream，需在结果中返回
    {
        if(history.length >old_size)
        {
            let result = Object.assign({},history[history.length-1])
            result.ret = true
            result.msg = 'success'
            result.model = model ? model:ibchat_setting.model
            res.json(result)
        }
        else
        {
            res.json({ret:false,msg:'no result',model:model ? model:ibchat_setting.model})
        }
    }
}

/**
 * 关闭当前聊天（思考）
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
rtibchat_c.stopChat = async function(req,res) 
{
    let {user_id,session_id} = str_filter.get_req_data(req)
    let sessionInfo =  sessionsMap.get(session_id)
    if(!sessionInfo) return res.json({ret:false,msg:'sessionInfo is empty'})
    if(sessionInfo.user_id != user_id) return res.json({ret:false,msg:'not your chat-session'})
    if(!sessionInfo.http_req) return res.json({ret:false,msg:'not in chat'})
    let http_req = sessionInfo.http_req
    sessionInfo.http_req = null
    res.json({ret:true,msg:'success'})
    http_req.destroy()
}

rtibchat_c.history = async function(req,res) 
{
    let {user_id,session_id} = str_filter.get_req_data(req)
    let sessionInfo =  sessionsMap.get(session_id)
    if(!sessionInfo) return res.json({ret:false,msg:'sessionInfo is empty'})
    if(sessionInfo.user_id != user_id) return res.json({ret:false,msg:'not your chat-session'})
    let history = sessionInfo.history
    res.json({ret:true,msg:'success',history})
}
rtibchat_c.replaceAll = function(str)
{
    if(!str) return null

    let flag =true
    while(flag)
    {
        let length = str.length
        str = str.replace('] (','](')
        flag = str.length != length
    }
    return str
}
rtibchat_c.saveHistorImageUrl =  async function(image_url,user_id,s_id)
{
    try
    {
        // let imgUrl= imgStr.substring(start,end)
        let filePath = session_path ? session_path :  window.config.runtime_current_dir +'/data'
        // 去掉前缀
        const base64Image = image_url.replace(/^data:image\/\w+;base64,/, '');
        // console.info('saveHistorImageUrl:',image_url,base64Image)

        // 将 Base64 转为 Buffer
        const imgData = Buffer.from(base64Image, 'base64');
        if(!imgData) return null
        
        let fileName = Date.now()+'-'+parseInt(Math.random()*10000)+'.png'
        let writeRet = await file_util.writeFile(filePath+'/'+fileName,imgData)
        if(!writeRet) return null
        
        let hash = await str_filter.hashVal(imgData)
        let fileWriteFlag = await file_util.writeFile(window.config.file_temp+'/'+hash,imgData)
        if(!fileWriteFlag) return {ret:false,msg:'save ibchat-img-file to dnalink failed'}
        //删除图片，避免缓存过多
        require('fs').unlink(filePath+'/'+fileName ,function (err) {
            if(err)
            console.error('文件:' + filePath+'/'+fileName + '删除失败！'+err,err);
        })
    
        let fileInfo = {fieldname:"file",encoding:'fromfile_binary',originalname:fileName,
            mimetype:'image/png',filename:fileName,path:'file-path',
            size:imgData.byteLength,file_kind:'file',random:Math.random(),data:null,user_id,s_id,hash}
        let fastSaveRet = await new Promise((resolve)=>{
            window.file_c.upload_file_fast({params:fileInfo},{
                json:function(data)
                {
                    resolve(data)
                }
            })
            setTimeout(()=>resolve({ret:false,msg:'fast save fileInfo timeout'}),30000)
        })

        console.log('save-ibchat-image-file-ret:',fastSaveRet)
        if(fastSaveRet && fastSaveRet.ret)
        {
            return fastSaveRet.obj_id
        }
        return null
    }catch(ex)
    {
        console.error('download history image failed, ex:'+ex,ex)
        return null
    }
    return null
}
rtibchat_c.saveHistoryImg =  async function(content,user_id,s_id)
{
    //判断有无图片，如有将上传转化为相应的IMG-id
    // if(content && content.indexOf(splitStr)<0) return null
    //![iMG] 
    // let imgStr = content.split(splitStr)[1]
    // let start = imgStr.indexOf('(')+1
    // let end   = imgStr.indexOf(')')
    // if(start>=end) return null
    content = rtibchat_c.replaceAll(content)
    const pattern = /!\[(.*?)\]\((.*?)\)/mg;
    let matcher;

    let matchList = []
    while ((matcher = pattern.exec(content)) !== null) {
        //console.log(matcher);
        matchList.push(Object.assign({},matcher))
    }
    console.log('saveHistoryImg-match-list:',matchList)
    if(!matchList || matchList.length<=0) return null
    let imgUrl = matchList[matchList.length-1][2]
    try
    {
        // let imgUrl= imgStr.substring(start,end)
        filePath = session_path ? session_path :  window.config.runtime_current_dir +'/data'
        let reqHttp = imgUrl.startsWith('https') ?https:http
        const url = require('url')
        let imgData = await new Promise((resolve)=>{
            let buff = Buffer.from([])
            const options = {
                    host: url.parse(imgUrl).host,
                    port:  imgUrl.startsWith('https') ? 443:80,
                    path: url.parse(imgUrl).pathname
                };
            reqHttp.get(options, function(res) {
                res.on('data', function(data) {
                    //response.write(data);
                    if(data)
                    buff = Buffer.concat([buff,data])
                }).on('end', function() {
                    resolve(buff)
                });
            });
            setTimeout(()=>resolve(null),30000)
        })
        if(!imgData) return null
        
        let fileName = Date.now()+'-'+parseInt(Math.random()*10000)+'.png'
        let writeRet = await file_util.writeFile(filePath+'/'+fileName,imgData)
        if(!writeRet) return null
        
        let hash = await str_filter.hashVal(imgData)
        let fileWriteFlag = await file_util.writeFile(window.config.file_temp+'/'+hash,imgData)
        if(!fileWriteFlag) return {ret:false,msg:'save ibchat-img-file to dnalink failed'}
        //删除图片，避免缓存过多
        require('fs').unlink(filePath+'/'+fileName ,function (err) {
            console.error('文件:' + filePath+'/'+fileName + '删除失败！'+err,err);
        })
    
        let fileInfo = {fieldname:"file",encoding:'fromfile_binary',originalname:fileName,
            mimetype:'image/png',filename:fileName,path:'file-path',
            size:imgData.byteLength,file_kind:'file',random:Math.random(),data:null,user_id,s_id,hash}
        let fastSaveRet = await new Promise((resolve)=>{
            window.file_c.upload_file_fast({params:fileInfo},{
                json:function(data)
                {
                    resolve(data)
                }
            })
            setTimeout(()=>resolve({ret:false,msg:'fast save fileInfo timeout'}),30000)
        })

        console.log('save-ibchat-image-file-ret:',fastSaveRet)
        if(fastSaveRet && fastSaveRet.ret)
        {
            return fastSaveRet.obj_id
        }
        return null
    }catch(ex)
    {
        console.error('download history image failed, ex:'+ex,ex)
        return null
    }
    return null
}

rtibchat_c.saveSession = async function(req,res) 
{
    let {user_id,session_id,share,share_img,s_id} = str_filter.get_req_data(req)
    let sessionInfo =  sessionsMap.get(session_id)
    if(!sessionInfo) return res.json({ret:false,msg:'sessionInfo is empty'})
    if(sessionInfo.user_id != user_id) return res.json({ret:false,msg:'not your chat-session'})
    let history = sessionInfo.history
    let saveObj = Object.assign({},sessionInfo)
    delete saveObj.http_req
    let filePath = session_path ? session_path :  window.config.runtime_current_dir +'/data/rtibchat'
    let fileName = session_id+'-'+Date.now()+'.json'
    saveObj.save_time = parseInt(Date.now()/1000)
    saveObj.save_datetime = str_filter.GetDateTimeFormat(parseInt(Date.now()/1000))
    let jsonStr = JSON.stringify(saveObj)
    let writeFlag = await file_util.writeFile(filePath +'/'+fileName,Buffer.from(jsonStr))
    if(!writeFlag) return res.json({ret:false,msg:'save session-file failed'})
    if(share)
    {
        if(!history || history.length<=0) return res.json({ret:false,msg:'session-history is empty'})
        let lastItem = history[history.length-1]
        let content = lastItem.content
        let img_id =share_img ? await rtibchat_c.saveHistoryImg(content,user_id,s_id) :null
        //对图片识别的上传的图片进行预览图设置
        if(!img_id && history[history.length-2].content.length == 2)
        {
            lastItem = history[history.length-2]
            content = lastItem.content.length == 2 && lastItem.content[1].type == 'image_url' ? lastItem.content[1].image_url:lastItem.content
            img_id =share_img ?(lastItem.content.length == 2 && lastItem.content[1].type == 'image_url' ?
                    await rtibchat_c.saveHistorImageUrl(content,user_id,s_id):
                     await rtibchat_c.saveHistoryImg(content,user_id,s_id) ):null
        }
        
        //复制一份至file_temp
        let file_data = Buffer.from(jsonStr)
        let hash = await str_filter.hashVal(file_data)
        let fileWriteFlag = await file_util.writeFile(window.config.file_temp+'/'+hash,file_data)
        if(!fileWriteFlag) return res.json({ret:false,msg:'save session-file to dnalink failed'})
        //user_id,s_id,hash,size,file_kind
        let fileInfo = {fieldname:"file",encoding:'fromfile_binary',originalname:fileName,
            mimetype:'application/json',filename:fileName,path:'file-path',
            size:Buffer.byteLength(jsonStr),file_kind:'file',random:Math.random(),data:null,user_id,s_id,hash}
        let fastSaveRet = await new Promise((resolve)=>{
            window.file_c.upload_file_fast({params:fileInfo},{
                json:function(data)
                {
                    resolve(data)
                }
            })
            setTimeout(()=>resolve({ret:false,msg:'fast save fileInfo timeout'}),30000)
        })
        fastSaveRet.first_question =history &&history.length>0 ? 
        (history[0].content.length == 2 && history[0].content[0].type == 'text' ?  history[0].content[0].text :  history[0].content):'空问题'
        
        //将最后一个问题与之合并
        if(history.length>=4)
        {
            let userLastQuestionItem = history[history.length-2]
            let userLastQuestion = userLastQuestionItem.content.length == 2 
                && userLastQuestionItem.content[0].type == 'text' 
                ? userLastQuestionItem.content[0].text : userLastQuestionItem.content
            if(userLastQuestion && userLastQuestion.length>2)
            fastSaveRet.first_question += '————【补充问题】'+userLastQuestion
        }
        
        fastSaveRet.img_id = img_id
        return res.json(fastSaveRet)
    }
    res.json({ret:true,msg:'success'})
}
/**
 * 2025-3-25新增image_url
 * @param {*} sessionInfo 
 * @param {*} req 
 * @param {*} input_model 
 * @param {*} prompt 
 * @param {*} image_url 
 * @param {*} history 
 * @param {*} stream 
 * @returns 
 */
async function ibchatDeepSeek(sessionInfo,req,input_model,prompt,image_url,history = [],stream = true) 
{
    input_model = input_model ? input_model :model
    history = history ? history :[]
    //假定图片是文件ID
    if(image_url && !image_url.startsWith('data:image'))
    {
        let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,image_url,'assert');
        if(!fileInfo )return res.json({ret:false,msg:'file-info is empty'})
        let data = await ifileDb.getDataByKey(fileInfo.hash)
        if(data && data.data &&data.data.byteLength>0)
        {
            let buffer = data.data
            //转图片为base64编码的图片url（方便合成prompt）
            image_url = 'data:image/png;base64,'+buffer.toString('base64')
        }else{
            return res.json({ret:false,msg:'read image-file failed'})
        }
    }
    return await new Promise((resolve)=>{
        ///model:'deepseek-chat' 或 'deepseek-reasoner'
        var post_data={max_tokens: ibchat_setting['https'][input_model].max_tokens,//8192,
            model:input_model,messages:history.concat([
            // {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": image_url ? [{ type:'text',text:prompt},
                {'type':'image_url',image_url}]: prompt}
             ]),stream,
          // response_format:{
          //   'type': 'json_object'
          // }
        }; //这是需要提交的数据//true
        const content=JSON.stringify(post_data)
         
        const options = {
           host: ibchat_setting['https'][input_model].host,// 'openrouter.ai',//'api.deepseek.com' ,
           port: ibchat_setting['https'][input_model].port ? ibchat_setting['https'][input_model].port:443,// 443,
           path: ibchat_setting['https'][input_model].api_path,//'/api/v1/chat/completions' ,///chat/completions
           method: 'POST' ,
           headers:{
           'Content-Type' : 'application/json' ,
           'Authorization':'Bearer '+ ibchat_setting['https'][input_model].api_key,//deepseek_api_key,
           'Content-Length' :Buffer.byteLength(content)
           },
        //    body:content
        };
        console.log( "post options:\n" ,options);
        console.log( "content:" ,content);
        console.log( "\n" );
         
        let begin_time = Date.now()
        const http_req = https.request(options, function (res) {
           console.log( "statusCode: " , res.statusCode,res);
           console.log( "headers: " , res.headers);
           let content = '';

           let endFunc = function (error = null){
            console.log( "\n--->>\nresult:" ,content)
            console.log('used-time:',Date.now() - begin_time)
            if(sessionInfo.http_req == http_req) //在会话状态（否则已被手工关闭）
            {//避免重复收录history对话内容——特别是图片识别时
                req.peer.send(JSON.stringify({channel:'rtibchat',notify_type:sessionInfo.session_id,data:{created_at:new Date(),
                    done: true,message:{content: error ? error:'',role: "assistant"},role: "assistant",model:input_model}}))
                sessionInfo.http_req = null //置为空
                // console.log( "\n--->>\nresult:" ,_data)
                history.push({"role": "user", "content": image_url ? [{ type:'text',text:prompt},
                    {'type':'image_url',image_url}]: prompt,model:input_model})
                history.push({"role":"assistant","content":content,model:input_model})
            }
            resolve(history)
          }

           res.on( 'data' , function (chunk){
                chunk = chunk.toString()
            // chunk = chunk.substring('data: '.length,chunk.length)
            let chunks = chunk.split('data: ')
            for(let i=0;i<chunks.length;i++)
            {
                if(!chunks[i]) continue
                try{
                    if(chunks[i]=="[DONE]\n\n") return endFunc()
                    if(chunks[i].startsWith('{"error":{"message":')) return endFunc(chunks[i])//出错了
                    let chunkTmpJson = JSON.parse(chunks[i])
                    let now_content = '';
                    if(stream) now_content = chunkTmpJson.choices[0].delta.content ? chunkTmpJson.choices[0].delta.content : ''
                    else now_content = chunkTmpJson.choices[0].message.content ? chunkTmpJson.choices[0].message.content : ''
                    content += now_content
                    if(sessionInfo.http_req == http_req) //在会话状态（否则已被手工关闭）
                    req.peer.send(JSON.stringify({channel:'rtibchat',notify_type:sessionInfo.session_id,data:{created_at:new Date(),
                        done: false,message:{content: now_content,role: "assistant"},model:input_model}}))
                }catch(ex){
                    console.error('ex:'+ex,ex,chunk,chunks,chunks[i])
                }
            }
            // console.log('==data-chunks:',chunks)
           });
           res.on( 'end',endFunc);
        });
         
        sessionInfo.http_req = http_req
        http_req.write(content);
        http_req.end();
    })
}

async function ibchat(sessionInfo,req,input_model,prompt,history = [],stream = true) 
{
    input_model = input_model ? input_model : model
    history = history ? history :[]
    return await new Promise((resolve)=>{
        let  post_data={model:input_model,"messages":(history.concat([
            {
            role:'user',
            "content": prompt
            }
        ])),stream}; //这是需要提交的数据
        let  content=JSON.stringify(post_data)
        
        let  options = {
            host: ibchat_setting["ollama"].host ? ibchat_setting["ollama"].host:host ,//host ,
            port:  ibchat_setting["ollama"].port ?  ibchat_setting["ollama"].port:11434,
            path: '/api/chat' ,
            method: 'POST' ,
            headers:{
            'Content-Type' : 'application/json' ,
            'Content-Length' :Buffer.byteLength(content)
            },
            //    body:content
        };
        console.log( "post options:\n" ,options);
        console.log( "content:" ,content);
        console.log( "\n" );
        
        let http_req = http.request(options, function (res) {
            console.log( "statusCode: " , res.statusCode,res);
            console.log( "headers: " , res.headers);
            let  _data= '' ;
            let result_content = ''
            res.on( 'data' , function (chunk){
                console.log('data:',chunk.toString(),post_data.messages[0].role)
                _data += chunk;
                result_content += JSON.parse(chunk.toString()).message.content
                if(sessionInfo.http_req == http_req) //在会话状态（否则已被手工关闭）
                req.peer.send(JSON.stringify({channel:'rtibchat',notify_type:sessionInfo.session_id,data:JSON.parse(chunk.toString())}))
            });
            res.on( 'end' , function (){
                sessionInfo.http_req = null //置为空
                console.log( "\n--->>\nresult:" ,_data)
                history.push({role:'user',"content": prompt,model:input_model})
                history.push({"role":"assistant","content":result_content,model:input_model})
                resolve(history)
            });
        });
        sessionInfo.http_req = http_req
        http_req.write(content);
        http_req.end();
    })
}
