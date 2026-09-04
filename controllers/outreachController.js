/**
 * outreachController.js
 *
 * Central Brevo Outreach Controller managing Sender Emails, Per-User Sender Permissions,
 * Contacts, Lists, Templates, Campaign Sequences, Webhook Audit Logs, and Email Activity.
 */

const { fetchBrevoSenders, sendEmail } = require('../services/brevoService');

function getDepartmentForEmail(email) {
  if (!email) return 'General';
  const e = email.toLowerCase();
  if (e.includes('privacy')) return 'Privacy & Compliance';
  if (e.includes('support')) return 'Customer Support';
  if (e.includes('hr')) return 'Human Resources';
  if (e.includes('careers')) return 'HR / Recruitment';
  if (e.includes('contact')) return 'General Contact';
  if (e.includes('noreply')) return 'Automated Notifications';
  if (e.includes('sales')) return 'Sales & Business';
  if (e.includes('hello')) return 'General Enquiries';
  return 'General';
}

async function syncBrevoSendersInternal(supabase) {
  try {
    let brevoSenders = await fetchBrevoSenders();

    const defaultSenders = [
      { id: '1', name: 'Privacy Auxosys', email: 'privacy@auxosys.com', active: true, dept: 'Privacy & Compliance' },
      { id: '2', name: 'Support Auxosys', email: 'support@auxosys.com', active: true, dept: 'Customer Support' },
      { id: '3', name: 'Auxosys HR Team', email: 'hr@auxosys.com', active: true, dept: 'Human Resources' },
      { id: '4', name: 'Auxosys Contact', email: 'contact@auxosys.com', active: true, dept: 'General Contact' },
      { id: '5', name: 'Auxosys Notifications', email: 'noreply@auxosys.com', active: true, dept: 'Automated Notifications' },
      { id: '6', name: 'Talent Acquisition Auxosys', email: 'careers@auxosys.com', active: true, dept: 'HR / Recruitment' },
      { id: '7', name: 'Auxosys Main', email: 'auxosys@gmail.com', active: true, dept: 'General Enquiries' },
      { id: '8', name: 'Auxosys General', email: 'hello@auxosys.com', active: true, dept: 'General Enquiries' },
      { id: '9', name: 'Auxosys Sales', email: 'sales@auxosys.com', active: true, dept: 'Sales & Business' },
    ];

    if (!brevoSenders || brevoSenders.length === 0) {
      brevoSenders = defaultSenders;
    } else {
      const existingEmails = new Set(brevoSenders.map(s => s.email?.toLowerCase()));
      for (const ds of defaultSenders) {
        if (!existingEmails.has(ds.email.toLowerCase())) {
          brevoSenders.push(ds);
        }
      }
    }

    let syncedCount = 0;
    let insertedCount = 0;

    for (const bs of brevoSenders) {
      if (!bs.email) continue;

      const { data: existing } = await supabase
        .from('sender_emails')
        .select('id')
        .eq('email', bs.email)
        .maybeSingle();

      const dept = bs.dept || getDepartmentForEmail(bs.email);

      if (existing) {
        await supabase.from('sender_emails').update({
          name: bs.name || bs.email.split('@')[0],
          brevo_sender_id: String(bs.id),
          is_verified: bs.active !== undefined ? bs.active : true,
          department: dept,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        syncedCount++;
      } else {
        await supabase.from('sender_emails').insert({
          name: bs.name || bs.email.split('@')[0],
          email: bs.email,
          department: dept,
          brevo_sender_id: String(bs.id),
          reply_to_email: bs.email,
          is_verified: bs.active !== undefined ? bs.active : true,
          status: 'active',
        });
        insertedCount++;
      }
    }

    return { synced: syncedCount, inserted: insertedCount, total: brevoSenders.length };
  } catch (err) {
    console.error('syncBrevoSendersInternal error:', err);
    return { synced: 0, inserted: 0, total: 0, error: err.message };
  }
}

function makeOutreachController(supabase) {
  return {
    // ----------------------------------------------------
    // SENDER EMAILS API
    // ----------------------------------------------------
    async listSenderEmails(req, res) {
      try {
        const user = req.user;
        const isAdminOrAbove = user && (
          user.role === 'Superadmin' ||
          user.role === 'Admin' ||
          user.user_metadata?.role === 'Superadmin' ||
          user.user_metadata?.role === 'Admin' ||
          (user.email && (
            user.email.toLowerCase() === 'admin@auxosys.com' ||
            user.email.toLowerCase() === 'auxosys@gmail.com'
          ))
        );

        let { data: senders, error } = await supabase
          .from('sender_emails')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;

        // Auto sync if list has fewer than 7 senders
        if (!senders || senders.length < 7) {
          await syncBrevoSendersInternal(supabase);
          const { data: updatedSenders } = await supabase
            .from('sender_emails')
            .select('*')
            .order('created_at', { ascending: true });
          if (updatedSenders) senders = updatedSenders;
        }

        // Non-admin users: filter to only their explicitly assigned senders (if permissions assigned)
        if (!isAdminOrAbove && user) {
          const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(str));
          const userIdentifiers = [user.id, user._id, user.user_metadata?.id].filter(Boolean).filter(isUuid);

          if (userIdentifiers.length > 0) {
            const { data: perms } = await supabase
              .from('user_sender_permissions')
              .select('sender_email_id')
              .in('user_id', userIdentifiers);

            if (perms && perms.length > 0) {
              const allowedSet = new Set((perms || []).map(p => String(p.sender_email_id).toLowerCase()));
              senders = (senders || []).filter(s => {
                const sId = String(s.id).toLowerCase();
                const sEmail = String(s.email || '').toLowerCase();
                return allowedSet.has(sId) || allowedSet.has(sEmail);
              });
            }
          }
        }

        return res.json({ senders: senders || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async createSenderEmail(req, res) {
      try {
        const { name, email, department, reply_to_email, status = 'active' } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Sender name and email are required' });

        const { data: sender, error } = await supabase
          .from('sender_emails')
          .insert({ name, email, department, reply_to_email: reply_to_email || email, status })
          .select()
          .single();

        if (error) throw error;
        return res.json({ sender });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async updateSenderEmail(req, res) {
      try {
        const { id } = req.params;
        const { name, email, department, reply_to_email, status, is_verified } = req.body;

        const { data: sender, error } = await supabase
          .from('sender_emails')
          .update({ name, email, department, reply_to_email, status, is_verified, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.json({ sender });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async deleteSenderEmail(req, res) {
      try {
        const { id } = req.params;
        const { error } = await supabase.from('sender_emails').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async syncBrevoSenders(req, res) {
      try {
        const result = await syncBrevoSendersInternal(supabase);
        return res.json({
          synced: result.synced,
          inserted: result.inserted,
          total: result.total,
          message: `Updated ${result.synced || 0}, imported ${result.inserted || 0} new senders from Brevo.`,
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // USER SENDER PERMISSIONS API
    // ----------------------------------------------------
    async getUserPermissions(req, res) {
      try {
        const { user_id } = req.params;
        const { data: perms, error } = await supabase
          .from('user_sender_permissions')
          .select('*, sender_emails(*)')
          .eq('user_id', user_id);

        if (error) throw error;
        return res.json({ permissions: perms || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async assignUserPermission(req, res) {
      try {
        const { user_id, sender_email_id } = req.body;
        if (!user_id || !sender_email_id) {
          return res.status(400).json({ error: 'user_id and sender_email_id are required' });
        }

        const { data: perm, error } = await supabase
          .from('user_sender_permissions')
          .upsert({ user_id, sender_email_id }, { onConflict: 'user_id,sender_email_id' })
          .select()
          .single();

        if (error) throw error;
        return res.json({ permission: perm });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async revokeUserPermission(req, res) {
      try {
        const { user_id, sender_email_id } = req.body;
        const { error } = await supabase
          .from('user_sender_permissions')
          .delete()
          .eq('user_id', user_id)
          .eq('sender_email_id', sender_email_id);

        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // CONTACTS API & SUPPRESSION
    // ----------------------------------------------------
    async listContacts(req, res) {
      try {
        const { list_id, search, limit = 100, offset = 0 } = req.query;
        let query = supabase.from('contacts').select('*, contact_list_map(list_id)', { count: 'exact' });

        if (search) {
          query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`);
        }

        query = query.order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);

        const { data: contacts, count, error } = await query;
        if (error) throw error;

        let filtered = contacts || [];
        if (list_id) {
          filtered = filtered.filter(c => c.contact_list_map?.some(m => m.list_id === list_id));
        }

        return res.json({ contacts: filtered, total: count || filtered.length });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async createContact(req, res) {
      try {
        const { email, first_name, last_name, company, job_title, phone, list_ids } = req.body;
        if (!email) return res.status(400).json({ error: 'Email address is required' });

        const { data: contact, error } = await supabase
          .from('contacts')
          .upsert({ email, first_name, last_name, company, job_title, phone }, { onConflict: 'user_id,email' })
          .select()
          .single();

        if (error) throw error;

        if (list_ids && Array.isArray(list_ids) && list_ids.length > 0) {
          const maps = list_ids.map(lId => ({ contact_id: contact.id, list_id: lId }));
          await supabase.from('contact_list_map').upsert(maps, { onConflict: 'contact_id,list_id' });
        }

        return res.json({ contact });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async updateContact(req, res) {
      try {
        const { id } = req.params;
        const { email, first_name, last_name, company, job_title, phone } = req.body;
        const { data: contact, error } = await supabase
          .from('contacts')
          .update({ email, first_name, last_name, company, job_title, phone, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.json({ contact });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async importContactsCsv(req, res) {
      try {
        const { contacts, list_id } = req.body;
        if (!Array.isArray(contacts) || contacts.length === 0) {
          return res.status(400).json({ error: 'Contacts array is empty' });
        }

        const validContacts = contacts.filter(c => c.email && c.email.includes('@'));
        const { data: savedContacts, error } = await supabase
          .from('contacts')
          .upsert(validContacts, { onConflict: 'user_id,email' })
          .select();

        if (error) throw error;

        if (list_id && savedContacts) {
          const maps = savedContacts.map(c => ({ contact_id: c.id, list_id }));
          await supabase.from('contact_list_map').upsert(maps, { onConflict: 'contact_id,list_id' });
        }

        return res.json({ importedCount: savedContacts?.length || 0, contacts: savedContacts });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async deleteContact(req, res) {
      try {
        const { id } = req.params;
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async listSuppressions(req, res) {
      try {
        const { data: suppressions, error } = await supabase.from('contact_suppressions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ suppressions: suppressions || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // MAIL LISTS API
    // ----------------------------------------------------
    async listLists(req, res) {
      try {
        const { data: lists, error } = await supabase.from('mail_lists').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        const { data: mappings } = await supabase.from('contact_list_map').select('list_id');
        const countMap = {};
        (mappings || []).forEach(m => { countMap[m.list_id] = (countMap[m.list_id] || 0) + 1; });

        const enriched = (lists || []).map(l => ({ ...l, contact_count: countMap[l.id] || 0 }));
        return res.json({ lists: enriched });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async createList(req, res) {
      try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'List name is required' });

        const { data: list, error } = await supabase.from('mail_lists').insert({ name, description }).select().single();
        if (error) throw error;
        return res.json({ list });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async deleteList(req, res) {
      try {
        const { id } = req.params;
        const { error } = await supabase.from('mail_lists').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // TEMPLATES API
    // ----------------------------------------------------
    async listTemplates(req, res) {
      try {
        const { data: templates, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ templates });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async createTemplate(req, res) {
      try {
        const { name, subject, body_html, body_text } = req.body;
        if (!name || !subject || !body_html) {
          return res.status(400).json({ error: 'Name, subject, and body_html are required' });
        }

        const { data: template, error } = await supabase.from('templates').insert({ name, subject, body_html, body_text }).select().single();
        if (error) throw error;
        return res.json({ template });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async updateTemplate(req, res) {
      try {
        const { id } = req.params;
        const { name, subject, body_html, body_text } = req.body;
        const { data: template, error } = await supabase
          .from('templates')
          .update({ name, subject, body_html, body_text, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.json({ template });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async deleteTemplate(req, res) {
      try {
        const { id } = req.params;
        const { error } = await supabase.from('templates').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // CAMPAIGNS API
    // ----------------------------------------------------
    async listCampaigns(req, res) {
      try {
        const { data: campaigns, error } = await supabase
          .from('campaigns')
          .select('*, sender_emails(email, name, department), templates(name, subject), mail_lists(name)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const { data: logs } = await supabase.from('campaign_logs').select('campaign_id, status, opened_at, clicked_at, replied_at');
        const statsMap = {};

        (logs || []).forEach(l => {
          if (!statsMap[l.campaign_id]) statsMap[l.campaign_id] = { sent: 0, opens: 0, clicks: 0, replies: 0 };
          if (['sent', 'delivered'].includes(l.status)) statsMap[l.campaign_id].sent++;
          if (l.opened_at) statsMap[l.campaign_id].opens++;
          if (l.clicked_at) statsMap[l.campaign_id].clicks++;
          if (l.replied_at) statsMap[l.campaign_id].replies++;
        });

        const enriched = (campaigns || []).map(c => ({
          ...c,
          stats: statsMap[c.id] || { sent: c.sent_count || 0, opens: 0, clicks: 0, replies: 0 },
        }));

        return res.json({ campaigns: enriched });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async createCampaign(req, res) {
      try {
        const user = req.user;
        const { name, sender_email_id, template_id, list_id, daily_limit = 100, min_delay_sec = 30, max_delay_sec = 90, track_opens = true, track_clicks = true } = req.body;

        if (!name || !sender_email_id || !template_id || !list_id) {
          return res.status(400).json({ error: 'Name, sender_email_id, template_id, and list_id are required' });
        }

        // Check if non-superadmin user has permission for sender_email_id
        const isSuper = user && (user.role === 'Superadmin' || user.email === 'admin@auxosys.com' || user.email === 'auxosys@gmail.com');
        if (!isSuper && user) {
          const { data: perm } = await supabase
            .from('user_sender_permissions')
            .select('id')
            .eq('user_id', user.id)
            .eq('sender_email_id', sender_email_id)
            .single();

          if (!perm) {
            return res.status(403).json({ error: 'Access Denied: You are not authorized to send from this sender email address.' });
          }
        }

        const { data: campaign, error } = await supabase
          .from('campaigns')
          .insert({
            name,
            sender_email_id,
            template_id,
            list_id,
            status: 'draft',
            daily_limit,
            min_delay_sec,
            max_delay_sec,
            track_opens,
            track_clicks,
            created_by_user_id: user?.id || null,
          })
          .select()
          .single();

        if (error) throw error;
        return res.json({ campaign });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async launchCampaign(req, res) {
      try {
        const { id } = req.params;
        const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single();
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { data: mapRows } = await supabase.from('contact_list_map').select('contact_id, contacts(*)').eq('list_id', campaign.list_id);
        const contacts = (mapRows || []).map(m => m.contacts).filter(Boolean);

        if (contacts.length === 0) {
          return res.status(400).json({ error: 'Audience list has no contacts' });
        }

        const logEntries = contacts.map(c => ({
          campaign_id: campaign.id,
          sender_email_id: campaign.sender_email_id,
          created_by_user_id: campaign.created_by_user_id,
          contact_id: c.id,
          recipient_email: c.email,
          status: 'queued',
        }));

        await supabase.from('campaign_logs').upsert(logEntries, { onConflict: 'campaign_id,recipient_email' });

        const { data: updated } = await supabase
          .from('campaigns')
          .update({ status: 'sending', total_contacts: contacts.length, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        return res.json({ campaign: updated, queuedRecipients: contacts.length });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async pauseCampaign(req, res) {
      try {
        const { id } = req.params;
        const { data: updated, error } = await supabase
          .from('campaigns')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.json({ campaign: updated });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    async deleteCampaign(req, res) {
      try {
        const { id } = req.params;
        const { error } = await supabase.from('campaigns').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // EMAIL ACTIVITY & AUDIT LOGS API
    // ----------------------------------------------------
    async listEmailActivity(req, res) {
      try {
        const { search, limit = 100, offset = 0 } = req.query;
        let query = supabase
          .from('campaign_logs')
          .select('*, sender_emails(email, name), campaigns(name)', { count: 'exact' });

        if (search) {
          query = query.or(`recipient_email.ilike.%${search}%,brevo_message_id.ilike.%${search}%`);
        }

        query = query.order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);

        const { data: logs, count, error } = await query;
        if (error) throw error;

        return res.json({ activity: logs || [], total: count || 0 });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // DASHBOARD STATS API
    // ----------------------------------------------------
    async getDashboardStats(req, res) {
      try {
        const { data: logs } = await supabase.from('campaign_logs').select('status, opened_at, clicked_at, replied_at');
        const { count: totalContacts } = await supabase.from('contacts').select('id', { count: 'exact', head: true });
        const { count: totalSenders } = await supabase.from('sender_emails').select('id', { count: 'exact', head: true });

        let sent = 0;
        let opens = 0;
        let clicks = 0;
        let replies = 0;

        (logs || []).forEach(l => {
          if (['sent', 'delivered'].includes(l.status)) sent++;
          if (l.opened_at) opens++;
          if (l.clicked_at) clicks++;
          if (l.replied_at) replies++;
        });

        return res.json({
          totalSenders: totalSenders || 0,
          totalContacts: totalContacts || 0,
          emailsSent: sent,
          estimatedOpens: opens,
          linkClicks: clicks,
          replies: replies,
          openRate: sent > 0 ? ((opens / sent) * 100).toFixed(1) : '0.0',
          clickRate: sent > 0 ? ((clicks / sent) * 100).toFixed(1) : '0.0',
          replyRate: sent > 0 ? ((replies / sent) * 100).toFixed(1) : '0.0',
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },

    // ----------------------------------------------------
    // DIRECT EMAIL SEND (Compose → Brevo)
    // ----------------------------------------------------
    async sendDirectEmail(req, res) {
      try {
        const { senderEmailId, to, cc, bcc, subject, html, text, attachments } = req.body;
        if (!senderEmailId) return res.status(400).json({ error: 'senderEmailId is required.' });
        if (!to || (Array.isArray(to) && to.length === 0)) return res.status(400).json({ error: 'Recipient (to) is required.' });
        if (!subject) return res.status(400).json({ error: 'Subject is required.' });

        // Load sender details (support lookup by UUID or email string)
        let sender;
        const { data: sById } = await supabase
          .from('sender_emails')
          .select('*')
          .eq('id', senderEmailId)
          .maybeSingle();

        if (sById) {
          sender = sById;
        } else {
          const { data: sByEmail } = await supabase
            .from('sender_emails')
            .select('*')
            .eq('email', senderEmailId)
            .maybeSingle();
          sender = sByEmail;
        }

        if (!sender) return res.status(404).json({ error: 'Sender email not found.' });
        if (sender.status !== 'active') return res.status(400).json({ error: 'Sender email is not active.' });

        const isSuper = req.user?.email === 'admin@auxosys.com' || req.user?.email === 'auxosys@gmail.com';
        if (!isSuper && req.user) {
          const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(str));
          const userIdentifiers = [req.user.id, req.user._id, req.user.user_metadata?.id].filter(Boolean).filter(isUuid);
          if (userIdentifiers.length > 0) {
            const { data: perms } = await supabase
              .from('user_sender_permissions')
              .select('sender_email_id')
              .in('user_id', userIdentifiers);

            const allowedSenderIds = new Set((perms || []).map(p => String(p.sender_email_id).toLowerCase()));
            const sId = String(sender.id).toLowerCase();
            const sEmail = String(sender.email || '').toLowerCase();
            if (!allowedSenderIds.has(sId) && !allowedSenderIds.has(sEmail)) {
              return res.status(403).json({ error: 'Access Denied: You do not have permission to send from this sender email.' });
            }
          }
        }

        const rawTo = Array.isArray(to) ? to.join(',') : String(to || '');
        const recipients = rawTo.split(',').map(e => e.trim()).filter(Boolean);
        const results = [];

        for (const recipientEmail of recipients) {
          try {
            const result = await sendEmail({
              senderName: sender.name,
              senderEmail: sender.email,
              recipientEmail,
              subject,
              htmlContent: html || '',
              textContent: text,
              replyTo: sender.reply_to_email || sender.email,
              tags: ['auxosys-direct-compose'],
              attachments: attachments || [],
            });

            // Log to campaign_logs
            try {
              const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(str));
              const validUserId = isUuid(req.user?.id) ? req.user.id : null;

              const metaPayload = JSON.stringify({
                subject,
                html: html || '',
                text: text || '',
                attachments: (attachments || []).map(a => typeof a === 'string' ? a : (a.name || a.filename || 'attachment')),
              });

              await supabase.from('campaign_logs').insert({
                sender_email_id: sender.id,
                recipient_email: recipientEmail,
                status: 'sent',
                sent_at: new Date().toISOString(),
                brevo_message_id: result?.messageId || null,
                created_by_user_id: validUserId,
                error_message: metaPayload,
              });
            } catch (logErr) {
              console.warn('[outreachController] Non-fatal campaign_log insert error:', logErr.message);
            }

            results.push({ recipientEmail, success: true, messageId: result?.messageId });
          } catch (sendErr) {
            results.push({ recipientEmail, success: false, error: sendErr.message });
          }
        }

        const successCount = results.filter(r => r.success).length;
        if (successCount === 0) return res.status(500).json({ error: 'All sends failed.', results });

        return res.json({ success: true, sent: successCount, results });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  };
}

module.exports = { makeOutreachController };
