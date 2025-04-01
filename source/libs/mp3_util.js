/**
 * Created by lauo.li on 2019/1/28.
 */

const fs = require('fs')


module.exports.convertToMP3 = convertToMP3
async function convertToMP3(file_name,dst_file)
{
    let commands = "/data/mp3_tool/ffmpeg  -i " + file_name + " -acodec libmp3lame -ab 64k -ar 22050 -ac 1 " + dst_file;
    var exec = require('child_process').exec;

    let flag = true;
    await new Promise((resolve,reject)=>{
        exec(commands, function(err,stdout,stderr){
            if(err) {
                console.log('convertToMP3 exec stderr:'+stderr);
                flag = false;
                reject( "failed")
            } else {
                console.log('convertToMP3 exec stdout:'+stdout);
                resolve("success")
            }
        });
    }).then(function(data){
            //console.log("putObject-result-data:"+JSON.stringify(data))
            return data;
        }).catch(function(ex){});

    return flag;
}

/**
 * 转为AMR（提供两种码率,8k 或者 16k）
 * @type {convertToAMR}
 */
module.exports.convertToAMR = convertToAMR
async function convertToAMR(file_name,dst_file,ar='8k')
{
    let commands = "/data/mp3_tool/ffmpeg  -i " + file_name + " -acodec libopencore_amrnb -ar "+ar+" " + dst_file;
    var exec = require('child_process').exec;

    let flag = true;
    await new Promise((resolve,reject)=>{
        exec(commands, function(err,stdout,stderr){
            if(err) {
                console.log('convertToMP3 exec stderr:'+stderr);
                flag = false;
                reject( "failed")
            } else {
                console.log('convertToMP3 exec stdout:'+stdout);
                resolve("success")
            }
        });
    }).then(function(data){
            //console.log("putObject-result-data:"+JSON.stringify(data))
            return data;
        }).catch(function(ex){});

    return flag;
}

/**
 * 删除缓存下来的文件
 * @type {deleteFiles}
 */
module.exports.deleteFiles = deleteFiles
function deleteFiles(args)
{
    if(!args || !(args instanceof Array)) return ;
    var i;
    for(i=0;i<args.length;i++) {
        fs.unlink(args[i], function (err) {
            if (err) {
                throw err;
            }
            console.log('文件:' + newPath + '删除失败！');
        })
    }
}
//public static void convertToMP3(String originFile, String outputFile) {
////        AudioUtils.getAmrConversionMp3(originFile, outputFile);
//    BufferedReader input = null;
//    InputStreamReader ir = null;
//    Process process = null;
//    try {
//        String commands = "/data/temp/ffmpeg  -i " + originFile + " -acodec libmp3lame -ab 64k -ar 22050 -ac 1 " + outputFile;
//        //此处为你ffmpeg  工具的放置路径
//        process = Runtime.getRuntime().exec(commands);
//        // 下方代码用作显示运行结果
//        ir = new InputStreamReader(process.getInputStream());
//        input = new BufferedReader(ir);
//        String line;
//        while ((line = input.readLine()) != null) {
//            System.out.println(line);
//        }
//    } catch (Exception e) {
//        System.out.println("转换失败！");
//        e.printStackTrace();
//    } finally {
//        if (ir != null) {
//            try {
//                ir.close();
//            } catch (IOException e) {
//                e.printStackTrace();
//            }
//        }
//        if (input != null) {
//            try {
//                input.close();
//            } catch (IOException e) {
//                e.printStackTrace();
//            }
//        }
//        if (process != null) {
//            process.destroy();
//        }
//
//    }
//
//}
//

/**
 * 压缩音频流。
 * @type {compressMp3}
 */
module.exports.compressMp3 = compressMp3
async function compressMp3(file_name,dst_file)
{
    let commands = "/data/mp3_tool/ffmpeg  -i " + file_name + " -acodec libmp3lame -ab 64k -ar 22050 -ac 1 " + dst_file;
    var exec = require('child_process').exec;

    let flag = true;
    await new Promise((resolve,reject)=>{
        exec(commands, function(err,stdout,stderr){
            if(err) {
                console.log('convertToMP3 exec stderr:'+stderr);
                flag = false;
                reject( "failed")
            } else {
                console.log('convertToMP3 exec stdout:'+stdout);
                resolve("success")
            }
        });
    }).then(function(data){
            //console.log("putObject-result-data:"+JSON.stringify(data))
        });

        return flag;
}


