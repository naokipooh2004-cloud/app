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

  // API ルート
  app.use("/api", healthRouter);
  app.use("/api", ratesRouter);
  app.use("/api", analysisRouter);
  app.use("/api", calendarRouter);
  app.use("/api", adviceRouter);

  // ルート: API の簡単な案内
  app.get("/", (_req, res) => {
    res.json({
      name: "FX Advisor API",
      description:
        "為替の学習・情報提供を目的とした API（投資助言ではありません）",
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
