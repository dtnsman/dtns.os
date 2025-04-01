/**
 * Created by lauo.li on 2019/1/28.
 */
var http = require('http'); //引入http模块
var url = require('url'); //引入url模块
const fs = require('fs')
const crypto = require('crypto');
const path = require('path');
const request = require('request')
const str_filter=  require('./str_filter')
var FormData = require('form-data');
var mineType = require('mime-types');
// var {FormData} = require("formdata-node")
/**
 * 返回文件（网络返回）
 */
module.exports.responseNetFile=responseNetFile
function responseNetFile(file_url,response)
{
    var options = {
        host: url.parse(file_url).host,
        port: 80,
        path: url.parse(file_url).pathname
    };

    http.get(options, function(res) {
        res.on('data', function(data) {
            response.write(data);
        }).on('end', function() {
            response.end();
        });
    });
}

module.exports.base64file=base64file
function base64file(fileUri,data){
    data = data.toString('base64');
    return 'data:' + mineType.lookup(fileUri) + ';base64,' + data;
}
module.exports.existsFile=existsFile
function existsFile(url)
{
    return new Promise((resolve)=>{
        fs.exists(url,async function(exists) {
            resolve(exists)
        })
    })
}

module.exports.copyFile=copyFile
async function copyFile(old_path,dst_path)
{
    let flag = true;
    await new Promise((resolve,reject)=>{
        fs.copyFile(old_path,dst_path,function (err) {
            if (err) {
                flag = false;
                console.log('copy file failed:' + old_path+ '');
                reject(flag)
            }
            else 
            {
                resolve(flag)
            }
        })

    }).then(function(data){
            //console.log("putObject-result-data:"+JSON.stringify(data))
            return data;
        }).catch(function(ex){
            console.log('copy-ex:'+ex)
            flag = false;
        });

    return flag;
}

module.exports.unlink=unlink
async function unlink(path)
{
    let flag = true;
    await new Promise((resolve,reject)=>{
        fs.unlink(path,function (err) {
            if (err) {
                flag = false;
                console.log('unlink file failed:' + path+ '');
                reject(flag)
            }
            else 
            {
                resolve(flag)
            }
        })


    }).then(function(data){
            //console.log("putObject-result-data:"+JSON.stringify(data))
            return data;
        }).catch(function(ex){
            console.log('unlink-ex:'+ex)
            flag = false;
        });

    return flag
}


module.exports.readFileSha256 = readFileSha256
async function readFileSha256(url){
    return new Promise((reslove) => {
        let md5sum = crypto.createHash('sha256');
        let stream = fs.createReadStream(url);
        stream.on('data', function(chunk) {
            md5sum.update(chunk);
        });
        stream.on('end', function() {
            let fileMd5 = md5sum.digest('hex');
            reslove(fileMd5);
        })
    })
}
module.exports.readFile = readFile
async function readFile(url){
    return new Promise((reslove) => {
        // let buffer = null//Buffer.from([]) //new Buffer([])
        let list = []
        let stream = fs.createReadStream(url,{
            highWaterMark: 1024*1024*2//64*1024*2, //文件一次读多少字节,默认 64*1024
            // flags:'r', //默认 'r'
            // autoClose:true, //默认读取完毕后自动关闭
            // start:0, //读取文件开始位置
            // end:3, //流是闭合区间 包含start也含end
            // encoding:'utf8' //默认null
        });
        stream.on("error", (err) => {console.log("Error occured on " + url,err);reslove(null)})
        stream.on('data', function(chunk) {
            // console.log('chunk.len:'+chunk.length)
            // console.log('chunk-base64:'+chunk.toString('base64').length)
            // buffer = Buffer.concat([buffer,chunk])
            list.push(chunk)
        });
        stream.on('end', function() {
            stream.close()

            reslove(Buffer.concat(list)); 
        })
    })
}
module.exports.writeFile = writeFile
async function writeFile(url,buffer){
    return new Promise((reslove) => {
        let stream = fs.createWriteStream(url)
        stream.write(buffer)

        stream.end()

        stream.on('open', () => {
            console.log('文件已被打开', stream.pending)
        })
        stream.on('ready', () => {
            console.log('文件已为写入准备好', stream.pending)
        })
        stream.on('close', () => {
            console.log('文件已被关闭')
            console.log("总共写入:"+ stream.bytesWritten)
            console.log('写入的文件路径是'+ stream.path)
            reslove(true)
        })
    })
}

