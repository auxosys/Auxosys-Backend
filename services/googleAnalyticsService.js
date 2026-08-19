const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');
const fs = require('fs');

class GoogleAnalyticsService {
  constructor() {
    this.keyFilePath = path.join(__dirname, '../google-credentials.json');
    this.isConfigured = fs.existsSync(this.keyFilePath);
    this.propertyId = '549135557'; // From the user
  }

  async getClient() {
    if (!this.isConfigured) {
      throw new Error("Google Analytics API is not configured (missing google-credentials.json)");
    }
    const analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: this.keyFilePath,
    });
    return analyticsDataClient;
  }

  async getTrafficOverview(startDate = '30daysAgo', endDate = 'today') {
    try {
      if (!this.isConfigured) {
        return {
          success: true,
          data: {
            chartData: [],
            summary: { uniqueVisitors: 0, totalPageviews: 0, bounceRate: '0%', avgSession: '0m 0s' }
          }
        };
      }
      
      const client = await this.getClient();
      
      const [response] = await client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: startDate,
            endDate: endDate,
          },
        ],
        dimensions: [
          {
            name: 'date',
          },
        ],
        metrics: [
          {
            name: 'activeUsers', // Unique Visitors
          },
          {
            name: 'screenPageViews', // Total Pageviews
          },
          {
            name: 'bounceRate',
          },
          {
            name: 'averageSessionDuration',
          }
        ],
        orderBys: [
          {
            dimension: { dimensionName: 'date' }
          }
        ]
      });

      // Format response data
      let totalVisitors = 0;
      let totalPageViews = 0;
      let totalBounceRate = 0;
      let totalSessionDuration = 0;
      const chartData = [];

      if (response.rows && response.rows.length > 0) {
        response.rows.forEach(row => {
          // Parse date YYYYMMDD
          const dateStr = row.dimensionValues[0].value;
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          
          const date = new Date(year, month - 1, day);
          const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const visitors = parseInt(row.metricValues[0].value, 10);
          const pageViews = parseInt(row.metricValues[1].value, 10);
          
          totalVisitors += visitors;
          totalPageViews += pageViews;
          totalBounceRate += parseFloat(row.metricValues[2].value);
          totalSessionDuration += parseFloat(row.metricValues[3].value);

          chartData.push({
            name: formattedDate,
            visitors: visitors
          });
        });

        // Calculate averages
        const count = response.rows.length;
        const avgBounceRate = (totalBounceRate / count * 100).toFixed(1); // GA returns decimal like 0.42
        
        const avgDurationSeconds = totalSessionDuration / count;
        const minutes = Math.floor(avgDurationSeconds / 60);
        const seconds = Math.floor(avgDurationSeconds % 60);
        const avgSessionFormatted = `${minutes}m ${seconds}s`;

        return {
          success: true,
          data: {
            chartData,
            summary: {
              uniqueVisitors: totalVisitors,
              totalPageviews: totalPageViews,
              bounceRate: `${avgBounceRate}%`,
              avgSession: avgSessionFormatted
            }
          }
        };
      }

      // If no data
      return {
        success: true,
        data: {
          chartData: [],
          summary: {
            uniqueVisitors: 0,
            totalPageviews: 0,
            bounceRate: '0%',
            avgSession: '0m 0s'
          }
        }
      };

    } catch (error) {
      console.error('Google Analytics API Error:', error);
      // Return empty data instead of failing so the frontend doesn't show a 500 error
      return {
        success: true,
        data: {
          chartData: [],
          summary: { uniqueVisitors: 0, totalPageviews: 0, bounceRate: '0%', avgSession: '0m 0s' }
        }
      };
    }
  }
  async getPagePerformance(startDate = '30daysAgo', endDate = 'today') {
    try {
      if (!this.isConfigured) {
        return { success: true, data: [] };
      }
      
      const client = await this.getClient();
      
      const [response] = await client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' }
        ],
        orderBys: [
          { metric: { metricName: 'activeUsers' }, desc: true }
        ],
        limit: 50 // Top 50 pages
      });

      const pages = [];
      if (response.rows && response.rows.length > 0) {
        response.rows.forEach(row => {
          pages.push({
            pagePath: row.dimensionValues[0].value,
            activeUsers: parseInt(row.metricValues[0].value, 10),
            pageViews: parseInt(row.metricValues[1].value, 10),
            bounceRate: parseFloat(row.metricValues[2].value),
            avgSessionDuration: parseFloat(row.metricValues[3].value)
          });
        });
      }

      return { success: true, data: pages };
    } catch (error) {
      console.error('GA API Error (Page Performance):', error);
      return { success: true, data: [] };
    }
  }
}

module.exports = new GoogleAnalyticsService();
