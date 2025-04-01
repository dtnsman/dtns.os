// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const gnode_format_util = require('../libs/gnode_format_util');
// const notice_util = require('../libs/notice_util');
// const user_c = require('./user_c');
// const manager_c = require('./manager_c');

// const rpc_query = require('../rpc_api_config').rpc_query
// const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
//     ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
//     GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
//     PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
//     RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
//     SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
//     OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
//     MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
//     VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

// const rpc_api_util = require('../rpc_api_util') 

//作品
/**
 * 发布作品
 * @type {newNft}
 */
window.forklist_c = {}
window.forklist_c.newNft =newNft;
async function newNft(req,res) {
    let {user_id,s_id,artist,artist_introduction,work_name,work_type,work_introduction,work_describe,work_specification,work_image,rmb_price,album_id,album_name} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    // if(!publisher) return res.json({ret:false,msg:"publisher error"}) //发行商

    // if(!artist) return res.json({ret:false,msg:"artist error"}) //艺术家
    // if(!artist_introduction) return res.json({ret:false,msg:"artist_introduction error"}) //艺术家介绍

    if(!work_type) return res.json({ret:false,msg:"work_type error"}) //作品类型

    // if(!work_city) return res.json({ret:false,msg:"work_city error"}) //作品所在城市
    // if(!sale_date) return res.json({ret:false,msg:"sale_date error"}) //作品出售时间
    // if(!transaction_time) return res.json({ret:false,msg:"transaction_time error"}) //成交时间
 
    if(!work_name) return res.json({ret:false,msg:"work_name error"}) //作品名称
    // if(!work_introduction) return res.json({ret:false,msg:"work_introduction error"}) //作品简介
    if(!work_describe) return res.json({ret:false,msg:"work_describe error"}) //作品描述
    if(!work_specification) return res.json({ret:false,msg:"work_specification error"}) //作品规格
    if(!work_image) return res.json({ret:false,msg:"work_image error"}) //作品图片
    // if(!work_price || work_price!=work_price*1) return res.json({ret:false,msg:"work_price error"}) //作品价格
    if(!rmb_price || rmb_price!=rmb_price*1) return res.json({ret:false,msg:"rmb_price error"})

    let obj = {user_id,artist,artist_introduction,work_name,work_type,work_describe,work_specification,work_image,rmb_price,album_id,album_name
        ,save_time:parseInt(new Date().getTime()/1000),tips:'审核中'}

    console.log("nft-obj:"+JSON.stringify(obj))


    //查询用户资料，看是否已经有nft_list_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    obj.publisher=userInfo.user_name

    if(!userInfo.nft_list_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'nftlist'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork nft_list_id failed"});
        userInfo.nft_list_id = forkRet.token_x
        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})

        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo nft_list_id failed"});
    }
    obj.nft_list_id = userInfo.nft_list_id

    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'forkID'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork nft-new-obj-id failed"});

    //保存obj-id，方便查询。
    obj.obj_id = forkObjRet.token_x

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.nft_list_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-new-obj-info failed"});

    //send user-nft-list-obj-id
    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.nft_list_id,
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send gsbsrc-obj-info failed"});


    //创建全部作品id
    let forkProallidRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_nftall0000000000',opcode:'fork',begin:0,len:1})
    if(!forkProallidRet ||!forkProallidRet.ret)
    {
        let forkProallidRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+'_nftall0000000000'})
        if(!forkProallidRet ||!forkProallidRet.ret) return res.json({ret:false,msg:"fork nftall-id failed"});
    }

    //send all-user-nft-obj-id
    let sendAllRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_nftall0000000000',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send nft-obj-info to nftall failed"});


    return res.json({ret:true,msg:'success'})
}

/**
 * 得到FORK-info（由forkid查询）
 */
window.forklist_c.queryInfo =queryInfo;
async function queryInfo(req,res) {
    let {forkid} = str_filter.get_req_data(req)

     //查询web3name是否已经存在
    let forkInfoRet = await rpc_query(DTNS_API_BASE+'/chain/map/value',{token:DTNS_TOKEN_ROOT,map_key:forkid}) //得到映射的值  phoneHash本质就是phone，由phone得到user-id
    console.log('queryNftInfo-FORK-map-info:',forkInfoRet,forkid)
    if(!forkInfoRet ||! forkInfoRet.map_value)
    {
        return res.json({ret:false,msg:'FORK-info is empty!'})
    }

    let dtns_fork_id = forkInfoRet.map_value
    let opcodeInfoRet = await rpc_query(DTNS_API_BASE+'/chain/opcode',{token:dtns_fork_id,opcode:'assert',begin:0,len:1})
    console.log('query-forkid-assert-info:',opcodeInfoRet)
    if(!opcodeInfoRet || !opcodeInfoRet.ret || !opcodeInfoRet.list ||opcodeInfoRet.list.length<=0 ) return res.json({ret:false,msg:'FORK-assert-info is empty!'})
    let obj_id = JSON.parse(opcodeInfoRet.list[0].txjson).extra_data
    req.params.obj_id = obj_id
    queryNftInfo(req,res)
}
/**
 * 查询nft作品的信息
 * @type {queryNftInfo}
 */
window.forklist_c.queryNftInfo =queryNftInfo;
async function queryNftInfo(req,res) {
    let {user_id, s_id, obj_id} = str_filter.get_req_data(req)

    // let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!str) return res.json({ret: false, msg: "session error"})

    if (!obj_id) return res.json({ret: false, msg: "obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: obj_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)


    // oldObj.txjson = JSON.parse(assertInfoRet.list[0].txjson)

    oldObj.creatorInfo = await user_c.s_queryUserInfo(oldObj.user_id);

    if(oldObj.owner){
        oldObj.forkUserInfo = await user_c.s_queryUserInfo(oldObj.owner);
    }else{
        oldObj.forkUserInfo = oldObj.creatorInfo
    }

    //查询的时候，亦直接生成FORK福刻映射（异步方式）---修改为同步方式（不无不可）
    let FORKID = oldObj.FORKID
    let token_x = oldObj.dtns_fork_id
    if(!FORKID || !token_x)
    {
        // let mapFunc = async function(){
            let forkMapRet = await window.user_c.createFORKMap(obj_id)
            console.log('queryNftInfo-forkMapRet:',forkMapRet)
        // }
        // mapFunc()
    }

    //历史交易记录
    // let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'send',begin:0,len:10})
    // if(listRet &&listRet.ret)
    // {
    //     let i =0;
    //     for(;i<listRet.list.length;i++)
    //     {
    //         listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
    //         listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

    //         listRet.list[i].create_time = str_filter.GetDateTimeFormat(listRet.list[i].create_time_i)

    //         //查询用户资料，创作者
    //         let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:listRet.list[i].info.buy_user_id,opcode:'assert',begin:0,len:1})
    //         if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    //         let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    //         delete userInfo.pwd
    //         delete userInfo.salt

    //         listRet.list[i].info.buy_userInfo = userInfo

    //         delete listRet.list[i].txjson
    //         // delete listRet.list[i].info
    //     }
    //     oldObj.history_deals = listRet.list;

    // }
    
    //福刻源
    if(oldObj.original_obj_id){
        let assertOInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: oldObj.original_obj_id, opcode: 'assert', begin: 0, len: 1})
        if (!assertOInfoRet || !assertOInfoRet.ret) return res.json({ret: false, msg: "obj-assert-info is empty"})
        oldObj.original_obj = JSON.parse(JSON.parse(assertOInfoRet.list[0].txjson).opval)
    }
   


    oldObj.ret = true;
    oldObj.msg = 'success'
    res.json(oldObj)
}

/**
 * 更新nft作品信息（由obj_id）
 * @type {updateNftInfo}
 */
