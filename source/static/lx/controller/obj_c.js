/**
 * Created by lauo.li on 2019/3/26.
 */
// const str_filter = require('../libs/str_filter');
// const notice_util = require('../libs/notice_util');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const user_m = require('../model/user_m');

// const rpc_query = require('../rpc_api_config').rpc_query
// const {USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')
window.obj_c = {}
/**
 * 新建一个gnode节点商品（考虑所有的dtns所有的链产品，都基于此购买----参数差异大？？）。
 * @type {new_gnode_obj}
 *
 */
window.obj_c.new_gnode_obj =new_gnode_obj;
async function new_gnode_obj(req, res)
{
    //obj_kind=gnode,obj_name，obj_desc,price,price_m,price_d,master_host（控制层）,who_acl(访问控制,0代表所有人可购买，1-7代表以上可以告诉），该谁购买
    //gnode_kind(huawei,tencent,aliyun,baidu)
    //deploy_area（腾讯、阿里、华为、百度）,deploy_area_code(c1,c2,c3,c4），还应该有sub_area（广州，北京，上海等）
    let {user_id,s_id,gnode_kind,sort_num, gnode_name, gnode_desc,price,price_y,price_m,price_d,
        deploy_area,sub_area,sub_area_code,deploy_area_code,master_host, who_acl,random,sign} = str_filter.get_req_data(req);
    //gnode_kind=huawei&sort_num=0&gnode_name=G节点（华为云）&gnode_desc=G节点（华为云）-中国华南区&price=720&price_y=720&price_m=60&price_d=2&
    //         deploy_area=中国&sub_area=华南&sub_area_code=0&deploy_area_code=c0&master_host=c0.forklist.dtns&who_acl=0random

    if(price!=price*1 || price<0) return res.json({ret: false, msg: "price format error"});
    if(price_y!=price_y*1 || price_y<0) return res.json({ret: false, msg: "price_y format error"});
    if(price_m!=price_m*1 || price_m<0) return res.json({ret: false, msg: "price_m format error"});
    if(price_d!=price_d*1 || price_d<0) return res.json({ret: false, msg: "price_d format error"});
    if(!gnode_kind) return res.json({ret: false, msg: "gnode_kind format error"});
    if(!gnode_name) return res.json({ret: false, msg: "gnode_name format error"});
    if(!gnode_desc) return res.json({ret: false, msg: "gnode_desc format error"});
    if(!deploy_area) return res.json({ret: false, msg: "deploy_area format error"});
    if(!sub_area) return res.json({ret: false, msg: "sub_area format error"});
    if(!sub_area_code) return res.json({ret: false, msg: "sub_area_code format error"});
    if(!deploy_area_code) return res.json({ret: false, msg: "deploy_area_code format error"});
    if(!master_host) return res.json({ret: false, msg: "master_host format error"});
    if(!who_acl) return res.json({ret: false, msg: "who_acl format error"});

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_gnode_obj:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_gnode_obj:"+user_id+random,random,120)
    //创建一个以obj_gnode为开头的节点
    let objInfo = {gnode_kind,sort_num, gnode_name, gnode_desc,price,price_y,price_m,price_d,deploy_area,sub_area,sub_area_code,deploy_area_code,master_host, who_acl,user_id};
    let gnode_token = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'gnode'+gnode_kind);

    let existRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:gnode_token,opcode:'fork',begin:0,len:1})
    if(existRet && existRet.ret)  return res.json({ret: false, msg: "gnode-token exists!"});

    let forkRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:gnode_token,extra_data:JSON.stringify(objInfo)})
    if(!forkRet || !forkRet.ret)  return res.json({ret: false, msg: "fork gnode-token failed"});

    objInfo.obj_id = forkRet.token_x;
    let assertRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:gnode_token,opcode:'assert',opval:JSON.stringify(objInfo),extra_data:gnode_token})
    if(!assertRet || !assertRet.ret)  return res.json({ret: false, msg: "fork failed"});

    //放置到gnodeobj_list中。
    let list_token = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'gnodelist');
    let qRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:list_token,opcode:'fork',begin:0,len:1})
    if(!qRet || !qRet.ret){
        qRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token: list_token})
        if(!qRet || !qRet.ret) return res.json({ret: false, msg: "create gnodelist-token failed"});
    }

    let sendRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:list_token,opval:JSON.stringify(objInfo),extra_data:list_token})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send gnodelist failed"});

    let listRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:list_token,opcode:'assert',begin:0,len:1})

    let objList = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : [];
    objList.push(objInfo)

    let listAssertRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:list_token,
        opcode:'assert',opval:JSON.stringify(objList),extra_data:list_token})
    if(!listAssertRet || !listAssertRet.ret) return res.json({ret: false, msg: "assert gnodelist failed"});

    //返回结果obj_id
    return res.json({ret:true,msg:'success',obj_id:forkRet.token_x,obj_gnodelist_id:list_token})
}

