exports.getRelatedPages = (req, res) => {
  const RELATED_PAGES = [
    { value: "", label: "None (General Blog)" },

    // Main Pages
    { value: "about", label: "Page: Who We Are" },
    { value: "products", label: "Page: Products" },
    { value: "services", label: "Page: Services" },
    { value: "industries", label: "Page: Industries" },

    // Services - OT
    { value: "cyber-security", label: "Service: Cyber Security" },
    { value: "auxosys-technology", label: "Service: AUXOSYS Technology" },
    { value: "cloud-services", label: "Service: Cloud Services" },
    { value: "ai-automation", label: "Service: AI & Automation" },
    { value: "data-business-analytics", label: "Service: Data & Analytics" },
    { value: "it-services-consulting", label: "Service: IT Consulting" },
    { value: "software-development", label: "Service: Software Development" },
    { value: "managed-services", label: "Service: Managed Services" },

    // Services - OCS
    { value: "operation-supplychain", label: "Service: Operations & Supply Chain" },
    { value: "auxosys-services", label: "Service: AUXOSYS Services" },
    { value: "salespricing", label: "Service: Sales & Pricing" },
    { value: "marketingbrand", label: "Service: Marketing & Brand" },
    { value: "producteng", label: "Service: Product Engineering" },
    { value: "userexp", label: "Service: User Experience" },
    { value: "strategy-consulting", label: "Service: Strategy Consulting" },

    // Products
    { value: "hrms", label: "Product: HRMS" },
    { value: "crm", label: "Product: CRM" },
    { value: "WPCMpage", label: "Product: WPCM" },
    { value: "Aiagent", label: "Product: AI Agent" },
    { value: "pms", label: "Product: PMS" },
    { value: "ims", label: "Product: IMS" },
    { value: "ErpPage", label: "Product: ERP" },
    { value: "HmsPage", label: "Product: HMS" },
    { value: "LmsPage", label: "Product: LMS" },

    // Industries
    { value: "energy", label: "Industry: Energy" },
    { value: "ecommerce", label: "Industry: E-Commerce" },
    { value: "agri-tech", label: "Industry: Agri-Tech" },
    { value: "healthcare", label: "Industry: Healthcare" },
    { value: "hospitality", label: "Industry: Hospitality" },
    { value: "food-beverage", label: "Industry: Food & Beverage" },
    { value: "education", label: "Industry: Education" },
    { value: "fmcg", label: "Industry: FMCG" },
    { value: "manufacturing", label: "Industry: Manufacturing" }
  ];

  res.status(200).json({ success: true, data: RELATED_PAGES });
};
