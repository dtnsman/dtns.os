
/**
 * form-engine表单引擎的插件代码
 */
window.formengine_c = {}
const formengine_c_token_name = OBJ_TOKEN_NAME
const formengine_c_api_base   = OBJ_API_BASE
const formengine_c_token_root = OBJ_TOKEN_ROOT
const formengine_list_id = OBJ_TOKEN_NAME+'_000000formengine'

formengine_c.routers =function(app)
{
    if(!app) return 
    // if(!app.setChatC) return 
    // const urlParser = null
    app.all('/formengine/template',urlParser,session_filter,formengine_c.form_template)
    app.all('/formengine/data/save',urlParser,session_filter,formengine_c.form_save_data)
    app.all('/formengine/data/all',urlParser,session_filter,formengine_c.form_all_datas)

    //初始化表单ID----在加载插件时
    init_list_id()
}

async function init_list_id()
{
    while(typeof g_loginDtnsAndForklist_started == 'undefined' || !g_loginDtnsAndForklist_started)
    {
        await str_filter.sleep(100)
    }
    let ret = await rpc_api_util.s_query_token_id(OBJ_API_BASE,OBJ_TOKEN_ROOT,formengine_list_id)
    console.log('init_list_id-ret:',ret)
    return ret
}

/**
 * 查询表单模板（返回静态的表单模板数据）
 */
formengine_c.form_template = form_template
async function form_template(req,res)
{
    let {name} = str_filter.get_req_data(req)
    switch(name){
        case 'hesu0': return res.json({ret:true,msg:'success',template:formTemplateHesuJson0})
    }
    res.json({ret:false,msg:'template is not exists!'})
}

/**
 * 保存表单数据
 */
formengine_c.form_save_data = form_save_data
async function form_save_data(req,res)
{
    let {template_name,data} = str_filter.get_req_data(req)
    //if(!template_name) return res.json({ret:false,msg:'param(template_name) is empty'})
    try{
        let tmpData = JSON.parse(data)
        console.log('form_save_data-data:',data,tmpData)
    }catch(ex){
        console.log('form_save_data-parse-data-exception:'+ex,ex)
        return res.json({ret:false,msg:'param(data) is not json-data'}) 
    }

    // let forkRet =await rpc_api_util.s_for
    let saveRet = await rpc_api_util.s_save_token_info(OBJ_API_BASE,OBJ_TOKEN_ROOT,formengine_list_id,'assert',data,template_name)
    if(saveRet) return res.json({ret:true,msg:'success'})
    return res.json({ret:false,msg:'save data failed'})
}

//查询所有的表单数据
formengine_c.form_all_datas = form_all_datas
async function form_all_datas(req,res)
{
    //template_name
    let {template_name,begin,len} = str_filter.get_req_data(req)
    //if(!template_name) return res.json({ret:false,msg:'param(template_name) is empty'})
    begin = parseInt(begin)
    len = parseInt(len)
    if(begin+len <=0) return res.json({ret:false,msg:'begin or len is error',begin,len})
    let rets = await rpc_query(OBJ_API_BASE+'/chain/opcode',{token:formengine_list_id,opcode:'assert',begin,len})
    res.json(rets)
}


