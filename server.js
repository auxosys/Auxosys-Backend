require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const newsRoutes = require("./routes/newsRoutes");
const authRoutes = require("./routes/authRoutes");
const careerRoutes = require("./routes/careerRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const seoRoutes = require("./routes/seoRoutes");
const accessControlRoutes = require("./routes/accessControlRoutes");
const legalRoutes = require("./routes/legalRoutes");
const contactRoutes = require("./routes/contactRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const { requirePermission } = require("./middleware/rbacMiddleware");

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];
    if (!origin) return callback(null, true);
    if (origin.endsWith(".vercel.app") || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const upload = multer({ dest: "uploads/" });

app.post("/upload", requirePermission, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  res.json({
    success: true,
    data: {
      url: `http://localhost:5002/uploads/${req.file.filename}`,
      key: req.file.filename
    }
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
app.use("/seo", requirePermission, seoRoutes);
app.use("/access-control", requirePermission, accessControlRoutes);
app.use("/legal", requirePermission, legalRoutes);
app.use("/contact", requirePermission, contactRoutes);
app.use("/settings", requirePermission, settingsRoutes);

// Mock notifications
app.get("/notifications/count", (req, res) => res.json({ count: 0 }));

// Health check
app.get("/", (req, res) => {
  res.send("Auxosys Backend with Supabase is running!");
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
