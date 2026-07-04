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

    const isAdmin = req.originalUrl && req.originalUrl.includes("admin");
    let query = supabase.from("news").select(isAdmin ? "*" : "id, slug, title, category, readTime, excerpt, featured_image_url, tags, authorName, authorRole, authorAvatar, published_at, created_at").order("published_at", { ascending: false });
    
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
    const { data: post, error } = await supabase
      .from("news")
      .select("*")
      .eq("slug", req.params.slug)
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
    const newPost = {
      ...req.body,
      published_at: req.body.publishedAt || new Date().toISOString()
    };
    if (req.file) {
      newPost.featured_image_url = `http://localhost:5002/uploads/${req.file.filename}`;
    } else if (newPost.featuredImageUrl) {
      newPost.featured_image_url = newPost.featuredImageUrl;
      delete newPost.featuredImageUrl;
    }

    const { data, error } = await supabase.from("news").insert([newPost]).select();
    if (error) throw error;
    
    cache.flushAll(); // Invalidate cache
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// PUT /api/news/:id
exports.updateNews = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) {
      updates.featured_image_url = `http://localhost:5002/uploads/${req.file.filename}`;
    } else if (updates.featuredImageUrl) {
      updates.featured_image_url = updates.featuredImageUrl;
      delete updates.featuredImageUrl;
    }

    const { data, error } = await supabase.from("news").update(updates).eq("id", req.params.id).select();
    if (error) throw error;
    cache.flushAll(); // Invalidate cache
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
