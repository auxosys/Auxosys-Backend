const fetch = require('node-fetch'); // Assuming node-fetch or native fetch is available (native fetch available in Node 18+)

class SeoCrawlerService {
  /**
   * Extremely lightweight crawler to fetch a URL and analyze its HTML for basic Technical SEO.
   */
  async crawlUrl(url) {
    try {
      // Use native fetch (Node 18+)
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Auxosys-Internal-Crawler/1.0' }
      });
      
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          message: `Crawler received status ${response.status}`,
          data: null
        };
      }

      const html = await response.text();

      // Simple Regex parsing for lightweight crawling
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) 
                            || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
      const schemaMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

      const title = titleMatch ? titleMatch[1].trim() : null;
      const description = descriptionMatch ? descriptionMatch[1].trim() : null;
      const schema = schemaMatch ? schemaMatch[1].trim() : null;
      const h1 = h1Match ? h1Match[1].trim() : null;

      // Identify issues
      const issues = [];
      if (!title) issues.push({ metric: 'Missing Title', severity: 'High', description: 'Page is missing a <title> tag.' });
      else if (title.length < 10) issues.push({ metric: 'Short Title', severity: 'Medium', description: 'Title is too short.' });
      else if (title.length > 60) issues.push({ metric: 'Long Title', severity: 'Low', description: 'Title exceeds optimal length.' });

      if (!description) issues.push({ metric: 'Missing Meta Description', severity: 'High', description: 'Page is missing a meta description.' });
      
      if (!schema) issues.push({ metric: 'Missing Schema', severity: 'Medium', description: 'No structured data found on the page.' });

      return {
        success: true,
        statusCode: 200,
        data: {
          url,
          title,
          description,
          hasSchema: !!schema,
          h1,
          issues
        }
      };

    } catch (error) {
      console.error(`Crawler Error for ${url}:`, error);
      return {
        success: false,
        statusCode: 500,
        message: error.message,
        data: null
      };
    }
  }

  /**
   * Crawl a list of URLs and aggregate the results
   */
  async crawlSite(urls) {
    const results = [];
    for (const url of urls) {
      const result = await this.crawlUrl(url);
      results.push(result);
    }
    return results;
  }
}

module.exports = new SeoCrawlerService();