window.forklist_c.updateNftInfo =updateNftInfo;
async function updateNftInfo(req,res) {
    let {user_id,s_id,obj_id,artist,artist_introduction,work_name,work_type,work_introduction,work_describe,work_specification,work_image,rmb_price} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})


    // if(!artist) return res.json({ret:false,msg:"artist error"}) //艺术家
    // if(!artist_introduction) return res.json({ret:false,msg:"artist_introduction error"}) //艺术家介绍

    // if(!work_type) return res.json({ret:false,msg:"work_type error"}) //作品类型
    // if(!work_city) return res.json({ret:false,msg:"work_city error"}) //作品所在城市
    // if(!sale_date) return res.json({ret:false,msg:"sale_date error"}) //作品出售时间
    // if(!transaction_time) return res.json({ret:false,msg:"transaction_time error"}) //成交时间
 
    // if(!work_name) return res.json({ret:false,msg:"work_name error"}) //作品名称
    // if(!work_introduction) return res.json({ret:false,msg:"work_introduction error"}) //作品简介
    // if(!work_describe) return res.json({ret:false,msg:"work_describe error"}) //作品描述
    // if(!work_specification) return res.json({ret:false,msg:"work_specification error"}) //作品规格
    // if(!work_image) return res.json({ret:false,msg:"work_image error"}) //作品图片
    // if(!work_price || work_price!=work_price*1) return res.json({ret:false,msg:"work_price error"}) //作品价格
    // if(!rmb_price || rmb_price!=rmb_price*1) return res.json({ret:false,msg:"rmb_price error"})


    let obj = {obj_id,artist,artist_introduction,work_name,work_type,work_introduction,work_describe,work_specification,work_image,rmb_price,send_time:parseInt(new Date().getTime()/1000)}
    console.log("nft-obj:"+JSON.stringify(obj))

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    
    // if(oldObj.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update nftinfo no pm"})

    let newObj = {}
    newObj = Object.assign(newObj,oldObj,obj)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-update-obj-info failed"});

    return res.json({ret:true,msg:'success'})
}

/**
 * 购买nft作品
 * @type {buyNft}
 */
window.forklist_c.buyNft =buyNft;
async function buyNft(req, res) {
    //pay_type=rmb or gsb
    let {user_id, s_id, obj_id,src_num,pay_type,forkComments,random} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})
    // if(!src_num || src_num!=src_num*1) return res.json({ret:false,msg:"src_num error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    //创建一个obj-id（关于用户的购买记录？）
    if(obj.user_id==user_id) return res.json({ret:false,msg:"can not buy youself nft"})
    // if(pay_type == 'rmb' && !obj.rmb_price)  return res.json({ret:false,msg:"can not use rmb buy src"})

    //查询用户资料，nft_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.nft_buyed_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'nftbuy'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork user-buyed-id failed"});
        userInfo.nft_buyed_id = forkRet.token_x

        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo nft-buyed-id failed"});
    }
  
    obj.pay_type = pay_type;


    //扣用户的GSB费用。
    let payRMBNum = obj.rmb_price* 1 ;

    if(pay_type=='gsb') {

    }else if(pay_type=='rmb')
    {
        let userAccountRet = await rpc_query(RMB_API_BASE + "/chain/opcode", {token: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opcode: 'send', begin: 0, len: 1})
        let userWalletRMB = userAccountRet && userAccountRet.ret ? JSON.parse(userAccountRet.list[0].txjson).token_state : 0;
        console.log('扣除用户总额：'+payRMBNum);
        console.log('用户余额：'+userWalletRMB);

        if (payRMBNum > userWalletRMB) return res.json({ret: false, msg: "user have not enough rmb to pay order"})

        //买家扣除
        obj.send_node='购买福刻作品'
        let rootpayRet = await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + "_" + user_id.split('_')[1],
            token_y: RMB_TOKEN_ROOT, opval: payRMBNum, extra_data: JSON.stringify(obj)})
        if (!rootpayRet || !rootpayRet.ret) return res.json({ret: false, msg: "pay rmb to nft failed"});
        console.log("余额支付，支付费用成功")


        let list = [], level=1;
        await calculateSubaccount(list, level, obj_id, payRMBNum)
        console.log("计算佣金分配")

        await sendSubaccount(obj_id, list)
        console.log("发放佣金")
   
    }

    //福刻
    obj.forkComments = forkComments
    obj.original_obj_id= obj_id
    obj.owner = user_id
    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'forkID'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork nft-new-obj-id failed"});
    //保存obj-id，方便查询。
    obj.obj_id = forkObjRet.token_x
    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.nft_list_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-new-obj-info failed"});


    //更新了用户的购买列表
    let buyOrder = {buy_user_id:user_id,user_name:userInfo.user_name,buy_obj_id:obj_id,buy_time:parseInt(new Date().getTime()/1000),pay_rmb:obj.rmb_price}
    buyOrder = Object.assign(obj,buyOrder)

    //hold user-hold nft_buyed_id
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:userInfo.nft_buyed_id,token_y:obj_id,opcode:'hold',
    opval:'add',extra_data:JSON.stringify(buyOrder)})
    if(!holdRet || !holdRet.ret)
    {
        //退款
        if(pay_type=='gsb') {
           
        }else if(pay_type=='rmb') {
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_rmb, extra_data: JSON.stringify(obj)})
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_root_rmb, extra_data: JSON.stringify(obj)})
        }
        console.log("更新订单列表失败，进行退款业务")
        return res.json({ret: false, msg: "hold nft-obj-info to nft_buyed_id failed"});
    }

    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.nft_buyed_id,
        opval:JSON.stringify(buyOrder),extra_data:obj_id})
    if(!sendRet || !sendRet.ret)
    {
        //退款
        if(pay_type=='gsb') {
           
        }else if(pay_type=='rmb') {
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_rmb, extra_data: JSON.stringify(obj)})
            // await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
            //     token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: send_root_rmb, extra_data: JSON.stringify(obj)})
        }
        console.log("更新订单列表失败，进行退款业务")
        return res.json({ret: false, msg: "send to user-buyed-list failed"});
    }

    //更新源码订单数量和购买数量信息。
    let xx = async function()
    {
        //该作品的交易记录
        await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opval:JSON.stringify(buyOrder),extra_data: user_id})
    }

    xx();



    //福刻版本
    let NFTFork = async function(){

        //专辑与作品hold关联
        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj.obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(buyOrder)})
        if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info to album failed"});


    }
    NFTFork();

    try{
    console.log('window.user_c.createFORKMap:',window && window.user_c ?window.user_c.createFORKMap:null )
    let forkMapRet = await window.user_c.createFORKMap(obj.obj_id)
    console.log('buyNft-forkMapRet:',forkMapRet)
    }catch(ex)
    {
        console.log('buyNft-forkMapRet:ex:'+ex,ex)
    }

    res.json({ret:true,msg:'success'})
}


/**
 * 购买nft作品
 * @type {sbuyNft}
 */