/**
 * 得到gnode商品推荐清单
 * @type {query_tj_gnode_objs}
 */
window.obj_c.query_gnode_objs =query_gnode_objs;
async function query_gnode_objs(req, res)
{
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let list_token = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'gnodelist');
    let listRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:list_token,opcode:'assert',begin:0,len:1})
    let objList = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : [];
    objList.sort(function(a,b){
        return  a.sort_num - b.sort_num;
    })

    return res.json({ret:true,msg:'success',list:objList})
}


/**
 * 新建一个node节点商品（云链主机100GB）
 * @type {new_node_obj}
 *
 */
window.obj_c.new_node_obj =new_node_obj;
async function new_node_obj(req, res)
{
    //obj_kind=node,obj_name，obj_desc,price,price_m,price_d,master_host（控制层）,who_acl(访问控制,0代表所有人可购买，1-7代表以上可以告诉），该谁购买
    //node_kind(huawei,tencent,aliyun,baidu)
    //deploy_area（腾讯、阿里、华为、百度）,deploy_area_code(c1,c2,c3,c4），还应该有sub_area（广州，北京，上海等）
    let {user_id,s_id,node_kind,sort_num, node_name, node_desc,price,price_y,price_m,price_d,
        deploy_area,sub_area,sub_area_code,deploy_area_code,master_host, who_acl,random,sign} = str_filter.get_req_data(req);

    if(price!=price*1 || price<0) return res.json({ret: false, msg: "price format error"});
    if(price_y!=price_y*1 || price_y<0) return res.json({ret: false, msg: "price_y format error"});
    if(price_m!=price_m*1 || price_m<0) return res.json({ret: false, msg: "price_m format error"});
    if(price_d!=price_d*1 || price_d<0) return res.json({ret: false, msg: "price_d format error"});
    if(!node_kind) return res.json({ret: false, msg: "node_kind format error"});
    if(!node_name) return res.json({ret: false, msg: "node_name format error"});
    if(!node_desc) return res.json({ret: false, msg: "node_desc format error"});
    if(!deploy_area) return res.json({ret: false, msg: "deploy_area format error"});
    if(!sub_area) return res.json({ret: false, msg: "sub_area format error"});
    if(!sub_area_code) return res.json({ret: false, msg: "sub_area_code format error"});
    if(!deploy_area_code) return res.json({ret: false, msg: "deploy_area_code format error"});
    if(!master_host) return res.json({ret: false, msg: "master_host format error"});
    if(!who_acl) return res.json({ret: false, msg: "who_acl format error"});

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_node_obj:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_node_obj:"+user_id+random,random,120)
    //创建一个以obj_gnode为开头的节点
    let objInfo = {node_kind,sort_num, node_name, node_desc,price,price_y,price_m,price_d,deploy_area,sub_area,sub_area_code,deploy_area_code,master_host, who_acl,user_id};
    let node_token = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'node'+node_kind);

    let existRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:node_token,opcode:'fork',begin:0,len:1})
    if(existRet && existRet.ret)  return res.json({ret: false, msg: "node-token exists!"});

    let forkRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:node_token,extra_data:JSON.stringify(objInfo)})
    if(!forkRet || !forkRet.ret)  return res.json({ret: false, msg: "fork node-token failed"});

    objInfo.obj_id = forkRet.token_x;
    let assertRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:node_token,opcode:'assert',opval:JSON.stringify(objInfo),extra_data:node_token})
    if(!assertRet || !assertRet.ret)  return res.json({ret: false, msg: "fork failed"});

    //放置到obj_nodelist中。
    let list_token = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'nodelist');
    let qRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:list_token,opcode:'fork',begin:0,len:1})
    if(!qRet || !qRet.ret){
        qRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token: list_token})
        if(!qRet || !qRet.ret) return res.json({ret: false, msg: "create nodelist-token failed"});
    }

    let sendRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:list_token,opval:JSON.stringify(objInfo),extra_data:list_token})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send nodelist failed"});

    let listRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:list_token,opcode:'assert',begin:0,len:1})

    let objList = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : [];
    objList.push(objInfo)

    let listAssertRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:list_token,
        opcode:'assert',opval:JSON.stringify(objList),extra_data:list_token})
    if(!listAssertRet || !listAssertRet.ret) return res.json({ret: false, msg: "assert nodelist failed"});

    //返回结果obj_id
    return res.json({ret:true,msg:'success',obj_id:forkRet.token_x,obj_nodelist_id:list_token})
}

/**
 * 得到云链主机node商品推荐清单
 * @type {query_node_objs}
 */
window.obj_c.query_node_objs =query_node_objs;
async function query_node_objs(req, res)
{
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let list_token = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'nodelist');
    let listRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:list_token,opcode:'assert',begin:0,len:1})
    let objList = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : [];
    objList.sort(function(a,b){
        return  a.sort_num - b.sort_num;
    })

    return res.json({ret:true,msg:'success',list:objList})
}



