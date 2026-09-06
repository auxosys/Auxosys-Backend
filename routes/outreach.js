/**
 * outreach.js
 * Express routes for Outreach & Campaign module.
 */

const express = require('express');
const { makeOutreachController } = require('../controllers/outreachController');
const { requirePermission } = require('../middleware/rbacMiddleware');

function makeOutreachRouter(supabase) {
  const router = express.Router();
  const controller = makeOutreachController(supabase);

  // Require admin auth middleware for outreach endpoints
  router.use(requirePermission);

  // Sender Emails Infrastructure
  router.get('/senders', controller.listSenderEmails);
  router.post('/senders', controller.createSenderEmail);
  router.put('/senders/:id', controller.updateSenderEmail);
  router.delete('/senders/:id', controller.deleteSenderEmail);
  router.post('/senders/sync', controller.syncBrevoSenders);

  // User Sender Permissions
  router.get('/permissions/:user_id', controller.getUserPermissions);
  router.post('/permissions', controller.assignUserPermission);
  router.delete('/permissions', controller.revokeUserPermission);

  // Suppressions & Audit Activity Logs
  router.get('/suppressions', controller.listSuppressions);
  router.get('/activity', controller.listEmailActivity);

  // Contacts
  router.get('/contacts', controller.listContacts);
  router.post('/contacts', controller.createContact);
  router.post('/contacts/import', controller.importContactsCsv);
  router.put('/contacts/:id', controller.updateContact);
  router.delete('/contacts/:id', controller.deleteContact);

  // Mail Lists
  router.get('/lists', controller.listLists);
  router.post('/lists', controller.createList);
  router.delete('/lists/:id', controller.deleteList);

  // Templates
  router.get('/templates', controller.listTemplates);
  router.post('/templates', controller.createTemplate);
  router.put('/templates/:id', controller.updateTemplate);
  router.delete('/templates/:id', controller.deleteTemplate);

  // Campaigns
  router.get('/campaigns', controller.listCampaigns);
  router.post('/campaigns', controller.createCampaign);
  router.put('/campaigns/:id', controller.updateCampaign);
  router.post('/campaigns/:id/launch', controller.launchCampaign);
  router.post('/campaigns/:id/pause', controller.pauseCampaign);
  router.delete('/campaigns/:id', controller.deleteCampaign);

  // Stats
  router.get('/stats', controller.getDashboardStats);

  // Drafts
  const { saveDraft, deleteDraft } = require('../controllers/composeController');
  router.post('/drafts', saveDraft);
  router.put('/drafts/:id', saveDraft);
  router.delete('/drafts/:id', deleteDraft);

  // Direct Compose Email (Brevo-powered, no campaign required)
  router.post('/send', controller.sendDirectEmail);

  return router;
}

module.exports = makeOutreachRouter;
