import "dotenv/config";

/** 環境変数から読み込むアプリ設定 */
export interface AppConfig {
  port: number;
  anthropicApiKey: string | undefined;
  advisorModel: string;
  ratesProvider: "frankfurter" | "mock";
  frankfurterBaseUrl: string;
}

function parseRatesProvider(value: string | undefined): "frankfurter" | "mock" {
  return value === "mock" ? "mock" : "frankfurter";
}

export const config: AppConfig = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  advisorModel: process.env.ADVISOR_MODEL || "claude-opus-5-5",
  ratesProvider: parseRatesProvider(process.env.RATES_PROVIDER),
  frankfurterBaseUrl:
    process.env.FRANKFURTER_BASE_URL || "https://api.frankfurter.dev/v1",
};
