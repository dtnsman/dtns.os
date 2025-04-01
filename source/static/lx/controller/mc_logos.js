/**
 * 此文件用于批量生成默认的图片id-list
 */
// const rpc_query = require('./rpc_api_config').rpc_query
// const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
//     ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
//     GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
//     PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
//     RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
//     SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
//     OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
//     MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
//     VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('./rpc_api_config')

// const rpc_api_util = require('./rpc_api_util');
// const file_c = require('./controller/file_c');
const mc_logos = {}
window.mc_logos = mc_logos
const mc_logos_list_id = OBJ_TOKEN_NAME+'_0000000000000001';//OBJ_TOKEN_ROOT;
window.mc_logos.mc_logos_list_id =mc_logos_list_id;
const mc_logos_num = 30;
const mc_relate_opcode = 'relm'
const mc_logos_path=__dirname+'/public/mc_logos/'
const mc_logos_fmt = '.jpeg'

let mc_logos_list = null;

/**
 * 查询得到mc_logos
 */
window.mc_logos.query_mc_logos = query_mc_logos
async function query_mc_logos()
{
    await rpc_api_util.s_query_token_id(OBJ_API_BASE,OBJ_TOKEN_ROOT,mc_logos_list_id);
    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,mc_logos_list_id,mc_relate_opcode,0,1000,false,function(a){return {}})
    if(!list||!list.length)
    {
        // let cnt = 0 ;
        // for(let i=0;i<mc_logos_num;i++)
        // {
        //     let uploadRet = await file_c.upload_static_file(mc_logos_path+(i+1)+mc_logos_fmt);
        //     console.log('query_mc_logos-upload_static_file-:'+i+' path:'+mc_logos_path+' ret:'+JSON.stringify(uploadRet))
        //     if(uploadRet && uploadRet.ret && uploadRet.filename)
        //     {
        //         let relateRet = await rpc_api_util.s_save_into_token_list(OBJ_API_BASE,mc_logos_list_id,uploadRet.filename,mc_relate_opcode,'add to list');
        //         if(!relateRet) relateRet = await rpc_api_util.s_save_into_token_list(OBJ_API_BASE,mc_logos_list_id,uploadRet.filename,mc_relate_opcode,'add to list');
        //         cnt+= relateRet ? 1:0;
        //     }
        // }
        // console.log('upload and relate success cnt:'+cnt);
    }

    list = !list||!list.length ? await rpc_api_util.s_query_token_list(OBJ_API_BASE,mc_logos_list_id,mc_relate_opcode,0,1000,false,function(a){return {}}) :list;
    let results = [];
    for(let i=0;list && i<list.length;i++)
    {
        results.push(list[i].token_y)
    }

    mc_logos_list = results
    return results;
}
//mc_logos_list为内存缓存
window.mc_logos.get_list =get_list;
async function get_list()
{
    let list   = !mc_logos_list ? await query_mc_logos() :mc_logos_list;
    query_mc_logos();
    console.log('list:'+JSON.stringify(list))
    return list;
}

/**
 * 清除缓存
 */
window.mc_logos.clear_list_cache =clear_list_cache;
async function clear_list_cache()
{
    mc_logos_list = null;
}

// get_list();