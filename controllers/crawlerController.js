const crawlerService = require("../services/crawlerService");
const supabase = require("../config/supabaseClient");

exports.triggerCrawl = async (req, res) => {
  try {
    // Start crawl asynchronously so we don't block the HTTP request if it takes a while
    // For small sites it's fast, but better to return 202 Accepted
    crawlerService.runCrawl().catch(console.error);
    
    res.status(202).json({ success: true, message: "Crawl started in the background" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCrawlHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("seo_crawl_history")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
      
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return res.status(200).json({ success: true, data: [] });
      throw error;
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSeoIssues = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("seo_issues")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return res.status(200).json({ success: true, data: [] });
      throw error;
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