window.forklist_c.sbuyNft =sbuyNft;
async function sbuyNft(user_id, obj_id,forkComments,pay_type) {
    
    if(!obj_id) return false;
    if(obj_id.indexOf('fork')<0) false;

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return false;

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    //创建一个obj-id（关于用户的购买记录？）
    // if(obj.user_id==user_id) return false;

    //查询用户资料，nft_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return false;
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.nft_buyed_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'nftbuy'})
        if(!forkRet||!forkRet.ret) return false;
        userInfo.nft_buyed_id = forkRet.token_x

        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
        if(!assertUserInfoRet || !assertUserInfoRet.ret) return false;
    }
   
    obj.pay_type = pay_type;

    //扣用户的GSB费用。
    let payRMBNum = obj.rmb_price* 1 ;

    if(pay_type=='gsb') {
        
    }else if(pay_type=='rmb')
    {
       
        let list = [], level=1;
        await calculateSubaccount(list, level, obj_id, payRMBNum)
        console.log("计算佣金分配")

        await sendSubaccount(obj_id, list)
        console.log("发放佣金")

    }

    //福刻
    obj.forkComments = forkComments
    obj.original_obj_id= obj_id
    obj.owner = user_id
    //on 2023-5-11 fix the 审核中 status bug
    obj.tips = '已支付'
    obj.nft_status='ok'
    delete obj.FORKID //不能直接复制
    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'forkID'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork nft-new-obj-id failed"});
    //保存obj-id，方便查询。
    obj.obj_id = forkObjRet.token_x
    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.nft_list_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-new-obj-info failed"});

    //更新了用户的购买列表
    let buyOrder = {buy_user_id:user_id,user_name:userInfo.user_name,buy_obj_id:obj_id,buy_time:parseInt(new Date().getTime()/1000),pay_rmb:obj.rmb_price}
    buyOrder = Object.assign(obj,buyOrder)

    //hold user-hold nft_buyed_id
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:userInfo.nft_buyed_id,token_y:obj_id,opcode:'hold',
    opval:'add',extra_data:JSON.stringify(buyOrder)})
    if(!holdRet || !holdRet.ret)
    {
        await str_filter.sleep(2000)

        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:userInfo.nft_buyed_id,token_y:obj_id,opcode:'hold',
         opval:'add',extra_data:JSON.stringify(buyOrder)})
        if(!holdRet || !holdRet.ret){
            console.log("更新订单列表失败，进行退款业务")
        }
        //退款
        // if(pay_type=='gsb') {
        //     rpc_query(GSB_API_BASE + '/send', {token_x: GSB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
        //         token_y: GSB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: payGSBNum, extra_data: JSON.stringify(obj)})
        // }else if(pay_type=='rmb') {
        //     rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
        //         token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: payRMBNum, extra_data: JSON.stringify(obj)})
        // }
        return false;
    }

    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.nft_buyed_id,
        opval:JSON.stringify(buyOrder),extra_data:obj_id})
    if(!sendRet || !sendRet.ret)
    {
        await str_filter.sleep(2000)
        let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.nft_buyed_id,
            opval:JSON.stringify(buyOrder),extra_data:obj_id})
        if(!sendRet || !sendRet.ret){
            console.log("更新订单列表，进行退款业务")
        }
        //退款
        // if(pay_type=='gsb') {
        //     rpc_query(GSB_API_BASE + '/send', {token_x: GSB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
        //         token_y: GSB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: payGSBNum, extra_data: JSON.stringify(obj)})
        // }else if(pay_type=='rmb') {
        //     rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_NAME + '_' + obj.user_id.split('_')[1],
        //         token_y: RMB_TOKEN_NAME + "_" + user_id.split('_')[1], opval: payRMBNum, extra_data: JSON.stringify(obj)})
        // }
        return false;
    }

    //更新付费福刻交易记录。
    let xx = async function()
    {
        //增加此作品的交易记录
        // await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert', opval:JSON.stringify(obj),extra_data: obj.user_id })

        //该作品的交易记录
        let buysendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opval:JSON.stringify(buyOrder),extra_data: user_id})
        if(!buysendRet || !buysendRet.ret){
            await str_filter.sleep(2000)

            let buysendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opval:JSON.stringify(buyOrder),extra_data: user_id})
            if(!buysendRet || !buysendRet.ret){
                console.log("更新付费福刻交易记录失败")
            }
        }
        //放到所有的NFT订单记录之下（obj_nftallBUY0000000）---方便管理员查看购买纪录，以便发放奖励等
        // await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_srcallBUY0000000',
        //     opval:JSON.stringify(buyOrder),extra_data: user_id})

    }

    xx();

    //福刻版本
    let NFTFork = async function(){

        //专辑与作品hold关联
        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj.obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(buyOrder)})
        if(!holdRet || !holdRet.ret){
            await str_filter.sleep(2000)
            let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj.obj_id,opcode:'hold',
            opval:'add',extra_data:JSON.stringify(buyOrder)})
            if(!holdRet || !holdRet.ret){
                console.log("付费福刻关联利市失败")
            }
        }


    }
    NFTFork();

    let forkMapRet = await window.user_c.createFORKMap(obj.obj_id)
    console.log('sbuyNft-forkMapRet:',forkMapRet)

    return true;
}


/**
 * 审核通过
 * @type {sendOk}
 */
window.forklist_c.sendOk =sendOk;
async function sendOk(req, res) {
    let {user_id, s_id, obj_id, accounted,random, sign,msg} = str_filter.get_req_data(req);
    try{
        if(!(parseInt(accounted)*0==0)) return res.json({ret:false,msg:"accounted error"})
    }catch(ex){
        console.log('accounted-exception:'+accounted)
    }
    accounted = parseInt(accounted)
    if(accounted<0 || accounted>100){
        return res.json({ret:false,msg:"accounted error, must be 0-100"})
    }

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '审核通过'
    obj.nft_status='ok'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

    obj.accounted = accounted
    
    //专辑与作品hold关联
    if(obj.album_id){
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj.album_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
        let albumInfo = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
        obj.album_name = albumInfo.album_name

        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
        if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info to album failed"});
    }

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
    opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //hold user-hold nftall0000000000
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_nftall0000000000',token_y:obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info failed"});

    let forkMapRet = await window.user_c.createFORKMap(obj_id)
    console.log('createFORK-product-sendOK-forkMapRet:',forkMapRet)

    res.json({ret:true,msg:'success'})
}

/**
 * 审核不通过
 * @type {sendDeny}
 */
window.forklist_c.sendDeny =sendDeny;
async function sendDeny(req, res) {
    let {user_id, s_id, obj_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '【审核拒绝】该NFT作品发布！备注：'+msg
    obj.nft_status='deny'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

     //专辑与作品hold关联
    if(obj.album_id){
        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(obj)})
        if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete nft-obj-info to album failed"});
        delete obj.album_id
        delete obj.album_name
    }

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
    opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //下架
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_nftall0000000000',token_y:obj_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete nft from nftall list failed"});
    

    res.json({ret:true,msg:'success'})
}



/**
 * 查询所有的通过审核的NFT作品
 * @type {queryAllNFT}
 */
window.forklist_c.queryAllNFT =queryAllNFT;
async function queryAllNFT(req, res) {
    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    // begin = begin - 1

    // let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,OBJ_TOKEN_NAME+'_nftall0000000000','hold',begin*len,len);

    res.json({ret:true,msg:'success',list:list})
}

/**
 * 查询用户的NFT作品
 * @type {queryUserNFTWorks}
 */
window.forklist_c.queryUserNFTWorks =queryUserNFTWorks;
async function queryUserNFTWorks(req, res) {
    let {user_id, s_id, status, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    // let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    // if(!s_str) return res.json({ret:false,msg:"session error"})

    //nft_list_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.nft_list_id)
    {
        return res.json({ret: false, msg: "user nft_list_id is empty",list:[]});
    }

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.nft_list_id,opcode:'send',begin:begin*len,len:len})

    let queryObjInfoP = [] , list = [] , item= 0

    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            ////let obj = {user_id,artist,artist_introduction,work_name,work_type,work_introduction,work_describe,work_specification,work_image,rmb_price,save_time:parseInt(new Date().getTime()/1000),tips:'审核中'}
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].artist = listRet.list[i].info.artist
            listRet.list[i].artist_introduction = listRet.list[i].info.artist_introduction
            listRet.list[i].work_name = listRet.list[i].info.work_name
            listRet.list[i].work_type = listRet.list[i].info.work_type
            listRet.list[i].work_introduction = listRet.list[i].info.work_introduction
            listRet.list[i].work_describe = listRet.list[i].info.work_describe
            listRet.list[i].work_specification = listRet.list[i].info.work_specification
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].work_image = listRet.list[i].info.work_image
            // listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].nft_status = listRet.list[i].info.nft_status
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                let obj
                if(rets[i] && rets[i].ret) {
                    // listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    // listRet.list[i].src_file_name = listRet.list[i].originalname
                    obj = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    if(!status||obj.nft_status === status){
                        list[item] = obj
                        item++
                    }
                }else{
                    listRet.list[i].tips = '审核中！'
                }
            }
        })

        res.json({ret:true,msg:'success',list:list})
    }
    else{
        res.json({ret:false,msg:'user-nft-list is empty',list:list})
    }
}


/**
 * 查询用户的购买订单纪录（重要）
 * @type {queryUserNFTBuyedObjs}
 */
