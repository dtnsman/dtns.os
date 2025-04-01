/**
 * 处理文件上传
 * by lauo.li 2019-4-4
 */
var urlLib = require('url');
var ObsClient = require('../libs/libobs/obs');
var obsClient = new ObsClient({
    access_key_id: '*',
    secret_access_key: '*',
    server : '*'
});
const OBS_PAPER_IMAGE_BUCKET = 'paper-image'
const OBS_OPEN_IMAGE_BUCKET = 'open-img'
const OBS_SRC_FILE_BUCKET = 'src-file'
const OBS_FILE_BUCKET = 'groupchat-file'

const str_filter = require('../libs/str_filter');
const config = require('../config').config;
var fs = require("fs");
const file_util = require("../libs/file_util");

const notice_util = require('../libs/notice_util');
const user_redis = require('../config').user_redis;

const manager_c = require('./manager_c');

const rpc_query = require('../rpc_api_config').rpc_query
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSGA_API_BASE,MSGA_TOKEN_NAME,MSGA_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

    const rpc_api_util = require('../rpc_api_util')

/**
 * 由img_kind得到bucket的名字
 * @param img_kind
 * @returns {*}
 */
function getBucketName(img_kind)
{
    if(img_kind=='paper') return OBS_PAPER_IMAGE_BUCKET
    else if(img_kind=='open') return OBS_OPEN_IMAGE_BUCKET
    else if(img_kind =='src' )return OBS_SRC_FILE_BUCKET
    else if(img_kind =='file' )return OBS_FILE_BUCKET
    return null;
}

module.exports.upload_img =upload_img;
async function upload_img(req, res) {
    let {user_id,s_id,img_kind} = str_filter.get_req_data(req)

    if(!img_kind)  return res.json({ret:false,msg:"img_kind error"})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let fmts = ["JPG","jpg", "GIF","gif", "JPEG","jpeg", "PNG", "png", "BMP","bmp", "JPE", "jpe","webp"]

    let fileInfo =req.files[0]

    let fmtArray = fileInfo.originalname.split('.');
    let fmt = "jpg"
    if(fmtArray.length>=1)
        fmt = fmtArray[fmtArray.length-1];

    let fmtFlag = false;
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

    console.log("fileInfo:",fileInfo)//+JSON.stringify(fileInfo))


    //映射对应的img-info
    let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'img'+img_kind})
    if(!forkObjRet || !forkObjRet.ret)
    {
        return res.json({ret:false,msg:"img file fork obj-id failed"})
    }

    //声明相关上传人等的信息。
    // let obj = {user_id,obj_id:forkObjRet.token_x}
    fileInfo.fmt = fmt
    fileInfo.obj_id = forkObjRet.token_x
    fileInfo.user_id = user_id
    fileInfo.img_kind = img_kind
    fileInfo.save_time = parseInt(new Date().getTime()/1000)

    fileInfo.save_on_dnalink =  false//true
    if(res.file){
        fileInfo.hash = await str_filter.hashVal(fileInfo.path)
        let origin_path = config.file_temp+fileInfo.hash
        await file_util.writeFile(origin_path,Buffer.from(fileInfo.path)) //保存到磁盘
        fileInfo.path = origin_path
    }else{
        fileInfo.hash = await file_util.readFileSha256(fileInfo.path)
        let origin_path = config.file_temp+fileInfo.hash
        let cpFlag = await file_util.copyFile(fileInfo.path,origin_path)
        console.log('img-upload-cpFlag:',cpFlag)
        await file_util.unlink(fileInfo.path)
        fileInfo.path = origin_path
    }

    let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
        opval:JSON.stringify(fileInfo),extra_data:user_id})
    if(!assertInfoRet || !assertInfoRet.ret)
    {
        return res.json({ret:false,msg:"img file assert obj-info failed"})
    }

    //console.log("getBucketName(img_kind):"+getBucketName(img_kind)+" img_kind:"+img_kind)
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
	    //console.log('-----'+JSON.stringify(result))
            // fs.unlink(fileInfo.path ,function (err) {
            //     if (err) {
            //         throw err;
            //     }
            //     // console.log('文件:' + fileInfo.path + '删除失败！');
            // })

            if(res.file)
            {
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
            }
            else
            res.json({ret:true,msg:'success',filename:forkObjRet.token_x,fileInfo})
        }
    });
}

