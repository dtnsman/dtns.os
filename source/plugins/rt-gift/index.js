window.rtgift_c = {}
// const rtgift_c_token_name = OBJ_TOKEN_NAME
// const rtgift_c_api_base   = OBJ_API_BASE
// const rtgift_c_token_root = OBJ_TOKEN_ROOT

// const rtgiftMatchMap = new Map()
// const rtgiftObj = {matchList: [],last_room_list:[]}
// const rtgift_channel_system_user_id = 'rtgift-system-default-user'
// const rtgift_channel_name = 'rtgift-channel'
// const rtgift_channel_notify_matched = 'room_matched'
// const rtgift_channel_notify_moved = 'room_moved'

rtgift_c.routers =async function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    // app.all('/rtgift/match',urlParser,session_filter,rtgift_c.match)
    // app.all('/rtgift/create',urlParser,session_filter,rtgift_c.create)
    // app.all('/rtgift/info',urlParser,session_filter,rtgift_c.info)
    // app.all('/rtgift/rooms',urlParser,session_filter,rtgift_c.rooms)
    // // app.all('/rtgift/please',urlParser,session_filter,rtgift_c.please)
    // // app.all('/rtgift/view',urlParser,session_filter,rtgift_c.view)
    // app.all('/rtgift/send',urlParser,session_filter,rtgift_c.send)
}

class RTGift
{
    constructor(gifts = null,prices = null,setting = {})
    {
        this.gifts = gifts
        this.prices= prices
        if(!this.gifts || this.gifts.lenth<=0 || !this.prices || this.prices.lenth<=0) this.gifts = this.prices = []
        if(!setting ||!setting.token_name)
        {
            this.token_name = MARK_TOKEN_NAME
            this.api_base   = MARK_API_BASE
            this.token_root = MARK_TOKEN_ROOT
        }else{
            this.token_name = setting.token_name
            this.api_base   = setting.api_base
            this.token_root = setting.token_root
        }
    }
    //发送gift
    async sendGift(gift,send_user_id,recv_user_id,extra_data='')
    {
        let pos = this.gifts.indexOf(gift)
        if( pos <0) return {ret:false,msg:'gift unexist'}
        let price=this.prices[pos]
        let token_type = window.g_rtmarket_mark_default
        let sendAccount= await rtmarket_c.createUserMarkAccount(send_user_id,token_type)
        let recvAccount= await rtmarket_c.createUserMarkAccount(recv_user_id,token_type)
        if(!sendAccount|| !sendAccount.ret) return {ret:false,msg:'send-user-account unexist'}
        if(!recvAccount|| !recvAccount.ret) return {ret:false,msg:'resv-user-account unexist'}
        //要进行分账处理
        let sendRet = await rpc_query(this.api_base+"/send",{token_x:sendAccount.mark_account_id,token_y:recvAccount.mark_account_id,opval:price, extra_data:'rtgift:'+extra_data})
        console.log('sendGift-sendRet:',sendRet)
        if(!sendRet || !sendRet.ret) return {ret: false, msg: "send gift-number failed"}
        return {ret:true,msg:'success',price,sendRet}
    }
    //安全发送gift
    async sendGiftBySafe(gift,send_user_id,recv_user_id,extra_data='')
    {
        let pos = this.gifts.indexOf(gift)
        if( pos <0) return {ret:false,msg:'gift unexist'}
        let price=this.prices[pos]
        let token_type = window.g_rtmarket_mark_default
        let account_id = rtmarket_c.get_mark_default_root_token(token_type)
        let sendAccount= await rtmarket_c.createUserMarkAccount(send_user_id,token_type)
        let recvAccount= await rtmarket_c.createUserMarkAccount(recv_user_id,token_type)
        if(!sendAccount|| !sendAccount.ret) return {ret:false,msg:'send-user-account unexist'}
        if(!recvAccount|| !recvAccount.ret) return {ret:false,msg:'resv-user-account unexist'}
        //先转到公账
        let sendRet = await rpc_query(this.api_base+"/send",{token_x:sendAccount.mark_account_id,token_y:account_id,opval:price, extra_data:'rtgift:'+extra_data})
        console.log('sendGiftBySafe-sendRet-1:',sendRet)
        if(!sendRet || !sendRet.ret) return {ret: false, msg: "send gift-number failed"}
        //公账再转一次（相当于混淆来源）
        sendRet = await rpc_query(this.api_base+"/send",{token_x:account_id,token_y:recvAccount.mark_account_id,opval:price, extra_data:'rtgift:'+extra_data})
        console.log('sendGiftBySafe-sendRet-2:',sendRet)
        if(!sendRet || !sendRet.ret) return {ret: false, msg: "recv gift-number failed"}
        return {ret:true,msg:'success',price,sendRet}
    }
}

window.RTGift = RTGift

