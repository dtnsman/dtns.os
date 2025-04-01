
// const r = require('./r')
// const fs = require('fs');

const KV_TB_CREATE_SQL = 'create table if not exists system_kv(`key` TEXT primary key NOT NULL,`val` TEXT NOT NULL,`time` INTEGER ,`expire` INTEGER)'
const KV_TB_PUT_SQL = 'insert or replace into system_kv values(?,?,?,?)'
const KV_TB_GET_SQL = 'select * from system_kv where `key`=?'
const KV_TB_DEL_SQL = 'delete from system_kv where `key`=?'
const KV_TB_COUNT_SQL = 'select count(1) as cnt from system_kv'
const KV_TB_NAME = 'system_kv'

class SQLDB {
    constructor()
    {
        this.db = null;
        this.kv_stm = null;
        this.kv_map = null;
        this.kv_level = null;
    }

    async initDB(options,sqls,kv_opt=null)
    {
        if(this.db) {
            console.error('[error]init SQLDB twice')
            return false;
        } 
        this.options = options;
        this.sqls = sqls
        this.db = null;
        this.kv_opt = kv_opt
        let This = this;
        await new Promise((resolve,reject)=>{
            
            if(options&& options.dbtype == 'sqlite3')
            {
                const sqlite3 = require('sqlite3').verbose();
                this.db = new sqlite3.Database(options.filepath,function(err){
                    if(err){
                        console.log('new sqlite3 database failed, error:'+err)
                        reject(err)
                    }else{
                        resolve(true)
                    }
                });
            }
            else if(options && options.dbtype == 'sqlite3-better')
            {
                const Database = require('better-sqlite3');
                this.db = new Database(options.filepath, { verbose: console.log });
                resolve(true)
            }
            else{
                // const initSqlJs = require('sql.js');
                initSqlJs().then(function(SQL){
                    let buffer = null;
                    if(options && options.type =='file')
                    {
                        buffer = fs.readFileSync(options.filepath) 
                    }else if(options && options.type =='buffer'){
                        buffer = options.buffer;
                    }
                    This.db = buffer ?  new SQL.Database(buffer):new SQL.Database()
                    resolve(true)
                })
            }
        }).then((data)=>{}).catch((c)=>{console.log('initDB-ex:'+c)})
        let affectedRows = 0;
        if(sqls){
            affectedRows = await this.executeUpdate(sqls)
        }

        if(kv_opt && kv_opt.type=='sql')
        {
            affectedRows += await this.executeUpdate(KV_TB_CREATE_SQL)   
        }else if(kv_opt &&kv_opt.type=='map'){
            this.kv_map = new Map()
        }else if(kv_opt &&kv_opt.type=='level'){
            const {Level} = require('level')
            this.kv_level = new Level(kv_opt.path, { valueEncoding: kv_opt.vtype})
        }else if(kv_opt &&kv_opt.type=='redis')
        {
            //do nothing  //不使用redis作为缓存
        }
        //无论如何，都创建system_kv表（用于保存持久化数据）
        affectedRows += await this.executeUpdate(KV_TB_CREATE_SQL)   
        return affectedRows; 
    }
    export()
    {
        if(this.options.dbtype!='sqlite3') return this.db.export();//二进制，使用Buffer.from(binaryArray);可以写入到文件中。
        else return null;
    }
    saveDB2File(filepath)
    {
        if(this.options.dbtype=='sqlite3')
        {
            //do nothing(sqlite3 use filesystem)
        }else{
            filepath = filepath ? filepath:this.options.filepath
            const binaryArray = this.db.export();
            // console.log('binary:'+binaryArray.length)
            const buffer = Buffer.from(binaryArray);
            fs.writeFileSync(filepath, buffer);
        }
    }
    async kv2db()
    {
        if(!this.kv_opt) return -2;
        switch(this.kv_opt.type)
        {
            case 'map': return this.map2DB()
            case 'level':return await this.level2DB()
            case 'sql':return -1;
            default:return -1
        }
    }
    async db2kv()
    {
        if(!this.kv_opt) return -2;
        switch(this.kv_opt.type)
        {
            case 'map': return this.db2Map()
            case 'level':return await this.db2Level()
            case 'sql':return -1;
            default:return -1
        }
    }

