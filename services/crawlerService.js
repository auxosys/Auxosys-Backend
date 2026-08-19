const axios = require("axios");
const cheerio = require("cheerio");
const supabase = require("../config/supabaseClient");
const { URL } = require("url");

class CrawlerService {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.auxosys.com";
  }

  async runCrawl() {
    // Record start of crawl
    let crawlSession;
    try {
      const { data, error } = await supabase.from("seo_crawl_history").insert([{
        crawl_status: "running",
        started_at: new Date()
      }]).select().single();
      
      if (error) throw error;
      crawlSession = data;
    } catch (e) {
      console.error("Failed to start crawl session", e);
      return { success: false, message: "Could not initialize crawl" };
    }

    try {
      // 1. Get all URLs to crawl (we'll start by fetching all published pages from seo_pages)
      const { data: pages } = await supabase.from("seo_pages").select("page_slug").eq("status", "Published");
      const urlsToCrawl = pages ? pages.map(p => this.normalizeUrl(p.page_slug)) : [this.baseUrl];

      const results = [];
      let healthyCount = 0;
      let warningCount = 0;
      let criticalCount = 0;

      for (const url of urlsToCrawl) {
        if (!url) continue;
        const pageResult = await this.crawlPage(url);
        results.push(pageResult);
        
        if (pageResult.status >= 400 || pageResult.critical_issues.length > 0) {
          criticalCount++;
        } else if (pageResult.warning_issues.length > 0) {
          warningCount++;
        } else {
          healthyCount++;
        }
      }

      // Calculate internal links cross-reference (detect orphans)
      this.analyzeInternalLinks(results);

      // Finish session
      const metricsSummary = {
        results, 
        overall_health: Math.round((healthyCount / (urlsToCrawl.length || 1)) * 100)
      };

      await supabase.from("seo_crawl_history").update({
        crawl_status: "completed",
        completed_at: new Date(),
        total_urls: urlsToCrawl.length,
        healthy_urls: healthyCount,
        warning_urls: warningCount,
        critical_urls: criticalCount,
        metrics_summary: metricsSummary
      }).eq("id", crawlSession.id);

      // Trigger issue generation
      await this.generateIssuesFromCrawl(results);

      return { success: true, data: metricsSummary };

    } catch (err) {
      console.error("Crawl error:", err);
      if (crawlSession) {
         await supabase.from("seo_crawl_history").update({
           crawl_status: "failed",
           completed_at: new Date(),
           metrics_summary: { error: err.message }
         }).eq("id", crawlSession.id);
      }
      return { success: false, message: err.message };
    }
  }

  async crawlPage(url) {
    const result = {
      url,
      status: 500,
      title: null,
      meta_description: null,
      h1: null,
      canonical: null,
      robots: null,
      outgoing_internal_links: [],
      schema: [],
      critical_issues: [],
      warning_issues: []
    };

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true // Resolve all HTTP statuses
      });
      result.status = response.status;

      if (result.status >= 400) {
        result.critical_issues.push(`Page returned HTTP ${result.status}`);
        return result;
      }

      const $ = cheerio.load(response.data);

      const getMetaContent = (name) => {
        return $(`meta[name="${name}"]`).attr("content") || $(`meta[property="${name}"]`).attr("content") || null;
      };

      const getCanonical = () => {
        return $('link[rel="canonical"]').attr("href") || null;
      };

      const getH1 = () => {
        return $('h1').first().text().trim() || null;
      };

      const getInternalLinks = (base) => {
        const internalUrls = new Set();
        $('a[href]').each((_, el) => {
          try {
            const href = $(el).attr("href");
            if (href && (href.startsWith('/') || href.startsWith(base))) {
              let clean = href.startsWith('http') ? href : base + (href.startsWith('/') ? href : '/' + href);
              clean = clean.split('#')[0];
              if (clean !== base) {
                 internalUrls.add(clean);
              }
            }
          } catch (e) {}
        });
        return Array.from(internalUrls);
      };

      const getSchema = () => {
        const schemas = [];
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const json = JSON.parse($(el).html());
            if (json['@type']) schemas.push(json['@type']);
            else if (json['@graph']) json['@graph'].forEach(g => { if(g['@type']) schemas.push(g['@type']) });
          } catch(e){}
        });
        return schemas;
      };

      result.title = $('title').text() || null;
      result.meta_description = getMetaContent("description");
      result.canonical = getCanonical();
      result.h1 = getH1();
      result.robots = getMetaContent("robots");
      result.outgoing_internal_links = getInternalLinks(this.baseUrl);
      result.schema = getSchema();

      // Basic SEO evaluations
      if (!result.title) result.critical_issues.push("Missing page title");
      if (!result.meta_description) result.warning_issues.push("Missing meta description");
      if (!result.canonical) result.warning_issues.push("Missing canonical URL");
      if (!result.h1) result.warning_issues.push("Missing H1 heading");

      // GEO / AEO evaluations (Generative & Answer Engine Optimization)
      const hasFAQSchema = result.schema.includes("FAQPage") || result.schema.includes("QAPage");
      const hasArticleSchema = result.schema.includes("Article") || result.schema.includes("NewsArticle");
      let hasQuestionHeading = false;
      $('h2, h3').each((_, el) => {
        const text = $(el).text().toLowerCase();
        if (text.includes("what is") || text.includes("how to") || text.includes("why") || text.includes("?")) {
          hasQuestionHeading = true;
        }
      });
      
      if (!hasFAQSchema && !hasQuestionHeading) {
        result.warning_issues.push("Missing GEO/AEO signals: No FAQ schema or question-based headings found");
      }

      // ASO evaluations (App Store Optimization / Smart App Banners)
      const hasAppBanner = $('meta[name="apple-itunes-app"]').length > 0 || $('meta[name="google-play-app"]').length > 0;
      const isAppPage = result.url.includes('/app') || result.url.includes('/download');
      if (isAppPage && !hasAppBanner) {
        result.warning_issues.push("Missing ASO signals: No Smart App Banner meta tags found on an app page");
      }

    } catch (err) {
      result.critical_issues.push(`Failed to crawl: ${err.message}`);
    }
    
    return result;
  }

  analyzeInternalLinks(results) {
    // Create a map of incoming links for every URL
    const incomingMap = {};
    results.forEach(r => {
      incomingMap[r.url] = incomingMap[r.url] || 0; // initialize
      r.outgoing_internal_links.forEach(link => {
        incomingMap[link] = (incomingMap[link] || 0) + 1;
      });
    });

    // Assign back to results and flag orphans
    results.forEach(r => {
      r.incoming_internal_links_count = incomingMap[r.url] || 0;
      if (r.url !== this.baseUrl && r.incoming_internal_links_count === 0 && r.status === 200) {
        r.warning_issues.push("Orphan page (0 incoming internal links)");
      }
    });
  }

  async generateIssuesFromCrawl(results) {
    // Clear old crawler issues
    await supabase.from("seo_issues").delete().eq("source", "LIVE_CRAWLER");
    
    const newIssues = [];
    results.forEach(r => {
      r.critical_issues.forEach(issue => {
        newIssues.push({
          priority: "Critical",
          category: "Technical",
          title: issue,
          affected_url: r.url,
          source: "LIVE_CRAWLER",
          detected_value: "Missing/Error",
          evidence: `Crawl at ${new Date().toISOString()}`,
          why_it_matters: "Critical technical errors prevent Google from crawling or understanding the page.",
          recommendation: "Fix the technical issue immediately."
        });
      });

      r.warning_issues.forEach(issue => {
        let category = "Metadata";
        if (issue.includes("Orphan")) category = "Internal Linking";
        else if (issue.includes("GEO/AEO")) category = "GEO/AEO Optimization";
        else if (issue.includes("ASO")) category = "ASO Optimization";

        newIssues.push({
          priority: "Medium",
          category: category,
          title: issue,
          affected_url: r.url,
          source: "LIVE_CRAWLER",
          detected_value: issue.includes("Orphan") ? "0 incoming links" : "Missing",
          evidence: `Crawl at ${new Date().toISOString()}`,
          why_it_matters: category.includes("GEO") ? "Reduces visibility in AI search engines and answer boxes." : "Reduces search visibility and internal crawlability.",
          recommendation: category.includes("GEO") ? "Add FAQ schema and conversational Q&A headings." : "Review page configuration."
        });
      });
    });

    if (newIssues.length > 0) {
      await supabase.from("seo_issues").insert(newIssues);
    }
  }

  normalizeUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const clean = path.startsWith('/') ? path : '/' + path;
    return `${this.baseUrl}${clean}`;
  }
}

module.exports = new CrawlerService();
