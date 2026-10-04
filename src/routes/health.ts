import { Router } from "express";
import { config } from "../config.js";
import { isAdvisorConfigured } from "../services/advisor.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    features: {
      aiAdvisor: isAdvisorConfigured(),
      ratesProvider: config.ratesProvider,
    },
  });
});
