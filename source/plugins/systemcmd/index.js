/**
 * system-cmd的插件代码
 */
window.systemcmd_c = {}
// const systemcmd_c_token_name = OBJ_TOKEN_NAME
// const systemcmd_c_api_base   = OBJ_API_BASE
// const systemcmd_c_token_root = OBJ_TOKEN_ROOT

systemcmd_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    //app.all('/systemcmd/reboot',urlParser,console_filter,systemcmd_c.reboot)
    //app.all('/systemcmd/shutdown',urlParser,console_filter,systemcmd_c.shutdown)
    app.all('/systemcmd/killapp',urlParser,console_filter,systemcmd_c.killapp)
    app.all('/systemcmd/dtns/static',urlParser,console_filter,systemcmd_c.static)
    app.all('/systemcmd/web3/cid',urlParser,console_filter,systemcmd_c.genCID)
    app.all('/system/apps/default',urlParser,systemcmd_c.defaultApps)
    app.all('/systemcmd/run',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, systemcmd_c.runCmd)
    app.all('/systemcmd/post',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter,systemcmd_c.postCmd)//给当前的命令环境传递消息
    app.all('/systemcmd/pty',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter,systemcmd_c.ptyCmd)
}
systemcmd_c.killapp = killapp
async function killapp(req,res)
{
    console.log('system-cmd-api call killapp now: success')
    res.json({ret:true,msg:'success'})
    process.exit(1)
}
systemcmd_c.static = dtns_static_query
async function dtns_static_query(req,res)
{
    console.log('system-cmd-api call dtns_static_query now: success')
    await g_dtnsManager.queryDTNSAll(true)
    let retJson = {list:g_dtnsManager.web3apps,networks:g_dtnsManager.networkInfoMapObj,ret:true,msg:'success'}

    let file_util = require('../../libs/file_util')
    await file_util.writeFile('/usr/share/nginx/html/ibapps.json',JSON.stringify(retJson))
    res.json(retJson)
}
/**
 * 新增cid----create web3app access id 
 */
systemcmd_c.genCID = dtns_web3_gen_cid
async function dtns_web3_gen_cid(req,res)
{
    console.log('system-cmd-api call dtns_web3_gen_cid now: ')
    let {num} = str_filter.get_req_data(req)
    if(!num) num=1
    else num = parseInt(num)

    let list = []
    for(let i=0;i<num;i++)
    {
        let cid = str_filter.randomBytes(32);
        // user_redis.set(ll_config.redis_key+":session:"+obj.user_id+"-"+s_id,s_id,3*24*60*60)
        let setFlag = await kmmDb.set('web3-cid:'+cid,'new',24*60*60*366)//1年有效期（365天）
        console.log('set-cid-into-kmmDb:'+setFlag,cid)
        if(!setFlag) return res.json({ret:false,msg:'save cid failed'})
        list.push(cid)
    }

    res.json({list,ret:true,msg:'success'})
}
/**
 * 新增：系统apps-default配置。
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const file_util = require('../../libs/file_util')
const str_filter = require('../../libs/str_filter')
systemcmd_c.defaultApps = async function (req,res) 
{
    try{
        let jsonStr = await file_util.readFile(window.config.runtime_current_dir +'/setting/systemcmd-apps-default.json')
        if(jsonStr){
            res.json({ret:true,msg:'success',setting:JSON.parse(jsonStr)})
        }
    }catch(ex)
    {
        console.log('systemcmd_c.defaultApps-ex:'+ex,ex)
    }
    return res.json({ret:false,msg:'apps_default.json is empty or not json-file'})
}
async function getFileStats(path)
{
    return new Promise((res)=>{
        require('fs').stat(path, (err, stats) => {
            if (err) {
              console.error(err);
              res(err)
              return;
            }
          
            // stats.isFile(); // true
            // stats.isDirectory(); // false
            // stats.isSymbolicLink(); // false
            // stats.size; // 1024000 //= 1MB
            res(stats)
          });
    })
}
/**
 * 下载文件
 * @param {*} req 
 * @param {*} res 
 */
