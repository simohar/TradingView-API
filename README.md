# BVC TradingView Integration

This module extends [TradingView-API](https://github.com/Mathieu2301/TradingView-API) with a **custom script** for fetching any stock, index, ETF, forex, or crypto data available on TradingView.  

The script `bvc_tv_fetch.js` is designed to:
- Fetch OHLCV data from TradingView for a given symbol.
- Fetch benchmark/index data in parallel (default: `CSEMA:MASI`, but can be set to any symbol).
- Compute advanced features such as rolling price changes, volume averages, ratios, and volume-price correlations.
- Export the results into a CSV file for analysis.

---

## 📂 Installation

1. Clone or update the [TradingView-API](https://github.com/Mathieu2301/TradingView-API) repository:

   ```bash
   git clone https://github.com/Mathieu2301/TradingView-API.git
   cd TradingView-API
   ```

2. Install dependencies:

   ```bash
   npm install
   npm install @mathieuc/tradingview
   ```

3. Copy the provided script into a new folder `bvc_tv` inside the project root:

   ```
   TradingView-API/
   ├── bvc_tv/
   │   └── bvc_tv_fetch.js
   ├── package.json
   └── ...
   ```

---

## Usage

Navigate to the `bvc_tv` folder and run the script with your chosen **symbol**:

```bash
cd bvc_tv
SYMBOL=NASDAQ:AAPL node bvc_tv_fetch.js
```

Examples:

```bash
# Fetch Apple (NASDAQ)
SYMBOL=NASDAQ:AAPL node bvc_tv_fetch.js

# Fetch IBM (NYSE)
SYMBOL=NYSE:IBM node bvc_tv_fetch.js

# Fetch Bitcoin vs USD
SYMBOL=BINANCE:BTCUSDT node bvc_tv_fetch.js

# Fetch Moroccan bank BCP
SYMBOL=CSEMA:BCP node bvc_tv_fetch.js
```

---

## Environment Variables

The script can be configured via environment variables:

- `SYMBOL` → Target symbol (default: `CSEMA:MASI`)
- `MASI_SYMBOL` → Benchmark/index symbol (default: `CSEMA:MASI`, can be any symbol, e.g. `NASDAQ:QQQ` or `BINANCE:BTCUSDT`)
- `START` → Start date (format: `YYYY-MM-DD`, default: `1900-04-04`)
- `END` → End date (format: `YYYY-MM-DD`, default: `2025-09-31`)
- `OUT` → Output CSV file name (default: `moroccan_stock_analysis.csv`)
- `DEBUG` → Set to `1` to enable debug logs (default: `0`)

Example with all options:

```bash
SYMBOL=NASDAQ:TSLA MASI_SYMBOL=NASDAQ:QQQ START=2020-01-01 END=2025-01-01 OUT=tesla_analysis.csv DEBUG=1 node bvc_tv_fetch.js
```

---

## Output

The script generates a CSV file with the following columns:

- Date, OHLCV values  
- Benchmark index values (open/close)  
- Rolling price changes (1d, 7d, 30d, 365d)  
- Volume averages (7d, 90d)  
- Ratios (`vol_vs_7d_avg`, `vol_vs_90d_avg`)  
- Volume-price correlation (7d)  
- High volume impact  

---

## Notes

- Works with **any TradingView-supported symbol** (stocks, indices, forex, ETFs, cryptos).  
- Requires **Node.js v16 or later**.  
- Data is fetched directly from TradingView via the `@mathieuc/tradingview` library.  
- CSV files are created in the working directory unless another path is specified in `OUT`.

---

## Example Run

```bash
cd bvc_tv
SYMBOL=BINANCE:ETHUSDT MASI_SYMBOL=BINANCE:BTCUSDT node bvc_tv_fetch.js
```

Output:

```
Fetching BINANCE:ETHUSDT and BINANCE:BTCUSDT data...
OK → moroccan_stock_analysis.csv
Rows: 2000 | From 2020-01-01 to 2025-09-30
```

---

## Next Steps (Optional)

You can analyze the generated CSV using **Python (pandas)**:

```python
import pandas as pd

df = pd.read_csv("tesla_analysis.csv")
print(df.head())
```

---

### License

This integration follows the license of the original [TradingView-API](https://github.com/Mathieu2301/TradingView-API).
