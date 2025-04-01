const str_filter = require('../../libs/str_filter')

/**
 * 云盘的插件代码
 */
if(typeof window == 'undefined') window = globalThis
window.rtphone_c = {}
if(typeof OBJ_TOKEN_NAME!='undefined' )
{
    const rtphone_c_token_name = OBJ_TOKEN_NAME
    const rtphone_c_api_base   = OBJ_API_BASE
    const rtphone_c_token_root = OBJ_TOKEN_ROOT
}


rtphone_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtphone/call',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.call)
    app.all('/rtphone/sms/send',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.sendSms)
    app.all('/rtphone/robot/action',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.robotAction)
    app.all('/rtphone/robot/do',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.doAction)
    app.all('/rtphone/robot/do/timeout',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.doActionTimeout)
    app.all('/rtphone/robot/ui/dump',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.dumpUI)
    app.all('/rtphone/robot/pic/upload',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.uploadPic)
    app.all('/rtphone/robot/phones',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.phones)
    app.all('/rtphone/robot/screencap',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.screenCap)
    app.all('/rtphone/robot/circles',urlParser,session_filter,systemcmd_c.systemcmd_allows_filter, rtphone_c.circles)
    // app.all('/rtphone/xxx/action',urlParser,rtphone_c.robotAction)
    app.all('/rtphone/poplang/apps',urlParser,rtphone_c.getPoplangApps)
}

rtphone_c.call = async function(req,res)
{
    let {phone} = str_filter.get_req_data(req)
    //adb shell am start -a android.intent.action.VIEW -d  http://google.com
    //打开某些应用
    //adb shell am start -n com.package.name/com.package.name.MainActivity
    //adb shell am start -n com.package.name/.MainActivity
    //$ adb shell monkey -p com.android.contacts -c android.intent.category.LAUNCHER 1
    //Events injected: 1
    let beginTime = Date.now()
    let ret  = await adb_call(' shell am start -a android.intent.action.CALL -d tel:'+phone)//--经测试，安全可靠稳定
    console.log('usedtime:',Date.now()- beginTime)
    if(ret) res.json({ret:true,msg:'success'})
    else res.json({ret:true,msg:'phone call failed'})
    /*
    let ret = await adb_call(' shell input keyevent 3')
    if(ret)
    {
        await adb_call(' shell input tap 120 1456') //点击拨号图标
        await str_filter.sleep(300)
        // await adb_call(' shell input tap 360 1185 1000')//输入+
        await adb_call(' shell input swipe 360 1185 361 1186 1000')
        await str_filter.sleep(1000)
        await adb_call(' shell input tap 633 241')//点击输入框，形成输入焦点
        // await adb_call(' shell input keyevinputent ')
        await adb_call(' shell input text 86'+phone)
        // return 
        await adb_call(' shell input tap 340 1330')
        // await str_filter.sleep(300)
        // await adb_call(' shell input tap 340 1330')
        // await str_filter.sleep(1000)
        // await adb_call(' shell input tap 340 1330')
        res.json({ret:true,msg:'success'})
    }else{
        res.json({ret:true,msg:'phone robot failed'})
    }
    */
}

rtphone_c.sendSms = async function(req,res)
{
    let {phone,sms} = str_filter.get_req_data(req)
    let ret = await adb_call(' shell am start -a android.intent.action.SENDTO -d sms:'+phone+' --es sms_body "'+sms+'" --ez exit_on_sent true')
    await str_filter.sleep(1000)
    // await adb_call(' shell input keyevent 66')
    await adb_call(' shell input tap 658 1455')
    if(ret) res.json({ret:true,msg:'success'})
    else res.json({ret:true,msg:'phone sendSms failed'})
}
/**
 * 控制机器人底盘的移动（前后左右）
 * @param {*} req 
 * @param {*} res 
 */