systemcmd_c.downFile = async function (req,res) 
{
    let {cmd,xid,cwd,ostype,filename,user_id,s_id} = str_filter.get_req_data(req)
    
    let fromPath = cwd ? cwd +'/'+ filename : __dirname+'/file/'+ filename
    let hash =  await file_util.readFileSha256(fromPath)
    let stats= await getFileStats(fromPath)
    //copy file to file-temp
    let dstPath = config.file_temp + hash
    let ret = await file_util.copyFile(fromPath,dstPath)
    if(!ret)  res.json({ret:false,msg:'copy file failed'})

    let fileInfo = {fieldname:"file",encoding:'fromfile_binary',originalname:filename,
        mimetype:'mine/*',filename,path:'file-path',
        size:stats.size,hash,user_id,s_id,
        file_kind:'file',random:Math.random()}

    let fastUploadRet = await new Promise(async (resolve)=>{
        let oldResJsonFunc = res.json
        //hack the res.json
        res.json = function(data){
            console.log('systemcmd-downloadFile-call-oldResJsonFunc-res-json:',data)
            // oldResJsonFunc(data)//权判断权限，不返回
            res.json = oldResJsonFunc
            resolve(data)
        }
        //调用快速上传接口
        window.file_c.upload_file_fast({params:fileInfo},res)
    })

    res.json(fastUploadRet)
}
/**
 * 上传文件
 * @param {*} req 
 * @param {*} res 
 */
systemcmd_c.uploadFile = async function (req,res) 
{
    let {cmd,xid,cwd,ostype,file_id,file_url,filename} = str_filter.get_req_data(req)
    let fromPath = config.file_temp + file_url
    let dstPath = cwd ? cwd +'/'+ filename : __dirname+'/file/'+ filename//file_url
    let ret = await file_util.copyFile(fromPath,dstPath)
    if(ret) res.json({ret:true,msg:'success'})
    else res.json({ret:false,msg:'copy file failed'})
}
/**
 * 用于执行前端linux指令。
 * @param {*} req 
 * @param {*} res 
 */