/**
 * 资源的访问权限控制。
 * @type {download_img}
 */
module.exports.download_img =download_img;
async function download_img(req, res) {
    let {user_id,s_id,filename,img_kind} = str_filter.get_req_data(req)

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!img_kind) return res.json({ret:false,msg:'img_kind is empty'})

    //判断paper的权限。
    if(img_kind=='paper') {
        let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
        if (!str) return res.json({ret: false, msg: "session error"})

        if(!manager_c.isManagerUid(user_id) ){
            if(filename.indexOf('obj_') ==0) {
                let assertInfoRet = await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
                if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
                assertInfoRet = (!assertInfoRet || !assertInfoRet.ret)  ? await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1}) :assertInfoRet
                if (!assertInfoRet || !assertInfoRet.ret) {
                    return res.json({ret: false, msg: "query img assert obj-info failed"})
                }

                let imgInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
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

    if(res.streamByte)
    {
        let fileInfo =await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert')
        if(!fileInfo) return res.json({ret:false,msg:'fileInfo is empty'})
        let data = await file_util.readFile(config.file_temp+fileInfo.hash)

        if(data &&data.length>0)
        {
            let base64 = data.toString('base64')
            // let myBlob = new Blob([data.data], { type:fileInfo.mimetype });
            // var base64 = await new Promise((res)=>{
            //     var reader = new FileReader();
            //     reader.onload = function (e) {
            //         res(e.target.result);
            //     }
            //     reader.readAsDataURL(myBlob);
            // })
            // base64 = base64.split('base64,')[1]
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
            // delete data.data
        }else{
            res.json(data?data:{ret:false,msg:'get img from dnalink-engine failed'})
        }
    }
    else
    obsClient.getObject({
        Bucket : getBucketName(img_kind),
        Key : filename,
        SaveAsStream : true
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

///加载压缩图
/**
 * 资源的访问权限控制。
 * @type {download_img_min}
 */
module.exports.download_img_min =download_img_min;
async function download_img_min(req, res) {
    let {user_id,s_id,filename,img_kind,img_p} = str_filter.get_req_data(req)

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!img_kind) return res.json({ret:false,msg:'img_kind is empty'})

    //判断img的权限。
    if(img_kind=='img') {
        let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
        if (!str) return res.json({ret: false, msg: "session error"})

        if(!manager_c.isManagerUid(user_id) ){
            if(filename.indexOf('obj_') ==0) {
                let assertInfoRet = await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
                if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
                assertInfoRet = (!assertInfoRet || !assertInfoRet.ret)  ? await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1}) :assertInfoRet
                if (!assertInfoRet || !assertInfoRet.ret) {
                    return res.json({ret: false, msg: "query img assert obj-info failed"})
                }

                let imgInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
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

module.exports.upload_file =upload_file;
async function upload_file(req, res) {
    let {user_id,s_id,file_kind} = str_filter.get_req_data(req)

    if(!file_kind)  return res.json({ret:false,msg:"file_kind error"})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let fmts = ["zip","rar","doc","docx","pdf","xls","xles"]

    //let fileInfo =req.files[0]

    let filesInfo = req.files
    
    
    //多个文件上传
    let i=0
    for(;i<filesInfo.length;i++)
    {
        //console.log('file '+ i+':'+JSON.stringify(filesInfo[i]))
        filesInfo[i].type=filesInfo[i].originalname.split('.').pop().toLowerCase();

        //映射对应的file-info
        let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'file'+file_kind})
        if(!forkObjRet || !forkObjRet.ret)
        {
            return res.json({ret:false,msg:"file fork obj-id failed"})
        }
        //声明相关上传人等的信息。
        // let obj = {user_id,obj_id:forkObjRet.token_x}
        filesInfo[i].obj_id = forkObjRet.token_x
        filesInfo[i].user_id = user_id
        filesInfo[i].file_kind = file_kind
        filesInfo[i].save_time = parseInt(new Date().getTime()/1000)

        let fileInfo = filesInfo[i]
        fileInfo.save_on_dnalink =  false//true
        if(res.file){
            console.time('uploadFile-time0')
            fileInfo.hash = await str_filter.hashVal(fileInfo.path)
            let origin_path = config.file_temp+fileInfo.hash
            await file_util.writeFile(origin_path,Buffer.from(fileInfo.path)) //保存到磁盘
            console.timeEnd('uploadFile-time0')
            fileInfo.path = origin_path
        }else{
            fileInfo.hash = await file_util.readFileSha256(fileInfo.path)
            let origin_path = config.file_temp+fileInfo.hash
            let cpFlag = await file_util.copyFile(fileInfo.path,origin_path)
            console.log('file-upload-cpFlag:',cpFlag)
            await file_util.unlink(fileInfo.path)
            fileInfo.path = origin_path
        }

        let assertInfoRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:filesInfo[i].obj_id, opcode:'assert',
            opval:JSON.stringify(filesInfo[i]),extra_data:user_id})
        if(!assertInfoRet || !assertInfoRet.ret)
        {
            return res.json({ret:false,msg:"file assert obj-info failed"})
        }

        //console.log("getBucketName(img_kind):"+getBucketName(file_kind)+" file_kind:"+file_kind)
        //console.log(file_kind);
        //console.log(forkObjRet.token_x);
        //console.log(filesInfo[i].path);
        console.time('uploadFile-time')
        obsClient.putObject({
            Bucket : getBucketName(file_kind),
            Key : forkObjRet.token_x,
            SourceFile :filesInfo[i].path
        }, (err, result) => {
            if(err){
                console.error('Error-->' + err);

                res.json({ret:false,msg:'upload file to obs failed'})
            }else{
                console.log('Status-->' + result.CommonMsg.Status);
                if(result.CommonMsg.Status==400) console.error(result.CommonMsg);            // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});

                // fs.unlink(filesInfo[i].path ,function (err) {
                //     if (err) {
                //         throw err;
                //     }
                //     // console.log('文件:' + fileInfo.path + '删除失败！');
                // })
                if(res.file)
                {
                    let uploadRet = {ret:true}
                    if(uploadRet && uploadRet.ret)
                    {
                        delete fileInfo.filename
                        fileInfo.filename = forkObjRet.token_x
                        fileInfo.ret =true;
                        fileInfo.msg = 'success'
                        delete uploadRet.path
                        console.timeEnd('uploadFile-time')
                        return res.json(fileInfo)
                    }
                }
                else
                {
                    delete filesInfo[i].filename
                    filesInfo[i].filename = forkObjRet.token_x
                    filesInfo[i].ret =true;
                    filesInfo[i].msg = 'success'
                    console.timeEnd('uploadFile-time')
                    return res.json({ret: true, msg: "success",filesInfo})
                }
            }
        });
    }
    // return res.json({ret: true, msg: "success",filesInfo})
    
}

