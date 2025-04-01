/**
 * 实现localStorage的封装（主要是用于userInfo-localStorage.getItem的管理）
 * on 2023-5-5
 * author poplang
 */

class LocalStorage{
    constructor(){
        this.cached = new Map()
    }
    setItem(key,val){
        this.cached.set(key,val)
    }
    getItem(key){
        return this.cached.get(key)
    }
}

window.LocalStorage = LocalStorage
window.localStorage = new LocalStorage()