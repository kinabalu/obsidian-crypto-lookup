import {App, PluginSettingTab, Setting} from "obsidian";
import CryptoLookup from "./main";

export class CryptoLookupSettingTab extends PluginSettingTab {
	plugin: CryptoLookup;

	constructor(app: App, plugin: CryptoLookup) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl).setName('Defaults').setHeading();

		new Setting(containerEl)
			.setName('Base currency')
			.setDesc('Default currency we want the price of')
			.addText(text => text
				.setPlaceholder('BTC')
				.setValue(this.plugin.settings.defaultBase)
				.onChange(async (value) => {
					this.plugin.settings.defaultBase = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target currency')
			.setDesc('Default target currency to convert base currency into')
			.addText(text => text
				.setPlaceholder('USD')
				.setValue(this.plugin.settings.defaultTarget)
				.onChange(async (value) => {
					this.plugin.settings.defaultTarget = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Price data').setHeading();

		new Setting(containerEl)
			.setName('CoinGecko demo API key')
			.setDesc('Optional. Prices come from CoinGecko, falling back to Coinbase. A free CoinGecko demo key raises the rate limit.')
			.addText(text => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Not set')
					.setValue(this.plugin.settings.coinGeckoApiKey)
					.onChange(async (value) => {
						this.plugin.settings.coinGeckoApiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});
	}
}