    async query (sql, params){
        //console.log('query-sql:'+sql+' params:'+JSON.stringify(params))
        let res = null,This= this;
        if(this.options.dbtype == 'sqlite3')
        {
            await new Promise((resolve,reject)=>{
                This.db.all(sql,params,function(err,rows){
                    if(err){
                        console.log('sqlite3-all.err:'+err+' rows:'+rows)
                        res = null
                    } 
                    else res = rows
                    resolve(res)
                })
            }).then((d)=>{}).catch((ex)=>{})
        }else if(this.options.dbtype == 'sqlite3-better')
        {
            try{
            const results = params ? this.db.prepare(sql).all(...params) :this.db.prepare(sql).all( )
            return results
            }catch(ex){
                console.log('sqlite3-better-exception-ex:'+ex,ex)
                return null
            }
        }
        else{
            try{
                res =  this.db.exec(sql,params)
                res = res.length>=1 ? this.toMysqlResults(res[0]) :null
            }catch(ex){
                console.log('query-exception:'+ex)
                res = null;
            }
        }
        //console.log('end query()')
        return res;
    }
    async queryOne(sql,params)
    {
        let rows =  await this.query(sql,params) 
        return rows && rows.length>=1 ? rows[0]:null
    }
    async queryNum (sql,params)
    {
        let res = null,This= this;
        if(this.options.dbtype == 'sqlite3')
        {
            await new Promise((resolve,reject)=>{
                This.db.run(sql,params?params:[],function(err){
                   // console.log('err:'+JSON.stringify(err)+' err:'+err+this.changes)//拿到改变的行数。
                    if(!err)
                    {
                        res = this.changes;
                        resolve(res)
                    }else{
                        res = 0
                        reject(err)
                    }
                })
            }).then((d)=>{}).catch((ex)=>{})
            return res;
        }
        else if(this.options.dbtype == 'sqlite3-better')
        {
            const stmt = this.db.prepare(sql);
            const info = params?  stmt.run(...params) : stmt.run() ;
            return  info ? info.changes :0
        }
        else{
            try{
                let rows = this.db.exec(sql,params)
                //console.log('queryNum-rows:'+JSON.stringify(rows))
                return this.db.getRowsModified();
            }catch(ex){
                return 0;
            }
        }
    }

    async executeUpdate(sql,params)
    {
        return await this.queryNum(sql,params)
    }

    prepare(sql,params)
    {
        return this.db.prepare(sql,params)
    }

    getDBInstance()
    {
        return this.db
    }

    /**
     * 一个KV数据库（可以是内存型的）
     * @param {} key 
     * @param {*} val 
     * @param {*} expire 
     */
    async sqlPut(key,val,expire = -1)
    {
        let time = parseInt(new Date().getTime()/1000)
        return await this.executeUpdate(KV_TB_PUT_SQL,[key,val,time,expire])
    }
    async sqlDel(key)
    {
        return await this.executeUpdate(KV_TB_DEL_SQL,[key])
    }
    async sqlGet(key)
    {
        let ret = await this.queryOne(KV_TB_GET_SQL,[key]) 
        let time = parseInt(new Date().getTime()/1000)
        if(ret &&  ret.expire>=0 && (ret.time+ret.expire) < time){
            this.sqlDel(key)
            return null
        }
        else return ret;
    }
    async sqlSize()
    {
        let cntRet = await this.queryOne(KV_TB_COUNT_SQL);
        return cntRet?cntRet.cnt :0;
    }

    mapPut(key,val,expire = -1)
    {
        let time = parseInt(new Date().getTime()/1000)
        this.kv_map.set(key,{val,time,expire})
        return true;
    }
    mapDel(key)
    {
        return this.kv_map.delete(key)
    }
    mapGet(key)
    {
        let ret = this.kv_map.get(key)
        let time = parseInt(new Date().getTime()/1000)
        if(ret &&  ret.expire>=0 && (ret.time+ret.expire) < time){
            this.kv_map.delete(key)
            return null
        }
        else return ret;
    }
    mapSize(){
        return this.kv_map.size
    }

    map2DB(){
        let keys = this.kv_map.keys()
        let cnt = 0;
        let key = null;
        let stm = this.db.prepare(KV_TB_PUT_SQL)
        let now = parseInt(new Date().getTime()/1000)
        do{
            key = keys.next().value
            let vals = this.kv_map.get(key);
            if(!vals) continue
            if(vals.expire>=0 && (vals.time+vals.expire) < now)
            {
                this.kv_map.delete(key)
                continue
            }
            let {val,expire,time} = vals
            cnt ++
            // if(this.options.dbtype == 'sqlite3') stm.run(key,val,time,expire)
            // else stm.run([key,val,time,expire])
            stm.run([key,val,time,expire])
        }while(key)
        if(this.options.dbtype!='sqlite3') stm.free();
        return cnt;
    }
    db2Map()
    {
        let cnt = 0,This = this, now = parseInt(new Date().getTime()/1000)
        this.db.each('select * from system_kv',{},function(row){
            //console.log('db-row:'+JSON.stringify(row))
            if(row.expire>=0 && (row.time+row.expire) <now)
            {
                This.sqlDel(row.key)
                return 
            }
            This.kv_map.set(row.key,{val:row.val,time:row.time,expire:row.expire})
            cnt ++ 
        })
        return cnt;
    }

