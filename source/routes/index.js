/**
 *
 */
const bodyParser = require('body-parser');
let urlParser = bodyParser.urlencoded({ extended: false });
window.urlParser = urlParser
const {common_interceptor,rps_filter, ip_log} = require('../middleware/common_interceptor')
// const config = require('../config').config;

// const user_c = require('../controller/user_c');
// const file_c = require('../controller/file_c');
// const nftlist = require('../controller/nftlist');
// const order_c = require('../controller/fork_order_c');
// const alipay = require('../alipay/alipay');
// const cashout_c = require('../controller/cashout_c');

// const manager_c = require('../controller/manager_c');



var multer  = require('multer');
window.multer = multer
// app.use(multer({ dest:config.file_temp}).array('file'));

module.exports = function(app) {
  app.all('/', function(req, res) {
    res.send('Hello World!');
  });

  // if(app.setChatC) app.all('/image/upload',urlParser,file_c.upload_img);
  // else app.all('/image/upload', multer({ dest:config.file_temp}).array('file'),urlParser,file_c.upload_img);
  // app.all('/image/view',urlParser,file_c.download_img);
  // app.all('/image/view/min',urlParser,file_c.download_img_min);

  // //文件的上传与下载。
  // if(app.setChatC) app.all('/file/upload',urlParser,file_c.upload_file)
  // else app.all('/file/upload', multer({ dest:config.file_temp}).array('file'),urlParser,file_c.upload_file);
  // app.all('/file/download',urlParser,file_c.download_file);
  // app.all('/rps/file/download',urlParser,file_c.download_rpsfile);
  // if(app.setChatC) app.all('/file/gpupload',urlParser,file_c.upload_file_p)
  // else app.all('/file/gpupload', multer({ dest:config.file_temp}).array('file'),urlParser,file_c.upload_file_p);
  // app.all('/file/gpdownload',urlParser,file_c.download_file_p);

  //user
  // app.all('/user/login_user_pwd',urlParser, user_c.login_user_pwd);//登录
  // app.all('/user/regist_phone_user',urlParser, user_c.regist_phone_user);//注册
  // app.all('/user/send_sms', urlParser,user_c.send_sms);//发送手机验证码
  // app.all('/user/account/info', urlParser,user_c.queryAccountInfo);//查询账户信息
  // app.all('/user/account/rmb', urlParser,user_c.queryAccountRmb);//查询用户的账户余额
  // app.all('/user/queryAllUser', urlParser,user_c.queryAllUser); //查询所有用户
  // app.all('/user/modifyUserInfoLogo',urlParser, user_c.modifyUserInfoLogo); //修改logo
  // app.all('/user/modifyUserInfoBg',urlParser, user_c.modifyUserInfoBg); //修改bg
  // app.all('/user/info',urlParser, user_c.queryUserInfo);//查询用户信息。
  // app.all('/user/modify_info',urlParser, user_c.modifyUserInfo);//修改用户名
  // app.all('/user/modifyUserDesc',urlParser, user_c.modifyUserDesc);//修改用户简介
  // app.all('/user/modify_user_pwd_sms',urlParser, user_c.modify_user_pwd_sms);//修改密码
  // app.all('/order/rmb/list',urlParser, user_c.queryAccountRmbOrders);//查询用户rmb账单流水

  // const console_filter = function(req,res,next){
  //   next()
  // }
  // window.console_filter = console_filter
  // app.all('/user/pubkeys/query',urlParser,user_c.queryUsersPublicKeys)
  // app.all('/user/web3keys/set',urlParser,user_c.setUsersWeb3Keys)
  // app.all('/user/web3key/query',urlParser,user_c.queryUserWeb3Key)
  // app.all('/user/web3keys/sync',urlParser,console_filter,user_c.syncWeb3Keys)//仅管理员可以同步节点web3keys
  // app.all('/user/file/sync',urlParser,console_filter,file_c.syncFile)//仅管理员可以同步节点的文件（直接根据hash下载文件）
  // app.all('/user/web3/notice',urlParser,user_c.sendWeb3Notice) //通知做某事
  // app.all('/user/web3/notice/list',urlParser,user_c.queryWeb3NoticeList) //获得通知列表（其中包含了通知和授权结果）
  // app.all('/obj/web3key/set',urlParser,user_c.setObjWeb3Key)
  // app.all('/obj/web3key/query',urlParser,user_c.queryObjWeb3Key)
  // app.all('/user/device/bind',urlParser,user_c.bindDevice)
  // app.all('/user/device/login',urlParser,user_c.loginDevice)
  // app.all('/user/web3app/create',urlParser,user_c.createWeb3App)
  // app.all('/user/web3app/pubkey/set',urlParser,user_c.setWeb3AppPublicKey)
  // app.all('/user/web3app/info',urlParser,user_c.queryWeb3AppInfo)
  
  //管理员
  // app.all('/order/rmb/lists',urlParser, manager_c.queryRmbOrders);//查询全部用户rmb账单流水




  //提现相关
  // app.all('/user/cashout/new',urlParser, cashout_c.userCashOut);
  // app.all('/user/cashout/info',urlParser, cashout_c.queryOrderInfo);
  // app.all('/user/cashout/order/user/list',urlParser, cashout_c.queryUserOrderList);
  // //管理员可查看以下。
  // app.all('/user/cashout/order/list',urlParser, cashout_c.queryOrderList);
  // app.all('/user/cashout/order/deal',urlParser, cashout_c.queryDealList);
  // app.all('/user/cashout/order/list/undeal',urlParser, cashout_c.queryUndealList);
  // app.all('/user/cashout/deal',urlParser, cashout_c.dealCashoutOrder);
  // //提现方式
  // app.all('/user/cashout/modifyBankinfo',urlParser, cashout_c.modifyBankinfo);//添加修改提现方式
  // app.all('/user/cashout/queryBankinfo',urlParser, cashout_c.queryBankinfo);//查询提现方式信息
  // app.all('/user/cashout/newUserCashOut',urlParser, cashout_c.newUserCashOut);


  //fork
  app.all('/obj/fork/newNft', urlParser,forklist_c.newNft);//铸造作品
  app.all('/obj/fork/queryNftInfo', urlParser,forklist_c.queryNftInfo);//查询nft作品的信息
  app.all('/obj/fork/updateNftInfo', urlParser,forklist_c.updateNftInfo);//修改作品信息
  app.all('/obj/fork/queryUserNFTWorks', urlParser,forklist_c.queryUserNFTWorks);//查询用户铸造nft
  app.all('/obj/fork/queryAllUserNFTWorks', urlParser,console_filter,forklist_c.queryAllUserNFTWorks);//管理员查询全部用户nft列表
  app.all('/obj/fork/sendOk', urlParser,console_filter,forklist_c.sendOk);//审核通过
  app.all('/obj/fork/sendDeny', urlParser,console_filter,forklist_c.sendDeny);//审核拒绝
  app.all('/obj/fork/queryAllNFT', urlParser,console_filter,forklist_c.queryAllNFT);//查询通过审核的nft作品
  app.all('/obj/fork/buyNft', urlParser,forklist_c.buyNft);//购买nft作品
  app.all('/obj/fork/queryUserNFTBuyedObjs', urlParser,forklist_c.queryUserNFTBuyedObjs);//查询用户的购买订单纪录（重要）
  app.all('/obj/fork/queryNFTHistoryDeals', urlParser,forklist_c.queryNFTHistoryDeals);//查询nft作品历史交易记录

  app.all('/obj/fork/collectNFT', urlParser,forklist_c.collectNFT);//收藏作品
  app.all('/obj/fork/cancelCollectNFT', urlParser,forklist_c.cancelCollectNFT);//取消收藏作品
  app.all('/obj/fork/isCollectNFT', urlParser,forklist_c.isCollectNFT);//是否收藏作品
  app.all('/obj/fork/queryCollectNFT', urlParser,forklist_c.queryCollectNFT);//查询用户收藏的NFT作品


  //福刻FORK
  app.all('/obj/fork/freeFork', urlParser,forklist_c.freeFork);//免费福刻FORK
  app.all('/obj/fork/releaseNFTFork', urlParser,forklist_c.releaseNFTFork);//发布福刻（待审核）
  app.all('/obj/fork/queryUserNFTForks', urlParser,forklist_c.queryUserNFTForks);//用户审核免费福刻列表
  app.all('/obj/fork/sendOkFork', urlParser,forklist_c.sendOkFork);//审核通过福刻Fork的发布
  app.all('/obj/fork/sendDenyFork', urlParser,console_filter,forklist_c.sendDenyFork);//审核拒绝福刻Fork的发布
  app.all('/obj/fork/queryAllUserNFTForks', urlParser,console_filter,forklist_c.queryAllUserNFTForks);//管理员查询全部用户fork nft列表


  //album
  app.all('/obj/album/newAlbum', urlParser,forklist_c.newAlbum);//制作专辑
  app.all('/obj/album/queryAlbumInfo', urlParser,forklist_c.queryAlbumInfo);//查询专辑的信息
  app.all('/obj/album/updateAlbumInfo', urlParser,forklist_c.updateAlbumInfo);//修改作品信息
  app.all('/obj/album/queryUserAlbums', urlParser,forklist_c.queryUserAlbums);//查询用户的专辑
  app.all('/obj/album/queryAllUserAlbums', urlParser,console_filter,forklist_c.queryAllUserAlbums);//管理员查询全部用户的专辑
  app.all('/obj/album/releaseAlbum', urlParser,forklist_c.releaseAlbum);//发布专辑（待审核）
  app.all('/obj/album/includedInAlbum', urlParser,forklist_c.includedInAlbum);//作品收录进专辑
  app.all('/obj/album/removeInAlbum', urlParser,forklist_c.removeInAlbum);//专辑移除作品
  app.all('/obj/album/sendOkAlbum', urlParser,console_filter,forklist_c.sendOkAlbum);//审核通过专辑的发布
  app.all('/obj/album/sendDenyAlbum', urlParser,console_filter,forklist_c.sendDenyAlbum);//审核拒绝专辑的发布
  app.all('/obj/album/queryAllAlbum', urlParser,forklist_c.queryAllAlbum);//查询通过审核的专辑
  app.all('/obj/album/queryNFTWorksInAlbum', urlParser,forklist_c.queryNFTWorksInAlbum);//查询收录在专辑里的作品

  app.all('/obj/album/queryAllAlbumH5', urlParser,forklist_c.queryAllAlbumH5);//查询通过审核的专辑h5

  //订单
  app.all('/fork/order/createOrder', urlParser,fork_order_c.createOrder);//提交订单
  app.all('/fork/order/queryOrderInfo', urlParser,fork_order_c.queryOrderInfo);//查询订单信息
  app.all('/fork/order/queryOrderList', urlParser,fork_order_c.queryOrderList);//查询订单列表
  app.all('/fork/order/queryAllOrderList', urlParser,fork_order_c.queryAllOrderList);//查询全部订单列表
  app.all('/fork/order/cancelOrderInfo', urlParser,fork_order_c.cancelOrderInfo);//取消订单
  app.all('/fork/order/deleteOrderInfo', urlParser,fork_order_c.deleteOrderInfo);//删除订单

  app.all('/fork/order/payOrderByAccount', urlParser,fork_order_c.payOrderByAccount);//支付订单。（余额支付）
  

  
  //forklist_pay_c
  app.all('/forklist/pay/channel', urlParser,forklist_pay_c.pay_channel);
  app.all('/forklist/pay', urlParser,forklist_pay_c.pay);//返回支付链接
  app.all('/forklist/refund', urlParser,forklist_pay_c.refund);//返回退款链接
  app.all('/forklist/notify', urlParser,forklist_pay_c.notify);//当支付完成后，支付宝主动向我们的服务器发送回调的地址
  app.all('/forklist/returnSuccess', urlParser,forklist_pay_c.returnSuccess);//当支付完成后，当前页面跳转的地址

  //h5
  app.all('/forklist/h5_pay', urlParser,forklist_pay_c.h5_pay);//返回支付链接
  app.all('/forklist/h5_notify', urlParser,forklist_pay_c.h5_notify);//当支付完成后，支付宝主动向我们的服务器发送回调的地址




  app.all('/test', urlParser,forklist_c.test);




  


  // app.all('/user/send_email', urlParser,user_c.send_email);
  // app.all('/user/send_code', urlParser,user_c.send_bind_code);
  // app.all('/user/email/bind', urlParser,user_c.bind_email);
  // app.all('/user/login_user_sms', urlParser, ip_log, user_c.login_user_sms);//2020-8-20
  // app.all('/user/modify_user_pwd_sms',urlParser, user_c.modify_user_pwd_sms);



};
