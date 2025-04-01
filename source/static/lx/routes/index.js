/**
 *
 */
// const bodyParser = require('body-parser');
// let urlParser = bodyParser.urlencoded({ extended: false });
// // const api_filter = require('../middleware/common_interceptor').api_filter
// const {console_filter,vip_filter,vip_filter_visit,vip_filter_send,vip_filter_invite,vip_filter_manager,GROUPCHAT_PM_INVITE,GROUPCHAT_PM_SEND,GROUPCHAT_PM_VISIT,GROUPCHAT_PM_MANAGER,MANAGER_VIP_LEVEL,NORMAL_VIP_LEVEL} = require('../middleware/common_interceptor')
// // const vip_filter_visit = require('../middleware/common_interceptor').vip_filter_visit
// // const vip_filter_send = require('../middleware/common_interceptor').vip_filter_send
// // const vip_filter_invite = require('../middleware/common_interceptor').vip_filter_invite
// // const vip_filter_send = require('../middleware/common_interceptor').vip_filter_manager
// const config = require('../config').config;
// const srcshop_c = require('../controller/srcshop_c');
// const gsbshop_c = require('../controller/gsbshop_c');
// const fapiao_c = require('../controller/fapiao_c');
// const manager_c = require('../controller/manager_c');
// const user_c = require('../controller/user_c');
// const cashout_c = require('../controller/cashout_c');
// const user_weixin_c = require('../controller/user_weixin_c');
// const address_c = require('../controller/address_c');
// const shopping_c = require('../controller/shopping_c');
// const customer_c = require('../controller/customer_c');
// const obj_c = require('../controller/obj_c');
// const shop_c = require('../controller/shop_c');
// const classify_c = require('../controller/classify_c');
// const post_c = require('../controller/post_c');
// const feedback_c = require('../controller/feedback_c');
// const product_c = require('../controller/product_c');
// const store_c = require('../controller/store_c');
// const order_c = require('../controller/order_c');
// const file_c = require('../controller/file_c');
// const qrcode_c = require('../controller/qrcode_c');
// const menu_c = require('../controller/menu_c');
// const weixin_pay_c = require('../weixin/weixin_pay_c');
// const pay_callback_c = require('../weixin/pay_callback_c');

// const groupchat_c = require('../controller/groupchat_c');
// const groupchat_live_c = require('../controller/groupchat_live_c');
// const console_c = require('../controller/console_c');

