安装app
https://github.com/majido/clipper/releases/download/v1.2.1/clipper.apk
 
启动
# adb shell am startservice ca.zgrs.clipper/.ClipboardService
 
复制字符串命令
# adb shell am broadcast -a clipper.set -e text “12345678”
 
获取内容
#adb shell am broadcast -a clipper.get

网文：
android adb复制粘贴工具(九十)
网址：
https://blog.csdn.net/u010164190/article/details/107112569
用途：
写入粘贴板，粘贴到任意的输入框（长按输入框可显示“粘贴”选项）。