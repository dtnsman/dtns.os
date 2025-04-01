const rtpc_robot = require("robotjs");
const sharp = require('sharp');
const str_filter = require('../../libs/str_filter')

/**
 */
if(typeof window == 'undefined') window = globalThis
window.rtpc_c = {}
if(typeof OBJ_TOKEN_NAME!='undefined' )
{
    const rtpc_c_token_name = OBJ_TOKEN_NAME
    const rtpc_c_api_base   = OBJ_API_BASE
    const rtpc_c_token_root = OBJ_TOKEN_ROOT
}


rtpc_c.routers = function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtpc/mouse/delay',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseDelay)
    app.all('/rtpc/mouse/move',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseMove)
    app.all('/rtpc/mouse/move/smooth',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseMoveSmooth)
    app.all('/rtpc/mouse/click',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseClick)
    app.all('/rtpc/mouse/scroll',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseScroll)
    app.all('/rtpc/mouse/drag',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseDrag)
    app.all('/rtpc/mouse/toggle',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.mouseToggle)
    app.all('/rtpc/mouse/pos',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.getMousePos)
    app.all('/rtpc/key/board/delay',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.keyboardDelay)
    app.all('/rtpc/key/tap',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.keyTap)
    app.all('/rtpc/key/toggle',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.keyToggle)
    app.all('/rtpc/string/type',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.stringType)
    app.all('/rtpc/string/type/delay',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.stringTypeDelay)
    app.all('/rtpc/screen/size',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.getScreenSize)
    app.all('/rtpc/screen/color',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.getPixelColor)
    app.all('/rtpc/screen/cap',urlParser,session_filter,window.systemcmd_allows_filter,rtpc_c.screenCap)
    app.all('/rtpc/poplang/apps',urlParser,session_filter,rtpc_c.getPoplangApps)
}

// Speed up the mouse.
rtpc_robot.setMouseDelay(2);
rtpc_c.mouseDelay = async function(req,res)
{
    let {delay} = str_filter.get_req_data(req)
    if(!delay || parseInt(delay)!=delay) return res.json({ret:false,msg:'param dealy error'})
    delay = parseInt(delay)
    rtpc_robot.setMouseDelay(delay);
    res.json({ret:true,msg:'success'})
}
rtpc_c.getScreenSize = async function(req,res) 
{
    let screenSize = rtpc_robot.getScreenSize();
    screenSize.ret = true
    screenSize.msg = 'success'
    res.json(screenSize)
}
rtpc_c.getPixelColor = async function(req,res) 
{
    let {x,y} = str_filter.get_req_data(req)
    if(parseInt(x)!=x || parseInt(y)!=y) return res.json({ret:false,msg:'param x-y error'})
    x = parseInt(x)
    y = parseInt(y)
    let hex = rtpc_robot.getPixelColor(x, y);
    res.json({ret:true,msg:'success',hex})
}
rtpc_c.mouseMove = async function(req,res) 
{
    let {x,y,click,delta} = str_filter.get_req_data(req)
    // if(parseInt(x)!=x || parseInt(y)!=y) return res.json({ret:false,msg:'param x-y error'})
    // x = parseInt(x)
    // y = parseInt(y)
    let dx = x , dy = y
    //以偏移值进行移动鼠标位置
    if(delta)
    {
        let {x,y} = rtpc_robot.getMousePos()
        rtpc_robot.moveMouse(x+dx,y+dy);
    }
    else rtpc_robot.moveMouse(x,y);
    if(click) 
    {
        // rtpc_robot.mouseClick()
        rtpc_robot.mouseToggle('down','left')
        rtpc_robot.mouseToggle('up','left')
    }
    res.json({ret:true,msg:'success'})
}
rtpc_c.mouseMoveSmooth = async function(req,res) 
{
    let {x,y,speed,click} = str_filter.get_req_data(req)
    if(parseInt(x)!=x || parseInt(y)!=y) return res.json({ret:false,msg:'param x-y error'})
    x = parseInt(x)
    y = parseInt(y)
    rtpc_robot.moveMouseSmooth(x,y,speed);
    if(click){
        // rtpc_robot.mouseClick()
        rtpc_robot.mouseToggle('down','left')
        rtpc_robot.mouseToggle('up','left')
    } 
    res.json({ret:true,msg:'success'})
}
rtpc_c.mouseClick = async function(req,res) 
{
    let {button,double} = str_filter.get_req_data(req)
    if(button && double)
        rtpc_robot.mouseClick(button,true)
    else if(button)
    {
        ///rtpc/mouse/toggle?button=left&down=down
        ///rtpc/mouse/toggle?button=left&down=up
        //rtpc_robot.mouseClick(button)
        rtpc_robot.mouseToggle('down',button)
        rtpc_robot.mouseToggle('up',button)
    }
    else
    {
        // rtpc_robot.mouseClick()
        rtpc_robot.mouseToggle('down','left')
        rtpc_robot.mouseToggle('up','left')
    }
    res.json({ret:true,msg:'success'})
}
rtpc_c.mouseScroll = async function(req,res) 
{
    let {x,y} = str_filter.get_req_data(req)
    rtpc_robot.scrollMouse(x,y)
    res.json({ret:true,msg:'success'})
}
rtpc_c.mouseDrag = async function(req,res) 
{
    let {x,y} = str_filter.get_req_data(req)
    rtpc_robot.dragMouse(x,y)
    res.json({ret:true,msg:'success'})
}
rtpc_c.mouseToggle = async function(req,res) 
{
    let {down,button} = str_filter.get_req_data(req)
    rtpc_robot.mouseToggle(down,button)
    res.json({ret:true,msg:'success'})
}
rtpc_c.getMousePos = async function(req,res) 
{
    let {x,y} = rtpc_robot.getMousePos()
    res.json({ret:true,msg:'success',x,y})
}