// var multer  = require('multer');
// app.use(multer({ dest:config.file_temp}).array('file'));
// var multer = function(){
//   let ret = {array:function(){}}
//   return ret
// }
// const urlParser = null
window.lx_routes = function(app) {
  // app.all('/', function(req, res) {
  //   res.send('Hello World!');
  // });
  if(app.setChatC) app.all('/image/upload',urlParser,file_c.upload_img);
  else app.all('/image/upload', multer({ dest:ll_config.file_temp}).array('file'),urlParser,file_c.upload_img);//图片上传
  app.all('/image/view',urlParser,file_c.download_img);//图片显示
  
  // app.all('/image/fengjing/imgs',urlParser,file_c.get_fengjing_imgs);//默认的风景图
  // app.all('/image/mc/logos',urlParser,file_c.get_mc_logos);//默认的萌宠图

  // // app.all('/qrcode/scan', multer({ dest:config.file_temp}).array('file'),urlParser,qrcode_c.qrcode_scan);//扫一扫（将二维码图片上传上来，然后解析得到字符串内容 ）
  // // app.all('/qrcode/draw',urlParser,qrcode_c.qrcode_draw);//由字符串内容data生成对应的二维码。

  // //文件的上传与下载。
  if(app.setChatC) app.all('/file/upload',urlParser,file_c.upload_file);
  else app.all('/file/upload', multer({ dest:ll_config.file_temp}).array('file'),urlParser,file_c.upload_file);
  app.all('/file/upload/fast',urlParser,file_c.upload_file_fast);
  app.all('/file/download',urlParser,file_c.download_file);
  app.all('/file/update',urlParser,file_c.update_file);

  app.all('/file/info',urlParser,session_filter,file_c.query_file_info); //查询文件信息
  app.all('/file/lock/set',urlParser,session_filter,file_c.add_file_lock);//添加文件锁（如果权限为空，则清理文件锁）
  app.all('/file/lock/get',urlParser,session_filter,file_c.query_file_lock);//查询文件锁aes256key--web3key
  
  //微信用户
  // app.all('/api/weixin/user/login',urlParser,api_filter, user_weixin_c.login);
  // app.all('/api/weixin/user/regist',urlParser,api_filter, user_weixin_c.regist);
  // app.all('/api/weixin/user/check',urlParser,api_filter, user_weixin_c.check);
  // app.all('/api/weixin/user/info',urlParser,api_filter, user_weixin_c.queryUserInfo);
  // app.all('/api/weixin/user/phone/bind',urlParser,api_filter, user_weixin_c.bindPhone);

  //人民币和积分流水帐。
  // app.all('/api/weixin/user/rmb/list',urlParser,api_filter, user_c.queryAccountRmbOrders);
  // app.all('/api/weixin/user/gsb/list',urlParser,api_filter, user_c.queryAccountGsbOrders);

  //签到相关
  app.all('/user/sign/check',urlParser, user_c.checkUserTodaySigned);
  app.all('/user/sign',urlParser, user_c.userSignToday);
  app.all('/user/sign/list',urlParser, user_c.queryAccountSignedOrders);

    //地址管理
  app.all('/user/address/add',urlParser, address_c.addAddress);
  app.all('/user/address/update',urlParser, address_c.updateAddressInfo);
  app.all('/user/address/del',urlParser, address_c.deleteAddressInfo);
  app.all('/user/address/info',urlParser, address_c.queryAddressInfo);
  app.all('/user/address/list',urlParser, address_c.queryAddressList);
  app.all('/user/address/up2list',urlParser, address_c.up2List);
  //购物相关
  app.all('/user/shopping/order/create',urlParser, shopping_c.createOrder);
  app.all('/user/shopping/order/pay',urlParser, shopping_c.payOrder);
  app.all('/user/shopping/order/del',urlParser, shopping_c.deleteOrderInfo);
  app.all('/user/shopping/order/recv',urlParser, shopping_c.recvOrder);
  app.all('/user/shopping/order/comment',urlParser, shopping_c.commentOrder);
  app.all('/user/shopping/order/info',urlParser, shopping_c.queryOrderInfo);
  app.all('/user/shopping/order/list',urlParser, shopping_c.queryOrderList);
  app.all('/user/shopping/product/comment/list',urlParser, shopping_c.queryCommentList);
  //商铺管理订单
  app.all('/shopping/order/del',urlParser, shopping_c.deleteOrderInfo);
  app.all('/shopping/order/refund',urlParser, shopping_c.refundOrder);//退款
  app.all('/shopping/order/info',urlParser, shopping_c.queryOrderInfo);
  app.all('/shopping/order/list',urlParser, shopping_c.queryShopOrderList);
  app.all('/shopping/order/kd/send',urlParser, shopping_c.sendKD);

  //客户管理
  app.all('/customer/list',urlParser, customer_c.queryCustomerList);
  app.all('/customer/vip/list',urlParser, customer_c.queryVipList);
  app.all('/customer/search',urlParser, customer_c.searchCustomerList);
  app.all('/customer/vip/price',urlParser, customer_c.queryVipPrice);
  app.all('/customer/vip/pay',urlParser, customer_c.buyShopVipOrder);

  //文章管理
  app.all('/post/list',urlParser, post_c.queryPostList);
  app.all('/post/top/list',urlParser, post_c.queryTopList);
  app.all('/post/top/del',urlParser, post_c.delTopPost);
  app.all('/post/search',urlParser, post_c.searchPostList);
  app.all('/post/new',urlParser, post_c.newPost);
  app.all('/post/del',urlParser, post_c.delPost);
  app.all('/post/info',urlParser, post_c.queryPostInfo);
  app.all('/post/list',urlParser, post_c.queryTopList);

  //客服中心（反馈管理）
  app.all('/feedback/list',urlParser, feedback_c.queryFeedbackList);
  app.all('/feedback/list/undeal',urlParser, feedback_c.queryUndealList);
  app.all('/feedback/list/deal',urlParser, feedback_c.queryDealList);
  app.all('/feedback/list/del',urlParser, feedback_c.delFeedback);
  app.all('/feedback/deal',urlParser, feedback_c.dealFeedback);
  app.all('/feedback/info',urlParser,feedback_c.queryInfo);
  app.all('/feedback/search',urlParser, feedback_c.searchFeedbackList);
  app.all('/feedback/new',urlParser, feedback_c.newFeedback);
  app.all('/feedback/info',urlParser,feedback_c.queryInfo);

  //管理员
  app.all('/manager/rmb/list', urlParser,manager_c.queryRmbOrders);
  app.all('/manager/gsb/list', urlParser,manager_c.queryGSBOrders);//GSB--系统的
  app.all('/user/gsb/list',urlParser, user_c.queryAccountGsbOrders);//GSB
  app.all('/manager/sysmsgs', urlParser,manager_c.querySysMsg);

  //认证
  app.all('/user/role/bind', urlParser,user_c.bind_role);
  app.all('/user/role/orders', urlParser,user_c.queryUserRoleOrders);
  app.all('/manager/role/orders', urlParser,manager_c.queryAllUserRoleOrders);
  app.all('/manager/role/ok', urlParser,manager_c.roleOk);
  app.all('/manager/role/deny', urlParser,manager_c.roleDeny);

  //发票
  app.all('/user/fapiao/new', urlParser,fapiao_c.applyFapiao);
  app.all('/user/fapiao/orders', urlParser,fapiao_c.queryUserFapiaoOrders);
  app.all('/manager/fapiao/orders', urlParser,fapiao_c.queryAllUserFapiaoOrders);
  app.all('/manager/fapiao/ok', urlParser,fapiao_c.applyOk);
  app.all('/manager/fapiao/deny', urlParser,fapiao_c.applyDeny);

  //用户相关接口
  app.all('/user/menu', urlParser,menu_c.queryUserMenu);
  app.all('/user/account/info', urlParser,user_c.queryAccountInfo);
  app.all('/user/account/rmb', urlParser,user_c.queryAccountRmb);
  app.all('/user/send_sms', urlParser,user_c.send_sms);
  app.all('/user/send_email', urlParser,user_c.send_email);
  app.all('/user/send_code', urlParser,user_c.send_bind_code);
  app.all('/user/email/bind', urlParser,user_c.bind_email);

  app.all('/user/regist_phone_user',urlParser, user_c.regist_phone_user);//注册帐号
  app.all('/user/invites',urlParser, user_c.queryAccountInviteUsers);
  app.all('/user/sysmsgs',urlParser, user_c.querySysMsg);
  app.all('/user/orders',urlParser, user_c.queryOrders);
  app.all('/user/login_user_pwd',urlParser, user_c.login_user_pwd);
  app.all('/user/login_user_sms', urlParser,user_c.login_user_sms);
  app.all('/user/modify_user_pwd_sms',urlParser, user_c.modify_user_pwd_sms);
  app.all('/user/info',urlParser, user_c.queryUserInfo);
  app.all('/user/info/query/phone',urlParser, user_c.queryUserInfoByPhone);//由手机号码查询对应的user_id，再查用户信息。
  app.all('/user/info/mod',urlParser, user_c.modifyUserInfo);  //修改user_name和logo
  app.all('/user/info/name/mod',urlParser, user_c.modifyUserInfoName); //修改user_name
  app.all('/user/info/logo/mod',urlParser, user_c.modifyUserInfoLogo); //修改logo

  app.all('/user/pubkeys/query',urlParser,user_c.queryUsersPublicKeys)
  app.all('/user/web3keys/set',urlParser,user_c.setUsersWeb3Keys)
  app.all('/user/web3key/query',urlParser,user_c.queryUserWeb3Key)
  app.all('/user/web3keys/sync',urlParser,console_filter,user_c.syncWeb3Keys)//仅管理员可以同步节点web3keys
  app.all('/user/file/sync',urlParser,console_filter,file_c.syncFile)//仅管理员可以同步节点的文件（直接根据hash下载文件）
  app.all('/user/web3/notice',urlParser,user_c.sendWeb3Notice) //通知做某事
  app.all('/user/web3/notice/list',urlParser,user_c.queryWeb3NoticeList) //获得通知列表（其中包含了通知和授权结果）
  app.all('/obj/web3key/set',urlParser,user_c.setObjWeb3Key)
  app.all('/obj/web3key/query',urlParser,user_c.queryObjWeb3Key)
  app.all('/user/device/bind',urlParser,user_c.bindDevice)
  app.all('/user/device/login',urlParser,user_c.loginDevice)
  app.all('/user/web3app/create',urlParser,user_c.createWeb3App)
  app.all('/user/web3app/pubkey/set',urlParser,user_c.setWeb3AppPublicKey)
  app.all('/user/web3app/info',urlParser,user_c.queryWeb3AppInfo)
  app.all('/user/dtns/network/config',urlParser,console_filter,user_c.setDTNSNetworkConfig)//设置network的解析配置信息
  app.all('/user/web3app/setting/set',urlParser,console_filter,user_c.setWe3appSetting)
  app.all('/user/web3app/setting/tax/default',urlParser,console_filter,user_c.createWeb3AppDefaultTaxSettingRpc)
  app.all('/user/web3app/setting/tax/query',urlParser,console_filter,user_c.createWeb3AppDefaultTaxSettingQueryRpc)
  app.all('/user/web3app/setting/tax/max',urlParser,console_filter,user_c.createWeb3AppDefaultTaxMaxSettingRpc)
  
  //提现相关---普通用户
  app.all('/user/cashout/new',urlParser, cashout_c.userCashOut);
  app.all('/user/cashout/info',urlParser, cashout_c.queryOrderInfo);
  app.all('/user/cashout/order/user/list',urlParser, cashout_c.queryUserOrderList);
  //控制台（管理员-客服）可以使用功能API。
  app.all('/user/cashout/order/list',urlParser,console_filter, cashout_c.queryOrderList);
  app.all('/user/cashout/order/deal',urlParser,console_filter, cashout_c.queryDealList);
  app.all('/user/cashout/order/list/undeal',urlParser,console_filter, cashout_c.queryUndealList);
  app.all('/user/cashout/deal',urlParser, console_filter,cashout_c.dealCashoutOrder);

  //移动端的提现---原来的微信端
  // app.all('/api/weixin/user/cashout/new',urlParser, api_filter,cashout_c.userCashOut);
  // app.all('/api/weixin/user/cashout/info',urlParser,api_filter, cashout_c.queryOrderInfo);
  // app.all('/api/weixin/user/cashout/order/list',urlParser,api_filter, cashout_c.queryUserOrderList);

  //vip相关
  app.all('/obj/vip/new',urlParser, obj_c.new_vip_obj);
  app.all('/obj/vip/objs/query',urlParser, obj_c.query_vip_objs);

  //商铺
  app.all('/shop/new',urlParser, shop_c.new_shop_buy_order);
  app.all('/shop/new/pay',urlParser, shop_c.pay_shop_buy_order);
  // app.all('/api/shop/list',urlParser, api_filter,shop_c.queryMyShops);
  app.all('/shop/list',urlParser, shop_c.queryMyShops);
  app.all('/shop/info',urlParser, shop_c.queryShopInfo);
  // app.all('/api/shop/info',urlParser, api_filter,shop_c.queryShopInfo);
  app.all('/shop/info/update',urlParser, shop_c.updateShopInfo);
  app.all('/shop/info/weixin/update',urlParser, shop_c.updateShopWeixinInfo);
  app.all('/shop/delete',urlParser, shop_c.deleteShop);
  app.all('/shop/getshoplist',urlParser,groupchat_c.getShopList);//获取所拥有的小店的列表

  //货架
  app.all('/classify/new',urlParser, classify_c.new_classify);
  app.all('/classify/list',urlParser, classify_c.query_classify_list);
  // app.all('/api/classify/list',urlParser,api_filter, classify_c.query_classify_list);
  app.all('/classify/update',urlParser, classify_c.update_classify);
  app.all('/classify/delete',urlParser, classify_c.delete_classify);
  app.all('/classify/info',urlParser, classify_c.query_classify_info);
  app.all('/classify/product/add',urlParser, classify_c.add_product);
  app.all('/classify/product/up',urlParser, classify_c.up_product);
  app.all('/classify/product/del',urlParser, classify_c.del_product);
  app.all('/classify/product/list',urlParser, classify_c.query_products);
  // app.all('/api/classify/product/list',urlParser,api_filter, classify_c.query_products);

  //产品
  app.all('/product/new',urlParser, product_c.newProduct);
  app.all('/product/list',urlParser, product_c.queryAllProducts);
  app.all('/product/update',urlParser, product_c.updateProductInfo);
  app.all('/product/delete',urlParser, product_c.deleteProduct);
  app.all('/product/info',urlParser, product_c.queryProductInfo);
  app.all('/api/product/info',urlParser,vip_filter, product_c.queryProductInfo);

  //产品仓库
  app.all('/store/new',urlParser, store_c.newStore);
  app.all('/store/list',urlParser, store_c.queryAllStores);
  app.all('/store/update',urlParser, store_c.updateStoreInfo);
  app.all('/store/delete',urlParser, store_c.deleteStore);
  app.all('/store/info',urlParser, store_c.queryStoreInfo);
  app.all('/store/product/add',urlParser, store_c.add_product);
  app.all('/store/product/up',urlParser, store_c.up_product);
  app.all('/store/product/del',urlParser, store_c.del_product);
  app.all('/store/product/list',urlParser, store_c.query_products);

  //云链主机
  app.all('/obj/node/new',urlParser, obj_c.new_node_obj);
  app.all('/obj/node/objs/query',urlParser, obj_c.query_node_objs);

  //应用商城/源码商城（GSB）
  app.all('/obj/srcshop/srclist',urlParser, srcshop_c.queryAllGSBSrc);
  app.all('/obj/srcshop/src/info',urlParser, srcshop_c.querySrcInfo);
  app.all('/obj/srcshop/user/new',urlParser, srcshop_c.newSrc);
  app.all('/obj/srcshop/user/update',urlParser, srcshop_c.updateSrcInfo);
  app.all('/obj/srcshop/user/buy',urlParser,srcshop_c.buySRC);
  app.all('/obj/srcshop/user/buyed',urlParser,srcshop_c.queryUserGSBSrcBuyedObjs);
  app.all('/obj/srcshop/user/objs',urlParser, srcshop_c.queryUserGSBSrcOrders);
  app.all('/obj/srcshop/manager/update',urlParser, srcshop_c.updateSrcInfo);
  app.all('/obj/srcshop/manager/deny',urlParser, srcshop_c.sendDeny);
  app.all('/obj/srcshop/manager/ok',urlParser, srcshop_c.sendOk);
  app.all('/obj/srcshop/manager/srclist',urlParser,srcshop_c.queryAllUserSRC);
  app.all('/obj/srcshop/manager/src/buyed',urlParser,srcshop_c.queryAllUserBuyedObjs);

  //积分商城（GSB）
  app.all('/obj/gsbshop/goods',urlParser, gsbshop_c.queryAllGSBGoods);
  app.all('/obj/gsbshop/goods/info',urlParser, gsbshop_c.queryGoodsInfo);
  app.all('/obj/gsbshop/user/new',urlParser, gsbshop_c.newGoods);
  app.all('/obj/gsbshop/user/update',urlParser, gsbshop_c.updateGoodsInfo);
  app.all('/obj/gsbshop/user/buy',urlParser,gsbshop_c.buyGoods);
  app.all('/obj/gsbshop/user/buyed',urlParser,gsbshop_c.queryUserGSBGoodsBuyedObjs);
  app.all('/obj/gsbshop/user/goods',urlParser, gsbshop_c.queryUserGSBGoodsOrders);
  app.all('/obj/gsbshop/manager/update',urlParser, gsbshop_c.updateGoodsInfo);
  app.all('/obj/gsbshop/manager/deny',urlParser, gsbshop_c.sendDeny);
  app.all('/obj/gsbshop/manager/ok',urlParser, gsbshop_c.sendOk);
  app.all('/obj/gsbshop/manager/goods',urlParser,gsbshop_c.queryAllUserGoods);
  app.all('/obj/gsbshop/manager/goods/buyed',urlParser,gsbshop_c.queryAllUserBuyedObjs);

  //订单基本操作
  app.all('/order/query',urlParser, order_c.query_order_info);

  //人民币充值
  app.all('/order/rmb/new',urlParser, order_c.new_rmb_recharge_order);
  app.all('/order/rmb/pay',urlParser, order_c.pay_rmb_recharge_order);
  app.all('/order/rmb/list',urlParser, user_c.queryAccountRmbOrders);
  app.all('/order/rmb/lists',urlParser,console_filter,user_c.queryRmbOrders);

  //vip支付
  app.all('/order/vip/new',urlParser, order_c.new_vip_buy_order);
  app.all('/order/vip/pay',urlParser, order_c.pay_vip_buy_order);

  //-----groupchat 群聊--------
  app.all('/contact/add',urlParser,groupchat_c.addContact); //添加联系人
  app.all('/contact/del',urlParser,groupchat_c.delContact); //删除联系人
  app.all('/contact/list',urlParser,groupchat_c.queryContactList);//联系人列表（用于拉群、连线TAB）
  app.all('/contact/userAndChatList',urlParser,groupchat_c.userAndChatList);//获取联系人列表和群列表
  app.all('/chat/single',urlParser,groupchat_c.singleChat);//新建【私聊】--会自动添加联系人
  app.all('/chat/mod/logo',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatLogo);//修改群头像
  app.all('/chat/mod/name',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatName);//修改群名称
  app.all('/chat/mod/backgroup',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatBackgroupImg);//修改群背景
  app.all('/chat/mod/share_pm',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatSharePM);//修改群分享权限
  app.all('/chat/mod/burntime',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatBurntime);//修改阅后即焚过期时间
  app.all('/chat/mod/banspeak',urlParser,vip_filter_manager,vip_filter,groupchat_c.banSpeaking);//对某成员进行禁言
  app.all('/chat/mod/allowspeak',urlParser,vip_filter_manager,vip_filter,groupchat_c.relieveSpeaking);//对某成员解除禁言
  app.all('/chat/mod/bindShop',urlParser,vip_filter_manager,vip_filter,groupchat_c.bindShop);//绑定小店
  app.all('/chat/mod/unBoundShop',urlParser,vip_filter_manager,vip_filter,groupchat_c.unBoundShop);//解绑小店
  app.all('/chat/mod/forkids',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatFORKIDS);
  app.all('/chat/mod/xmsgids',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatXmsgids);
  
  app.all('/user/vip/prices_and_rights',urlParser,order_c.query_vip_right_info);//获取vip的价格和权益信息
  //新增vip_type字段，分别为vip_level（访问权限）、send_vip_level（发消息权限）、invite_vip_level（邀请权限）--邀请人进群的权限
  app.all('/chat/mod/vip_level',urlParser,vip_filter_manager,vip_filter,groupchat_c.modChatVipLevel);//修改群等级
  app.all('/chat/group',urlParser,groupchat_c.groupChat);   //新建【群聊】--可拉联系人一起建群（2020-5-16新增group_live直播间类型）
  app.all('/chat/group/by/contact',urlParser,vip_filter_invite,vip_filter,groupchat_c.groupChatByContact);//将联系人添加到群聊（已创建好的群聊）
  app.all('/chat/join',urlParser,groupchat_c.joinChat);//加群  vip_filter_invite,vip_filter
  app.all('/chat/unjoin',urlParser,groupchat_c.unjoinChat);  //退出群聊
  app.all('/chat/list',urlParser,groupchat_c.getChatList);//获得所有的聊天室列表（群聊、单聊）
  //新增vip_type字段，分别为vip_level（访问权限）、send_vip_level（发消息权限）、invite_vip_level（邀请权限）--邀请人进群的权限
  app.all('/chat/info',urlParser,groupchat_c.getChatInfo);//得到群的基本信息（2020-5-16新增 直播间的播放地址）
  app.all('/chat/info/alive/cnt',urlParser,groupchat_c.queryChatMemAliveCntAndList);//得到群聊的在活跃的成员数量（特别是对直播间有用）
  app.all('/chat/live/stream/basic/info',urlParser,groupchat_c.info_chat_stream);//得到直播间的直播推流订阅信息（是否直播中，直播用户在线数量等）
  // app.all('/chat/live/stream/info',urlParser,groupchat_live_c.get_stream_info);//得到直播间的直播推流订阅信息
  // app.all('/chat/live/streams',urlParser,groupchat_live_c.streams);//得到直播间的直播推流订阅信息
  app.all('/chat/manager/list',urlParser,groupchat_c.getChatManagerList);//得到群的管理员列表
  app.all('/chat/manager/add',urlParser,groupchat_c.addChatManager);//为群聊增加管理员
  app.all('/chat/manager/del',urlParser,groupchat_c.delChatManager);//删除群聊管理员
  app.all('/chat/owner/change',urlParser,groupchat_c.changeChatOwner);//删除群聊管理员
  
  app.all('/chat/mem/list',urlParser,vip_filter,groupchat_c.getChatMemList);//member--获取群成员列表
  app.all('/chat/mem/del',urlParser,vip_filter_manager,vip_filter,groupchat_c.delChatMember);//member--删除群成员
  app.all('/chat/msg/recall',urlParser,vip_filter,groupchat_c.recallMsg);//撤回消息---会将相关信息变更为已撤回。
  app.all('/chat/msg/list',urlParser,vip_filter,groupchat_c.getChatMsgList);//获取消息列表
  app.all('/chat/msg/type/list',urlParser,vip_filter,groupchat_c.getChatTypeMsgList);//获取消息列表--按不同的类型（如text、file、img、video等）---消息内容的类型
  app.all('/chat/msg/info',urlParser,vip_filter,groupchat_c.getChatMsgInfo);//获取消息完整信息
  app.all('/chat/user/recent/msgs',urlParser,groupchat_c.getUserRecentMsgs);//消息列表（最新消息列表）
  app.all('/chat/user/recent/msg/readed/height',urlParser,groupchat_c.getUserRecentReadedHeight);//获得用户多设备的消息已读高度
  
  /**  //这里是crontab脚本，用于定期缓存这个cache起来--- redis有自己的备份机制，这里提供一个手动的数据备份机制，避免已读高度的数据丢失。
  #groupchat-----user-readed-height save2cached  and  load2redis
  0 1 * * * mv /data/node-project/groupchat/file_temp/readed_height_list.js /data/node-project/groupchat/file_temp/readed_height_list.js-`date +\%Y\%m\%d`-bak 
  1 1 * * * echo "window.routes=" > /data/node-project/groupchat/file_temp/readed_height_list.js
  2 1 * * * curl  'http://127.0.0.1:9000/chat/user/recent/msg/readed/height/keys/values'  >> /data/node-project/groupchat/file_temp/readed_height_list.js 
  #  curl  'http://127.0.0.1:9000/chat/user/recent/msg/readed/height/keys/values/load2redis'
  */
  //http://127.0.0.1:9000/chat/user/recent/msg/readed/height/keys/values  //运维用。定期备份
  app.all('/chat/user/recent/msg/readed/height/keys/values',urlParser,groupchat_c.getUserRecentReadedHeightListFromRedis);
  //http://127.0.0.1:9000/chat/user/recent/msg/readed/height/keys/values/load2redis  //运维用，redis迁移时
  app.all('/chat/user/recent/msg/readed/height/keys/values/load2redis',urlParser,groupchat_c.loadUserRecentReadedHeightListToRedis);
  //发下是发送消息。
  app.all('/chat/msg/send/text',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeText);//文本消息
  app.all('/chat/msg/send/link',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeLink);//链接（新闻等网页链接）
  app.all('/chat/msg/send/file',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeFile);//文件 
  app.all('/chat/msg/send/img',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeImg);//图片
  app.all('/chat/msg/send/record',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeRecord);//语音（即时录制的短语音60秒之内）
  app.all('/chat/msg/send/audio',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeAudio);//录音（长语音）
  app.all('/chat/msg/send/short_video',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeShortVideo);//短视频(如60s之内)
  app.all('/chat/msg/send/video',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeVideo);//视频（长视频）
  app.all('/chat/msg/send/location',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeLocation);//定位
  app.all('/chat/msg/send/namecard',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeNameCard);//名片
  app.all('/chat/msg/send/groupchat_card',urlParser,vip_filter_send,vip_filter,groupchat_c.sendGroupChatCard);//群名片
  app.all('/chat/msg/send/redpaper',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypeRedPaper);//红包
  app.all('/chat/msg/send/post',urlParser,vip_filter_send,vip_filter,groupchat_c.sendMsgTypePost);//帖子或者文章‘、新闻等。
  app.all('/dweb/xmsg/send',urlParser,session_filter,groupchat_c.sendXMsg) //发送头榜复合型消息（未进行aes256加密的判断--须进一步进行判断）
  app.all('/dweb/xmsg/buyed',urlParser,session_filter,groupchat_c.buyedXMsg) //判断是否已购
  app.all('/dweb/xmsg/cancel',urlParser,session_filter,groupchat_c.cancelXMsg)//撤消头榜（先判断用户登录状态，再判断其他的权限）
  if(window.g_dweb_list_not_need_session_flag) app.all('/dweb/xmsg/list',urlParser,groupchat_c.listXMsgs)//2024-12-27新增（无须session即可访问）
  else app.all('/dweb/xmsg/list',urlParser,session_filter,groupchat_c.listXMsgs)//列举头榜复合型消息（或点赞的用户列表-token_y-list）--亦可按群聊区分（须群访问权限）

  app.all('/dweb/xmsg/label/add',urlParser,session_filter,groupchat_c.addXMsgToLabel)//添加至标签（relf--我的收藏；xmsgl****标签ID（系统级）
  app.all('/ib3/node/user/count',urlParser,session_filter,groupchat_c.count_ib3_users)//统计ib3.node的用户数
  //websocket消息监听
  app.all('/chat/ws/listen',urlParser,vip_filter,groupchat_c.wsLisenReqKey);
  app.all('/chat/ws/user/listen',urlParser,groupchat_c.wsUserLisenReqKey);

  //连线-控制台相关接口。//-----------------------groupchat-console--------------------------------------------
  app.all('/chat/console/db/save',urlParser,console_filter,console_c.saveDB);//用户统计
  app.all('/chat/console/count/user/last30days',urlParser,console_filter,console_c.cout_user_last30days);//用户统计
  app.all('/chat/console/count/msg/last30days',urlParser,console_filter,console_c.cout_msg_last30days);//消息统计
  app.all('/chat/console/count/chat/last30days',urlParser,console_filter,console_c.cout_chat_last30days);//聊天室统计
  //用户、群聊等
  app.all('/chat/console/all/user',urlParser,console_filter,console_c.query_all_user);//所有用户
  app.all('/chat/console/user/ban',urlParser,console_filter,console_c.ban_user);//封禁用户
  app.all('/chat/console/user/unban',urlParser,console_filter,console_c.unban_user);//解封用户
  app.all('/chat/console/all/vipuser/relv',urlParser,console_filter,console_c.relate_all_vip_user);//将所有的vip用户关联到vip-list（方便查询）
  app.all('/chat/console/all/vipuser',urlParser,console_filter,console_c.query_all_vip_user);//所有的vip用户
  app.all('/chat/console/all/console_user',urlParser,console_c.query_all_console_user);//所有的客服用户
  app.all('/chat/console/console_user/add',urlParser,console_filter,console_c.add_console_user);//添加客服
  app.all('/chat/console/console_user/del',urlParser,console_filter,console_c.del_console_user);//删除客服
  app.all('/chat/console/all/chatroom',urlParser,console_filter,console_c.query_all_chatroom);//所有的聊天室（含单聊和群聊）
  app.all('/chat/console/chatroom/ban',urlParser,console_filter,console_c.ban_chat);//封禁群聊
  app.all('/chat/console/chatroom/unban',urlParser,console_filter,console_c.unban_chat);//解封社群
  app.all('/chat/console/all/msg',urlParser,console_filter,console_c.query_all_msg);//所有的消息（消息审核）
  app.all('/chat/console/msg/recall',urlParser,console_filter,groupchat_c.recallMsg);//撤回消息
  //群发消息
  app.all('/chat/console/msg/batch/new',urlParser,console_filter,console_c.new_batch_send_msg);//新建群发任务
  app.all('/chat/console/msg/batch/list',urlParser,console_filter,console_c.query_batch_msg_list);//历史群发任务
  app.all('/chat/console/msg/batch/info',urlParser,console_filter,console_c.query_batch_info);//新建群发任务
  //默认头像相关
  app.all('/chat/console/logos/system/list',urlParser,console_filter,console_c.query_system_default_logos);//群默认头像
  app.all('/chat/console/logos/system/add',urlParser,console_filter,console_c.add_system_logo);//添加群默认头像
  app.all('/chat/console/logos/system/del',urlParser,console_filter,console_c.del_system_logo);//删除群默认头像
  app.all('/chat/console/logos/user/list',urlParser,console_filter,console_c.query_user_default_logos);//用户默认头像
  app.all('/chat/console/logos/user/add',urlParser,console_filter,console_c.add_user_logo);//添加用户默认头像
  app.all('/chat/console/logos/user/del',urlParser,console_filter,console_c.del_user_logo);//删除用户默认头像
  //设置相关（邀请码和vip）
  app.all('/chat/console/invite/setting/query',urlParser,user_c.query_invite_setting);//邀请码设置查询
  app.all('/chat/console/invite/setting/set',urlParser,console_filter,console_c.set_invite_setting);//配置邀请码设置
  app.all('/chat/console/vip/setting/query',urlParser,console_filter,order_c.query_vip_right_info);//vip设置查询
  app.all('/chat/console/vip/setting/set',urlParser,console_filter,console_c.set_vip_setting);//配置vip设置
  //关于软件
  app.all('/chat/console/app/about/query',urlParser,console_c.query_about_app_info);//关于软件
  app.all('/chat/console/app/about/set',urlParser,console_filter,console_c.set_about_app_info);//配置关于软件
  //群聊的全局配置
  app.all('/chat/console/groupchat/setting/query',urlParser,groupchat_c.query_groupchat_setting);//全局的群聊的配置
  app.all('/chat/console/groupchat/setting/set',urlParser,console_filter,console_c.set_groupchat_setting);//配置全局的群聊配置
  
  if(typeof loadPlugins == 'function')
  {
    loadPlugins(app)
  }
  
  // //云链主机gnode、node、ilc、imc、icc购买
  // app.all('/order/node/new',urlParser, order_c.new_node_buy_order);
  // app.all('/order/node/pay',urlParser, order_c.pay_node_buy_order);
  // app.all('/order/node/objs/query',urlParser, order_c.query_user_node_objs);
  // app.all('/order/gnode/objs',urlParser, order_c.query_gnode_objs);
  // app.all('/order/gnode/statements',urlParser, order_c.query_gnode_statements);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   

  //云链主机
  // app.all('/order/node/objs',urlParser, order_c.query_node_objs);
  //
  // //云链主机续费
  // app.all('/order/node/renew',urlParser, order_c.new_node_renew_order);
  // app.all('/order/node/renew_pay', urlParser,order_c.pay_node_renew_order);

  //--------------------------------------------------------------
  //微信支付
  // app.all('/wx/create_h5_order',urlParser, weixin_pay_c.create_h5_order);
  // app.all('/wx/query_order_state',urlParser, weixin_pay_c.query_order_state_by_cloud_pay);//weixin_pay_c.query_order_state
  // //处理所有的回调信息。
  // app.all('/wx/pay_callback', pay_callback_c.weixin_pay_callback);




  // app.all('/user/send_email', user_c.send_email);
  //旧的接口（废止）
  // app.all('/query_clt_users', clt_user_c.query_clt_users);
  // app.all('/query_clt_users_val', clt_user_c.query_users_val);
  // app.all('/query_clt_users_statements', clt_user_c.query_users_statements);

  //新的接口（接口url不一样，但是功能与旧的一样）
  // app.all('/user', clt_user_c.query_clt_users);
  // app.all('/user/vals', clt_user_c.query_users_val);
  // app.all('/user/statements', clt_user_c.query_users_statements);


};

// window.routes.groupchat_c = groupchat_c