const actionTimeObj = {lastTime:0,lastAction:null,lastPos:{x:0,y:0}}
rtphone_c.robotAction = async function(req,res)
{
    let {action,timeout} = str_filter.get_req_data(req)
    let ret = false
    //let timeout = 500
    if(!timeout) timeout = 500 //点击触摸的超时时间，可由api调用方指定（分别为不同的路面状态——例如磁砖路面、水泥地面等）
    else timeout = parseInt(timeout)
    if(actionTimeObj.action == action && actionTimeObj.lastTime + timeout > Date.now())
    {
        return res.json({ret:false,msg:'action need 500ms todo!',actionTimeObj,action,timeout,now:Date.now()})
    }
    actionTimeObj.action = action //更新动作
    actionTimeObj.lastTime = Date.now() //更新时间
    let lastStr = actionTimeObj.lastPos.x + actionTimeObj.lastPos.y<1 ? '357 843': actionTimeObj.lastPos.x +' ' + actionTimeObj.lastPos.y 
    if(action =='left')
    {
        actionTimeObj.lastPos.x = 155 
        actionTimeObj.lastPos.y = 843
        ret = await adb_call(' shell input swipe '+lastStr+' 155 843 '+timeout)
    }
    if(action =='right')
    {
        actionTimeObj.lastPos.x = 588 
        actionTimeObj.lastPos.y = 843
        ret = await adb_call(' shell input swipe '+lastStr+' 588 843 '+timeout)
    }
    if(action =='move')
    {
        actionTimeObj.lastPos.x = 357 
        actionTimeObj.lastPos.y = 559
        ret = await adb_call(' shell input swipe '+lastStr+' 357 559 '+timeout)
    }
    if(action =='back')
    {
        actionTimeObj.lastPos.x = 357 
        actionTimeObj.lastPos.y = 1045
        ret = await adb_call(' shell input swipe '+lastStr+' 357 1045 '+timeout)
    }
    if(ret) res.json({ret:true,msg:'success'})
    else res.json({ret:false,msg:'phone robot action failed'})
}
//dump-ui-xml布局
rtphone_c.dumpUI = async function(req,res)
{
    let time = Date.now()
    let {action} = str_filter.get_req_data(req)
    //2024-7-4原指令 shell /system/bin/uiautomator dump --compressed /data/local/tmp/uidump0.xml
    let ret = await adb_call(' shell /system/bin/uiautomator dump /data/local/tmp/uidump0.xml')
    if(!ret) return res.json({ret:false,msg:'dumpUI action failed'})

    let dst_file_path = __dirname+'/data/'+Date.now()+"-"+(parseInt( Math.random()*100000 ) %99999) + '.xml'
    ret = await adb_call(' pull /data/local/tmp/uidump0.xml '+dst_file_path)//./1.xml')
    console.log('used-time:',Date.now()-time)
    if(!ret) return res.json({ret:false,msg:'pull file to pc failed'})
    
    const fs = require('fs');
    let str = await new Promise((resolve)=>{
        fs.readFile(dst_file_path,'utf8',function(error,data){
            if(error){
                resolve(null)
            }else{
                resolve(data)
            }
        })
    })
    if(true)
    try{
        fs.unlink(dst_file_path,(err)=>{
            if(err) console.log('unlink-err:',err)
        })
    }catch(ex){
        console.log('unlink-file-ex:'+ex,ex)
    }
    if(!str) return res.json({ret:false,msg:'read xml file failed'}) 
    // console.log('xml-str:',str)
    const convert = require('xml-js');
    const result = convert.xml2json(str, {compact: true, spaces: 4});
    // console.log('xml-js:result:',result)
    res.json({ret:true,msg:'success',ui:JSON.parse(result).hierarchy})
}
/**
 * 保存相片
 * @param {*} req 
 * @param {*} res 
 */
