/**
 * Created by lauo.li on 2020/5/16.
 */
const str_filter = require('../libs/str_filter');
const notice_util = require('../libs/notice_util');
const user_redis = require('../config').user_redis;
const config = require('../config').config;
const {vip_filter,vip_filter_visit,vip_filter_send,vip_filter_invite,vip_filter_manager,GROUPCHAT_PM_INVITE,GROUPCHAT_PM_SEND,GROUPCHAT_PM_VISIT,GROUPCHAT_PM_MANAGER,MANAGER_VIP_LEVEL,NORMAL_VIP_LEVEL} = require('../middleware/common_interceptor')
const rpc_query = require('../rpc_api_config').rpc_query
const {RPC_API_BASE,USER_API_BASE,USER_TOKEN_ROOT,USER_TOKEN_NAME,
    ORDER_API_BASE,ORDER_TOKEN_ROOT,ORDER_TOKEN_NAME,
    GSB_API_BASE,GSB_TOKEN_NAME,GSB_TOKEN_ROOT,
    PCASH_API_BASE,PCASH_TOKEN_NAME,PCASH_TOKEN_ROOT,
    RMB_API_BASE,RMB_TOKEN_NAME,RMB_TOKEN_ROOT,
    SCORE_API_BASE,SCORE_TOKEN_NAME,SCORE_TOKEN_ROOT,
    OBJ_API_BASE,OBJ_TOKEN_ROOT,OBJ_TOKEN_NAME,
    MSG_API_BASE,MSG_TOKEN_NAME,MSG_TOKEN_ROOT,
    VIP_API_BASE,VIP_TOKEN_ROOT,VIP_TOKEN_NAME } = require('../rpc_api_config')

const rpc_api_util = require('../rpc_api_util')
//  index.js 
const NodeMediaServer = require('node-media-server');
const groupchat_c = require('./groupchat_c')
 
const nms_config = {
  rtmp: {
    port: config.live_rtmp_port,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: config.live_http_port,
    allow_origin: '*',
    mediaroot: './media',
  }
  ,
  auth: {
    api: config.live_api_auth_flag,
    api_user: config.live_api_user,
    api_pass: config.live_api_pass,
    play: config.live_play_auth_flag,
    publish: config.live_publish_auth_flag,
    secret: config.live_auth_secret,
  },
  trans: {
    ffmpeg: config.live_ffmpeg_bin,
    tasks: [
      {
        app: 'live',
        vc: "copy",
        vcParam: [],
        ac: "aac",
        acParam: ['-ab', '64k', '-ac', '1', '-ar', '44100'],
        rtmp:true,
        rtmpApp:'live2',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      },
      {
        app: 'live',
        mp4: true,
        mp4Flags: '[movflags=faststart]',
      }
    ]
  }
};
 
var nms = new NodeMediaServer(nms_config)
nms.run();


function rejectSession(id)
{
    let session = nms.getSession(id);
    session.reject();
    console.log('session.reject() id:'+id)
}

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});
 
nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});
 
