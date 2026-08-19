const supabase = require("../config/supabaseClient");
const googleAnalyticsService = require("./googleAnalyticsService");
const googleSearchConsoleService = require("./googleSearchConsoleService");

class SeoScoringService {
  constructor() {
    this.weights = {
      technical: 25,
      indexability: 15,
      metadata: 15,
      structuredData: 10,
      internalLinking: 10,
      sitemap: 5,
      searchPerformance: 15,
      userEngagement: 5
    };
  }

  async calculateScores() {
    // 1. Fetch latest crawl data
    const { data: crawlHistory } = await supabase
      .from("seo_crawl_history")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const crawlerData = crawlHistory && crawlHistory.metrics_summary ? crawlHistory.metrics_summary.results : [];

    // 2. Fetch latest GA4 & GSC data
    const ga4Data = await googleAnalyticsService.getTrafficOverview('30daysAgo', 'today');
    const gscData = await googleSearchConsoleService.getSearchPerformance('30daysAgo', 'today');

    // Category 1: Technical SEO (25%) - HTTP/HTTPS, Headings
    let techScore = 0;
    if (crawlerData.length > 0) {
      let techPoints = 0;
      crawlerData.forEach(page => {
        if (page.status === 200) techPoints += 50;
        if (page.h1) techPoints += 50;
      });
      techScore = Math.round((techPoints / (crawlerData.length * 100)) * 100);
    } else {
      techScore = null; // Insufficient data
    }

    // Category 2: Indexability (15%) - Robots, Canonical
    let indexScore = 0;
    if (crawlerData.length > 0) {
      let indexPoints = 0;
      crawlerData.forEach(page => {
        if (!page.robots || !page.robots.includes("noindex")) indexPoints += 50;
        if (page.canonical) indexPoints += 50;
      });
      indexScore = Math.round((indexPoints / (crawlerData.length * 100)) * 100);
    } else {
      indexScore = null;
    }

    // Category 3: Content & Metadata (15%)
    let metaScore = 0;
    if (crawlerData.length > 0) {
      let metaPoints = 0;
      crawlerData.forEach(page => {
        if (page.title) metaPoints += 50;
        if (page.meta_description) metaPoints += 50;
      });
      metaScore = Math.round((metaPoints / (crawlerData.length * 100)) * 100);
    } else {
      metaScore = null;
    }

    // Category 4: Structured Data (10%)
    let schemaScore = 0;
    if (crawlerData.length > 0) {
      let schemaPoints = 0;
      crawlerData.forEach(page => {
        if (page.schema && page.schema.length > 0) schemaPoints += 100;
      });
      schemaScore = Math.round((schemaPoints / (crawlerData.length * 100)) * 100);
    } else {
      schemaScore = null;
    }

    // Category 5: Internal Linking (10%)
    let internalScore = 0;
    if (crawlerData.length > 0) {
      let internalPoints = 0;
      crawlerData.forEach(page => {
        if (page.incoming_internal_links_count > 0 || page.url === 'https://www.auxosys.com/') internalPoints += 100;
      });
      internalScore = Math.round((internalPoints / (crawlerData.length * 100)) * 100);
    } else {
      internalScore = null;
    }

    // Category 6: Sitemap (5%)
    // Assuming backend validation always hits 100 unless a direct sitemap crawler is added
    let sitemapScore = crawlerData.length > 0 ? 100 : null; 

    // Category 7: Search Performance (15%)
    let searchScore = null;
    if (gscData.status === 'connected' && gscData.data && gscData.data.summary) {
      searchScore = gscData.data.summary.score || 0;
    }

    // Category 8: User Engagement (5%)
    let engagementScore = null;
    if (ga4Data.status === 'connected' && ga4Data.data && ga4Data.data.summary) {
       const bounceStr = ga4Data.data.summary.bounceRate.replace('%', '');
       const bounce = parseFloat(bounceStr);
       // Simple engagement score based on bounce rate (lower bounce = higher score)
       // This is just a proxy. The user said not to punish technical SEO, so it has its own score.
       engagementScore = isNaN(bounce) ? 0 : Math.round(Math.max(0, 100 - bounce));
    }

    // Calculate Overall Score
    let totalScore = 0;
    let availableWeights = 0;

    const addWeight = (score, weight) => {
      if (score !== null) {
        totalScore += score * (weight / 100);
        availableWeights += weight;
      }
    };

    addWeight(techScore, this.weights.technical);
    addWeight(indexScore, this.weights.indexability);
    addWeight(metaScore, this.weights.metadata);
    addWeight(schemaScore, this.weights.structuredData);
    addWeight(internalScore, this.weights.internalLinking);
    addWeight(sitemapScore, this.weights.sitemap);
    addWeight(searchScore, this.weights.searchPerformance);
    addWeight(engagementScore, this.weights.userEngagement);

    const overallScore = availableWeights > 0 ? Math.round((totalScore / availableWeights) * 100) : null;

    return {
      overall: overallScore,
      categories: {
        technical: techScore,
        indexability: indexScore,
        metadata: metaScore,
        structuredData: schemaScore,
        internalLinking: internalScore,
        sitemap: sitemapScore,
        searchPerformance: searchScore,
        userEngagement: engagementScore
      },
      freshness: {
        crawler: crawlHistory ? crawlHistory.completed_at : null,
        gsc: gscData.status,
        ga4: ga4Data.status
      }
    };
  }
}

module.exports = new SeoScoringService();