window.forklist_c.queryUserNFTBuyedObjs =queryUserNFTBuyedObjs;
async function queryUserNFTBuyedObjs(req, res) {
    let {user_id, s_id, random,dst_user_id, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    // begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    //查询的是自己的还是他人的
    user_id = dst_user_id ? dst_user_id : user_id

    //查询用户资料，nft_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)
    if(!userInfo.nft_buyed_id)
    {
        return res.json({ret: false, msg: "query nft_buyed_id failed",list:[]});
    }

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.nft_buyed_id,opcode:'send',begin:begin*len,len:len})

    let queryObjInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,src_kind,src_name,src_desc,src_price,src_image} = str_filter.get_req_data(req)
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].info.obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            listRet.list[i].work_type = listRet.list[i].info.work_type
            listRet.list[i].work_name = listRet.list[i].info.work_name
            listRet.list[i].work_describe = listRet.list[i].info.work_describe
            listRet.list[i].buy_time = str_filter.GetDateTimeFormat(listRet.list[i].info.buy_time)
            // listRet.list[i].src_price = listRet.list[i].info.src_price
            listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].work_image = listRet.list[i].info.work_image
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    // let info = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                }else{
                    listRet.list[i].tips = '审核中！'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-buyed-nft-list is empty',list:[]})
    }
}


/**
 * 查询nft作品历史交易记录
 * @type {queryNFTHistoryDeals}
 */
window.forklist_c.queryNFTHistoryDeals =queryNFTHistoryDeals;
async function queryNFTHistoryDeals(req,res) {
    let {user_id, s_id, obj_id, begin, len} = str_filter.get_req_data(req)

    // let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!str) return res.json({ret: false, msg: "session error"})

    if (!obj_id) return res.json({ret: false, msg: "obj_id error"})

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})


    //历史交易记录
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'send',begin: begin*len,len: len})
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            listRet.list[i].create_time = str_filter.GetDateFormat('y-m-d',listRet.list[i].create_time_i)

            //查询用户资料，创作者
            let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:listRet.list[i].info.buy_user_id,opcode:'assert',begin:0,len:1})
            if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
            let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

            delete userInfo.pwd
            delete userInfo.salt

            listRet.list[i].info.buy_userInfo = userInfo

            delete listRet.list[i].txjson
            // delete listRet.list[i].info
        }
        res.json({ret:true,msg:'success',list:listRet.list})
    }else{
        res.json({ret:true,msg:'success',list:[]})
    }
}


/**
 * 查询所有的用户的购买订单纪录（重要）
 * @type {queryAllUserBuyedObjs}
 */
window.forklist_c.queryAllUserBuyedObjs =queryAllUserBuyedObjs;
async function queryAllUserBuyedObjs(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})
    //let obj = {phone,user_id,role_kind,role_name,paper_kind,paper_code,code,filename,email:userInfo.email}
    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_srcallBUY0000000',opcode:'send',begin:begin*len,len:len})

    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,src_kind,src_name,src_desc,src_price,src_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            listRet.list[i].buy_user_id = listRet.list[i].info.buy_user_id
            listRet.list[i].src_kind = listRet.list[i].info.src_kind
            listRet.list[i].src_name = listRet.list[i].info.src_name
            listRet.list[i].src_desc = listRet.list[i].info.src_desc
            listRet.list[i].buy_time = str_filter.GetDateTimeFormat(listRet.list[i].info.buy_time)
            listRet.list[i].src_price = listRet.list[i].info.src_price
            listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].pay_type = listRet.list[i].info.pay_type
            listRet.list[i].pay_money_real = listRet.list[i].info.pay_money_real
            listRet.list[i].src_image = listRet.list[i].info.src_image
            listRet.list[i].src_file = listRet.list[i].info.src_file
            listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].tips = listRet.list[i].info.tips

            listRet.list[i].pay_gsb = listRet.list[i].info.pay_gsb
            listRet.list[i].src_num = listRet.list[i].info.src_num

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-buyed-gsbsrc-list is empty'})
    }
}


/**
 * 所有用户铸造的NFT作品列表（我的发布）
 * @type {queryAllUserNFTWorks}
 */
window.forklist_c.queryAllUserNFTWorks =queryAllUserNFTWorks;
async function queryAllUserNFTWorks(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_nftall0000000000',opcode:'send',begin:begin*len,len:len})
    let queryObjInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,src_kind,src_name,src_desc,src_price,src_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].artist = listRet.list[i].info.artist
            listRet.list[i].artist_introduction = listRet.list[i].info.artist_introduction
            listRet.list[i].work_name = listRet.list[i].info.work_name
            listRet.list[i].work_type = listRet.list[i].info.work_type
            listRet.list[i].work_introduction = listRet.list[i].info.work_introduction
            listRet.list[i].work_describe = listRet.list[i].info.work_describe
            listRet.list[i].work_specification = listRet.list[i].info.work_specification
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].work_image = listRet.list[i].info.work_image
            // listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    // listRet.list[i].src_file_name = listRet.list[i].originalname
                }else{
                    listRet.list[i].tips = '待审核'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'all user-nft-list is empty'})
    }
}



//专辑/////////////////////////////////////////////////////////////////
/**
 * 制作专辑
 * @type {newAlbum}
 */
window.forklist_c.newAlbum =newAlbum;
async function newAlbum(req,res) {
    let {user_id,s_id,album_type,album_name,album_introduction,album_specification,album_image} = str_filter.get_req_data(req)

    console.log('ll_config.session-str:',ll_config.redis_key+":session:"+user_id+"-"+s_id)
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    // if(!publisher) return res.json({ret:false,msg:"publisher error"}) //发行商


    if(!album_type) return res.json({ret:false,msg:"album_type error"}) //专辑类型
    if(!album_name) return res.json({ret:false,msg:"album_name error"}) //专辑名称

    if(!album_introduction) return res.json({ret:false,msg:"album_introduction error"}) //专辑简介
    // if(!album_describe) return res.json({ret:false,msg:"album_describe error"}) //专辑描述
    if(!album_specification) return res.json({ret:false,msg:"album_specification error"}) //专辑规格

    if(!album_image) return res.json({ret:false,msg:"album_image error"}) //专辑封面
    // if(!work_price || work_price!=work_price*1) return res.json({ret:false,msg:"work_price error"}) //作品价格
    // if(!rmb_price || rmb_price!=rmb_price*1) return res.json({ret:false,msg:"rmb_price error"}) //作品价格

    let obj = {user_id,album_type,album_name,album_introduction,album_specification,album_image, 
        save_time:parseInt(new Date().getTime()/1000),tips:'待发布'}

    console.log("nft-album-obj:"+JSON.stringify(obj))

    //创建全部专辑id
    let forkAlbumallidRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_albumall00000000',opcode:'fork',begin:0,len:1})
    if(!forkAlbumallidRet ||!forkAlbumallidRet.ret)
    {
        let forkAlbumallidRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+'_albumall00000000'})
        if(!forkAlbumallidRet ||!forkAlbumallidRet.ret) return res.json({ret:false,msg:"fork albumall-id failed"});
    }


    //查询用户资料，看是否已经有album_list_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    obj.publisher=userInfo.user_name //发行商名称

    if(!userInfo.album_list_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'albumlist'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork album_list_id failed"});
        userInfo.album_list_id = forkRet.token_x
        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})

        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo album_list_id failed"});
    }
    obj.album_list_id = userInfo.album_list_id

    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'albumID'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork album-new-obj-id failed"});

    //保存obj-id，方便查询。
    obj.obj_id = forkObjRet.token_x

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.album_list_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert album-new-obj-info failed"});

    //send user-album-list-obj-id
    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.album_list_id,
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendRet || !sendRet.ret)  return res.json({ret: false, msg: "send album-obj-info failed"});


    //send all-user-album-obj-id
    // let sendAllRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_albumall00000000',
    //     opval:JSON.stringify(obj),extra_data:user_id})
    // if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send album-obj-info to albumall failed"});


    return res.json({ret:true,msg:'success'})
}

/**
 * 查看专辑的信息
 * @type {queryAlbumInfo}
 */
