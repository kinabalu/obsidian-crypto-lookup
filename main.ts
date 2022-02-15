import {App, Editor, Notice, Plugin, PluginSettingTab, Setting, request, normalizePath, moment} from 'obsidian';
import numeral from 'numeral'

import { CryptoModal } from './crypto-modal'

//code block processor

import { Console } from 'console';

export const CRYPTONATOR_API : string = 'https://api.cryptonator.com/api'

const apiKey = "5b7619f704e9f1280cfae0c98813f56e831ee27a";
//let userApiKey = ""; //let user set their own api key

interface CryptoLookupSettings {
defaultBase: string;
defaultTarget: string;
}

interface Coin {

id: string;
symbol: string;
name: string;
logo_url: string;
price: string;
market_cap: string; 
market_cap_dominance: string;
rank: string;
high: string;
high_timestamp: string; 
"1d": CoinTimeframe;
"7d": CoinTimeframe;
"30d": CoinTimeframe;
"365d": CoinTimeframe;
}

interface CoinTimeframe {

volume: string;
price_change: string;
price_change_pct: string;
volume_change: string;
volume_change_pct: string;
market_cap_change: string;
market_cap_change_pct: string;

}

const DEFAULT_SETTINGS: CryptoLookupSettings = {
defaultBase: 'BTC',
defaultTarget: 'USD'
}

export default class CryptoLookup extends Plugin {
settings: CryptoLookupSettings;

getChangeColorClass(chgPct :any) {
if(chgPct >= 0) {
	return 'posChange'
}else {
	return 'negChange'
}
}

formatCurrency(inp :any) {
	let split = inp.split('.');
	let strOut = '$' + split[0] + '.' + split[1].slice(0,2);
	return strOut;
}

formatPctChange(inp :any) {
	
	let chgPct= inp * 100;

	let split = chgPct.toString().split('.');
	let strOut = split[0] + '.' + split[1].slice(0,1) + '%'; 
	return strOut;
}

drawCoinRow(table :HTMLElement, tbody :any, coin :Coin) {


//DEBUG output
//console.log('\ntest sample:\n' + coin.name + '\n' +  coin.price + '\n' + coin['1d'].volume);
//


//format ticker data:




//add row
const row = tbody.createEl("tr");

//add cells:
row.createEl("td", { text: coin.name });
row.createEl("td", { text: coin.rank });
row.createEl("td", { text: this.formatCurrency(coin.price) });
row.createEl("td", { text: this.formatPctChange(coin['1d'].price_change_pct), cls: this.getChangeColorClass(coin['1d'].price_change_pct) });
row.createEl("td", { text: this.formatPctChange(coin['7d'].price_change_pct), cls: this.getChangeColorClass(coin['7d'].price_change_pct) });
row.createEl("td", { text: this.formatPctChange(coin['30d'].price_change_pct), cls: this.getChangeColorClass(coin['30d'].price_change_pct) });
row.createEl("td", { text: this.formatPctChange(coin['365d'].price_change_pct), cls: this.getChangeColorClass(coin['365d'].price_change_pct) });


}




async getCurrencies(url : string) : Promise<Coin[]> {

//debug output
//console.log('requesting now')

try{
	const data = await request( {
		url: url
	});
	 
	//DEBUG output
	//console.log('response data: ' + data);
	//
	
	
	let out = JSON.parse(data);
	//console.log('parsed data: ' + out.toString())

	return out;
	
	
}catch(e){
	console.log('ERROR - ' + e);
	

	
}//end getCurrencies()



}//end draw row function





async onload() {
	
	

	//code block processor
	this.registerMarkdownCodeBlockProcessor("crypto", async (source, el, ctx) => {
		/* parameters:
		source 	= 	text inside block (edit mode)
		el 	 	= 	div to render into (preview mode) */
		
		try {
		
		const sourceCoins = source.split("\n").filter((row) => row.length > 0);
		
		//placeholder while awaiting results:
		let loadingNotify = el.createEl("span");
		loadingNotify.innerHTML = "Loading cryptocurrencies..."
		
		//source codeblock text (edit mode)
		let blockSource = source;
		
		//check if invalid characters present
		if(blockSource.includes(',')  ||  blockSource.includes('&')  ||  blockSource.includes('?')  ||  blockSource.includes('.')) {
			console.log('error - invalid characters present');
			//throw "error - invalid character present"
		}
		
		//format coin symbols to fit as URL parameter (new lines delimit):
		blockSource = blockSource.trim();

		while (blockSource.contains(' ')) {
		blockSource = blockSource.replace(' ', '');
		}

		while (blockSource.contains('\n')) {
			blockSource = blockSource.replace('\n', ',');
		}
			
		blockSource = blockSource.toUpperCase();
		
		
		
			/*
	example endpoint url:
	http://api.nomics.com/v1/currencies/ticker?key=5b7619f704e9f1280cfae0c98813f56e831ee27a&ids=BTC,ETH,LTC&per-page=100&page=1
			*/

		//build URL with the formatted block source
		let requestUrl = "https://api.nomics.com/v1/currencies/ticker?key=" + apiKey + 
		"&ids=" +
		blockSource +
		"&per-page=100&page=1";
		
		//console.log('url: ' + requestUrl);
		
		//
		//make request
		let coins = await this.getCurrencies(requestUrl)
		
		
		
		//DEBUG output:
		//console.log('\ncoins: \n' + coins.toString()); 
		//console.log('\nlength:\n' + coins.length)
		//
		
		
		// 
		//draw results to UI:
		
		//init table:
		const table = el.createEl("table");
		const tbody = table.createEl("tbody");
		
		//table header row:
		const headerRow = tbody.createEl("tr");
		headerRow.createEl("th", { text: "" });
		headerRow.createEl("th", { text: "rank" });
		headerRow.createEl("th", { text: "price" });
		headerRow.createEl("th", { text: "1d %" });
		headerRow.createEl("th", { text: "7d %" });
		headerRow.createEl("th", { text: "1m %" });
		headerRow.createEl("th", { text: "1y %" });
		
		//draw table row for each coin
		for(let i=0; i<coins.length; i++)
		{
			let c = coins[i];
			
			this.drawCoinRow(table, tbody, c);
		}
		
		
		
		
		/*
		for (let i = 0; i < coins.length; i++) {
			
		}
		*/
		
		//remove the 'loading cryptocurrencies...' placeholder
		loadingNotify.remove(); 
				
	}catch(e) {
		console.log('ERROR - ' + e.toString());
		el.createEl('p', {text: 'Error - ' + e.toString()});
	}
	
		});
	
		this.addSettingTab(new CryptoLookupSettingTab(this.app, this));
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
		

		containerEl.createEl('a', {text: 'Crypto Market Cap & Pricing Data Provided By Nomics.', href: 'https://nomics.com'});
		containerEl.createEl('br');

		containerEl.createEl('p', {text: 'Credits:' } );
		containerEl.createEl('a', {text: 'Github', href: 'https://github.com/kinabalu' } );

		let ul = containerEl.createEl('ul');
		let li;

		li = ul.createEl('li');
		li.createEl('a', {text: 'kinabalu', href: 'https://github.com/kinabalu' } ); 

		li = ul.createEl('li');
		li.createEl('a', {text: 'cheeseonamonkey', href: 'https://github.com/cheeseonamonkey' } );
		
	}
		
}
 