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
    
    // Pre-process rich text to remove block elements (li, p, div) that contain empty variables
    const cleanEmptyVariables = (text, data) => {
      if (!text) return "";
      const getValue = (path, obj) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
      return text.replace(/<(li|p|div)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
        const vars = match.match(/\{\{([^}]+)\}\}/g);
        if (vars) {
          for (let v of vars) {
            const varName = v.replace(/[{}]/g, '').trim();
            const val = getValue(varName, data);
            if (!val) return "";
          }
        }
        return match;
      });
    };

    // Pre-compile the rich text fields so they can use handlebars variables like {{job.title}}
    if (offerData.offerIntroduction) {
      offerData.offerIntroduction = handlebars.compile(cleanEmptyVariables(offerData.offerIntroduction, offerData))(offerData);
    }
    if (offerData.offerDetails) {
      offerData.offerDetails = handlebars.compile(cleanEmptyVariables(offerData.offerDetails, offerData))(offerData);
    }
    if (offerData.closingStatement) {
      offerData.closingStatement = handlebars.compile(cleanEmptyVariables(offerData.closingStatement, offerData))(offerData);
    }
    if (offerData.candidateAcknowledgement) {
      offerData.candidateAcknowledgement = handlebars.compile(cleanEmptyVariables(offerData.candidateAcknowledgement, offerData))(offerData);
    }
    
    // Also compile clauses if present
    if (offerData.clauses && Array.isArray(offerData.clauses)) {
      offerData.clauses = offerData.clauses.map(clause => ({
        ...clause,
        content: handlebars.compile(cleanEmptyVariables(clause.content, offerData))(offerData)
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
    const isDetailed = offerData.templateType === 'detailed_page';
    
    
    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    };

    // Inject Watermark into Header Template so it repeats on every page
    pdfOptions.displayHeaderFooter = true;
    pdfOptions.headerTemplate = `
      <div style="-webkit-print-color-adjust: exact; position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; z-index: -10;">
        <div style="width: 680px; height: 680px; opacity: 0.15; margin-top: -80px;">
              <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">      <g transform="translate(100,103)">        <path d="M -56 -7 A 58 58 0 1 1 43 45" fill="none" stroke="#081826" stroke-width="1.2" opacity="0.5"/>        <line x1="-6" y1="-42" x2="36" y2="16" stroke="#081826" stroke-width="5.2" stroke-linecap="round"/>        <line x1="36" y1="16" x2="-33" y2="29" stroke="#081826" stroke-width="5.2" stroke-linecap="round"/>        <line x1="-33" y1="29" x2="-6" y2="-42" stroke="#081826" stroke-width="3" stroke-linecap="round" opacity="0.6"/>        <circle cx="-6" cy="-42" r="10" fill="#081826"/>        <circle cx="36" cy="16" r="14.5" fill="#081826"/>        <circle cx="-33" cy="29" r="7.3" fill="#081826"/>        <circle cx="43" cy="45" r="3.6" fill="#081826"/>      </g>    </svg>
        </div>
      </div>
    `;
    pdfOptions.footerTemplate = '<span></span>'; // Default empty footer


    if (isDetailed) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.footerTemplate = `
        <div style="-webkit-print-color-adjust: exact; width: 100%; height: 80px; position: relative; font-size: 11px; font-family: 'Poppins', Arial, sans-serif;">
          <div style="position: absolute; bottom: 34px; left: 44px; width: calc(100% - 88px); height: 4px; background: #20B2AA; border-radius: 2px;"></div>
          <div style="position: absolute; bottom: 12px; right: 44px; color: #101828; font-weight: 600;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        </div>
      `;
    }


    const pdfBuffer = await page.pdf(pdfOptions);

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
