/**
 * 云盘的插件代码
 */
window.clouddisk_c = {}
window.clouddisk_c_token_name = OBJ_TOKEN_NAME
window.clouddisk_c_api_base   = OBJ_API_BASE
window.clouddisk_c_token_root = OBJ_TOKEN_ROOT

clouddisk_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/clouddisk/delete',urlParser,session_filter,clouddisk_c.deleteOP)
    app.all('/clouddisk/top',urlParser,session_filter,clouddisk_c.top)
    app.all('/clouddisk/folder/create',urlParser,session_filter,clouddisk_c.createFolder)
    app.all('/clouddisk/folder/file/add',urlParser,session_filter,clouddisk_c.saveFile2Folder)
    app.all('/clouddisk/folder/files',urlParser,clouddisk_c.listFolderFiles)
    app.all('/clouddisk/folder/my',urlParser,session_filter,clouddisk_c.queryMyFolder) //仅一个，保存在user-info中
}
/**
 * 查询我的文件夹
 */
clouddisk_c.queryMyFolder = async function (req,res)
{
    let {user_id} = str_filter.get_req_data(req)
    let userInfo = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
    if(!userInfo) return res.json({ret:false,msg:'userInfo is empty'})

    let folderInfo  = !userInfo.folder_id ? null : await rpc_api_util.s_query_token_info(clouddisk_c_api_base,userInfo.folder_id,'assert') //await rpc_api_util.s_query_token_info(clouddisk_c_api_base,userInfo.folder_id,'assert')
    if(!userInfo.folder_id || userInfo.user_id!=user_id || !folderInfo)
    {
        // let folderInfo  = !userInfo.folder_id ? null : await rpc_api_util.s_query_token_info(clouddisk_c_api_base,userInfo.folder_id,'assert')
        if(!folderInfo || folderInfo.user_id != user_id)
        {
            let newFolderRet = await new Promise((resolve)=>{
                let tmpReq = {params:{name:'我的文件夹',user_id}}
                let tmpRes = {json:function(data){
                    resolve(data)
                }}
                clouddisk_c.createFolder(tmpReq,tmpRes)
            })
            if(!newFolderRet || !newFolderRet.ret) return res.json({ret:false,msg:'create my folder failed'})
            userInfo.folder_id = newFolderRet.new_folder_id
            userInfo.user_id   = user_id
            let saveRet = await rpc_api_util.s_save_token_info(USER_API_BASE,USER_TOKEN_ROOT,user_id,'assert',JSON.stringify(userInfo),'save my folder-id')
            if(!saveRet) return res.json({ret:false,msg:'userInfo save my folder-id failed'})
            return res.json({ret:true,msg:'success',folderInfo:newFolderRet.obj})
        }else{
            console.log('folder-info-user-id equals to '+user_id)
        }
    }
    if(!folderInfo) res.json({ret:false,msg:'query folder-info is empty！folder_id:'+userInfo.folder_id})
    return res.json({ret:true,msg:'success',folderInfo})
}
//创建文件夹
clouddisk_c.createFolder = async function(req,res)
{
    let {name,folder_id,user_id,chatid} = str_filter.get_req_data(req)
    if(!name) return res.json({ret:false,msg:'folder name is error'})
    let folderInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,folder_id,'assert')

    //判断chatid的权限
    if(chatid){
        let nextFlag = await new Promise(async (resolve)=>{
            let oldResJsonFunc = res.json
            //hack the res.json
            res.json = function(data){
                console.log('createFolder-vip-filter-call-oldResJsonFunc-res-json:',data)
                oldResJsonFunc(data)
                resolve(false)
            }
            vip_filter_send(req,res,function(){
                vip_filter(req,res,function(){
                    res.json = oldResJsonFunc
                    resolve(true)
                })
            })
        })
        console.log('createFolder-nextFlag:',nextFlag)
        if(!nextFlag){
            console.log('createFolder-vip-filter-no-pm:',nextFlag)
            return 
        }
    }else{
        if(folderInfo && user_id != folderInfo.user_id){
            return res.json({ret:false,msg:'this foloder is not your folder-id'})
        }
    }

    let new_folder_id = await rpc_api_util.s_fork_token_id(clouddisk_c_api_base,clouddisk_c_token_root,'folder')
    if(!new_folder_id) return  res.json({ret:false,msg:'fork folder-id failed'})

    let create_time_i = parseInt(Date.now()/1000)
    let obj = {type:'folder',chatid,folder_id:new_folder_id, name,p_folder_id:folder_id,user_id,create_time_i,create_time:str_filter.GetDateTimeFormat(create_time_i)} 
    let saveInfoRet = await rpc_api_util.s_save_token_info(clouddisk_c_api_base,clouddisk_c_token_root,new_folder_id,'assert',JSON.stringify(obj),'save folder info')
    if(!saveInfoRet) return res.json({ret:false,msg:'save folder-info failed'})

    //保存关系
    if(folderInfo){
        let saveRelfRet = await rpc_api_util.s_save_into_token_list(clouddisk_c_api_base,folder_id,new_folder_id,'relf','new-folder save into folder list')
        if(!saveRelfRet)  return res.json({ret:false,msg:'save folder-relf-parent-folder failed'})
    }
    return res.json({ret:true,msg:'success',obj,new_folder_id})
}
//删除操作
clouddisk_c.deleteOP = async function (req,res)
{
    let {folder_id,file_id,user_id} = str_filter.get_req_data(req)
    let folderInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,folder_id,'assert')
    if(!folderInfo) return res.json({ret:false,msg:'folder info is empty'})
    let fileInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,file_id,'assert')
    if(!fileInfo) return res.json({ret:false,msg:'file info is empty'})

    //判断系统管理员权限
    let nextFlag = await new Promise(async (resolve)=>{
        let oldResJsonFunc = res.json
        //hack the res.json
        res.json = function(data){
            console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
            res.json = oldResJsonFunc
            resolve(false)
        }
        console_filter(req,res,function(){
            res.json = oldResJsonFunc
            resolve(true)
        })
    })
    console.log('cancelXMsg-nextFlag:',nextFlag)
    if(!nextFlag && folderInfo.user_id!=user_id) return res.json({ret:false,msg:'no pm to delete'})
    
    let flag = await rpc_api_util.s_del_from_token_list(clouddisk_c_api_base,folder_id,file_id,'relf',user_id+' delete file_id from folder')
    res.json({ret:flag,msg:(flag?'success':'delete from folder failed!')})
}
//置顶列表操作
clouddisk_c.top = async function(req,res)
{
    let {folder_id,file_id,user_id} = str_filter.get_req_data(req)
    let folderInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,folder_id,'assert')
    if(!folderInfo) return res.json({ret:false,msg:'folder info is empty'})
    let fileInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,file_id,'assert')
    if(!fileInfo) return res.json({ret:false,msg:'file info is empty'})
    //判断系统管理员权限
    let oldResJsonFunc = res.json
    let nextFlag = await new Promise(async (resolve)=>{
        //hack the res.json
        res.json = function(data){
            console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
            resolve(false)
        }
        console_filter(req,res,function(){
            resolve(true)
        })
    })
    res.json = oldResJsonFunc
    console.log('cancelXMsg-nextFlag:',nextFlag)
    if(!nextFlag && folderInfo.user_id!=user_id) return res.json({ret:false,msg:'no pm to delete'})
    
    let flag = await rpc_api_util.s_del_from_token_list(clouddisk_c_api_base,folder_id,file_id,'relf',user_id+' delete file_id from folder')
    if(!flag) res.json({ret:flag,msg:(flag?'success':'top failed: delete from folder failed!')})
    
    flag = await rpc_api_util.s_save_into_token_list(clouddisk_c_api_base,folder_id,file_id,'relf','file_id top to folder list')
    res.json({ret:flag,msg:(flag?'success':'top top folder failed!')})
}

