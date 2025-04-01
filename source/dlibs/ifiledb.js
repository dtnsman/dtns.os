const file_util = require("../libs/file_util");
const config = require('../config').config;
class IFileIndexDB{
    constructor(dbname='ifiledb',storeName = 'ifilecache')
    {
        this.dbname = dbname
        this.db = null;
        this.version = 1
        this.storeName = storeName
        this.lastTimeMap = new Map()
        this.cached = new Map()
        this.loopCheck()
    }
    async openDB() {
    }

    closeDB() {
    }

    deleteDB(name) {
    }

    async addData( data ) {
        if(!data || !data.key) return null
        if(data && !data.data)
            return null

        let origin_path = config.file_temp+data.key
        let flag = await file_util.writeFile(origin_path,Buffer.from(data.data)) 

        return flag
        // this.cached.set(data.key,data)
    }

    async loopCheck()
    {
        while(true)
        {
            await new Promise((res)=>setTimeout(res,10000))
            let This = this
            this.lastTimeMap.forEach((value, key, map) => {
                if(value + 60*1000 <= Date.now())//超过60s未访问
                {
                    This.cached.delete(key)
                    This.lastTimeMap.delete(key)
                    console.log('clear-file-cached:',key,value,Date.now())
                }
            })
        }
    }

    async getDataByKey(key) {
        if(!key) return null

        if(this.cached.has(key))
        {
            let data =  this.cached.get(key)
            this.lastTimeMap.set(key,Date.now())//更新时间
            return {key:key,data:data}
        }

        let data = await file_util.readFile(config.file_temp+key)
        if(!data) return null

        this.cached.set(key,data)
        this.lastTimeMap.set(key,Date.now())

        return {key:key,data:data}
    }

    async updateData(value) {
        // var transaction = this.db.transaction(this.storeName, 'readwrite');
        // var store = transaction.objectStore(this.storeName);
        // store.put(value)
        let origin_path = config.file_temp+data.key
        let flag = await file_util.writeFile(origin_path,Buffer.from(fileInfo.path)) 
        return flag
    }

    deleteDataByKey(key) {
        file_util.unlink(config.file_temp+key)
        // var transaction = this.db.transaction(this.storeName, 'readwrite');
        // var store = transaction.objectStore(this.storeName);
        // store.delete(key)
        // this.cached.delete(key)
    }

    clearObjectStore() {
    }
    clear(){
    }

    deleteObjectStore() {
    }

    fetchStoreByCursor() {
    }
    async getAllDatas() {
    }
}
async function test()
{
    var db = new ImageIndexDB()
    let instance = await db.openDB()
    console.log('opendb:',instance)
    // db.addData({key:'img0',data:'base000001'})
    // db.addData({key:'img1',data:'base000002'})
    // db.addData({key:'img2',data:'base000003'})
    // db.addData({key:'img3',data:'base000004'})
    let data = await db.getDataByKey('img3')
    console.log('data:'+JSON.stringify(data))
    let list = await db.getAllDatas()
    console.log('list:',list)
    //db.closeDB()
}

// test()

window.IFileIndexDB = IFileIndexDB
