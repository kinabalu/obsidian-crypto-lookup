import {Editor, moment, Notice, Plugin} from 'obsidian';

import {CryptoModal} from './crypto-modal'
import {CryptoLookupSettingTab} from "./settings";
import {fetchQuote, PriceQuote} from "./price-source";

export interface CryptoLookupSettings {
	defaultBase: string;
	defaultTarget: string;
	coinGeckoApiKey: string;
}

const DEFAULT_SETTINGS: CryptoLookupSettings = {
	defaultBase: 'BTC',
	defaultTarget: 'USD',
	coinGeckoApiKey: '',
}

/**
 * Formats a number with grouping and at most the given number of fraction digits,
 * always showing at least two.
 */
function formatNumber(value: number, maxFractionDigits: number): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: Math.max(2, Math.min(20, maxFractionDigits)),
	}).format(value)
}

/**
 * Formats a price with two decimals, keeping about five significant digits for sub-unit prices
 * so low-priced coins and crypto-denominated pairs don't collapse to 0.00.
 */
function formatPrice(price: number): string {
	const magnitude = Math.abs(price)
	if (magnitude === 0 || magnitude >= 1) {
		return formatNumber(price, 2)
	}
	return formatNumber(price, 4 - Math.floor(Math.log10(magnitude)))
}

/**
 * Renders a quote as note text, with volume, percent change and timestamp when extended.
 * Fields the price source did not provide are left out.
 */
function formatQuote(quote: PriceQuote, extended: boolean): string {
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
	return text + ` on ${moment(quote.timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')}`
}

export default class CryptoLookup extends Plugin {
	settings: CryptoLookupSettings;

	/**
	 * Fetches a quote and inserts it at the cursor, showing a notice instead when the lookup fails.
	 */
	async insertQuote(editor: Editor, base: string, target: string, extended: boolean) {
		if (!base || !target) {
			new Notice('Both a base and a target currency are required')
			return
		}

		try {
			const quote = await fetchQuote(base.trim(), target.trim(), this.settings.coinGeckoApiKey)
			editor.replaceSelection(formatQuote(quote, extended))
		} catch (error) {
			console.error(error)
			new Notice(`Crypto lookup failed: ${error instanceof Error ? error.message : error}`)
		}
	}

	/**
	 * Registers a command that inserts a quote for the default currencies from settings.
	 */
	addDefaultTickerCommand(id: string, name: string, extended: boolean) {
		this.addCommand({
			id,
			name,
			editorCallback: (editor: Editor) => {
				if (!this.settings.defaultBase || !this.settings.defaultTarget) {
					new Notice("Cannot use this command without default base and target in settings")
					return
				}
				void this.insertQuote(editor, this.settings.defaultBase, this.settings.defaultTarget, extended)
			}
		});
	}

	/**
	 * Registers a command that prompts for the currencies in a modal and inserts a quote.
	 */
	addSelectedTickerCommand(id: string, name: string, extended: boolean) {
		this.addCommand({
			id,
			name,
			editorCallback: (editor: Editor) => {
				new CryptoModal(this.app, this.settings.defaultTarget, (base, target) => {
					void this.insertQuote(editor, base, target, extended)
				}).open()
			}
		});
	}

	async onload() {
		await this.loadSettings()

		this.addDefaultTickerCommand('insert-default-crypto-ticker', 'Insert Default Crypto Ticker', false)
		this.addDefaultTickerCommand('insert-default-crypto-ticker-extended', 'Insert Default Crypto Ticker Extended', true)
		this.addSelectedTickerCommand('insert-selected-crypto-ticker', 'Insert Selected Crypto Ticker', false)
		this.addSelectedTickerCommand('insert-selected-crypto-ticker-extended', 'Insert Selected Crypto Ticker Extended', true)

		this.addSettingTab(new CryptoLookupSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
