import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getEvents } from "../services/calendar.js";

export const calendarRouter = Router();

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  importance: z.enum(["low", "medium", "high"]).optional(),
  currency: z.string().length(3).optional(),
});

/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&importance=high&currency=JPY
 * 期間内の（目安の）経済指標イベントを返す。
 */
calendarRouter.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "クエリが不正です", details: parsed.error.issues });
      return;
    }
    const result = getEvents(parsed.data);
    res.json(result);
  }),
);
