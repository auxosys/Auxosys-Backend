exports.getRelatedPages = (req, res) => {
  const RELATED_PAGES = [
    { value: "", label: "None (General Blog)" },

    // Main Pages
    { value: "about", label: "Page: Who We Are" },
    { value: "products", label: "Page: Products" },
    { value: "services", label: "Page: Services" },
    { value: "industries", label: "Page: Industries" },

    // Products
    { value: "ai-workspace", label: "Product: AI Workspace & Intelligent Agents" },
    { value: "cxp", label: "Product: Customer Experience Platform (CXP)" },
    { value: "whatsapp", label: "Product: WhatsApp Business Platform" },
    { value: "learning", label: "Product: Learning & Training Platform" },
    { value: "healthcare", label: "Product: Healthcare Operations Suite" },
    { value: "business-ops", label: "Product: Business Operations Suite" },
    { value: "workforce", label: "Product: People & Workforce Hub" },
    { value: "inventory", label: "Product: Inventory & Supply Management" },
    { value: "collaboration", label: "Product: Project & Team Collaboration Suite" },
    { value: "enterprise-blockchain-platform", label: "Product: Enterprise Blockchain Platform" },
    { value: "dao-management-platform", label: "Product: DAO Management Platform" },
    { value: "digital-asset-tokenization-platform", label: "Product: Digital Asset Tokenization Platform" },

    // Services
    { value: "digital-strategy-consulting", label: "Service: Digital Strategy Consulting" },
    { value: "product-strategy-and-roadmapping", label: "Service: Product Strategy & Roadmapping" },
    { value: "ux-research-and-product-design", label: "Service: UX Research & Product Design" },
    { value: "marketing-and-gtm-strategy", label: "Service: Marketing & GTM Strategy" },
    { value: "operations-and-process-optimization", label: "Service: Operations & Process Optimization" },
    { value: "business-analytics", label: "Service: Business Analytics" },
    { value: "custom-software-development", label: "Service: Custom Software Development" },
    { value: "saas-product-development", label: "Service: SaaS Product Development" },
    { value: "enterprise-applications", label: "Service: Enterprise Applications" },
    { value: "web-development", label: "Service: Web Development" },
    { value: "mobile-app-development", label: "Service: Mobile App Development" },
    { value: "api-development", label: "Service: API Development" },
    { value: "ai-and-intelligent-automation", label: "Service: AI & Intelligent Automation" },
    { value: "cloud-services", label: "Service: Cloud Services" },
    { value: "crm-and-erp-solutions", label: "Service: CRM & ERP Solutions" },
    { value: "whatsapp-business-solutions", label: "Service: WhatsApp Business Solutions" },
    { value: "cybersecurity", label: "Service: Cybersecurity" },
    { value: "devops-and-integrations", label: "Service: DevOps & Integrations" },
    { value: "smart-contract-development", label: "Service: Smart Contract Development" },
    { value: "dapp-development", label: "Service: dApp Development" },
    { value: "enterprise-blockchain-solutions", label: "Service: Enterprise Blockchain Solutions" },
    { value: "crypto-wallet-development", label: "Service: Crypto Wallet Development" },
    { value: "tokenization-solutions", label: "Service: Tokenization Solutions" },
    { value: "web3-integration", label: "Service: Web3 Integration" },

    // Industries
    { value: "healthcare-and-life-sciences", label: "Industry: Healthcare & Life Sciences" },
    { value: "retail-and-e-commerce", label: "Industry: Retail & E-Commerce" },
    { value: "manufacturing-and-industrial", label: "Industry: Manufacturing & Industrial" },
    { value: "banking-finance-and-insurance", label: "Industry: Banking, Finance & Insurance" },
    { value: "education-and-edtech", label: "Industry: Education & EdTech" },
    { value: "logistics-and-supply-chain", label: "Industry: Logistics & Supply Chain" },
    { value: "hospitality-and-travel", label: "Industry: Hospitality & Travel" },
    { value: "real-estate-and-construction", label: "Industry: Real Estate & Construction" },
    { value: "energy-and-utilities", label: "Industry: Energy & Utilities" },
    { value: "agriculture-and-agritech", label: "Industry: Agriculture & AgriTech" },
    { value: "blockchain-and-web3", label: "Industry: Blockchain & Web3" }
  ];

  res.status(200).json({ success: true, data: RELATED_PAGES });
};
