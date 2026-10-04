// アプリ全体で使う共通の型定義

/** ローソク足などの時系列の1点（終値ベース） */
export interface PricePoint {
  /** ISO 日付文字列 (YYYY-MM-DD) */
  date: string;
  /** 終値 */
  close: number;
}

/** テクニカル指標の計算結果 */
export interface Indicators {
  sma: { period: number; value: number | null };
  ema: { period: number; value: number | null };
  rsi: { period: number; value: number | null };
  macd: {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
  };
}

/** 売買シグナルの方向 */
export type SignalDirection = "buy" | "sell" | "neutral";

/** 分析結果（シグナル + 根拠） */
export interface AnalysisResult {
  pair: string;
  asOf: string;
  latestClose: number;
  indicators: Indicators;
  signal: {
    direction: SignalDirection;
    /** -100(強い売り) 〜 +100(強い買い) のスコア */
    score: number;
    /** 判断の根拠（人間向けの短い説明の配列） */
    reasons: string[];
  };
}

/** 経済指標カレンダーの1イベント */
export interface CalendarEvent {
  /** ISO 日時 (UTC) */
  datetime: string;
  /** 対象国/通貨圏コード (例: US, JP, EU, GB) */
  country: string;
  /** イベント名 */
  title: string;
  /** 重要度 */
  importance: "low" | "medium" | "high";
  /** 影響を受けやすい通貨（任意） */
  affectedCurrencies?: string[];
}
