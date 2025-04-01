/**
 * Created by Evan on 2017/8/9.
 * 数据库连接池
 */

const mysql = require('promise-mysql');

const $pool = Symbol('pool');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function DB(db_config) {
    //console.log("db_config:"+db_config.host)
    this[$pool] = mysql.createPool(db_config);
}


DB.prototype.query = async function (sql, cnt = 0) {
    let res = '';
    let flag = true;
    let conn = null;

    await this[$pool].getConnection()
        .then((connection) => {
            conn = connection;
            return connection.query(sql);
        }).then((rows) => {
            res = rows;
        }).catch((err) => {

            console.log("err:"+err);


            if((""+err).indexOf("ER_PARSE_ERROR")<0 ) {
                flag = false;
            }

            res = err;

            console.log("res=err="+err+" \nsql:"+sql);
        })

    if (conn) {
        this[$pool].releaseConnection(conn);
    }


    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = '数据库请求失败' + cnt + '次，sql:' + sql + ',err:' + res;
        console.trace(err_msg);
        if (err_msg.indexOf('The server closed the connection') < 0 && err_msg.indexOf('Handshake inactivity timeout') < 0) {
            global.error_log.write(err_msg);
        }
        await sleep(300);
        res = await this.query(sql, cnt);
    }

    //console.log("return res="+res);
    return res;
};

DB.prototype.queryOne = async function (sql) {
    let rows = await this.query(sql);
    if (rows instanceof Array && rows.length > 0) {
        return rows[0];
    } else {
        return null;
    }
};


DB.prototype.queryNum = async function (sql) {
    let res = await this.query(sql);

    //console.log("res:"+JSON.stringify(res))

    let num = res && res['affectedRows'] || -1;
    return num;
};

DB.prototype.executeUpdate = async function (sql) {
    let res = await this.query(sql);

    let num = res && res['protocol41'] || false;

    return num;
};

DB.prototype.queryInsertId = async function (sql) {
    let res = await this.query(sql);
    let num = res.insertId || -1;
    return num;
};


DB.prototype.escape = function (value) {
    return this[$pool].escape(value);
}

DB.prototype.getConnection = async function () {
    let conn = null
    await this[$pool].getConnection()
        .then((connection) => {
            conn = connection;
        }).catch((err) => {
            let err_msg = '数据库获取连接失败,err:' + err;
            console.trace(err_msg);
            global.error_log.write(err_msg);
        });
    return conn;
}

DB.prototype.releaseConnection = function (connection) {
    this[$pool].releaseConnection(connection);
}

module.exports = DB;
