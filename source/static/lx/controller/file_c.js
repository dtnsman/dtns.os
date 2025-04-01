/**
 * 处理文件上传
 * by lauo.li 2019-4-4
 */
// var urlLib = require('url');
// var ObsClient = require('../libs/libobs/obs');
// var obsClient = new ObsClient({
//     access_key_id: '*',
//     secret_access_key: '*',
//     server : '*'
// });
// const OBS_LOGO_BUCKET = 'groupchat-logo'
// const OBS_IMAGE_BUCKET = 'groupchat-img'
// const OBS_FILE_BUCKET = 'groupchat-file'

// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// var fs = require("fs");
// const file_util = require('../libs/file_util')

// const notice_util = require('../libs/notice_util');
// const user_redis = require('../config').user_redis;

// const manager_c = require('./manager_c');

// const rpc_query = require('../rpc_api_config').rpc_query
// const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
//     ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
//     GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
//     PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
//     RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
//     SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
//     OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
//     MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
//     VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

// const rpc_api_util = require('../rpc_api_util');
/**
 * 由img_kind得到bucket的名字
 * @param img_kind
 * @returns {*}
 */
function getBucketName(img_kind)
{
    if(img_kind=='logo') return OBS_LOGO_BUCKET
    else if(img_kind=='img' || img_kind=='open') return OBS_IMAGE_BUCKET
    else if(img_kind =='file' )return OBS_FILE_BUCKET
    else if(img_kind =='src' )return OBS_FILE_BUCKET
    return null;
}

/**
 * 获得默认的风景图
 */
window.file_c = {}
window.file_c.get_fengjing_imgs =get_fengjing_imgs
async function get_fengjing_imgs(req,res) 
{
    const fengjing_imgs = []// await require('../fengjing_imgs').get_list();
    res.json({ret:true,msg:'success',list:fengjing_imgs})
}

/**
 * 获得默认的萌宠图
 */
window.file_c.get_mc_logos =get_mc_logos
async function get_mc_logos(req,res) 
{
    const mc_logos = []//await require('../mc_logos').get_list();
    res.json({ret:true,msg:'success',list:mc_logos})
}
async function existsFile(filename) {
    let flag = false;
    await new Promise((resolve,reject)=>{
        try{
            fs.exists(filename, function(exists) {

                flag  = exists;
                console.log('existsFile:'+filename+' exists:'+exists)
                resolve(flag)
            
            });
        }catch(ex)
        {
            console.log('existsFile:'+filename+' exception:'+ex)
            flag =  false;
            reject(false)
        }
    });

    
    return flag;
  }

/**
 * 上传本地的静态图片文件，然后转为obj_id
 */
window.file_c.upload_static_file =upload_static_file;
async function upload_static_file(path) {
    let img_kind ='open';

    let existFlag = await existsFile(path)
    console.log('existFlag:'+existFlag)
    if(!existFlag) return {ret:false,msg:'file unexist'};

    //映射对应的img-info
    let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'img'+img_kind})
    if(!forkObjRet || !forkObjRet.ret)
    {
        return {ret:false,msg:"static file fork obj-id failed"}
    }

    //声明相关上传人等的信息。
    // let obj = {user_id,obj_id:forkObjRet.token_x}
    let fileInfo = {};
    fileInfo.obj_id = forkObjRet.token_x
    fileInfo.img_kind = img_kind
    fileInfo.save_time = parseInt(new Date().getTime()/1000)

    let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
        opval:JSON.stringify(fileInfo),extra_data:'save file info'})
    if(!assertInfoRet || !assertInfoRet.ret)
    {
        return {ret:false,msg:"img file assert obj-info failed"}
    }

    let putRet = {ret:false};
    await new Promise((resolve,reject)=>{
        console.log("getBucketName(img_kind):"+getBucketName(img_kind)+" img_kind:"+img_kind)
        obsClient.putObject({
            Bucket : getBucketName(img_kind),
            Key : forkObjRet.token_x,
            SourceFile :path
        }, (err, result) => {
            if(err){
                console.error('Error-->' + err);
                putRet =  {ret:false,msg:'upload file to obs failed'}
                reject(putRet)
            }else{
                console.log('Status-->' + result.CommonMsg.Status);
                // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});
                putRet = {ret:true,msg:'success',filename:forkObjRet.token_x}
                resolve(putRet);
            }
        });
    });

    return putRet;
}

window.file_c.upload_img =upload_img;
async function upload_img(req, res) {
    let {user_id,s_id,img_kind} = str_filter.get_req_data(req)

    if(!img_kind)  return res.json({ret:false,msg:"img_kind error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let fmts = ["jpg", "gif", "jpeg", "png", "bmp", "jpe","webp"]

    let fileInfo =req.files[0]

    let fmtArray = fileInfo.originalname.split('.');
    let fmt = "jpg"
    if(fmtArray.length>=1)
        fmt = fmtArray[fmtArray.length-1];

    if(fileInfo.originalname.indexOf('aes256|')!=0){
        let fmtFlag = false;
        for(i=0;i<fmts.length;i++)
            if(fmts[i] == fmt)
            {
                fmtFlag = true;
                break;
            }
        if(!fmtFlag) return res.json({ret:false,msg:"图片格式{"+fmt+"}并非图片，请重新上传"})
    }
    if(fileInfo.size>30*1024*1024) return res.json({ret:false,msg:"非法图片：图片大小超过30M"})

    console.log("fileInfo:",fileInfo)//JSON.stringify(fileInfo))


    //映射对应的img-info
    let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'img'+img_kind})
    if(!forkObjRet || !forkObjRet.ret)
    {
        return res.json({ret:false,msg:"img file fork obj-id failed"})
    }

    //声明相关上传人等的信息。
    // let obj = {user_id,obj_id:forkObjRet.token_x}
    fileInfo.obj_id = forkObjRet.token_x
    fileInfo.user_id = user_id
    fileInfo.img_kind = img_kind
    fileInfo.save_time = parseInt(new Date().getTime()/1000)
    fileInfo.fmt = fmt;
    fileInfo.save_on_dnalink =  false//true
    fileInfo.hash = await str_filter.hashVal(fileInfo.path)
    ifileDb.addData({key:fileInfo.hash,data:fileInfo.path})
    await addKMMFileHashAndUser(fileInfo.hash,user_id)
    // if(!(await kmmDb.get('filehash-user:'+fileInfo.hash)))
    // {
    //     kmmDb.set('filehash-user:'+fileInfo.hash,user_id)
    // }
    // delete fileInfo.path
    fileInfo.path = fileInfo.hash

    let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
        opval:JSON.stringify(fileInfo),extra_data:user_id})
    if(!assertInfoRet || !assertInfoRet.ret)
    {
        return res.json({ret:false,msg:"img file assert obj-info failed"})
    }

    if(true)//fileInfo.save_on_dnalink){
    {
        // fileInfo.data = fileInfo.path
        // let path =fileInfo.path
        // delete fileInfo.path
        // let uploadRet = await rpc_api_util.uploadFile(fileInfo)
        let uploadRet = {ret:true}
        if(uploadRet && uploadRet.ret)
        {
            delete fileInfo.filename
            fileInfo.filename = forkObjRet.token_x
            fileInfo.ret =true;
            fileInfo.msg = 'success'
            delete uploadRet.path
            res.json(fileInfo)
        }
        else{
            console.log('uploadRet:'+JSON.stringify(uploadRet))
            res.json({ret:false,msg:'upload file to dnalink failed'})
        }
        
        // deleteFile(path)
    }
    //console.log("getBucketName(img_kind):"+getBucketName(img_kind)+" img_kind:"+img_kind)
    else
    obsClient.putObject({
        Bucket : getBucketName(img_kind),
        Key : forkObjRet.token_x,
        SourceFile :fileInfo.path
    }, (err, result) => {
        if(err){
            console.error('Error-->' + err);

            res.json({ret:false,msg:'upload file to obs failed'})
        }else{
            console.log('Status-->' + result.CommonMsg.Status);
            // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});

            fs.unlink(fileInfo.path ,function (err) {
                if (err) {
                    throw err;
                }
                // console.log('文件:' + fileInfo.path + '删除失败！');
            })

            delete fileInfo.destination;
            delete fileInfo.path;
            res.json({ret:true,msg:'success',filename:forkObjRet.token_x,file_info:fileInfo})
        }
    });
}
const qr_image ={}// require("qr-image")
async function qrcodeDraw(data,path){
    const temp_qrcode = qr_image.image(data,{type:'png',ec_level: 'Q'})
    let writeFlag = false;
    try{
        writeFlag = await new Promise((resolve,reject)=>{
            temp_qrcode.pipe(require('fs').createWriteStream(path).on('finish', function() {
                console.log('write finished')
                resolve(true)
            }))
        });
    }catch(ex)
    {
        return false;
    }

    return writeFlag
}
/**
 * 资源的访问权限控制。
 * @type {download_img}
 */
