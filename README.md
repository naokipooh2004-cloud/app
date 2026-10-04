# FX Advisor API

為替（FX）の **学習・情報提供** を目的としたバックエンド API です。
テクニカル分析・AI チャット相談・経済指標カレンダー・レート表示を提供します。

> ⚠️ **免責事項**
> 本アプリが提供する情報は学習・情報提供のみを目的としており、**投資助言や売買の推奨ではありません**。
> FX は高いリスクを伴い、損失が預託証拠金を上回る可能性があります。投資判断はご自身の責任で行ってください。

## 技術スタック

- Node.js (>= 18.17) / TypeScript / Express
- AI チャット相談: Anthropic Claude API（`@anthropic-ai/sdk`）

## セットアップ

```bash
npm install
cp .env.example .env     # 必要に応じて編集
npm run dev              # 開発起動（http://localhost:3000）
```

本番ビルド:

```bash
npm run build
npm start
```

テスト・型チェック:

```bash
npm test        # テクニカル指標のユニットテスト
npm run typecheck
```

## 環境変数（`.env`）

| 変数 | 説明 | 既定値 |
|---|---|---|
| `PORT` | 待ち受けポート | `3000` |
| `ANTHROPIC_API_KEY` | AI 相談（`/api/advice`）に必須。未設定でも他機能は動作 | （なし） |
| `ADVISOR_MODEL` | AI が使うモデル | `claude-opus-5-5` |
| `RATES_PROVIDER` | `frankfurter`（無料・キー不要）/ `mock`（外部通信なし） | `frankfurter` |
| `FRANKFURTER_BASE_URL` | レート取得先 | `https://api.frankfurter.dev/v1` |

> オフライン環境やデモでは `RATES_PROVIDER=mock` を指定すると、外部通信なしでダミーレートで全機能を試せます。

## API エンドポイント

### `GET /api/health`
稼働確認。AI 相談の有効/無効、使用中のレートプロバイダを返します。

### `GET /api/rates/:pair`
現在レート。`pair` は `USDJPY` / `USD/JPY` / `EUR-USD` など。

```bash
curl localhost:3000/api/rates/USDJPY
```
```json
{ "pair": "USD/JPY", "base": "USD", "quote": "JPY", "rate": 149.85, "date": "2026-10-04", "source": "frankfurter (ECB)" }
```

### `GET /api/rates/:pair/series?days=120`
終値の時系列（テクニカル分析の元データ）。`days` は 2〜365。

### `GET /api/analysis/:pair?days=120`
テクニカル分析。SMA / EMA / RSI / MACD を計算し、売買シグナルの **目安** とその根拠を返します。

```bash
curl "localhost:3000/api/analysis/USDJPY?days=120"
```
```json
{
  "pair": "USDJPY",
  "latestClose": 154.83,
  "indicators": { "sma": {...}, "ema": {...}, "rsi": {...}, "macd": {...} },
  "signal": {
    "direction": "buy",
    "score": 25,
    "reasons": ["価格が SMA25 より上 → 上昇トレンド寄り", "MACD ヒストグラムが正 → 上昇の勢い"]
  },
  "disclaimer": "..."
}
```

`signal.score` は -100（強い売り）〜 +100（強い買い）。`direction` は `buy` / `sell` / `neutral`。

### `GET /api/calendar?from=&to=&importance=&currency=`
経済指標カレンダー。期間内の主要指標（雇用統計・CPI 等）の **目安の予定** を返します。

- `from` / `to`: `YYYY-MM-DD`（既定は今日〜14日後）
- `importance`: `low` / `medium` / `high`
- `currency`: 3文字コードでフィルタ（例: `JPY`）

```bash
curl "localhost:3000/api/calendar?importance=high&currency=USD"
```

> 注: カレンダーは毎月の定例指標から生成した *目安* です。正確な日時は公式カレンダー、または実データプロバイダ（Trading Economics / Finnhub など）をご利用ください。`src/services/calendar.ts` の `getEvents()` を差し替えることで実データ連携に対応できます。

### `POST /api/advice`
AI による FX 学習サポート。`ANTHROPIC_API_KEY` が必要です。

リクエスト:
```json
{
  "question": "RSIの見方を教えて",
  "pair": "USDJPY",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }]
}
```
- `pair` を指定すると、その通貨ペアのテクニカル分析を自動で添えて相談します。
- `history` で会話の継続が可能です（任意、最大20件）。

```bash
curl -X POST localhost:3000/api/advice \
  -H 'content-type: application/json' \
  -d '{"question":"今のUSDJPYのテクニカルをどう見る？","pair":"USDJPY"}'
```

## プロジェクト構成

```
src/
  index.ts              サーバー起動
  app.ts                Express アプリ / ルート登録 / エラーハンドラ
  config.ts             環境変数の読み込み
  types.ts              共通の型
  lib/
    disclaimer.ts       免責事項
    asyncHandler.ts     async ルートの例外処理ラッパ
  services/
    indicators.ts       SMA / EMA / RSI / MACD（純粋関数）
    analysis.ts         指標からシグナルを合成
    rates.ts            レート取得（frankfurter / mock）
    calendar.ts         経済指標カレンダー（生成ベース、差し替え可能）
    advisor.ts          Claude API 連携
  routes/               各エンドポイント
test/
  indicators.test.ts    指標計算のユニットテスト
```

## 今後の拡張の目安

- レート/OHLC を実データプロバイダ（有料 API）に切り替え、より高精度な分析に
- 経済指標カレンダーを実データ API に連携
- フロントエンド（Web UI）や LINE / Discord bot からの利用
- 分析結果の通知・アラート機能

---

本プロジェクトは教育・情報提供目的のサンプル実装です。実際の取引判断には利用しないでください。
