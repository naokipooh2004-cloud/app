import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { analyze } from "../services/analysis.js";
import { getAdvice } from "../services/advisor.js";
import { getPriceSeries } from "../services/rates.js";

export const adviceRouter = Router();

const bodySchema = z.object({
  question: z.string().min(1, "question は必須です").max(4000),
  /** 指定すると、その通貨ペアのテクニカル分析を自動で添えて相談する */
  pair: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .max(20)
    .optional(),
});

/**
 * POST /api/advice
 * body: { question, pair?, history? }
 * AI による FX 学習サポートの回答を返す。pair 指定時はテクニカル分析を同梱。
 */
adviceRouter.post(
  "/advice",
  asyncHandler(async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "リクエストが不正です", details: parsed.error.issues });
      return;
    }
    const { question, pair, history } = parsed.data;

    // pair があればテクニカル分析を付加（取得失敗時は無視して続行）
    let analysis;
    if (pair) {
      try {
        const series = await getPriceSeries(pair, 120);
        if (series.length >= 35) {
          analysis = analyze(pair.toUpperCase(), series);
        }
      } catch {
        // レート取得に失敗しても相談自体は続行する
      }
    }

    const result = await getAdvice({ question, history, analysis });
    res.json({ ...result, analysisIncluded: Boolean(analysis) });
  }),
);
