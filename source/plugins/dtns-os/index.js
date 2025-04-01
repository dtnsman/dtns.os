/**
 * dtns.os的插件代码
 * 【dtns.os-app】节点管理-创建-模板生成：重点打造一个plugin插件rtos插件用于管理-创建-模板制作-同步至其它社区（需账号登录--类似git和npm上传）
 * --让dtns.os的智体世界节点创建-管理-模板分享变得简单易行--特别支持dtns.network在dtns.connector中直接体验模板
 * date:2025-2-14
 */
if(typeof window == 'undefined' && typeof globalThis!='undefined') globalThis.window = globalThis
window.dtnsos_c = {}
// const dtnsos_c_token_name = OBJ_TOKEN_NAME
// const dtnsos_c_api_base   = OBJ_API_BASE
// const dtnsos_c_token_root = OBJ_TOKEN_ROOT

dtnsos_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/dtnsos/template/list',urlParser,dtnsos_c.listTemplate) //模板列表
    app.all('/dtnsos/template/install',urlParser,session_filter,dtnsos_c.installTemplate)//安装
    app.all('/dtnsos/template/make',urlParser,console_filter,dtnsos_c.makeTemplate)//制作
    app.all('/dtnsos/node/start',urlParser,session_filter,dtnsos_c.startNode)//启动
    app.all('/dtnsos/node/stop',urlParser,session_filter,dtnsos_c.stopNode)//停止
    app.all('/dtnsos/node/list',urlParser,session_filter,dtnsos_c.listNode)//列表
}
const file_util = require('../../libs/file_util')
const fs = require('fs')
dtnsos_c.readSettingJson = async function (filename,dir = null)
{
    let path = dir ? dir+'/'+filename : window.config.runtime_current_dir +'/setting/'+filename
    let fileExistsFlag = fs.existsSync(path)
    if(!fileExistsFlag) return null
    let jsonStr = await file_util.readFile(path)
    return JSON.parse(jsonStr)
}
dtnsos_c.saveSettingJson = async function (str,filename,dir = null)
{
    let path = dir ? dir+'/'+filename : window.config.runtime_current_dir +'/setting/'+filename
    let res = new Promise((resolve)=>{
        fs.writeFile(path, str, {flag: 'w'}, (err) => {
            if (err) {
                console.error('dtnsos_c.saveSettingJson-error:'+err,err)
                return resolve(false)
            }
            return resolve(true)
        });
    })
    return res
}
dtnsos_c.listTemplate = async function(req,res) 
{
    let setting = await dtnsos_c.readSettingJson('dtnsos-setting.json')
    let templatesJson = await dtnsos_c.readSettingJson('dtnsos-templates.json',setting.dtnsos_templates_zip_path)
    if(templatesJson) res.json({ret:true,msg:'success',list:templatesJson})
    else res.json({ret:false,msg:'templates.json is empty or not json-file'})
}

