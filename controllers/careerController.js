const supabase = require("../config/supabaseClient");

// Mock job for UI building without database connection
const MOCK_JOB = {
  _id: "job-001",
  id: "job-001",
  title: "Senior Full Stack Engineer",
  role_type: "Engineering",
  employment_type: "Full-Time",
  work_mode: "Hybrid",
  department: "Product",
  team: "Core Platform",
  area_of_interest: "Software Engineering",
  experience_level: "Senior",
  hiring_manager: "Sarah Connor",
  hiring_priority: "High",
  openings: 2,
  status: "Published",
  featured: true,
  urgent: false,
  campus_hiring: false,
  country: "United States",
  state: "California",
  city: "San Francisco",
  office_location: "SF HQ",
  remote_regions: ["North America"],
  timezone: "PST",
  relocation_support: true,
  currency: "USD",
  min_salary: 140000,
  max_salary: 190000,
  salary_type: "Annual",
  hide_salary: false,
  salary_negotiable: true,
  stipend: null,
  bonus: "10% Performance Bonus",
  equity: "0.05%",
  benefits_included: ["Health", "Dental", "401k"],
  published_at: new Date().toISOString(),
  expected_joining_date: "2026-08-01",
  closing_date: "2026-07-31",
  short_summary: "Join our Core Platform team to build scalable enterprise solutions.",
  description: "We are looking for a Senior Full Stack Engineer...",
  responsibilities: "- Architect scalable systems\n- Mentor juniors\n- Code reviews",
  requirements: "- 5+ years experience\n- Strong React & Node.js",
  preferred_qualifications: "- Experience with Supabase\n- Open source contributions",
  nice_to_have: "- Rust or Go experience",
  tech_skills: ["React", "Node.js", "Supabase", "PostgreSQL"],
  soft_skills: ["Leadership", "Communication"],
  certifications: "AWS Certified Developer (Optional)",
  education: "Bachelor's in Computer Science or equivalent",
  languages: ["English"],
  required_documents: ["Resume", "LinkedIn"],
  required_fields: ["Phone", "Email", "Notice Period"],
  application_form_config: {
    jobCategory: "Experienced",
    sections: {
      education: true,
      experience: true,
      certifications: true,
      projects: false,
    },
    fields: {
      currentCompany: "optional",
      currentDesignation: "optional",
      experience: "required",
      qualification: "required",
      noticePeriod: "required",
      currentCTC: "optional",
      expectedCTC: "optional",
      college: "required",
      degree: "required",
      stream: "optional",
      currentSemester: "optional",
      graduationYear: "required",
      cgpa: "optional",
      relevantSkills: "required",
      internshipExperience: "optional",
      portfolio: "optional",
      github: "optional",
      linkedin: "optional",
    },
  },
  meta_title: "Senior Full Stack Engineer - Auxosys Careers",
  meta_description: "Apply for the Senior Full Stack Engineer role at Auxosys.",
  canonical_url: "https://auxosys.com/careers/senior-full-stack-engineer",
  slug: "senior-full-stack-engineer",
  homepage_highlight: true,
  career_page_highlight: true,
  created_at: new Date().toISOString(),
};

let MOCK_JOBS = [MOCK_JOB];

// GET /job (frontend) or /job/admin
exports.getAllCareers = async (req, res) => {
  try {
    let query = supabase.from("careers").select("*").order("created_at", { ascending: false });

    // Apply filters if passed
    if (req.query.status) query = query.eq("status", req.query.status);
    if (req.query.department) query = query.eq("department", req.query.department);
    if (req.query.work_mode) query = query.eq("work_mode", req.query.work_mode);

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [], totalPages: 1 });
  } catch (err) {
    // Return mock array if Supabase not configured to prevent UI crash
    res.status(200).json({ success: true, data: MOCK_JOBS, totalPages: 1, message: "Waiting for Supabase keys" });
  }
};

// GET /job/:id
exports.getCareerById = async (req, res) => {
  try {
    const { data, error } = await supabase.from("careers").select("*").eq("id", req.params.id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Job not found" });
    res.status(200).json({ success: true, data });
  } catch (err) {
    const job = MOCK_JOBS.find(j => j.id === req.params.id || j.slug === req.params.id) || MOCK_JOBS[0];
    res.status(200).json({ success: true, data: job, message: "Waiting for Supabase keys" });
  }
};

// POST /job
exports.createCareer = async (req, res) => {
  try {
    const { data, error } = await supabase.from("careers").insert([req.body]).select();
    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    // Mock success
    const newJob = { 
      ...req.body, 
      _id: "mock-job-" + Date.now(),
      id: "mock-job-" + Date.now(), 
      slug: (req.body.title || "").toLowerCase().replace(/ /g, '-'),
      created_at: new Date().toISOString()
    };
    MOCK_JOBS.unshift(newJob);
    res.status(201).json({ success: true, data: newJob });
  }
};

// PUT /job/:id
exports.updateCareer = async (req, res) => {
  try {
    const { data, error } = await supabase.from("careers").update(req.body).eq("id", req.params.id).select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(200).json({ success: true, data: { ...MOCK_JOB, ...req.body } });
  }
};

// DELETE /job/:id
exports.deleteCareer = async (req, res) => {
  try {
    const { error } = await supabase.from("careers").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(200).json({ success: true, message: "Deleted successfully (Mock)" });
  }
};

// Mock applications for UI building without database connection
const MOCK_APPLICATIONS = [
  {
    id: "app-001",
    job_id: "job-001",
    job_title: "Senior Full Stack Engineer",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1 555-0100",
    country: "United States",
    resume_url: "resume_john_doe.pdf",
    linkedin: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe",
    experience: "5-8 Years",
    status: "New",
    created_at: new Date().toISOString()
  },
  {
    id: "app-002",
    job_id: "job-001",
    job_title: "Senior Full Stack Engineer",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice.smith@example.com",
    phone: "+44 20 7946 0958",
    country: "United Kingdom",
    resume_url: "alice_cv.pdf",
    linkedin: "https://linkedin.com/in/alicesmith",
    experience: "8+ Years",
    status: "Reviewed",
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

// POST /job/:id/apply
exports.applyForJob = async (req, res) => {
  try {
    const payload = { ...req.body, job_id: req.params.id, status: "New" };
    const { data, error } = await supabase.from("applications").insert([payload]).select();
    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    // Mock success
    const newApp = { ...req.body, id: "mock-app-id-" + Date.now(), job_id: req.params.id, status: "New", created_at: new Date().toISOString() };
    MOCK_APPLICATIONS.unshift(newApp);
    res.status(201).json({ success: true, data: newApp, message: "Application submitted (Mock)" });
  }
};

// GET /job/applications/all (Admin CRM)
exports.getAllApplications = async (req, res) => {
  try {
    const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(200).json({ success: true, data: MOCK_APPLICATIONS, message: "Waiting for Supabase keys" });
  }
};

// GET /job/applicants/:jobId
exports.getApplicantsByJobId = async (req, res) => {
  try {
    const { data, error } = await supabase.from("applications").select("*").eq("job_id", req.params.jobId).order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(200).json({ success: true, data: MOCK_APPLICATIONS, message: "Waiting for Supabase keys" });
  }
};
