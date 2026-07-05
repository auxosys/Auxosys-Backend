const supabase = require("../config/supabaseClient");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 }); // 60 seconds cache

const calculateTrend = (items) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  let thisMonth = 0;
  let lastMonth = 0;

  items.forEach(item => {
    if (!item.created_at) return;
    const d = new Date(item.created_at);
    if (d >= thirtyDaysAgo) thisMonth++;
    else if (d >= sixtyDaysAgo && d < thirtyDaysAgo) lastMonth++;
  });

  if (lastMonth === 0) return { trend: thisMonth > 0 ? 100 : 0, direction: "neutral" };
  
  const diff = thisMonth - lastMonth;
  const percent = Math.round((diff / lastMonth) * 100);
  
  if (percent === 0) return { trend: 0, direction: "neutral" };
  return {
    trend: Math.abs(percent),
    direction: percent > 0 ? "up" : "down"
  };
};

exports.getDashboard = async (req, res) => {
  try {
    const cacheKey = "admin_dashboard_stats_v2";
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // 1. Get total contacts (from contact_messages)
    const { count: totalContacts, data: allContacts } = await supabase.from("contact_messages").select("id, name, subject, status, created_at", { count: "exact" });
    
    // 2. Get active jobs
    const { count: activeJobs } = await supabase.from("careers").select("id, created_at", { count: "exact" }).eq("status", "Active");

    // 3. Get total job applications
    const { count: jobApplications, data: allApps } = await supabase.from("applications").select("id, firstName, lastName, status, created_at, job:careers(title)", { count: "exact" });

    // 4. Get news/case studies
    const { count: newsCount, data: allNews } = await supabase.from("news").select("id, created_at", { count: "exact" });
    
    // Trends
    const contactTrend = calculateTrend(allContacts || []);
    const appTrend = calculateTrend(allApps || []);
    const newsTrend = calculateTrend(allNews || []);

    // Helper to format dates
    const sortByDateDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    
    const sortedContacts = (allContacts || []).sort(sortByDateDesc);
    const sortedApps = (allApps || []).sort(sortByDateDesc);

    // Recent lists
    const recentContacts = sortedContacts.slice(0, 5);
    const recentApps = sortedApps.slice(0, 5);

    const formattedApps = recentApps.map(app => ({
      id: app.id,
      name: `${app.firstName} ${app.lastName}`,
      jobTitle: app.job?.title || "Unknown",
      status: app.status,
      timestamp: app.created_at
    }));

    const formattedContacts = recentContacts.map(c => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      status: c.status,
      timestamp: c.created_at
    }));

    // Weekly Activity - Real Data for Mon-Sun
    const uiLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const uiDayIndices = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() mapping: 0=Sun, 1=Mon, etc.

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start of the day 7 days ago

    const contactCountsByDay = [0, 0, 0, 0, 0, 0, 0];
    const appCountsByDay = [0, 0, 0, 0, 0, 0, 0];

    sortedContacts.forEach(c => {
      const d = new Date(c.created_at);
      if (d >= sevenDaysAgo) {
        const jsDay = d.getDay();
        const uiIndex = uiDayIndices.indexOf(jsDay);
        if (uiIndex !== -1) contactCountsByDay[uiIndex]++;
      }
    });

    sortedApps.forEach(a => {
      const d = new Date(a.created_at);
      if (d >= sevenDaysAgo) {
        const jsDay = d.getDay();
        const uiIndex = uiDayIndices.indexOf(jsDay);
        if (uiIndex !== -1) appCountsByDay[uiIndex]++;
      }
    });
    
    // Status Aggregation for Contacts
    const statusCounts = {};
    sortedContacts.forEach(c => {
       const status = c.status || 'New';
       statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const contactStatusLabels = Object.keys(statusCounts);
    const contactStatusData = Object.values(statusCounts);

    const realCharts = {
      weeklyActivity: {
        labels: uiLabels,
        series: [
          { name: "Contacts", data: contactCountsByDay },
          { name: "Applications", data: appCountsByDay }
        ]
      },
      contactStatus: {
        labels: contactStatusLabels.length > 0 ? contactStatusLabels : ["No Data"],
        data: contactStatusData.length > 0 ? contactStatusData : [1]
      }
    };

    const dashboardData = {
      kpi: {
        totalContacts: { value: totalContacts || 0, trendDirection: contactTrend.direction, trend: contactTrend.trend },
        activeJobs: { value: activeJobs || 0, label: "Currently open" },
        jobApplications: { value: jobApplications || 0, trendDirection: appTrend.direction, trend: appTrend.trend },
        caseStudies: { value: newsCount || 0, trendDirection: newsTrend.direction, trend: newsTrend.trend }
      },
      charts: realCharts,
      lists: {
        recentContacts: formattedContacts,
        recentApplications: formattedApps
      }
    };

    const responseData = { success: true, data: dashboardData };
    cache.set(cacheKey, responseData);
    res.status(200).json(responseData);
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};
