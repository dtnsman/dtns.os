/**
 * 名称：rt-mcphost
 * 说明：主要用于连接mcp-server-host
 * 功能：提供dtns-api，供agent-tools调用
 * 日期：2025-4-24
 * 作者：poplang
 */
// const str_filter = require('../../libs/str_filter')
const rtmcphost_setting = require('../../setting/rtmcphost_setting.json')

if(typeof window == 'undefined') globalThis.window = globalThis
window.rtmcphost_c = {}
// const rtmcphost_c_token_name = OBJ_TOKEN_NAME
// const rtmcphost_c_api_base   = OBJ_API_BASE
// const rtmcphost_c_token_root = OBJ_TOKEN_ROOT
const str_filter = require('../../libs/str_filter')
const file_util = require('../../libs/file_util')
const rp = require('request-promise')

rtmcphost_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtmcphost/tool/call',urlParser,session_filter,rtmcphost_c.callTool)//
    app.all('/rtmcphost/tools',urlParser,session_filter,rtmcphost_c.tools)//
}
/**
 * 调用tool
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
rtmcphost_c.callTool =  async function(req,res) 
{
    let {server_name,tool_name,tool_args} = str_filter.get_req_data(req)
    if(!server_name) return res.json({ret:false,msg:'param server_name is empty'})
    if(!tool_name) return res.json({ret:false,msg:'param tool_name is empty'})
    if(!tool_args) return res.json({ret:false,msg:'param tool_args is empty'})
    try{
        tool_args = JSON.parse(tool_args)
    }catch(ex)
    {
        console.error('rtmcphost_c.callTools-parseToolArgs failed:'+ex,ex)
        return res.json({ret:false,msg:'param tool_args is error, not object'})
    }

    let content = await rp.post({url:rtmcphost_setting.api_url +'/api/tools/toolCall', 
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            server_name: server_name,
            tool_name: tool_name,
            tool_args: tool_args
        })
    }).catch((ex)=>{
        console.error('callTool-exception:'+ex,ex)
        return res.json({ret:false,msg:'call tools failed by network'})
    })
    console.log('callTool:result-content:',content)
    let resultObj = null
    try{
        resultObj = JSON.parse(content)
    }catch(ex)
    {
        console.error('callTool:exception:'+ex,ex)
        return res.json({ret:false,msg:'call tool failed, result not json'})
    }
    if(resultObj && resultObj.code == 0  && !resultObj.data.isError) return  res.json({ret:true,msg:'success',result:resultObj})
    return res.json({ret:false,msg:'call tools failed',result:resultObj})
}
/**
 * 得到tools
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
rtmcphost_c.tools = async function(req,res)
{
    let {} = str_filter.get_req_data(req)
    let content = await rp.get({url:rtmcphost_setting.api_url +'/api/tools'}).catch((ex)=>{
        console.error('tools-exception:'+ex,ex)
        return res.json({ret:false,msg:'get tools failed'})
    })

    let resultObj = null
    try{
        resultObj = JSON.parse(content)
    }catch(ex)
    {
        console.error('rtmcphost_c.tools:exception:'+ex,ex)
        return res.json({ret:false,msg:'get tools list failed, result not json'})
    }
    if(resultObj && resultObj.code == 0 ) return  res.json({ret:true,msg:'success',result:resultObj})
    res.json({ret:false,msg:'tools result is not ok',result:resultObj})
}