window.file_c.download_img =download_img;
async function download_img(req, res) {
    let {user_id,s_id,filename,img_kind,img_p,qrcode} = str_filter.get_req_data(req)

    if(qrcode=='yes')
    {
        let data = filename
        let filepath = ll_config.file_temp+'qrcode_'+Math.random()+'.png';
        let writeFlag = await qrcodeDraw(data,filepath);
        if(writeFlag){
            let buffer = await file_util.readFile(filepath)
            if(buffer)
            {
                res.json({ret:true,msg:'success',data:buffer.toString('base64')})
                deleteFile(filepath)
                return 
            }
        }
        res.json({ret:false,msg:'create qrcode image failed'})
        return 
    }

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!img_kind) return res.json({ret:false,msg:'img_kind is empty'})
    let fileInfo = null;
    let assertInfoRet = await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
    assertInfoRet = (!assertInfoRet || !assertInfoRet.ret)  ? await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1}) :assertInfoRet
    if (!assertInfoRet || !assertInfoRet.ret) {
        return res.json({ret: false, msg: "query img assert obj-info failed"})
    }

    let imgInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    fileInfo = imgInfo

    //判断img的权限。
    if(img_kind=='img') {
        let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
        if (!str) return res.json({ret: false, msg: "session error"})

        if(!manager_c.isManagerUid(user_id) ){
            if(filename.indexOf('obj_') ==0) {
                if (img_kind != imgInfo.img_kind)
                    return res.json({ret: false, msg: "img_kind unmatch"})

                if (user_id != imgInfo.user_id)
                    return res.json({ret: false, msg: "no permission view the img"})
            }
        }
        //有管理员权限直接可以访问
    }else if(img_kind=='open')
    {
        //可以公开读写，不需要本人授权。
    }

    let ImageProcess = null;
    let len = img_p&& img_p.indexOf('min')==0 ? img_p.split('min')[1] :50;
    len = img_p == 'big' ? -1:len;
    console.log('len:'+len)
    if(!len || len*1 !=len) return res.json({ret: false, msg: "img_p error"})
    if(img_p!='big') {
        ImageProcess = 'image/resize,m_lfit,h_'+len+',w_'+len
    }else{
        ImageProcess = null;
    }
    // if(!img_p|| img_p=='min')
    // {
    //     ImageProcess = 'image/resize,m_lfit,h_100,w_100'
    // }else if( img_p=='min150')
    // {
    //     ImageProcess = 'image/resize,m_lfit,h_150,w_150'
    // }
    //res.header("Content-Type", "image/png")
    //res.setHeader("Set-Cookie", ['name=' + filename,'Max-Age='+120000]);
    if(res.file)
    {
        let buffer = null
        if(true)//fileInfo.save_on_dnalink)
        {
            let data = await ifileDb.getDataByKey(fileInfo.hash)//rpc_api_util.downloadFile(fileInfo) 
            console.log('res.sreamByte is not null, typeof it:'+(typeof res.streamByte ))
            if(res.streamByte)
            {
                if(data && data.data &&data.data.length>0)
                {
                    if(typeof Buffer == 'undefined'){
                        let myBlob = new Blob([data.data], { type:fileInfo.mimetype });
                        var base64 = await new Promise((res)=>{
                            var reader = new FileReader();
                            reader.onload = function (e) {
                                res(e.target.result);
                            }
                            reader.readAsDataURL(myBlob);
                        })
                        base64 = base64.split('base64,')[1]
                    }
                    else{
                        base64 = data.data.toString('base64')
                    }
                    // var myUrl = URL.createObjectURL(myBlob)
                    // let base64 = window.btoa(myUrl)//String.fromCharCode(...data.data))//new Uint8Array(data.data)))
                    res.json({ret:true,msg:'success',fileInfo,data:base64})//data.data.toString('base64')})
                    // let file = data.data
                    // let chunkSize = 150*1024
                    // let max_pos = Math.floor((file.length+chunkSize-1)/chunkSize)
                    // for(let i=0;i<max_pos;i++)
                    // {
                    //     //(rdata,pos,max_pos,fileInfo)
                    //     res.streamByte(file.slice(i*chunkSize,i*chunkSize+chunkSize),i,max_pos,fileInfo)
                    // }
                    delete data.data
                }else{
                    res.json(data?data:{ret:false,msg:'get img from dnalink-engine failed'})
                }
            }
            else
                console.log('res.streamByte function not fund')
            // await new Promise((resolve)=>{
            //     let downKey = Math.random()+"."+fileInfo.fmt
            //     let saveFilePath = config.file_temp+downKey;
            //     let stream = require('fs').createWriteStream(saveFilePath)
            //     stream.on('close',function(){
            //         saveFlag = true
            //         resolve(true)
            //     })
            //     stream.write(data.data)
            //     stream.end()
            // })
        }
        else
        obsClient.getObject({
            Bucket : getBucketName(img_kind),
            Key : filename,
            SaveAsStream : true,
            ImageProcess //:'image/resize,m_lfit,w_150,h_150/rotate,0' //'image/resize,m_lfit,h_150,w150'
        }, (err, result) => {
            if(err){
                console.error('Error-->' + err);
                if(!filename) return res.json({ret:false,msg:'filename unexists'})
            }else{
                console.log('Status-->' + result.CommonMsg.Status);
                if(result.CommonMsg.Status==404) return res.json({ret:false,msg:'filename unexists'})
                if(result.CommonMsg.Status < 300 && result.InterfaceResult){
                    // 读取对象内容
                    console.log('Object Content:\n');
                    result.InterfaceResult.Content.on('data', (data) => {
                        // console.log(data.toString());
                        //res.write(data)
                        buffer = !buffer ? data: Buffer.concat([buffer,data])
                    });
                    result.InterfaceResult.Content.on('end', (data) => {
                        // console.log(data.toString());
                        res.json({ret:true,msg:true,fileInfo,data:buffer.toString('base64')}) //使用json返回即可，不用二进制。
                        res.end()
                    });
                }
            }
        });
    }else{
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'image/png',
            'ETag': "666666",
            'Cache-Control': 'max-age=31536000, public',
            'Expires': 'Mon, 07 Sep 2026 09:32:27 GMT'
        })
        obsClient.getObject({
            Bucket : getBucketName(img_kind),
            Key : filename,
            SaveAsStream : true,
            ImageProcess //:'image/resize,m_lfit,w_150,h_150/rotate,0' //'image/resize,m_lfit,h_150,w150'
        }, (err, result) => {
            if(err){
                console.error('Error-->' + err);
                if(!filename) return res.json({ret:false,msg:'filename unexists'})
            }else{
                console.log('Status-->' + result.CommonMsg.Status);
                if(result.CommonMsg.Status==404) return res.json({ret:false,msg:'filename unexists'})
                if(result.CommonMsg.Status < 300 && result.InterfaceResult){
                    // 读取对象内容
                    console.log('Object Content:\n');
                    result.InterfaceResult.Content.on('data', (data) => {
                        // console.log(data.toString());
                        res.write(data)
                    });
                    result.InterfaceResult.Content.on('end', (data) => {
                        // console.log(data.toString());
                        res.end()
                    });
                }
            }
        });
    }
}
/**
 * 获得文件的预览图并且上传（用于视频方面）
 * @param {} filepath 
 * @param {*} key 
 */
