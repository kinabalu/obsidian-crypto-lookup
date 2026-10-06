import {requestUrl} from 'obsidian';

export const COINGECKO_API: string = 'https://api.coingecko.com/api/v3'
export const COINBASE_API: string = 'https://api.coinbase.com/v2'

export interface PriceQuote {
	base: string;
	target: string;
	price: number;
	volume?: number;
	changePercent?: number;
	timestamp: number;
	source: string;
}

/**
 * Returns the value when it is a finite number, otherwise undefined, so null or missing
 * fields from a price source are omitted rather than rendered as zero.
 */
function finiteOrUndefined(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Looks up the price of a base currency in a target currency, trying CoinGecko first
 * and falling back to Coinbase spot prices (price only) when CoinGecko fails or is rate limited.
 */
export async function fetchQuote(base: string, target: string, coinGeckoApiKey?: string): Promise<PriceQuote> {
	try {
		return await fetchCoinGeckoQuote(base, target, coinGeckoApiKey)
	} catch (coinGeckoError) {
		try {
			return await fetchCoinbaseQuote(base, target)
		} catch (coinbaseError) {
			console.error('Crypto Lookup: CoinGecko failed', coinGeckoError)
			console.error('Crypto Lookup: Coinbase failed', coinbaseError)
			throw coinGeckoError
		}
	}
}

/**
 * Fetches price, 24h volume and 24h percent change from CoinGecko by ticker symbol.
 * When several coins share a symbol, CoinGecko resolves to the one with the largest market cap.
 * A free CoinGecko Demo API key raises the rate limit but is not required.
 */
async function fetchCoinGeckoQuote(base: string, target: string, apiKey?: string): Promise<PriceQuote> {
	const symbol = base.toLowerCase()
	const vs = target.toLowerCase()
	const params = new URLSearchParams({
		symbols: symbol,
		vs_currencies: vs,
		include_24hr_vol: 'true',
		include_24hr_change: 'true',
		include_last_updated_at: 'true',
	})

	const response = await requestUrl({
		url: `${COINGECKO_API}/simple/price?${params.toString()}`,
		headers: apiKey ? {'x-cg-demo-api-key': apiKey} : {},
		throw: false,
	})

	if (response.status === 429) {
		throw new Error('CoinGecko rate limit reached, try again in a minute')
	}
	if (response.status !== 200) {
		throw new Error(`CoinGecko returned HTTP ${response.status}`)
	}

	const quote = response.json[symbol]
	if (!quote) {
		throw new Error(`Unknown currency ${base.toUpperCase()}`)
	}
	const price = finiteOrUndefined(quote[vs])
	if (price === undefined) {
		throw new Error(`No ${base.toUpperCase()} price available in ${target.toUpperCase()}`)
	}

	return {
		base,
		target,
		price,
		volume: finiteOrUndefined(quote[`${vs}_24h_vol`]),
		changePercent: finiteOrUndefined(quote[`${vs}_24h_change`]),
		timestamp: finiteOrUndefined(quote.last_updated_at) ?? Math.floor(Date.now() / 1000),
		source: 'CoinGecko',
	}
}

/**
 * Fetches the spot price from Coinbase. Coinbase spot has no volume or change data,
 * so the quote is stamped with the current time.
 */
async function fetchCoinbaseQuote(base: string, target: string): Promise<PriceQuote> {
	const pair = `${base.toUpperCase()}-${target.toUpperCase()}`
	const response = await requestUrl({
		url: `${COINBASE_API}/prices/${encodeURIComponent(pair)}/spot`,
		throw: false,
	})

	if (response.status !== 200) {
		throw new Error(`Coinbase returned HTTP ${response.status} for ${pair}`)
	}

	const price = finiteOrUndefined(parseFloat(response.json?.data?.amount))
	if (price === undefined) {
		throw new Error(`Coinbase returned no price for ${pair}`)
	}

	return {
		base,
		target,
		price,
		timestamp: Math.floor(Date.now() / 1000),
		source: 'Coinbase',
	}
}
