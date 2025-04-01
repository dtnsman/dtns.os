
window.captcha_c = {}
// const captcha_c_token_name = OBJ_TOKEN_NAME
// const captcha_c_api_base   = OBJ_API_BASE
// const captcha_c_token_root = OBJ_TOKEN_ROOT

captcha_c.routers =function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/captcha/question',urlParser,session_filter,captcha_c.question)
    app.all('/captcha/answer',urlParser,session_filter,captcha_c.answer) //订阅
}

captcha_c.question = question
async function question(req,res)
{
    let {user_id} = str_filter.get_req_data(req)
    let ret = await g_axios.get('http://captcha.dtns.top/q')
    console.log('ret:',ret)
    if(typeof Buffer == 'undefined') ret = ret ? ret.data :ret
    let code = ret && ret.text && ret.data ? (''+ret.text).toLowerCase() :null //''+parseInt(Math.random()*10000)
    if(!code) return res.json({ret:false,msg:'create-captcha-code failed!'})
    user_redis.set('captcha:'+user_id+'-'+code,code,60*10)//10分钟超时
    res.json({ret:true,msg:'success',code:'***',data:ret.data})
}

captcha_c.answer = answer
async function answer(req,res)
{
    let {user_id,code} = str_filter.get_req_data(req)
    code = (''+code).toLowerCase() //小写
    let str = await user_redis.get('captcha:'+user_id+'-'+code)
    if(str == code)
    {
        g_node_side_event_bus.emit('api_monitor_unlock',{peer:req.peer})
        console.log('answer-code-is-ok,call api_monitor_unlock-event-bus-func')
        user_redis.del('captcha:'+user_id+'-'+code)
        return res.json({ret:true,msg:'success'})
    }
    res.json({ret:false,msg:'code is unmatch'})
}