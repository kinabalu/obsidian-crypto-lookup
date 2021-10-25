import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, request } from 'obsidian';
import type moment from "moment"
import numeral from 'numeral'

import { CryptoModal } from './crypto-modal'

declare global {
	interface Window {
		moment: typeof moment;
	}
}

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

interface CurrencyEntries {
	rows: CurrencyEntry[]
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

	async getCurrencyTicker(base: string, target: string) : Promise<CurrencyResult> {
		const data = await request({
			url: `${CRYPTONATOR_API}/ticker/${base}-${target}`
		})

		return JSON.parse(data) as CurrencyResult
	}

	async getCurrencyList() : Promise<CurrencyEntries> {
		const data = await request({
			url: `${CRYPTONATOR_API}/currencies`
		})

		return JSON.parse(data) as CurrencyEntries
	}

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'insert-default-crypto-ticker',
			name: 'Insert Default Crypto Ticker',
			editorCallback: async (editor: Editor) => {
				if (!this.settings.defaultBase || !this.settings.defaultTarget) {
					new ErrorNoticeModal(this.app).open()
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
					new ErrorNoticeModal(this.app).open()
				} else {
					const base = this.settings.defaultBase
					const target = this.settings.defaultTarget

					const currencyTicker = await this.getCurrencyTicker(base.toLocaleLowerCase(), target.toLocaleLowerCase())

					const formattedTimestamp: string = window.moment(currencyTicker.timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')
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

					const formattedTimestamp: string = window.moment(currencyTicker.timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')
					const extendedCryptoTicker: string = `${base}:${target} price = ${numeral(currencyTicker.ticker.price).format('0,00.00')}, volume = ${numeral(currencyTicker.ticker.volume).format('0,00.00')}, change = ${numeral(currencyTicker.ticker.change).format('0,00.00')} on ${formattedTimestamp}`
					editor.replaceSelection(extendedCryptoTicker)
				}
				new CryptoModal(this.app, "USD", onSubmit).open()
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CryptoLookupSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ErrorNoticeModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Cannot use this command without default base and target in settings');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
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
