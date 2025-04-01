// const str_filter = require('./libs/str_filter');
// const gnode_format_util = require('./libs/gnode_format_util');
// const notice_util = require('./libs/notice_util');
// const config = require('./config').config;
// const user_redis = require('./config').user_redis;
// const rpc_query = require('./rpc_api_config').rpc_query
// const rpc_api_config = require('./rpc_api_config')
// Object.assign(window,rpc_api_config)
// const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
//     ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
//     GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
//     PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
//     RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
//     SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
//     OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
//     MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
//     VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('./rpc_api_config')
window.rpc_api_util = module.exports
/**
 * 创建类似xxx_00000000userlist的token-id
 */
module.exports.create_token_name_last = create_token_name_last
function create_token_name_last(TOKEN_ROOT,name)
{
    if(!name) return name;
    let TOKEN_NAME = TOKEN_ROOT.split('_')[0]

    let len = name.length;
    if(len>0) return TOKEN_NAME+"_"+TOKEN_ROOT.substring((TOKEN_NAME+"_").length+len,TOKEN_ROOT.length)+name

    return name;
}
/**
 * 创建类似xxx_userlist00000000的token-id
 */
module.exports.create_token_name_pre = create_token_name_pre
function create_token_name_pre(TOKEN_ROOT,name)
{
    if(!name) return name;
    let TOKEN_NAME = TOKEN_ROOT.split('_')[0]

    let len = name.length;
    if(len>0) return TOKEN_NAME+"_"+name+TOKEN_ROOT.substring((TOKEN_NAME+"_").length+len,TOKEN_ROOT.length)

    return name;
}
/**
 * 按模板生成token-id
 * @type {s_query_token_id}
 */
module.exports.s_query_token_id = s_query_token_id
async function s_query_token_id(API,ROOT,DST_TOKEN_NAME)
{
    let TOKEN_NAME_PREFIX = ROOT.split('_')[0]
    let TOKEN_NAME = DST_TOKEN_NAME.length > 16 ? TOKEN_NAME_PREFIX+'_'+DST_TOKEN_NAME.split('_')[1] : TOKEN_NAME_PREFIX+'_'+DST_TOKEN_NAME
    let queryRet = await rpc_query(API+'/chain/opcode',{token:TOKEN_NAME,opcode:'fork',begin:0,len:1})
    if(!queryRet ||!queryRet.ret)
    {
        let forkRet = await rpc_query(API+'/fork',{token:ROOT,dst_token:TOKEN_NAME})
        if(!forkRet ||!forkRet.ret) return null;
    }
    return TOKEN_NAME;
}

/**
 * 创建一个新的token_id
 * @type {s_fork_token_id}
 */
module.exports.s_fork_token_id = s_fork_token_id
async function s_fork_token_id(API,ROOT,space)
{
    let forkRet = await rpc_query(API+'/fork',{token:ROOT,space:space})
    if(!forkRet ||!forkRet.ret) return null;

    return forkRet.token_x;
}

/**
 * 保存数据
 * @type {s_save_token_info}
 */
module.exports.s_save_token_info = s_save_token_info
async function s_save_token_info(API,ROOT,token,opcode,opval,extra_data)
{
    let opRet = await rpc_query(API+'/op',{token_x:ROOT,token_y:token,opcode:opcode,opval:opval,extra_data:extra_data})
    if(!opRet ||!opRet.ret) return false;

    return true;
}
// app.all(MODULE_PATH+"/chain/relations/exists", chain_c.check_token_relations);
/**
 * 判断是否相关。
 * @type {function(*, *=, *=, *=): *}
 */
module.exports.s_check_token_list_related = s_check_token_list_related
async function s_check_token_list_related(API,token_x,token_y,opcode)
{
    let existsRet = await rpc_query(API+'/chain/relations/exists',{token_x:token_x,token_y:token_y,opcode:opcode})
    return existsRet && existsRet.ret;
}


/**
 * 由/chain/relations查询list
 * @type {function(*, *=): Array}
 */
