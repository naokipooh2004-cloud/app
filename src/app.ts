import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { adviceRouter } from "./routes/advice.js";
import { analysisRouter } from "./routes/analysis.js";
import { calendarRouter } from "./routes/calendar.js";
import { healthRouter } from "./routes/health.js";
import { ratesRouter } from "./routes/rates.js";
import { AdvisorUnavailableError } from "./services/advisor.js";
import { RateProviderError } from "./services/rates.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  // Web UI（静的フロントエンド）
  app.use(express.static(path.join(process.cwd(), "public")));

  // API: 簡単な案内
  app.get("/api", (_req, res) => {
    res.json({
      name: "FX Advisor API",
      description: "為替のテクニカル分析・AI相談・カレンダー・レートを提供する API",
      endpoints: [
        "GET  /api/health",
        "GET  /api/rates/:pair",
        "GET  /api/rates/:pair/series?days=120",
        "GET  /api/analysis/:pair?days=120",
        "GET  /api/calendar?from=&to=&importance=&currency=",
        "POST /api/advice  { question, pair?, history? }",
      ],
    });
  });

  // API ルート
  app.use("/api", healthRouter);
  app.use("/api", ratesRouter);
  app.use("/api", analysisRouter);
  app.use("/api", calendarRouter);
  app.use("/api", adviceRouter);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  // 集約エラーハンドラ
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof RateProviderError) {
      res.status(502).json({ error: err.message });
      return;
    }
    if (err instanceof AdvisorUnavailableError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("[unhandled error]", err);
    res.status(500).json({ error: "内部エラーが発生しました。" });
  });

  return app;
}
