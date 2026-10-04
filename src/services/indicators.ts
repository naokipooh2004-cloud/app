// テクニカル指標の計算（純粋関数の集合）。
// 入力は終値の配列（古い順 → 新しい順）。

/** 単純移動平均 (SMA)。直近 period 本の終値の平均。データ不足なら null。 */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const window = values.slice(values.length - period);
  const sum = window.reduce((acc, v) => acc + v, 0);
  return sum / period;
}

/**
 * 指数移動平均 (EMA) の全系列を返す。
 * 最初の period 本の SMA を初期値とし、以降は EMA 漸化式で計算。
 * データ不足なら空配列。
 */
export function emaSeries(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  // 初期値: 先頭 period 本の SMA
  let prev =
    values.slice(0, period).reduce((acc, v) => acc + v, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    const current = values[i] * k + prev * (1 - k);
    result.push(current);
    prev = current;
  }
  return result;
}

/** EMA の最新値。データ不足なら null。 */
export function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series.length > 0 ? series[series.length - 1] : null;
}

/**
 * RSI (Wilder の平滑化)。0〜100。データ不足なら null。
 * period 本の値動きが必要（終値は period+1 本必要）。
 */
export function rsi(values: number[], period = 14): number | null {
  if (period <= 0 || values.length < period + 1) return null;

  let gainSum = 0;
  let lossSum = 0;
  // 最初の period 本の平均 gain/loss
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  // 以降は Wilder の平滑化
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

/**
 * MACD。macd = EMA(fast) - EMA(slow)、signal = EMA(macd系列, signalPeriod)。
 * データ不足の項目は null。
 */
export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult {
  const fast = emaSeries(values, fastPeriod);
  const slow = emaSeries(values, slowPeriod);
  if (fast.length === 0 || slow.length === 0) {
    return { macd: null, signal: null, histogram: null };
  }

  // fast と slow は開始位置が異なるため、末尾を揃える。
  const len = Math.min(fast.length, slow.length);
  const fastTail = fast.slice(fast.length - len);
  const slowTail = slow.slice(slow.length - len);
  const macdLine = fastTail.map((v, i) => v - slowTail[i]);

  const macdValue = macdLine[macdLine.length - 1];
  const signalSeries = emaSeries(macdLine, signalPeriod);
  const signalValue =
    signalSeries.length > 0 ? signalSeries[signalSeries.length - 1] : null;
  const histogram =
    signalValue !== null ? macdValue - signalValue : null;

  return { macd: macdValue, signal: signalValue, histogram };
}
