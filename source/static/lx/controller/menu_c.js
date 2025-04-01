// const str_filter = require('../libs/str_filter');
// const config = require('../config').config;
// const user_redis = require('../config').user_redis;
// const manager_c = require('./manager_c');
window.menu_c = {}
const menuJSON = {
    "ret":true,
    "code": 0
    ,"msg": ""
    ,"data": [
        {
            "name": "home"
            ,"title": "概览"
            ,"icon": "layui-icon-home"
            ,"jump": "/"
        },
        {
            "name" :"gnode",
            "title": "商铺管理"
            ,"icon": "layui-icon-component"
            ,"list": [
                {
                    "name": "gnodes",
                    "title": "我的商铺"
                    ,"jump": "shop/my_shops"
                },
                {
                    "name": "create_gnode",
                    "title": "创建商铺"
                    ,"jump": "shop/new_shop"
                }
            ]
        }, {
            "name": "srcshop"
            ,"title": "小程序模板"
            ,"icon": "layui-icon-app"
            ,"list": [{
                "name": "rmb"
                , "title": "模板商店"
                , "jump": "srcshop/srclist"
            },{
                "name": "src_new"
                ,"title": "发布源码"
                , "jump": "srcshop/src_new"
            },{
                "name": "src_myobjs"
                ,"title": "我的发布"
                , "jump": "srcshop/src_myobjs"
            },{
                "name": "src_buyed"
                ,"title": "我的下载"
                , "jump": "srcshop/src_buyed"
            }
            ]
        },{
            "name" :"classify",
            "title": "货架管理"
            ,"icon": "layui-icon-tabs"
            ,"list": [{
                "name": "top",
                "title": "幻灯片"
                ,"jump": "classify/top"
            },{
                "name": "main",
                "title": "精选"
                ,"jump": "classify/main"
            },{
                "name": "main",
                "title": "会员专区"
                ,"jump": "classify/vip"
            },{
                "name": "classify_products"
                ,"title": "所有货架"
                ,"jump": "classify/classify_products"
            },{
                "name": "classifys"
                ,"title": "分类管理"
                ,"jump": "classify/classifys"
            }, {
                "name": "new_classify"
                ,"title": "创建分类"
                ,"jump": "classify/new_classify"
            }]
        },{
            "name" :"product",
            "title": "产品管理"
            ,"icon": "layui-icon-form"
            ,"list": [{
                "name": "list",
                "title": "所有产品"
                ,"jump": "product/list"
            },{
                "name": "new"
                ,"title": "发布产品"
                ,"jump": "product/new"
            },{
                "name": "store"
                ,"title": "产品仓库"
                ,"list":[{
                    "name":"products"
                    ,"title":"仓库货物"
                    ,"jump": "product/store/products"
                },{
                    "name":"list"
                    ,"title":"仓库管理"
                    ,"jump": "product/store/list"
                },{
                    "name":"new"
                    ,"title":"创建仓库"
                    ,"jump": "product/store/new"
                }]
            }]
        },{
            "name" :"shopping",
            "title": "订单管理"
            ,"icon": "layui-icon-cart"
            ,"list": [{
                "name": "all",
                "title": "所有订单"
                ,"jump": "shopping/all"
            }, {
                "name": "unpay"
                ,"title": "待支付订单"
                ,"jump": "shopping/unpay"
            },{
                "name": "payed"
                ,"title": "待发货订单"
                ,"jump": "shopping/payed"
            }, {
                "name": "recv"
                ,"title": "待收货订单"
                ,"jump": "shopping/recv"
            }, {
                "name": "comment"
                ,"title": "待评价订单"
                ,"jump": "shopping/comment"
            }, {
                "name": "refund"
                ,"title": "已退款订单"
                ,"jump": "shopping/refund"
            }, {
                "name": "end"
                ,"title": "已完成订单"
                ,"jump": "shopping/end"
            }]
        },{
            "name" :"customer",
            "title": "客户管理"
            ,"icon": "layui-icon-username"
            ,"list": [{
                "name": "list",
                "title": "所有客户"
                ,"jump": "customer/list"
            },{
                "name": "search"
                ,"title": "客户查询"
                ,"jump": "customer/search"
            }, {
                "name": "vip"
                ,"title": "会员客户"
                ,"jump": "customer/vip"
            }]
        },{
            "icon": "layui-icon-file-b",
            "name": "post"
            ,"title": "文章系统"
            ,"list": [{
                "name": "list"
                ,"title": "文章列表"
                ,"jump": "post/list"
            },{
                "name": "top"
                ,"title": "置顶的文章"
                ,"jump": "post/top"
            },{
                "name": "new_post"
                ,"title": "新增文章"
                ,"jump": "post/new_post"
            }]
        }, {
            "icon": "layui-icon-dialogue",
            "name": "feedback"
            , "title": "客服中心"
            , "list": [{
                "name": "list"
                , "title": "所有反馈"
                , "jump": "feedback/list"
            }, {
                "name": "undeal"
                , "title": "待处理"
                , "jump": "feedback/undeal"
            }, {
                "name": "deal"
                , "title": "已处理"
                , "jump": "feedback/deal"
            }]
        }
        , {
            "name": "task_shop"
            ,"title": "任务商城"
            ,"icon": "layui-icon-rate-half"
            ,"list": [{
                "name": "user_task"
                ,"title": "任务榜"
                ,"jump": "user/task/tasks"
            }, {
                "name": "user_invite"
                ,"title": "邀请用户"
                ,"jump": "user/task/invite"
            }]
        },{
            "name": "gsbshop"
            ,"title": "积分商城"
            ,"icon": "layui-icon-fonts-strong"
            ,"list": [{
                "name": "goods"
                , "title": "积分商品"
                , "jump": "gsbshop/goods"
            },{
                "name": "fapiao"
                ,"title": "发布商品"
                , "jump": "gsbshop/goods_new"
            },{
                "name": "mygsbobjs"
                ,"title": "我的发布"
                , "jump": "gsbshop/goods_myobjs"
            },{
                "name": "renzheng"
                ,"title": "我的购买"
                , "jump": "gsbshop/goods_buyed"
            }
            ]
        }, {
            "name": "vip"
            ,"title": "会员服务"
            ,"icon": "layui-icon-auz"
            ,"jump": "account/vip"
        }, {
            "name": "account"
            ,"title": "帐户管理"
            ,"icon": "layui-icon-user"
            ,"list": [{
                "name": "rmb"
                , "title": "余额管理"
                , "jump": "account/rmb"
            },{
                "name": "cashout_list"
                , "title": "提现管理"
                , "jump": "account/cashout_list"
            },{
                "name": "fapiao"
                ,"title": "发票管理"
                , "jump": "account/fapiao"
            },{
                "name": "renzheng"
                ,"title": "认证管理"
                , "jump": "account/renzheng"
            },{
                "name": "sys_msg"
                ,"title": "系统消息"
                , "jump": "account/sys_msg"
            },{
                "name": "my_orders"
                ,"title": "订单管理"
                , "jump": "account/orders"
            }
            ]
        }]
}