//public static boolean compressMp3(String originFile, String outputFile) {
//
//    File source = new File(originFile);
//    File target = new File(outputFile);
//    AudioAttributes audio = new AudioAttributes();
//    /** 它设置将用于音频流转码的编解码器的名称 */
//    audio.setCodec("libmp3lame");
//    /** 它设置新重新编码的音频流的比特率值。 */
//    audio.setBitRate(new Integer(128000));
//    /** 它设置将在重新编码的音频流中使用的音频通道的数量（1 =单声道，2 =立体声） */
//    audio.setChannels(new Integer(2));
//    /** 音频流的采样率 如果您想要类似CD的44100 Hz采样率 */
//    audio.setSamplingRate(new Integer(22050));
//    /** 可以调用此方法来改变音频流的音量。值256表示没有音量变化。因此，小于256的值是音量减小，而大于256的值将增加音频流的音量 */
//    audio.setVolume(256);
//
//    EncodingAttributes attrs = new EncodingAttributes();
//    attrs.setFormat("mp3");
//    attrs.setAudioAttributes(audio);
//    Encoder encoder = new Encoder();
//
//    try {
//        encoder.encode(source, target, attrs);
//        System.out.println("恭喜！压缩成功。");
//    } catch (EncoderException e) {
//        System.out.println("压缩失败：");
//        e.printStackTrace();
//        return false;
//    }
//    return true;
//}
/**
 * 得到语音文件的时间和文件大小
 * @type {getAudioInfoByPath}
 */
module.exports.getAudioInfoByPath = getAudioInfoByPath
async function getAudioInfoByPath(file_name)
{
    //audio_len: 33431
    //audio_fmt: audio/mpeg
    //audio_time: 3
    //audio_bit_rate: 80
    //audio_channels: 2
    //0,128,1
    //audio_time,audio_bit_rate,audio_channels)
    //return {audio_bit_rate:128,audio_time:0,audio_len:0,audio_channels:1};

    //audio_len----文件长度。
    let commands = "/data/mp3_tool/ffmpeg  -i " + file_name
    var exec = require('child_process').exec;

    let info ={audio_bit_rate:128,audio_time:0,audio_len:0,audio_channels:1};
    await new Promise((resolve,reject)=>{
        exec(commands, function(err,stdout,stderr){
            if(err) {
                console.log('convertToMP3 exec stderr:'+stderr);

                var Duration = "Duration: "
                var timeStr =  "00:00:00"
                console.log("stderr.indexOf(Duration):"+stderr.indexOf(Duration))
                let begin = stderr.indexOf(Duration) + Duration.length
                console.log("begin:"+begin+",len:"+timeStr.length)
                var result = stderr.substring(begin, begin+timeStr.length);

                console.log("convertToMP3 exec query-time-len:result:"+result)
                let array = result.split(":");

                var time_len = 0;
                var i=0
                for(i=0;i<array.length;i++)
                {
                    if(i==0)
                    {
                        time_len+=parseInt(array[i])*60*60;
                    }
                    if(i==1)
                    {
                        time_len+=parseInt(array[i])*60;
                    }
                    if(i==2)
                    {
                        time_len+=parseInt(array[i]);
                    }
                }

                info.audio_time = time_len

                console.log("convertToMP3 exec info.audio_time:"+info.audio_time)

                reject( "failed")
            } else {
                console.log('convertToMP3 exec stdout:'+stdout);
                resolve("success")
            }
        });
    }).then(function(data){
            //console.log("putObject-result-data:"+JSON.stringify(data))
        }).catch(function(){});

    let states = fs.statSync(file_name);
    info.audio_len = states.size
    return info;
}

//public static AudioInfo getAudioInfoByPath(String filePath) {
//    File source = new File(filePath);
//    Encoder encoder = new Encoder();
//    MultimediaInfo m;
//    AudioInfo audioInfo = new AudioInfo();
//    try {
//        m = encoder.getInfo(source);
//        long ls = m.getDuration();
//        audioInfo.setAudioTime((int) (ls / 1000));
//        Integer bitRate = m.getAudio().getBitRate();
//        audioInfo.setAudioBitRate(bitRate);
//        audioInfo.setAudioChannels(m.getAudio().getChannels());
//    } catch (Exception e) {
//        System.out.println("音频信息获取失败！");
//        e.printStackTrace();
//    }
//    return audioInfo;
//}