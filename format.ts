import {moment} from 'obsidian';
import {PriceQuote} from "./price-source";

/**
 * Formats a number with grouping and at most the given number of fraction digits,
 * always showing at least two.
 */
export function formatNumber(value: number, maxFractionDigits: number): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: Math.max(2, Math.min(20, maxFractionDigits)),
	}).format(value)
}

/**
 * Formats a price with two decimals, keeping about five significant digits for sub-unit prices
 * so low-priced coins and crypto-denominated pairs don't collapse to 0.00.
 */
export function formatPrice(price: number): string {
	const magnitude = Math.abs(price)
	if (magnitude === 0 || magnitude >= 1) {
		return formatNumber(price, 2)
	}
	return formatNumber(price, 4 - Math.floor(Math.log10(magnitude)))
}

/**
 * Formats a 24h percent change with an explicit sign.
 */
export function formatChange(changePercent: number): string {
	const sign = changePercent > 0 ? '+' : ''
	return `${sign}${formatNumber(changePercent, 2)}%`
}

/**
 * Formats a unix timestamp in seconds as local date and time.
 */
export function formatTimestamp(timestamp: number): string {
	return moment(timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * Renders a quote as note text, with volume, percent change and timestamp when extended.
 * Fields the price source did not provide are left out.
 */
export function formatQuote(quote: PriceQuote, extended: boolean): string {
	let text = `${quote.base}:${quote.target} price = ${formatPrice(quote.price)}`
	if (!extended) {
		return text
	}

	if (quote.volume !== undefined) {
		text += `, volume = ${formatNumber(quote.volume, 2)}`
	}
	if (quote.changePercent !== undefined) {
		text += `, change = ${formatNumber(quote.changePercent, 2)}%`
	}
	return text + ` on ${formatTimestamp(quote.timestamp)}`
}
