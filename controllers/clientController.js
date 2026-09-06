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
  let text = c.notes || "";
  let services = [];
  let customServices = "";
  let sortOrder = c.sortOrder !== undefined ? c.sortOrder : 999999;

  if (typeof text === "string" && text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed) {
        text = parsed.text || "";
        services = parsed.services || [];
        customServices = parsed.customServices || "";
        if (parsed.sortOrder !== undefined) {
          sortOrder = parsed.sortOrder;
        }
      }
    } catch (e) {}
  }

  return {
    ...c,
    notes: text,
    services: c.services || services,
    customServices: c.customServices || customServices,
    sortOrder,
  };
}

function encodeNotes(userNotes = "", services = [], customServices = "", sortOrder) {
  const textStr = String(userNotes || "").trim();
  const srvList = Array.isArray(services) ? services : [];
  const customStr = String(customServices || "").trim();

  if (srvList.length === 0 && !customStr && sortOrder === undefined) {
    return textStr;
  }

  const payload = {
    text: textStr,
    services: srvList,
    customServices: customStr
  };
  if (sortOrder !== undefined) {
    payload.sortOrder = sortOrder;
  }

  return JSON.stringify(payload);
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
    
    // Chronological order by creation: First created, First showing (createdAt ASC)
    const { data: clients, error } = await query.order("createdAt", { ascending: true });
    
    if (error) throw error;
    
    let formatted = (clients || []).map(formatClientRecord);

    // Sort by custom drag-and-drop sortOrder if present, falling back to createdAt ascending
    formatted.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    if (search) {
      const s = search.toLowerCase();
      formatted = formatted.filter(c => 
        (c.companyName && c.companyName.toLowerCase().includes(s)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    }
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reorderClients = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds array is required" });
    }

    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index];
      const { data: existing } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (existing) {
        const formatted = formatClientRecord(existing);
        const newNotes = encodeNotes(formatted.notes, formatted.services, formatted.customServices, index);
        await supabase
          .from("clients")
          .update({ notes: newNotes, updatedAt: new Date().toISOString() })
          .eq("id", id);
      }
    }

    res.json({ success: true, message: "Clients reordered successfully" });
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

    const encodedNotes = encodeNotes(req.body.notes, req.body.services, req.body.customServices);

    const payload = {
      ...req.body,
      notes: encodedNotes,
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

    if (error) {
      console.error("Create Client Error:", error);
      throw error;
    }
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

    const existingFormatted = formatClientRecord(existing);
    const updatedNotesText = patch.notes !== undefined ? patch.notes : existingFormatted.notes;
    const updatedServices = patch.services !== undefined ? patch.services : existingFormatted.services;
    const updatedCustomServices = patch.customServices !== undefined ? patch.customServices : existingFormatted.customServices;

    const encodedNotes = encodeNotes(updatedNotesText, updatedServices, updatedCustomServices);

    const updatePayload = {
      ...patch,
      notes: encodedNotes,
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

    if (error) {
      console.error("Update Client Error:", error);
      throw error;
    }
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
