
/**
 * 基于LLM的简单知识库的实现（未来将使用LLM的全局记忆能力来实现）
 * 2025-4-11
 */
if(typeof window == 'undefined') globalThis.window = globalThis
window.rtkown_c = {}
// const rtkown_c_token_name = OBJ_TOKEN_NAME
// const rtkown_c_api_base   = OBJ_API_BASE
// const rtkown_c_token_root = OBJ_TOKEN_ROOT
const rtkown_setting = require('../../setting/rtkown_setting.json')

rtkown_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtkown/chat',urlParser,session_filter,rtkown_c.chat)//基于folder-id进行恢复所有的内容。
}
const str_filter = require('../../libs/str_filter')
rtkown_c.chat = async function(req,res)
{
    let {folder_id,user_id} = str_filter.get_req_data(req)

    //#1 读取所有的文件的内容
    let files = await rtkown_c.readFolderFileContents(folder_id)
    if(!files || files.length<=0) return {ret:false,msg:'files is empty'}

    // //#2 过滤Mime-type————为了提升速度，直接在readFileContent中实现
    // let resultFiles = []
    // for(let i=0;i<files.length;i++)
    // {
    //     let fileItem = files[i]
    //     let fileInfo = fileItem.fileInfo
    //     if(!fileInfo.mimetype || !fileInfo.mimetype.startsWith(rtkown_setting.doc_mime_type)) continue
    //     resultFiles.push(fileItem)
    // }

    //#3 拼接成相应的prompt-history
    let history = [{role:'system',content:rtkown_setting.system_prompt}]
    for(let i=0;i<files.length;i++)
    {
        let fileInfo = files[i].fileInfo
        let item = files[i]
        let prompt_content = rtkown_setting.doc_filename_prompt.replace('filename',fileInfo.filename) 
            + rtkown_setting.doc_content_prompt + item.content
        history.push({role:'user',content:prompt_content})
        history.push({role:'assistant',content:'ok'})
    }

    //#4 恢复history会话
    let ret = await new Promise((resolve)=>{
        window.rtibchat_c.recoverSession({params:{user_id,history:JSON.stringify(history)}},{json:function(data)
        {
            resolve(data)
        }})
        setTimeout(()=>resolve(null),10000)//10秒超时。
    }) 
    console.info('rtkown_c.chat-result:',ret)
    //read-folder-info(md)
    if(ret){
        ret.history = history //直接返回history，方便前端集成
        res.json(ret)
    } 
    else res.json({ret:false,msg:'recover-session from files-content failed'})
}
rtkown_c.readFileContent =  async function(file_id)
{
    console.info('readFileContent:',file_id)
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,file_id,'assert');
    if(!fileInfo ) return ({ret:false,msg:'file-info is empty'})
        console.info('readFileContent-fileInfo:',fileInfo)
    //得到文件后缀（以进行文件类型的判断）
    let fileType =  fileInfo.filename && fileInfo.filename.lastIndexOf('.')>=0 ? fileInfo.filename.substring(fileInfo.filename.lastIndexOf('.')+1,fileInfo.filename.length) :''
    console.info('filetype:',fileType,rtkown_setting.file_types.indexOf(fileType.toLowerCase())>=0 )
    if(fileInfo.type !='folder' && 
        !( fileInfo.mimetype && fileInfo.mimetype.startsWith(rtkown_setting.doc_mime_type) 
            || rtkown_setting.file_types.indexOf(fileType.toLowerCase())>=0 ) ) 
        return ({ret:false,msg:'file-info mime-type unmatch'})
    let data = await ifileDb.getDataByKey(fileInfo.hash)
    console.info('readFileContent-data:',data,file_id,fileInfo)
    if(data && data.data &&data.data.length>0)
    {
        let buffer = data.data
        let content = buffer.toString()
        return {ret:true,msg:'success',content,fileInfo}
    }else{
        return {ret:false,msg:'read file failed',fileInfo}
    }
}
rtkown_c.readFolderFileContents =  async function(folder_id ,existMapP = null)
{
    let existMap = existMapP ? existMapP :new Map()
    let files = []

    let readInfoRet = await this.readFileContent(folder_id)
    if(readInfoRet.ret) return [readInfoRet]  //如果folder_id是文件ID，则仅读取一个文件内容
    if(!readInfoRet.fileInfo) return []
    //判断是文件夹
    //列举所有的文件内容
    let list = await rpc_api_util.s_query_token_list(clouddisk_c_api_base,folder_id,'relf',0,100000,false)
    if(list && list.length>0)
    {
        for(let i=0;i<list.length;i++)
        {
            let info = list[i]
            if(existMap.has(info.folder_id) || existMap.has(info.obj_id)) continue
            existMap.set(info.folder_id ? info.folder_id :info.obj_id,'ok')//避免被死循环的文件夹引用搞挂
            if(info.type == 'folder')//递归读取子文件夹内容
            {
                let subFiles = await rtkown_c.readFolderFileContents(info.folder_id, existMap)
                if(subFiles && subFiles.length>0)
                {
                    files = files.concat(subFiles) //readFolderFileContents函数已经读取了file_content了。
                }  
            }
            else
            { //读取文件内容
                let readInfoRet = await this.readFileContent(info.obj_id)
                if(readInfoRet && readInfoRet.ret) files =  files.concat([readInfoRet])
            }
        }
    }
    else 
        files = []
    console.info('readFolderFileContents-result:',files)
    return files
}