//判断是否是管理员
dtnsos_c.is_console_user = async function(req,res)
{
    let flag = await new Promise(async (resolve)=>{
        let oldResJsonFunc = res.json
        //hack the res.json
        res.json = function(data){
            // console.log('cancelXMsg-console_filter-call-oldResJsonFunc-res-json:',data)
            res.json = oldResJsonFunc
            resolve(false)
        }
        console_filter(req,res,function(){
            res.json = oldResJsonFunc
            resolve(true)
        })
    })
    return flag
}
dtnsos_c.copyDir = async function (src,dst)
{
    return await new Promise(async (resolve)=>{
    // 复制目录
    fs.copy(src, dst, { recursive: true }, (err) => {
        if (err) {
            console.error('dtnsos_c.copyDir-error:'+err,err);
            return resolve(false)
        }
        return resolve(true)
    });
    })
}
dtnsos_c.runCmd = async function (cmd,cwd=null) 
{
    let xid = 'xid-run-node-'+Date.now()
    try{
        let res = await new Promise((resolve)=>
            systemcmd_c.runCmd({params:{cmd,cwd,xid},peer:{send:function(data){
                console.info('dtnsos_c.runCmd-peer-recv:',data)
            }}},{json:function(data){
                resolve(data)
            }}))
        return xid
    }catch(ex)
    {
        console.error('dtnsos_c.runCmd:exception:'+ex,ex)
        return null
    }
}
const child_process = require("child_process")
const str_filter = require('../../libs/str_filter')
dtnsos_c.doCmd = function (cmd,params,cwd=null) 
{
    const newProc = child_process.spawn(cmd,params,{cwd,shell:true})
    newProc.stdout.on('data', (data) => {
        console.info(`dtnsos_c.doCmd-stdout: ${data}`);
    });
    
    newProc.stderr.on('data', (data) => {
        console.info(`dtnsos_c.doCmd-stderr: ${data}`);
    });
    
    newProc.on('close', (code) => {
        console.info(`dtnsos_c.doCmd-child process exited with code ${code}`);
    });
    return newProc
}
dtnsos_c.ptyCmd = async function (cmd,cwd) 
{
    try{
    let res = await new Promise((resolve)=>
        systemcmd_c.ptyCmd({params:{cmd,cwd,xid:'xid-pty-'+Date.now(),cols:52,rows:144},peer:{send:function(data){
            console.info('dtnsos_c.ptyCmd-peer-recv:',data)
        }}},{json:function(data){
            resolve(data)
        }}))
    return res
    }catch(ex)
    {
        console.error('dtnsos_c.ptyCmd:exception:'+ex,ex)
    }
}
dtnsos_c.findTemplateInfo = async function(tid,dir = null)
{
    let list = await dtnsos_c.readSettingJson('dtnsos-templates.json',dir)
    if(!list || list.length<=0) return null
    for(let i =0;i<list.length;i++)
    {
        if(list[i].tid == tid) return list[i]
    }
    return null
}
dtnsos_c.findNodeInfo = async function(web3name,dir)
{
    let list = await dtnsos_c.readSettingJson('web3list.json',dir)
    if(!list || list.length<=0) return null
    list = list.reverse()
    for(let i =0;i<list.length;i++)
    {
        if(list[i].web3name == web3name) return list[i]
    }
    return null
}
const AdmZip = require("adm-zip");
/**
 * 安装template
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
dtnsos_c.installTemplate = async function(req,res)
{
    //tid : template-id
    let {tid,web3name,user_id,logo,name,desc,user_name} =  str_filter.get_req_data(req)
    let regExp = new RegExp("^[a-zA-Z0-9]+[a-zA-Z0-9]{1,16}$")
    if(!(web3name.length>1 && web3name.length<=16) || !regExp.test(web3name) || web3name.indexOf('1d')>=0)
    {
        return res.json({ret:false,msg:"param(web3name) format error"})
    }
    
    let setting = await dtnsos_c.readSettingJson('dtnsos-setting.json')
    let is_ok = false
    if(!setting.open_all_people_node_permission_flag)
    {
        is_ok = await dtnsos_c.is_console_user(req,res)
        if(!is_ok) return res.json({ret:false,msg:'no pm'})
    }

    //找到templateid对应的zip路径（解压缩）
    let originZipPath = setting.dtnsos_node_runtime_zip_path
    let originRuntimePath = setting.dtnsos_node_runtime_path
    let web3nodePath  = setting.dtnsos_node_web3_path +'/'+web3name
    let tinfo  = await dtnsos_c.findTemplateInfo(tid,setting.dtnsos_templates_zip_path)
    if(!tinfo) return res.json({ret:false,msg:'template-info is empty'})
    templatePath = setting.dtnsos_templates_zip_path+'/'+tinfo.path 
    //#1解压缩 dtns.forklist.network.zip包
    // let ret =  await dtnsos_c.runCmd('unzip '+originZipPath,setting.dtnsos_node_web3_path)
    // console.info('unzip-origin-node-runtime-zip-ret:',ret,originZipPath,web3nodePath,tinfo)
    // fs.renameSync(originZipPath.split('.zip')[0],web3nodePath)
    //#1复制node版本的dtns.forklist至web3name
    // let ret = await dtnsos_c.copyDir(originRuntimePath,web3nodePath)
    //#1 使用adm-zip
    // const AdmZip = require("adm-zip");
    // reading archives
    const zip = new AdmZip(originZipPath)
    zip.extractAllTo(setting.dtnsos_node_web3_path, /*overwrite*/ true);
    fs.renameSync(originZipPath.split('.zip')[0],web3nodePath)
    //#2解压缩 template.zip于对应的web3name中
    //ret = await dtnsos_c.runCmd('unzip '+templatePath,setting.dtnsos_node_web3_path)
    const zip1 = new AdmZip(templatePath)
    zip1.extractAllTo(setting.dtnsos_node_web3_path, /*overwrite*/ true);
    fs.renameSync(setting.dtnsos_templates_zip_path+'/data',web3nodePath+'/data')
    fs.renameSync(setting.dtnsos_templates_zip_path+'/file_temp',web3nodePath+'/file_temp')
    fs.renameSync(setting.dtnsos_templates_zip_path+'/setting',web3nodePath+'/setting')
    //判断是否ok，并返回结果。
    //#3 重写配置文件
    let cSetting = await dtnsos_c.readSettingJson('c.json',web3nodePath+'/setting')
    if(web3name && ( web3name.indexOf('dev')>=0  || web3name.indexOf('loc')>=0))
    {
        cSetting.g_dev_roomid = web3name
    }
    else
    {
        cSetting.g_dev_roomid = ''
        cSetting.defaultRTCRoomID = cSetting.ll_config.roomid = web3name  //支持非dev-mode和loc-mode，而是public-mode
    }
    //回写配置文件
    //fs.writeFileSync(web3nodePath+'/setting/c.json',JSON.stringify(cSetting))
    dtnsos_c.saveSettingJson(JSON.stringify(cSetting),'c.json',web3nodePath+'/setting')
    //#4 应用列表 保存至dtns.os之web3列表
    let web3list = await dtnsos_c.readSettingJson('web3list.json',setting.dtnsos_templates_zip_path)
    if(!web3list) web3list = []
    web3list.push({
        web3name,
        user_id,
        logo,name,desc,user_name,
        is_console_user:is_ok,
        tid,
        tinfo,
        time:parseInt( Date.now()/1000 ),
        date:str_filter.GetDateFormat('y-m-d', parseInt(Date.now()/1000)),
        datetime:str_filter.GetDateTimeFormat( parseInt(Date.now()/1000))
    })
    //fs.writeFileSync(originRuntimePath+'/web3list.json',JSON.stringify(web3list))
    dtnsos_c.saveSettingJson(JSON.stringify(web3list),'web3list.json',setting.dtnsos_templates_zip_path)

    res.json({ret:true,msg:'success'})
}

