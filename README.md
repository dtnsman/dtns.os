# 【智体OS】dtns.os-v3.0版本正式发布

智体OS是分布式智体操作系统，主要由javascript编写，可以跨平台使用。支持多用户访问一个智体节点，可以局域网到局域网（e2ee）登录并使用。主要功能为poplang智体编程语言、dtns协议、dtns.ibchat智体聊等。

## dtns.os-v3.0版本更新内容：

1、支持直接显示markdown格式内容：生成的AI图片可以直接对话过程中预览了
。
2、支持内置的多个大模型支持：qwen/qwen2.5-vl-32b-instruct:free、deepseek/deepseek-chat-v3-0324:free、deepseek/deepseek-r1:free、google/gemini-2.0-flash-exp:free、google/gemini-2.5-pro-exp-03-25:free、deepseek-chat、deepseek-reasoner、deepseek-r1:1.5b、llama3.2-vision

3、支持分享智体聊会话时显示预览图，方便在头榜等查看分享的内容预览

4、支持附件上传（多模态大模型：qwen/qwen2.5-vl-32b-instruct:free等中进行图片识别）

5、支持网页预览：使用预览或网页指令，在智体IB的AI对话页面直接预览html代码块内容（例如生成的网站、h5游戏、ppt、h5动画内容，可方便地网页预览）

6、支持对话agent：使用智体IB聊天中的【系统角色】定义，可以方便地创建和分享智体对话agent。

7、支持agent-tools：使用【系统角色】定义的对话agent，当包含了poplang.agent代码块时，识别为智体agent，并执行相应的poplang代码调用agent-tools。只要输入【运行】即可运行LLM大模型返回的poplang代码块，调用例如地图查询、邮件发送、云文件夹操作等的agent-tools功能。

## dtns.plugin新增插件：
1、rtmailer ：封装了邮箱发送的agent-tools

2、rtmap ：封装了高德导航的地图（mcp-server代码）

## 更新的代码：
1、app或pc：dtns.connector

2、智体节点：dtns.os（原dtns.forklist.network）

## 使用说明：
1、下载dtns.os-v3.0.zip

2、打开start.cmd

3、可进入dtns.os/setting/c.json配置roomid来实现开发者节点启用（这样app才可以使用）

## 下载地址：详见官网

## github仓库：详见官网

## gitee仓库：详见官网

##QQ群：279931001

## 官网：https://www.dtns.top
 [dtns.top官网](https://www.dtns.top "更多文档详见dtns.top官网")。

# 文档：https://dtns.top
 [官方文档](https://dtns.top "更多文档详见dtns.top官网")。


## 发布时间：2025-4-1