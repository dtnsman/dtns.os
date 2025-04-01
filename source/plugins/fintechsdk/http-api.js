const qs = require('querystring');
const axios = require('axios');
const Signer = require('./signer');

class HttpApi {
  constructor(apiKey, apiSecret, passphrase, opt = {}) {
    if (arguments.length === 1) opt = apiKey;
    opt.baseURL = opt.baseURL 

    this.update(apiKey, apiSecret, passphrase);
    this._http = axios.create(opt);
  }

  update(newApiKey, newApiSecret, newPassphrase) {
    Object.assign(this, { apiKey: newApiKey, passphrase: newPassphrase });
    this._signer = new Signer(newApiSecret, 'v5');
  }

  // instType: SPOT/MARGIN/SWAP/FUTURES/OPTION
  async getInstruments(instType) {
    const { data: { data } }  = await this._http.get('/api/v5/public/instruments', { params: { instType } });
    return data;
  }
  async getCcys()
  {
    // /api/v5/asset/currencies
    const data  = await this.get('/api/v5/asset/balances');
    return data;
  }
  async getHistory(instType)
  {
    const data = await this.get('/api/v5/trade/orders-history-archive',{ instType } );
    return data;
  }
  async getAddr(ccy){
    const data= await this.get('/api/v5/asset/deposit-address',{ccy})
    return data
  }
  async getPrice(instId)
  {
    const {data:{data}} = await this._http.get('/api/v5/market/ticker',{params:{instId}})
    return data
  }
  async getChargeHistory(limit=1000){
    const data = await this.get('/api/v5/asset/deposit-history',{limit})
    return data
  }
  async getWithdrawalHistory()
  {
    const data = await this.get('/api/v5/asset/withdrawal-history')
    return data
  }
  async getPriceByUsdt()
  {
    const data = await this.get('/api/v5/market/exchange-rate')
    return data
  }
  async getAccountHistory()
  {
    ///api/v5/account/bills-archive
    const  data  = await this.get('/api/v5/account/bills-archive');
    return data;
  }

  async getTickers(instType) {
    const { data: { data } } = await this._http.get('/api/v5/market/tickers', { params: { instType } });
    return data;
  }

  getAccountConfig() {
    return this.get1('/api/v5/account/config');
  }

  getAccounts(coins) {
    return this.get1('/api/v5/account/balance', { ccy: coins });
  }

  // instType: MARGIN, SWAP, FUTURES, OPTION
  getPositions(instType, instId) {
    return this.get('/api/v5/account/positions', { instType, instId });
  }

  // side: buy, sell
  // posSide: long, short
  // ordType: market, limit, post_only, fok, ioc
  order(instId, side, posSide, ordType, sz/* size */, px/* price */, clOrdId, tdMode = 'cross') {
    return this.post1('/api/v5/trade/order', { instId, tdMode, clOrdId, side, posSide, ordType, sz, px });
  }

  getOrder(instId, ordId, clOrdId) {
    return this.get1('/api/v5/trade/order', { instId, ordId, clOrdId});
  }

  batchOrder(orders) {
    return this.post('/api/v5/trade/batch-orders', orders);
  }

  toOrder(instId, side, posSide, ordType, sz/* size */, px/* price */, clOrdId, tdMode = 'cross') {
    return { instId, tdMode, clOrdId, side, posSide, ordType, sz, px };
  }

  cancelOrder(instId, ordId) {
    return this.post1('/api/v5/trade/cancel-order', { instId, ordId });
  }

  getSignedHeader(method, path, params) {
    const sign = this._signer.sign(path, params, method);
    return {
      'OK-ACCESS-KEY': this.apiKey,
      'OK-ACCESS-TIMESTAMP': sign[0],
      'OK-ACCESS-SIGN': sign[1],
      'OK-ACCESS-PASSPHRASE': this.passphrase
    };
  }

  async get(path, params) {
    if (params) {
      for (const key of Object.keys(params || {})) {
        if (params[key] === null || params[key] === undefined) delete params[key];
      }

      path += '?' + qs.encode(params);
    }

    const { data: { data } } = await this._http.get(path, { headers: this.getSignedHeader('GET', path) });
    return data;
  }

  async get1(path, params) {
    const [ret] = await this.get(path, params);
    return ret;
  }

  async post(path, body) {
    const headers = {
      ...this.getSignedHeader('POST', path, body),
      'Content-Type': 'application/json'
    };

    const { data: { data } } = await this._http.post(path, body, { headers });
    return data;
  }

  async post1(path, body) {
    const [ret] = await this.post(path, body);
    return ret;
  }
}

module.exports = HttpApi;