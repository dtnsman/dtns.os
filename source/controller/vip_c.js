/**
 * Created by lauo.li on 2019/3/26.
 */
const str_filter = require('../libs/str_filter');
const notice_util = require('../libs/notice_util');
const config = require('../config').config;
const user_redis = require('../config').user_redis;
const user_m = require('../model/user_m');

const rpc_query = require('../rpc_api_config').rpc_query
const {USER_API_BASE} = require('../rpc_api_config')
const USER_TOKEN_NAME = require('../rpc_api_config').USER_TOKEN_NAME
const USER_TOKEN_ROOT = require('../rpc_api_config').USER_TOKEN_ROOT

/**
 * 保存vip配置信息。
 * @type {set_vip_setting}
 */
module.exports.set_vip_setting =set_vip_setting;
async function set_vip_setting(req, res) {
    //query_vip_objs

    //保存到root-assert表中。
}

/**
 * 得到vip配置信息（总）
 * @type {query_vip_setting}
 */
module.exports.query_vip_setting =query_vip_setting;
async function query_vip_setting(req, res) {

}

/**
 * 得到用户的vip配置信息（如果没有，创建一个vip0的商品订单--并且直接完成 ）
 * @type {query_user_vipinfo}
 */
module.exports.query_user_vipinfo =query_user_vipinfo;
async function query_user_vipinfo(req, res) {
    let {user_id,s_id,random,sign} = str_filter.get_req_data(req);
    //判断random与sign是否ok

    //判断session

    //防重放攻击

    //查询vip_userid是否存在，不存在则创建，并且声明为vip0

    //查询vip具体的订单情况与到期日期（如果是vip0则永久有效）

    //查询vip特权信息（直接查询对应的vip-obj，得到相应的即时特权；并且返回当时的旧特权信息--历史特权信息）

    //返回vip特权情况
}

/**
 * 保存一条vip使用纪录（用于查询是否已经使用过该特权）----使用send操作，保存到opval等相关纪录中。
 * @type {save_user_vip_used_record}
 */
module.exports.save_user_vip_used_record =save_user_vip_used_record;
async function save_user_vip_used_record(req, res) {

    let {user_id,s_id,order_id,order_name,order_extra_data, random,sign} = str_filter.get_req_data(req);

    //判断random与sign是否ok

    //判断session

    //防重放攻击

    //记录订单消费

    //刷新assert特权余额（GNODE数量等）。

    //返回结果。

}


