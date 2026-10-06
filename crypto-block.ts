import {MarkdownRenderChild, moment} from "obsidian";
import {CurrencyPair, QuoteResult} from "./price-source";
import {PriceService} from "./price-service";
import {formatChange, formatPrice} from "./format";

export const CODE_BLOCK_LANGUAGE = 'crypto'

export interface ParsedBlock {
	pairs: CurrencyPair[];
	invalidLines: string[];
}

/**
 * Parses a crypto code block, one pair per line as "BASE TARGET", "BASE/TARGET", "BASE:TARGET"
 * or "BASE-TARGET". A line with only a base uses the default target. Blank lines are skipped
 * and anything else is reported as invalid.
 */
export function parseBlock(source: string, defaultTarget: string): ParsedBlock {
	const pairs: CurrencyPair[] = []
	const invalidLines: string[] = []

	for (const rawLine of source.split('\n')) {
		const line = rawLine.trim()
		if (!line) {
			continue
		}

		const tokens = line.split(/[\s/:-]+/).filter(Boolean)
		const valid = tokens.length >= 1 && tokens.length <= 2 && tokens.every(token => /^[A-Za-z0-9.]+$/.test(token))
		if (!valid || (tokens.length === 1 && !defaultTarget)) {
			invalidLines.push(line)
			continue
		}

		pairs.push({base: tokens[0].toUpperCase(), target: (tokens[1] ?? defaultTarget).toUpperCase()})
	}

	return {pairs, invalidLines}
}

/**
 * Renders a live price table for a crypto code block and refreshes it on an interval
 * for as long as the block stays rendered.
 */
export class CryptoBlock extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private block: ParsedBlock,
		private prices: PriceService,
		private refreshMinutes: number,
	) {
		super(containerEl);
	}

	onload() {
		this.containerEl.addClass('crypto-lookup-block')
		this.containerEl.createDiv({cls: 'crypto-lookup-status', text: 'Loading prices...'})
		void this.refresh()

		if (this.refreshMinutes > 0 && this.block.pairs.length > 0) {
			this.registerInterval(window.setInterval(() => { void this.refresh() }, this.refreshMinutes * 60 * 1000))
		}
	}

	/**
	 * Fetches current quotes for the block's pairs and redraws the table.
	 */
	async refresh() {
		const results = await this.prices.getQuotes(this.block.pairs)
		this.render(results)
	}

	/**
	 * Draws one row per pair, error rows for pairs that could not be priced or parsed,
	 * and a footer with the quote time and data sources.
	 */
	private render(results: QuoteResult[]) {
		const el = this.containerEl
		el.empty()

		const table = el.createEl('table', {cls: 'crypto-lookup-table'})
		const header = table.createEl('thead').createEl('tr')
		for (const label of ['Pair', 'Price', '24h']) {
			header.createEl('th', {text: label})
		}

		const body = table.createEl('tbody')
		for (const result of results) {
			const row = body.createEl('tr')
			row.createEl('td', {text: `${result.pair.base}/${result.pair.target}`})

			if (!result.quote) {
				row.addClass('crypto-lookup-error')
				row.createEl('td', {text: result.error ?? 'Lookup failed', attr: {colspan: '2'}})
				continue
			}

			row.createEl('td', {cls: 'crypto-lookup-price', text: formatPrice(result.quote.price)})
			const change = result.quote.changePercent
			const changeCell = row.createEl('td', {cls: 'crypto-lookup-change', text: change === undefined ? '' : formatChange(change)})
			if (change !== undefined) {
				changeCell.addClass(change < 0 ? 'is-negative' : 'is-positive')
			}
		}

		for (const line of this.block.invalidLines) {
			const row = body.createEl('tr', {cls: 'crypto-lookup-error'})
			row.createEl('td', {text: line})
			row.createEl('td', {text: 'Expected "BASE TARGET", e.g. "BTC USD"', attr: {colspan: '2'}})
		}

		const quotes = results.flatMap(result => result.quote ? [result.quote] : [])
		if (quotes.length > 0) {
			const latest = Math.max(...quotes.map(quote => quote.timestamp))
			const sources = [...new Set(quotes.map(quote => quote.source))].join(', ')
			el.createDiv({
				cls: 'crypto-lookup-footer',
				text: `As of ${moment(latest * 1000).format('YYYY-MM-DD HH:mm')} · Data from ${sources}`,
			})
		}
	}
}
