import {Editor, Notice, Plugin} from 'obsidian';

import {CryptoModal} from './crypto-modal'
import {CryptoLookupSettingTab} from "./settings";
import {CurrencyPair, PriceQuote, QuoteResult} from "./price-source";
import {PriceService} from "./price-service";
import {CODE_BLOCK_LANGUAGE, CryptoBlock, parseBlock} from "./crypto-block";
import {formatQuote} from "./format";

export interface CryptoLookupSettings {
	defaultBase: string;
	defaultTarget: string;
	coinGeckoApiKey: string;
	refreshMinutes: number;
}

const DEFAULT_SETTINGS: CryptoLookupSettings = {
	defaultBase: 'BTC',
	defaultTarget: 'USD',
	coinGeckoApiKey: '',
	refreshMinutes: 5,
}

export interface CryptoLookupApi {
	getPrice(base: string, target?: string): Promise<number>;
	getQuote(base: string, target?: string): Promise<PriceQuote>;
	getQuotes(pairs: CurrencyPair[]): Promise<QuoteResult[]>;
}

export default class CryptoLookup extends Plugin {
	settings: CryptoLookupSettings;
	prices: PriceService;
	api: CryptoLookupApi;

	/**
	 * Fetches a quote and inserts it at the cursor, showing a notice instead when the lookup fails.
	 */
	async insertQuote(editor: Editor, base: string, target: string, extended: boolean) {
		if (!base || !target) {
			new Notice('Both a base and a target currency are required')
			return
		}

		try {
			const quote = await this.prices.getQuote(base, target)
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

	/**
	 * Builds the public API other plugins and DataviewJS scripts reach through
	 * app.plugins.plugins["obsidian-crypto-lookup"].api. A missing target uses the default target.
	 */
	buildApi(): CryptoLookupApi {
		return {
			getPrice: async (base, target) => (await this.prices.getQuote(base, target ?? this.settings.defaultTarget)).price,
			getQuote: (base, target) => this.prices.getQuote(base, target ?? this.settings.defaultTarget),
			getQuotes: (pairs) => this.prices.getQuotes(pairs),
		}
	}

	async onload() {
		await this.loadSettings()

		this.prices = new PriceService(() => this.settings.coinGeckoApiKey)
		this.api = this.buildApi()

		this.addDefaultTickerCommand('insert-default-crypto-ticker', 'Insert Default Crypto Ticker', false)
		this.addDefaultTickerCommand('insert-default-crypto-ticker-extended', 'Insert Default Crypto Ticker Extended', true)
		this.addSelectedTickerCommand('insert-selected-crypto-ticker', 'Insert Selected Crypto Ticker', false)
		this.addSelectedTickerCommand('insert-selected-crypto-ticker-extended', 'Insert Selected Crypto Ticker Extended', true)

		this.registerMarkdownCodeBlockProcessor(CODE_BLOCK_LANGUAGE, (source, el, ctx) => {
			const block = parseBlock(source, this.settings.defaultTarget)
			ctx.addChild(new CryptoBlock(el, block, this.prices, this.settings.refreshMinutes))
		})

		this.addSettingTab(new CryptoLookupSettingTab(this.app, this));
	}

	onunload() {
		this.prices?.clear()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
