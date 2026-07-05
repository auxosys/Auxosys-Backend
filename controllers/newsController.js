const supabase = require("../config/supabaseClient");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 });

// GET /api/news
exports.getAllNews = async (req, res) => {
  try {
    const cacheKey = `allNews_${req.query.category || 'all'}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    let query = supabase
      .from("news")
      .select("*")
      .order("published_at", { ascending: false });
    
    if (req.query.category && req.query.category !== "All") {
      query = query.eq("category", req.query.category);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    const responseData = { success: true, data: data || [], totalPages: 1 };
    cache.set(cacheKey, responseData);
    res.status(200).json(responseData);
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// GET /api/news/:slug
exports.getNewsBySlug = async (req, res) => {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.slug);
    const { data: post, error } = await supabase
      .from("news")
      .select("*")
      .eq(isUUID ? "id" : "slug", req.params.slug)
      .single();
      
    if (error) throw error;
    if (!post) return res.status(404).json({ success: false, message: "News not found" });

    let related = [];
    if (post.category) {
      const { data: relatedData } = await supabase
        .from("news")
        .select("*")
        .eq("category", post.category)
        .neq("id", post.id)
        .limit(4);
      related = relatedData || [];
    }
    res.status(200).json({ success: true, data: { post, related } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// POST /api/news
exports.createNews = async (req, res) => {
  try {
    // Destructure and map form field names → DB column names
    const {
      author,       // form sends 'author', DB uses 'authorName'
      summary,      // form sends 'summary', DB uses 'excerpt'
      publishedAt,
      featuredImageUrl,
      relatedPage,
      seo,
      ...rest
    } = req.body;

    const slug = rest.title ? rest.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4) : 'post-' + Date.now();
    
    const newPost = {
      ...rest,
      slug: slug,
      authorName: author || "AUXOSYS Editorial",
      excerpt: summary || "",
      published_at: publishedAt || new Date().toISOString(),
    };

    // Add optional fields only if present
    if (relatedPage) newPost.relatedPage = relatedPage;
    if (seo) {
      try {
        const parsed = typeof seo === "string" ? JSON.parse(seo) : seo;
        // Only store SEO if at least one field has a real value
        const hasContent = parsed && Object.values(parsed).some(v =>
          v !== null && v !== undefined && v !== '' && v !== false
        );
        if (hasContent) newPost.seo = parsed;
      } catch {} // silently ignore malformed seo
    }

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${host}`;

    if (req.file) {
      newPost.featured_image_url = `${baseUrl}/uploads/${req.file.filename}`;
    } else if (featuredImageUrl) {
      newPost.featured_image_url = featuredImageUrl;
    }

    const { data, error } = await supabase.from("news").insert([newPost]).select();
    if (error) throw error;
    
    cache.flushAll();
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    console.error("Create News Error:", err);
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// PUT /api/news/:id
exports.updateNews = async (req, res) => {
  try {
    const {
      author,
      summary,
      publishedAt,
      featuredImageUrl,
      seo,
      ...rest
    } = req.body;

    const updates = { ...rest };
    if (author !== undefined) updates.authorName = author;
    if (summary !== undefined) updates.excerpt = summary;
    if (publishedAt) updates.published_at = publishedAt;
    if (seo) {
      try { updates.seo = typeof seo === "string" ? JSON.parse(seo) : seo; } catch {}
    }

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${host}`;

    if (req.file) {
      updates.featured_image_url = `${baseUrl}/uploads/${req.file.filename}`;
    } else if (featuredImageUrl) {
      updates.featured_image_url = featuredImageUrl;
      delete updates.featuredImageUrl;
    }

    const { data, error } = await supabase.from("news").update(updates).eq("id", req.params.id).select();
    if (error) throw error;
    cache.flushAll();
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// DELETE /api/news/:id
exports.deleteNews = async (req, res) => {
  try {
    const { error } = await supabase.from("news").delete().eq("id", req.params.id);
    if (error) throw error;
    cache.flushAll(); // Invalidate cache
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};
