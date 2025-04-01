const rp = require('request-promise');
const http = require('https');
const { resolve } = require('path');

let mapkey = 'db8dd93ca24456e7f766b9b6299bd029'

window.location_c = {}
const location_c_token_name = OBJ_TOKEN_NAME
const location_c_api_base   = OBJ_API_BASE
const location_c_token_root = OBJ_TOKEN_ROOT

location_c.routers =function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/location/lnglat2addr',urlParser,session_filter,location_c.lnglat2addr)
    app.all('/location/lnglat2img',urlParser,session_filter,location_c.lnglat2img)
    // app.all('/location/data/all',urlParser,session_filter,location_c.form_all_datas)
}

async function http_get(api_url, data, jsonFlag=true) {
    let res = null;
    let flag = true;

    console.log('rp.get:',rp.get)
    var options = {
        uri:api_url,
        qs:data,
        headers: {
            'User-Agent': 'Request-Promise'
        },
        strictSSL:false,
        // json: true // Automatically parses the JSON string in the response
    };
     
    await rp(options)//.get({ url: api_url, form: data, timeout: 3000 })
        .then((body) => {
            console.log('body:',body)
            if(jsonFlag)
                res = JSON.parse(body);
            else   
                res = body
        }).catch((err) => {
            console.log('http_get-exception:'+err,err)
            flag = false;
            res = null;
        })
    return res;
}
function genAddrUrl(lng,lat)
{
    return 'https://restapi.amap.com/v3/geocode/regeo?output=json&location='+lng+','+lat+'&key='+mapkey+'&radius=1000&extensions=base'
}
function genImgUrl(lng,lat,zoom,width,height)
{
    zoom = zoom ? zoom : 13
    if(!width || !height) {
        width = 400
        height = 300
    }
    return 'https://restapi.amap.com/v3/staticmap?location='+lng+','+lat+'&zoom='+zoom+'&size='+width+'*'+height+'&markers=mid,,A:'+lng+','+lat+'&key='+mapkey
}
/**
 * 将lng-lat转为地址
 */
location_c.lnglat2addr = lnglat2addr
async function lnglat2addr(req,res)
{
    let {lng,lat} = str_filter.get_req_data(req)
    let url = genAddrUrl(lng,lat)
    let addrInfo = await http_get(url,{})
    if(addrInfo && addrInfo.status =='1' && addrInfo.info == 'OK')
    {
        res.json({ret:true,msg:'success',addr_info:addrInfo})
    }else {
        res.json({ret:false,msg:'false',msg:'query addr failed', error_info:addrInfo})
    }
}

location_c.lnglat2img = lnglat2img
async function lnglat2img(req,res)
{
    let {lng,lat,width,height,zoom} = str_filter.get_req_data(req)
    let url = genImgUrl(lng,lat,zoom,width,height)

    let imgdata = await new Promise((resolve)=>{
        let flag = false
        http.get(url, function (res) {
            var chunks = [];
            var size = 0;
            res.on('data', function (chunk) {
                chunks.push(chunk);
                size += chunk.length;　　//累加缓冲数据的长度
            });
            res.on('end', function (err) {
                console.log('lnglat2img-https-err:',err)
                if(size<1024) return resolve(null)
                var data = Buffer.concat(chunks, size);
                var base64Img = data.toString('base64');
                // console.log(`data:image/png;base64,${base64Img}`);
                flag = true
                resolve(`data:image/png;base64,${base64Img}`)
            });
        });
        setTimeout(()=>{if(!flag) resolve(null)},30000)
    })
    console.log('imgdata:',imgdata)
    //返回base64编码数据，由客户端client上传至本web3name，以使得体验更佳
    let lnglat2imgResult =!imgdata ?{ret:false,msg:'lnglat to img-data failed'}:  {ret:true,msg:'success',img_data:imgdata}
    console.log('lnglat2imgResult:',lnglat2imgResult)
    res.json(lnglat2imgResult)
}

async function test()
{
    let url='https://restapi.amap.com/v3/geocode/regeo?output=json&location=113.082426,22.949653&key=db8dd93ca24456e7f766b9b6299bd029&radius=1000&extensions=base'
    let ret =  await http_get(url,{},2)
    // console.log('result-ret:',ret)
    // let start = '<formatted_address>'
    // let end = '</formatted_address>'
    // let startPos = ret.indexOf(start)+start.length
    // let addr = ret.substring(startPos,ret.indexOf(end))
    console.log('ret:',ret)
    console.log('addr:',ret.regeocode.formatted_address)

    url = genUrl(113.122717,23.028762)
    ret = await http_get(url,{},2)
    console.log('center-pos:',ret)

    ret = await http_get('https://restapi.amap.com/v3/staticmap?location=113.082426,22.949653&zoom=13&size=400*300&markers=mid,,A:113.082426,22.949653&key=db8dd93ca24456e7f766b9b6299bd029',{},2)
    console.log('ret',ret)

}

// test()