    async levelPut(key,val,expire = -1)
    {
        let time = parseInt(new Date().getTime()/1000)
        try{
            await this.kv_level.put(key,JSON.stringify({val,time,expire}))
        }catch(ex){
            console.log('levelPut-exception:'+ex)
            return false;
        }
        return true;
    }
    async levelDel(key)
    {
        try{ await this.kv_level.del(key)}catch(ex){return false}
        return true;
    }
    async levelGet(key)
    {
        let ret = await this.kv_level.get(key)
        //console.log('level-ret:'+JSON.stringify(ret))
        if(!ret) return null;
        ret = JSON.parse(ret)
        let time = parseInt(new Date().getTime()/1000)
        if(ret && ret.expire>=0 && (ret.time+ret.expire) < time){
            await this.kv_level.del(key)
            return null
        }
        else return ret;
    }
    async levelSize()
    {
        let cnt = 0;
        for await (const [key, value] of this.kv_level.iterator()) {
            cnt++
        }
        return cnt;
    }
    async level2DB()
    {
        let stm = this.db.prepare(KV_TB_PUT_SQL)
        let cnt = 0;
        let now = parseInt(new Date().getTime()/1000)
        for await (const [key, value] of this.kv_level.iterator()) {
            let {val,time,expire} = JSON.parse(value)
           // console.log('key:'+key+' value:'+value)
           if(expire>=0 && (time+expire) <now)
           {
                this.kv_level.del(key)
                continue
           }
            cnt++
            if(this.options.dbtype == 'sqlite3') stm.run(key,val,time,expire)
            else stm.run([key,val,time,expire])
            //cnt += this.executeUpdate(KV_TB_PUT_SQL,[key,val,time,expire])
        }
        if(this.options.dbtype!='sqlite3')stm.free();
        return cnt;
    }
    async db2Level()
    {
        let cnt = 0,This = this,now = parseInt(new Date().getTime()/1000)
        this.db.each('select * from system_kv',{},function(row){
            //console.log('db-row:'+JSON.stringify(row))
            if(row.expire>=0 && (row.time+row.expire) <now)
            {
                This.sqlDel(row.key)
                return
            }
            This.kv_level.put(row.key,{val:row.val,time:row.time,expire:row.expire})
            cnt ++ 
        })
        return cnt;
    }

    async getObjInfo(key)
    {
        if(!this.kv_opt) return null
        try{
            switch(this.kv_opt.type){
                case 'map':return this.mapGet(key)
                case 'level':return await this.levelGet(key)
                case 'sql':return await this.sqlGet(key)
                default: return null;
            }
        }catch(ex){console.log('SQLDB-get-exception:'+JSON.stringify(ex))}
        return null;
    }
    async get(key)
    {
        let ret = await this.getObjInfo(key)
        if(ret) return ret.val
        else return null;
    }
    async mget(keys)
    {
        if(keys==null||keys.length<=0) return []
        let rets = []
        for(let i=0;i<keys.length;i++)
            rets.push(await this.get(keys[i]))
        return rets;
    }
    async put(key,val,expire=-1)
    {
        if(!this.kv_opt) return null
        switch(this.kv_opt.type){
            case 'map':return this.mapPut(key,val,expire)
            case 'level':return await this.levelPut(key,val,expire)
            case 'sql':return await this.sqlPut(key,val,expire)
            default: return null;
        }
    }
    //对以前的redisClient.set进行兼容处理
    async set(key,val,expire=-1){
        return await this.put(key,val,expire)
    }
    async del(key,val,expire)
    {
        if(!this.kv_opt) return null
        try{
            switch(this.kv_opt.type){
                case 'map':return this.mapDel(key)
                case 'level':return await this.levelDel(key)
                case 'sql':return await this.sqlDel(key)
                default: return null;
            }
        }catch(ex){console.log('SQLDB-del-exception:'+JSON.stringify(ex))}
        return null;
    }
    async size()
    {
        if(!this.kv_opt) return -1
        switch(this.kv_opt.type){
            case 'map':return this.mapSize()
            case 'level':return await this.levelSize()
            case 'sql':return await this.sqlSize()
            default: return -1;
        }
    }
    
    toMysqlResults(rows)
    {
       // console.log('to rows:'+JSON.stringify(rows))
        if(!rows || !rows.columns) return ;
        let results = []
        for(let i=0;i<rows.values.length;i++)
        {
            let obj = {}
            for(let k= 0; k<rows.columns.length;k++)
            {
                obj[rows.columns[k]] = rows.values[i][k]
            }
            results.push(obj)
        }
        return results;
    }
}
// module.exports.KV_TB_NAME = KV_TB_NAME
// module.exports = SQLDB
window.SQLDB = SQLDB
window.SQLDB.KV_TB_NAME = KV_TB_NAME
