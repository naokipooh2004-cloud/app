import type {
  AnalysisResult,
  Indicators,
  PricePoint,
  SignalDirection,
} from "../types.js";
import { DISCLAIMER_JA } from "../lib/disclaimer.js";
import { ema, macd, rsi, sma } from "./indicators.js";

const SMA_PERIOD = 25;
const EMA_PERIOD = 12;
const RSI_PERIOD = 14;

/**
 * 終値系列からテクニカル指標を計算し、売買シグナルの目安を導く。
 * 複数指標のスコアを合算して方向を決める、シンプルなルールベース。
 */
export function analyze(pair: string, prices: PricePoint[]): AnalysisResult {
  const closes = prices.map((p) => p.close);
  const latest = prices[prices.length - 1];

  const indicators: Indicators = {
    sma: { period: SMA_PERIOD, value: sma(closes, SMA_PERIOD) },
    ema: { period: EMA_PERIOD, value: ema(closes, EMA_PERIOD) },
    rsi: { period: RSI_PERIOD, value: rsi(closes, RSI_PERIOD) },
    macd: macd(closes),
  };

  const { score, reasons } = scoreSignals(latest.close, indicators);
  const direction = directionFromScore(score);

  return {
    pair,
    asOf: latest.date,
    latestClose: latest.close,
    indicators,
    signal: { direction, score, reasons },
    disclaimer: DISCLAIMER_JA,
  };
}

function directionFromScore(score: number): SignalDirection {
  if (score >= 25) return "buy";
  if (score <= -25) return "sell";
  return "neutral";
}

/**
 * 各指標から -100〜+100 のスコアを合成する。
 * - 価格と移動平均の位置関係（トレンド）
 * - RSI の売られすぎ / 買われすぎ
 * - MACD ヒストグラムの符号
 */
function scoreSignals(
  price: number,
  ind: Indicators,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // トレンド: 価格が SMA より上なら強気、下なら弱気
  if (ind.sma.value !== null) {
    if (price > ind.sma.value) {
      score += 20;
      reasons.push(
        `価格(${price.toFixed(4)})が SMA${ind.sma.period}(${ind.sma.value.toFixed(4)})より上 → 上昇トレンド寄り`,
      );
    } else if (price < ind.sma.value) {
      score -= 20;
      reasons.push(
        `価格(${price.toFixed(4)})が SMA${ind.sma.period}(${ind.sma.value.toFixed(4)})より下 → 下落トレンド寄り`,
      );
    }
  }

  // 短期 EMA と価格の位置
  if (ind.ema.value !== null) {
    if (price > ind.ema.value) {
      score += 10;
      reasons.push(`価格が EMA${ind.ema.period} より上 → 短期的に強い`);
    } else if (price < ind.ema.value) {
      score -= 10;
      reasons.push(`価格が EMA${ind.ema.period} より下 → 短期的に弱い`);
    }
  }

  // RSI: 30未満で買い(反発期待)、70超で売り(過熱)
  if (ind.rsi.value !== null) {
    const r = ind.rsi.value;
    if (r < 30) {
      score += 25;
      reasons.push(`RSI=${r.toFixed(1)} は売られすぎ圏(<30) → 反発の可能性`);
    } else if (r > 70) {
      score -= 25;
      reasons.push(`RSI=${r.toFixed(1)} は買われすぎ圏(>70) → 調整の可能性`);
    } else {
      reasons.push(`RSI=${r.toFixed(1)} は中立圏(30〜70)`);
    }
  }

  // MACD: ヒストグラムが正なら強気、負なら弱気
  if (ind.macd.histogram !== null) {
    const h = ind.macd.histogram;
    if (h > 0) {
      score += 15;
      reasons.push(`MACD ヒストグラムが正(${h.toFixed(4)}) → 上昇の勢い`);
    } else if (h < 0) {
      score -= 15;
      reasons.push(`MACD ヒストグラムが負(${h.toFixed(4)}) → 下落の勢い`);
    }
  }

  // -100〜+100 にクランプ
  score = Math.max(-100, Math.min(100, score));
  if (reasons.length === 0) {
    reasons.push("十分なデータがないため、明確なシグナルは検出されませんでした。");
  }
  return { score, reasons };
}