async function get_file_preview_img(filepath,key) {
    let dstFilePath = ll_config.file_temp+key+'.jpg'
    let commands = "/data/ffmpeg-4.2.2-i686-static/ffmpeg -i "+filepath+" -ss 1 -y -f  image2   -vframes 1 "+dstFilePath
    var exec = require('child_process').exec;
    let flag = true;
    await new Promise((resolve)=>{//,reject)=>{
        exec(commands,function(err,stdout,stderr){
            console.log('get_file_preview_img-exec-err:'+err+" stderr:"+stderr)
            if(err) {
                console.log('get_file_preview_img-exe stderr:'+stderr);
                flag = false;
                //reject( "failed")
                resolve('failed')
            } else {
                console.log('get_file_preview_img-exec stdout:'+stdout);
                // if(stdout.indexOf('Error: ENOENT:')>=0)
                // {
                //     flag = false;
                //     reject( "failed")
                //     return ;
                // }
                resolve("success")
            }
        });
    });
    console.log('get_file_preview_img----------flag:'+flag)

    if(flag)
    {
        let uploadRet = await upload_static_file(dstFilePath)
        if(!(uploadRet && uploadRet.ret) ) uploadRet = await upload_static_file(dstFilePath) 

        console.log('uploadRet:'+JSON.stringify(uploadRet))

        //删除该预览图。
        fs.unlink(dstFilePath ,function (err) {
            if (err) {
                console.log(err)
            }
        })

        if((uploadRet && uploadRet.ret) ) return uploadRet;
    }
    return {ret:false,msg:'upload preview-img failed'}
}
/**
 * 查询得到file_info
 */
window.file_c.query_file_info =query_file_info;
async function query_file_info(req, res) 
{
    let {user_id,s_id,filename} = str_filter.get_req_data(req)
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert');
    if(!fileInfo )return res.json({ret:false,msg:'file-info is empty'})
    fileInfo.ret = true 
    fileInfo.msg = 'success'
    res.json(fileInfo)
}
async function addKMMFileHashAndUser(hash,user_id)
{
    if(!hash || !user_id) return ''
    let oldStr = await kmmDb.get('filehash-user:'+hash)
    let newStr = !oldStr ? user_id :((''+oldStr).indexOf(user_id)>=0 ? oldStr: ''+oldStr+user_id )
    console.log('addKMMFileHashAndUser:oldStr:',oldStr,'newStr:',newStr,oldStr == newStr,'filehash:'+hash)
    if(newStr.length>'user_'.length+16)
    {
        console.log('newStr-is-ok:',newStr,oldStr)
    }
    kmmDb.set('filehash-user:'+hash,newStr)
    return newStr
}
async function deleteKMMFileByHashAndUser(hash,user_id)
{
    if(!hash || !user_id) return false
    let oldStr = await kmmDb.get('filehash-user:'+hash)
    let newStr = !oldStr ? '' : (''+oldStr).replace(user_id,'')
    kmmDb.set('filehash-user:'+hash,newStr)
    console.log('deleteKMMFileByHashAndUser:oldStr:',oldStr,'newStr:',newStr,oldStr == newStr,'filehash:'+hash)
    if(!oldStr || !newStr)
    {
        ifileDb.deleteDataByKey(hash) //删除掉明文的文件
        console.log('filehash-user:'+hash+'-user-id-ok, delete file now! user_id:',user_id)
        return true
    }
    return false
}
/**
 * 修改file_info
 */
