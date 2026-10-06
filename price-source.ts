import {requestUrl} from 'obsidian';

export const COINGECKO_API: string = 'https://api.coingecko.com/api/v3'
export const COINBASE_API: string = 'https://api.coinbase.com/v2'

export interface CurrencyPair {
	base: string;
	target: string;
}

export interface PriceQuote {
	base: string;
	target: string;
	price: number;
	volume?: number;
	changePercent?: number;
	timestamp: number;
	source: string;
}

export interface QuoteResult {
	pair: CurrencyPair;
	quote?: PriceQuote;
	error?: string;
}

/**
 * Returns the value when it is a finite number, otherwise undefined, so null or missing
 * fields from a price source are omitted rather than rendered as zero.
 */
function finiteOrUndefined(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Normalizes a pair to trimmed upper-case symbols so lookups and cache keys are consistent.
 */
export function normalizePair(pair: CurrencyPair): CurrencyPair {
	return {base: pair.base.trim().toUpperCase(), target: pair.target.trim().toUpperCase()}
}

/**
 * Looks up the price of a base currency in a target currency, trying CoinGecko first
 * and falling back to Coinbase spot prices (price only) when CoinGecko fails or is rate limited.
 */
export async function fetchQuote(base: string, target: string, coinGeckoApiKey?: string): Promise<PriceQuote> {
	const [result] = await fetchQuotes([{base, target}], coinGeckoApiKey)
	if (!result.quote) {
		throw new Error(result.error)
	}
	return result.quote
}

/**
 * Looks up many pairs with a single CoinGecko request, then falls back to Coinbase for each
 * pair CoinGecko could not price. Never rejects; failed pairs carry an error message instead.
 */
export async function fetchQuotes(pairs: CurrencyPair[], coinGeckoApiKey?: string): Promise<QuoteResult[]> {
	const normalized = pairs.map(normalizePair)
	let coinGecko: Map<string, PriceQuote> = new Map()
	let coinGeckoError: string | undefined

	try {
		coinGecko = await fetchCoinGeckoQuotes(normalized, coinGeckoApiKey)
	} catch (error) {
		coinGeckoError = error instanceof Error ? error.message : String(error)
		console.error('Crypto Lookup: CoinGecko failed', error)
	}

	return Promise.all(normalized.map(async (pair): Promise<QuoteResult> => {
		const quote = coinGecko.get(pairKey(pair))
		if (quote) {
			return {pair, quote}
		}

		try {
			return {pair, quote: await fetchCoinbaseQuote(pair.base, pair.target)}
		} catch (coinbaseError) {
			console.error('Crypto Lookup: Coinbase failed', coinbaseError)
			return {pair, error: coinGeckoError ?? `No ${pair.base} price available in ${pair.target}`}
		}
	}))
}

/**
 * Builds the cache and lookup key for a normalized pair.
 */
export function pairKey(pair: CurrencyPair): string {
	return `${pair.base}-${pair.target}`
}

/**
 * Fetches price, 24h volume and 24h percent change from CoinGecko for every base and target
 * symbol in one request, returning quotes keyed by pair. When several coins share a symbol,
 * CoinGecko resolves to the one with the largest market cap. A free CoinGecko Demo API key
 * raises the rate limit but is not required.
 */
async function fetchCoinGeckoQuotes(pairs: CurrencyPair[], apiKey?: string): Promise<Map<string, PriceQuote>> {
	const symbols = [...new Set(pairs.map(pair => pair.base.toLowerCase()))]
	const targets = [...new Set(pairs.map(pair => pair.target.toLowerCase()))]
	const params = new URLSearchParams({
		symbols: symbols.join(','),
		vs_currencies: targets.join(','),
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

	const quotes = new Map<string, PriceQuote>()
	for (const pair of pairs) {
		const symbol = pair.base.toLowerCase()
		const vs = pair.target.toLowerCase()
		const data = response.json?.[symbol]
		const price = finiteOrUndefined(data?.[vs])
		if (price === undefined) {
			continue
		}

		quotes.set(pairKey(pair), {
			base: pair.base,
			target: pair.target,
			price,
			volume: finiteOrUndefined(data[`${vs}_24h_vol`]),
			changePercent: finiteOrUndefined(data[`${vs}_24h_change`]),
			timestamp: finiteOrUndefined(data.last_updated_at) ?? Math.floor(Date.now() / 1000),
			source: 'CoinGecko',
		})
	}
	return quotes
}

/**
 * Fetches the spot price from Coinbase. Coinbase spot has no volume or change data,
 * so the quote is stamped with the current time.
 */
async function fetchCoinbaseQuote(base: string, target: string): Promise<PriceQuote> {
	const pair = `${base}-${target}`
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
