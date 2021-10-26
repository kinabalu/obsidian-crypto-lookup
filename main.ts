import {App, Editor, Notice, Plugin, PluginSettingTab, Setting, request, normalizePath, moment} from 'obsidian';
import numeral from 'numeral'

import { CryptoModal } from './crypto-modal'

export const CRYPTONATOR_API : string = 'https://api.cryptonator.com/api'

interface CryptoLookupSettings {
	defaultBase: string;
	defaultTarget: string;
}

interface CurrencyResult {
	ticker: CurrencyTicker;
	timestamp: number;
	success: boolean;
	error: string;
}

interface CurrencyTicker {
	base: string;
	target: string;
	price: number;
	volume: number;
	change: number;
}

interface CurrencyEntry {
	code: string;
	name: string;
	statuses: string[]
}

const DEFAULT_SETTINGS: CryptoLookupSettings = {
	defaultBase: 'BTC',
	defaultTarget: 'USD'
}

export default class CryptoLookup extends Plugin {
	settings: CryptoLookupSettings;

	currencies: CurrencyEntry[];

	async getCurrencyTicker(base: string, target: string) : Promise<CurrencyResult> {
		const data = await request({
			url: `${CRYPTONATOR_API}/ticker/${base}-${target}`
		})

		return JSON.parse(data) as CurrencyResult
	}

	async getCurrencyListAsJson() : Promise<string> {
		return await request({
			url: `${CRYPTONATOR_API}/currencies`
		})
	}

	async preloadCurrencies() {
		const adapter = this.app.vault.adapter;
		const dir = this.manifest.dir;
		const path = normalizePath(`${dir}/currencies.json`)
		let currencyText : string;

		if (await adapter.exists(path)) {
			currencyText = await adapter.read(path)
		} else {
			currencyText = await this.getCurrencyListAsJson()

			try {
				await adapter.write(path, currencyText)
			} catch(error) {
				new Notice('The currencies file could not be cached.');
				console.error(error)
			}
		}

		this.currencies = JSON.parse(currencyText).rows as CurrencyEntry[]
	}

	async onload() {
		await Promise.all([this.loadSettings(), this.preloadCurrencies()])
		// await Promise.all([this.loadSettings()])

		this.addCommand({
			id: 'insert-default-crypto-ticker',
			name: 'Insert Default Crypto Ticker',
			editorCallback: async (editor: Editor) => {
				if (!this.settings.defaultBase || !this.settings.defaultTarget) {
					new Notice("Cannot use this command without default base and target in settings")
				} else {
					const base = this.settings.defaultBase
					const target = this.settings.defaultTarget

					const currencyTicker = await this.getCurrencyTicker(base.toLocaleLowerCase(), target.toLocaleLowerCase())

					const extendedCryptoTicker: string = `${base}:${target} price = ${numeral(currencyTicker.ticker.price).format('0,00.00')}`
					editor.replaceSelection(extendedCryptoTicker)
				}
			}
		});

		this.addCommand({
			id: 'insert-default-crypto-ticker-extended',
			name: 'Insert Default Crypto Ticker Extended',
			editorCallback: async (editor: Editor) => {
				if (!this.settings.defaultBase || !this.settings.defaultTarget) {
					new Notice("Cannot use this command without default base and target in settings")
				} else {
					const base = this.settings.defaultBase
					const target = this.settings.defaultTarget

					const currencyTicker = await this.getCurrencyTicker(base.toLocaleLowerCase(), target.toLocaleLowerCase())

					const formattedTimestamp: string = moment(currencyTicker.timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')
					const extendedCryptoTicker: string = `${base}:${target} price = ${numeral(currencyTicker.ticker.price).format('0,00.00')}, volume = ${numeral(currencyTicker.ticker.volume).format('0,00.00')}, change = ${numeral(currencyTicker.ticker.change).format('0,00.00')} on ${formattedTimestamp}`
					editor.replaceSelection(extendedCryptoTicker)
				}
			}
		});

		this.addCommand({
			id: 'insert-selected-crypto-ticker',
			name: 'Insert Selected Crypto Ticker',
			editorCallback: async (editor: Editor) => {
				const onSubmit = async (base: string, target: string) => {
					const currencyTicker = await this.getCurrencyTicker(base.toLocaleLowerCase(), target.toLocaleLowerCase())

					const extendedCryptoTicker: string = `${base}:${target} price = ${numeral(currencyTicker.ticker.price).format('0,00.00')}`
					editor.replaceSelection(extendedCryptoTicker)
				}
				new CryptoModal(this.app, "USD", onSubmit).open()
			}
		});

		this.addCommand({
			id: 'insert-selected-crypto-ticker-extended',
			name: 'Insert Selected Crypto Ticker Extended',
			editorCallback: async (editor: Editor) => {
				const onSubmit = async (base: string, target: string) => {
					const currencyTicker = await this.getCurrencyTicker(base.toLocaleLowerCase(), target.toLocaleLowerCase())

					const formattedTimestamp: string = moment(currencyTicker.timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')
					const extendedCryptoTicker: string = `${base}:${target} price = ${numeral(currencyTicker.ticker.price).format('0,00.00')}, volume = ${numeral(currencyTicker.ticker.volume).format('0,00.00')}, change = ${numeral(currencyTicker.ticker.change).format('0,00.00')} on ${formattedTimestamp}`
					editor.replaceSelection(extendedCryptoTicker)
				}
				new CryptoModal(this.app, "USD", onSubmit).open()
			}
		});

		this.addSettingTab(new CryptoLookupSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CryptoLookupSettingTab extends PluginSettingTab {
	plugin: CryptoLookup;

	constructor(app: App, plugin: CryptoLookup) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Crypto Lookup Defaults'});

		new Setting(containerEl)
			.setName('Base Currency')
			.setDesc('Default currency we want the price of')
			.addText(text => text
				.setPlaceholder('BTC')
				.setValue(this.plugin.settings.defaultBase)
				.onChange(async (value) => {
					this.plugin.settings.defaultBase = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target Currency')
			.setDesc('Default target currency to convert base currency into')
			.addText(text => text
				.setPlaceholder('USD')
				.setValue(this.plugin.settings.defaultTarget)
				.onChange(async (value) => {
					this.plugin.settings.defaultTarget = value;
					await this.plugin.saveSettings();
				}));
	}
}