/**
 * 下载rps文件。
 * @type {download_rpsfile}
 */
module.exports.download_rpsfile =download_rpsfile;
async function download_rpsfile(req, res) {
    let {user_id,s_id,filename,file_kind,flv} = str_filter.get_req_data(req)

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!file_kind) return res.json({ret:false,msg:'file_kind is empty'})

    //当flv参数不为空时，读取的是flv文件
    //判断paper的权限。
    let objInfo = null;
    //let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
    //if (!str) return res.json({ret: false, msg: "session error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
    assertInfoRet = (!assertInfoRet || !assertInfoRet.ret)  ? await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1}) :assertInfoRet
    if (!assertInfoRet || !assertInfoRet.ret) {
        return res.json({ret: false, msg: "query file assert obj-info failed"})
    }

    let fileInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    objInfo = fileInfo

    let downKey = filename +(flv?'.flv':'')

    let saveFilePath = config.file_temp+downKey;
    let saveFlag = false;

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
            //res.setHeader("content-disposition", "attachment;filename=" + objInfo.originalname+(flv?'.flv':''));
            //下载文件名中文乱码问题
            var userAgent = (req.headers['user-agent']||'').toLowerCase();
            if(userAgent.indexOf('msie') >= 0 || userAgent.indexOf('chrome') >= 0) {
                res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(objInfo.originalname+(flv?'.flv':'')));
            } else if(userAgent.indexOf('firefox') >= 0) {
                res.setHeader('Content-Disposition', 'attachment; filename*="utf8\'\'' + encodeURIComponent(objInfo.originalname+(flv?'.flv':''))+'"');
            } else {
                /* safari等其他非主流浏览器只能自求多福了 */
                res.setHeader('Content-Disposition', 'attachment; filename=' + new Buffer(objInfo.originalname+(flv?'.flv':'')).toString('binary'));
            }

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

}
deleteFile = function (path) {
    fs.unlink(path ,function (err) {
        if (err) {
            throw err;
        }
        console.log('文件:' + path + '删除失败！');
    })
}