nms.on('doneConnect',async function (id, args) {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);

  let chatid = await user_redis.get(config.redis_key+'live_session:'+id);
  user_redis.del(config.redis_key+'live_session:'+id);
  user_redis.del(config.redis_key+'live_chat:'+chatid);

  if(!chatid) return ;

  let chatInfo  = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
  if(!chatInfo) return ;
  let user_id = chatInfo.create_user_id;

  let userInfo  = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
  let user_name = userInfo ? userInfo.user_name:''
  groupchat_c.sendChatInfoModifyMsg(user_id,user_name+'结束了直播',chatid,'live_status',true,chatInfo)

});
nms.on('prePublish', async function(id, StreamPath, args) {
    console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

    if(StreamPath.indexOf('/live/')==0)
    {
        if(!args )
        {
            console.log('args error')
            return rejectSession(id)
        }

        let {user_id,s_id} = args
        let s_str = await user_redis.get(config.redis_key + ":session:" + user_id + "-" + s_id)
        if (!s_str){
            console.log('session error')
            return rejectSession(id)
        }

        let chatid = StreamPath.split('/')[2]
        if(!chatid) {
            console.log('chatid error')
            return rejectSession(id)
        }

        let chatInfo  = await rpc_api_util.s_query_token_info(MSG_API_BASE,chatid,'assert')
        if(!chatInfo)
        {
            console.log('chatid is empty')
            return rejectSession(id)
        }

        if(chatInfo.chat_type != 'group_live')
        {
            console.log('chat_type is not group_live') //不是直播
            return rejectSession(id)
        }

        if(user_id!= chatInfo.create_user_id)
        {
            console.log('user_id is not creator of live-chat') //不是直播的发起人
            return rejectSession(id)
        }
        console.log('live-chat pusher is ok')

        let userInfo  = await rpc_api_util.s_query_token_info(USER_API_BASE,user_id,'assert')
        let user_name = userInfo ? userInfo.user_name:''
        groupchat_c.sendChatInfoModifyMsg(user_id,user_name+'开始了直播',chatid,'live_status',true,chatInfo)

        user_redis.set(config.redis_key+'live_session:'+id,chatid);
        user_redis.set(config.redis_key+'live_chat:'+chatid,id);
    }
});
 
nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

});
 
nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
});
 
nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});
 
nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});
 
nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});


async function query_api(url_path,param)
{
  let retObj = null;
  await new Promise((resolve,reject)=>{
    const request = require('request')
   
    let url = 'http://'+config.host+':'+config.live_http_port+url_path
    request.get(url, {
        'auth': {
            'user': config.live_api_user,
            'pass': config.live_api_pass,
            'sendImmediately': false
        },
        'form':param,
    }, function (err, httpResponse, data) {
      console.log('query_api-data:'+data+" error:"+err)
        if (err) {
            console.log(err);
            reject(err);
        } else {
          console.log(`data:${data}`)
          try{
            retObj = JSON.parse(data);
            resolve(data)
          }catch(ex)
          {
            reject(ex);
          }
        }

        resolve(data)
      }
    );
  }).then(function(data){
  }).catch(function(ex){});

  console.log('query_api-retObj:'+JSON.stringify(retObj))

  return retObj;
}
/**
 * 得到streams
 * http://127.0.0.1:9000/chat/live/stream/info?chatid=msg_chat02L265DNE4qs
 */
module.exports.get_stream_info =get_stream_info;
async function get_stream_info(req, res) {
  let {chatid} = str_filter.get_req_data(req);
  if(!chatid) return res.json({ret:false,msg:'chatid error'})
  // let auth = `${config.live_api_user}:${config.live_api_pass}`
  // const buf = Buffer.from(auth, 'ascii');
  // console.log('auth-buf:'+buf.toString('base64'));

  let ret = await query_api('/api/streams',{})
  console.log('ret:json-:'+JSON.stringify(ret))
  if(!ret || !ret.live[chatid])
  {
    return res.json({ret:false,msg:'stream is empty'})
  }
  ret = ret.live[chatid]
  ret.ret = true
  ret.msg = 'success';
  //if(ret.live[chatid])
  res.json(ret)
}

/**
 * 得到所有的streams
 */
module.exports.streams =streams;
async function streams(req, res) {
  // let {key} = str_filter.get_req_data(req);
  // if(!key || key!='live123') return res.json({ret:false,msg:'key error'})

  // let {user_id,s_id} = str_filter.get_req_data(req)

  // let str = await user_redis.get(config.redis_key+":session:"+user_id+"-"+s_id)
  // if(!str) return res.json({ret:false,msg:"session error"})


  let ret = await query_api('/api/streams',{})
  console.log('ret:json-:'+JSON.stringify(ret))
  if(!ret || !ret.live)
  {
    return res.json({ret:false,msg:'streams is empty'})
  }

  ret.ret = true
  ret.msg = 'success';
  //if(ret.live[chatid])
  res.json(ret)
}
