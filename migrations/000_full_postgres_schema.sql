-- ============================================================
-- AUXOSYS FULL POSTGRESQL / AWS RDS SCHEMA MIGRATION
-- Migration File: 000_full_postgres_schema.sql
-- Compatible with standard PostgreSQL 12+, AWS RDS PostgreSQL, AWS DMS
-- Safe to execute on clean database or existing instance.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Dynamic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. USERS & ROLES TABLE
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ACCESS CONTROL TABLE
CREATE TABLE IF NOT EXISTS access_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'sub_admin',
    pages_access JSONB DEFAULT '[]'::jsonb,
    dashboard_access BOOLEAN DEFAULT TRUE,
    dashboard_readonly BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SENDER EMAILS (Brevo / Outreach Senders)
CREATE TABLE IF NOT EXISTS sender_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT,
    brevo_sender_id TEXT,
    reply_to_email TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. USER SENDER PERMISSIONS
CREATE TABLE IF NOT EXISTS user_sender_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    sender_email_id UUID NOT NULL REFERENCES sender_emails(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, sender_email_id)
);

-- 5. CONTACT SUPPRESSIONS
CREATE TABLE IF NOT EXISTS contact_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    company TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    source TEXT DEFAULT 'direct',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MAIL LISTS
CREATE TABLE IF NOT EXISTS mail_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    contact_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CONTACT LIST MAP (Junction Table)
CREATE TABLE IF NOT EXISTS contact_list_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES mail_lists(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(list_id, contact_id)
);

-- 9. EMAIL TEMPLATES
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    sender_email_id UUID REFERENCES sender_emails(id) ON DELETE SET NULL,
    created_by_user_id UUID,
    name TEXT NOT NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    list_id UUID REFERENCES mail_lists(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    daily_limit INTEGER NOT NULL DEFAULT 100,
    min_delay_sec INTEGER NOT NULL DEFAULT 30,
    max_delay_sec INTEGER NOT NULL DEFAULT 90,
    track_opens BOOLEAN NOT NULL DEFAULT TRUE,
    track_clicks BOOLEAN NOT NULL DEFAULT TRUE,
    sent_count INTEGER NOT NULL DEFAULT 0,
    total_contacts INTEGER NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. CAMPAIGN LOGS
CREATE TABLE IF NOT EXISTS campaign_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_email_id UUID REFERENCES sender_emails(id) ON DELETE SET NULL,
    created_by_user_id UUID,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    brevo_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    retry_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. MAILBOXES
CREATE TABLE IF NOT EXISTS mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    smtp_host TEXT,
    smtp_port INTEGER,
    imap_host TEXT,
    imap_port INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. MAILBOX MESSAGES
CREATE TABLE IF NOT EXISTS mailbox_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
    sender_id UUID,
    recipient_id UUID,
    sender_email TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    folder TEXT NOT NULL DEFAULT 'inbox',
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_trash BOOLEAN DEFAULT FALSE,
    labels JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. MAILBOX ATTACHMENTS
CREATE TABLE IF NOT EXISTS mailbox_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES mailbox_messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT,
    size INTEGER,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    location TEXT,
    status TEXT DEFAULT 'active',
    website TEXT,
    industry TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. CAREERS
CREATE TABLE IF NOT EXISTS careers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Full-time',
    experience_level TEXT,
    salary_range TEXT,
    description TEXT NOT NULL,
    requirements JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. APPLICATIONS
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES careers(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    resume_url TEXT NOT NULL,
    cover_letter TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. OFFER LETTERS
CREATE TABLE IF NOT EXISTS offer_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_letter_id TEXT UNIQUE NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    position TEXT NOT NULL,
    ctc TEXT,
    joining_date DATE,
    status TEXT DEFAULT 'draft',
    pdf_url TEXT,
    verification_code TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. CERTIFICATES
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id TEXT UNIQUE NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    title TEXT NOT NULL,
    issue_date DATE NOT NULL,
    status TEXT DEFAULT 'issued',
    pdf_url TEXT,
    verification_code TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. NEWS
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    author TEXT,
    status TEXT DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    image_url TEXT,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. LEGAL PAGES & DOCUMENTS
CREATE TABLE IF NOT EXISTS legal_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    status TEXT DEFAULT 'published',
    effective_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. SEO PAGES
CREATE TABLE IF NOT EXISTS seo_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_slug TEXT UNIQUE NOT NULL,
    page_title TEXT,
    meta_title TEXT,
    meta_description TEXT,
    keywords JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Draft',
    seo_score INTEGER DEFAULT 0,
    publish_at TIMESTAMPTZ,
    expire_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. COOKIE CONSENTS
CREATE TABLE IF NOT EXISTS cookie_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    consent_type TEXT DEFAULT 'analytics',
    ip_address TEXT,
    user_agent TEXT,
    choices JSONB DEFAULT '{}'::jsonb,
    consent_given_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    source TEXT DEFAULT 'website',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_campaign_logs_brevo_msg ON campaign_logs(brevo_message_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_messages_folder ON mailbox_messages(folder);
CREATE INDEX IF NOT EXISTS idx_mailbox_messages_recipient ON mailbox_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_news_slug ON news(slug);
CREATE INDEX IF NOT EXISTS idx_offer_letters_code ON offer_letters(verification_code);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(verification_code);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_ip ON cookie_consents(ip_address);

-- Seed Senders
INSERT INTO sender_emails (name, email, department, reply_to_email, is_verified, status)
VALUES
  ('Auxosys Careers', 'careers@auxosys.com', 'HR / Recruitment', 'careers@auxosys.com', true, 'active'),
  ('Auxosys General', 'hello@auxosys.com', 'General Enquiries', 'hello@auxosys.com', true, 'active'),
  ('Auxosys Sales', 'sales@auxosys.com', 'Sales & Business', 'sales@auxosys.com', true, 'active'),
  ('Auxosys Support', 'support@auxosys.com', 'Customer Support', 'support@auxosys.com', true, 'active'),
  ('Auxosys HR', 'hr@auxosys.com', 'Human Resources', 'hr@auxosys.com', true, 'active')
ON CONFLICT (email) DO NOTHING;
