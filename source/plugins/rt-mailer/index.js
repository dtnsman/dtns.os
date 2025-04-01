window.rtmailer_c = {}
// const rtmailer_c_token_name = OBJ_TOKEN_NAME
// const rtmailer_c_api_base   = OBJ_API_BASE
// const rtmailer_c_token_root = OBJ_TOKEN_ROOT

rtmailer_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtmailer/send',urlParser,session_filter,rtmailer_c.send)//
}
const http_req = require('../../libs/http_request')
rtmailer_c.send = async function(req,res)
{
    let params = str_filter.get_req_data(req)
    if(!params.to) return res.json({ret:false,msg:'to is error'})
    let ret = await http_req.http_get('http://127.0.0.1:30555/mail/send',params)
    console.log('send-mail-ret:',ret )
    // console.info('send-mail-ret:',ret ,params)
    res.json(ret)
}
