'use strict';

// ---------------------------------------------------------------------------

const bittrex = require ('./bittrex.js');
const { ExchangeError, AuthenticationError, InvalidOrder, InsufficientFunds } = require ('./base/errors');

// ---------------------------------------------------------------------------

module.exports = class bleutrade extends bittrex {
    describe () {
        const timeframes = {
            '15m': '15m',
            '20m': '20m',
            '30m': '30m',
            '1h': '1h',
            '2h': '2h',
            '3h': '3h',
            '4h': '4h',
            '6h': '6h',
            '8h': '8h',
            '12h': '12h',
            '1d': '1d',
        };
        const result = this.deepExtend (super.describe (), {
            'id': 'bleutrade',
            'name': 'Bleutrade',
            'countries': [ 'BR' ], // Brazil
            'rateLimit': 1000,
            'version': 'v2',
            'certified': false,
            'has': {
                'CORS': true,
                'fetchTickers': true,
                'fetchOrders': true,
                'fetchClosedOrders': true,
                'fetchOrderTrades': true,
            },
            'timeframes': timeframes,
            'hostname': 'bleutrade.com',
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/30303000-b602dbe6-976d-11e7-956d-36c5049c01e7.jpg',
                'api': {
                    'public': 'https://{hostname}/api',
                    'account': 'https://{hostname}/api',
                    'market': 'https://{hostname}/api',
                },
                'www': 'https://bleutrade.com',
                'doc': 'https://bleutrade.com/help/API',
                'fees': 'https://bleutrade.com/help/fees_and_deadlines',
            },
            'api': {
                'account': {
                    'get': [
                        'balance',
                        'balances',
                        'depositaddress',
                        'deposithistory',
                        'order',
                        'orders',
                        'orderhistory',
                        'withdrawhistory',
                        'withdraw',
                    ],
                },
                'public': {
                    'get': [
                        'candles',
                        'currencies',
                        'markethistory',
                        'markets',
                        'marketsummaries',
                        'marketsummary',
                        'orderbook',
                        'ticker',
                    ],
                },
            },
            'fees': {
                'funding': {
                    'withdraw': {
                        'ADC': 0.1,
                        'BTA': 0.1,
                        'BITB': 0.1,
                        'BTC': 0.001,
                        'BCC': 0.001,
                        'BTCD': 0.001,
                        'BTG': 0.001,
                        'BLK': 0.1,
                        'CDN': 0.1,
                        'CLAM': 0.01,
                        'DASH': 0.001,
                        'DCR': 0.05,
                        'DGC': 0.1,
                        'DP': 0.1,
                        'DPC': 0.1,
                        'DOGE': 10.0,
                        'EFL': 0.1,
                        'ETH': 0.01,
                        'EXP': 0.1,
                        'FJC': 0.1,
                        'BSTY': 0.001,
                        'GB': 0.1,
                        'NLG': 0.1,
                        'HTML': 1.0,
                        'LTC': 0.001,
                        'MONA': 0.01,
                        'MOON': 1.0,
                        'NMC': 0.015,
                        'NEOS': 0.1,
                        'NVC': 0.05,
                        'OK': 0.1,
                        'PPC': 0.1,
                        'POT': 0.1,
                        'XPM': 0.001,
                        'QTUM': 0.1,
                        'RDD': 0.1,
                        'SLR': 0.1,
                        'START': 0.1,
                        'SLG': 0.1,
                        'TROLL': 0.1,
                        'UNO': 0.01,
                        'VRC': 0.1,
                        'VTC': 0.1,
                        'XVP': 0.1,
                        'WDC': 0.001,
                        'ZET': 0.1,
                    },
                },
            },
            'commonCurrencies': {
                'EPC': 'Epacoin',
            },
            'exceptions': {
                'Insufficient funds!': InsufficientFunds,
                'Invalid Order ID': InvalidOrder,
                'Invalid apikey or apisecret': AuthenticationError,
            },
            'options': {
                'parseOrderStatus': true,
                'disableNonce': false,
                'symbolSeparator': '_',
            },
        });
        // bittrex inheritance override
        result['timeframes'] = timeframes;
        return result;
    }

    parseOrderStatus (status) {
        const statuses = {
            'OK': 'closed',
            'OPEN': 'open',
            'CANCELED': 'canceled',
        };
        return this.safeString (statuses, status, status);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        // Possible params
        // orderstatus (ALL, OK, OPEN, CANCELED)
        // ordertype (ALL, BUY, SELL)
        // depth (optional, default is 500, max is 20000)
        await this.loadMarkets ();
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
        } else {
            market = undefined;
        }
        const request = {
            'market': 'ALL',
            'orderstatus': 'ALL',
        };
        const response = await this.accountGetOrders (this.extend (request, params));
        return this.parseOrders (response['result'], market, since, limit);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const response = await this.fetchOrders (symbol, since, limit, params);
        return this.filterBy (response, 'status', 'closed');
    }

    getOrderIdField () {
        return 'orderid';
    }

    parseSymbol (id) {
        let [ base, quote ] = id.split (this.options['symbolSeparator']);
        base = this.commonCurrencyCode (base);
        quote = this.commonCurrencyCode (quote);
        return base + '/' + quote;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'market': this.marketId (symbol),
            'type': 'ALL',
        };
        if (limit !== undefined) {
            request['depth'] = limit; // 50
        }
        const response = await this.publicGetOrderbook (this.extend (request, params));
        const orderbook = this.safeValue (response, 'result');
        if (!orderbook) {
            throw new ExchangeError (this.id + ' publicGetOrderbook() returneded no result ' + this.json (response));
        }
        return this.parseOrderBook (orderbook, undefined, 'buy', 'sell', 'Rate', 'Quantity');
    }

    async fetchOrderTrades (id, symbol = undefined, since = undefined, limit = undefined, params = {}) {
        // Currently we can't set the makerOrTaker field, but if the user knows the order side then it can be
        // determined (if the side of the trade is different to the side of the order, then the trade is maker).
        // Similarly, the correct 'side' for the trade is that of the order.
        // The trade fee can be set by the user, it is always 0.25% and is taken in the quote currency.
        await this.loadMarkets ();
        const request = {
            'orderid': id,
        };
        const response = await this.accountGetOrderhistory (this.extend (request, params));
        return this.parseTrades (response['result'], undefined, since, limit, {
            'order': id,
        });
    }

    async fetchTransactionsByType (type, code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const method = (type === 'deposit') ? 'accountGetDeposithistory' : 'accountGetWithdrawhistory';
        const response = await this[method] (params);
        const result = this.parseTransactions (response['result']);
        return this.filterByCurrencySinceLimit (result, code, since, limit);
    }

    async fetchDeposits (code = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchTransactionsByType ('deposit', code, since, limit, params);
    }

    async fetchWithdrawals (code = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchTransactionsByType ('withdrawal', code, since, limit, params);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1d', since = undefined, limit = undefined) {
        const timestamp = this.parse8601 (ohlcv['TimeStamp'] + '+00:00');
        return [
            timestamp,
            this.safeFloat (ohlcv, 'Open'),
            this.safeFloat (ohlcv, 'High'),
            this.safeFloat (ohlcv, 'Low'),
            this.safeFloat (ohlcv, 'Close'),
            this.safeFloat (ohlcv, 'Volume'),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '15m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'period': this.timeframes[timeframe],
            'market': market['id'],
            'count': limit,
        };
        const response = await this.publicGetCandles (this.extend (request, params));
        if ('result' in response) {
            if (response['result']) {
                return this.parseOHLCVs (response['result'], market, timeframe, since, limit);
            }
        }
    }

    parseTrade (trade, market = undefined) {
        const timestamp = this.parse8601 (trade['TimeStamp'] + '+00:00');
        let side = undefined;
        if (trade['OrderType'] === 'BUY') {
            side = 'buy';
        } else if (trade['OrderType'] === 'SELL') {
            side = 'sell';
        }
        const id = this.safeString (trade, 'TradeID');
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        let cost = undefined;
        const price = this.safeFloat (trade, 'Price');
        const amount = this.safeFloat (trade, 'Quantity');
        if (amount !== undefined) {
            if (price !== undefined) {
                cost = price * amount;
            }
        }
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': 'limit',
            'side': side,
            'order': undefined,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    parseOrder (order, market = undefined) {
        let side = this.safeString2 (order, 'OrderType', 'Type');
        const isBuyOrder = (side === 'LIMIT_BUY') || (side === 'BUY');
        const isSellOrder = (side === 'LIMIT_SELL') || (side === 'SELL');
        if (isBuyOrder) {
            side = 'buy';
        }
        if (isSellOrder) {
            side = 'sell';
        }
        // We parse different fields in a very specific order.
        // Order might well be closed and then canceled.
        let status = undefined;
        if (('Opened' in order) && order['Opened']) {
            status = 'open';
        }
        if (('Closed' in order) && order['Closed']) {
            status = 'closed';
        }
        if (('CancelInitiated' in order) && order['CancelInitiated']) {
            status = 'canceled';
        }
        if (('Status' in order) && this.options['parseOrderStatus']) {
            status = this.parseOrderStatus (this.safeString (order, 'Status'));
        }
        let symbol = undefined;
        const marketId = this.safeString (order, 'Exchange');
        if (marketId === undefined) {
            if (market !== undefined) {
                symbol = market['symbol'];
            }
        } else {
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
                symbol = market['symbol'];
            } else {
                symbol = this.parseSymbol (marketId);
            }
        }
        let timestamp = undefined;
        if ('Opened' in order) {
            timestamp = this.parse8601 (order['Opened'] + '+00:00');
        }
        if ('Created' in order) {
            timestamp = this.parse8601 (order['Created'] + '+00:00');
        }
        let lastTradeTimestamp = undefined;
        if (('TimeStamp' in order) && (order['TimeStamp'] !== undefined)) {
            lastTradeTimestamp = this.parse8601 (order['TimeStamp'] + '+00:00');
        }
        if (('Closed' in order) && (order['Closed'] !== undefined)) {
            lastTradeTimestamp = this.parse8601 (order['Closed'] + '+00:00');
        }
        if (timestamp === undefined) {
            timestamp = lastTradeTimestamp;
        }
        let fee = undefined;
        let commission = undefined;
        if ('Commission' in order) {
            commission = 'Commission';
        } else if ('CommissionPaid' in order) {
            commission = 'CommissionPaid';
        }
        if (commission) {
            fee = {
                'cost': this.safeFloat (order, commission),
            };
            if (market !== undefined) {
                fee['currency'] = market['quote'];
            } else if (symbol !== undefined) {
                const currencyIds = symbol.split ('/');
                const quoteCurrencyId = currencyIds[1];
                if (quoteCurrencyId in this.currencies_by_id) {
                    fee['currency'] = this.currencies_by_id[quoteCurrencyId]['code'];
                } else {
                    fee['currency'] = this.commonCurrencyCode (quoteCurrencyId);
                }
            }
        }
        let price = this.safeFloat (order, 'Price');
        let cost = undefined;
        const amount = this.safeFloat (order, 'Quantity');
        const remaining = this.safeFloat (order, 'QuantityRemaining');
        let filled = undefined;
        if (amount !== undefined && remaining !== undefined) {
            filled = amount - remaining;
        }
        if (!cost) {
            if (price && filled) {
                cost = price * filled;
            }
        }
        if (!price) {
            if (cost && filled) {
                price = cost / filled;
            }
        }
        const average = this.safeFloat (order, 'PricePerUnit');
        const id = this.safeString2 (order, 'OrderUuid', 'OrderId');
        return {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': lastTradeTimestamp,
            'symbol': symbol,
            'type': 'limit',
            'side': side,
            'price': price,
            'cost': cost,
            'average': average,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': fee,
        };
    }

    parseTransaction (transaction, currency = undefined) {
        //
        //  deposit:
        //
        //     {
        //         Id: '96974373',
        //         Coin: 'DOGE',
        //         Amount: '12.05752192',
        //         TimeStamp: '2017-09-29 08:10:09',
        //         Label: 'DQqSjjhzCm3ozT4vAevMUHgv4vsi9LBkoE',
        //     }
        //
        // withdrawal:
        //
        //     {
        //         Id: '98009125',
        //         Coin: 'DOGE',
        //         Amount: '-483858.64312050',
        //         TimeStamp: '2017-11-22 22:29:05',
        //         Label: '483848.64312050;DJVJZ58tJC8UeUv9Tqcdtn6uhWobouxFLT;10.00000000',
        //         TransactionId: '8563105276cf798385fee7e5a563c620fea639ab132b089ea880d4d1f4309432',
        //     }
        //
        //     {
        //         "Id": "95820181",
        //         "Coin": "BTC",
        //         "Amount": "-0.71300000",
        //         "TimeStamp": "2017-07-19 17:14:24",
        //         "Label": "0.71200000;PER9VM2txt4BTdfyWgvv3GziECRdVEPN63;0.00100000",
        //         "TransactionId": "CANCELED"
        //     }
        //
        const id = this.safeString (transaction, 'Id');
        let amount = this.safeFloat (transaction, 'Amount');
        let type = 'deposit';
        if (amount < 0) {
            amount = Math.abs (amount);
            type = 'withdrawal';
        }
        const currencyId = this.safeString (transaction, 'Coin');
        let code = undefined;
        currency = this.safeValue (this.currencies_by_id, currencyId);
        if (currency !== undefined) {
            code = currency['code'];
        } else {
            code = this.commonCurrencyCode (currencyId);
        }
        const label = this.safeString (transaction, 'Label');
        const timestamp = this.parse8601 (this.safeString (transaction, 'TimeStamp'));
        let txid = this.safeString (transaction, 'TransactionId');
        let address = undefined;
        let feeCost = undefined;
        const labelParts = label.split (';');
        if (labelParts.length === 3) {
            amount = parseFloat (labelParts[0]);
            address = labelParts[1];
            feeCost = parseFloat (labelParts[2]);
        } else {
            address = label;
        }
        let fee = undefined;
        if (feeCost !== undefined) {
            fee = {
                'currency': code,
                'cost': feeCost,
            };
        }
        let status = 'ok';
        if (txid === 'CANCELED') {
            txid = undefined;
            status = 'canceled';
        }
        return {
            'info': transaction,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'id': id,
            'currency': code,
            'amount': amount,
            'address': address,
            'tag': undefined,
            'status': status,
            'type': type,
            'updated': undefined,
            'txid': txid,
            'fee': fee,
        };
    }
};