/**
 * 创建一个会员商品（vip0-7）
 * @type {new_vip_obj}
 */
window.obj_c.new_vip_obj =new_vip_obj;
async function new_vip_obj(req, res)
{
    //vip_level 0-7, price,price_y（按年）,price_m,price_d,vip_name,vip_desc,vip_right(关于G节点，商城、邀请用户分销等)
    let {user_id,s_id,vip_level,price,price_y,price_m,price_d,vip_name,vip_desc,vip_right,random,sign} = str_filter.get_req_data(req);

    if(vip_level!=vip_level*1 || vip_level<0|| vip_level>7) return res.json({ret: false, msg: "vip_level format error"});
    if(price!=price*1 || price<0) return res.json({ret: false, msg: "price format error"});
    if(price_y!=price_y*1 || price_y<0) return res.json({ret: false, msg: "price_y format error"});
    if(price_m!=price_m*1 || price_m<0) return res.json({ret: false, msg: "price_m format error"});
    if(price_d!=price_d*1 || price_d<0) return res.json({ret: false, msg: "price_d format error"});
    if(!vip_name) return res.json({ret: false, msg: "vip_name format error"});
    if(!vip_desc) return res.json({ret: false, msg: "vip_desc format error"});
    if(!vip_right) return res.json({ret: false, msg: "vip_right format error"});

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})
    //校验sign(暂无)

    //防重放攻击
    str = await user_redis.get(ll_config.redis_key+":new_vip_obj:"+user_id+random)
    if(str)
    {
        return res.json({ret: false, msg: "muti call failed"});
    }
    user_redis.set(ll_config.redis_key+":new_vip_obj:"+user_id+random,random,120)

    //创建一个以obj_vip0-70000000000为开头的帐户
    let objInfo = {user_id,vip_level,price,price_y,price_m,price_d,vip_name,vip_desc,vip_right};
    let vip_token_name = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'vip'+vip_level);

    let query_vip_token_ret = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:vip_token_name,opcode:'fork',begin:0,len:1})
    if(query_vip_token_ret && query_vip_token_ret.ret)  return res.json({ret: false, msg: "vip-token exists!"});

    let vip_token_ret = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token:vip_token_name,extra_data:JSON.stringify(objInfo)})
    if(!vip_token_ret || !vip_token_ret.ret)  return res.json({ret: false, msg: "fork failed"});

    objInfo.obj_id = vip_token_ret.token_x;
    let assertRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:vip_token_name,opcode:'assert',opval:JSON.stringify(objInfo),extra_data:vip_token_name})
    if(!assertRet || !assertRet.ret)  return res.json({ret: false, msg: "fork failed"});
    //放置到vipobj_list中。
    let viplist_token_name = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'viplist');
    let qRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:viplist_token_name,opcode:'fork',begin:0,len:1})
    if(!qRet || !qRet.ret){
        qRet = await rpc_query(OBJ_API_BASE+"/fork",{token:OBJ_TOKEN_ROOT,dst_token: viplist_token_name})
        if(!qRet || !qRet.ret) return res.json({ret: false, msg: "create viplist-token failed"});
    }

    let sendRet = await rpc_query(OBJ_API_BASE+"/send",{token_x:OBJ_TOKEN_ROOT,token_y:viplist_token_name,opval:JSON.stringify(objInfo),extra_data:viplist_token_name})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send viplist failed"});

    let listRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:viplist_token_name,opcode:'assert',begin:0,len:1})

    let vipobjList = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : [];
    vipobjList.push(objInfo)

    let listAssertRet = await rpc_query(OBJ_API_BASE+"/op",{token_x:OBJ_TOKEN_ROOT,token_y:viplist_token_name,
        opcode:'assert',opval:JSON.stringify(vipobjList),extra_data:viplist_token_name})
    if(!listAssertRet || !listAssertRet.ret) return res.json({ret: false, msg: "assert viplist failed"});

    //返回结果obj_id
    return res.json({ret:true,msg:'success',obj_id:vip_token_ret.token_x,obj_viplist_id:viplist_token_name})
}

/**
 * 查询vip-objs（以便vip-gnode保存配置信息）生成配置。
 * @type {query_vip_objs}
 */
window.obj_c.query_vip_objs =query_vip_objs;
async function query_vip_objs(req, res)
{
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);
    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    let viplist_token_name = str_filter.create_token_name_pre(OBJ_TOKEN_ROOT,'viplist');
    let listRet = await rpc_query(OBJ_API_BASE+"/chain/opcode",{token:viplist_token_name,opcode:'assert',begin:0,len:1})
    let vipobjList = listRet&& listRet.ret ? JSON.parse(JSON.parse(listRet.list[0].txjson).opval) : [];
    vipobjList.sort(function(a,b){
        return  a.vip_level - b.vip_level;
    })

    return res.json({ret:true,msg:'success',list:vipobjList})
}