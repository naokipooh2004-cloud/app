import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { analyze } from "../services/analysis.js";
import { getPriceSeries } from "../services/rates.js";

export const analysisRouter = Router();

/**
 * GET /api/analysis/:pair?days=120
 * レートの時系列を取得してテクニカル分析し、シグナルの目安を返す。
 */
analysisRouter.get(
  "/analysis/:pair",
  asyncHandler(async (req, res) => {
    const days = clampInt(req.query.days, 120, 35, 365);
    const series = await getPriceSeries(req.params.pair, days);
    if (series.length < 35) {
      res.status(422).json({
        error:
          "分析に十分なデータがありません（最低35本程度の終値が必要です）。",
      });
      return;
    }
    const result = analyze(req.params.pair.toUpperCase(), series);
    res.json(result);
  }),
);

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