const procMap = new Map()
// let nowProc = null
// let nowProcCtrl = null
// let nowProcAborted=false
systemcmd_c.runCmd = async function(req,res) 
{
    let {cmd,xid,cwd,user_id,ostype} = str_filter.get_req_data(req)
    //set the windows
    // ostype = require('os').type() == 'Windows_NT' ? 'windows' : ostype
    if(!ostype) ostype = require('os').type()
    // try{
    //     let allowsStr = await file_util.readFile(window.config.runtime_current_dir +'/setting/systemcmd-allows')
    //     // let jsonPM = JSON.parse(jsonStr)
    //     if(!allowsStr || allowsStr.indexOf(user_id)<0)
    //     {
    //         res.json({ret:false,msg:'no pm'})
    //         req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:'[error] no pm\r\n',err_flag:false,ended:false}))
    //         return req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:-1,code:-1,err_flag:false,ended:true}))
    //     }
    // }catch(ex)
    // {
    //     console.log('systemcmd_c.defaultApps-ex:'+ex,ex)
    //     res.json({ret:false,msg:'no pm'})
    //     req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:'[error] no pm\r\n',err_flag:false,ended:false}))
    //     return req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:-1,code:-1,err_flag:false,ended:true}))
    // }
    if(cmd=='fu') return systemcmd_c.uploadFile(req,res)
    if(cmd=='fd') return systemcmd_c.downFile(req,res)
    // let cmds = cmd.split(' ')
    try{
        let pwdCmd = ostype =='windows' || ostype =='win' ? '':' && pwd '
        pwdCmd = cmd && cmd.trim() ?pwdCmd : ''//当命令为空时，不自动添加pwd目录命令
        if(pwdCmd && ostype == 'Windows_NT') pwdCmd = ' && chdir'
        const controller = typeof AbortController!='undefined'  ? new AbortController() :null;
        const { signal } = controller ? controller:{};
        
        let encoding = ostype == 'Windows_NT' ? 'GBK' :null
        // pwdCmd = cwd ? '' : pwdCmd //2025-2-14新增，用于兼容node app.js命令（无须返回pwd指令）
        let proc=require("child_process").exec(cmd +pwdCmd,{cwd,signal,encoding})//.spawn(cmds[0],cmds.slice(1,-1));
        let lastData = null
        proc.stdout.on("data",function(data){
            // console.log('now:'+data);
            if(lastData) req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:lastData.toString().replace(/\n/g,'\r\n'),ended:false}))
            if(ostype == 'Windows_NT')// data.isEncoding('GBK') || data.isEncoding('GB2312'))
            {
                //let td = new TextDecoder('GBK')
                let iconv = require('iconv-lite');
                lastData = iconv.decode(data, 'GBK') //td.decode(new Buffer( data,'GBK'))
            }
            else    
            lastData = data
                //req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:data.toString().replace('\n','\r\n'),ended:false}))
        });
        proc.stderr.on('data', (data) => {
            // console.error(`stderr: ${data}`);
            if(lastData) req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:lastData.toString().replace(/\n/g,'\r\n'),ended:false}))
            if(ostype == 'Windows_NT')// data.isEncoding('GBK') || data.isEncoding('GB2312'))
            {
                //let td = new TextDecoder('GBK')
                let iconv = require('iconv-lite');
                data = iconv.decode(data, 'GBK') //td.decode(new Buffer( data,'GBK'))
            }
            else    
            data = data
            req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:data.toString().replace(/\n/g,'\r\n'),err_flag:true,ended:false}))
            if(ostype == 'Windows_NT') req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data,code:-1,err_flag:false,ended:true}))
            procMap.get(xid).nowProcAborted = true
        });
        //pro.stdin.write(
        let nowProc = proc
        let nowProcAborted=false
        let nowProcCtrl = controller
        procMap.set(xid,{nowProc,nowProcAborted,nowProcCtrl})
        proc.on('close', (code) => {
            // console.log(`子进程退出码：${code}`);
            // nowProc = null
            let pwd_dir = null
            if(procMap.get(xid).nowProcAborted) lastData = null
            if(lastData) 
            {
                if(ostype =='windows' || ostype =='win') req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:lastData.toString().replace(/\n/g,'\r\n'),ended:false}))
                else{
                    lastData = lastData.toString()
                    if(lastData.indexOf('\n') == lastData.lastIndexOf('\n'))
                        pwd_dir = lastData
                    else
                    {
                        //fix some linux verseion  pwd && pwd ,  return result by one line
                        lastData = lastData.toString()
                        lastData = lastData.trim()
                        // if(lastData.lastIndexOf('\n') ==  lastData.length-1)
                        //     lastData = lastData.substring(0,lastData.length-1) //过滤掉最后一个\n
                        let lastIdx = lastData.lastIndexOf('\n')
                        let data = lastData.substring(0,lastIdx+1)
                        req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:data.replace(/\n/g,'\r\n'),ended:false}))
                        pwd_dir = lastData.substring(lastIdx,lastData.length)
                    }
                } 
            }
            req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:code,code,err_flag:false,ended:true,pwd_dir:pwd_dir && code==0 ? pwd_dir.replace(/\r\n/g,'') :null}))
            procMap.delete(xid)
        });
        res.json({ret:true,msg:'success'})
    }catch(ex)
    {
        console.log('runCmd-ex:'+ex,ex)
        res.json({ret:false,msg:'exception'})
        req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:-1,code:-1,err_flag:false,ended:true}))
    }
}
/**
 * 给当前的process推送输入信息。
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
systemcmd_c.postCmd = async function (req,res) 
{
    let {cmd,kill,xid} = str_filter.get_req_data(req)
    if(procMap.get(xid).nowProc){
        if(kill)
        {
            procMap.get(xid).nowProcAborted=true
            if(procMap.get(xid).nowProcCtrl) procMap.get(xid).nowProcCtrl.abort();//nowProc.kill('SIGINT')
            else{
                procMap.get(xid).nowProc.kill()//'SIGINT')//9)
                // let pid = procMap.get(xid).nowProc.pid
                // // console.info('taskkill-pid:',pid)
                // // //process.kill(pid)
                // // systemcmd_c.runCmd({params:{cmd:'taskkill /pid '+pid+' -t\n\n'},peer:{send:function(data){
                // //     console.info('postCmd.kill-peer-recv:',data)
                // // }}},{json:function(data){}})

                // procMap.get(xid).nowProc.stdin.write('\x03')
                // // procMap.get(xid).nowProc.stdin.write('\x03')
                // procMap.get(xid).nowProc.stdin.write('system-stop-now!')
                // let kill_flag  = procMap.get(xid).nowProc.kill()//'SIGINT')//9)
                // console.info('kill_flag:',kill_flag,pid)
            } 
            // console.info('postCmd-procMap.get(xid):',procMap.get(xid))
        }
        else procMap.get(xid).nowProc.stdin.write(cmd)
        return res.json({ret:true,msg:'success'})
    } 
    res.json({ret:false,msg:'child-process is ended'})
}

/**
 * 系统权限管理器
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 
 */
