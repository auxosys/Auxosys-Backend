const analyticsService = require("../services/googleAnalyticsService");
const gscService = require("../services/googleSearchConsoleService");
const insightsEngine = require("../services/seoInsightsEngine");

exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await analyticsService.getTrafficOverview(startDate, endDate);
    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }
    return res.status(200).json(result.data);
  } catch (error) {
    console.error("Error in getAnalytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

exports.getGscData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await gscService.getSearchPerformance(startDate, endDate);
    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }
    return res.status(200).json(result.data);
  } catch (error) {
    console.error("Error in getGscData:", error);
    res.status(500).json({ error: "Failed to fetch GSC data" });
  }
};

exports.getInsights = async (req, res) => {
  try {
    // In a real scenario, you might pass an array of URLs to crawl based on the active pages in the DB.
    // We will just pass an empty array for now or a sample URL to trigger technical checks.
    const result = await insightsEngine.generateInsights([]);
    if (!result.success) {
      return res.status(500).json({ error: result.message || "Failed to generate insights" });
    }
    return res.status(200).json(result.data);
  } catch (error) {
    console.error("Error in getInsights:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
};
