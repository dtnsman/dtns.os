/**
 * Created by Evan on 2017/8/25.
 * reids链接
 */

const Promise = require('bluebird');
const redis = require('redis');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

function RedisClient(redis_config) {
    this.redis_config = redis_config;
    this.redis_client = redis.createClient(redis_config.port, redis_config.host);
    this.redis_client.auth(redis_config.auth, function() {
        console.log(redis_config.host + ':' + redis_config.port + ' redis access success!');
    });

    this.redis_client.on('connect', function() {
        console.log(redis_config.host + ':' + redis_config.port + ' redis connect!');
    });
}


RedisClient.prototype.set = async function(key, value, expire_time , cnt = 0) {
    let res = '';
    let flag = true;
    expire_time = expire_time || this.redis_config.expire_time;

    if (expire_time == 'MAX' || expire_time==-1) {
        await this.redis_client.setAsync(key, value)
            .then((rows) => {
                res = rows;
            }).catch((err) => {
                flag = false;
                res = err;
            })
    } else {
        await this.redis_client.setAsync(key, value, 'EX', expire_time)
            .then((rows) => {
                res = rows;
            }).catch((err) => {
                flag = false;
                res = err;
            })
    }

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_set失败' + cnt + '次，key:' + key + ',value:' + value + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.set(key, value, expire_time, cnt);
    }
    return res;
};

RedisClient.prototype.get = async function(key, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.getAsync(key)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_get失败' + cnt + '次，key:' + key + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.get(key, cnt);
    }
    return res;
};

//请求多个key
RedisClient.prototype.mget = async function(keys, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.mgetAsync(keys)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_mget失败' + cnt + '次，keys:' + keys + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.mget(keys, cnt);
    }
    return res;
};


RedisClient.prototype.del = async function(key, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.delAsync(key)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_del失败' + cnt + '次，key:' + key + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.del(key, cnt);
    }
    return flag;
}

//将一个值插入到列表尾部
RedisClient.prototype.rpush = async function(key, value, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.rpushAsync(key, value)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_rpush失败' + cnt + '次，key:' + key + ',value:' + value + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.rpush(key, value, cnt);
    }
    return flag;
}

//通过索引获取列表中的元素
RedisClient.prototype.lindex = async function(key, index, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.lindexAsync(key, index)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_lindex失败' + cnt + '次，key:' + key + ',index:' + index + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.lindex(key, index, cnt);
    }
    return res;
}

//移出并获取列表的第一个元素
RedisClient.prototype.lpop = async function(key, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.lpopAsync(key)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_lpop失败' + cnt + '次，key:' + key + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.lpop(key, cnt);
    }
    return res;
}

//获取列表长度
RedisClient.prototype.llen = async function(key, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.llenAsync(key)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_llen失败' + cnt + '次，key:' + key + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.llen(key, cnt);
    }
    return res;
}


//返回哈希表 key 中给定域 field 的值。
RedisClient.prototype.hget = async function(key, field, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.hgetAsync(key, field)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_hget失败' + cnt + '次，key:' + key + ',field:' + field + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.hget(key, field, cnt);
    }
    return res;
}

//返回哈希表 key 中给定域 field 的值。
RedisClient.prototype.hget = async function(key, field, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.hgetAsync(key, field)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_hget失败' + cnt + '次，key:' + key + ',field:' + field + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.hget(key, field, cnt);
    }
    return res;
}


// 以毫秒为单位返回 key 的剩余过期时间。
// 当 key 不存在时，返回 -2 。 当 key 存在但没有设置剩余生存时间时，返回 -1 。 否则，以毫秒为单位，返回 key 的剩余生存时间。
RedisClient.prototype.pttl = async function(key) {
    let res = -2;

    await this.redis_client.pttlAsync(key)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            let err_msg = 'redis_pttl失败，key:' + key + ',err:' + err;
            console.log(err_msg);
            global.error_log.write(err_msg);
        })

    return res;
}

// 设置 key 的过期时间。key 过期后将不再可用。
// 设置成功返回 1 。 当 key 不存在或者不能为 key 设置过期时间时(比如在低于 2.1.3 版本的 Redis 中你尝试更新 key 的过期时间)返回 0 。
RedisClient.prototype.expire = async function(key, second) {
    let res = 0;

    await this.redis_client.expireAsync(key, second)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            let err_msg = 'redis_expire失败，key:' + key + ',err:' + err;
            console.log(err_msg);
            global.error_log.write(err_msg);
        })

    return res;
}

//添加集合成员
RedisClient.prototype.sadd = async function(key, member, cnt = 0) {
    let res = '';
    let flag = true;
    let err_s = null;

    if (member instanceof Array) {
        await this.redis_client.saddAsync(key, ...member)
            .then((rows) => {
                res = rows;
            }).catch((err) => {
                flag = false;
                err_s = err;
            })
    } else {
        await this.redis_client.saddAsync(key, member)
            .then((rows) => {
                res = rows;
            }).catch((err) => {
                flag = false;
                err_s = err;
            })
    }

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_sadd失败' + cnt + '次，key:' + key + ',member:' + member + ',err:' + err_s;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.sadd(key, member, cnt);
    }
    return res;
};

//删除集合成员
RedisClient.prototype.srem = async function(key, member, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.sremAsync(key, member)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_srem失败' + cnt + '次，key:' + key + ',member:' + member + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.srem(key, member, cnt);
    }
    return res;
};

//判断 member 元素是否是集合 key 的成员
RedisClient.prototype.sismember = async function(key, member, cnt = 0) {
    let res = '';
    let flag = true;

    await this.redis_client.sismemberAsync(key, member)
        .then((rows) => {
            res = rows;
        }).catch((err) => {
            flag = false;
            res = err;
        })

    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = 'redis_sismember失败' + cnt + '次，key:' + key + ',member:' + member + ',err:' + res;
        console.log(err_msg);
        global.error_log.write(err_msg);
        await sleep(300);
        res = await this.sismember(key, member, cnt);
    }
    return res;
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = RedisClient;