window.file_c.add_file_lock =add_file_lock;
async function add_file_lock(req, res) 
{
    let {user_id,s_id,filename,vip_level,chatids,xmsgids,forkids} = str_filter.get_req_data(req)
    // if(!lock_type || ['vip','chatid','xmsgid','forkid'].indexOf(lock_id)<0) return res.json({ret:false,msg:'param-lock_type is error'})
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert');
    if(!fileInfo ) return res.json({ret:false,msg:'file-info is empty'})

    let is_console_user = await new Promise(async (resolve)=>{
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

    //如是管理员和资源拥有者，直接返回
    if(!is_console_user && fileInfo.user_id != user_id)
        return res.json({ret:false,msg:'no pm to modify file-lock'})

    let clear_lock = !vip_level && !chatids && !xmsgids && !forkids
    //是否加密文件名，与chatid中保持一致？
    let need_update_lock = false
    let oldHash = fileInfo.hash
    if(!clear_lock && fileInfo.file_kind!='aes256')
    {
        fileInfo.file_kind = 'aes256'//先行加密
        let keyStr = sign_util.getWeb3keyAes256()
        fileInfo.file_lock_hash =await sign_util.hashVal(keyStr) //web3key-hash

        // console.log('keyStr',keyStr,keyStr.length)
        console.log('fileInfo.file_lock_hash:'+fileInfo.file_lock_hash)
        let {iv,aeskey} = sign_util.decodeWeb3keyAes256Str(keyStr)

        // console.log('import-key:',await importSecretKey(aeskey))
        let data = await ifileDb.getDataByKey(fileInfo.hash)
        if(!data || !data.data) return res.json({ret:false,msg:'file-data is empty'})
        let en1 = await sign_util.encryptMessage(typeof Buffer=='undefined' ? await sign_util.importSecretKey(aeskey) : aeskey,iv,data.data,false)
        console.log('en1:',en1.length,new Uint8Array(en1))//,btoa((new Uint8Array(en1))))
        // let text = await decryptMessage(await importSecretKey(aeskey),iv,en1)
        // console.log('text:',text)
        fileInfo.hash = await str_filter.hashVal(en1)
        ifileDb.addData({key:fileInfo.hash,data:en1})
        await addKMMFileHashAndUser(fileInfo.hash,user_id)
        // if(!(await kmmDb.get('filehash-user:'+fileInfo.hash)))
        // {
        //     kmmDb.set('filehash-user:'+fileInfo.hash,user_id)
        // }
        fileInfo.size = en1.length
        //保存密钥
        if(typeof kmmDb== 'undefined') return res.json({ret:false,msg:'kmmDb is empty'})
        await kmmDb.set('web3key:'+fileInfo.file_lock_hash,keyStr)
        let keyStrTmp = await kmmDb.get('web3key:'+fileInfo.file_lock_hash)
        if(keyStrTmp!=keyStr) return res.json({ret:false,msg:'web3key save to kmmDb failed!'})
        need_update_lock = true
    }
    if(clear_lock  && fileInfo.file_kind =='aes256')
    {
        fileInfo.file_kind = 'open'
        let keyStr = await kmmDb.get('web3key:'+fileInfo.file_lock_hash)
        console.log('key-str:'+keyStr)
        let {iv,aeskey} = sign_util.decodeWeb3keyAes256Str(keyStr)
        let data = await ifileDb.getDataByKey(fileInfo.hash)
        if(!data || !data.data ) return res.json({ret:false,msg:'load file-data failed'})
        let newData = await sign_util.decryptMessage(typeof Buffer=='undefined' ? await sign_util.importSecretKey(aeskey) : aeskey,iv,data.data,false)
        fileInfo.hash = await str_filter.hashVal(newData)
        fileInfo.size = newData.length
        ifileDb.addData({key:fileInfo.hash,data:newData})
        await addKMMFileHashAndUser(fileInfo.hash,user_id)
        // if(!(await kmmDb.get('filehash-user:'+fileInfo.hash)))
        // {
        //     kmmDb.set('filehash-user:'+fileInfo.hash,user_id)
        // }
        // need_update_lock = true
    }

    //更新权限列表
    fileInfo.xmsgids = xmsgids
    fileInfo.chatids = chatids
    fileInfo.forkids = forkids
    fileInfo.vip_level = vip_level

    //更新fileInfo
    let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
        opval:JSON.stringify(fileInfo),extra_data:user_id})
    if(!assertInfoRet || !assertInfoRet.ret)
    {
        return res.json({ret:false,msg:"file assert obj-info failed"})
    }

    //删除掉明文的文件
    if(need_update_lock)
    {
        if(!clear_lock)
        {
            //仅相同时，才删除原文件
            deleteKMMFileByHashAndUser(oldHash,user_id)
            // if((await kmmDb.get('filehash-user:'+oldHash)) == user_id)
            // {
            //     ifileDb.deleteDataByKey(oldHash) //删除掉明文的文件
            //     console.log('filehash-user:'+oldHash+'-user-id-ok, delete file now! user_id:',user_id)
            // }
        }
    }

    res.json({ret:true,msg:'success',fileInfo})
}
/**
 * 判断fileInfo的权限，是否拥有，如拥有权限，则返回加密的aes256密钥
 */
