// const decodeImage = require('jimp').read;
// const qrcodeReader = require('qrcode-reader');
// const qr_image = require("qr-image")
// const fs = require("fs");

// const config = require('../config').config;
// const user_redis = require('..//config').user_redis;
// const str_filter = require('../libs/str_filter');
/**
 * 扫描一张图片，返回data
 */
window.qrcode_c = {}
window.qrcode_c.qrcode_scan =qrcode_scan;
async function qrcode_scan(req, res) {
    //按image/upload接口上传图片一样的方式即可

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
    if(fileInfo.size>3*1024*1024) return res.json({ret:false,msg:"非法图片：图片大小超过3M"})

    console.log("fileInfo:"+JSON.stringify(fileInfo))

    let qrcode_data = await qrDecode(fileInfo.path);

    fs.unlink(fileInfo.path ,function (err) {
        if (err) {
            throw err;
        }
        // console.log('文件:' + fileInfo.path + '删除失败！');
    })

    if(qrcode_data) res.json({ret:true,msg:'success',qrcode_data})
    else  res.json({ret:false,msg:'decode qrcode-image failed'});
}

/**
 * 生成一张图片
 */
window.qrcode_c.qrcode_draw =qrcode_draw;
async function qrcode_draw(req, res) {
    let {data,random} = str_filter.get_req_data(req)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":qrcode_draw:"+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":qrcode_draw:"+random,random,120)

    let filepath = ll_config.file_temp+'qrcode_'+random+'.png';
    let writeFlag = await qrcodeDraw(data,filepath);
    if(!writeFlag) res.json({ret:false,msg:'qrcode draw file failed!'})

    var stream = fs.createReadStream( filepath );
    //var responseData = [];//存储文件流
    if (stream) {//判断状态
        stream.on( 'data', function( chunk ) {
            res.write( chunk );
        });
        stream.on( 'end', function() {
            //var finalData = Buffer.concat( responseData );
            //res.write( finalData );
            res.end();
        });
    }

    fs.unlink(filepath ,function (err) {
        if (err) {
            throw err;
        }
        // console.log('文件:' + fileInfo.path + '删除失败！');
    })
}



async function test(){
    let data = await qrDecode(+ll_config.file_temp+"01.png");//,function(data){
    console.log(data);

    //写入图片。
    const temp_qrcode = qr_image.image(data,{type:'png',ec_level: 'Q'})
    temp_qrcode.pipe(require('fs').createWriteStream(ll_config.file_temp+'03.png').on('finish', function() {
        console.log('write finished')
    }))
}


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
//test();

    //res.type("png");
    //temp_code.pipe(res)
//}
async function qrDecode(path){
    let tmpRes = null;
    try{
        tmpRes = await new Promise((resolve,reject)=>{
            decodeImage(path,function(err,image){
                if(err){
                    reject(false);
                    return;
                }
                let decodeQR = new qrcodeReader();
                decodeQR.callback = function(errorWhenDecodeQR, result) {
                    if (errorWhenDecodeQR) {
                        reject(false);
                        return;
                    }
                    if (!result){
                        reject(false);
                        return;
                    }else{
                        resolve(result.result)
                    }
                };
                decodeQR.decode(image.bitmap);
            });
        })
    }catch(ex)
    {
        return null;
    }

    return tmpRes;
}