/**
 * 制作template  智体世界镜像
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
dtnsos_c.makeTemplate = async function(req,res)
{
    let {web3name,user_id,logo,name,desc,user_name} =  str_filter.get_req_data(req)

    let setting = await dtnsos_c.readSettingJson('dtnsos-setting.json')

    let nodeInfo  = await dtnsos_c.findNodeInfo(web3name,setting.dtnsos_templates_zip_path)
    if(!nodeInfo) return res.json({ret:false,msg:'node-info is empty'})

    let is_ok = await dtnsos_c.is_console_user(req,res)
    if(!is_ok && nodeInfo.user_id!=user_id) return res.json({ret:false,msg:'no pm'})

    //找到templateid对应的zip路径（解压缩）
    let originZipPath = setting.dtnsos_node_runtime_zip_path
    let originRuntimePath = setting.dtnsos_node_runtime_path
    let web3nodePath  = setting.dtnsos_node_web3_path +'/'+web3name
    
    //#1 压缩模板文件
    const templateZip = new AdmZip()
    templateZip.addLocalFolder(web3nodePath+'/data','data')
    templateZip.addLocalFolder(web3nodePath+'/file_temp','file_temp')
    templateZip.addLocalFolder(web3nodePath+'/setting','setting')
    //#1.1 保存描述信息
    let templateId = web3name+'-'+ parseInt(Date.now()/1000)
    let templateInfo = {
        "tid":templateId,
        "name":name ?name: "用户模板" ,
        "path":templateId+'.zip',
        "author":user_name?user_name:'user',
        "user_id":user_id,
        "date":str_filter.GetDateFormat('y-m-d', parseInt(Date.now()/1000)),
        "datetime":str_filter.GetDateTimeFormat(parseInt(Date.now()/1000)),
        "desc":desc ? desc:'',
        "logo":logo,
        "from_web3name":web3name
    }
    await dtnsos_c.saveSettingJson(JSON.stringify(templateInfo),'template-info.json',setting.dtnsos_templates_zip_path)
    templateZip.addLocalFile(setting.dtnsos_templates_zip_path+'/template-info.json')

    //#2 保存至模板文件夹
    let templatePath = setting.dtnsos_templates_zip_path+'/'+templateId+'.zip'
    let writeFlag = await templateZip.writeZipPromise(templatePath)

    console.info('write-template-flag:',writeFlag)
    if(!writeFlag) return res.json({ret:false,msg:'write template file failed'})

    //#3 保存至模板配置文件
    let templateList = await dtnsos_c.readSettingJson('dtnsos-templates.json',setting.dtnsos_templates_zip_path)
    templateList = templateList ? templateList:[]
    templateList.push(templateInfo )
    await dtnsos_c.saveSettingJson(JSON.stringify(templateList),'dtnsos-templates.json',setting.dtnsos_templates_zip_path)

    res.json({ret:true,msg:'success',templateInfo})
}
const nodeMap = new Map()
// const nodeStatus = {nodelist:[]}
dtnsos_c.startNode = async function(req,res)
{
    let {web3name,user_id} =  str_filter.get_req_data(req)

    let setting = await dtnsos_c.readSettingJson('dtnsos-setting.json')
    let nodeInfo  = await dtnsos_c.findNodeInfo(web3name,setting.dtnsos_templates_zip_path)
    if(!nodeInfo) return res.json({ret:false,msg:'node-info is empty'})
    let is_ok = await dtnsos_c.is_console_user(req,res)
    if(!is_ok && nodeInfo.user_id!=user_id) return res.json({ret:false,msg:'no pm'})

    if(nodeMap.has(web3name)) return res.json({ret:false,msg:'node is started'})

    //找到templateid对应的zip路径（解压缩）
    let originZipPath = setting.dtnsos_node_runtime_zip_path
    let originRuntimePath = setting.dtnsos_node_runtime_path
    let web3nodePath  = setting.dtnsos_node_web3_path +'/'+web3name

    let xid = dtnsos_c.doCmd('node',['app.js'],web3nodePath)// dtnsos_c.runCmd('node app.js',web3nodePath)
    if(!xid) return res.json({ret:false,msg:'start failed'})

    nodeMap.set(web3name,xid)
    // nodeStatus.nodelist.push(web3name)
    //使用dtns-api：/systemcmd/run
    res.json({ret:true,msg:'start success'})
}

dtnsos_c.stopNode = async function(req,res)
{
    //tid : template-id
    let {web3name,user_id} =  str_filter.get_req_data(req)

    let setting = await dtnsos_c.readSettingJson('dtnsos-setting.json')
    let nodeInfo  = await dtnsos_c.findNodeInfo(web3name,setting.dtnsos_templates_zip_path)
    if(!nodeInfo) return res.json({ret:false,msg:'node-info is empty'})
    let is_ok = await dtnsos_c.is_console_user(req,res)
    if(!is_ok && nodeInfo.user_id!=user_id) return res.json({ret:false,msg:'no pm'})

    if(!nodeMap.has(web3name)) return res.json({ret:false,msg:'node is not started'})

    let xid = nodeMap.get(web3name)
    if(xid)// && xid.kill)
    {
        xid.stdin.write('system-stop-now!\n')
        let kill_flag = xid.kill()
        console.info('stopNode-kill_flag:',kill_flag)
    } 
    // let ret = await new Promise((reslove)=>{
    //     systemcmd_c.postCmd({params:{xid,kill:true}},{json:function(data){
    //         reslove(data)
    //     }})
    // })
    nodeMap.delete(web3name)
    
    // if(ret && ret.ret) return res.json({ret:true,msg:'stop success'})
    return res.json({ret:true,msg:'stop success'})

    //使用dtns-api：/systemcmd/run
    res.json({ret:false,msg:'stop failed, reason:'+ret.msg})
}

dtnsos_c.listNode = async function(req,res)
{
    let setting = await dtnsos_c.readSettingJson('dtnsos-setting.json')
    let web3list = await dtnsos_c.readSettingJson('web3list.json',setting.dtnsos_templates_zip_path)
    if(!web3list) web3list = []

    let keys = []
    nodeMap.forEach((val,key,map)=>{
        keys.push(key)
    })
    
    res.json({ret:true,msg:'success',list:web3list,alives:keys})
}