window.file_c.query_file_lock =query_file_lock;
async function query_file_lock(req, res) 
{
    let {user_id,s_id,filename} = str_filter.get_req_data(req)
    // if(!lock_type || ['vip','chatid','xmsgid','forkid'].indexOf(lock_id)<0) return res.json({ret:false,msg:'param-lock_type is error'})
    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert');
    console.log('query_file_lock-fileInfo:',fileInfo)
    if(!fileInfo ) return res.json({ret:false,msg:'file-info is empty'})
    
    if(fileInfo.file_kind !='aes256' || !fileInfo.file_lock_hash) return res.json({ret:false,msg:'file_lock unexist'})
    let web3key = await kmmDb.get('web3key:'+fileInfo.file_lock_hash)
    let web3hash= fileInfo.file_lock_hash
    console.log('query_file_lock-web3key:',web3key,web3hash)

    //判断管理员权限和资源拥有者权限
    let is_console_user = await new Promise(async (resolve)=>{
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
    console.log('query_file_lock-is_console_user:',is_console_user,fileInfo.user_id == user_id)
    //如是管理员和资源拥有者，直接返回
    if(is_console_user || fileInfo.user_id == user_id)
        return res.json({ret:true,msg:'success',web3key,web3hash})

    //判断vip_level权限
    if(fileInfo.vip_level >0 )
    {
        let vipInfo = await rpc_api_util.s_query_token_info(VIP_API_BASE,VIP_TOKEN_NAME+'_'+user_id.split('_')[1],'assert');
        let now_time = parseInt(new Date().getTime()/1000);
        vipInfo = !vipInfo ? {vip_level:NORMAL_VIP_LEVEL,send_vip_level:NORMAL_VIP_LEVEL,invite_vip_level:NORMAL_VIP_LEVEL,vip_timeout:0}:vipInfo;
        if(now_time< vipInfo.vip_timeout && vipInfo.vip_level >= fileInfo.vip_level)
            return res.json({ret:true,msg:'success',web3key,web3hash})
    }
    //判断chatids权限
    if(fileInfo.chatids)
    {
        let chatids = fileInfo.chatids.split(';')
        //依次判断权限
        for(let i=0;i<chatids.length;i++)
        {
            req.params.chatid = chatids[i]
            if(!req.params.chatid) continue
            let nextFlag = await new Promise(async (resolve)=>{
                let oldResJsonFunc = res.json
                //hack the res.json
                res.json = function(data){
                    console.log('file_c.js-vip-filter-call-oldResJsonFunc-res-json:',data)
                    // oldResJsonFunc(data)//权判断权限，不返回
                    res.json = oldResJsonFunc
                    resolve(false)
                }
                // vip_filter_manager(req,res,function(){
                    vip_filter(req,res,function(){
                        res.json = oldResJsonFunc
                        resolve(true)
                    })
                // })
            })
            if(nextFlag)
            {
                console.log('file_c.js-chatid:'+req.params.chatid,'pm is ok',fileInfo)
                return res.json({ret:true,msg:'success',web3key,web3hash})
            }
        }
    }
    //判断forkids权限
    let userInfo =  req.userInfo ? req.userInfo :  await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert');
    if(!userInfo)
    {
        let result = {ret:false,msg:'user-info is empty'}
        console.log('query-file-lock-result:'+JSON.stringify(result))
        return res.json(result)
    }
    if(fileInfo.forkids)
    {
        let forkids_visit_flag = false
        if(userInfo.dtns_user_id)
        {
            let forkidsArray = fileInfo.forkids.split(';')
            let reqs = []
            for(let i=0;i<forkidsArray.length;i++){
                reqs.push(rpc_query(DTNS_API_BASE+'/chain/map/value',
                {token:DTNS_TOKEN_ROOT,map_key:forkidsArray[i]}))
            }
            let rets = await Promise.all(reqs)
            console.log('forkid-map-key-value-query-rets:',rets)
            //web3InfoRet && web3InfoRet.map_value
            let reqs2 = []
            for(let i=0;i<rets.length;i++)
            {
                reqs2.push(rets[i] && rets[i].ret && rets[i].map_value ? 
                        rpc_api_util.s_check_token_list_related(DTNS_API_BASE,userInfo.dtns_user_id,rets[i].map_value,'relf'):false)
            }
            let rets2 = await Promise.all(reqs2)
            console.log('forkids-check-relations-rets2:',rets2)
            for(let i=0;i<rets2.length;i++)
            {
                if(rets2[i]){
                    forkids_visit_flag = true
                    break;
                }
            }
        }
        if(forkids_visit_flag)
        {
            console.log('file_c.js-forkids-pm is ok',fileInfo)
            return res.json({ret:true,msg:'success',web3key,web3hash})
        }
    }
    //判断xmsgids权限
    if(fileInfo.xmsgids)
    {
        let xmsgids_visit_flag = false

        let xmsgidsArray = fileInfo.xmsgids.split(';')
        let reqs = []

        let msg_user_id = USER_TOKEN_NAME!=MSG_TOKEN_NAME ?MSG_TOKEN_NAME+'_'+user_id.split('_')[1]:user_id;


        for(let i=0;i<xmsgidsArray.length;i++){
            reqs.push(rpc_api_util.s_check_token_list_related(MSG_API_BASE,xmsgidsArray[i],msg_user_id,'relb'))
        }
        let rets = await Promise.all(reqs)
        console.log('xmsgids--query-rets:',rets)
        for(let i=0;i<rets.length;i++)
        {
            if(rets[i]){
                xmsgids_visit_flag = true
                break;
            }
        }
        if(xmsgids_visit_flag)
        {
            console.log('file_c.js-xmsgsid-pm is ok',fileInfo)
            return res.json({ret:true,msg:'success',web3key,web3hash})
        }
    }
    return res.json({ret:false,msg:'no pm to get file-lock'})
}

window.file_c.upload_file_fast =upload_file_fast;
async function upload_file_fast(req, res) {
    let {user_id,s_id,hash,size,file_kind} = str_filter.get_req_data(req)
    file_kind = file_kind ? file_kind :'open'

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let data = await ifileDb.getDataByKey(hash)
    if(!data ||!data.data) return res.json({ret:false,msg:'hash-file unexists!'})
    if(data.data.length != size) return res.json({ret:false,msg:'file-size unmatch!'})

    // let fmts = ["zip","rar"]

    let fileInfo =str_filter.get_req_data(req)

    // let fmtArray = fileInfo.originalname.split('.');
    // let fmt = "jpg"
    // if(fmtArray.length>=1)
    //     fmt = fmtArray[fmtArray.length-1];

    // let fmtFlag = true//不判断格式   //false;
    // for(i=0;!fmtFlag && i<fmts.length;i++)
    //     if(fmts[i] == fmt)
    //     {
    //         fmtFlag = true;
    //         break;
    //     }
    // if(!fmtFlag) return res.json({ret:false,msg:"文件格式{"+fmt+"}并非合规文件格式，请重新上传"})
    // if(fileInfo.size>100*1024*1024) return res.json({ret:false,msg:"非法文件大小：文件大小超过100M"})

    console.log("fast-upload-fileInfo:",fileInfo)

    //映射对应的img-info
    let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'file'+file_kind})
    if(!forkObjRet || !forkObjRet.ret)
    {
        return res.json({ret:false,msg:"file fork obj-id failed"})
    }

    //声明相关上传人等的信息。
    // let obj = {user_id,obj_id:forkObjRet.token_x}
    

    fileInfo.obj_id = forkObjRet.token_x
    fileInfo.user_id = user_id
    delete fileInfo.s_id
    fileInfo.file_kind = file_kind
    fileInfo.save_time = parseInt(new Date().getTime()/1000)
    fileInfo.save_on_dnalink = false//true //2022-12-19默认保存在dnalink.engine中
    // fileInfo.hash = //await str_filter.hashVal(fileInfo.path)
    await addKMMFileHashAndUser(fileInfo.hash,user_id)
    // if(!(await kmmDb.get('filehash-user:'+fileInfo.hash)))
    // {
    //     kmmDb.set('filehash-user:'+fileInfo.hash,user_id)
    // }
    fileInfo.path = fileInfo.hash

    //首图
    // let uploadPreviewImgRet = fmt  !='mp3' ?  await get_file_preview_img(fileInfo.path,fileInfo.obj_id) :null
    fileInfo.preview_img =null// uploadPreviewImgRet && uploadPreviewImgRet.ret ? uploadPreviewImgRet.filename:null;

    //flv转码  2020-5-20 去掉（主要使用mp4进行播放）
    // let covertto_flv_size = await covertoFlv(fileInfo.path,forkObjRet.token_x,file_kind);
    // fileInfo.covertto_flv = covertto_flv_size>0?true:false;
    // fileInfo.covertto_flv_size = covertto_flv_size;

    let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
        opval:JSON.stringify(fileInfo),extra_data:user_id})
    if(!assertInfoRet || !assertInfoRet.ret)
    {
        return res.json({ret:false,msg:"file assert obj-info failed"})
    }

    let uploadRet = {ret:true}//await rpc_api_util.uploadFile(fileInfo)
    if(uploadRet && uploadRet.ret)
    {
        delete fileInfo.filename
        delete fileInfo.s_id
        fileInfo.filename = forkObjRet.token_x
        fileInfo.ret =true;
        fileInfo.msg = 'success'
        delete uploadRet.path
        res.json(fileInfo)
    }
    else{
        console.log('uploadRet:'+JSON.stringify(uploadRet))
        res.json({ret:false,msg:'assert file-info to dnalink failed'})
    }
}


