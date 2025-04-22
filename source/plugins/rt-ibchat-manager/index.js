
/**
 * 基于LLM的智体agent管家应用
 * 2025-4-20
 */
if(typeof window == 'undefined') globalThis.window = globalThis
window.rtibchat_manager_c = {}
// const rtibchat_manager_c_token_name = OBJ_TOKEN_NAME
// const rtibchat_manager_c_api_base   = OBJ_API_BASE
// const rtibchat_manager_c_token_root = OBJ_TOKEN_ROOT
const rtibchatManagerSetting = require('../../setting/rtibchat_manager_setting.json')
const str_filter = require('../../libs/str_filter')
const file_util = require('../../libs/file_util')
rtibchat_manager_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtibchat/manager/new',urlParser,session_filter,rtibchat_manager_c.new)//基于folder-id进行恢复所有的内容。
}

/**
 * 智体管家agent的创建（读取的是当前节点的xmsg-list列表）读取【智能体标签下的xmsg-list或...】
 * @param {*} req 
 * @param {*} res 
 */
rtibchat_manager_c.new = async function (req,res) 
{
    let {user_id,label_type} = str_filter.get_req_data(req)
    if(!label_type && rtibchatManagerSetting.default_label_type) 
        label_type = rtibchatManagerSetting.default_label_type
    //let {user_id,label_type,chatid,p_xmsgid,p_userid,xtype,random,begin,len}
    let xmsgsRet = await new Promise((resolve)=>{
        groupchat_c.listXMsgs({params:{user_id,label_type,begin:0,len:1000000}},{json:function(data){
            resolve(data)
        }})
        setTimeout(()=>resolve(null),30000)
    })
    if(!xmsgsRet||!xmsgsRet.ret) return res.json({ret:true,msg:'create ibchat agent manager failed'})
    
    let list = xmsgsRet.list
    let results = []
    for(let i=0;i<list.length;i++)
    {
        let item = list[i]
        let files = item.files
        if(!files || files.length<=0) continue
        let flag = false
        
        let newFiles = []
        for(let pos = 0;pos<files.length;pos++)
        {
            let fileInfo = files[pos]
            if(fileInfo.name && fileInfo.name.startsWith('rtibchat-session')){
                flag =true
                //break;
            }
            newFiles.push({url:fileInfo.url,name:fileInfo.name})
        }
        let simpleItem = {xmsg:item.xmsg,files:newFiles}
        if(flag) results.push(simpleItem)
    }
    
    let system_role_prompt = (await file_util.readFile(window.config.runtime_current_dir +'/setting/rtibchat_manager_prompt.md')).toString()
    let history = 
    [
        {
            "role":"system",
            "content":system_role_prompt
        },
        {"content": "ok","role": "assistant"},
        {"role":"user","content":JSON.stringify(results)},
        {"content": "ok","role": "assistant"}
    ]
    let newSessionRet = await new Promise((resolve)=>{
        rtibchat_c.recoverSession ({params:{user_id,history:JSON.stringify(history)}},{json:function(data){
            resolve(data)
        }})
        setTimeout(()=>resolve(null),30000)
    })
    if(!newSessionRet) return res.json({ret:true,msg:'create ibchat agent manager failed, new session exception is null'})
    if(!newSessionRet.ret) return res.json(newSessionRet)
    newSessionRet.history = history //务必返回，前端需要。
    res.json(newSessionRet)
}