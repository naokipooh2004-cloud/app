import { config } from "../config.js";
import type { PricePoint } from "../types.js";

export interface ParsedPair {
  base: string;
  quote: string;
  /** 正規化した表記 (例: "USD/JPY") */
  pretty: string;
}

export interface LatestRate {
  pair: string;
  base: string;
  quote: string;
  rate: number;
  date: string;
  source: string;
}

/** 外部プロバイダ由来のエラー（ルートで 502 に変換する） */
export class RateProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateProviderError";
  }
}

const SUPPORTED_SEPARATORS = /[\/\-_]/;

/** "USDJPY" / "USD/JPY" / "usd-jpy" などを {base, quote} に正規化 */
export function parsePair(input: string): ParsedPair {
  const raw = input.trim().toUpperCase();
  let base: string;
  let quote: string;

  if (SUPPORTED_SEPARATORS.test(raw)) {
    const [b, q] = raw.split(SUPPORTED_SEPARATORS);
    base = b;
    quote = q;
  } else if (raw.length === 6) {
    base = raw.slice(0, 3);
    quote = raw.slice(3, 6);
  } else {
    throw new RateProviderError(
      `通貨ペアの形式が不正です: "${input}"。例: USD/JPY, USDJPY, EUR-USD`,
    );
  }

  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
    throw new RateProviderError(
      `通貨コードは3文字の英字で指定してください: "${input}"`,
    );
  }
  return { base, quote, pretty: `${base}/${quote}` };
}

interface RatesProvider {
  getLatest(pair: ParsedPair): Promise<LatestRate>;
  getTimeSeries(pair: ParsedPair, days: number): Promise<PricePoint[]>;
}

// ---------- Frankfurter（無料・キー不要の ECB 参照レート） ----------

const frankfurterProvider: RatesProvider = {
  async getLatest(pair) {
    const url = `${config.frankfurterBaseUrl}/latest?base=${pair.base}&symbols=${pair.quote}`;
    const data = await fetchJson(url);
    const rate = data?.rates?.[pair.quote];
    if (typeof rate !== "number") {
      throw new RateProviderError(
        `レートを取得できませんでした (${pair.pretty})。通貨ペアが対応していない可能性があります。`,
      );
    }
    return {
      pair: pair.pretty,
      base: pair.base,
      quote: pair.quote,
      rate,
      date: data.date,
      source: "frankfurter (ECB)",
    };
  },

  async getTimeSeries(pair, days) {
    const end = new Date();
    const start = new Date();
    // 週末・祝日の欠損を考慮し、必要日数より多めに遡る
    start.setDate(start.getDate() - Math.ceil(days * 1.6) - 10);
    const url =
      `${config.frankfurterBaseUrl}/${fmtDate(start)}..${fmtDate(end)}` +
      `?base=${pair.base}&symbols=${pair.quote}`;
    const data = await fetchJson(url);
    const rates = data?.rates as Record<string, Record<string, number>> | undefined;
    if (!rates) {
      throw new RateProviderError(
        `時系列データを取得できませんでした (${pair.pretty})。`,
      );
    }
    const points: PricePoint[] = Object.keys(rates)
      .sort()
      .map((date) => ({ date, close: rates[date][pair.quote] }))
      .filter((p) => typeof p.close === "number");
    return points;
  },
};

// ---------- Mock（外部通信なしのデモ用） ----------

const MOCK_BASE_LEVELS: Record<string, number> = {
  "USD/JPY": 150,
  "EUR/USD": 1.08,
  "GBP/USD": 1.27,
  "EUR/JPY": 162,
  "AUD/USD": 0.66,
};

/** 決定的な疑似乱数（seed から再現可能なランダムウォーク用） */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const mockProvider: RatesProvider = {
  async getTimeSeries(pair, days) {
    const level = MOCK_BASE_LEVELS[pair.pretty] ?? 100;
    const rand = seededRandom(hashString(pair.pretty) + 1);
    const points: PricePoint[] = [];
    let value = level;
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // ±0.4% 程度のランダムウォーク
      const change = (rand() - 0.5) * 0.008 * level;
      value = Math.max(0.0001, value + change);
      points.push({ date: fmtDate(d), close: round(value, 4) });
    }
    return points;
  },

  async getLatest(pair) {
    const series = await this.getTimeSeries(pair, 1);
    const last = series[series.length - 1];
    return {
      pair: pair.pretty,
      base: pair.base,
      quote: pair.quote,
      rate: last.close,
      date: last.date,
      source: "mock (デモ用ダミーデータ)",
    };
  },
};

function selectProvider(): RatesProvider {
  return config.ratesProvider === "mock" ? mockProvider : frankfurterProvider;
}

export function getLatestRate(pairInput: string): Promise<LatestRate> {
  const pair = parsePair(pairInput);
  return selectProvider().getLatest(pair);
}

export async function getPriceSeries(
  pairInput: string,
  days = 120,
): Promise<PricePoint[]> {
  const pair = parsePair(pairInput);
  const points = await selectProvider().getTimeSeries(pair, days);
  // 直近 days 本に揃える
  return points.slice(Math.max(0, points.length - days));
}

// ---------- helpers ----------

async function fetchJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    throw new RateProviderError(
      `レート取得先への接続に失敗しました: ${(err as Error).message}。` +
        `オフライン環境では RATES_PROVIDER=mock を設定してください。`,
    );
  }
  if (!res.ok) {
    throw new RateProviderError(
      `レート取得先がエラーを返しました (HTTP ${res.status})。`,
    );
  }
  return res.json();
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
