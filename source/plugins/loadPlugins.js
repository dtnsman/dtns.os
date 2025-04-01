/**
 * 用于统一导入全局的插件（支持node.js和browser 2种环境）
 */

window.loadPluginsObj = function(pluginsObj,app)
{
    if(!pluginsObj) return false
    //当是RPCHost多实例的时候，依然要加载一次
    if(window[ pluginsObj.index ] ){
        if(typeof window[pluginsObj.index].routers =='function')
        {
            console.log('direct load routers:',window[pluginsObj.index].routers,app,pluginsObj)
            window[pluginsObj.index].routers(app)
        }
        return console.log('loadPluginsObj already exists plugin:',pluginsObj , window[ pluginsObj.index ] )
    }
    if(typeof Buffer!= 'undefined'){//node.js环境
        //node.js直接导入
        require(pluginsObj.url_nodejs)
        if(pluginsObj.index && window[pluginsObj.index] && typeof window[pluginsObj.index].routers=='function')
        {
            window[pluginsObj.index].routers(app)
        }
    }else{
        //创建script-element元素导入
        // (function() {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.onload = function(){
                console.log('loaded-pluginsObj:',pluginsObj,typeof window[pluginsObj.index])
                if(pluginsObj.index && window[pluginsObj.index] && typeof window[pluginsObj.index].routers=='function')
                {
                    window[pluginsObj.index].routers(app)
                }
            }
            script.src = pluginsObj.url
            document.body.appendChild(script);
        // })()
    }
}

/**
 * 导入全局的plugins
 */
window.loadPlugins = function(app)
{
    const is_browser_runtime_flag = window && window.document !=null
    if(window.plugins && window.plugins.length>0)
    {
        for(let i=0;i<plugins.length;i++)
        {
            console.log('load-plugins-i:'+i,plugins[i])
            //如果不是浏览器插件，又是浏览器环境下，跳过处理
            if(!plugins[i] || !plugins[i].browser && is_browser_runtime_flag ){
                console.log('not browser plugin:',plugins[i],is_browser_runtime_flag)
                continue
            }
            //如果不是node.js插件，又是node.js环境下，跳过处理
            if(!plugins[i].nodejs && !is_browser_runtime_flag ){
                console.log('not nodejs plugin:',plugins[i],is_browser_runtime_flag)
                continue
            }
            try{
                loadPluginsObj(plugins[i],app)
            }catch(ex){
                console.log('loadPluginsObj-exception:'+ex,ex,plugins[i],app)
				process.exit(1)
            }
        }
    }
}