/**
 * 上传文件等
 */
window.file_c.upload_file =upload_file;
async function upload_file(req, res) {
    let {user_id,s_id,file_kind} = str_filter.get_req_data(req)

    if(!file_kind)  return res.json({ret:false,msg:"file_kind error"})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    // let fmts = ["zip","rar"]

    let fileInfo =req.files[0]

    // let fmtArray = fileInfo.originalname.split('.');
    // let fmt = "jpg"
    // if(fmtArray.length>=1)
    //     fmt = fmtArray[fmtArray.length-1];

    // let fmtFlag = true//不判断格式   //false;
    // for(i=0;!fmtFlag && i<fmts.length;i++)
    //     if(fmts[i] == fmt)
    //     {
    //         fmtFlag = true;
    //         break;
    //     }
    // if(!fmtFlag) return res.json({ret:false,msg:"文件格式{"+fmt+"}并非合规文件格式，请重新上传"})
    // if(fileInfo.size>100*1024*1024) return res.json({ret:false,msg:"非法文件大小：文件大小超过100M"})

    console.log("fileInfo:",fileInfo)

    //映射对应的img-info
    let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'file'+file_kind})
    if(!forkObjRet || !forkObjRet.ret)
    {
        return res.json({ret:false,msg:"file fork obj-id failed"})
    }

    //声明相关上传人等的信息。
    // let obj = {user_id,obj_id:forkObjRet.token_x}
    

    fileInfo.obj_id = forkObjRet.token_x
    fileInfo.user_id = user_id
    delete fileInfo.s_id
    fileInfo.file_kind = file_kind
    fileInfo.save_time = parseInt(new Date().getTime()/1000)
    fileInfo.save_on_dnalink = false//true //2022-12-19默认保存在dnalink.engine中
    fileInfo.hash = await str_filter.hashVal(fileInfo.path)
    ifileDb.addData({key:fileInfo.hash,data:fileInfo.path})
    await addKMMFileHashAndUser(fileInfo.hash,user_id)
    // if(!(await kmmDb.get('filehash-user:'+fileInfo.hash)))
    // {
    //     kmmDb.set('filehash-user:'+fileInfo.hash,user_id)
    // }
    fileInfo.path = fileInfo.hash

    //首图
    // let uploadPreviewImgRet = fmt  !='mp3' ?  await get_file_preview_img(fileInfo.path,fileInfo.obj_id) :null
    fileInfo.preview_img =null// uploadPreviewImgRet && uploadPreviewImgRet.ret ? uploadPreviewImgRet.filename:null;

    //flv转码  2020-5-20 去掉（主要使用mp4进行播放）
    // let covertto_flv_size = await covertoFlv(fileInfo.path,forkObjRet.token_x,file_kind);
    // fileInfo.covertto_flv = covertto_flv_size>0?true:false;
    // fileInfo.covertto_flv_size = covertto_flv_size;

    let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
        opval:JSON.stringify(fileInfo),extra_data:user_id})
    if(!assertInfoRet || !assertInfoRet.ret)
    {
        return res.json({ret:false,msg:"file assert obj-info failed"})
    }

    // fileInfo.data = fileInfo.path
    // let path =fileInfo.path
    // delete fileInfo.path
    let uploadRet = {ret:true}//await rpc_api_util.uploadFile(fileInfo)
    if(uploadRet && uploadRet.ret)
    {
        delete fileInfo.filename
        fileInfo.filename = forkObjRet.token_x
        fileInfo.ret =true;
        fileInfo.msg = 'success'
        delete uploadRet.path
        res.json(fileInfo)
    }
    else{
        console.log('uploadRet:'+JSON.stringify(uploadRet))
        res.json({ret:false,msg:'upload file to dnalink failed'})
    }
    
    // deleteFile(path)
    //以下不再保存在云服务器中。2022-12-19
    // console.log("getBucketName(file_kind):"+getBucketName(file_kind)+" file_kind:"+file_kind)
    // obsClient.putObject({
    //     Bucket : getBucketName(file_kind),
    //     Key : forkObjRet.token_x,
    //     SourceFile :fileInfo.path
    // }, (err, result) => {
    //     if(err){
    //         console.error('Error-->' + err);

    //         res.json({ret:false,msg:'upload file to obs failed'})
    //     }else{
    //         console.log('Status-->' + result.CommonMsg.Status);
    //         // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});

    //         // fs.unlink(fileInfo.path ,function (err) {
    //         //     if (err) {
    //         //         throw err;
    //         //     }
    //         //     // console.log('文件:' + fileInfo.path + '删除失败！');
    //         // })

    //         delete fileInfo.filename
    //         fileInfo.filename = forkObjRet.token_x
    //         fileInfo.ret =true;
    //         fileInfo.msg = 'success'
            
    //         res.json(fileInfo)
    //     }

    // })
}
/**
 * 转码生成flv，可以供苹果手机浏览器使用（安卓也可以的）
 * @param {}} filepath 
 * @param {*} key 
 * @param {*} file_kind 
 */
async function covertoFlv(filepath,key,file_kind)
{
    let dstFilePath = ll_config.file_temp+key+'.flv'
    let commands = "/data/ffmpeg-4.2.2-i686-static/ffmpeg -i "+filepath+" -c:v libx264 -crf 16 "+dstFilePath
    var exec = require('child_process').exec;
    let flag = true;
    await new Promise((resolve,reject)=>{
        exec(commands,function(err,stdout,stderr){
            console.log('startNode-err:'+err)
            if(err) {
                console.log('startNode exec stderr:'+stderr);
                flag = false;
                reject( "failed")
            } else {
                console.log('startNode exec stdout:'+stdout);
                resolve("success")
            }
        });
    }).then(function(data){
    }).catch(function(ex){});
    if(!flag)
    {
        return 0;
    }

    let uploadRet = 0;
    await new Promise((resolve,reject)=>{
        obsClient.putObject({
            Bucket : getBucketName(file_kind),
            Key : key+'.flv',
            SourceFile :dstFilePath
        }, (err, result)=>{
            if(err){
                console.error('Error-->' + err);

                res.json({ret:false,msg:'upload file to obs failed'})
                uploadRet = 0;
                reject(true)
            }else{
                console.log('Status-->' + result.CommonMsg.Status);
                // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});
                // uploadRet =  true;
                uploadRet = 1
                resolve(true)
            }
        });
    }).then(function(data){
    }).catch(function(ex){});

    if(uploadRet>0)
    {
        await new Promise((resolve,reject)=>{
            fs.stat(dstFilePath,function(error,stats){
                if(error){
                    reject(0)
                }else{
                    //文件大小
                    uploadRet=stats.size
                    resolve(stats.size);
                }
        })}).then(function(data){
        }).catch(function(ex){});

        fs.unlink(dstFilePath ,function (err) {
            if (err) {
                throw err;
            }
            // console.log('文件:' + fileInfo.path + '删除失败！');
        })
    }

    return uploadRet;
}
/**
 * 返回同步的文件（提供下载用户）二进制流方式。
 */
