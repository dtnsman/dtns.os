
/**
 * 基于LLM的简单知识库的实现（未来将使用LLM的全局记忆能力来实现）
 * 2025-4-11
 */
if(typeof window == 'undefined') globalThis.window = globalThis
window.rtusercase_c = {}
// const rtusercase_c_token_name = OBJ_TOKEN_NAME
// const rtusercase_c_api_base   = OBJ_API_BASE
// const rtusercase_c_token_root = OBJ_TOKEN_ROOT
// const rtusercase_setting = require('../../setting/rtusercase_setting.json')

rtusercase_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/rtusercase/new',urlParser,rtusercase_c.new)//基于folder-id进行恢复所有的内容。
}

rtusercase_c.new = async function(req,res) 
{
    let s_id = str_filter.randomBytes(16);
    let user_id = 'user_case'+str_filter.randomBytes(12)
    user_redis.set(ll_config.redis_key+":session:"+user_id+"-"+s_id,s_id,window.g_user_case_session_timeout < 3 ? 3*60*60 :window.g_user_case_session_timeout)
    res.json({ret:true,msg:'success',user_id,s_id})
}