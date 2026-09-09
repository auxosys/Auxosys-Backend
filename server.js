require("dotenv").config();
const dns = require("dns");
try { dns.setDefaultResultOrder("ipv4first"); } catch (e) {}
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const path = require("path");
const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const app = express();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const newsRoutes = require("./routes/newsRoutes");
const authRoutes = require("./routes/authRoutes");
const careerRoutes = require("./routes/careerRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const seoRoutes = require("./routes/seoRoutes");
const accessControlRoutes = require("./routes/accessControlRoutes");
const legalRoutes = require("./routes/legalRoutes");
const contactRoutes = require("./routes/contactRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const configRoutes = require("./routes/configRoutes");
const cookieRoutes = require("./routes/cookieRoutes");
const certificateRoutes = require("./routes/certificates");
const signatureRoutes = require("./routes/signatures");
const verifyRoutes = require("./routes/verify");
const offerLetterRoutes = require("./routes/offerLetterRoutes");
const clientRoutes = require("./routes/clientRoutes");
const { requirePermission } = require("./middleware/rbacMiddleware");

const PORT = process.env.PORT || 5002;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const norm = origin.toLowerCase();
    if (
      norm.includes("auxosys.com") ||
      norm.includes("onrender.com") ||
      norm.endsWith(".vercel.app") ||
      norm.includes("localhost") ||
      norm.includes("127.0.0.1")
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "auxosys",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "svg", "gif"],
  },
});

const upload = multer({ storage: storage });

app.post("/upload", requirePermission, (req, res) => {
  const uploadHandler = upload.single("file");
  uploadHandler(req, res, function (err) {
    if (err) {
      console.error("Cloudinary Upload Error:", err);
      return res.status(500).json({ 
        success: false, 
        message: err.message || "Cloudinary upload failed. Check API keys." 
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    res.json({
      success: true,
      data: {
        url: req.file.path, // Cloudinary URL
        key: req.file.filename // Cloudinary public_id
      }
    });
  });
});

// Routes
app.use("/auth", authRoutes);
app.use("/profile", authRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
const contactController = require("./controllers/contactController");
const subscriptionController = require("./controllers/subscriptionController");
const legalController = require("./controllers/legalController");

// Public API Routes
app.post("/public/contact", contactController.createMessage);
app.post("/public/subscribe", subscriptionController.createSubscription);
app.get("/public/legal", legalController.getPublicLegalPages);
app.get("/public/legal/:slug", legalController.getPublicPageBySlug);
app.get("/public/contact-debug", async (req, res) => {
  const supabase = require("./config/supabaseClient");
  const { data, error } = await supabase.from("contact_messages").select("*").limit(1);
  res.json({ data, error });
});

// Protected Admin Routes
app.use("/dashboard", requirePermission, dashboardRoutes);
app.use("/job", requirePermission, careerRoutes);
app.use("/news", requirePermission, newsRoutes);
app.use("/subscriptions", requirePermission, subscriptionRoutes);
app.use("/api/v1/seo", requirePermission, seoRoutes);
app.use("/access-control", requirePermission, accessControlRoutes);
app.use("/legal", requirePermission, legalRoutes);
app.use("/contact", requirePermission, contactRoutes);
app.use("/settings", requirePermission, settingsRoutes);
app.use("/config", requirePermission, configRoutes);
app.use("/cookies", cookieRoutes);
app.use("/api/certificates/signatures", requirePermission, signatureRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/offer-letters", requirePermission, offerLetterRoutes);
app.use("/api/clients", requirePermission, clientRoutes);

// Mailbox & Outreach Routes
const makeOutreachRouter = require("./routes/outreach");
const makeTrackingRouter = require("./routes/tracking");
const makeWebhookRouter = require("./routes/webhookRoutes");
const mailboxRoutes = require("./routes/mailboxes");
const messageRoutes = require("./routes/messages");
const supabaseClient = require("./config/supabaseClient");
const { CampaignQueueWorker } = require("./services/campaignQueue");
const { syncGmailPastMessagesInternal } = require("./controllers/messageController");

const campaignWorker = new CampaignQueueWorker(supabaseClient);
campaignWorker.start();

// 2-Way Real-time Gmail Sync Worker (every 30 seconds)
setInterval(() => {
  syncGmailPastMessagesInternal(supabaseClient, 50, 'ALL').catch(err => {
    console.warn('[GmailSyncWorker] Periodic sync warning:', err.message);
  });
}, 30000);

app.use("/api/mailboxes", mailboxRoutes);
app.use("/api/mailboxes", messageRoutes);
app.use("/api/outreach", makeOutreachRouter(supabaseClient));
app.use("/api/track", makeTrackingRouter(supabaseClient));
app.use("/api/webhooks", makeWebhookRouter());


// Mock notifications
app.get("/notifications/count", (req, res) => res.json({ count: 0 }));

// Health check & AWS ALB probes
const { checkDatabaseHealth, dbDriver, closePool } = require("./config/database");

app.get("/", (req, res) => {
  res.send("Auxosys Backend Service is running!");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    driver: dbDriver,
    environment: process.env.NODE_ENV || "development"
  });
});

app.get("/health/ready", (req, res) => {
  res.status(200).json({ status: "ready" });
});

app.get("/health/db", async (req, res) => {
  const health = await checkDatabaseHealth();
  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

const http = require("http");
const { createSocketServer } = require("./websocket/socketServer");

const server = http.createServer(app);
const io = createSocketServer(server);
app.set("io", io);

server.listen(PORT, () => {
  console.log(`Auxosys Backend running on port ${PORT} [DB Driver: ${dbDriver}]`);
});

// Graceful Shutdown for AWS ECS / ALB / Docker containers
const handleGracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down server gracefully...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    await closePool();
    console.log("Database connection pools closed.");
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error("Forced shutdown after 10 seconds timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

module.exports = app;
