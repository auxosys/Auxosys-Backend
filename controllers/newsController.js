const supabase = require("../config/supabaseClient");

// GET /api/news
exports.getAllNews = async (req, res) => {
  try {
    let query = supabase.from("news").select("*").order("published_at", { ascending: false });
    
    if (req.query.category && req.query.category !== "All") {
      query = query.eq("category", req.query.category);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, data: data || [], totalPages: 1 });
  } catch (err) {
    res.status(200).json({ success: true, data: [], totalPages: 1, message: "Waiting for Supabase keys" });
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

    // Fetch related (same category, exclude current)
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
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/news
exports.createNews = async (req, res) => {
  try {
    const newPost = {
      ...req.body,
      published_at: req.body.publishedAt || new Date().toISOString()
    };
    // Format camelCase from frontend to snake_case for Supabase
    if (newPost.featuredImageUrl) {
      newPost.featured_image_url = newPost.featuredImageUrl;
      delete newPost.featuredImageUrl;
    }

    const { data, error } = await supabase.from("news").insert([newPost]).select();
    if (error) throw error;
    
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/news/:id
exports.updateNews = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.featuredImageUrl) {
      updates.featured_image_url = updates.featuredImageUrl;
      delete updates.featuredImageUrl;
    }

    const { data, error } = await supabase
      .from("news")
      .update(updates)
      .eq("id", req.params.id)
      .select();
      
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/news/:id
exports.deleteNews = async (req, res) => {
  try {
    const { error } = await supabase.from("news").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