window.file_c.syncFile = syncFile
async function syncFile(req,res)
{
    let {hash,begin,len} = str_filter.get_req_data(req)
    if(!hash) return res.json({ret:false,msg:'sync file-hash is null'})
    
    let data = await ifileDb.getDataByKey(hash)//rpc_api_util.downloadFile(fileInfo) 
    console.log('res.sreamByte is not null, typeof it:'+(typeof res.streamByte ))
    if(res.streamByte)
    {
        if(data && data.data &&data.data.length>0)
        {
            // let file = data.data
            // let chunkSize = 150*1024
            // let max_pos = Math.floor((file.length+chunkSize-1)/chunkSize)
            // for(let i=0;i<max_pos;i++)
            // {
            //     //(rdata,pos,max_pos,fileInfo)
            //     res.streamByte(file.slice(i*chunkSize,i*chunkSize+chunkSize),i,max_pos,fileInfo)
            // }
            let objInfo = {size:data.data.length,hash:hash}
            console.log('syncFile-objInfo:',objInfo)
            let buffer = data.data
            if(!buffer || buffer.length <=0) return res.json({ret:false,msg:'query-file failed'})

            //统一使用二进制返回
            {
                let pkgSize = 150*1024;//150*1024;//30*1024//----------【注意】必须是3个字节的倍数的buffer才能toString('base64')，否则会出错。
                len = len >0 ? parseInt(len):0
                begin = len ? parseInt(begin):-1

                let pos = 0, max_pos = Math.floor( ((len ? ( begin+len<=objInfo.size?len:objInfo.size-begin):objInfo.size)+ pkgSize-1)/pkgSize),size =0;
                console.log('=file begin:'+begin+' len:'+len)
                if(len){
                    objInfo.begin=begin
                    objInfo.len = len
                }
                console.log('buffer.length:'+(buffer ? buffer.length:0))
                for(let i=pos;buffer&& i<max_pos;i++)
                {
                    let chunk =  buffer.slice(begin+i*pkgSize,begin+i*pkgSize+pkgSize)
                    await res.streamByte(chunk,i,max_pos,objInfo)
                }
            }
            delete data.data
        }else{
            res.json(data?data:{ret:false,msg:'download from dnalink-engine failed'})
        }
    }
    else
        res.json({ret:false,msg:'res.streambyte function is empty'})
}
/**
 * 更新文件尺寸
 * update_file-size
 */
window.file_c.update_file = update_file
async function update_file(req, res) {
    let {user_id,s_id,filename} = str_filter.get_req_data(req)
    if(!filename) return res.json({ret:false,msg:'filename is empty'})

    console.log('update_file-filename:',filename)
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str && !window.g_file_download_not_need_session_flag) return res.json({ret:false,msg:"session error"})

    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert');
    console.log('update_file-fileInfo:',fileInfo)
    if(!fileInfo )return res.json({ret:false,msg:'file-info is empty'})
    let data = await ifileDb.getDataByKey(fileInfo.hash)
    console.log('update_file-filedata:',data)
    if(data && data.data &&data.data.length>0 && fileInfo.size  != data.data.length)
    {
        fileInfo.size = data.data.length
        console.log('update_file-filesize:',data.data.length)
        let setObjInfoRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,filename,'assert',JSON.stringify(fileInfo),'update_file-size')
        if(!setObjInfoRet) return res.json({ret: false, msg: "update file-size failed"})
        return res.json({ret:true,msg:'success'})
    }
    return res.json({ret: false, msg: "no need to update file-size"})
}
/**
 * 下载文件。
 * @type {download_file}
 */