module.exports.uploadFile = uploadFile
async function uploadFile(url,params,filePath)
{
    let form = new FormData();
    if(params)
    for(var key in params)
        form.append(key,params[key],'')
    form.append('myfile',fs.createReadStream(filePath),filePath)

    console.log('form:'+JSON.stringify(form))
    //console.log('headers:'+JSON.getHeaders())
    

    let options = {
		method : 'POST',
		url:url,
	    headers : { 'Content-Type' : 'multipart/form-data' },
		formData : form
	};

    let ret = null;
    await new Promise((resolve, reject) => {
    form.submit(url, function(err, res) {
        if(err) reject(err)
        else{
            try{
                resolve(JSON.parse(res.body))
            }catch(ex)
            {
                console.log('submit-ex:'+ex)
            }
        } 
    });
    }).then((data)=>{
        ret = data
    }).catch((ex)=>{
        console.log('submit-exception:'+ex)
        ret = null
    });
    // await new Promise((resolve, reject) => {
	// 	request.post(options,(error, response, body) => {
	// 		if (!error) {
    //             console.log('http-upload-body:'+body)
    //             try{
	// 			    resolve( JSON.parse(body));	
    //             }catch(ex){
    //                 reject(ex)
    //             }
	// 		} else {
	// 			reject(error);
	// 		}
	// 	});
	// }).then((data)=>{
    //     ret = data;
    // }).catch((ex)=>
    // {
    //     console.log('uploadFile-req-ex:'+ex)
    //     ret = null;
    // })
    
    return ret
}
module.exports.uploadMutipartFile = uploadMutipartFile
async function uploadMutipartFile(reqUrl,params,filepath,minetpye){
    
    var boundaryKey = '----' + str_filter.randomBytes(32);
    let urlObj = url.parse(reqUrl)
    console.log('host:'+urlObj.hostname+' port:'+urlObj.port)
    var options = {
         host:urlObj.hostname,//远端服务器域名
        port:urlObj.port,
        method:'POST',
        path:urlObj.path,//上传服务路径
        headers:{
            'Content-Type':'multipart/form-data; boundary=' + boundaryKey,
            'Connection':'keep-alive'
        }
    };
    ret = null;
    await new Promise((resolve, reject) => {
        var req = http.request(options,function(res){
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                //resolve(chunk)
                ret = chunk
                console.log('body: ' + chunk);
            });
            res.on('end',function(){
                resolve(ret)
                console.log('res end.res:'+JSON.stringify(ret));
            });
        });
        for(var key in params){
            console.log('write-params:'+key+' value:'+params[key])
            req.write(
                 '--'+boundaryKey + "\r\n" +
                'Content-Disposition: form-data; name="'+key+"\"\r\n\r\n" +params[key]+"\r\n"
                //  + boundaryKey + '--\r\n'
            );
        }
        req.write(
             '--'+boundaryKey + "\r\n" +
            'Content-Disposition: form-data; name="file"; filename="'+path.basename(filepath)+"\"\r\n" +
            'Content-Type: '+minetpye+"\r\n\r\n"
        );
        //设置1M的缓冲区
        var fileStream = fs.createReadStream(filepath,{bufferSize:1024 * 1024});
        fileStream.pipe(req,{end:false});
        fileStream.on('end',function(){
            req.end("\r\n--" + boundaryKey + '--');
        });  
    }).then((data)=>{
        console.log('http-req-res-data:'+data)
        ret = data;
    }).catch((ex)=>{
        console.log('http-req-res-ex:'+ex)
    })
    try{
        ret = JSON.parse(ret)
    }catch(ex)
    {
        console.log('ret-json failed,ex:'+ex)
    }
    return ret;
}
