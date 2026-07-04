const supabase = require("../config/supabaseClient");

const MODULE_MAPPING = {
  "/job": "careers",
  "/news": "newsroom",
  "/contact": "contact",
  "/subscriptions": "subscriptions",
};

const SITE_MANAGEMENT = ["/seo", "/settings", "/legal", "/access-control"];

exports.requirePermission = async (req, res, next) => {
  try {
    const baseUrl = req.baseUrl;
    const path = req.path;
    const method = req.method;

    // 0. Bypass for public endpoints (Website)
    const isPublic = 
      (baseUrl === "/job" && method === "GET" && !path.includes("/admin") && !path.includes("/application") && !path.includes("/applicant")) ||
      (baseUrl === "/job" && method === "POST" && path.includes("/apply")) ||
      (baseUrl === "/news" && method === "GET" && !path.includes("/admin")) ||
      (baseUrl === "/contact" && method === "POST") ||
      (baseUrl === "/legal" && method === "GET" && !path.includes("/admin"));

    if (isPublic) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error || new Error("User not found");

    // Superadmin bypass
    if (user.email === "ausosys@gmail.com") {
      req.user = user;
      return next();
    }

    // 1. Site Management Modules -> BLOCK for non-superadmins
    if (SITE_MANAGEMENT.includes(baseUrl)) {
      return res.status(403).json({ success: false, message: "Access Denied: Site Management is restricted to Superadmin." });
    }

    // 2. Overview Modules -> ENFORCE RBAC
    const moduleName = MODULE_MAPPING[baseUrl];
    if (moduleName) {
      // Get user permissions from user_metadata
      const permissions = user.user_metadata?.permissions || [];
      
      let modulePermission = permissions.find(p => p.module === moduleName);
      
      // Backward compatibility for legacy string permissions ["contact", "careers"]
      if (!modulePermission) {
        const hasLegacyString = permissions.some(p => typeof p === 'string' && p === moduleName);
        if (hasLegacyString) {
          modulePermission = { module: moduleName, access: "Read & Write" };
        }
      }

      if (!modulePermission) {
        return res.status(403).json({ success: false, message: `Access Denied: You do not have access to ${moduleName}.` });
      }

      // Check GET vs POST/PUT/DELETE
      if (req.method === "GET") {
        // Read Only or Read & Write allows GET
        if (modulePermission.access === "Read Only" || modulePermission.access === "Read" || modulePermission.access === "Read & Write") {
          req.user = user;
          return next();
        }
      } else {
        // Modifying requests require Read & Write
        if (modulePermission.access === "Read & Write") {
          req.user = user;
          return next();
        }
      }

      return res.status(403).json({ success: false, message: `Access Denied: Requires Read & Write access to ${moduleName}.` });
    }

    // 3. Unprotected or general routes (like /profile)
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
  }
};