rtpc_c.keyboardDelay = async function(req,res) 
{
    let {ms} = str_filter.get_req_data(req)
    rtpc_robot.setKeyboardDelay(ms)
    res.json({ret:true,msg:'success'})
}

rtpc_c.keyTap = async function(req,res) 
{
    let {key,p} = str_filter.get_req_data(req)
    if(p)  rtpc_robot.keyTap(key,JSON.parse(p))
    else rtpc_robot.keyTap(key)
    res.json({ret:true,msg:'success'})
}

rtpc_c.keyToggle = async function(req,res) 
{
    let {key,down,p} = str_filter.get_req_data(req)
    if(p)  rtpc_robot.keyToggle(key,down,JSON.parse(p))
    else rtpc_robot.keyToggle(key,down)
    res.json({ret:true,msg:'success'})
}

rtpc_c.stringType = async function(req,res) 
{
    let {string} = str_filter.get_req_data(req)
    rtpc_robot.typeString(string)
    res.json({ret:true,msg:'success'})
}

rtpc_c.stringTypeDelay = async function(req,res) 
{
    let {string,cpm} = str_filter.get_req_data(req)
    rtpc_robot.typeStringDelayed(string,cpm)
    res.json({ret:true,msg:'success'})
}

rtpc_c.screenCap = async function(req,res) 
{
    // const {Jimp} = require('jimp')
    // let begin = Date.now()
    const imageData = rtpc_robot.screen.capture();

    const swapRedAndBlueChannel = bmp => {
        for (let i = 0; i < (bmp.width * bmp.height) * 4; i += 4) { // swap red and blue channel
            [bmp.image[i], bmp.image[i + 2]] = [bmp.image[i + 2], bmp.image[i]]; // red channel;
        }
    };
    swapRedAndBlueChannel(imageData)
    
    // console.log('used-time:',Date.now()-begin)

    // console.log('show-img:',imageData)
    imageData.data = imageData.image
    delete imageData.image
    // writeImg(imageData)
    /*
    let img = await Jimp.fromBitmap(imageData)
    // const img = await Jimp.read(buffer,'image/bmp')
    // await img.write('./scap_image.jpg');
    let buffer = await img.getBuffer('image/png')
    let base64 = (await (sharp(buffer).webp({quality:60})).toBuffer()).toString('base64')
    */
   let size = rtpc_robot.getScreenSize()
    let base64 = (await (sharp(imageData.data, { raw: {
        width: imageData.width,
        height: imageData.height,
        channels: 4
      }}).resize(size.width,size.height).webp({quality:50})).toBuffer()).toString('base64')
    // console.log('base64:',base64.substring(0,128),base64.length)
    res.json({ret:true,msg:'success',base64:'data:image/webp;base64,'+base64})
}
const file_util = require('../../libs/file_util')
rtpc_c.getPoplangApps = async function(req,res) 
{
    try{
        let jsonStr = await file_util.readFile(window.config.runtime_current_dir +'/setting/rtpc-pop-apps.json')
        if(jsonStr){
            res.json({ret:true,msg:'success',list:JSON.parse(jsonStr)})
        }
    }catch(ex)
    {
        console.log('rtpc_c.defaultApps-ex:'+ex,ex)
    }
    return res.json({ret:false,msg:'pop-apps.json is empty or not json-file'})
}