/* eslint-disable no-console */
/* eslint-env node */

const fs = require('fs');
const path = require('path');
const TradingView = require('@mathieuc/tradingview');

const SYMBOL = process.env.SYMBOL || 'CSEMA:MASI';
const MASI_SYMBOL = process.env.MASI_SYMBOL || 'CSEMA:MASI';
const START = new Date(process.env.START || '1900-04-04');
const END = new Date(process.env.END || '2025-09-31');
const OUT = process.env.OUT || 'moroccan_stock_analysis.csv';
const DEBUG = String(process.env.DEBUG || '0') === '1';

async function fetchBarsTV(symbol, timeframe = '1D', range = 5000) {
  const client = new TradingView.Client();
  const chart = new client.Session.Chart();

  const waitOnce = () => new Promise((resolve) => {
    if (typeof chart.onSymbolLoaded === 'function') {
      chart.onSymbolLoaded(() => resolve());
    }
    chart.onUpdate(() => resolve());
  });

  chart.setMarket(symbol, { timeframe, range });
  await waitOnce();

  const periods = Array.isArray(chart.periods) ? chart.periods : [];

  if (DEBUG && periods.length) {
    const keys = Object.keys(periods[0]).sort();
    console.log('DEBUG keys(periods[0]):', keys);
    console.log('DEBUG sample(periods[0]):', periods[0]);
  }

  const bars = periods.map((p) => {
    const t = typeof p.time === 'number' && p.time < 2e10 ? p.time * 1000 : Number(p.time);
    const open = p.open ?? p.o ?? p.close;
    const high = p.high ?? p.max ?? p.h ?? p.close;
    const low = p.low ?? p.min ?? p.l ?? p.close;
    const close = p.close ?? p.c ?? open;
    const volume = p.volume ?? p.vol ?? null;

    return {
      open_time: t,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: volume == null ? 0 : Number(volume),
    };
  });

  client.end();
  
  // Reverse the data to get chronological order (oldest first)
  return bars.reverse();
}

function calculateFeatures(bars, masiData) {
  if (bars.length === 0) return bars;

  // Create a map of MASI data by date (YYYY-MM-DD) for easy lookup
  const masiByDate = {};
  masiData.forEach(masiBar => {
    const date = new Date(masiBar.open_time);
    const dateKey = date.toISOString().split('T')[0];
    masiByDate[dateKey] = {
      masi_open: masiBar.open,
      masi_close: masiBar.close
    };
  });

  // Convert to DataFrame-like structure for easier calculations
  const df = [...bars];
  
  // Initialize all feature properties to null
  const featureProps = [
    'price_change_1d', 'price_change_7d', 'price_change_30d', 'price_change_365d',
    'volume_7d_avg', 'volume_90d_avg', 'vol_vs_7d_avg', 'vol_vs_90d_avg',
    'volume_price_corr_7d', 'high_volume_impact', 'masi_open', 'masi_close',
    'taker_buy_base', 'sell_volume', 'buy_sell_ratio'
  ];
  
  df.forEach(row => {
    featureProps.forEach(prop => {
      if (!(prop in row)) row[prop] = null;
    });
  });
  
  // Add MASI data first (before other calculations)
  for (let i = 0; i < df.length; i += 1) {
    const date = new Date(df[i].open_time);
    const dateKey = date.toISOString().split('T')[0];
    
    if (masiByDate[dateKey]) {
      df[i].masi_open = masiByDate[dateKey].masi_open;
      df[i].masi_close = masiByDate[dateKey].masi_close;
    }
  }
  
  // Calculate price changes
  for (let i = 1; i < df.length; i += 1) {
    df[i].price_change_1d = (df[i].close - df[i - 1].close) / df[i - 1].close;
  }
  
  for (let i = 7; i < df.length; i += 1) {
    df[i].price_change_7d = (df[i].close - df[i - 7].close) / df[i - 7].close;
  }
  
  for (let i = 30; i < df.length; i += 1) {
    df[i].price_change_30d = (df[i].close - df[i - 30].close) / df[i - 30].close;
  }
  
  for (let i = 365; i < df.length; i += 1) {
    df[i].price_change_365d = (df[i].close - df[i - 365].close) / df[i - 365].close;
  }
  
  // Calculate volume averages
  for (let i = 7; i < df.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < 7; j += 1) {
      sum += df[i - j].volume;
    }
    df[i].volume_7d_avg = sum / 7;
  }
  
  for (let i = 90; i < df.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < 90; j += 1) {
      sum += df[i - j].volume;
    }
    df[i].volume_90d_avg = sum / 90;
  }
  
  // Calculate volume ratios
  for (let i = 7; i < df.length; i += 1) {
    df[i].vol_vs_7d_avg = df[i].volume / df[i].volume_7d_avg;
  }
  
  for (let i = 90; i < df.length; i += 1) {
    df[i].vol_vs_90d_avg = df[i].volume / (df[i].volume_90d_avg || 1);
  }
  
  // Calculate volume-price correlation (7-day)
  for (let i = 7; i < df.length; i += 1) {
    const volumes = [];
    const prices = [];
    
    for (let j = 0; j < 7; j += 1) {
      volumes.push(df[i - j].volume);
      prices.push(df[i - j].close);
    }
    
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / 7;
    const avgPrice = prices.reduce((a, b) => a + b, 0) / 7;
    
    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;
    
    for (let j = 0; j < 7; j += 1) {
      numerator += (volumes[j] - avgVolume) * (prices[j] - avgPrice);
      denom1 += (volumes[j] - avgVolume) ** 2;
      denom2 += (prices[j] - avgPrice) ** 2;
    }
    
    df[i].volume_price_corr_7d = numerator / Math.sqrt(denom1 * denom2) || 0;
  }
  
  // Calculate high volume impact
  for (let i = 0; i < df.length; i += 1) {
    if (df[i].vol_vs_7d_avg > 1.5) {
      df[i].high_volume_impact = df[i].close - df[i].open;
    } else {
      df[i].high_volume_impact = 0;
    }
  }
  
  return df;
}

