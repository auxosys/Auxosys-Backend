const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleSearchConsoleService {
  constructor() {
    this.keyFilePath = path.join(__dirname, '../google-credentials.json');
    this.isConfigured = fs.existsSync(this.keyFilePath);
    this.siteUrl = 'sc-domain:auxosys.com'; // Using domain property
  }

  async getClient() {
    if (!this.isConfigured) {
      throw new Error("Google Search Console API is not configured (missing google-credentials.json)");
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: this.keyFilePath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    return google.webmasters({ version: 'v3', auth });
  }

  getFormattedDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  }

  calculatePerformanceScore(ctr, avgPosition) {
    let ctrScore = Math.min((ctr / 0.05) * 50, 50);
    let positionScore = Math.max(0, 50 - ((avgPosition - 1) * (50 / 49)));
    
    if (isNaN(ctrScore)) ctrScore = 0;
    if (isNaN(positionScore)) positionScore = 0;

    return {
      total: Math.round(ctrScore + positionScore),
      factors: {
        ctrPoints: Math.round(ctrScore),
        positionPoints: Math.round(positionScore),
        maxCtrPoints: 50,
        maxPositionPoints: 50,
        ctrThreshold: '5%',
        positionThreshold: '1 to 50'
      }
    };
  }

  async getSearchPerformance(startDateStr, endDateStr) {
    try {
      const searchconsole = await this.getClient();
      const startDate = startDateStr || this.getFormattedDate(30);
      const endDate = endDateStr || this.getFormattedDate(0);

      const response = await searchconsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: startDate,
          endDate: endDate,
          dimensions: ['date'],
          rowLimit: 100,
        },
      });

      let totalClicks = 0;
      let totalImpressions = 0;
      let sumPosition = 0;
      let count = 0;
      const chartData = [];

      if (response.data.rows && response.data.rows.length > 0) {
        response.data.rows.forEach(row => {
          totalClicks += row.clicks;
          totalImpressions += row.impressions;
          sumPosition += row.position;
          count++;

          chartData.push({
            name: row.keys[0], // Date
            clicks: row.clicks,
            impressions: row.impressions
          });
        });

        const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
        const avgPosition = count > 0 ? sumPosition / count : 0;
        const scoreData = this.calculatePerformanceScore(avgCtr, avgPosition);

        return {
          success: true,
          data: {
            chartData,
            summary: {
              clicks: totalClicks,
              impressions: totalImpressions,
              ctr: `${(avgCtr * 100).toFixed(2)}%`,
              avgPosition: avgPosition.toFixed(1),
              score: scoreData.total,
              scoreFactors: scoreData.factors
            }
          }
        };
      }

      return {
        success: true,
        data: {
          chartData: [],
          summary: { clicks: 0, impressions: 0, ctr: '0%', avgPosition: '0', score: 0, scoreFactors: { ctrPoints: 0, positionPoints: 0 } }
        }
      };

    } catch (error) {
      console.error('GSC API Error:', error);
      return { success: false, message: error.message || 'Failed to fetch GSC data' };
    }
  }

  async getPagePerformance(startDateStr, endDateStr) {
    try {
      const searchconsole = await this.getClient();
      const startDate = startDateStr || this.getFormattedDate(30);
      const endDate = endDateStr || this.getFormattedDate(0);

      const response = await searchconsole.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: startDate,
          endDate: endDate,
          dimensions: ['page'],
          rowLimit: 50,
        },
      });

      return { success: true, data: response.data.rows || [] };
    } catch (error) {
      console.error('GSC Page API Error:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new GoogleSearchConsoleService();