rtphone_c.uploadPic = async function(req,res)
{
    let {data} = str_filter.get_req_data(req)
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const dataBuffer = new Buffer(base64Data, 'base64');
    const fs = require('fs')
    fs.writeFile(__dirname+"/data/pic.png", dataBuffer, function(err) {
        if(err){
            res.json({ret:false,msg:'save pic to data-dir failed'})
        }else{
            res.json({ret:true,msg:'success'})
        }
    });
}
//找到布局中的phones
rtphone_c.phones = async function(req,res)
{
    let time = Date.now()
    let {action} = str_filter.get_req_data(req)
    //2024-7-4原指令 shell /system/bin/uiautomator dump --compressed /data/local/tmp/uidump0.xml
    let ret = await adb_call(' shell /system/bin/uiautomator dump /data/local/tmp/uidump0.xml')
    if(!ret) return res.json({ret:false,msg:'dumpUI action failed'})

    let dst_file_path = __dirname+'/data/'+Date.now()+"-"+(parseInt( Math.random()*100000 ) %99999) + '.xml'
    ret = await adb_call(' pull /data/local/tmp/uidump0.xml '+dst_file_path)//./1.xml')
    console.log('used-time:',Date.now()-time)
    if(!ret) return res.json({ret:false,msg:'pull file to pc failed'})
    
    const fs = require('fs');
    let str = await new Promise((resolve)=>{
        fs.readFile(dst_file_path,'utf8',function(error,data){
            if(error){
                resolve(null)
            }else{
                resolve(data)
            }
        })
    })
    if(true)
    try{
        fs.unlink(dst_file_path,(err)=>{
            if(err) console.log('unlink-err:',err)
        })
    }catch(ex){
        console.log('unlink-file-ex:'+ex,ex)
    }
    if(!str) return res.json({ret:false,msg:'read xml file failed'}) 
    // console.log('xml-str:',str)
    if(str.indexOf('拨打电话')<0) return res.json({ret:false,msg:'phones is empty'})
    const convert = require('xml-js');
    const result = convert.xml2json(str, {compact: true, spaces: 4});
    // console.log('xml-js:result:',result)
    const phones = filter_uijson(JSON.parse(result).hierarchy,'text','1')
    const list = []
    for(let i=0;i<phones.length;i++)
    {
        let obj = phones[i]
        const regex = /(1[0-9]{10})/g 
        if(regex.test( obj.text) ) 
        {
            let text = obj.text
            //过滤掉<font></font>标签
            if(text.indexOf('>')>0){
                text = text.split('>')[1].split('<')[0]
            } 
            text = text.trim()
            list.push(text)
        }
    }
    res.json({ret:true,msg:'success',list})
}

