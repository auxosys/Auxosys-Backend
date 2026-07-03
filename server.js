require("dotenv").config();
const express = require("express");
const cors = require("cors");
const newsRoutes = require("./routes/newsRoutes");
const authRoutes = require("./routes/authRoutes");
const careerRoutes = require("./routes/careerRoutes");

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors({
  origin: ["http://localhost:3002", "http://localhost:3001", "http://localhost:3000"],
  credentials: true
}));
app.use(express.json());

// Routes
app.use("/news", newsRoutes);
app.use("/job", careerRoutes); // Changed from /careers to match frontend /job/admin
app.use("/auth", authRoutes); // Admin login
app.use("/profile", authRoutes); // Admin profile check (profile/me)

// Mock notifications
app.get("/notifications/count", (req, res) => res.json({ count: 0 }));

// Health check
app.get("/", (req, res) => {
  res.send("Auxosys Backend with Supabase is running!");
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
