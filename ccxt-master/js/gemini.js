'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, OrderNotFound, InvalidOrder, InvalidNonce, DDoSProtection, InsufficientFunds, AuthenticationError, ExchangeNotAvailable, PermissionDenied, NotSupported } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class gemini extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'gemini',
            'name': 'Gemini',
            'countries': [ 'US' ],
            'rateLimit': 1500, // 200 for private API
            'version': 'v1',
            'has': {
                'fetchDepositAddress': false,
                'createDepositAddress': true,
                'CORS': false,
                'fetchBidsAsks': false,
                'fetchTickers': false,
                'fetchMyTrades': true,
                'fetchOrder': true,
                'fetchOrders': false,
                'fetchOpenOrders': true,
                'fetchClosedOrders': false,
                'createMarketOrder': false,
                'withdraw': true,
                'fetchTransactions': true,
                'fetchWithdrawals': false,
                'fetchDeposits': false,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/27816857-ce7be644-6096-11e7-82d6-3c257263229c.jpg',
                'api': {
                    'public': 'https://api.gemini.com',
                    'private': 'https://api.gemini.com',
                    'web': 'https://docs.gemini.com',
                },
                'www': 'https://gemini.com/',
                'doc': [
                    'https://docs.gemini.com/rest-api',
                    'https://docs.sandbox.gemini.com',
                ],
                'test': 'https://api.sandbox.gemini.com',
                'fees': [
                    'https://gemini.com/api-fee-schedule',
                    'https://gemini.com/trading-fees',
                    'https://gemini.com/transfer-fees',
                ],
            },
            'api': {
                'web': {
                    'get': [
                        'rest-api',
                    ],
                },
                'public': {
                    'get': [
                        'symbols',
                        'pubticker/{symbol}',
                        'book/{symbol}',
                        'trades/{symbol}',
                        'auction/{symbol}',
                        'auction/{symbol}/history',
                    ],
                },
                'private': {
                    'post': [
                        'order/new',
                        'order/cancel',
                        'order/cancel/session',
                        'order/cancel/all',
                        'order/status',
                        'orders',
                        'mytrades',
                        'tradevolume',
                        'transfers',
                        'balances',
                        'deposit/{currency}/newAddress',
                        'withdraw/{currency}',
                        'heartbeat',
                        'transfers',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'taker': 0.0035,
                    'maker': 0.001,
                },
            },
            'httpExceptions': {
                '400': BadRequest, // Auction not open or paused, ineligible timing, market not open, or the request was malformed, in the case of a private API request, missing or malformed Gemini private API authentication headers
                '403': PermissionDenied, // The API key is missing the role necessary to access this private API endpoint
                '404': OrderNotFound, // Unknown API entry point or Order not found
                '406': InsufficientFunds, // Insufficient Funds
                '429': DDoSProtection, // Rate Limiting was applied
                '500': ExchangeError, // The server encountered an error
                '502': ExchangeError, // Technical issues are preventing the request from being satisfied
                '503': ExchangeNotAvailable, // The exchange is down for maintenance
            },
            'exceptions': {
                'exact': {
                    'AuctionNotOpen': BadRequest, // Failed to place an auction-only order because there is no current auction open for this symbol
                    'ClientOrderIdTooLong': BadRequest, // The Client Order ID must be under 100 characters
                    'ClientOrderIdMustBeString': BadRequest, // The Client Order ID must be a string
                    'ConflictingOptions': BadRequest, // New orders using a combination of order execution options are not supported
                    'EndpointMismatch': BadRequest, // The request was submitted to an endpoint different than the one in the payload
                    'EndpointNotFound': BadRequest, // No endpoint was specified
                    'IneligibleTiming': BadRequest, // Failed to place an auction order for the current auction on this symbol because the timing is not eligible, new orders may only be placed before the auction begins.
                    'InsufficientFunds': InsufficientFunds, // The order was rejected because of insufficient funds
                    'InvalidJson': BadRequest, // The JSON provided is invalid
                    'InvalidNonce': InvalidNonce, // The nonce was not greater than the previously used nonce, or was not present
                    'InvalidOrderType': InvalidOrder, // An unknown order type was provided
                    'InvalidPrice': InvalidOrder, // For new orders, the price was invalid
                    'InvalidQuantity': InvalidOrder, // A negative or otherwise invalid quantity was specified
                    'InvalidSide': InvalidOrder, // For new orders, and invalid side was specified
                    'InvalidSignature': AuthenticationError, // The signature did not match the expected signature
                    'InvalidSymbol': BadRequest, // An invalid symbol was specified
                    'InvalidTimestampInPayload': BadRequest, // The JSON payload contained a timestamp parameter with an unsupported value.
                    'Maintenance': ExchangeNotAvailable, // The system is down for maintenance
                    'MarketNotOpen': InvalidOrder, // The order was rejected because the market is not accepting new orders
                    'MissingApikeyHeader': AuthenticationError, // The X-GEMINI-APIKEY header was missing
                    'MissingOrderField': InvalidOrder, // A required order_id field was not specified
                    'MissingRole': AuthenticationError, // The API key used to access this endpoint does not have the required role assigned to it
                    'MissingPayloadHeader': AuthenticationError, // The X-GEMINI-PAYLOAD header was missing
                    'MissingSignatureHeader': AuthenticationError, // The X-GEMINI-SIGNATURE header was missing
                    'NoSSL': AuthenticationError, // You must use HTTPS to access the API
                    'OptionsMustBeArray': BadRequest, // The options parameter must be an array.
                    'OrderNotFound': OrderNotFound, // The order specified was not found
                    'RateLimit': DDoSProtection, // Requests were made too frequently. See Rate Limits below.
                    'System': ExchangeError, // We are experiencing technical issues
                    'UnsupportedOption': BadRequest, // This order execution option is not supported.
                },
                'broad': {},
            },
            'options': {
                'fetchMarketsMethod': 'fetch_markets_from_web',
            },
        });
    }

    async fetchMarkets (params = {}) {
        const method = this.safeValue (this.options, 'fetchMarketsMethod', 'fetch_markets_from_api');
        return await this[method] (params);
    }

    async fetchMarketsFromWeb (symbols = undefined, params = {}) {
        const response = await this.webGetRestApi (params);
        const sections = response.split ('<h1 id="symbols-and-minimums">Symbols and minimums</h1>');
        const numSections = sections.length;
        const error = this.id + ' the ' + this.name + ' API doc HTML markup has changed, breaking the parser of order limits and precision info for ' + this.name + ' markets.';
        if (numSections !== 2) {
            throw new NotSupported (error);
        }
        const tables = sections[1].split ('tbody>');
        const numTables = tables.length;
        if (numTables < 2) {
            throw new NotSupported (error);
        }
        // tables[1] = tables[1].replace ("\n", ''); // eslint-disable-line quotes
        const rows = tables[1].split ("<tr>\n"); // eslint-disable-line quotes
        const numRows = rows.length;
        if (numRows < 2) {
            throw new NotSupported (error);
        }
        const result = [];
        // skip the first element (empty string)
        for (let i = 1; i < numRows; i++) {
            const row = rows[i];
            const cells = row.split ("</td>\n"); // eslint-disable-line quotes
            const numCells = cells.length;
            if (numCells < 7) {
                throw new NotSupported (error);
            }
            //
            //     [
            //         '<td><code class="prettyprint">btcusd</code>',
            //         '<td>USD', // quote
            //         '<td>BTC', // base
            //         '<td>0.00001 BTC (1e-5)', // min amount
            //         '<td>0.00000001 BTC (1e-8)', // amount min tick size
            //         '<td>0.01 USD', // price min tick size
            //         '</tr>\n'
            //     ]
            //
            let id = cells[0].replace ('<td>', '');
            id = id.replace ('<code class="prettyprint">', '');
            id = id.replace ('</code>', '');
            let baseId = cells[2].replace ('<td>', '');
            let quoteId = cells[1].replace ('<td>', '');
            const minAmountAsString = cells[3].replace ('<td>', '');
            const amountTickSizeAsString = cells[4].replace ('<td>', '');
            const priceTickSizeAsString = cells[5].replace ('<td>', '');
            const minAmount = minAmountAsString.split (' ');
            const amountPrecision = amountTickSizeAsString.split (' ');
            const pricePrecision = priceTickSizeAsString.split (' ');
            const base = this.commonCurrencyCode (baseId);
            const quote = this.commonCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            baseId = baseId.toLowerCase ();
            quoteId = quoteId.toLowerCase ();
            const precision = {
                'amount': this.precisionFromString (amountPrecision[0]),
                'price': this.precisionFromString (pricePrecision[0]),
            };
            const active = undefined;
            result.push ({
                'id': id,
                'info': row,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': active,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': parseFloat (minAmount[0]),
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
            });
        }
        return result;
    }

    async fetchMarketsFromAPI (params = {}) {
        const response = await this.publicGetSymbols (params);
        const result = [];
        for (let i = 0; i < response.length; i++) {
            const id = response[i];
            const market = id;
            const baseId = id.slice (0, 3);
            const quoteId = id.slice (3, 6);
            let base = baseId.toUpperCase ();
            let quote = quoteId.toUpperCase ();
            base = this.commonCurrencyCode (base);
            quote = this.commonCurrencyCode (quote);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': undefined,
                'price': undefined,
            };
            result.push ({
                'id': id,
                'info': market,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
            });
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'symbol': this.marketId (symbol),
        };
        if (limit !== undefined) {
            request['limit_bids'] = limit;
            request['limit_asks'] = limit;
        }
        const response = await this.publicGetBookSymbol (this.extend (request, params));
        return this.parseOrderBook (response, undefined, 'bids', 'asks', 'price', 'amount');
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['id'],
        };
        const ticker = await this.publicGetPubtickerSymbol (this.extend (request, params));
        const timestamp = this.safeInteger (ticker['volume'], 'timestamp');
        const baseVolume = this.safeFloat (market, 'base');
        const quoteVolume = this.safeFloat (market, 'quote');
        const last = this.safeFloat (ticker, 'last');
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': undefined,
            'low': undefined,
            'bid': this.safeFloat (ticker, 'bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat (ticker['volume'], baseVolume),
            'quoteVolume': this.safeFloat (ticker['volume'], quoteVolume),
            'info': ticker,
        };
    }

    parseTrade (trade, market = undefined) {
        const timestamp = this.safeInteger (trade, 'timestampms');
        const id = this.safeString (trade, 'tid');
        const orderId = this.safeString (trade, 'order_id');
        let fee = this.safeFloat (trade, 'fee_amount');
        if (fee !== undefined) {
            let currency = this.safeString (trade, 'fee_currency');
            if (currency !== undefined) {
                if (currency in this.currencies_by_id) {
                    currency = this.currencies_by_id[currency]['code'];
                }
                currency = this.commonCurrencyCode (currency);
            }
            fee = {
                'cost': this.safeFloat (trade, 'fee_amount'),
                'currency': currency,
            };
        }
        const price = this.safeFloat (trade, 'price');
        const amount = this.safeFloat (trade, 'amount');
        let cost = undefined;
        if (price !== undefined) {
            if (amount !== undefined) {
                cost = price * amount;
            }
        }
        const type = undefined;
        let side = this.safeString (trade, 'type');
        if (side !== undefined) {
            side = side.toLowerCase ();
        }
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        return {
            'id': id,
            'order': orderId,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': type,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'cost': cost,
            'amount': amount,
            'fee': fee,
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['id'],
        };
        const response = await this.publicGetTradesSymbol (this.extend (request, params));
        return this.parseTrades (response, market, since, limit);
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privatePostBalances (params);
        const result = { 'info': response };
        for (let i = 0; i < response.length; i++) {
            const balance = response[i];
            const currencyId = this.safeString (balance, 'currency');
            const code = this.commonCurrencyCode (currencyId);
            const account = this.account ();
            account['free'] = this.safeFloat (balance, 'available');
            account['total'] = this.safeFloat (balance, 'amount');
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    parseOrder (order, market = undefined) {
        const timestamp = this.safeInteger (order, 'timestampms');
        const amount = this.safeFloat (order, 'original_amount');
        const remaining = this.safeFloat (order, 'remaining_amount');
        const filled = this.safeFloat (order, 'executed_amount');
        let status = 'closed';
        if (order['is_live']) {
            status = 'open';
        }
        if (order['is_cancelled']) {
            status = 'canceled';
        }
        const price = this.safeFloat (order, 'price');
        const average = this.safeFloat (order, 'avg_execution_price');
        let cost = undefined;
        if (filled !== undefined) {
            if (average !== undefined) {
                cost = filled * average;
            }
        }
        let type = this.safeString (order, 'type');
        if (type === 'exchange limit') {
            type = 'limit';
        } else if (type === 'market buy' || type === 'market sell') {
            type = 'market';
        } else {
            type = order['type'];
        }
        const fee = undefined;
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString (order, 'symbol');
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            }
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const id = this.safeString (order, 'order_id');
        return {
            'id': id,
            'info': order,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': type,
            'side': order['side'].toLowerCase (),
            'price': price,
            'average': average,
            'cost': cost,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'fee': fee,
        };
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'order_id': id,
        };
        const response = await this.privatePostOrderStatus (this.extend (request, params));
        return this.parseOrder (response);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const response = await this.privatePostOrders (params);
        let orders = this.parseOrders (response, undefined, since, limit);
        if (symbol !== undefined) {
            const market = this.market (symbol); // throws on non-existent symbol
            orders = this.filterBySymbol (orders, market['symbol']);
        }
        return orders;
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        if (type === 'market') {
            throw new ExchangeError (this.id + ' allows limit orders only');
        }
        const nonce = this.nonce ();
        const request = {
            'client_order_id': nonce.toString (),
            'symbol': this.marketId (symbol),
            'amount': amount.toString (),
            'price': price.toString (),
            'side': side,
            'type': 'exchange limit', // gemini allows limit orders only
        };
        const response = await this.privatePostOrderNew (this.extend (request, params));
        return {
            'info': response,
            'id': response['order_id'],
        };
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'order_id': id,
        };
        return await this.privatePostOrderCancel (this.extend (request, params));
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchMyTrades requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['id'],
        };
        if (limit !== undefined) {
            request['limit_trades'] = limit;
        }
        if (since !== undefined) {
            request['timestamp'] = parseInt (since / 1000);
        }
        const response = await this.privatePostMytrades (this.extend (request, params));
        return this.parseTrades (response, market, since, limit);
    }

    async withdraw (code, amount, address, tag = undefined, params = {}) {
        this.checkAddress (address);
        await this.loadMarkets ();
        const currency = this.currency (code);
        const request = {
            'currency': currency['id'],
            'amount': amount,
            'address': address,
        };
        const response = await this.privatePostWithdrawCurrency (this.extend (request, params));
        return {
            'info': response,
            'id': this.safeString (response, 'txHash'),
        };
    }

    nonce () {
        return this.milliseconds ();
    }

    async fetchTransactions (code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        if (limit !== undefined) {
            request['limit_transfers'] = limit;
        }
        if (since !== undefined) {
            request['timestamp'] = since;
        }
        const response = await this.privatePostTransfers (this.extend (request, params));
        return this.parseTransactions (response);
    }

    parseTransaction (transaction, currency = undefined) {
        const timestamp = this.safeInteger (transaction, 'timestampms');
        let code = undefined;
        if (currency === undefined) {
            const currencyId = this.safeString (transaction, 'currency');
            if (currencyId in this.currencies_by_id) {
                currency = this.currencies_by_id[currencyId];
            }
        }
        if (currency !== undefined) {
            code = currency['code'];
        }
        const address = this.safeString (transaction, 'destination');
        let type = this.safeString (transaction, 'type');
        if (type !== undefined) {
            type = type.toLowerCase ();
        }
        let status = 'pending';
        // When deposits show as Advanced or Complete they are available for trading.
        if (transaction['status']) {
            status = 'ok';
        }
        let fee = undefined;
        const feeAmount = this.safeFloat (transaction, 'feeAmount');
        if (feeAmount !== undefined) {
            fee = {
                'cost': feeAmount,
                'currency': code,
            };
        }
        return {
            'info': transaction,
            'id': this.safeString (transaction, 'eid'),
            'txid': this.safeString (transaction, 'txHash'),
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'address': address,
            'tag': undefined, // or is it defined?
            'type': type, // direction of the transaction, ('deposit' | 'withdraw')
            'amount': this.safeFloat (transaction, 'amount'),
            'currency': code,
            'status': status,
            'updated': undefined,
            'fee': fee,
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = '/' + this.implodeParams (path, params);
        if (api !== 'web') {
            url = '/' + this.version + url;
        }
        const query = this.omit (params, this.extractParams (path));
        if (api === 'private') {
            this.checkRequiredCredentials ();
            const nonce = this.nonce ();
            const request = this.extend ({
                'request': url,
                'nonce': nonce,
            }, query);
            let payload = this.json (request);
            payload = this.stringToBase64 (this.encode (payload));
            const signature = this.hmac (payload, this.encode (this.secret), 'sha384');
            headers = {
                'Content-Type': 'text/plain',
                'X-GEMINI-APIKEY': this.apiKey,
                'X-GEMINI-PAYLOAD': this.decode (payload),
                'X-GEMINI-SIGNATURE': signature,
            };
        } else {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            }
        }
        url = this.urls['api'][api] + url;
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (httpCode, reason, url, method, headers, body, response) {
        if (response === undefined) {
            return; // fallback to default error handler
        }
        //
        //     {
        //         "result": "error",
        //         "reason": "BadNonce",
        //         "message": "Out-of-sequence nonce <1234> precedes previously used nonce <2345>"
        //     }
        //
        const result = this.safeString (response, 'result');
        if (result === 'error') {
            const reason = this.safeString (response, 'reason');
            const message = this.safeString (response, 'message');
            const feedback = this.id + ' ' + message;
            const exact = this.exceptions['exact'];
            if (reason in exact) {
                throw new exact[reason] (feedback);
            } else if (message in exact) {
                throw new exact[message] (feedback);
            }
            const broad = this.exceptions['broad'];
            const broadKey = this.findBroadlyMatchedKey (broad, message);
            if (broadKey !== undefined) {
                throw new broad[broadKey] (feedback);
            }
            throw new ExchangeError (feedback); // unknown message
        }
    }

    async createDepositAddress (code, params = {}) {
        await this.loadMarkets ();
        const currency = this.currency (code);
        const request = {
            'currency': currency['id'],
        };
        const response = await this.privatePostDepositCurrencyNewAddress (this.extend (request, params));
        const address = this.safeString (response, 'address');
        this.checkAddress (address);
        return {
            'currency': code,
            'address': address,
            'tag': undefined,
            'info': response,
        };
    }
};
