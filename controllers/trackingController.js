/**
 * trackingController.js
 *
 * Handles Open & Click Tracking endpoints.
 * Open tracking pixel returns a transparent 1x1 GIF and updates opened_at (marked as estimated).
 * Click tracking records clicked_at timestamp and performs a 302 redirect to the destination URL.
 */

// 1x1 transparent GIF binary buffer
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function makeTrackingController(supabase) {
  return {
    async trackOpen(req, res) {
      const { logId } = req.params;

      // Always return 1x1 pixel immediately
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(200).send(TRANSPARENT_GIF);

      // Asynchronously record open timestamp
      if (logId) {
        try {
          const { data: log } = await supabase
            .from('campaign_logs')
            .select('id, opened_at, open_count')
            .eq('id', logId)
            .single();

          if (log) {
            const updates = {
              open_count: (log.open_count || 0) + 1,
              updated_at: new Date().toISOString(),
            };
            if (!log.opened_at) {
              updates.opened_at = new Date().toISOString();
            }
            await supabase.from('campaign_logs').update(updates).eq('id', logId);
          }
        } catch (err) {
          console.error('[TrackingController] Error tracking open:', err.message);
        }
      }
    },

    async trackClick(req, res) {
      const { logId } = req.params;
      const targetUrl = req.query.target;

      // Fallback destination URL if invalid
      let safeTarget = '/';
      if (targetUrl) {
        try {
          safeTarget = decodeURIComponent(targetUrl);
        } catch (_) {
          safeTarget = targetUrl;
        }
      }

      // Record click timestamp
      if (logId) {
        try {
          const { data: log } = await supabase
            .from('campaign_logs')
            .select('id, opened_at, clicked_at, click_count')
            .eq('id', logId)
            .single();

          if (log) {
            const nowIso = new Date().toISOString();
            const updates = {
              click_count: (log.click_count || 0) + 1,
              updated_at: nowIso,
            };
            if (!log.clicked_at) {
              updates.clicked_at = nowIso;
            }
            // If email clicked, recipient also opened it!
            if (!log.opened_at) {
              updates.opened_at = nowIso;
            }
            await supabase.from('campaign_logs').update(updates).eq('id', logId);
          }
        } catch (err) {
          console.error('[TrackingController] Error tracking click:', err.message);
        }
      }

      // Perform 302 Redirect to destination
      return res.redirect(302, safeTarget);
    },
  };
}

module.exports = { makeTrackingController };
