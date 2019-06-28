'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, BadRequest, AuthenticationError, InvalidOrder, InsufficientFunds, RequestTimeout } = require ('./base/errors');
const { ROUND, DECIMAL_PLACES, NO_PADDING } = require ('./base/functions/number');

//  ---------------------------------------------------------------------------

module.exports = class dx extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'dx',
            'name': 'DX.Exchange',
            'countries': [ 'GB', 'EU' ],
            'rateLimit': 1500,
            'version': 'v1',
            'has': {
                'cancelAllOrders': false,
                'cancelOrder': true,
                'cancelOrders': false,
                'CORS': false,
                'createDepositAddress': false,
                'createLimitOrder': true,
                'createMarketOrder': true,
                'createOrder': true,
                'deposit': false,
                'editOrder': false,
                'fetchBalance': true,
                'fetchBidsAsks': false,
                'fetchClosedOrders': true,
                'fetchCurrencies': false,
                'fetchDepositAddress': false,
                'fetchDeposits': false,
                'fetchFundingFees': false,
                'fetchL2OrderBook': false,
                'fetchLedger': false,
                'fetchMarkets': true,
                'fetchMyTrades': false,
                'fetchOHLCV': true,
                'fetchOpenOrders': true,
                'fetchOrder': false,
                'fetchOrderBook': true,
                'fetchOrderBooks': false,
                'fetchOrders': false,
                'fetchTicker': true,
                'fetchTickers': false,
                'fetchTrades': false,
                'fetchTradingFee': false,
                'fetchTradingFees': false,
                'fetchTradingLimits': false,
                'fetchTransactions': false,
                'fetchWithdrawals': false,
                'privateAPI': true,
                'publicAPI': true,
                'withdraw': false,
            },
            'timeframes': {
                '1m': '1m',
                '5m': '5m',
                '1h': '1h',
                '1d': '1d',
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/57979980-6483ff80-7a2d-11e9-9224-2aa20665703b.jpg',
                'api': 'https://acl.dx.exchange',
                'www': 'https://dx.exchange',
                'doc': 'https://apidocs.dx.exchange',
                'fees': 'https://dx.exchange/fees',
                'referral': 'https://dx.exchange/registration?dx_cid=20&dx_scname=100001100000038139',
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': false,
            },
            'fees': {
                'trading': {
                    'tierBased': true,
                    'percentage': true,
                    'taker': 0.25 / 100,
                    'maker': 0.25 / 100,
                    'tiers': {
                        'taker': [
                            [0, 0.25 / 100],
                            [1000000, 0.2 / 100],
                            [5000000, 0.15 / 100],
                            [10000000, 0.1 / 100],
                        ],
                        'maker': [
                            [0, 0.25 / 100],
                            [1000000, 0.2 / 100],
                            [5000000, 0.15 / 100],
                            [10000000, 0.1 / 100],
                        ],
                    },
                },
                'funding': {
                },
            },
            'exceptions': {
                'exact': {
                    'EOF': BadRequest,
                },
                'broad': {
                    'json: cannot unmarshal object into Go value of type': BadRequest,
                    'not allowed to cancel this order': BadRequest,
                    'request timed out': RequestTimeout,
                    'balance_freezing.freezing validation.balance_freeze': InsufficientFunds,
                    'order_creation.validation.validation': InvalidOrder,
                },
            },
            'api': {
                'public': {
                    'post': [
                        'AssetManagement.GetInstruments',
                        'AssetManagement.GetTicker',
                        'AssetManagement.History',
                        'Authorization.LoginByToken',
                        'OrderManagement.GetOrderBook',
                    ],
                },
                'private': {
                    'post': [
                        'Balance.Get',
                        'OrderManagement.Cancel',
                        'OrderManagement.Create',
                        'OrderManagement.OpenOrders',
                        'OrderManagement.OrderHistory',
                    ],
                },
            },
            'commonCurrencies': {
                'BCH': 'Bitcoin Cash',
            },
            'precisionMode': DECIMAL_PLACES,
            'options': {
                'orderTypes': {
                    'market': 1,
                    'limit': 2,
                },
                'orderSide': {
                    'buy': 1,
                    'sell': 2,
                },
            },
        });
    }

    numberToObject (number) {
        const string = this.decimalToPrecision (number, ROUND, 10, DECIMAL_PLACES, NO_PADDING);
        const decimals = this.precisionFromString (string);
        const valueStr = string.replace ('.', '');
        return {
            'value': this.safeInteger ({ 'a': valueStr }, 'a', undefined),
            'decimals': decimals,
        };
    }

    objectToNumber (obj) {
        const value = this.decimalToPrecision (obj['value'], ROUND, 0, DECIMAL_PLACES, NO_PADDING);
        const decimals = this.decimalToPrecision (-obj['decimals'], ROUND, 0, DECIMAL_PLACES, NO_PADDING);
        return this.safeFloat ({
            'a': value + 'e' + decimals,
        }, 'a', undefined);
    }

    async fetchMarkets (params = {}) {
        const markets = await this.publicPostAssetManagementGetInstruments (params);
        const instruments = markets['result']['instruments'];
        const result = [];
        for (let i = 0; i < instruments.length; i++) {
            const instrument = instruments[i];
            const id = this.safeString (instrument, 'id');
            const numericId = this.safeInteger (instrument, 'id');
            const asset = this.safeValue (instrument, 'asset', {});
            const fullName = this.safeString (asset, 'fullName');
            let [ base, quote ] = fullName.split ('/');
            let amountPrecision = 0;
            if (instrument['meQuantityMultiplier'] !== 0) {
                amountPrecision = Math.log10 (instrument['meQuantityMultiplier']);
            }
            base = this.commonCurrencyCode (base);
            quote = this.commonCurrencyCode (quote);
            const baseId = this.safeString (asset, 'baseCurrencyId');
            const quoteId = this.safeString (asset, 'quotedCurrencyId');
            const baseNumericId = this.safeInteger (asset, 'baseCurrencyId');
            const quoteNumericId = this.safeInteger (asset, 'quotedCurrencyId');
            const symbol = base + '/' + quote;
            result.push ({
                'id': id,
                'numericId': numericId,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'baseNumericId': baseNumericId,
                'quoteNumericId': quoteNumericId,
                'info': instrument,
                'precision': {
                    'amount': amountPrecision,
                    'price': this.safeInteger (asset, 'tailDigits'),
                },
                'limits': {
                    'amount': {
                        'min': this.safeFloat (instrument, 'minOrderQuantity'),
                        'max': this.safeFloat (instrument, 'maxOrderQuantity'),
                    },
                    'price': {
                        'min': 0,
                        'max': undefined,
                    },
                    'cost': {
                        'min': 0,
                        'max': undefined,
                    },
                },
            });
        }
        return result;
    }

    parseTicker (ticker, market = undefined) {
        const tickerKeys = Object.keys (ticker);
        // Python needs an integer to access this.markets_by_id
        // and a string to access the ticker object
        const tickerKey = tickerKeys[0];
        const instrumentId = this.safeInteger ({ 'a': tickerKey }, 'a');
        ticker = ticker[tickerKey];
        const symbol = this.markets_by_id[instrumentId]['symbol'];
        const last = this.safeFloat (ticker, 'last');
        const timestamp = this.safeInteger (ticker, 'time') / 1000;
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high24'),
            'low': this.safeFloat (ticker, 'low24'),
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': this.safeFloat (ticker, 'change'),
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat (ticker, 'volume24'),
            'quoteVolume': this.safeFloat (ticker, 'volume24converted'),
            'info': ticker,
        };
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'instrumentIds': [ market['numericId'] ],
            'currencyId': market['quoteNumericId'],
        };
        const response = await this.publicPostAssetManagementGetTicker (this.extend (request, params));
        return this.parseTicker (response['result']['tickers'], market);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            this.safeFloat (ohlcv, 'date') * 1000,
            this.safeFloat (ohlcv, 'open'),
            this.safeFloat (ohlcv, 'high'),
            this.safeFloat (ohlcv, 'low'),
            this.safeFloat (ohlcv, 'close'),
            this.safeFloat (ohlcv, 'volume'),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'timestampFrom': since,
            'timestampTill': undefined,
            'instrumentId': market['numericId'],
            'type': this.timeframes[timeframe],
            'pagination': {
                'limit': limit,
                'offset': 0,
            },
        };
        const response = await this.publicPostAssetManagementHistory (this.extend (request, params));
        return this.parseOHLCVs (response['result']['assets'], market, timeframe, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'pagination': {
                'limit': limit,
                'offset': 0,
            },
        };
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['instrumentId'] = market['numericId'];
        }
        const response = await this.privatePostOrderManagementOpenOrders (this.extend (request, params));
        return this.parseOrders (response['result']['orders'], market, since, limit);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'pagination': {
                'limit': limit,
                'offset': 0,
            },
        };
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['instrumentId'] = market['numericId'];
        }
        const response = await this.privatePostOrderManagementOrderHistory (this.extend (request, params));
        return this.parseOrders (response['result']['ordersForHistory'], market, since, limit);
    }

    parseOrder (order, market = undefined) {
        let orderStatusMap = {
            '1': 'open',
        };
        const innerOrder = this.safeValue (order, 'order', undefined);
        if (innerOrder !== undefined) {
            // fetchClosedOrders returns orders in an extra object
            order = innerOrder;
            orderStatusMap = {
                '1': 'closed',
                '2': 'canceled',
            };
        }
        let side = 'buy';
        if (order['direction'] === this.options['orderSide']['sell']) {
            side = 'sell';
        }
        let status = undefined;
        const orderStatus = this.safeString (order, 'status', undefined);
        if (orderStatus in orderStatusMap) {
            status = orderStatusMap[orderStatus];
        }
        const marketId = this.safeString (order, 'instrumentId');
        let symbol = undefined;
        if (marketId in this.markets_by_id) {
            market = this.markets_by_id[marketId];
            symbol = market['symbol'];
        }
        let orderType = 'limit';
        if (order['orderType'] === this.options['orderTypes']['market']) {
            orderType = 'market';
        }
        const timestamp = order['time'] * 1000;
        const quantity = this.objectToNumber (order['quantity']);
        const filledQuantity = this.objectToNumber (order['filledQuantity']);
        const id = this.safeString (order, 'externalOrderId');
        return {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': orderType,
            'side': side,
            'price': this.objectToNumber (order['price']),
            'average': undefined,
            'amount': quantity,
            'remaining': quantity - filledQuantity,
            'filled': filledQuantity,
            'status': status,
            'fee': undefined,
        };
    }

    parseBidAsk (bidask, priceKey = 0, amountKey = 1) {
        const price = this.objectToNumber (bidask[priceKey]);
        const amount = this.objectToNumber (bidask[amountKey]);
        return [ price, amount ];
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'instrumentId': market['numericId'],
        };
        const response = await this.publicPostOrderManagementGetOrderBook (this.extend (request, params));
        const orderbook = this.safeValue (response, 'result');
        return this.parseOrderBook (orderbook, undefined, 'sell', 'buy', 'price', 'qty');
    }

    async signIn (params = {}) {
        this.checkRequiredCredentials ();
        const request = {
            'token': this.apiKey,
            'secret': this.secret,
        };
        const response = await this.publicPostAuthorizationLoginByToken (this.extend (request, params));
        const expiresIn = response['result']['expiry'];
        this.options['expires'] = this.sum (this.milliseconds (), expiresIn * 1000);
        this.options['accessToken'] = response['result']['token'];
        return response;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privatePostBalanceGet (params);
        const result = { 'info': response };
        const balances = this.safeValue (response['result'], 'balance');
        const currencyIds = Object.keys (balances);
        for (let i = 0; i < currencyIds.length; i++) {
            const currencyId = currencyIds[i];
            const balance = this.safeValue (balances, currencyId, {});
            if (currencyId in this.currencies_by_id) {
                const code = this.currencies_by_id[currencyId]['code'];
                const account = {
                    'free': this.safeFloat (balance, 'available'),
                    'used': this.safeFloat (balance, 'frozen'),
                    'total': this.safeFloat (balance, 'total'),
                };
                result[code] = account;
            }
        }
        return this.parseBalance (result);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const direction = this.safeInteger (this.options['orderSide'], side);
        const market = this.market (symbol);
        const order = {
            'direction': direction,
            'instrumentId': market['numericId'],
            'orderType': 2,
            'quantity': this.numberToObject (amount),
        };
        order['orderType'] = this.options['orderTypes'][type];
        if (type === 'limit') {
            order['price'] = this.numberToObject (price);
        }
        const request = {
            'order': order,
        };
        const result = await this.privatePostOrderManagementCreate (this.extend (request, params));
        // todo: rewrite for parseOrder
        return {
            'info': result,
            'id': result['result']['externalOrderId'],
        };
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        const request = { 'externalOrderId': id };
        return await this.privatePostOrderManagementCancel (this.extend (request, params));
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        if (Array.isArray (params)) {
            const arrayLength = params.length;
            if (arrayLength === 0) {
                // In PHP params = array () causes this to fail, because
                // the API requests an object, not an array, even if it is empty
                params = { '__associative': true };
            }
        }
        const parameters = {
            'jsonrpc': '2.0',
            'id': this.milliseconds (),
            'method': path,
            'params': [params],
        };
        let url = this.urls['api'];
        headers = { 'Content-Type': 'application/json-rpc' };
        if (method === 'GET') {
            if (Object.keys (parameters).length) {
                url += '?' + this.urlencode (parameters);
            }
        } else {
            body = this.json (parameters);
        }
        if (api === 'private') {
            const token = this.safeString (this.options, 'accessToken');
            if (token === undefined) {
                throw new AuthenticationError (this.id + ' ' + path + ' endpoint requires a prior call to signIn() method');
            }
            const expires = this.safeInteger (this.options, 'expires');
            if (expires !== undefined) {
                if (this.milliseconds () >= expires) {
                    throw new AuthenticationError (this.id + ' accessToken expired, call signIn() method');
                }
            }
            headers['Authorization'] = token;
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (httpCode, reason, url, method, headers, body, response) {
        if (!response) {
            return; // fallback to default error handler
        }
        const error = response['error'];
        if (error) {
            const feedback = this.id + ' ' + this.json (response);
            const exact = this.exceptions['exact'];
            if (error in exact) {
                throw new exact[error] (feedback);
            }
            const broad = this.exceptions['broad'];
            const broadKey = this.findBroadlyMatchedKey (broad, error);
            if (broadKey !== undefined) {
                throw new broad[broadKey] (feedback);
            }
            throw new ExchangeError (feedback); // unknown error
        }
    }
};
