/**
 * Created by Evan on 2017/9/8.
 * 为基础数据类型添加方法
 */


//format("yyyy-MM-dd hh:mm:ss.SSS");
Date.prototype.format = function(fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        // "S"  : this.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    if (/(S+)/.test(fmt)) { //毫秒三位
        var Milliseconds = this.getMilliseconds();
        fmt = fmt.replace(RegExp.$1, ("000" + Milliseconds).substr(("" + Milliseconds).length));

    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}
