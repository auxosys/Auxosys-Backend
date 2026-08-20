const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const { supabase } = require("../config/supabaseClient"); // Ensure correct path

// --- Settings and Clauses Management ---

exports.getCompanySettings = async (req, res) => {
  try {
    const { data, error } = await supabase.from("hr_company_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    res.status(200).json({ success: true, data: data || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCompanySettings = async (req, res) => {
  try {
    const { data: existing } = await supabase.from("hr_company_settings").select("id").limit(1).maybeSingle();
    
    const payload = { ...req.body, updated_at: new Date() };
    delete payload.id;
    
    let result;
    if (existing && existing.id) {
      result = await supabase.from("hr_company_settings").update(payload).eq("id", existing.id).select().single();
    } else {
      result = await supabase.from("hr_company_settings").insert([payload]).select().single();
    }
    
    if (result.error) throw result.error;
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClauses = async (req, res) => {
  try {
    const { data, error } = await supabase.from("offer_letter_clauses").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createClause = async (req, res) => {
  try {
    const { title, content } = req.body;
    const { data, error } = await supabase.from("offer_letter_clauses").insert([{ title, content }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateClause = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, is_active } = req.body;
    const { data, error } = await supabase.from("offer_letter_clauses")
      .update({ title, content, is_active, updated_at: new Date() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteClause = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("offer_letter_clauses").delete().eq("id", id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Clause deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSignatories = async (req, res) => {
  try {
    const { data, error } = await supabase.from("offer_letter_signatories").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSignatory = async (req, res) => {
  try {
    const { name, designation, email, signature_url } = req.body;
    const { data, error } = await supabase.from("offer_letter_signatories").insert([{ name, designation, email, signature_url }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSignatory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, designation, email, signature_url, is_active } = req.body;
    const { data, error } = await supabase.from("offer_letter_signatories")
      .update({ name, designation, email, signature_url, is_active, updated_at: new Date() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSignatory = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("offer_letter_signatories").delete().eq("id", id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Signatory deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// --- PDF Generation ---

// Helper to format currency
handlebars.registerHelper('formatCurrency', function (value, currency) {
  if (!value) return "0";
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0
  });
  return formatter.format(value);
});

// Helper for generic conditions
handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

exports.generatePdf = async (req, res) => {
  let browser = null;
  try {
    const offerData = req.body;
    // offerData expects: { candidate, job, compensation, benefits, clauses, company, signatory, templateType }

    // Read the Handlebars template
    const templateName = offerData.templateType === 'single_page' ? 'single_page.hbs' : 'detailed_page.hbs';
    const templatePath = path.join(__dirname, '..', 'templates', 'offer_letters', templateName);
    
    // Fallback basic template if file doesn't exist
    let templateSource = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          h1 { color: #0056b3; }
        </style>
      </head>
      <body>
        <h1>Offer Letter for {{candidate.name}}</h1>
        <p>Position: {{job.title}}</p>
        <p>Missing template file at ${templatePath}</p>
      </body>
      </html>
    `;

    if (fs.existsSync(templatePath)) {
      templateSource = fs.readFileSync(templatePath, 'utf8');
    }

    const template = handlebars.compile(templateSource);
    
    // Pre-compile the rich text fields so they can use handlebars variables like {{job.title}}
    if (offerData.offerIntroduction) {
      offerData.offerIntroduction = handlebars.compile(offerData.offerIntroduction)(offerData);
    }
    if (offerData.offerDetails) {
      offerData.offerDetails = handlebars.compile(offerData.offerDetails)(offerData);
    }
    if (offerData.closingStatement) {
      offerData.closingStatement = handlebars.compile(offerData.closingStatement)(offerData);
    }
    
    // Also compile clauses if present
    if (offerData.clauses && Array.isArray(offerData.clauses)) {
      offerData.clauses = offerData.clauses.map(clause => ({
        ...clause,
        content: handlebars.compile(clause.content)(offerData)
      }));
    }

    const html = template(offerData);

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });

    // Send PDF as download stream
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="Offer_Letter_${offerData.candidate?.name?.replace(/\\s+/g, '_') || 'Candidate'}.pdf"`,
    });

    res.status(200).send(pdfBuffer);

  } catch (err) {
    console.error("PDF Generation Error:", err);
    res.status(500).json({ success: false, message: "Failed to generate PDF", error: err.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