window.forklist_c.queryAlbumInfo =queryAlbumInfo;
async function queryAlbumInfo(req,res) {
    let {user_id, s_id, obj_id} = str_filter.get_req_data(req)

    // let str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!str) return res.json({ret: false, msg: "session error"})

    if (!obj_id) return res.json({ret: false, msg: "obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE + '/chain/opcode', {token: obj_id, opcode: 'assert', begin: 0, len: 1})
    if (!assertInfoRet || !assertInfoRet.ret) return res.json({ret: false, msg: "obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    oldObj.ret = true;
    oldObj.msg = 'success'
    res.json(oldObj)
}


/**
 * 更新album信息（由obj_id）
 * @type {updateAlbumInfo}
 */
window.forklist_c.updateAlbumInfo =updateAlbumInfo;
async function updateAlbumInfo(req,res) {
    let {user_id,s_id, obj_id, album_name, album_type, album_introduction, album_specification,album_image} = str_filter.get_req_data(req)

    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})


    let obj = {obj_id, album_name, album_type, album_introduction, album_specification, album_image,send_time:parseInt(new Date().getTime()/1000)}
    console.log("nft-obj:"+JSON.stringify(obj))

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    
    // if(oldObj.user_id!=user_id && !manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"update nftinfo no pm"})

    let newObj = {}
    newObj = Object.assign(newObj,oldObj,obj)

    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: user_id})
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-update-obj-info failed"});

    return res.json({ret:true,msg:'success'})
}


/**
 * 查询用户的专辑
 * @type {queryUserAlbums}
 */
window.forklist_c.queryUserAlbums =queryUserAlbums;
async function queryUserAlbums(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    //album_list_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.album_list_id)
    {
        return res.json({ret: false, msg: "user album_list_id is empty",list:[]});
    }

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:userInfo.album_list_id,opcode:'send',begin:begin*len,len:len})

    let queryObjInfoP = []

    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            ////let obj = {user_id,artist,artist_introduction,work_name,work_type,work_introduction,work_describe,work_specification,work_image,rmb_price,save_time:parseInt(new Date().getTime()/1000),tips:'审核中'}
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].album_name = listRet.list[i].info.album_name
            listRet.list[i].album_type = listRet.list[i].info.album_type
            listRet.list[i].album_introduction = listRet.list[i].info.album_introduction
            listRet.list[i].album_describe = listRet.list[i].info.album_describe
            listRet.list[i].album_specification = listRet.list[i].info.album_specification
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            // listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].album_image = listRet.list[i].info.album_image
            // listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    // listRet.list[i].src_file_name = listRet.list[i].originalname
                }else{
                    listRet.list[i].tips = '审核中！'
                }
            }
        })
        let worklist;
        let item =0;
        for(;item<listRet.list.length;item++){
            worklist = await rpc_api_util.s_query_token_list(OBJ_API_BASE,listRet.list[item].obj_id,'hold',0,20);
            listRet.list[item].worklist = worklist
        }

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'user-album-list is empty',list:[]})
    }
}


/**
 * 所有发行商制作的专辑列表
 * @type {queryAllUserAlbums}
 */
window.forklist_c.queryAllUserAlbums =queryAllUserAlbums;
async function queryAllUserAlbums(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_albumall00000000',opcode:'send',begin:begin*len,len:len})
    let queryObjInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,src_kind,src_name,src_desc,src_price,src_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].album_name = listRet.list[i].info.album_name
            listRet.list[i].album_type = listRet.list[i].info.album_type
            listRet.list[i].album_introduction = listRet.list[i].info.album_introduction
            listRet.list[i].album_describe = listRet.list[i].info.album_describe
            listRet.list[i].album_specification = listRet.list[i].info.album_specification
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            // listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].album_image = listRet.list[i].info.album_image
            // listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    // listRet.list[i].src_file_name = listRet.list[i].originalname
                }else{
                    listRet.list[i].tips = '待审核'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'all user-album-list is empty'})
    }
}


/**
 * 查询所有的通过审核的专辑
 * @type {queryAllAlbum}
 */
window.forklist_c.queryAllAlbum =queryAllAlbum;
async function queryAllAlbum(req, res) {
    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    // begin = begin - 1

    // let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,OBJ_TOKEN_NAME+'_albumall00000000','hold',begin*len,len);
    let worklist
    let qs =[]
    for(let i=0;i<list.length;i++){
        worklist =[]// await rpc_api_util.s_query_token_list(OBJ_API_BASE,list[i].obj_id,'hold',0,20);
        list[i].worklist = worklist
        qs.push(user_c.s_queryUserInfo(list[i].user_id))
        //list[i].forkUserInfo = await user_c.s_queryUserInfo(list[i].user_id);
    }
    await Promise.all(qs).then((rets)=>{
        for(let i=0;i<list.length;i++){
            list[i].forkUserInfo = rets[i]
        }
    })

    res.json({ret:true,msg:'success',list:list})
}

/**
 * 查询所有的通过审核的专辑h5
 * @type {queryAllAlbumH5}
 */
window.forklist_c.queryAllAlbumH5 =queryAllAlbumH5;
async function queryAllAlbumH5(req, res) {
    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    // begin = begin - 1

    // let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,OBJ_TOKEN_NAME+'_albumall00000000','hold',begin*len,len);
    // let worklist
    for(let i=0;i<list.length;i++){
        // worklist = await rpc_api_util.s_query_token_list(OBJ_API_BASE,list[i].obj_id,'hold',0,20);
        // list[i].worklist = worklist

        list[i].forkUserInfo = await user_c.s_queryUserInfo(list[i].user_id);
    }

    res.json({ret:true,msg:'success',list:list})
}

/**
 * 发布专辑（待审核）
 * @type {releaseAlbum}
 */