window.file_c.download_file =download_file;
async function download_file(req, res) {
    //当flv参数不为空时，读取的是flv文件
    let {user_id,s_id,filename,file_kind,flv,begin,len} = str_filter.get_req_data(req)

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!file_kind) return res.json({ret:false,msg:'file_kind is empty'})

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str && !window.g_file_download_not_need_session_flag) return res.json({ret:false,msg:"session error"})

    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert');
    if(!fileInfo )return res.json({ret:false,msg:'file-info is empty'})

    let chatid = fileInfo.chatid;
    if(chatid){//2023-6-2新增（头榜文件下载）
        // if(!chatid) return res.json({ret:false,msg:'chatid is error'})

        let chatInfo = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
        if(!chatInfo ) return res.json({ret:false,msg:'chat-info is empty'})

        let msg_user_id = MSG_TOKEN_NAME+'_'+user_id.split('_')[1]
        if(chatInfo.create_user_id!=user_id)//不是创建人
        {
            let joinRet = await rpc_api_util.s_check_token_list_related(MSG_API_BASE,msg_user_id,chatid,'relm');
            if(!joinRet) return res.json({ret:false,msg:'user unjoin chat'})
        }
    }

    // let is_range = req.headers["range"]

    let objInfo = fileInfo;
    let downKey = filename +(flv?'.flv':'')

    let saveFilePath = ll_config.file_temp+downKey;
    let saveFlag = false;

    fileInfo.begin = begin
    fileInfo.len = len
    console.log('file_c.download--FileInfo:'+JSON.stringify(fileInfo))

    if(true)//fileInfo.save_on_dnalink){
    {
        let data = await ifileDb.getDataByKey(fileInfo.hash)//rpc_api_util.downloadFile(fileInfo) 
        console.log('res.sreamByte is not null, typeof it:'+(typeof res.streamByte ))
        if(res.streamByte)
        {
            if(data && data.data &&data.data.length>0)
            {
                // let file = data.data
                // let chunkSize = 150*1024
                // let max_pos = Math.floor((file.length+chunkSize-1)/chunkSize)
                // for(let i=0;i<max_pos;i++)
                // {
                //     //(rdata,pos,max_pos,fileInfo)
                //     res.streamByte(file.slice(i*chunkSize,i*chunkSize+chunkSize),i,max_pos,fileInfo)
                // }
                let buffer = data.data
                if(!buffer || buffer.length <=0) return res.json({ret:false,msg:'query-file failed'})

                //统一使用二进制返回
                {
                    let pkgSize = 150*1024;//150*1024;//30*1024//----------【注意】必须是3个字节的倍数的buffer才能toString('base64')，否则会出错。
                    len = len >0 ? parseInt(len):0
                    begin = len ? parseInt(begin):-1

                    let pos = 0, max_pos = Math.floor( ((len ? ( begin+len<=objInfo.size?len:objInfo.size-begin):objInfo.size)+ pkgSize-1)/pkgSize),size =0;
                    console.log('=file begin:'+begin+' len:'+len)
                    if(len){
                        objInfo.begin=begin
                        objInfo.len = len
                    }
                    console.log('buffer.length:'+(buffer ? buffer.length:0))
                    for(let i=pos;buffer&& i<max_pos;i++)
                    {
                        let chunk =  buffer.slice(begin+i*pkgSize,begin+i*pkgSize+pkgSize)
                        await res.streamByte(chunk,i,max_pos,objInfo)
                    }
                }
                delete data.data
            }else{
                res.json(data?data:{ret:false,msg:'download from dnalink-engine failed'})
            }
        }
        else
        await new Promise((resolve)=>{
            let stream = require('fs').createWriteStream(saveFilePath)
            stream.on('close',function(){
                saveFlag = true
                resolve(true)
            })
            stream.write(data.data)
            stream.end()
        })
    }
    else
    await new Promise((resolve,reject)=>{
        obsClient.getObject({
            Bucket : getBucketName(file_kind),
            Key : downKey,
            SaveAsFile : saveFilePath
        }, (err, result) => {
                if(err){
                    console.error('Error-->' + err);
                    reject(err)
                }else{
                    console.log('Status-->' + result.CommonMsg.Status);
                    saveFlag = true;
                    resolve(result.CommonMsg.Status)
                }
        });
    }).then(function(data){
    }).catch(function(ex){});
    if(!saveFlag) return res.json({ret:false,msg:'file download failed'});

    fs.exists(saveFilePath, function(exists) {

        res.setHeader("Access-Control-Allow-Origin",'*');
        res.setHeader("ETag",'666666');
        res.setHeader("Cache-Control", "max-age=31536000, public");
        res.setHeader("Expires",'Mon, 07 Sep 2036 09:32:27 GMT')
        if(!flv) res.setHeader("Content-Length", objInfo.size);
        else res.setHeader("Content-Length", objInfo.covertto_flv_size);
        res.setHeader("Content-Type", objInfo.mimetype);
        res.setHeader("Accept-Ranges", "bytes");

        try{
            res.setHeader("content-disposition", "attachment;filename=" + objInfo.originalname+(flv?'.flv':''));
        }catch(ex){
            console.log('ex:'+ex)
        }

        if (!exists) {
            res.status(404)
            res.setHeader('Content-Type', 'text/plain')
            res.write("This request URL " + pathname + "was not found on this server");

            res.end();
        } else {
            res.setHeader("Content-Type",objInfo.mimetype);
            var stats = fs.statSync(saveFilePath);
                if (req.headers["range"]) {
                    console.log(req.headers["range"])
                    var range = parseRange(req.headers["range"], stats.size);
                    console.log(range)
                    if (range) {
                        res.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + stats.size);
                        res.setHeader("Content-Length", (range.end - range.start + 1));
                        var stream = fs.createReadStream(saveFilePath, {
                            "start": range.start,
                            "end": range.end
                        });

                        res.writeHead('206', "Partial Content");
                        stream.pipe(res);
                        stream.on('end',function (chunk) {
                            stream.close();
                            deleteFile(saveFilePath)
                        })
                        // 监听错误
                        stream.on('error',function (err) {
                            console.log(err);
                            deleteFile(saveFilePath)
                        })
                        // compressHandle(raw, 206, "Partial Content");
                    } else {
                        res.removeHeader("Content-Length");
                        res.writeHead(416, "Request Range Not Satisfiable");
                        res.end();

                        deleteFile(saveFilePath)
                    }
                } else {
                    var stream = fs.createReadStream(saveFilePath);
                    res.writeHead('200', "Partial Content");
                    stream.pipe(res);

                    stream.on('end',function (chunk) {
                        stream.close();
                        deleteFile(saveFilePath)
                    })
                    // 监听错误
                    stream.on('error',function (err) {
                        console.log(err);
                        deleteFile(saveFilePath)
                    })
                    // compressHandle(raw, 200, "Ok");
                }

        }
    })

    // obsClient.getObject({
    //     Bucket : getBucketName(file_kind),
    //     Key : downKey,  //当flv参数不为空时，读取的是flv文件
    //     SaveAsStream : true
    // }, (err, result) => {
    //     if(err){
    //         console.error('Error-->' + err);
    //         if(!filename) return res.json({ret:false,msg:'filename unexists'})
    //     }else{
    //         console.log('Status-->' + result.CommonMsg.Status);
    //         if(result.CommonMsg.Status==404) return res.json({ret:false,msg:'filename unexists-404 ， key:'+downKey})

    //         if(objInfo.originalname) {
    //             //res.setHeader("Cache-Control", "max-age=31536000, must-revalidate");
    //             res.setHeader("Access-Control-Allow-Origin",'*');
    //             res.setHeader("ETag",'666666');
    //             res.setHeader("Cache-Control", "max-age=31536000, public");
    //             res.setHeader("Expires",'Mon, 07 Sep 2036 09:32:27 GMT')
    //             if(!flv) res.setHeader("Content-Length", objInfo.size);
    //             else res.setHeader("Content-Length", objInfo.covertto_flv_size);
    //             res.setHeader("Content-Type", objInfo.mimetype);
    //             res.setHeader("Accept-Ranges", "bytes");
    //             console.log('objInfo.originalname:'+objInfo.originalname+(flv?'.flv':''))
    //             try{
    //                 res.setHeader("content-disposition", "attachment;filename=" + objInfo.originalname+(flv?'.flv':''));
    //             }catch(ex){
    //                 console.log('ex:'+ex)
    //             }
    //         }
    //         if(result.CommonMsg.Status < 300 && result.InterfaceResult){
    //             // 读取对象内容
    //             console.log('Object Content:\n');
    //             result.InterfaceResult.Content.on('data', (data) => {
    //                 // console.log(data.toString());
    //                 res.write(data)
    //             });
    //             result.InterfaceResult.Content.on('end', (data) => {
    //                 // console.log(data.toString());
    //                 res.end()
    //             });
    //         }else{
    //             res.json({ret:false,msg:'file download failed',status:result.CommonMsg.Status})
    //         }
    //     }
    // });
}

deleteFile = function (path) {
    fs.unlink(path ,function (err) {
        if (err) {
            throw err;
        }
        console.log('文件:' + path + '删除失败！');
    })
}

parseRange = function (str, size) {
    if (str.indexOf(",") != -1) {
        return;
    }
    if(str.indexOf("=") != -1){
        var pos = str.indexOf("=")
        var str = str.substr(6, str.length)
    }
    var range = str.split("-");
    console.log(range)
    var start = parseInt(range[0], 10)
    var end = parseInt(range[1], 10) || size - 1
    console.log(start)
    console.log(end)

    // Case: -100
    if (isNaN(start)) {
        start = size - end;
        end = size - 1;
        // Case: 100-
    } else if (isNaN(end)) {
        end = size - 1;
    }

    // Invalid
    if (isNaN(start) || isNaN(end) || start > end || end > size) {
        return;
    }
    return {
        start: start,
        end: end
    };
};