/**
 * 返回同步的文件（提供下载用户）二进制流方式。
 */
module.exports.syncFile = syncFile
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
 * 下载文件。
 * @type {download_file}
 */
module.exports.download_file =download_file;
async function download_file(req, res) {
    let {user_id,s_id,filename,file_kind,begin,len} = str_filter.get_req_data(req)

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!file_kind) return res.json({ret:false,msg:'file_kind is empty'})

    let objInfo = null
    if(file_kind !='src') {
        let assertInfoRet = await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
        if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
        let fileInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        objInfo = fileInfo
    }
    //判断paper的权限。
   
    if(file_kind=='src') {
        let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
        if (!str) return res.json({ret: false, msg: "session error"})

        let assertInfoRet = await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
        if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
        assertInfoRet = (!assertInfoRet || !assertInfoRet.ret)  ? await rpc_query(OBJ_API_BASE + "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1}) :assertInfoRet
        if (!assertInfoRet || !assertInfoRet.ret) {
            return res.json({ret: false, msg: "query file assert obj-info failed"})
        }

        let fileInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        objInfo = fileInfo

        if(!manager_c.isManagerUid(user_id) ){
            if(filename.indexOf('obj_') ==0) {
                
                if (file_kind != fileInfo.file_kind)
                    return res.json({ret: false, msg: "file_kind unmatch"})

                if (user_id != fileInfo.user_id) {

                    //查用户的购买记录中是否存在该file
                    //查询用户资料，gsb_src_buyed_id
                    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
                    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
                    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
                    if(!userInfo.gsb_src_buyed_id)
                    {
                        return res.json({ret: false, msg: "query gsbsrc-buyed-id failed"});
                    }

                    //得到购买的源码列表
                    let assertMyObjRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.gsb_src_buyed_id,opcode:'assert',begin:0,len:1})
                    let objList = []
                    if(assertMyObjRet && assertMyObjRet.ret) {
                        objList = JSON.parse(JSON.parse(assertMyObjRet.list[0].txjson).opval)
                    }

                    let i = 0,flag = false;
                    for(;i<objList.length;i++)
                    {
                        if(objList[i].src_file == filename){
                            flag = true;
                        }
                    }
                    if(!flag) return res.json({ret: false, msg: "no permission download the file"})
                }
            }
        }
        //有管理员权限直接可以访问
    }
    //console.log(file_kind);
    //console.log(filename);
    //console.log(objInfo.originalname);
    //console.log(objInfo.path);

    if(res.streamByte)
    {
        let fileInfo =await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert')
        if(!fileInfo) return res.json({ret:false,msg:'fileInfo is empty'})
        let data = await file_util.readFile(config.file_temp+fileInfo.hash)

        if(data &&data.length>0)
        {
            let buffer = data
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
        }else{
            res.json(data?data:{ret:false,msg:'get img from dnalink-engine failed'})
        }
    }
    else
    obsClient.getObject({
        Bucket : getBucketName(file_kind),
        Key : filename,
        SourceFile : objInfo.path
       // SourceFile : true SaveAsStream
    }, (err, result) => {
        if(err){
            console.error('Error-->' + err);
            if(!filename) return res.json({ret:false,msg:'filename unexists'})
        }else{
            console.log('Status-->' + result.CommonMsg.Status);
            if(result.CommonMsg.Status==404) return res.json({ret:false,msg:'filename unexists'})
            if(result.CommonMsg.Status==200) console.error(result.CommonMsg);
            if(objInfo.originalname) {               
                //res.setContentType("application/x-download");objInfo.mimetype
                res.setHeader("Cache-Control", "max-age=31536000, must-revalidate");
                res.setHeader("Content-Length", objInfo.size);
                res.setHeader("Content-Type", objInfo.mimetype);
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("content-disposition", "attachment;filename=" + objInfo.originalname);
            }
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
module.exports.upload_static_file =upload_static_file;
async function upload_static_file(path) {
    let img_kind ='open';

    let existFlag = await existsFile(path)
    console.log('existFlag:'+existFlag)
    if(!existFlag) return {ret:false,msg:'file unexist'};

    let forkObjRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,space:'img'+img_kind})
    if(!forkObjRet || !forkObjRet.ret)
    {
        return {ret:false,msg:"static file fork obj-id failed"}
    }

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
                putRet = {ret:true,msg:'success',filename:forkObjRet.token_x}
                resolve(putRet);
            }
        });
    });

    return putRet;
}
/**
 * 获得文件的预览图并且上传（用于视频方面）
 * @param {} filepath 
 * @param {*} key 
 */