window.forklist_c.releaseAlbum =releaseAlbum;
async function releaseAlbum(req, res) {
    let {user_id, s_id, obj_id,random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    // if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('album')<0) return res.json({ret:false,msg:"obj_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})


    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '审核中'
    obj.send_time = parseInt(new Date().getTime()/1000)

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //send all-user-album-obj-id
    let sendAllRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_albumall00000000',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send album-obj-info to albumall failed"});


    res.json({ret:true,msg:'success'})
}


/**
 * 加入专辑
 * @type {includedInAlbum}
 */
window.forklist_c.includedInAlbum =includedInAlbum;
async function includedInAlbum(req, res) {
    let {user_id, s_id, obj_id, album_name, work_id, random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    // if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('album')<0) return res.json({ret:false,msg:"obj_id error"})

    if(!work_id) return res.json({ret:false,msg:"work_id error"})
    if(work_id.indexOf('fork')<0) return res.json({ret:false,msg:"work_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:work_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    // //作品已经加入专辑
    obj.album_name = album_name
    obj.album_id = obj_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:work_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //专辑与作品hold关联
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj_id,token_y: work_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info to album failed"});


    res.json({ret:true,msg:'success'})
}

/**
 * 专辑移除作品
 * @type {removeInAlbum}
 */
window.forklist_c.removeInAlbum =removeInAlbum;
async function removeInAlbum(req, res) {
    let {user_id, s_id, obj_id, work_id, random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('album')<0) return res.json({ret:false,msg:"obj_id error"})

    if(!work_id) return res.json({ret:false,msg:"work_id error"})
    if(work_id.indexOf('fork')<0) return res.json({ret:false,msg:"work_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:work_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    
    delete obj.album_name
    delete obj.album_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:work_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //专辑与作品hold关联
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj_id,token_y: work_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete nft-obj-info to album failed"});


    res.json({ret:true,msg:'success'})
}

/**
 * 审核通过专辑的发布
 * @type {sendOkAlbum}
 */
window.forklist_c.sendOkAlbum =sendOkAlbum;
async function sendOkAlbum(req, res) {
    let {user_id, s_id, obj_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('album')<0) return res.json({ret:false,msg:"obj_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '审核通过'
    obj.album_status='ok'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //hold user-hold _albumall00000000
    await rpc_api_util.s_query_token_id(OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME+'_albumall00000000')
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_albumall00000000',token_y:obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold album-obj-info failed"});


    res.json({ret:true,msg:'success'})
}

/**
 * 审核不通过专辑的发布
 * @type {sendDenyAlbum}
 */
window.forklist_c.sendDenyAlbum =sendDenyAlbum;
async function sendDenyAlbum(req, res) {
    let {user_id, s_id, obj_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('album')<0) return res.json({ret:false,msg:"obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '【审核拒绝】该专辑发布！备注：'+msg
    obj.album_status='deny'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //下架
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+'_albumall00000000',token_y:obj_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete nft from nftall list failed"});
    

    res.json({ret:true,msg:'success'})
}

/**
 * 查询收录在专辑里的作品
 * @type {queryNFTWorksInAlbum}
 */
window.forklist_c.queryNFTWorksInAlbum =queryNFTWorksInAlbum;
async function queryNFTWorksInAlbum(req, res) {
    let {user_id, s_id, obj_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    // begin = begin - 1

    // let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    // if (!s_str) return res.json({ret: false, msg: "session error"})

    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,obj_id,'hold',begin*len,len);

    //userinfo
    let creatorInfo
    for(let i=0;i<list.length;i++){
        creatorInfo = await user_c.s_queryUserInfo(list[i].user_id);
        // console.log("用户："+creatorInfo);
        list[i].creatorInfo = creatorInfo

        if(list[i].owner){
            list[i].forkUserInfo = await user_c.s_queryUserInfo(list[i].owner);
        }else{
            list[i].forkUserInfo = creatorInfo
        }
    }

    res.json({ret:true,msg:'success',list:list})
}


/**
 * 收藏NFT作品
 * @type {collectNFT}
 */
window.forklist_c.collectNFT =collectNFT;
async function collectNFT(req, res) {
    let {user_id, s_id, obj_id,random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})

    //创建用户收藏列表
    let forkUserCollectidRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1})
    if(!forkUserCollectidRet ||!forkUserCollectidRet.ret)
    {
        let forkUserCollectidRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1]})
        if(!forkUserCollectidRet ||!forkUserCollectidRet.ret) return res.json({ret:false,msg:"fork user-collect-id failed"});
    }
    
    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)


    //hold collect-obj-hold
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],token_y:obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold collect-obj-info failed"});


    res.json({ret:true,msg:'success'})
}

/**
 * 取消收藏NFT作品
 * @type {cancelCollectNFT}
 */
window.forklist_c.cancelCollectNFT =cancelCollectNFT;
async function cancelCollectNFT(req, res) {
    let {user_id, s_id, obj_id,random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)


    //hold collect-obj-hold
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],token_y:obj_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete nft from collection list failed"});


    res.json({ret:true,msg:'success'})
}

/**
 * 是否收藏作品
 * @type {isCollectNFT}
 */
window.forklist_c.isCollectNFT =isCollectNFT;
async function isCollectNFT(req, res) {
    let {user_id, s_id, obj_id,random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})

    //创建用户收藏列表
    let forkUserCollectidRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],opcode:'fork',begin:0,len:1})
    if(!forkUserCollectidRet ||!forkUserCollectidRet.ret)
    {
        let forkUserCollectidRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1]})
        if(!forkUserCollectidRet ||!forkUserCollectidRet.ret) return res.json({ret:false,msg:"fork user-collect-id failed"});
    }

    let isholdRet = await rpc_query(OBJ_API_BASE+'/chain/relations/exists',{token_x:OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],token_y:obj_id,opcode:'hold'})
    res.json(isholdRet)
}


/**
 * 查询用户收藏的NFT作品
 * @type {queryCollectNFT}
 */
window.forklist_c.queryCollectNFT =queryCollectNFT;
async function queryCollectNFT(req, res) {
    let {user_id, s_id, random, sign, begin, len} = str_filter.get_req_data(req);

    if (begin != begin * 1) return res.json({ret: false, msg: "page format error"})
    if (len != len * 1) return res.json({ret: false, msg: "limit format error"})
    // begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key + ":session:" + user_id + "-" + s_id)
    if (!s_str) return res.json({ret: false, msg: "session error"})

    let list = await rpc_api_util.s_query_token_list(OBJ_API_BASE,OBJ_TOKEN_NAME+"_"+user_id.split('_')[1],'hold',begin*len,len);

    res.json({ret:true,msg:'success',list:list})
}



///////免费福刻FORK////////////////////
/**
 * 免费福刻FORK
 * @type {freeFork}
 */
window.forklist_c.freeFork =freeFork;
async function freeFork(req, res) {
    //pay_type=rmb or gsb
    let {user_id, s_id, obj_id,random, work_name,work_type,work_describe,work_specification,work_image,rmb_price} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let oldobj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    // if(obj.user_id==user_id) return res.json({ret:false,msg:"can not fork youself nft"})

    let obj = {work_name,work_type,work_describe,work_specification,work_image,rmb_price,save_time:parseInt(new Date().getTime()/1000)}

    let newObj = {}
    newObj = Object.assign(newObj,oldobj,obj)

    //查询用户资料，nft_buyed_id
    let assertUserInfoRet = await rpc_query(USER_API_BASE+'/chain/opcode',{token:user_id,opcode:'assert',begin:0,len:1})
    if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret:false,msg:'user unexists'})
    let userInfo = JSON.parse(JSON.parse(assertUserInfoRet.list[0].txjson).opval)

    if(!userInfo.nft_buyed_id)
    {
        let forkRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'nftbuy'})
        if(!forkRet||!forkRet.ret) return res.json({ret: false, msg: "fork user-buyed-id failed"});
        userInfo.nft_buyed_id = forkRet.token_x

        let assertUserInfoRet = await rpc_query(USER_API_BASE+'/op',{token_x:USER_TOKEN_ROOT,token_y:user_id,opcode:'assert',
            opval:JSON.stringify(userInfo),extra_data:userInfo.phone})
        if(!assertUserInfoRet || !assertUserInfoRet.ret) return res.json({ret: false, msg: "assert userInfo nft-buyed-id failed"});
    }

    //福刻
    newObj.original_author= newObj.user_id
    newObj.original_obj_id= obj_id
    newObj.owner = user_id
    newObj.user_id = user_id
    newObj.tips = '待发布'
    delete newObj.nft_status
    delete newObj.FORKID //不能直接复制
    //如果存在，就发布一个新的obj
    let forkObjRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,space:'forkID'})
    if(!forkObjRet||!forkObjRet.ret) return res.json({ret: false, msg: "fork nft-new-obj-id failed"});
    //保存obj-id，方便查询。
    newObj.obj_id = forkObjRet.token_x
    let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(newObj),extra_data: newObj.nft_list_id })
    if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-new-obj-info failed"});


    //更新了用户的购买列表
    let buyOrder = {buy_user_id:user_id,user_name:userInfo.user_name,buy_obj_id:obj_id,buy_time:parseInt(new Date().getTime()/1000),pay_rmb:obj.rmb_price}
    buyOrder = Object.assign(newObj,buyOrder)

    let assertbuyOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:forkObjRet.token_x,opcode:'assert',
        opval:JSON.stringify(buyOrder),extra_data: newObj.nft_list_id })
    if(!assertbuyOBJRet || !assertbuyOBJRet.ret) return res.json({ret: false, msg: "assert nft-new-obj-info failed"});

    //hold user-hold nft_buyed_id
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:userInfo.nft_buyed_id,token_y:obj_id,opcode:'hold',
    opval:'add',extra_data:JSON.stringify(buyOrder)})
    if(!holdRet || !holdRet.ret)
    {
        console.log("更新福刻FORK列表失败")
        return res.json({ret: false, msg: "hold nft-obj-info to nft_buyed_id failed"});
    }

    let sendRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:userInfo.nft_buyed_id,
        opval:JSON.stringify(buyOrder),extra_data:obj_id})
    if(!sendRet || !sendRet.ret)
    {
        console.log("更新福刻FORK列表失败")
        return res.json({ret: false, msg: "send to user-buyed-list failed"});
    }


    //更新源码订单数量和购买数量信息。
    // let xx = async function()
    // {
    //     //该作品的交易记录
    //     await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opval:JSON.stringify(buyOrder),extra_data: user_id})
    // }
    // xx();



    //福刻版本
    // let NFTFork = async function(){

    //     //专辑与作品hold关联
    //     let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: obj.album_id,token_y: obj.obj_id,opcode:'hold',
    //     opval:'add',extra_data:JSON.stringify(buyOrder)})
    //     if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info to album failed"});


    // }
    // NFTFork();

    res.json({ret:true,msg:'success',obj_id:buyOrder.obj_id})
}

/**
 * 发布福刻（待审核）
 * @type {releaseNFTFork}
 */
