const supabase = require("../config/supabaseClient");
const { validateClient, DEFAULT_STATUS } = require("../utils/clientModel");

function getActor(req) {
  if (req.user) {
    return req.user.user_metadata?.full_name || req.user.email || "Admin";
  }
  return "Admin";
}

function isSuperAdmin(req) {
  if (!req.user) return false;
  return req.user.role === "Superadmin" || req.user.email === "auxosys@gmail.com" || req.user.email === "admin@auxosys.com";
}

function formatClientRecord(c) {
  if (!c) return c;
  const meta = c.metadata || {};
  return {
    ...c,
    services: c.services || meta.services || [],
    customServices: c.customServices || meta.customServices || "",
  };
}

exports.listClients = async (req, res) => {
  try {
    const { search, status, archived } = req.query;
    
    let query = supabase.from("clients").select("*");
    
    if (status) {
      query = query.eq("status", status);
    }
    
    if (archived === "true") {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ error: "Access Denied: Only Super Admin can view archived clients." });
      }
      query = query.eq("isArchived", true);
    } else if (archived === "false") {
      query = query.eq("isArchived", false);
    }
    
    const { data: clients, error } = await query.order("updatedAt", { ascending: false });
    
    if (error) throw error;
    
    let filteredClients = clients || [];
    if (search) {
      const s = search.toLowerCase();
      filteredClients = filteredClients.filter(c => 
        (c.companyName && c.companyName.toLowerCase().includes(s)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    }
    
    res.json(filteredClients.map(formatClientRecord));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", req.params.id)
      .single();
      
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Not found" });
    
    res.json(formatClientRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const errors = validateClient(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const now = new Date().toISOString();
    const status = req.body.status || DEFAULT_STATUS;
    const actor = getActor(req);

    const metadata = {
      ...(req.body.metadata || {}),
      services: req.body.services || [],
      customServices: req.body.customServices || "",
    };

    const payload = {
      ...req.body,
      metadata,
      status,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      addedBy: actor,
      statusHistory: [{ status, at: now, by: actor, note: "Client created" }]
    };
    delete payload.services;
    delete payload.customServices;
    
    const { data, error } = await supabase
      .from("clients")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatClientRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    const actor = getActor(req);
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Not found" });
    }

    // Merge for validation
    const merged = { ...existing, ...patch };
    const errors = validateClient(merged);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    let statusHistory = existing.statusHistory || [];
    if (patch.status && patch.status !== existing.status) {
      statusHistory.push({
        status: patch.status,
        at: now,
        by: actor,
        note: patch.statusNote || "",
      });
    }

    const metadata = {
      ...(existing.metadata || {}),
      ...(patch.metadata || {}),
      services: patch.services !== undefined ? patch.services : (existing.metadata?.services || existing.services || []),
      customServices: patch.customServices !== undefined ? patch.customServices : (existing.metadata?.customServices || existing.customServices || ""),
    };

    const updatePayload = {
      ...patch,
      metadata,
      statusHistory,
      updatedAt: now,
    };
    delete updatePayload.statusNote;
    delete updatePayload.services;
    delete updatePayload.customServices;

    const { data, error } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json(formatClientRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.archiveClient = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Super Admin can archive clients." });
    }
    const { id } = req.params;
    const { data, error } = await supabase
      .from("clients")
      .update({ isArchived: true, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.unarchiveClient = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Super Admin can restore clients." });
    }
    const { id } = req.params;
    const { data, error } = await supabase
      .from("clients")
      .update({ isArchived: false, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Super Admin can permanently delete clients." });
    }
    const { id } = req.params;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