function toCsv(rows, headers) {
  const esc = (v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [headers.join(',')];
  for (const r of rows) {
    const rowData = headers.map((h) => esc(r[h]));
    lines.push(rowData.join(','));
  }
  return lines.join('\n');
}

(async () => {
  console.log(`Fetching ${SYMBOL} and MASI index data...`);
  
  // Fetch both the stock data and MASI index data
  const [raw, rawMasi] = await Promise.all([
    fetchBarsTV(SYMBOL, '1D', 5000),
    fetchBarsTV(MASI_SYMBOL, '1D', 5000)
  ]);

  if (DEBUG) {
    console.log(`Fetched ${raw.length} bars for ${SYMBOL}`);
    console.log(`Fetched ${rawMasi.length} bars for MASI`);
    
    // Log first few dates to check alignment
    console.log('First few stock dates:', raw.slice(0, 3).map(b => new Date(b.open_time).toISOString().split('T')[0]));
    console.log('First few MASI dates:', rawMasi.slice(0, 3).map(b => new Date(b.open_time).toISOString().split('T')[0]));
  }

  // Filter by dates
  const filtered = raw.filter((b) => {
    const d = new Date(b.open_time);
    return d >= START && d <= END;
  });

  const filteredMasi = rawMasi.filter((b) => {
    const d = new Date(b.open_time);
    return d >= START && d <= END;
  });

  if (filtered.length === 0) {
    console.error('No candles returned (check symbol/dates).');
    process.exit(1);
  }

  // Calculate all features with MASI data
  const rows = calculateFeatures(filtered, filteredMasi);

  // Sort by date (oldest first) - though they should already be in order
  rows.sort((a, b) => a.open_time - b.open_time);

  // Define the exact columns you requested
  const headers = [
    'date', 'open', 'high', 'low', 'close', 'volume', 'masi_open', 'masi_close',
    'taker_buy_base', 'sell_volume', 'price_change_1d', 'price_change_7d', 
    'price_change_30d', 'price_change_365d', 'volume_7d_avg', 'volume_90d_avg', 
    'buy_sell_ratio', 'vol_vs_7d_avg', 'vol_vs_90d_avg', 'volume_price_corr_7d', 
    'high_volume_impact',
  ];

  // Format the data for CSV
  const csvData = rows.map((row) => {
    const date = new Date(row.open_time);
    return {
      date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      masi_open: row.masi_open,
      masi_close: row.masi_close,
      taker_buy_base: row.taker_buy_base,
      sell_volume: row.sell_volume,
      price_change_1d: row.price_change_1d,
      price_change_7d: row.price_change_7d,
      price_change_30d: row.price_change_30d,
      price_change_365d: row.price_change_365d,
      volume_7d_avg: row.volume_7d_avg,
      volume_90d_avg: row.volume_90d_avg,
      buy_sell_ratio: row.buy_sell_ratio,
      vol_vs_7d_avg: row.vol_vs_7d_avg,
      vol_vs_90d_avg: row.vol_vs_90d_avg,
      volume_price_corr_7d: row.volume_price_corr_7d,
      high_volume_impact: row.high_volume_impact,
    };
  });

  const csv = toCsv(csvData, headers);
  fs.writeFileSync(path.resolve(OUT), csv, 'utf8');

  const from = new Date(rows[0].open_time).toISOString().slice(0, 10);
  const to = new Date(rows[rows.length - 1].open_time).toISOString().slice(0, 10);

  console.log(`OK → ${OUT}`);
  console.log(`Rows: ${rows.length} | From ${from} to ${to}`);
  
  // Debug: Check if MASI data is present
  if (DEBUG) {
    const masiRows = rows.filter(r => r.masi_open !== null && r.masi_close !== null);
    console.log(`Rows with MASI data: ${masiRows.length}/${rows.length}`);
    
    if (masiRows.length > 0) {
      console.log('Sample row with MASI data:', {
        date: new Date(masiRows[0].open_time).toISOString().split('T')[0],
        masi_open: masiRows[0].masi_open,
        masi_close: masiRows[0].masi_close
      });
    } else {
      console.log('No MASI data found in any rows');
      console.log('Available dates in stock data:', rows.slice(0, 5).map(r => new Date(r.open_time).toISOString().split('T')[0]));
      console.log('Available dates in MASI data:', filteredMasi.slice(0, 5).map(r => new Date(r.open_time).toISOString().split('T')[0]));
    }
  }
})();


// SYMBOL=CSEMA:BCP node bvc_tv_fetch.js
// SYMBOL=NASDAQ:AAPL node bvc_tv_fetch.js
// SYMBOL=NYSE:IBM node bvc_tv_fetch.js