module.exports.s_query_token_list = s_query_token_list
async function s_query_token_list(API, list_id,opcode,begin,len,isy,queryInfoFunc)
{
    let isx = !isy ? true: false;
    begin = begin-0;
    len = !len ? 100000 :len
    let listRet = await rpc_query(API+'/chain/relations',{token:list_id,opcode:opcode,isx,begin:begin,len:len})
    let list = !listRet ||!listRet.ret ? [] : listRet.list;

    let objs = []
    let queryObjInfoP = []
    let i = 0
    for(;i<list.length;i++)
    {
        let info = list[i]
        // orderInfo.order_time = str_filter.GetDateTimeFormat(orderInfo.order_time)
        //放到数组中，等待处理。
        let q_token_id = isy ? info.token_x: info.token_y
        //queryInfoFunc = null;
        queryObjInfoP.push(queryInfoFunc ?  queryInfoFunc(q_token_id): s_query_token_info(API,q_token_id,'assert'))
             //rpc_query(API+'/chain/opcode',{token:isy ? info.token_x: info.token_y,opcode:'assert',begin:0,len:1}))

        objs.push(info)
    }

    let newObjs = []
    //查询分类数据
    await Promise.all(queryObjInfoP).then(function(rets){
        console.log('queryOrderInfoP-rets:'+JSON.stringify(rets))
        let i =0;
        for(;i<objs.length;i++)
        {
            if(rets[i] ) {//&& rets[i].ret && rets[i].list && rets[i].list[0].txjson
                try {
                    //console.log("opval:"+JSON.parse(rets[i].list[0].txjson).opval)
                    let newInfo = rets[i];//JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    newInfo.token_y = list[i].token_y
                    newInfo.token_X = list[i].token_X
                    newObjs.push(newInfo)
                    continue;
                }catch(e){
                    //newObjs.push(objs[i])
                    console.log('excaption:'+e)
                }
            }
            else 
           // newObjs.push({main_id:objs[i].token_y})
            newObjs.push(objs[i])
        }
    })
    return newObjs;
}

/**
 * 保存到列表
 * @type {s_save_into_token_list}
 */
module.exports.s_save_into_token_list = s_save_into_token_list
async function s_save_into_token_list(API, token_x,token_y,opcode,extra_data)
{
    let opRet = await rpc_query(API+'/op',{token_x:token_x,token_y:token_y,opcode:opcode,opval:'add',extra_data:extra_data})
    if(!opRet ||!opRet.ret) return false;

    return true;
}

/**
 * 移出list
 * @type {s_save_into_token_list}
 */
module.exports.s_del_from_token_list = s_del_from_token_list
async function s_del_from_token_list(API, token_x,token_y,opcode,extra_data)
{
    let opRet = await rpc_query(API+'/op',{token_x:token_x,token_y:token_y,opcode:opcode,opval:'del',extra_data:extra_data})
    if(!opRet ||!opRet.ret) return false;

    return true;
}

/**
 * 查询token的info
 * @type {s_query_token_info}
 */
module.exports.s_query_token_info= s_query_token_info
async function s_query_token_info(API, token,opcode)
{
    let infoRet = await rpc_query(API+'/chain/opcode',{token: token,opcode:opcode,begin:0,len:1})
    if(!infoRet || !infoRet.ret) return null;

    return JSON.parse(JSON.parse(infoRet.list[0].txjson).opval)
}

/**
 * 得到内置一个relate-id（以便作为队列list-id存在）
 * @type {s_query_token_innerid}
 */
module.exports.s_query_token_innerid= s_query_token_innerid
async function s_query_token_innerid(INFO_API,INFO_ROOT,API,ROOT,tokenid,opcode,innerIDName)
{
    let info = await s_query_token_info(INFO_API,tokenid,opcode)
    if(!info) return null;//res.json({ret:false,msg:"info is empty"})
    // let mainProductListName = innerIDName;
    if(!info[innerIDName] || info[innerIDName].split('_')[1].length!=16) {
        // info[innerIDName] = await s_query_token_id(API,ROOT,create_token_name_pre(ROOT,innerIDName))//这里有一个严重的bug（会大量重复，只能用于一个main-id中）
        info[innerIDName] = await s_fork_token_id(API,ROOT,innerIDName)
        if(!info[innerIDName]) return   null;

        let updateRet = await s_save_token_info(INFO_API,INFO_ROOT,tokenid,opcode,JSON.stringify(info),info[innerIDName])
        if(!updateRet)   return null;
    }
    return info[innerIDName]
}

module.exports.s_query_token_innerid_space= s_query_token_innerid_space
async function s_query_token_innerid_space(INFO_API,INFO_ROOT,API,ROOT,tokenid,opcode,innerIDName)
{
    let info = await s_query_token_info(INFO_API,tokenid,opcode)
    if(!info) return null;//res.json({ret:false,msg:"info is empty"})
    // let mainProductListName = innerIDName;
    if(!info[innerIDName] || info[innerIDName].split('_')[1].length!=16) {
        info[innerIDName] = await s_fork_token_id(API,ROOT,innerIDName)
        if(!info[innerIDName]) return   null;

        let updateRet = await s_save_token_info(INFO_API,INFO_ROOT,tokenid,opcode,JSON.stringify(info),info[innerIDName])
        if(!updateRet)   return null;
    }
    return info[innerIDName]
}