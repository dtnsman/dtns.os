###智体IB-帮助说明

#新会话
开启新的ibchat智体聊会话，会自动保存刚才的session会话

#会话
查看当前会话的历史对话纪录（以JSON格式返回）

#结束
结束当前正进行中的思考（正在思考的过程会被中止）

#保存
保存当前会话（在智体节点上保存当前会话纪录）

#分享
【分享】当前会话至头榜，如有图片包含在内——![IMG](图片链接)，会自动包含该图片

#模型
弹窗设置当前使用的模型，例如：qwen/qwen2.5-vl-32b-instruct:free、deepseek/deepseek-chat-v3-0324:free、deepseek/deepseek-r1:free、google/gemini-2.0-flash-exp:free、google/gemini-2.5-pro-exp-03-25:free、deepseek-chat、deepseek-reasoner、deepseek-r1:1.5b、llama3.2-vision

#附件
上传附件（目前仅限图片）

#预览 | 网页
支持多种格式的代码块预览（目前仅限html————会自动识别最后一个回复中的html代码块，并跳转显示该预览）

预览：支持手机app使用预览功能，但是可能部分javascript兼容性存在问题。

网页：支持pc端使用网页预览功能（PC端的javascrpt兼容性更好），手机app存在100%打不开网页的BUG（需使用预览指令来实现手机预览）

#\#系统角色# 
使用#系统角色#作为新对话的开始，可以创建一个系统角色的agent，用于设定agent的系统功能。

#运行 | 执行
两条指令效果一样：均是执行第一条prompt中的\```poplang.ai.agent或\```poplang.agent中的代码块代码（使用poplang.runtime来执行）

#智体管家 | 管家
进入智体管家对话，可轻松访问所有的智能体agent。

#退出
如果是使用智体管家进入的智体agent，输入退出指令可返回智体管家。如输入“新会话”指令，则关闭智体管家和当前的会话agent。

#如需更多帮助信息请登录：dtns.top官网
网址：https://dtns.top
 [dtns.top官网](https://dtns.top "更多文档详见dtns.top官网")。
