import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`FX Advisor API listening on http://localhost:${config.port}`);
  console.log(`  rates provider : ${config.ratesProvider}`);
  console.log(
    `  AI advisor     : ${config.anthropicApiKey ? "enabled" : "disabled (set ANTHROPIC_API_KEY)"}`,
  );
});
