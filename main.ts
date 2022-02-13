import {App, Editor, Notice, Plugin, PluginSettingTab, Setting, request, normalizePath, moment} from 'obsidian';
import numeral from 'numeral'

import { CryptoModal } from './crypto-modal'

//code block processor
import { cryptoProcessor } from "./processors/cryptoProcessor";
import { Console } from 'console';

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
	
	async getCurrencies(url : string) : Promise<CurrencyResult> {
		
		//DEBUG
		console.log(``);
		//
		

		try{
		const data = await request({
			url: url
		});

		//DEBUG
		console.log(data);
		//
		
		
		return JSON.parse(data)

	}catch(e){
		console.log(e);
	}	
		
	}
	
	async getCurrencyListAsJson() : Promise<string> {
		return await request({
			url: `${CRYPTONATOR_API}/currencies`
		})
	}
	
	// async preloadCurrencies() {
	// 	const adapter = this.app.vault.adapter;
	// 	const dir = this.manifest.dir;
	// 	const path = normalizePath(`${dir}/currencies.json`)
	// 	let currencyText : string;
	//
	// 	if (await adapter.exists(path)) {
	// 		currencyText = await adapter.read(path)
	// 	} else {
	// 		currencyText = await this.getCurrencyListAsJson()
	//
	// 		try {
	// 			await adapter.write(path, currencyText)
	// 		} catch(error) {
	// 			new Notice('The currencies file could not be cached.');
	// 			console.error(error)
	// 		}
	// 	}
	//
	// 	this.currencies = JSON.parse(currencyText).rows as CurrencyEntry[]
	// }
	
	
	
	
	async onload() {
		await this.loadSettings()
		
		/*
		Requests were returning the Cloudfare DDOS protection html instead of JSON (the "wait 5 seconds" screen) 
		I think they may have just recently added Cloudfare protection to the API because I never encountered this error before.
		*/
		//bypass cloudfare ddos protection -
		
		
		
		//code block processor
		this.registerMarkdownCodeBlockProcessor("crypto", async (source, el, ctx) => {
			/*
			source 	= 	text inside block (edit mode)
			el 	 	= 	div to render into (preview mode) */
			
			
			const sourceCoins = source.split("\n").filter((row) => row.length > 0);
			
			//notify user while awaiting results:
			let loadingNotify = el.createEl("span");
			loadingNotify.innerHTML = "Loading cryptocurrencies..."
			
			
			let blockSource = source;
			
			//check if any invalid characters present
			if(blockSource.includes(',')  ||  blockSource.includes('&')  ||  blockSource.includes('?')  ||  blockSource.includes('.')) {
				console.log('error - invalid characters present');
				//throw "error - invalid character present"
			}
			
			//format coin symbols to fit as URL parameter (new lines delimit):
			blockSource = blockSource.trim();
			blockSource = blockSource.replace(' ', '');
			blockSource = blockSource.replace('\n', ',');
			blockSource = blockSource.replace('\n', ',');
			blockSource = blockSource.replace('\n', ',');
			blockSource = blockSource.toUpperCase();
			
			
	
	
	
	//build URL with the formatted code block contents
	let requestUrl = "http://api.nomics.com/v1/currencies/ticker?key=5b7619f704e9f1280cfae0c98813f56e831ee27a&ids=" +
	blockSource +
	"&per-page=100&page=1";
	
	console.log('url: ' + requestUrl);

	let coins = await this.getCurrencies(requestUrl);

	console.log(coins.toString());
	



	//draw results to UI:
	const table = el.createEl("table");
	const body = table.createEl("tbody");
	
	for (let i = 0; i < sourceCoins.length; i++) {
		const cols = sourceCoins[i].split(",");
		
		const row = body.createEl("tr");
		
		for (let j = 0; j < cols.length; j++) {
			row.createEl("td", { text: cols[j] });
		}
	}
	
});


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
		