import {CurrencyPair, fetchQuotes, normalizePair, pairKey, PriceQuote, QuoteResult} from "./price-source";

const CACHE_TTL_MS = 60 * 1000
const BATCH_WINDOW_MS = 50

interface PendingLookup {
	pair: CurrencyPair;
	resolvers: ((result: QuoteResult) => void)[];
}

/**
 * Serves quotes from a short-lived cache and coalesces lookups made within a brief window
 * into one batched request, so many code blocks rendering at once cost a single API call.
 */
export class PriceService {
	private cache = new Map<string, {result: QuoteResult; expires: number}>()
	private pending = new Map<string, PendingLookup>()
	private flushTimer: number | null = null

	constructor(private getApiKey: () => string) {
	}

	/**
	 * Resolves a quote result for each pair, in order. Never rejects; failed pairs carry an error.
	 */
	getQuotes(pairs: CurrencyPair[]): Promise<QuoteResult[]> {
		return Promise.all(pairs.map(pair => this.getResult(normalizePair(pair))))
	}

	/**
	 * Resolves the quote for one pair, rejecting with the lookup error when it cannot be priced.
	 */
	async getQuote(base: string, target: string): Promise<PriceQuote> {
		const [result] = await this.getQuotes([{base, target}])
		if (!result.quote) {
			throw new Error(result.error)
		}
		return result.quote
	}

	/**
	 * Drops cached results and cancels any scheduled batch, used when the plugin unloads.
	 */
	clear() {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer)
			this.flushTimer = null
		}
		this.cache.clear()
		this.pending.clear()
	}

	/**
	 * Returns a fresh cached result or queues the pair for the next batched request.
	 */
	private getResult(pair: CurrencyPair): Promise<QuoteResult> {
		const key = pairKey(pair)
		const cached = this.cache.get(key)
		if (cached && cached.expires > Date.now()) {
			return Promise.resolve(cached.result)
		}

		return new Promise(resolve => {
			const lookup = this.pending.get(key) ?? {pair, resolvers: []}
			lookup.resolvers.push(resolve)
			this.pending.set(key, lookup)

			if (this.flushTimer === null) {
				this.flushTimer = window.setTimeout(() => { void this.flush() }, BATCH_WINDOW_MS)
			}
		})
	}

	/**
	 * Sends every queued pair in one request and settles all callers waiting on them.
	 */
	private async flush() {
		this.flushTimer = null
		const batch = [...this.pending.values()]
		this.pending.clear()

		const results = await fetchQuotes(batch.map(lookup => lookup.pair), this.getApiKey())
		const expires = Date.now() + CACHE_TTL_MS
		results.forEach((result, index) => {
			this.cache.set(pairKey(result.pair), {result, expires})
			batch[index].resolvers.forEach(resolve => resolve(result))
		})
	}
}
