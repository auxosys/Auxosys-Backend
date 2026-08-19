const gaService = require('./googleAnalyticsService');
const gscService = require('./googleSearchConsoleService');
const crawlerService = require('./seoCrawlerService');

class SeoInsightsEngine {
  /**
   * Generates dynamic Action Required issues based on real data.
   */
  async generateInsights(urlsToCrawl = []) {
    const issues = [];
    const GA_MIN_VIEWS = 50; // Minimum data safeguard

    // 1. Fetch GA4 Page Performance
    // In a real scenario we might compare previous 30 days to last 30 days.
    const gaRes = await gaService.getPagePerformance('30daysAgo', 'today');
    if (gaRes.success && gaRes.data.length > 0) {
      gaRes.data.forEach(page => {
        // High Bounce Rate check
        if (page.pageViews >= GA_MIN_VIEWS && page.bounceRate > 80) {
          issues.push({
            severity: 'Warning',
            page: page.pagePath,
            metric: 'Bounce Rate',
            currentValue: `${page.bounceRate.toFixed(1)}%`,
            previousValue: 'N/A', // Require historical fetch for real diff
            change: 'N/A',
            dateRange: 'Last 30 Days',
            dataSource: 'Google Analytics 4',
            confidenceLevel: page.pageViews > 500 ? 'High' : 'Medium',
            explanation: `Observed a high bounce rate (${page.bounceRate.toFixed(1)}%) with ${page.pageViews} views.`,
            recommendedAction: 'Review page content intent matching, loading speed, and mobile responsiveness.',
            type: 'behavioral'
          });
        }
      });
    }

    // 2. Fetch GSC Page Performance
    const gscRes = await gscService.getPagePerformance('30daysAgo', 'today');
    if (gscRes.success && gscRes.data.length > 0) {
      gscRes.data.forEach(row => {
        const page = row.keys[0];
        const ctr = (row.clicks / row.impressions) * 100;
        const impressions = row.impressions;

        if (impressions > 1000 && ctr < 1.0) {
          issues.push({
            severity: 'Warning',
            page: page,
            metric: 'Click-Through Rate (CTR)',
            currentValue: `${ctr.toFixed(2)}%`,
            previousValue: 'N/A',
            change: 'N/A',
            dateRange: 'Last 30 Days',
            dataSource: 'Google Search Console',
            confidenceLevel: impressions > 5000 ? 'High' : 'Medium',
            explanation: `Page has high impressions (${impressions}) but very low CTR (${ctr.toFixed(2)}%).`,
            recommendedAction: 'Optimize meta title and description to improve SERP clickability.',
            type: 'organic'
          });
        }
      });
    }

    // 3. Technical SEO Crawl
    if (urlsToCrawl.length > 0) {
      const crawlResults = await crawlerService.crawlSite(urlsToCrawl);
      crawlResults.forEach(res => {
        if (res.success && res.data.issues) {
          res.data.issues.forEach(issue => {
            issues.push({
              severity: issue.severity,
              page: res.data.url,
              metric: issue.metric,
              currentValue: 'Issue Detected',
              previousValue: 'N/A',
              change: 'N/A',
              dateRange: 'Live Scan',
              dataSource: 'Technical SEO Crawler',
              confidenceLevel: 'High',
              explanation: issue.description,
              recommendedAction: 'Fix technical SEO metadata according to best practices.',
              type: 'technical'
            });
          });
        }
      });
    }

    return { success: true, data: issues };
  }
}

module.exports = new SeoInsightsEngine();