//将文件插入至文件夹（1种是去重，另外一种是不去重----重名）
clouddisk_c.saveFile2Folder = async function(req,res)
{
    let {file_id,folder_id,user_id} = str_filter.get_req_data(req)
    let fileInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,file_id,'assert')
    if(!fileInfo) return res.json({ret:false,msg:'file info is empty'})
    let folderInfo = await rpc_api_util.s_query_token_info(clouddisk_c_api_base,folder_id,'assert')
    if(!folderInfo) return res.json({ret:false,msg:'folder info is empty'})
    let chatid = folderInfo.chatid
     //判断chatid的权限
    if(chatid){
        req.params.chatid = chatid //添加一个参数
        let nextFlag = await new Promise(async (resolve)=>{
            let oldResJsonFunc = res.json
            //hack the res.json
            res.json = function(data){
                console.log('saveFile2Folder-vip-filter-call-oldResJsonFunc-res-json:',data)
                oldResJsonFunc(data)
                resolve(false)
            }
            vip_filter_send(req,res,function(){
                vip_filter(req,res,function(){
                    res.json = oldResJsonFunc
                    resolve(true)
                })
            })
        })
        console.log('saveFile2Folder-nextFlag:',nextFlag)
        if(!nextFlag){
            console.log('saveFile2Folder-vip-filter-no-pm:',nextFlag)
            return 
        }
    }else{
        if(folderInfo && user_id != folderInfo.user_id){
            return res.json({ret:false,msg:'this foloder is not your folder-id'})
        }
    }

    let saveRelfRet = await rpc_api_util.s_save_into_token_list(clouddisk_c_api_base,folder_id,file_id,'relf','save file into folder list')
    if(!saveRelfRet)  return res.json({ret:false,msg:'save file-relf-parent-folder failed'})
    return res.json({ret:true,msg:'success'})
}
/**
 * 列举文件（暂时不限制网盘的访问权限，允许查看文件列表）
 */
clouddisk_c.listFolderFiles = async function(req,res)
{
    let {folder_id,user_id} = str_filter.get_req_data(req)
    let list = await rpc_api_util.s_query_token_list(clouddisk_c_api_base,folder_id,'relf',0,100000,false)
    if(list && list.length>0){
        res.json({ret:true,msg:'success',list})
    }else{
        res.json({ret:false,msg:'folder files is empty'})
    }
}