async function get_file_preview_img(filepath,key) {
    let dstFilePath = config.file_temp+key+'.jpg'
    let commands = "/data/ffmpeg-3.3.4-64bit-static/ffmpeg -i "+filepath+" -ss 1 -t 0.001 -y -f image2 "+dstFilePath
    var exec = require('child_process').exec;
    let flag = true;
    await new Promise((resolve,reject)=>{
        exec(commands,function(err,stdout,stderr){
            console.log('get_file_preview_img-exec-err:'+err+" stderr:"+stderr)
            if(err) {
                console.log('get_file_preview_img-exe stderr:'+stderr);
                flag = false;
                reject( "failed")
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
 * 上传文件等
 */
module.exports.upload_file_p =upload_file_p;
async function upload_file_p(req, res) {
    let {user_id,s_id,file_kind,videoflag} = str_filter.get_req_data(req)

    if(!file_kind)  return res.json({ret:false,msg:"file_kind error"})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let fmts = ["zip","rar"]

    let fileInfo =req.files[0]

    let fmtArray = fileInfo.originalname.split('.');
    let fmt = "jpg"
    if(fmtArray.length>=1)
        fmt = fmtArray[fmtArray.length-1];

    let fmtFlag = true//不判断格式   //false;
    for(i=0;!fmtFlag && i<fmts.length;i++)
        if(fmts[i] == fmt)
        {
            fmtFlag = true;
            break;
        }
    if(!fmtFlag) return res.json({ret:false,msg:"文件格式{"+fmt+"}并非合规文件格式，请重新上传"})
    if(fileInfo.size>100*1024*1024) return res.json({ret:false,msg:"非法文件大小：文件大小超过100M"})

    console.log("fileInfo:",fileInfo)//+JSON.stringify(fileInfo))

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
    fileInfo.file_kind = file_kind
    fileInfo.save_time = parseInt(new Date().getTime()/1000)

    // //首图
    let uploadPreviewImgRet = videoflag  =='video' ?  await get_file_preview_img(fileInfo.path,fileInfo.obj_id) :null
    fileInfo.preview_img = uploadPreviewImgRet && uploadPreviewImgRet.ret ? uploadPreviewImgRet.filename:null;

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

    console.log("getBucketName(file_kind):"+getBucketName(file_kind)+" file_kind:"+file_kind)
    obsClient.putObject({
        Bucket : getBucketName(file_kind),
        Key : forkObjRet.token_x,
        SourceFile :fileInfo.path
    }, (err, result) => {
        if(err){
            console.error('Error-->' + err);

            res.json({ret:false,msg:'upload file to obs failed'})
        }else{
            console.log('Status-->' + result.CommonMsg.Status);
            // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});

            // fs.unlink(fileInfo.path ,function (err) {
            //     if (err) {
            //         throw err;
            //     }
            //     // console.log('文件:' + fileInfo.path + '删除失败！');
            // })

            delete fileInfo.filename
            fileInfo.filename = forkObjRet.token_x
            fileInfo.ret =true;
            fileInfo.msg = 'success'
            
            res.json(fileInfo)
        }

    });
    
}


/**
 * 下载文件。
 * @type {download_file}
 */
module.exports.download_file_p =download_file_p;
async function download_file_p(req, res) {
    //当flv参数不为空时，读取的是flv文件
    let {user_id,s_id,filename,file_kind,flv} = str_filter.get_req_data(req)

    if(!filename) return res.json({ret:false,msg:'filename is empty'})
    if(!file_kind) return res.json({ret:false,msg:'file_kind is empty'})

    let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let fileInfo = await rpc_api_util.s_query_token_info(OBJ_API_BASE,filename,'assert');
    if(!fileInfo )return res.json({ret:false,msg:'file-info is empty'})

    let chatid = fileInfo.chatid;
    if(!chatid) return res.json({ret:false,msg:'chatid is error'})

    let chatInfo = await rpc_api_util.s_query_token_info(MSGA_API_BASE,chatid,'assert')
    if(!chatInfo ) return res.json({ret:false,msg:'chat-info is empty'})

    let msg_user_id = MSGA_TOKEN_NAME+'_'+user_id.split('_')[1]
    if(chatInfo.create_user_id!=user_id)//不是创建人
    {
        let joinRet = await rpc_api_util.s_check_token_list_related(MSGA_API_BASE,msg_user_id,chatid,'relm');
        if(!joinRet) return res.json({ret:false,msg:'user unjoin chat'})
    }

    let is_range = req.headers["range"]

    let objInfo = fileInfo;
    let downKey = filename +(flv?'.flv':'')

    let saveFilePath = config.file_temp+downKey;
    let saveFlag = false;

    console.log('------------------------------------'+objInfo.originalname)
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
            //res.setHeader("content-disposition", "attachment;filename=" + objInfo.originalname+(flv?'.flv':''));
            //下载文件名中文乱码问题
            var userAgent = (req.headers['user-agent']||'').toLowerCase();
            if(userAgent.indexOf('msie') >= 0 || userAgent.indexOf('chrome') >= 0) {
                res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(objInfo.originalname+(flv?'.flv':'')));
            } else if(userAgent.indexOf('firefox') >= 0) {
                res.setHeader('Content-Disposition', 'attachment; filename*="utf8\'\'' + encodeURIComponent(objInfo.originalname+(flv?'.flv':''))+'"');
            } else {
                /* safari等其他非主流浏览器只能自求多福了 */
                res.setHeader('Content-Disposition', 'attachment; filename=' + new Buffer(objInfo.originalname+(flv?'.flv':'')).toString('binary'));
            }
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
                            //deleteFile(saveFilePath)
                        })
                        // 监听错误
                        stream.on('error',function (err) {
                            console.log(err);
                            //deleteFile(saveFilePath)
                        })
                        // compressHandle(raw, 206, "Partial Content");
                    } else {
                        res.removeHeader("Content-Length");
                        res.writeHead(416, "Request Range Not Satisfiable");
                        res.end();

                        //deleteFile(saveFilePath)
                    }
                } else {
                    var stream = fs.createReadStream(saveFilePath);
                    res.writeHead('200', "Partial Content");
                    stream.pipe(res);

                    stream.on('end',function (chunk) {
                        stream.close();
                        //deleteFile(saveFilePath)
                    })
                    // 监听错误
                    stream.on('error',function (err) {
                        console.log(err);
                        //deleteFile(saveFilePath)
                    })
                    // compressHandle(raw, 200, "Ok");
                }

        }
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