let superManagerMenu = {
    "name": "manager"
    ,"title": "审核管理"
    ,"icon": "layui-icon-user"
    ,"list": [{
        "name": "rmb"
        , "title": "RMB流水"
        , "jump": "manager/rmb_m"
    },{
        "name": "cashout_list"
        , "title": "提现管理"
        , "jump": "manager/cashout_list"
    },{
        "name": "rmb"
        , "title": "积分流水"
        , "jump": "manager/gsb_m"
    },{
        "name": "fapiao_m"
        ,"title": "发票审核"
        , "jump": "manager/fapiao_m"
    },{
        "name": "renzheng_m"
        ,"title": "认证审核"
        , "jump": "manager/renzheng_m"
    },{
        "name": "sys_msg_m"
        ,"title": "系统消息"
        , "jump": "manager/sys_msg_m"
    },{
        "name": "gsbshop_m_xxx"
        ,"title": "积分商品审核"
        , "jump": "manager/goods_userobjs_m"
    }
    ,{
        "name": "gsbshop_order_m"
        ,"title": "积分商城订单"
        , "jump": "manager/goods_buyed_m"
    },{
            "name": "srcshop_m_xxx"
            ,"title": "源码审核"
            , "jump": "manager/src_userobjs_m"
        }
        ,{
            "name": "srcshop_order_m"
            ,"title": "应用商城订单"
            , "jump": "manager/src_buyed_m"
        }
    ]
}
/**
 * 区别不同特权的用户，返回不同的菜单 。
 * @type {queryUserMenu}
 */
window.menu_c.queryUserMenu =queryUserMenu;
async function queryUserMenu(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);
    if(s_id instanceof Array) s_id = s_id[0]

    //校验session
    let str = await user_redis.get(ll_config.redis_key+":session:"+user_id+"-"+s_id)
    // if(!str) return res.json({ret:false,msg:"session error"})

    let isM = str && manager_c.isManagerUid(user_id)
    console.log("user_id:"+user_id+" s_id:"+s_id+" str:"+str+" isM:"+isM)

    if(isM)
    {
        let ret = {};
        Object.assign(ret, menuJSON);
        //深度拷贝data
        let data = [],i=0
        for(i=0;i<menuJSON.data.length;i++)
        {
            data.push(menuJSON.data[i])
        }

        //data字段还是一个可变字段的。
        data.push(superManagerMenu)
        ret.data = data;

        res.json(ret)
    }else{
        res.json(menuJSON)
    }
}