systemcmd_c.systemcmd_allows_filter = async function(req, res, next) 
{
    let {user_id,xid} = str_filter.get_req_data(req)
    try{
        let allowsStr = await file_util.readFile(window.config.runtime_current_dir +'/setting/systemcmd-allows')
        // let jsonPM = JSON.parse(jsonStr)
        if(!allowsStr || allowsStr.indexOf(user_id)<0)
        {
            res.json({ret:false,msg:'no pm'})
            if(req.peer)
            {
                req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:'[error] no pm\r\n',err_flag:false,ended:false}))
                req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:-1,code:-1,err_flag:false,ended:true}))
            }
            return false
        }
    }catch(ex)
    {
        console.log('systemcmd_c.defaultApps-ex:'+ex,ex)
        res.json({ret:false,msg:'no pm'})
        if(req.peer)
        {
            req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:'[error] no pm\r\n',err_flag:false,ended:false}))
            req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data:-1,code:-1,err_flag:false,ended:true}))
        }
        return false
    }
    return next();
}
window.systemcmd_allows_filter = systemcmd_c.systemcmd_allows_filter
/**
 * 使用node-pty作为后端
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
systemcmd_c.ptyCmd = async function (req,res) 
{
    let {cmd,cwd,kill,xid,cols,rows,user_id} = str_filter.get_req_data(req)
    //强制关闭。
    if(kill) 
    {
        let ptyProcess = procMap.get(xid)
        procMap.delete(xid)
        res.json({ret:true,msg:'success',killed:true})
        //退出
        if(ptyProcess)
        {
            ptyProcess.write('\r\n')
            ptyProcess.write('exit\r\n')
        }
        return
    }
    
    let new_flag = false
    if(!procMap.has(xid))
    {
        let os = require('os');
        let pty = require('node-pty');

        let shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        console.log('os:',os.platform())

        let ptyProcess = pty.spawn(shell, [], { //--login
                name: 'xterm-color',
                cols,
                rows,
                cwd: cwd ? cwd:__dirname+'/../../',
                env: process.env
        });

        ptyProcess.onData((data) => {
               // process.stdout.write(data);
            //    console.log('pty-data:',data)
            try{
                if(procMap.has(xid))
                    req.peer.send(JSON.stringify({channel:'rtterm',notify_type:xid,data,code:0,err_flag:false,ended:false}))
            }catch(ex)
            {
                procMap.delete(xid)
            }
        });
        procMap.set(xid,ptyProcess)
        new_flag = true
    }
    let ptyProcess = procMap.get(xid)
    ptyProcess.resize(cols,rows)
    ptyProcess.write(cmd)
    res.json({ret:true,msg:'run cmd ok!',new_flag})
}
/**
 * 重启（windows）
 */
systemcmd_c.reboot = reboot
async function reboot(req,res)
{
    console.log('system-cmd-api call reboot now:')
    const { exec } = require('child_process');
    let command = exec('shutdown -r -t 0', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log("reboot failed" + err + stderr);
            return res.json({ret:false,msg:'reboot failed'})
        }
        res.json({ret:false,msg:'success'})
    });
    command.stdin.end();
    command.on('close', function(code) {
        console.log("reboot close -- code:",  code);
    });
}
//关机（windows）
systemcmd_c.shutdown = shutdown
async function shutdown(req,res)
{
    console.log('system-cmd-api call shutdown now:')
    const { exec } = require('child_process');
    let command = exec('shutdown -s -t 00', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log("shutdown failed" + err + stderr);
            return res.json({ret:false,msg:'shutdown failed'})
        }
        res.json({ret:false,msg:'success'})
    });
    command.stdin.end();
    command.on('close', function(code) {
        console.log("shutdown close -- code:",  code);
    });
}
