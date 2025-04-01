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
const fengjing_imgs = {}
window.fengjing_imgs = fengjing_imgs
const fengjing_imgs_list_id = OBJ_TOKEN_NAME+'_0000000000000001';//OBJ_TOKEN_ROOT;
window.fengjing_imgs.fengjing_imgs_list_id =fengjing_imgs_list_id;
const fengjing_imgs_num = 30;
const fj_relate_opcode = 'relf'
const fengjing_imgs_path=__dirname+'/public/fengjing_imgs/'
const fengjing_imgs_fmt = '.jpg'

let fengjing_imgs_list = null;

/**
 * 查询得到fengjing_imgs
 */
window.fengjing_imgs.query_fengjing_imgs = query_fengjing_imgs
async function query_fengjing_imgs()
{
    await rpc_api_util.s_query_token_id(OBJ_API_BASE,OBJ_TOKEN_ROOT,fengjing_imgs_list_id);
    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,fengjing_imgs_list_id,fj_relate_opcode,0,1000,false,function(a){return {}})
    if(!list||!list.length)
    {
        // let cnt = 0 ;
        // for(let i=0;i<fengjing_imgs_num;i++)
        // {
        //     let uploadRet = await file_c.upload_static_file(fengjing_imgs_path+(i+1)+fengjing_imgs_fmt);
        //     console.log('query_fengjing_imgs-upload_static_file-:'+i+' path:'+fengjing_imgs_path+' ret:'+JSON.stringify(uploadRet))
        //     if(uploadRet && uploadRet.ret && uploadRet.filename)
        //     {
        //         let relateRet = await rpc_api_util.s_save_into_token_list(OBJ_API_BASE,fengjing_imgs_list_id,uploadRet.filename,mc_relate_opcode,'add to list');
        //         if(!relateRet) relateRet = await rpc_api_util.s_save_into_token_list(OBJ_API_BASE,fengjing_imgs_list_id,uploadRet.filename,mc_relate_opcode,'add to list');
        //         cnt+= relateRet ? 1:0;
        //     }
        // }
        // console.log('upload and relate success cnt:'+cnt);
    }

    list = !list||!list.length ? await rpc_api_util.s_query_token_list(OBJ_API_BASE,fengjing_imgs_list_id,fj_relate_opcode,0,1000,false,function(a){return {}}) :list;
    let results = [];
    for(let i=0;list && i<list.length;i++)
    {
        results.push(list[i].token_y)
    }

    fengjing_imgs_list = results
    return results;
}
//fengjing_imgs_list为内存缓存
window.fengjing_imgs.get_list =get_list;
async function get_list()
{
    let list   =  !fengjing_imgs_list ? await query_fengjing_imgs() :fengjing_imgs_list;
    query_fengjing_imgs()
    console.log('list:'+JSON.stringify(list))
    return list;
}
/**
 * 清除缓存
 */
window.fengjing_imgs.clear_list_cache =clear_list_cache;
async function clear_list_cache()
{
    fengjing_imgs_list = null;
}

// get_list();