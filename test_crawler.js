require("dotenv").config();
const crawlerService = require("./services/crawlerService");

(async () => {
  console.log("Starting crawl test...");
  const result = await crawlerService.runCrawl();
  console.log("Crawl result:", JSON.stringify(result, null, 2));
  process.exit(0);
})();