rtphone_c.screenCap = async function(req,res)
{
    let {f,q} = str_filter.get_req_data(req)
    let time = Date.now()
    // let {action} = str_filter.get_req_data(req)
    let ret = await adb_call(' shell screencap -p /sdcard/screen.png')
    if(!ret) return res.json({ret:false,msg:'screencap action failed'})

    let dst_file_path = __dirname+'/data/'+Date.now()+"-"+(parseInt( Math.random()*100000 ) %99999) + '.png'
    ret = await adb_call(' pull /sdcard/screen.png '+dst_file_path)//./1.xml')
    console.log('used-time:',Date.now()-time)
    if(!ret) return res.json({ret:false,msg:'pull file to pc failed'})
    
    const fs = require('fs');
    setTimeout(()=>{
        if(true)
        try{
            fs.unlink(dst_file_path,(err)=>{
                if(err) console.log('unlink-err:',err)
            })
        }catch(ex){
            console.log('unlink-file-ex:'+ex,ex)
        }
    },1000)
    if(f == 'webp')//针对rtphone.dpkg 2024-12-6
    {
        const sharp = require('sharp')
        q = parseInt(q) == q ? parseInt(q) :20
        let base64 = (await (sharp(dst_file_path).webp({quality:q})).toBuffer()).toString('base64')
        return res.json({ret:true,msg:'success',base64:'data:image/webp;base64,'+base64})
    }
    let buffer = await new Promise((resolve)=>{
        fs.readFile(dst_file_path,function(error,data){
            if(error){
                resolve(null)
            }else{
                resolve(data)
            }
        })
    })
    if(!buffer) return res.json({ret:false,msg:'read screencap file failed'}) 
    // console.log('xml-js:result:',result)
    res.json({ret:true,msg:'success',base64:'data:image/png;base64,'+buffer.toString('base64')})
}
/**
 * 得到截图的指定地点标注的circles
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
rtphone_c.circles = async function(req,res) 
{
    let {colors} = str_filter.get_req_data(req)
    if(colors && colors.indexOf('[')==0) colors = JSON.parse(colors)
    let ret = await adb_call(' shell screencap -p /sdcard/screen.png')
    if(!ret) return res.json({ret:false,msg:'screencap action failed'})

    let dst_file_path = __dirname+'/data/'+Date.now()+"-"+(parseInt( Math.random()*100000 ) %99999) + '.png'
    ret = await adb_call(' pull /sdcard/screen.png '+dst_file_path)//./1.xml')
    console.log('used-time:',Date.now()-time)
    if(!ret) 
        return res.json({ret:false,msg:'pull file to pc failed'})

    const centerW = 500, centerH = 800
    if(true)
    {
        const {Jimp} = require('jimp');
        const timeBegin = Date.now()
        // console.log('jimp:',Jimp)
        const image = await Jimp.read(dst_file_path);
        console.log('img:',image,image.bitmap.data.byteLength,image.bitmap.data[0],image.bitmap.data[1],image.bitmap.data[2],image.bitmap.data[3])
        let ret = colors ?  find(image.bitmap,colors) :  find(image.bitmap)
        if(ret.length>0) ret = [{x:centerW,y:centerH}].concat(ret)
        let circles = filterByCircle(ret.result)
        circles = filterByCnt(circles,300)
        // console.log('ret:',ret)
        console.log('ret-filter:',circles)
        if(circles.length>1 && circles[0].x == centerW && circles[0].y == centerH ) circles[0].y = 0 //去掉
        console.log('used-time-all:',Date.now()-timeBegin)
        res.json({ret:true,msg:'success',list:filterByHeight(circles),circles,square:filterBySquare(filterByHeight(circles)),width:ret.w,height:ret.h})
    }

    function find(img,colors = [[182,88,234],[246,152,37]] ,r=24) //[[203,115,241],[247,114,130]]
    {
        const timeBegin = Date.now()
        const data = img.data
        console.log('width:',img.width)
        console.log('height:',img.height)
        console.log('data:',data)
        const w=img.width;
        const h=img.height;
        const result = []
        for(var i =0,len = data.length; i<len;i+=4){
            let index = i/4 
            let posX = index%w +1 
            let posY = parseInt(index/w) +1 
            // continue
            if(filterColor(colors,data[i],data[i+1],data[i+2],24))
            {
                // console.log('ok-color:',posX,posY)
                result.push({x:posX,y:posY,r:data[i],g:data[i+1],b:data[i+2]})
            }
        //     //182.88.234
        //     //246.152.37
        //     let a = data[i]-203
        //     let b = data[i+1]-115
        //     let c = data[i+2]-241
        //     let aa = data[i]-247
        //     let bb = data[i+1]-114
        //     let cc = data[i+2]-130
        //     let maxR = r

        //     let index = i/4 
        //     let posX = index%w +1 
        //     let posY = parseInt(index/w) +1 
        //     // continue
        //     if(Math.abs(a) <= maxR &&  Math.abs(b) <=maxR && Math.abs(c)  <=maxR || Math.abs(aa) <= maxR &&  Math.abs(bb) <=maxR && Math.abs(cc)  <=maxR)
        //     {
        //         // console.log('ok-color:',posX,posY)
        //         result.push({x:posX,y:posY})
        //     }
        }
        console.log('used-time:',Date.now()-timeBegin)
        return {result,w,h}
    }
    function filterColor(colors, r,g,b, maxR = 25)
    {
        for(let i=0;colors && i<colors.length;i++)
        {
            let color = colors[i]
            let xa = color[0] - r 
            let xb = color[1] - g
            let xc = color[2] - b
            // alert('a:'+xa+' b:'+xb+' c:'+xc)
            if(Math.abs(xa) <= maxR &&  Math.abs(xb) <=maxR && Math.abs(xc)  <=maxR) return true
        }
        return false
    }
    function notInCircles(data,position,r)
    {
        for(let i=0;i<data.length;i++)
        {
            let oPos = data[i]
            const tr = i == 0 ? r+60 : r //500-800
            if(Math.abs(oPos.x - position.x) <r &&  Math.abs(oPos.y - position.y) < r )
            {
                if(oPos.cnt) oPos.cnt++
                else  oPos.cnt = 2
                return false
            } 
        }
        return true
    }
    function filterByCircle(data,r = 150)
    {
        const result = []
        for(let i=0;i<data.length;i++)
        {
            if(result.length<=0) result.push(data[i])
            else if(notInCircles(result,data[i],r)) result.push(data[i])
        }
        return result
    }
    function filterByCnt(data,r = 150)
    {
        const result = []
        for(let i=0;i<data.length;i++)
        {
            if(data[i].cnt>r) result.push(data[i])
        }
        return result
    }
    function filterByHeightArea(data,maxH , r = 0.33)
    {
        const result = []
        for(let i=0;i<data.length;i++)
        {
            if(data[i].y > r*maxH && data[i].y < r*maxH+r*maxH) result.push(data[i])
        }
        return result
    }
    function filter2Colors(data)
    {
        const result = []
        for(let i=0;i<data.length;i++)
        {
            result.push([data[i].r,data[i].g,data[i].b])
        }
        return result
    }
    function filterByHeight(data,minHeight = 200)
    {
        const result = []
        for(let i=0;i<data.length;i++)
        {
            if(data[i].y>= minHeight) result.push(data[i])
        }
        return result
    }
    //提供上下左右四个极限值，以便跳出当前局部最优（汇聚点过多，导致random会陷入局部多数循环）
    function filterBySquare(data)
    {
        if(data.length<1) return []
        const result1 = data.sort(function(a,b){return b.x - a.x})
        const result2 = data.sort(function(a,b){return b.y - a.y})
        return [result1[0],result1[result1.length-1],
                result2[0],result2[result2.length-1]]
    }
}
//执行多种任意adb指令
rtphone_c.doAction = async function(req,res)
{
    let time = Date.now()
    let {action,random} = str_filter.get_req_data(req)
    let ret = await adb_call(' '+action)
    if(!ret) return res.json({ret:false,msg:'do action failed'})
    else res.json({ret:true,msg:'success',action,usedTime:Date.now()-time,random})
}

//执行多种任意adb指令 timeout函数
rtphone_c.doActionTimeout = async function(req,res)
{
    let time = Date.now()
    let {action,random,timeout} = str_filter.get_req_data(req)
    if(!timeout) timeout = 500 //点击触摸的超时时间，可由api调用方指定（分别为不同的路面状态——例如磁砖路面、水泥地面等）
    else timeout = parseInt(timeout)
    if(actionTimeObj.lastTime + timeout > Date.now())
    {
        return res.json({ret:false,msg:'action need '+timeout+' todo!',actionTimeObj,action,timeout,now:Date.now()})
    }
    actionTimeObj.lastTime = Date.now() //更新时间

    let ret = await adb_call(' '+action)
    if(!ret) return res.json({ret:false,msg:'do action failed'})
    else res.json({ret:true,msg:'success',action,usedTime:Date.now()-time,random})
}

// rtphone_c.call({params:{'phone':18675516875}})
// rtphone_c.sendSms({params:{'phone':18675516875,'sms':'hello'}})
// rtphone_c.doAction({params:{'phone':18675516875}})

// rtphone_c.dumpUI({params:{'phone':18675516875}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('dump-ui-ret-data:',retData.length)
//     let beginTime = Date.now()
//     let uiResult = filter_uijson(data.ui,'class','android.widget.TextView')
//     console.log('uiResult:',JSON.stringify(uiResult))
//     let tmp = filter_uijson(uiResult,'text','机甲')
//     console.log('uiResult2:',JSON.stringify(tmp),Date.now()-beginTime)
// }})

// rtphone_c.dumpUI({params:{'phone':18675516875}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('dump-ui-ret-data:',retData.length)
//     let beginTime = Date.now()
//     let uiResult = filter_uijson(data.ui,'class','android.widget.Button')
//     console.log('uiResult:',JSON.stringify(uiResult))
//     let tmp = filter_uijson(uiResult,'content-desc','推荐')
//     console.log('uiResult2:',JSON.stringify(tmp),Date.now()-beginTime)
// }})

// rtphone_c.dumpUI({params:{'phone':18675516875}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('dump-ui-ret-data:',retData.length)
//     let beginTime = Date.now()
//     let uiResult = filter_uijson(data.ui,'class','android.widget.LinearLayout')
//     console.log('uiResult:',JSON.stringify(uiResult))
//     let tmp = filter_uijson(uiResult,'content-desc','儿童')//'律师')
//     console.log('uiResult2:',JSON.stringify(tmp),Date.now()-beginTime)
// }})

// rtphone_c.dumpUI({params:{'phone':18675516875}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('dump-ui-ret-data:',retData.length)
//     let beginTime = Date.now()
//     let uiResult = filter_uijson(data.ui,'class','android.widget.LinearLayout')
//     console.log('uiResult:',JSON.stringify(uiResult))
//     let tmp = filter_uijson(uiResult,'content-desc','小猫')//'律师')
//     console.log('uiResult2:',JSON.stringify(tmp),Date.now()-beginTime)
// }})
function filter_uijson(json,attr,value)
{
    // console.log('filter_uijson:',json)
    if(!json) return null
    let result = []
    if(json.length>0)
    {
        for(let i=0;i<json.length;i++)
        {
            let tmp = filter_uijson(json[i],attr,value) //如是数组，递归调用
            if(tmp) result = result.concat(tmp)
        }
        return result
    }
    if(json['class'])//[attr])//['class'])//专门处理uiResult是[]数组的情况下多次filter
    {
        // console.log('filter_uijson-class:',json[attr],value,(''+json[attr]).indexOf(value)>=0)
        if(value.indexOf('-'))
        {
          let filterVals = value.split('-')
          for(let i=0;i<filterVals.length;i++)
          {
            const value = filterVals[i]
            if(attr && (''+json[attr]).toLowerCase().indexOf(value.toLowerCase())>=0) return [json]
            if(!attr && JSON.stringify(json).toLowerCase().indexOf(value.toLowerCase())>=0) return json
          }
        }else
        {
          if(attr && (''+json[attr]).toLowerCase().indexOf(value.toLowerCase())>=0) return [json]
          if(!attr && JSON.stringify(json).toLowerCase().indexOf(value.toLowerCase())>=0) return json
        }
        return []
    }
    //传统的ui-xml-json处理
    for(key in json)
    {
        // console.log('filter_uijson-key:',key)
        let data = json[key]
        if(key!='node')
        {
          //2024-7-9扩展——以支持使用分割方式进行多关键词匹配
          if(value.indexOf('-'))
          {
            let filterVals = value.split('-')
            for(let i=0;i<filterVals.length;i++)
            {
              const value = filterVals[i]
              if(attr &&  data[attr] && (''+data[attr]).toLowerCase().indexOf(value.toLowerCase())>=0) result.push(data)
              if(!attr &&  JSON.stringify(data).toLowerCase().indexOf(value.toLowerCase())>=0) result.push(data)
            }
          }
          else
          {
            if(attr &&  data[attr] && (''+data[attr]).toLowerCase().indexOf(value.toLowerCase())>=0) result.push(data)
            if(!attr &&  JSON.stringify(data).toLowerCase().indexOf(value.toLowerCase())>=0) result.push(data)
          }
        }
        //针对node特殊处理
        if(key=='node' && data.length) 
        {
            for(let i=0;i<data.length;i++)
            {
                let tmp = filter_uijson(data[i],attr,value) //如是数组，递归调用
                if(tmp) result = result.concat(tmp)
            }
        }else if(key =='node' && !data.length)
        {
            let tmp = filter_uijson(data,attr,value) //如是数组，递归调用
            if(tmp) result = result.concat(tmp)
        }
    }
    return result
}

// rtphone_c.doAction({params:{'action':'shell input swipe 500 765 100 766 500'}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('action-ret-data:',retData,retData.length)
// }})

// rtphone_c.doAction({params:{'action':'shell screencap -p /sdcard/screen.png'}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('action-ret-data:',retData,retData.length)
// }})

// rtphone_c.doAction({params:{'action':' pull /sdcard/screen.png'}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('action-ret-data:',retData,retData.length)
// }})

// rtphone_c.screenCap({params:{'action':''}},{json:function(data){
//     let retData = JSON.stringify(data)
//     console.log('screenCap-ret-data:',retData.length)
// }})
/**
 * 执行adb 命令（默认adb connect 手机了）
 * @param {*} cmd 
 * @returns 
 */
