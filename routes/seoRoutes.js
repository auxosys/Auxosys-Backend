const express = require("express");
const router = express.Router();
const seoController = require("../controllers/seoController");
const analyticsController = require("../controllers/analyticsController");
const navigationController = require("../controllers/navigationController");
const crawlerController = require("../controllers/crawlerController");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

// Global Settings
router.get("/settings", seoController.getSettings);
router.patch("/settings", seoController.updateSettings);

// Sitemap Settings
router.get("/sitemap", seoController.getSitemapSettings);
router.patch("/sitemap", seoController.updateSitemapSettings);

// Sitemap Links (Custom URL Manager)
router.get("/sitemap-links", seoController.getSitemapLinks);
router.post("/sitemap-links", seoController.upsertSitemapLink);
router.delete("/sitemap-links/:id", seoController.deleteSitemapLink);
router.post("/sitemap-links/bulk", seoController.bulkSitemapLinksAction);
router.post("/sitemap-links/validate", seoController.validateSitemapUrl);

// Google Indexing
router.post("/indexing", seoController.pingGoogleIndexing);

// Google Analytics
router.get("/analytics", analyticsController.getAnalytics);

// Google Search Console & Insights
router.get("/gsc", analyticsController.getGscData);
router.get("/insights", analyticsController.getInsights);
// Redirects
router.get("/redirects", seoController.getRedirects);
router.post("/redirects", seoController.createRedirect);
router.patch("/redirects/:id", seoController.updateRedirect);
router.delete("/redirects/:id", seoController.deleteRedirect);

// Navigation
router.get("/navigation", navigationController.getNavigationLinks);
router.get("/navigation/schema", navigationController.getNavigationSchema);
router.post("/navigation", navigationController.upsertNavigationLink);
router.post("/navigation/reorder", navigationController.reorderNavigationLinks);
router.delete("/navigation/:id", navigationController.deleteNavigationLink);

// Crawler & Issues
router.post("/crawl", crawlerController.triggerCrawl);
router.get("/crawl/history", crawlerController.getCrawlHistory);
router.get("/issues", crawlerController.getSeoIssues);

// Page Level SEO
router.get("/pages", seoController.getPages);
router.get("/pages/:id", seoController.getPageById);
router.get("/page", seoController.getUnifiedPageSeo); // /api/v1/seo/page?slug=/path
router.post("/pages", seoController.upsertPage);
router.put("/pages/:id", seoController.updatePage);
router.delete("/pages/:id", seoController.deletePage);

// System Files
router.get("/files", seoController.getSystemFiles);
router.post("/files", seoController.upsertSystemFile);

// Audit Logs
router.get("/logs", seoController.getAuditLogs);

// Image Upload (generic for OG, Favicon, Logo)
router.post("/upload", upload.single("image"), seoController.uploadImage);

// Overview Scores
router.get("/overview", seoController.getSeoOverview);

// Legacy fallback (for older frontend compatibility if needed temporarily)
router.get("/", seoController.getSettings);

module.exports = router;