window.forklist_c.releaseNFTFork =releaseNFTFork;
async function releaseNFTFork(req, res) {
    let {user_id, s_id, obj_id,random, sign} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    // if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '审核中'
    obj.send_time = parseInt(new Date().getTime()/1000)

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});


    let assertAlbumInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj.album_id,opcode:'assert',begin:0,len:1})
    if(!assertAlbumInfoRet || !assertAlbumInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    let albumobj = JSON.parse(JSON.parse(assertAlbumInfoRet.list[0].txjson).opval)

    //创建全部作品id
    let forkProallidRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_'+albumobj.user_id.split('_')[1],opcode:'fork',begin:0,len:1})
    if(!forkProallidRet ||!forkProallidRet.ret)
    {
        let forkProallidRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+'_'+albumobj.user_id.split('_')[1]})
        if(!forkProallidRet ||!forkProallidRet.ret) return res.json({ret:false,msg:"fork nftall-id failed"});
    }

    //send all-user-album-obj-id
    let sendAllRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_'+albumobj.user_id.split('_')[1],
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendAllRet || !sendAllRet.ret)  return res.json({ret: false, msg: "send album-obj-info to albumall failed"});


    //创建全部forks
    let forkfreeallidRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_nftforkall000000',opcode:'fork',begin:0,len:1})
    if(!forkfreeallidRet ||!forkfreeallidRet.ret)
    {
        let forkfreeallidRet = await rpc_query(OBJ_API_BASE+'/fork',{token:OBJ_TOKEN_ROOT,dst_token:OBJ_TOKEN_NAME+'_nftforkall000000'})
        if(!forkfreeallidRet ||!forkfreeallidRet.ret) return res.json({ret:false,msg:"fork nftall-id failed"});
    }

    //send all-user-nft-obj-id
    let sendNFTAllRet = await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:OBJ_TOKEN_NAME+'_nftforkall000000',
        opval:JSON.stringify(obj),extra_data:user_id})
    if(!sendNFTAllRet || !sendNFTAllRet.ret)  return res.json({ret: false, msg: "send nft-obj-info to nftall failed"});


    res.json({ret:true,msg:'success'})
}


/**
 * 用户审核免费福刻列表
 * @type {queryUserNFTForks}
 */
window.forklist_c.queryUserNFTForks =queryUserNFTForks;
async function queryUserNFTForks(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_'+user_id.split('_')[1],opcode:'send',begin:begin*len,len:len})
    let queryObjInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,src_kind,src_name,src_desc,src_price,src_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].artist = listRet.list[i].info.artist
            listRet.list[i].artist_introduction = listRet.list[i].info.artist_introduction
            listRet.list[i].work_name = listRet.list[i].info.work_name
            listRet.list[i].work_type = listRet.list[i].info.work_type
            listRet.list[i].work_introduction = listRet.list[i].info.work_introduction
            listRet.list[i].work_describe = listRet.list[i].info.work_describe
            listRet.list[i].work_specification = listRet.list[i].info.work_specification
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].work_image = listRet.list[i].info.work_image
            // listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                }else{
                    listRet.list[i].tips = '待审核'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'all fork-nft-list is empty',list:[]})
    }
}


/**
 * 审核通过福刻Fork的发布
 * @type {sendOkFork}
 */
window.forklist_c.sendOkFork =sendOkFork;
async function sendOkFork(req, res) {
    let {user_id, s_id, obj_id,accounted,random, sign,msg} = str_filter.get_req_data(req);
    
    if(accounted)
    {
        try{
            if(!(parseInt(accounted)*0==0)) return res.json({ret:false,msg:"accounted error"})
        }catch(ex){
            console.log('accounted-exception:'+accounted)
        }
        accounted = parseInt(accounted)
        if(accounted<0 || accounted>100){
            return res.json({ret:false,msg:"accounted error, must be 0-100"})
        }
    }

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})


    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    //审核之前，先判断权限 on 2023-5-11
    if(obj.work_specification=='auto' ){
        //须被免费fork的FORK福刻，拥有者也是当前的操作user_id
        if((obj.user_id !=user_id || obj.original_author!=user_id) && !manager_c.isManagerUid(user_id)){
            return res.json({ret:false,msg:'pm error: you are not manager , and this fork is not your'})
        }
    }else{
        if(!manager_c.isManagerUid(user_id)){
            return res.json({ret:false,msg:'pm error: you are not manager'})
        }
    }

    obj.tips = '审核通过'
    obj.nft_status='ok'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id
    if(accounted)   obj.accounted = accounted

    //第一次通过才生成交易记录
    let flag = false;
    if(!obj.first_tip){
        obj.first_tip = true
        flag = true
    }
    //////
    // obj.album_id= 'obj_albumID23ZBsLtVL'
    // obj.album_name = '加密狂潮'
    // obj.original_author = 'user_29L7TgLavKkUSKMN'
    // obj.original_obj_id = 'obj_forkIDz3GSHLraEN8'

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //hold user-hold 
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:obj.album_id,token_y:obj_id,opcode:'hold',
        opval:'add',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold album-obj-info failed"});

    //免费福刻Fork
    obj.pay_rmb = "0"
    // obj.buy_user_id = obj.user_id
    // 更新源码订单数量和购买数量信息。
    let xx = async function()
    {
        //该作品的交易记录
        await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:obj.original_obj_id,opval:JSON.stringify(obj),extra_data: user_id})
    }

    if(flag){
        xx();
    }


    let forkMapRet = await window.user_c.createFORKMap(obj_id)
    console.log('freeFORK-000-forkMapRet:',forkMapRet)

    res.json({ret:true,msg:'success'})
}

/**
 * 审核不通过福刻Fork的发布
 * @type {sendDenyFork}
 */
window.forklist_c.sendDenyFork =sendDenyFork;
async function sendDenyFork(req, res) {
    let {user_id, s_id, obj_id,random, sign,msg} = str_filter.get_req_data(req);

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})


    if(!obj_id) return res.json({ret:false,msg:"obj_id error"})
    if(obj_id.indexOf('fork')<0) return res.json({ret:false,msg:"obj_id error"})

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})

    msg = !msg ?'' :msg

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    obj.tips = '【审核拒绝】该福刻发布！备注：'+msg
    obj.nft_status='deny'
    obj.send_time = parseInt(new Date().getTime()/1000)
    obj.m_user_id = user_id

    let assertUpdateRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
        opval:JSON.stringify(obj),extra_data: obj.user_id })
    if(!assertUpdateRet || !assertUpdateRet.ret) return res.json({ret: false, msg: "assert update info failed"});

    //下架
    let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:obj.album_id,token_y:obj_id,opcode:'hold',
        opval:'del',extra_data:JSON.stringify(obj)})
    if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "delete nft from album list failed"});
    

    res.json({ret:true,msg:'success'})
}


/**
 * 管理员查询全部用户fork nft列表
 * @type {queryAllUserNFTForks}
 */
