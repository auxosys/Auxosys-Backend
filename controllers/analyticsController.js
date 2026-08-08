const analyticsService = require("../services/googleAnalyticsService");

exports.getAnalytics = async (req, res) => {
  try {
    const result = await analyticsService.getTrafficOverview();
    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }
    return res.status(200).json(result.data);
  } catch (error) {
    console.error("Error in getAnalytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};
