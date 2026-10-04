import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getLatestRate, getPriceSeries } from "../services/rates.js";

export const ratesRouter = Router();

/** GET /api/rates/:pair  — 現在レート（例: /api/rates/USDJPY） */
ratesRouter.get(
  "/rates/:pair",
  asyncHandler(async (req, res) => {
    const rate = await getLatestRate(req.params.pair);
    res.json(rate);
  }),
);

/** GET /api/rates/:pair/series?days=120 — 終値の時系列 */
ratesRouter.get(
  "/rates/:pair/series",
  asyncHandler(async (req, res) => {
    const days = clampInt(req.query.days, 120, 2, 365);
    const series = await getPriceSeries(req.params.pair, days);
    res.json({ pair: req.params.pair.toUpperCase(), days, series });
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