window.forklist_c.queryAllUserNFTForks =queryAllUserNFTForks;
async function queryAllUserNFTForks(req, res) {
    let {user_id, s_id, random, sign,begin,len} = str_filter.get_req_data(req);

    if(begin !=begin*1) return res.json({ret:false,msg:"page format error"})
    if(len !=len*1) return res.json({ret:false,msg:"limit format error"})
    begin = begin - 1

    let s_str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    if(!s_str) return res.json({ret:false,msg:"session error"})

    if(!manager_c.isManagerUid(user_id)) return res.json({ret:false,msg:"manager-role error"})

    let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:OBJ_TOKEN_NAME+'_nftforkall000000',opcode:'send',begin:begin*len,len:len})
    let queryObjInfoP = []
    if(listRet &&listRet.ret)
    {
        let i =0;
        for(;i<listRet.list.length;i++)
        {
            listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
            listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)

            //let {user_id,s_id,src_kind,src_name,src_desc,src_price,src_image} = str_filter.get_req_data(req)
            listRet.list[i].obj_id = listRet.list[i].info.obj_id
            //放到数组中，等待处理。
            queryObjInfoP.push( rpc_query(OBJ_API_BASE+'/chain/opcode',{token:listRet.list[i].obj_id,opcode:'assert',begin:0,len:1}))

            listRet.list[i].artist = listRet.list[i].info.artist
            listRet.list[i].artist_introduction = listRet.list[i].info.artist_introduction
            listRet.list[i].work_name = listRet.list[i].info.work_name
            listRet.list[i].work_type = listRet.list[i].info.work_type
            listRet.list[i].work_introduction = listRet.list[i].info.work_introduction
            listRet.list[i].work_describe = listRet.list[i].info.work_describe
            listRet.list[i].work_specification = listRet.list[i].info.work_specification
            listRet.list[i].save_time = str_filter.GetDateTimeFormat(listRet.list[i].info.save_time)
            listRet.list[i].rmb_price = listRet.list[i].info.rmb_price
            listRet.list[i].work_image = listRet.list[i].info.work_image
            // listRet.list[i].src_file_name = listRet.list[i].info.originalname
            listRet.list[i].tips = listRet.list[i].info.tips

            delete listRet.list[i].txjson
            delete listRet.list[i].info
        }

        //处理全部请求。
        await Promise.all(queryObjInfoP).then(function(rets){
            JSON.stringify('queryOrderInfoP-rets:'+JSON.stringify(rets))
            let i =0;
            for(;i<listRet.list.length;i++)
            {
                if(rets[i] && rets[i].ret) {
                    listRet.list[i] = JSON.parse(JSON.parse(rets[i].list[0].txjson).opval)
                    // listRet.list[i].src_file_name = listRet.list[i].originalname
                }else{
                    listRet.list[i].tips = '待审核'
                }
            }
        })

        res.json({ret:true,msg:'success',list:listRet.list})
    }
    else{
        res.json({ret:false,msg:'all user-nft-list is empty'})
    }
}

/**
 * 计算分账函数
 * @type {calculateSubaccount}
 */
window.forklist_c.calculateSubaccount =calculateSubaccount;
async function calculateSubaccount(list, level, obj_id ,payRMBNum) {

    let subAccount = {}

    subAccount.obj_id = obj_id
    subAccount.level = level

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) {
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) {
            console.log("分佣：查询福刻信息失败")
            list.push(subAccount)
            return list;
        }
    }

    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    let amount; //分配的佣金
    let send_rmb; //上级福刻家收益
    let amount_rmb; //下级福刻家分佣金额

    if(obj.original_obj_id){
        level++
        await calculateSubaccount(list, level, obj.original_obj_id, payRMBNum)

        subAccount.send_user = list[list.length-1].user_id
        amount = list[list.length-1].amount_rmb
        list.push(subAccount)

    }else{
        amount = payRMBNum
        list.push(subAccount)
        subAccount.send_user = "rmb_0000000000000000"  //平台收取
    }


    if(obj.accounted){
        let percent = obj.accounted/100   //上级分账比例
        let u = 1-percent                 //发行商收益百分比

        let price_next = amount * u     //分配福刻家收益
        let price = amount - price_next //分配上级福刻家收益

        send_rmb =  Math.floor(price*100)/100 //保留两位小数
        amount_rmb =  Math.floor(price_next*100)/100 //保留两位小数

    }else{
        send_rmb = 0
        amount_rmb = amount
    }

    subAccount.amount = amount
    subAccount.send_rmb = send_rmb
    subAccount.amount_rmb = amount_rmb
    subAccount.user_id = obj.user_id



}


/**
 * 发送分账金额函数
 * @type {sendSubaccount}
 */
window.forklist_c.sendSubaccount =sendSubaccount;
async function sendSubaccount(obj_id, list) {

    let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    if(!assertInfoRet || !assertInfoRet.ret) {
        let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
        if(!assertInfoRet || !assertInfoRet.ret) {
            console.log("分佣：查询福刻源失败")
        }
    }
    let obj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)

    obj.send_list=list

    let i
    for(i = 1; i < list.length; i++){
    
        //如果未创建，则创建一个人民币帐户
        await rpc_query(RMB_API_BASE+'/fork',{token:RMB_TOKEN_ROOT,dst_token: RMB_TOKEN_NAME+"_"+list[i].send_user.split('_')[1]})
    
        obj.send_node='佣金'
        let payRet = await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
            token_y: RMB_TOKEN_NAME + '_' + list[i].send_user.split('_')[1], opval: list[i].send_rmb, extra_data: JSON.stringify(obj)})
        if (!payRet || !payRet.ret) {
            let payRet = await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
                token_y: RMB_TOKEN_NAME + '_' + list[i].send_user.split('_')[1], opval: list[i].send_rmb, extra_data: JSON.stringify(obj)})
            if (!payRet || !payRet.ret) {
                console.log("分佣发送金额失败："+i)
            }
        }
    }

    //  
    obj.send_node='收入'
    let payRet = await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
        token_y: RMB_TOKEN_NAME + '_' + list[i - 1].user_id.split('_')[1], opval: list[i - 1].amount_rmb, extra_data: JSON.stringify(obj)})
    if (!payRet || !payRet.ret) {
        let payRet = await rpc_query(RMB_API_BASE + '/send', {token_x: RMB_TOKEN_ROOT,
            token_y: RMB_TOKEN_NAME + '_' + list[i - 1].user_id.split('_')[1], opval: list[i - 1].amount_rmb, extra_data: JSON.stringify(obj)})
        if (!payRet || !payRet.ret) {
            console.log("分佣：发送金额失败："+i - 1)
        }
    }
    



    


}








////////////////////////测试//////////////////////////////////
window.forklist_c.test =test;
async function test(req, res) {
    let {} = str_filter.get_req_data(req);


    let list = [] , level=1 , obj_id = "obj_forkIDz4NB5k4Vr9b" , payRMBNum = 9

    
    await calculateSubaccount(list, level, obj_id, payRMBNum)



    // let obj_id = "obj_forkIDzG9GsjpFkb3"

    // let assertInfoRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:obj_id,opcode:'assert',begin:0,len:1})
    // if(!assertInfoRet || !assertInfoRet.ret) return res.json({ret:false,msg:"obj-assert-info is empty"})
    // let oldObj = JSON.parse(JSON.parse(assertInfoRet.list[0].txjson).opval)
    
    // oldObj.original_obj_id = 'obj_forkIDz3GSHLraEN8'

    // let assertOBJRet = await rpc_query(OBJ_API_BASE+'/op',{token_x:OBJ_TOKEN_ROOT,token_y:obj_id,opcode:'assert',
    //     opval:JSON.stringify(oldObj),extra_data: "user_id"})
    // if(!assertOBJRet || !assertOBJRet.ret) return res.json({ret: false, msg: "assert nft-update-obj-info failed"});




    // let listRet = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:"obj_nftbuy28AL8XmGxC",opcode:'send',begin:0,len:10})

    // let queryObjInfoP = []
    // if(listRet &&listRet.ret)
    // {
    //     let i =0;
    //     for(;i<listRet.list.length;i++)
    //     {
    //         listRet.list[i].txjson = JSON.parse(listRet.list[i].txjson)
    //         listRet.list[i].info = JSON.parse(listRet.list[i].txjson.opval)
    //     }

    // }
    // obj_albumID21E9PPH24
    // obj_forkID22aeuseDjvt
    
    //更新源码订单数量和购买数量信息。
    // let xx = async function()
    // {
    //     //该作品的交易记录
    //     await rpc_query(OBJ_API_BASE+'/send',{token_x:OBJ_TOKEN_ROOT,token_y:"obj_forkIDxu4EePfAbyK",opval:JSON.stringify(listRet.list[3].info),extra_data: "user_21DZzaUAHvVaSprg"})

    // }

    // xx();

    //福刻版本
    let NFTFork = async function(){

        //专辑与作品hold关联
        let holdRet = await rpc_query(OBJ_API_BASE+'/op',{token_x: "obj_albumID21E9PPH24",token_y: "obj_forkID273ApfHr9XS",opcode:'hold',
        opval:'add',extra_data:JSON.stringify(listRet.list[1].info)})
        if(!holdRet || !holdRet.ret)  return res.json({ret: false, msg: "hold nft-obj-info to album failed"});


    }
    // NFTFork();


    res.json({ret:true,msg:'success',list:list})
}