const formTemplateHesuJson0 = {
	"list": [
		{
			"type": "image",
			"label": "图片",
			"options": {
				"hidden": false,
				"showLabel": false,
				"defaultValue": "obj_imgopen6H4t9mE5M"
			},
			"key": "image_1693280696604",
			"model": "image_1693280696604"
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "1、日本核素排海的危害？"
			},
			"key": "text_1693280722745",
			"model": "text_1693280722745"
		},
		{
			"type": "checkbox",
			"label": "多选框",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": [],
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "毒害鱼类"
					},
					{
						"value": "2",
						"label": "毒害海洋环境"
					},
					{
						"value": "3",
						"label": "污染海沙"
					},
					{
						"value": "4",
						"label": "影响海洋捕鱼"
					},
					{
						"value": "5",
						"label": "影响海洋生态"
					},
					{
						"value": "6",
						"label": "危害人类健康"
					},
					{
						"value": "7",
						"label": "危害鸟类健康"
					},
					{
						"value": "8",
						"label": "危害水循环生态"
					}
				]
			},
			"model": "checkbox_1693280751263",
			"key": "checkbox_1693280751263",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "2、日本核素排海地点？"
			},
			"key": "text_1693280891904",
			"model": "text_1693280891904"
		},
		{
			"type": "radio",
			"label": "单选框",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": "",
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "日本海"
					},
					{
						"value": "2",
						"label": "东京"
					},
					{
						"value": "3",
						"label": "北极"
					},
					{
						"value": "4",
						"label": "南极"
					},
					{
						"value": "5",
						"label": "渤海"
					},
					{
						"value": "6",
						"label": "黑海"
					}
				]
			},
			"model": "radio_1693280913029",
			"key": "radio_1693280913029",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "3、日本核素排海是否合乎法律公约？"
			},
			"key": "text_1693280948887",
			"model": "text_1693280948887"
		},
		{
			"type": "radio",
			"label": "单选框",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": "",
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "是"
					},
					{
						"value": "0",
						"label": "否"
					}
				]
			},
			"model": "radio_1693280980727",
			"key": "radio_1693280980727",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "3、日本核素排海最大危害哪个国家？"
			},
			"key": "text_1693280998504",
			"model": "text_1693280998504"
		},
		{
			"type": "radio",
			"label": "单选框",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": "",
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "日本"
					},
					{
						"value": "2",
						"label": "中国"
					},
					{
						"value": "3",
						"label": "美国"
					},
					{
						"value": "4",
						"label": "韩国"
					},
					{
						"value": "5",
						"label": "越南"
					},
					{
						"value": "6",
						"label": "新加坡"
					},
					{
						"value": "7",
						"label": "澳大利亚"
					},
					{
						"value": "8",
						"label": "英国"
					},
					{
						"value": "9",
						"label": "其他"
					}
				]
			},
			"model": "radio_1693281045648",
			"key": "radio_1693281045648",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "4、日本核素是干净卫生的吗？"
			},
			"key": "text_1693281127070",
			"model": "text_1693281127070"
		},
		{
			"type": "radio",
			"label": "单选框",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": "",
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "干净卫生"
					},
					{
						"value": "2",
						"label": "剧毒有害"
					},
					{
						"value": "3",
						"label": "环境友好"
					}
				]
			},
			"model": "radio_1693281152005",
			"key": "radio_1693281152005",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "5、日本核素排海的危害级别是？"
			},
			"key": "text_1693281275925",
			"model": "text_1693281275925"
		},
		{
			"type": "radio",
			"label": "单选框",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": "",
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "无害"
					},
					{
						"value": "2",
						"label": "有害"
					},
					{
						"value": "3",
						"label": "剧毒"
					},
					{
						"value": "4",
						"label": "反人类罪"
					},
					{
						"value": "5",
						"label": "战争罪"
					},
					{
						"value": "6",
						"label": "非法入侵罪"
					}
				]
			},
			"model": "radio_1693281311916",
			"key": "radio_1693281311916",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		},
		{
			"type": "text",
			"label": "文字",
			"options": {
				"textAlign": "left",
				"hidden": false,
				"showLabel": false,
				"showRequiredMark": false,
				"color": "rgba(0, 0, 0, 0.9)",
				"fontFamily": "",
				"fontSize": "10.5pt",
				"defaultValue": "6、如果日本核素继续排海，我们有权做什么?"
			},
			"key": "text_1693281194911",
			"model": "text_1693281194911"
		},
		{
			"type": "radio",
			"label": "单选框",
			"icon": "icon-danxuan-cuxiantiao",
			"options": {
				"disabled": false,
				"showLabel": false,
				"hidden": false,
				"defaultValue": "",
				"dynamicKey": "",
				"dynamic": false,
				"options": [
					{
						"value": "1",
						"label": "法律制裁"
					},
					{
						"value": "2",
						"label": "武力干涉"
					},
					{
						"value": "3",
						"label": "极力劝阻"
					},
					{
						"value": "4",
						"label": "听之任之"
					}
				]
			},
			"model": "radio_1693281192237",
			"key": "radio_1693281192237",
			"help": "",
			"rules": [
				{
					"required": false,
					"message": "必填项"
				}
			]
		}
	],
	"config": {
		"layout": "horizontal",
		"labelCol": {
			"xs": 4,
			"sm": 4,
			"md": 4,
			"lg": 4,
			"xl": 4,
			"xxl": 4
		},
		"labelWidth": 100,
		"labelLayout": "flex",
		"wrapperCol": {
			"xs": 18,
			"sm": 18,
			"md": 18,
			"lg": 18,
			"xl": 18,
			"xxl": 18
		},
		"hideRequiredMark": false,
		"customStyle": ""
	},
    "form_template_name":"hesu0"
}