async function adb_call(cmd)
{
    const { exec } = require('child_process');
    let time = Date.now()
    let result = await new Promise((resolve)=>{
        //'type '+filename+"|
        let commandX = exec(__dirname+"/platform-tools/adb "+cmd, (err, stdout, stderr) => {
            if(err ) {
                console.log("adb_call failed" , err , stderr);
                resolve(false)
            }
            // res.json({ret:false,msg:'success'})
            console.log('stdout: ',stdout);
            // console.log(`stderr: ${stderr}`);
            resolve(true)
        })
        commandX.stdin.end();
        commandX.on('close', function(code) {
            console.log("adb_call-exec close -- code:",  code);
        });
        setTimeout(()=>resolve(false),10000)
    })
    return result
}

const file_util = require('../../libs/file_util')
rtphone_c.getPoplangApps =  async function(req,res) 
{
    try{
        let jsonStr = await file_util.readFile(window.config.runtime_current_dir +'/setting/rtphone-pop-apps.json')
        if(jsonStr){
            res.json({ret:true,msg:'success',list:JSON.parse(jsonStr)})
        }
    }catch(ex)
    {
        console.log('rtphone_c.defaultApps-ex:'+ex,ex)
    }
    return res.json({ret:false,msg:'pop-apps.json is empty or not json-file'})
}
