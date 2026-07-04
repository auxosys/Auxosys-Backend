const supabase = require("../config/supabaseClient");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 }); // 60 seconds cache

// GET /job (frontend) or /job/admin
exports.getAllCareers = async (req, res) => {
  try {
    const cacheKey = `allCareers_${req.path}_${req.query.status || 'all'}_${req.query.department || 'all'}_${req.query.work_mode || 'all'}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const isAdmin = req.originalUrl && req.originalUrl.includes("admin");
    let query = supabase.from("careers").select(isAdmin ? "*" : "id, slug, title, role_type, employment_type, work_mode, department, area_of_interest, experience_level, openings, status, featured, urgent, country, state, city, office_location, min_salary, max_salary, created_at").order("created_at", { ascending: false });

    // Apply filters if passed
    if (req.path === "/" && !req.path.includes("/admin")) {
       query = query.eq("status", "Active");
    } else if (req.query.status) {
       query = query.eq("status", req.query.status);
    }
    if (req.query.department) query = query.eq("department", req.query.department);
    if (req.query.work_mode) query = query.eq("work_mode", req.query.work_mode);

    const { data, error } = await query;
    if (error) throw error;
    
    const responseData = { success: true, data: data || [], totalPages: 1 };
    cache.set(cacheKey, responseData);
    res.status(200).json(responseData);
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// GET /job/:id
exports.getCareerById = async (req, res) => {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id);
    const { data, error } = await supabase.from("careers").select("*").eq(isUUID ? "id" : "slug", req.params.id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Job not found" });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// POST /job
exports.createCareer = async (req, res) => {
  try {
    const { data, error } = await supabase.from("careers").insert([req.body]).select();
    if (error) throw error;
    cache.flushAll(); // Invalidate cache
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// PUT /job/:id
exports.updateCareer = async (req, res) => {
  try {
    const { data, error } = await supabase.from("careers").update(req.body).eq("id", req.params.id).select();
    if (error) throw error;
    cache.flushAll(); // Invalidate cache
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// DELETE /job/:id
exports.deleteCareer = async (req, res) => {
  try {
    const { error } = await supabase.from("careers").delete().eq("id", req.params.id);
    if (error) throw error;
    cache.flushAll(); // Invalidate cache
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// PATCH /job/:id/toggle
exports.toggleJobStatus = async (req, res) => {
  try {
    const { data: job, error: fetchError } = await supabase.from("careers").select("status").eq("id", req.params.id).single();
    if (fetchError) throw fetchError;
    const newStatus = job.status === "Active" ? "Closed" : "Active";
    const { data, error } = await supabase.from("careers").update({ status: newStatus }).eq("id", req.params.id).select();
    if (error) throw error;
    cache.flushAll(); // Invalidate cache
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// POST /job/:id/apply
exports.applyForJob = async (req, res) => {
  let resolvedJobId = req.params.id;

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolvedJobId);
    const { data: dbJob, error: dbError } = await supabase.from("careers").select("id, status").eq(isUUID ? "id" : "slug", resolvedJobId).single();
    
    if (dbError) throw dbError;
    if (!dbJob) return res.status(404).json({ success: false, message: "Job not found." });
    
    if (dbJob.status === "Closed") {
      return res.status(400).json({ success: false, message: "This position has been closed and is no longer accepting applications." });
    }
    
    resolvedJobId = dbJob.id; // Ensure we use the UUID for the foreign key

    const payload = { ...req.body, job_id: resolvedJobId, status: "Pending" };
    const { data, error } = await supabase.from("applications").insert([payload]).select();
    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// GET /job/applications/all (Admin CRM)
exports.getAllApplications = async (req, res) => {
  try {
    const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// GET /job/applicants/:jobId
exports.getApplicantsByJobId = async (req, res) => {
  try {
    const { data, error } = await supabase.from("applications").select("*").eq("job_id", req.params.jobId).order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};

// PATCH /job/applicants/:id/status
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const payload = { status };
    if (notes !== undefined) payload.notes = notes;

    const { data, error } = await supabase.from("applications").update(payload).eq("id", req.params.id).select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database Error: " + err.message });
  }
};
