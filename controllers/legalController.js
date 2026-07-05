const supabase = require("../config/supabaseClient");

exports.getAllLegalPages = async (req, res) => {
  try {
    const { data, error } = await supabase.from("legal_pages").select("*").order("order_index", { ascending: true });
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    
    // Map id to _id and published to status for Admin Panel frontend compatibility
    const mappedData = (data || []).map(item => ({
      ...item,
      _id: item.id,
      status: item.published ? "Published" : "Draft"
    }));
    
    res.status(200).json({ success: true, data: mappedData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPublicLegalPages = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("legal_pages")
      .select("title, slug")
      .eq("published", true)
      .order("order_index", { ascending: true });
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPublicPageBySlug = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("legal_pages")
      .select("*")
      .eq("slug", req.params.slug)
      .eq("published", true)
      .single();
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    
    let parsedContent = { seo: {}, sections: [] };
    if (data.content) {
      try {
        parsedContent = JSON.parse(data.content);
      } catch (e) {}
    }
    
    res.status(200).json({
      success: true,
      data: {
        title: data.title,
        slug: data.slug,
        seo: parsedContent.seo || {},
        sections: parsedContent.sections || []
      }
    });
  } catch (err) {
    res.status(404).json({ success: false, message: "Page not found" });
  }
};

exports.createPage = async (req, res) => {
  try {
    const { title, status, seo, sections } = req.body;
    const slug = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : 'untitled';
    const published = status === 'Published';
    const content = JSON.stringify({ seo, sections });

    // Check if slug already exists
    const { data: existing } = await supabase.from("legal_pages").select("id").eq("slug", slug).single();
    if (existing) {
      return res.status(400).json({ success: false, message: `A page with the title "${title}" already exists. Please choose a different title.` });
    }

    const { data, error } = await supabase
      .from("legal_pages")
      .insert([{ title, slug, content, published }])
      .select();
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const { title, status, seo, sections } = req.body;
    const slug = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : 'untitled';
    const published = status === 'Published';
    const content = JSON.stringify({ seo, sections });

    const { data, error } = await supabase
      .from("legal_pages")
      .update({ title, slug, content, published, last_updated: new Date() })
      .eq("id", req.params.id)
      .select();
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { data, error } = await supabase.from("legal_pages").delete().eq("id", req.params.id);
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPageById = async (req, res) => {
  try {
    const { data, error } = await supabase.from("legal_pages").select("*").eq("id", req.params.id).single();
    if (error) { console.error("SUPABASE ERROR:", error); throw error; } else { console.log("DATA:", data); }
    
    let parsedContent = { seo: {}, sections: [] };
    if (data.content) {
      try {
        parsedContent = JSON.parse(data.content);
      } catch (e) {}
    }
    
    const mappedData = {
      ...data,
      status: data.published ? "Published" : "Draft",
      seo: parsedContent.seo || {},
      sections: parsedContent.sections || []
    };
    
    res.status(200).json({ success: true, data: mappedData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reorderPages = async (req, res) => {
  try {
    const { pages } = req.body; // array of { _id, orderIndex }
    
    // update each page concurrently
    await Promise.all(
      pages.map(p => 
        supabase
          .from("legal_pages")
          .update({ order_index: p.orderIndex ?? p.order })
          .eq("id", p._id || p.id)
      )
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
