/**
 * create by poplang on 2022/9/27
 */
// const TokenUtil = require('../../../dnalink.protocol/DNALinkProtocol').TokenUtil
// const RPCApiUtil= require('../../RPCApiUtil')
// const str_filter = require('../../../libs/str_filter');
// const file_util = require('../../../libs/file_util')
// const str_filter = require('../pop.lite.dnalink.engine/libs/str_filter')

// var fs = require("fs");
// const __dirname = ''
const config = {
    file_temp:__dirname+'/file_temp/',
    file_storage_path:__dirname+'/file_storage/',
}

// if(typeof window.ifileDb == 'undefined')
// {
//     const ifileDb = {};// new IFileIndexDB()
//     // ifileDb.openDB()
//     window.ifileDb = ifileDb
// }

class FileController
{
    constructor(protocol){
        this.protocol = protocol
        this.fsm_config = protocol.fsm_config
        this.root_config= protocol.root_config
        this.token_util = new TokenUtil(this.protocol)
        this.rpc_api_util = new RPCApiUtil(this.protocol)

        this.TOKEN_ROOT = protocol.root_config.TOKEN_ROOT
        this.TOKEN_NAME = protocol.root_config.TOKEN_NAME
    }

    async setSQLDB(sqldb)
    {
        this.sqldb = sqldb
        if(!sqldb) return false;
        let flag = await sqldb.executeUpdate( `CREATE TABLE file_item (
            file_hash varchar(256) primary key,
            file_info TEXT,
            file BLOB NOT NULL,
            save_time_i INTEGER
        )`)
        let iNum = await sqldb.queryOne('select count(*) as cnt from file_item')
        console.log('file-item-iNum:'+JSON.stringify(iNum))
        return flag;
    }

    file_c_index (app) {
        // app.all('/', function(req, res) {
        //   res.send('Hello World!');
        // });
        // app.all('/super/image/upload',file_c.upload_img);//图片上传
        // app.all('/super/image/view',file_c.download_img);//图片显示
        
        // app.all('/super/image/fengjing/imgs',urlParser,file_c.get_fengjing_imgs);//默认的风景图
        // app.all('/super/image/mc/logos',urlParser,file_c.get_mc_logos);//默认的萌宠图
      
        // app.all('/super/qrcode/scan', multer({ dest:config.file_temp}).array('file'),urlParser,qrcode_c.qrcode_scan);//扫一扫（将二维码图片上传上来，然后解析得到字符串内容 ）
        // app.all('/super/qrcode/draw',urlParser,qrcode_c.qrcode_draw);//由字符串内容data生成对应的二维码。
      
        //文件的上传与下载。
        //multer({ dest:config.file_temp}).array('file'),urlParser,
        let This =this
        app.all('/super/file/upload',function(req,res){This.upload_file(req,res)});
        app.all('/super/file/download',function(req,res){This.download_file(req,res)});
      }

