const puppeteer = require("puppeteer");
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

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });

      // 1. Get all URLs to crawl (we'll start by fetching all published pages from seo_pages)
      const { data: pages } = await supabase.from("seo_pages").select("page_slug").eq("status", "Published");
      const urlsToCrawl = pages ? pages.map(p => this.normalizeUrl(p.page_slug)) : [this.baseUrl];

      const results = [];
      let healthyCount = 0;
      let warningCount = 0;
      let criticalCount = 0;

      for (const url of urlsToCrawl) {
        if (!url) continue;
        const pageResult = await this.crawlPage(browser, url);
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
        results, // store the full array or just a summary depending on JSONB limits
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
    } finally {
      if (browser) await browser.close();
    }
  }

  async crawlPage(browser, url) {
    const page = await browser.newPage();
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
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      result.status = response.status();

      if (result.status >= 400) {
        result.critical_issues.push(`Page returned HTTP ${result.status}`);
        await page.close();
        return result;
      }

      // Extract SEO elements
      const extracted = await page.evaluate((baseUrl) => {
        const getMetaContent = (name) => {
          const el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
          return el ? el.getAttribute("content") : null;
        };

        const getCanonical = () => {
          const el = document.querySelector('link[rel="canonical"]');
          return el ? el.getAttribute("href") : null;
        };

        const getH1 = () => {
          const el = document.querySelector('h1');
          return el ? el.innerText.trim() : null;
        };

        const getInternalLinks = (base) => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          const internalUrls = new Set();
          links.forEach(a => {
            try {
              const href = a.getAttribute("href");
              if (href.startsWith('/') || href.startsWith(base)) {
                // Normalize it
                let clean = href.startsWith('http') ? href : base + (href.startsWith('/') ? href : '/' + href);
                clean = clean.split('#')[0]; // remove hash
                if (clean !== base) { // ignore self links mostly, but actually we should just grab all
                   internalUrls.add(clean);
                }
              }
            } catch (e) {}
          });
          return Array.from(internalUrls);
        };

        const getSchema = () => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          const schemas = [];
          scripts.forEach(s => {
            try {
              const json = JSON.parse(s.innerText);
              if (json['@type']) schemas.push(json['@type']);
              else if (json['@graph']) json['@graph'].forEach(g => { if(g['@type']) schemas.push(g['@type']) });
            } catch(e){}
          });
          return schemas;
        };

        return {
          title: document.title,
          description: getMetaContent("description"),
          robots: getMetaContent("robots"),
          canonical: getCanonical(),
          h1: getH1(),
          links: getInternalLinks(baseUrl),
          schema: getSchema()
        };
      }, this.baseUrl);

      result.title = extracted.title;
      result.meta_description = extracted.description;
      result.canonical = extracted.canonical;
      result.h1 = extracted.h1;
      result.robots = extracted.robots;
      result.outgoing_internal_links = extracted.links;
      result.schema = extracted.schema;

      // Basic evaluations
      if (!result.title) result.critical_issues.push("Missing page title");
      if (!result.meta_description) result.warning_issues.push("Missing meta description");
      if (!result.canonical) result.warning_issues.push("Missing canonical URL");
      if (!result.h1) result.warning_issues.push("Missing H1 heading");

    } catch (err) {
      result.critical_issues.push(`Failed to crawl: ${err.message}`);
    } finally {
      await page.close();
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
        newIssues.push({
          priority: "Medium",
          category: issue.includes("Orphan") ? "Internal Linking" : "Metadata",
          title: issue,
          affected_url: r.url,
          source: "LIVE_CRAWLER",
          detected_value: issue.includes("Orphan") ? "0 incoming links" : "Missing",
          evidence: `Crawl at ${new Date().toISOString()}`,
          why_it_matters: "Reduces search visibility and internal crawlability.",
          recommendation: "Review page configuration and internal site structure."
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
