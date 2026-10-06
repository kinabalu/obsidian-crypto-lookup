# Crypto Lookup
Look up the price of a cryptocurrency in a target currency (fiat or crypto) and insert it into your note.

### Features
- A command to fetch the exchange rate for currencies entered in a modal (price only, or extended with 24h volume, 24h % change and timestamp)
- A command to fetch the exchange rate for the default currencies in settings (price only, or extended)

### Price data and network use
Prices come from the [CoinGecko API](https://www.coingecko.com/en/api) (data provided by CoinGecko). If CoinGecko is unavailable or rate limited, the plugin falls back to [Coinbase](https://docs.cdp.coinbase.com/coinbase-app/docs/api-prices) spot prices, which include the price only.

The plugin only contacts `api.coingecko.com` and `api.coinbase.com`, and only when you run one of its commands. No account is required. The keyless CoinGecko API has a low rate limit; if you run into it, create a free CoinGecko Demo API key and enter it in the plugin settings.

### Coming Soon
- Lookup upon install of all supported currencies so can auto-complete

### Installation
Search for "Crypto Lookup" under Settings → Community plugins → Browse.

### Manual Installation
Two methods and the first one is easier:

#### Method 1
- Enable community plugins and install Obsidian42 - BRAT
- Go to settings and under Beta Plugin List click "Add Beta plugin" and type kinabalu/obsidian-crypto-lookup

#### Method 2
- Create an `obsidian-crypto-lookup` folder under `.obsidian/plugins` in your vault. Add the
  `main.js`, `manifest.json`, and the `styles.css` files from the
  [latest release](https://github.com/kinabalu/obsidian-crypto-lookup/releases) to the folder.

## Say Thanks 🙏

If you like this plugin and would like to buy me a coffee, you can!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-violet.png" alt="BuyMeACoffee" width="100">](https://www.buymeacoffee.com/andrewlombardi)
