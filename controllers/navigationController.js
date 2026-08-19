const supabase = require("../config/supabaseClient");

exports.getNavigationLinks = async (req, res) => {
  try {
    const menuType = req.query.type || 'header';
    const { data, error } = await supabase
      .from("seo_navigation")
      .select("*")
      .eq("menu_type", menuType)
      .order("order_index", { ascending: true });
      
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return res.status(200).json({ success: true, data: [] });
      throw error;
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNavigationSchema = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("seo_navigation")
      .select("*")
      .eq("menu_type", "header")
      .order("order_index", { ascending: true });
      
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return res.status(200).json({ success: true, data: {} });
      throw error;
    }

    const domain = "https://www.auxosys.com";
    const elements = data.map((item, index) => {
      let fullUrl = item.url || "/";
      if (!fullUrl.startsWith("http")) {
        fullUrl = `${domain}${fullUrl.startsWith("/") ? fullUrl : "/" + fullUrl}`;
      }
      return {
        "@type": "SiteNavigationElement",
        "position": index + 1,
        "name": item.title || item.label || "Link",
        "url": fullUrl
      };
    });

    const schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": elements
    };

    res.status(200).json({ success: true, data: schema });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertNavigationLink = async (req, res) => {
  try {
    let payload = { ...req.body, updated_at: new Date() };
    
    // Ensure URL is at least '/'
    if (!payload.url) payload.url = '/';

    let result;
    if (payload.id) {
      result = await supabase.from("seo_navigation").update(payload).eq("id", payload.id).select().single();
    } else {
      result = await supabase.from("seo_navigation").insert([payload]).select().single();
    }
    
    if (result.error) throw result.error;
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNavigationLink = async (req, res) => {
  try {
    const { error } = await supabase.from("seo_navigation").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Navigation link deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reorderNavigationLinks = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, order_index, parent_id }
    if (!items || !items.length) throw new Error("No items provided");

    // Supabase JS doesn't have bulk upsert with different fields easily without upsert array
    // Let's use the standard upsert
    const { data, error } = await supabase
      .from("seo_navigation")
      .upsert(items, { onConflict: 'id' })
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
