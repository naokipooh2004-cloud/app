import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { DISCLAIMER_JA } from "../lib/disclaimer.js";
import type { AnalysisResult } from "../types.js";

/** API キー未設定などで AI 相談が使えないときのエラー */
export class AdvisorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdvisorUnavailableError";
  }
}

const SYSTEM_PROMPT = `あなたは「FX（外国為替証拠金取引）の学習を手助けする日本語アシスタント」です。

役割と方針:
- ユーザーが為替相場・テクニカル分析・ファンダメンタルズ・リスク管理などを「理解」できるよう、中立的で分かりやすく解説します。
- 特定の売買を断定的に推奨しない（「必ず上がる/買うべき」などと言わない）。あくまで考え方・見方・一般論を示します。
- 不確実性を正直に伝え、相場に絶対はないことを前提に話します。
- リスク管理（損切り、ロット管理、レバレッジの危険性）の重要性に自然に触れます。
- 数値予想や将来価格の断定は避け、「シナリオ」や「一般的な見方」として説明します。
- 回答は簡潔で構造的に。必要に応じて箇条書きを使います。

与えられた「テクニカル分析データ」がある場合は、その指標が一般にどう解釈されるかを説明の材料にしてください（ただし断定的な売買指示にはしない）。`;

export interface AdviceRequest {
  /** ユーザーの質問 */
  question: string;
  /** 直前までの会話履歴（任意） */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** 参考として渡すテクニカル分析結果（任意） */
  analysis?: AnalysisResult;
}

export interface AdviceResponse {
  answer: string;
  model: string;
  disclaimer: string;
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new AdvisorUnavailableError(
      "AI 相談機能には ANTHROPIC_API_KEY が必要です。.env に設定してください。",
    );
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return cachedClient;
}

/** AI による FX 学習サポートの回答を生成する */
export async function getAdvice(req: AdviceRequest): Promise<AdviceResponse> {
  const client = getClient();

  const messages: Anthropic.MessageParam[] = [];
  for (const turn of req.history ?? []) {
    messages.push({ role: turn.role, content: turn.content });
  }

  let userContent = req.question;
  if (req.analysis) {
    userContent +=
      "\n\n---\n参考: 直近のテクニカル分析データ(JSON)\n" +
      JSON.stringify(
        {
          pair: req.analysis.pair,
          asOf: req.analysis.asOf,
          latestClose: req.analysis.latestClose,
          indicators: req.analysis.indicators,
          signal: req.analysis.signal,
        },
        null,
        2,
      );
  }
  messages.push({ role: "user", content: userContent });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: config.advisorModel,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AdvisorUnavailableError(
        "ANTHROPIC_API_KEY が無効です。正しいキーを設定してください。",
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AdvisorUnavailableError(
        "AI へのリクエストがレート制限に達しました。しばらくして再試行してください。",
      );
    }
    throw err;
  }

  const answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    answer: answer || "（回答を生成できませんでした）",
    model: response.model,
    disclaimer: DISCLAIMER_JA,
  };
}

/** AI 相談が利用可能か（API キーが設定されているか） */
export function isAdvisorConfigured(): boolean {
  return Boolean(config.anthropicApiKey);
}
