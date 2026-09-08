const googleSheetsService = require("../services/googleSheetsService");
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

/**
 * List clients directly from the connected Google Sheet
 */
exports.listClients = async (req, res) => {
  try {
    const { search, status, archived } = req.query;
    const clients = await googleSheetsService.listClients({
      search,
      status,
      archived,
      isSuperAdmin: isSuperAdmin(req),
    });
    res.json(clients);
  } catch (error) {
    console.error("List Clients Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reorder clients list (updates custom sortOrder in Google Sheet)
 */
exports.reorderClients = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds array is required" });
    }
    await googleSheetsService.reorderClients(orderedIds);
    res.json({ success: true, message: "Clients reordered successfully" });
  } catch (error) {
    console.error("Reorder Clients Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single client by ID from Google Sheet
 */
exports.getClient = async (req, res) => {
  try {
    const client = await googleSheetsService.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  } catch (error) {
    console.error("Get Client Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new client (appends row to Google Sheet)
 */
exports.createClient = async (req, res) => {
  try {
    const errors = validateClient(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const actor = getActor(req);
    const newClient = await googleSheetsService.createClient(req.body, actor);
    res.status(201).json(newClient);
  } catch (error) {
    console.error("Create Client Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update an existing client by ID in Google Sheet
 */
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    const actor = getActor(req);

    const updatedClient = await googleSheetsService.updateClient(id, patch, actor);
    res.json(updatedClient);
  } catch (error) {
    console.error("Update Client Error (Google Sheets):", error);
    const status = error.message === "Client not found" ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
};

/**
 * Archive client (marks Is Archived column as TRUE in Google Sheet)
 */
exports.archiveClient = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Super Admin can archive clients." });
    }
    const { id } = req.params;
    const actor = getActor(req);
    const archived = await googleSheetsService.setArchive(id, true, actor);
    res.json(archived);
  } catch (error) {
    console.error("Archive Client Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Unarchive client (marks Is Archived column as FALSE in Google Sheet)
 */
exports.unarchiveClient = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Super Admin can restore clients." });
    }
    const { id } = req.params;
    const actor = getActor(req);
    const restored = await googleSheetsService.setArchive(id, false, actor);
    res.json(restored);
  } catch (error) {
    console.error("Unarchive Client Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Permanently delete client row from Google Sheet
 */
exports.deleteClient = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Super Admin can permanently delete clients." });
    }
    const { id } = req.params;
    const result = await googleSheetsService.deleteClient(id);
    res.json(result);
  } catch (error) {
    console.error("Delete Client Error (Google Sheets):", error);
    res.status(500).json({ error: error.message });
  }
};
