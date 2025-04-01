const from_path = './src/'
const dist_path = '../../file_temp/'


async function hashVal(msgUint8Array,hashName = 'SHA-256')
{
    const eccryptoJS =  require('eccrypto-js')
    return  (await eccryptoJS.sha256(msgUint8Array)).toString('hex')
}

async function readFile(url){
    const fs = require('fs');
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

async function copyFiles()
{
    const fs = require('fs');
    // 同步读取上级目录下的所有文件到files中
    const files = fs.readdirSync(from_path);
    console.log('files:',files);
    for(let file in files)
    {
        file = files[file]
        let data = await readFile(from_path+file)
        if(!data){
            console.log('file-'+file+' is empty or dir')
            continue
        }
        let sha256 = await hashVal(new Uint8Array(data))
        fs.copyFileSync(from_path+file,dist_path+sha256)
        console.log('file-'+file+' copy ok!')
    }
}

copyFiles()