      async existsFile(filename) {
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
    async upload_img(req, res) {
       //let {user_id,s_id,filename,img_kind,img_p} = str_filter.get_req_data(req)
        let fmts = ["jpg", "gif", "jpeg", "png", "bmp", "jpe"]
    
        let fileInfo =req.files[0]
    
        let fmtArray = fileInfo.originalname.split('.');
        let fmt = "jpg"
        if(fmtArray.length>=1)
            fmt = fmtArray[fmtArray.length-1];
    
        let fmtFlag = false;
        for(i=0;i<fmts.length;i++)
            if(fmts[i] == fmt)
            {
                fmtFlag = true;
                break;
            }
        if(!fmtFlag) return res.json({ret:false,msg:"图片格式{"+fmt+"}并非图片，请重新上传"})
        if(fileInfo.size>30*1024*1024) return res.json({ret:false,msg:"非法图片：图片大小超过30M"})
    
        console.log("fileInfo:"+JSON.stringify(fileInfo))
    
    
        //映射对应的img-info
        let forkObjRet = await rpc_query("/fork",{token:this.TOKEN_ROOT,space:'img'+img_kind})
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
    
        let assertInfoRet = await rpc_query("/op",{token_x:this.TOKEN_ROOT,token_y:fileInfo.obj_id, opcode:'assert',
            opval:JSON.stringify(fileInfo),extra_data:user_id})
        if(!assertInfoRet || !assertInfoRet.ret)
        {
            return res.json({ret:false,msg:"img file assert obj-info failed"})
        }
    
       //  console.log("getBucketName(img_kind):"+getBucketName(img_kind)+" img_kind:"+img_kind)
       //  obsClient.putObject({
       //      Bucket : getBucketName(img_kind),
       //      Key : forkObjRet.token_x,
       //      SourceFile :fileInfo.path
       //  }, (err, result) => {
       //      if(err){
       //          console.error('Error-->' + err);
    
       //          res.json({ret:false,msg:'upload file to obs failed'})
       //      }else{
       //          console.log('Status-->' + result.CommonMsg.Status);
       //          // let urlRet = obsClient.createSignedUrlSync({Method : 'GET', Bucket : OBS_PAPER_IMAGE_BUCKET, Expires: 3600});
    
       //          fs.unlink(fileInfo.path ,function (err) {
       //              if (err) {
       //                  throw err;
       //              }
       //              // console.log('文件:' + fileInfo.path + '删除失败！');
       //          })
    
       //          delete fileInfo.destination;
       //          delete fileInfo.path;
       //          res.json({ret:true,msg:'success',filename:forkObjRet.token_x,file_info:fileInfo})
       //      }
       //  });
    }
    
    /**
     * 资源的访问权限控制。
     * @type {download_img}
     */
    async download_img(req, res) {
        let {user_id,s_id,filename,img_kind,img_p} = str_filter.get_req_data(req)
    
        if(!filename) return res.json({ret:false,msg:'filename is empty'})
        if(!img_kind) return res.json({ret:false,msg:'img_kind is empty'})
    
        //判断img的权限。
        if(img_kind=='img') {
            let str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
            if (!str) return res.json({ret: false, msg: "session error"})
    
            if(!manager_c.isManagerUid(user_id) ){
                if(filename.indexOf('obj_') ==0) {
                    let assertInfoRet = await this.rpc_api_util.rpc_query("/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1})
                    if (!assertInfoRet || !assertInfoRet.ret) str_filter.sleep(1500)
                    assertInfoRet = (!assertInfoRet || !assertInfoRet.ret)  ? await this.rpc_api_util.rpc_query( "/chain/opcode", {token: filename, opcode: 'assert', begin: 0, len: 1}) :assertInfoRet
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
    /**
     * 获得文件的预览图并且上传（用于视频方面）
     * @param {} filepath 
     * @param {*} key 
     */
    async get_file_preview_img(filepath,key) {
        let dstFilePath = config.file_temp+key+'.jpg'
        let commands = "/data/ffmpeg-4.2.2-i686-static/ffmpeg -i "+filepath+" -ss 1 -y -f  image2   -vframes 1 "+dstFilePath
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
            let uploadRet = await this.upload_static_file(dstFilePath)
            if(!(uploadRet && uploadRet.ret) ) uploadRet = await this.upload_static_file(dstFilePath) 
    
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
    async upload_file(req, res) {
       // let param = req.next ? req: str_filter.get_req_data(req)
       // //当flv参数不为空时，读取的是flv文件
       // let {token,token_x,token_y} = param
        let {token,token_x,token_y,opval,next} =  str_filter.get_req_data(req)
        token = (''+token).length>5? token:null;
   
       //  let fmts = ["zip","rar"]
       if(!req.files|| req.files.length==0) return res.json({ret:false,msg:'upload file unexists'})
    
        let fileInfo =req.files[0]
        if(!fileInfo) return res.json({ret:false,msg:'upload file unexists'})
        delete fileInfo.destination 

        //console.log('originalename:'+fileInfo.originalname)
        //10-18处理中文文件名的字符串乱码问题。
        // if(fileInfo.encoding == '7bit') fileInfo.originalname =  Buffer.from(fileInfo.originalname, "latin1").toString("utf8");
        //console.log('originalename:'+fileInfo.originalname)
    
        let fmtArray = fileInfo.originalname.split('.');
        let fmt = fmtArray && fmtArray.length>=1 ? fmtArray[fmtArray.length-1] : "";
        
        //if(fileInfo.size>100*1024*1024) return res.json({ret:false,msg:"非法文件大小：文件大小超过100M"})
        console.log("fileInfo:",fileInfo)//+JSON.stringify(fileInfo))
    
        //生成file_id（如果token为真，则不生成，上传新版本文件）
        let file_id = token ? token : await this.rpc_api_util.s_fork_token_id('',this.TOKEN_ROOT,this.fsm_config.OP_FILE);//  rpc_query("/fork",{token:TOKEN_ROOT,space:'file'})
       if(!file_id)
       {
           return res.json({ret:false,msg:'file_id fork failed'})
       }
        fileInfo.file_id = file_id
        fileInfo.fmt = fmt;
        fileInfo.hash_type = 'sha256'
        let beginTime = new Date().getTime()
        // console.log('fileInfo.path:',fileInfo.path)
        fileInfo.hash = await str_filter.hashVal(fileInfo.path)//file_util.readFileSha256(fileInfo.path)
        console.log('calc-file-hash-used-time(ms):'+(new Date().getTime()-beginTime))
        delete fileInfo.buffer;
        fileInfo.save_time = parseInt(new Date().getTime()/1000)
    
        //首图
       //  let uploadPreviewImgRet = fmt  !='mp3' ?  await get_file_preview_img(fileInfo.path,fileInfo.obj_id) :null
       //  fileInfo.preview_img = uploadPreviewImgRet && uploadPreviewImgRet.ret ? uploadPreviewImgRet.filename:null;
   
        let dst_path = config.file_storage_path+ fileInfo.hash//this.root_config.TNS_NAMESPACE+fileInfo.file_id+'_'+fileInfo.save_time+'.'+fmt
        let old_path = fileInfo.path;
        fileInfo.path = fileInfo.hash //以hash方式保存，避免重复存储2022-11-14 // this.root_config.TNS_NAMESPACE+fileInfo.file_id+'_'+fileInfo.save_time+'.'+fmt  //protect the real path
   
        if(!this.sqldb)
        {
            // let copyRet = await file_util.existsFile(dst_path);
            // if(copyRet) console.log('existsFile:'+dst_path)
            // copyRet = copyRet ? copyRet : await file_util.copyFile(old_path,dst_path)
            let copyRet = ifileDb.addData({key:fileInfo.hash,data:old_path})
            if(!copyRet)
            {
                return res.json({ret:false,msg:"move file failed"})
            }
        }else{//保存到sqldb中
            fileInfo.in_db_flag = true
            let sha256 = fileInfo.hash
            let save_time_i = parseInt( new Date().getTime()/1000)
            let file = fileInfo.path//await file_util.readFile(old_path)
            if(!file|| file.length<=0) return res.json({ret:false,msg:"read file failed"})

            let iNum = await this.sqldb.executeUpdate('insert into file_item(file_hash,file_info,file,save_time_i) values(?,?,?,?)' ,[sha256,JSON.stringify(fileInfo),old_path,save_time_i])
            if(!iNum || iNum<=0)
            {
                let rows = await this.sqldb.query('select * from file_item where file_hash=?',[sha256])
                // console.log('rows:'+JSON.stringify(rows))
                if(!rows || rows.length<=0) return res.json({ret:false,msg:"save file to db failed"})
            }
        }

        let unlinkRet =true// await file_util.unlink(old_path)
        console.log('unlink-ret:'+unlinkRet)
   
        let assertInfoRet = await  this.rpc_api_util.s_save_token_info('',this.TOKEN_ROOT,file_id,this.fsm_config.OP_FILE,JSON.stringify(fileInfo),'')
        if(!assertInfoRet)
        {
            return res.json({ret:false,msg:"file assert obj-info failed"})
        }
        fileInfo.ret  = true;
        fileInfo.msg ='success';    
   
        if(next)
        {
           //为降维调用提供必要接口。
           let param = {token_x,token_y,opcode:this.fsm_config.OP_FILE_UP,opval:JSON.stringify(fileInfo),extra_data:''};
           let opRet =await this.rpc_api_util.rpc_query('/op',param)
           console.log('OP_FILE_UP-opRet:'+JSON.stringify(opRet))
           opRet = !opRet? {ret:false,msg:'unexpect error'}:opRet;
           opRet.fileInfo = fileInfo
           res.json(opRet)
           return ;
        }
        
        res.json(fileInfo)
    }

    /**
     * 下载文件。
     * @type {download_file}
     * 
     * http://127.0.0.1:60000/super/file/download?appid=10001&secret_key=48d32c07261b6e5aa2f9fa5e2a568d33&token=valuetest_file33WR2zM5yEfh
     *http://127.0.0.1:60000/super/file/download?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_file33WR2zM5yEfh&timestamp=1659515827
     *
     * http://127.0.0.1:60000/super/file/download?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_file33WR2zM5yEfh&timestamp=1659516079
     *http://127.0.0.1:60000/chain/opcode?opcode=file_download&begin=0&len=10&appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token=valuetest_file33WR2zM5yEfh&timestamp=1659515827
     *
     *
     * //设置为chain-open
     * http://127.0.0.1:60000/op?appid=10001&secret_key=bbdbffb24df77be206c820bbe06ae02c&token_x=valuetest_0000000000000000&token_y=valuetest_0000000000000000&opcode=access.chain.open&opval=access.chain.open&extra_data=wslisten-helloworld
     * //通过chain接口获取下载数据---方便web3.meta.call等的使用。
     * http://127.0.0.1:60000/chain/file?token=valuetest_file2z3BFt27W6it
     * http://127.0.0.1:60000/chain/file/valuetest_file2z3BFt27W6it
     *  
     */
    async download_file(req, res) {
        //  let param = req.next ? req: str_filter.get_req_data(req)
        //  //当flv参数不为空时，读取的是flv文件
         let {token,timestamp,token_x,token_y,next,opval,begin,len} = str_filter.get_req_data(req)//param
        // console.log('req.params:'+JSON.stringify(req))
        console.log('token:'+req.token+token+' token_x:'+token_x+' token_y:'+token_y+' timestamp:'+timestamp)
     
        if(!token) {
            console.log('file-url:'+req.url)
            let url = ''+req.url
            url = url.indexOf('?')>0 ? url.split('?')[0]:url;
            let urls = url.split('/')
            let tmpToken = urls[urls.length-1];
            if(this.token_util.validateTokenID(tmpToken))token = tmpToken;
            else return res.json({ret:false,msg:'token is empty'})
            console.log('file-token:'+token)
        }
        
        let objInfo = null;
        if(!timestamp)
        {
            objInfo = await this.rpc_api_util.s_query_token_info('',token,this.fsm_config.OP_FILE);
            if(!objInfo )return res.json({ret:false,msg:'file-info is empty'})
        }
        else{
            let fileListRet = await this.rpc_api_util.rpc_query('/chain/opcode',{token,opcode:this.fsm_config.OP_FILE,begin:0,len:1000})
            let fileList = fileListRet && fileListRet.ret  ? fileListRet.list :null;
            for(let i=0;fileList && fileList.length>0 &&i<fileList.length;i++)
            {
                let tmpInfo = null;
                try{
                    tmpInfo = JSON.parse((JSON.parse(fileList[i].txjson)).opval)
                }catch(ex){
                    continue;
                }
                if(tmpInfo.save_time == timestamp)
                {
                    objInfo = tmpInfo
                    break
                }
            }
            if(!objInfo )return res.json({ret:false,msg:'file-info is empty'})
        }

        console.log('file-objInfo:'+JSON.stringify(objInfo))

        let saveFilePath = config.file_storage_path+ objInfo.path

        let This = this

        let rows =this.sqldb ?  await this.sqldb.query('select * from file_item where file_hash=?',[objInfo.hash]):null
    
        if(typeof res.file =='function')
        {
            let buffer = null
            if(!rows || rows.length<=0)
            {
                buffer =await ifileDb.getDataByKey(objInfo.hash)//await file_util.readFile(saveFilePath)
                buffer = buffer? buffer.data : null
            }else{
                buffer = rows[0].file
            }

            if(!buffer || buffer.length <=0) return res.json({ret:false,msg:'query-file failed'})

            if(true)
            {
                //统一使用二进制返回
                // if(objInfo.size <=60*1024*2)//no split data
                // {
                //     let bs64file = btoa(encodeURI(buffer))//buffer.toString('base64')//file_util.base64file(objInfo.originalname,buffer)
                //     res.file(bs64file,objInfo)
                // }else
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
                    // let perlen = 100
                    // let buffer =await ifileDb.getDataByKey(objInfo.hash)//await file_util.readFile(saveFilePath)
                    // buffer = buffer? buffer.data : null
                    console.log('buffer.length:'+(buffer ? buffer.length:0))
                    for(let i=pos;buffer&& i<max_pos;i++)
                    {
                        let chunk =  buffer.slice(begin+i*pkgSize,begin+i*pkgSize+pkgSize)
                        await res.streamByte(chunk,i,max_pos,objInfo)
                    }
                }
            }

            // else{
            //     console.log('file-size:'+rows[0].file.length)
            //     // await res.write(new Buffer(rows[0].file))
            //     // let bs64file = btoa(encodeURI(rows[0].file))//buffer.toString('base64')//file_util.base64file(objInfo.originalname, rows[0].file)
            //     // res.file(bs64file,objInfo)



            // }
            if(len &&begin>0){
                console.log('=file readSlice exit it!')
                return 
            }
            if(next)
            {
                let logRet = await This.rpc_api_util.s_save_token_info('',token_x,token_y,This.fsm_config.OP_FILE_DOWN,JSON.stringify(objInfo),'');
                console.log('logRet:'+JSON.stringify(logRet))
            }
            let logRet =  await This.rpc_api_util.s_save_token_info('',This.TOKEN_ROOT,token,This.fsm_config.OP_FILE_LOG,JSON.stringify(objInfo),'');
            console.log('logRet:'+JSON.stringify(logRet))
        }
        else{
            res.json({ret:false,msg:'unexists file-system'})
        }
    }
    /**
     * 转码生成flv，可以供苹果手机浏览器使用（安卓也可以的）
     * @param {}} filepath 
     * @param {*} key 
     * @param {*} file_kind 
     */
    async covertoFlv(filepath,key,file_kind)
    {
        let dstFilePath = config.file_temp+key+'.flv'
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
    
}


window.FileController = FileController
window.FileController.config = config
// module.exports = FileController
// module.exports.config = config