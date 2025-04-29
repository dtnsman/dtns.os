// import fetch from 'node-fetch'
// const str_filter = require('../../libs/str_filter')
const rtmarkdown_setting = require('../../setting/rtmarkdown_setting.json')

if(typeof window == 'undefined') globalThis.window = globalThis
window.rtmarkdown_c = {}
// const rtmarkdown_c_token_name = OBJ_TOKEN_NAME
// const rtmarkdown_c_api_base   = OBJ_API_BASE
// const rtmarkdown_c_token_root = OBJ_TOKEN_ROOT
const str_filter = require('../../libs/str_filter')
const file_util = require('../../libs/file_util')
const rp = require('request-promise')
async function base64ToMarkdown(base64) 
{
    let content = await rp.post({url:rtmarkdown_setting.api_url +'/api/tools/toolCall', 
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            server_name: rtmarkdown_setting.server_name,
            tool_name: rtmarkdown_setting.tool_name,
            tool_args: {
                uri:base64
            }
        })
    }).catch((ex)=>{
        console.error('base64ToMarkdown-exception:'+ex,ex)
        return null
    })
    console.log('base64ToMarkdown:result-content:',content)
    let resultObj = null
    try{
        resultObj = JSON.parse(content)
    }catch(ex)
    {
        console.error('base64ToMarkdown:exception:'+ex,ex)
        return null
    }
    if(resultObj && resultObj.code == 0 ) return  resultObj.data.content[0].text
    return null
}

rtmarkdown_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtmarkdown/file2md',urlParser,session_filter,rtmarkdown_c.file2md)//
}
rtmarkdown_c.file2md = async function(req,res)
{
    let {file_id} = str_filter.get_req_data(req)
    if(!file_id) return res.json({ret:false,msg:'Error : file_id is null'})
    
    let mdText = await rtmarkdown_c.readFileContentFromCachedPath(file_id)
    if(mdText) return res.json({ret:true,msg:'success',text:mdText})

    let fileRes = await rtmarkdown_c.readFileContentResultBase64(file_id)
    console.log('file2md-fileRes:',fileRes)
    if(!fileRes || !fileRes.ret) return res.json({ret:false,msg:'read file-content failed'})
    //调用markitdown-mcp进行转换
    mdText = await base64ToMarkdown(fileRes.base64)
    if(!mdText) return res.json({ret:false,msg:'read base64 to markdown-content failed'})
    res.json({ret:true,msg:'success',text:mdText})
    //保存为缓存
    let save_cached_path =  rtmarkdown_setting.cached_path ? rtmarkdown_setting.cached_path :  window.config.runtime_current_dir +'/data/rtmarkdown'
    file_util.writeFile(save_cached_path+'/'+fileRes.fileInfo.hash +'.md',mdText)
}
/**
 * 读取file_id对应的hash的磁盘文件内容（转为base64编码）
 * @param {*} file_id 
 * @returns 
 */
rtmarkdown_c.readFileContentResultBase64 =  async function(file_id)
{
    console.log('readFileContentResultBase64:',file_id)
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,file_id,'assert');
    if(!fileInfo ) return ({ret:false,msg:'file-info is empty'})
        console.log('readFileContentResultBase64-fileInfo:',fileInfo)
    //得到文件后缀（以进行文件类型的判断）
    if(fileInfo.type =='folder' ) 
        return ({ret:false,msg:'is folder'})
    
    let data = await ifileDb.getDataByKey(fileInfo.hash)
    console.log('readFileContentResultBase64-data:',data,file_id,fileInfo)
    if(data && data.data &&data.data.length>0)
    {
        let buffer = data.data
        let content = 'data:'+(fileInfo.mimetype ? fileInfo.mimetype:'application/*')
            +';base64,'+ buffer.toString('base64')
        return {ret:true,msg:'success',base64:content,fileInfo}
    }else{
        return {ret:false,msg:'read file failed',fileInfo}
    }
}
/**
 * 读取缓存的md文件
 * @param {*} file_id 
 * @returns 
 */
rtmarkdown_c.readFileContentFromCachedPath =  async function(file_id)
{
    console.log('readFileContentFromCachedPath:',file_id)
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,file_id,'assert');
    if(!fileInfo ) return ({ret:false,msg:'file-info is empty'})
        console.log('readFileContentFromCachedPath-fileInfo:',fileInfo)
    //得到文件后缀（以进行文件类型的判断）
    if(fileInfo.type =='folder' ) 
        return ({ret:false,msg:'is folder'})

    let save_cached_path =  rtmarkdown_setting.cached_path ? rtmarkdown_setting.cached_path :  window.config.runtime_current_dir +'/data/rtmarkdown'
    try{
        let mdText = await file_util.readFile(save_cached_path+'/'+fileInfo.hash+'.md')
        return mdText
    }catch(ex)
    {
        console.error('readFileContentFromCachedPath-exception:'+ex,ex)
        return null
    }
}