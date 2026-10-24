/**
 * ============================================================================
 * RESTOCKIQ — GOOGLE APPS SCRIPT EMAIL AUTOMATION ENGINE
 * ============================================================================
 * Brand Positioning: AI-powered inventory intelligence and supply-chain optimization.
 * Tagline: Predict Shortages. Prevent Stockouts.
 * Timezone: Asia/Kolkata (IST)
 *
 * Required Script Properties (Project Settings > Script Properties):
 *   1. SUPABASE_URL                  = https://tewaaznazgsmaherddeu.supabase.co
 *   2. SUPABASE_SECRET_KEY           = <Your Supabase service_role / secret key>
 *   3. STOCKPILOT_APPS_SCRIPT_SECRET = <Your shared webhook secret>
 *   4. STOCKPILOT_APP_URL            = <Your ReStockIQ application URL>
 * ============================================================================
 */

var AUTOMATION_TIMEZONE = 'Asia/Kolkata';
var PRODUCT_NAME = 'ReStockIQ';

function cleanPropertyValue_(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

/**
 * 1. Load & Validate Script Properties
 */
function getAutomationConfig_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var supabaseUrl = cleanPropertyValue_(props.SUPABASE_URL).replace(/\/+$/, '');
  var supabaseKey = cleanPropertyValue_(
    props.SUPABASE_SECRET_KEY || props.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  var webhookSecret = cleanPropertyValue_(props.STOCKPILOT_APPS_SCRIPT_SECRET);
  var appUrl = cleanPropertyValue_(
    props.STOCKPILOT_APP_URL ||
      'https://ais-pre-fei5m4ha6ifw3sqkztnkff-717334798504.asia-southeast1.run.app'
  ).replace(/\/+$/, '');

  var missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseKey) missing.push('SUPABASE_SECRET_KEY');
  if (!webhookSecret) missing.push('STOCKPILOT_APPS_SCRIPT_SECRET');
  if (!appUrl) missing.push('STOCKPILOT_APP_URL');

  if (missing.length > 0) {
    throw new Error(
      'Missing required Script Properties: ' + missing.join(', ')
    );
  }

  return {
    supabaseUrl: supabaseUrl,
    supabaseKey: supabaseKey,
    webhookSecret: webhookSecret,
    appUrl: appUrl
  };
}

/**
 * Constant-time string comparison for webhook secret verification
 */
function timingSafeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  var cleanA = cleanPropertyValue_(a);
  var cleanB = cleanPropertyValue_(b);
  if (cleanA.length !== cleanB.length || cleanA.length === 0) return false;
  var mismatch = 0;
  for (var i = 0; i < cleanA.length; i++) {
    mismatch |= cleanA.charCodeAt(i) ^ cleanB.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * HTML Escape Helper
 */
function escapeHtml_(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format Date in Asia/Kolkata (yyyy-MM-dd)
 */
function getTodayDateKeyIST_() {
  return Utilities.formatDate(new Date(), AUTOMATION_TIMEZONE, 'yyyy-MM-dd');
}

function getFormattedTimestampIST_() {
  return (
    Utilities.formatDate(
      new Date(),
      AUTOMATION_TIMEZONE,
      'dd MMM yyyy, hh:mm a'
    ) + ' IST'
  );
}

/**
 * ============================================================================
 * SUPABASE REST API CLIENT HELPERS
 * ============================================================================
 */
function supabaseRequest_(config, path, method, body, extraHeaders) {
  var url = config.supabaseUrl + '/rest/v1/' + path.replace(/^\/+/, '');
  var headers = {
    apikey: config.supabaseKey,
    Authorization: 'Bearer ' + config.supabaseKey,
    'Content-Type': 'application/json'
  };

  if (extraHeaders) {
    for (var k in extraHeaders) {
      if (Object.prototype.hasOwnProperty.call(extraHeaders, k)) {
        headers[k] = extraHeaders[k];
      }
    }
  }

  var options = {
    method: (method || 'get').toLowerCase(),
    headers: headers,
    muteHttpExceptions: true
  };

  if (body !== undefined && body !== null) {
    options.payload = JSON.stringify(body);
  }

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();
  var text = response.getContentText();
  var data = null;

  if (text && text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      'Supabase HTTP ' +
        statusCode +
        ' on ' +
        path +
        ': ' +
        (typeof data === 'string' ? data : JSON.stringify(data))
    );
  }

  return data;
}

/**
 * Record dispatch status via SECURITY DEFINER RPC (works even if direct table RLS blocks non-service-role keys)
 */
function recordDispatchViaRpc_(config, queueId, status, errorMessage, metadata) {
  if (!queueId) return null;
  try {
    return supabaseRequest_(config, 'rpc/record_email_dispatch_result', 'post', {
      p_queue_id: queueId,
      p_status: status,
      p_error_message: errorMessage || null,
      p_metadata: metadata || {}
    });
  } catch (err) {
    Logger.log('Warning: record_email_dispatch_result RPC error: ' + err);
    return null;
  }
}

/**
 * Record an entry in public.email_delivery_logs
 */
function insertDeliveryLog_(config, logEntry) {
  try {
    supabaseRequest_(
      config,
      'email_delivery_logs',
      'post',
      {
        organization_id: logEntry.organization_id,
        user_id: logEntry.user_id || null,
        firebase_uid: logEntry.firebase_uid || null,
        recipient_email: logEntry.recipient_email,
        template_type: logEntry.template_type,
        status: logEntry.status,
        subject: logEntry.subject || null,
        idempotency_key: logEntry.idempotency_key || null,
        queue_id: logEntry.queue_id || null,
        metadata: logEntry.metadata || {},
        error_message: logEntry.error_message || null,
        sent_at: new Date().toISOString()
      },
      { Prefer: 'return=minimal' }
    );
  } catch (err) {
    Logger.log('Warning: Could not insert email_delivery_logs row: ' + err);
  }
}

/**
 * ============================================================================
 * 2. WEBHOOK ENTRY POINTS: doGet(e) & doPost(e)
 * ============================================================================
 * Secured by STOCKPILOT_APPS_SCRIPT_SECRET.
 * Actions:
 *   - SEND_WELCOME_EMAIL
 *   - PROCESS_EMAIL_QUEUE
 *   - RUN_DAILY_INVENTORY_ALERTS
 *   - HEALTH_CHECK
 */
function doGet(e) {
  try {
    var config = getAutomationConfig_();
    return jsonResponse_({
      success: true,
      service: PRODUCT_NAME + ' Apps Script Email Automation',
      status: 'READY',
      timezone: AUTOMATION_TIMEZONE,
      supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseKey),
      remainingDailyQuota: MailApp.getRemainingDailyQuota(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse_({
      success: false,
      status: 'MISCONFIGURED',
      error: String(err && err.message ? err.message : err)
    });
  }
}

function doPost(e) {
  try {
    var config = getAutomationConfig_();
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ success: false, error: 'Missing request body' });
    }

    var body = JSON.parse(e.postData.contents);
    var providedSecret = String(body.secret || '');

    if (!timingSafeEqual_(providedSecret, config.webhookSecret)) {
      return jsonResponse_({
        success: false,
        error: 'Unauthorized: Invalid webhook secret'
      });
    }

    var action = String(body.action || 'PROCESS_EMAIL_QUEUE').toUpperCase();

    if (action === 'HEALTH_CHECK') {
      return jsonResponse_({
        success: true,
        status: 'READY',
        timezone: AUTOMATION_TIMEZONE,
        remainingDailyQuota: MailApp.getRemainingDailyQuota(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'SEND_WELCOME_EMAIL') {
      var welcomeResult = handleWelcomeWebhook_(config, body);
      return jsonResponse_(welcomeResult);
    }

    if (action === 'PROCESS_EMAIL_QUEUE') {
      var queueResult = processPendingEmailQueue();
      return jsonResponse_(queueResult);
    }

    if (action === 'RUN_DAILY_INVENTORY_ALERTS') {
      var dailyResult = runDailyInventoryAlerts();
      return jsonResponse_(dailyResult);
    }

    return jsonResponse_({
      success: false,
      error: 'Unsupported action: ' + action
    });
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonResponse_({
      success: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Handle immediate SEND_WELCOME_EMAIL webhook or enqueue + dispatch
 */
function handleWelcomeWebhook_(config, body) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return {
      success: false,
      status: 'FAILED',
      error: 'Another email job is currently holding the lock'
    };
  }

  try {
    var queueId = body.queueId || null;
    var targetEmail = String(body.email || '')
      .trim()
      .toLowerCase();
    var targetUid = String(body.firebaseUid || '').trim();

    // 1. Try looking up the exact queueId row in email_queue
    if (queueId) {
      try {
        var rows = supabaseRequest_(
          config,
          'email_queue?id=eq.' + encodeURIComponent(queueId) + '&select=*',
          'get'
        );
        if (rows && rows.length > 0) {
          return dispatchWelcomeQueueRow_(config, rows[0]);
        }
      } catch (lookupErr) {
        Logger.log('Direct email_queue lookup by id failed, falling back: ' + lookupErr);
      }
    }

    // 2. Try looking up by firebase_uid or recipient_email in email_queue
    if (targetEmail || targetUid) {
      try {
        var filter = targetUid
          ? 'firebase_uid=eq.' + encodeURIComponent(targetUid)
          : 'recipient_email=ilike.' + encodeURIComponent(targetEmail);
        var userRows = supabaseRequest_(
          config,
          'email_queue?template_type=eq.WELCOME&' +
            filter +
            '&order=created_at.desc&limit=1&select=*',
          'get'
        );
        if (userRows && userRows.length > 0) {
          return dispatchWelcomeQueueRow_(config, userRows[0]);
        }
      } catch (filterErr) {
        Logger.log('Filtered email_queue lookup failed, falling back: ' + filterErr);
      }
    }

    // 3. If webhook provided a direct email payload (e.g., direct table SELECT was blocked by RLS or row not visible),
    // dispatch using the verified webhook payload and record via SECURITY DEFINER RPC
    if (targetEmail && targetEmail.indexOf('@') !== -1) {
      return dispatchWelcomeQueueRow_(config, {
        id: queueId,
        firebase_uid: targetUid || null,
        recipient_email: targetEmail,
        recipient_name: body.fullName || targetEmail.split('@')[0],
        template_type: 'WELCOME',
        idempotency_key:
          body.idempotencyKey ||
          (targetUid
            ? 'welcome:firebase_uid:' + targetUid
            : 'welcome:email:' + targetEmail),
        payload: {
          store_name: body.storeName || 'Your Retail Workspace'
        },
        attempts: 0
      });
    }

    // 4. Otherwise process all pending rows in email_queue
    return processPendingEmailQueueInternal_(config);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * 3. WELCOME EMAIL QUEUE PROCESSOR (Requirement A)
 * ============================================================================
 * Safely processes PENDING (and retryable FAILED) rows in public.email_queue.
 * Enforces strict idempotency so a user receives at most ONE welcome email
 * across Google Sign-Up, Email/Password Sign-Up, and linked providers.
 */
function processPendingEmailQueue() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return {
      success: false,
      skippedLock: true,
      message: 'Another queue processor execution is already running.'
    };
  }

  try {
    var config = getAutomationConfig_();
    return processPendingEmailQueueInternal_(config);
  } finally {
    lock.releaseLock();
  }
}

function processPendingEmailQueueInternal_(config) {
  var pendingRows = supabaseRequest_(
    config,
    'email_queue?status=in.(PENDING,FAILED)&attempts=lt.3&order=created_at.asc&limit=25',
    'get'
  );

  if (!pendingRows || pendingRows.length === 0) {
    return {
      success: true,
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      message: 'No pending emails in email_queue.'
    };
  }

  var sentCount = 0;
  var skippedCount = 0;
  var failedCount = 0;
  var details = [];

  for (var i = 0; i < pendingRows.length; i++) {
    var row = pendingRows[i];
    if (row.template_type === 'WELCOME') {
      var res = dispatchWelcomeQueueRow_(config, row);
      details.push(res);
      if (res.status === 'SENT') sentCount++;
      else if (res.status === 'SKIPPED') skippedCount++;
      else failedCount++;
    }
  }

  return {
    success: failedCount === 0 || sentCount > 0 || skippedCount > 0,
    processed: pendingRows.length,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    details: details
  };
}

function dispatchWelcomeQueueRow_(config, row) {
  var queueId = row.id || null;
  var recipientEmail = String(row.recipient_email || '')
    .trim()
    .toLowerCase();

  if (!recipientEmail || recipientEmail.indexOf('@') === -1) {
    if (queueId) {
      updateQueueRowStatus_(
        config,
        queueId,
        'FAILED',
        'Invalid recipient_email on queue row',
        row.attempts
      );
    }
    return {
      success: false,
      queueId: queueId,
      status: 'FAILED',
      error: 'Invalid email'
    };
  }

  var idempotencyKey =
    row.idempotency_key ||
    (row.firebase_uid
      ? 'welcome:firebase_uid:' + row.firebase_uid
      : row.user_id
      ? 'welcome:user_id:' + row.user_id
      : 'welcome:email:' + recipientEmail);

  // If this specific row was already marked SENT, return SKIPPED immediately
  if (String(row.status || '').toUpperCase() === 'SENT') {
    return {
      success: true,
      queueId: queueId,
      recipientEmail: recipientEmail,
      status: 'SKIPPED',
      reason: 'Welcome email row already marked SENT'
    };
  }

  // Check if a WELCOME email has ALREADY been SENT for this email, user_id, or idempotency_key
  var alreadySentQueue = [];
  var alreadySentLog = [];
  try {
    var neqClause = queueId ? '&id=neq.' + encodeURIComponent(queueId) : '';
    alreadySentQueue =
      supabaseRequest_(
        config,
        'email_queue?template_type=eq.WELCOME&status=eq.SENT&recipient_email=ilike.' +
          encodeURIComponent(recipientEmail) +
          neqClause +
          '&select=id',
        'get'
      ) || [];
  } catch (qErr) {
    Logger.log('Deduplication check on email_queue warning: ' + qErr);
  }

  try {
    alreadySentLog =
      supabaseRequest_(
        config,
        'email_delivery_logs?template_type=eq.WELCOME&status=eq.SENT&recipient_email=ilike.' +
          encodeURIComponent(recipientEmail) +
          '&select=id',
        'get'
      ) || [];
  } catch (lErr) {
    Logger.log('Deduplication check on email_delivery_logs warning: ' + lErr);
  }

  if (
    (alreadySentQueue && alreadySentQueue.length > 0) ||
    (alreadySentLog && alreadySentLog.length > 0)
  ) {
    if (queueId) {
      updateQueueRowStatus_(
        config,
        queueId,
        'SKIPPED',
        'Duplicate prevented: WELCOME email already sent to ' + recipientEmail,
        row.attempts,
        idempotencyKey
      );
    }
    return {
      success: true,
      queueId: queueId,
      recipientEmail: recipientEmail,
      status: 'SKIPPED',
      reason: 'Already sent welcome email to this canonical user'
    };
  }

  // Resolve organization_id and user_id from profiles if missing on queue row
  var orgId = row.organization_id || null;
  var userId = row.user_id || null;
  var recipientName = row.recipient_name || '';
  var storeName =
    row.payload && row.payload.store_name ? row.payload.store_name : '';

  if (!orgId || !userId || !recipientName) {
    try {
      var profiles = supabaseRequest_(
        config,
        'profiles?email=ilike.' +
          encodeURIComponent(recipientEmail) +
          '&select=id,organization_id,full_name,store_name,firebase_uid&limit=1',
        'get'
      );
      if (profiles && profiles.length > 0) {
        userId = userId || profiles[0].id;
        orgId = orgId || profiles[0].organization_id;
        recipientName = recipientName || profiles[0].full_name;
        storeName = storeName || profiles[0].store_name;
      }
    } catch (profErr) {
      Logger.log('Profile lookup warning: ' + profErr);
    }
  }

  if (orgId && !storeName) {
    try {
      var orgs = supabaseRequest_(
        config,
        'organizations?id=eq.' + encodeURIComponent(orgId) + '&select=name&limit=1',
        'get'
      );
      if (orgs && orgs.length > 0) {
        storeName = orgs[0].name;
      }
    } catch (orgErr) {
      Logger.log('Organization lookup warning: ' + orgErr);
    }
  }

  var remainingQuota = MailApp.getRemainingDailyQuota();
  if (remainingQuota <= 0) {
    if (queueId) {
      updateQueueRowStatus_(
        config,
        queueId,
        'FAILED',
        'MailApp daily email quota exhausted (remaining: 0)',
        row.attempts,
        idempotencyKey
      );
    }
    return {
      success: false,
      queueId: queueId,
      recipientEmail: recipientEmail,
      status: 'FAILED',
      error: 'MailApp daily quota exhausted'
    };
  }

  // Mark PROCESSING if direct table access is available
  if (queueId) {
    try {
      supabaseRequest_(
        config,
        'email_queue?id=eq.' + encodeURIComponent(queueId),
        'patch',
        {
          status: 'PROCESSING',
          idempotency_key: idempotencyKey,
          organization_id: orgId || null,
          user_id: userId || null,
          updated_at: new Date().toISOString()
        },
        { Prefer: 'return=minimal' }
      );
    } catch (procErr) {
      Logger.log('Mark PROCESSING warning: ' + procErr);
    }
  }

  var emailContent = buildWelcomeEmailTemplate_({
    fullName: recipientName || recipientEmail.split('@')[0],
    email: recipientEmail,
    storeName: storeName || 'Your Retail Workspace',
    appUrl: config.appUrl
  });

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailContent.subject,
      body: emailContent.plainBody,
      htmlBody: emailContent.htmlBody,
      name: PRODUCT_NAME + ' Inventory Intelligence'
    });

    var nowIso = new Date().toISOString();
    var metadataObj = {
      store_name: storeName || 'Your Retail Workspace',
      dispatched_by: 'apps_script_mailapp',
      timezone: AUTOMATION_TIMEZONE
    };

    if (queueId) {
      try {
        supabaseRequest_(
          config,
          'email_queue?id=eq.' + encodeURIComponent(queueId),
          'patch',
          {
            status: 'SENT',
            subject: emailContent.subject,
            idempotency_key: idempotencyKey,
            organization_id: orgId || null,
            user_id: userId || null,
            attempts: Number(row.attempts || 0) + 1,
            error_message: null,
            processed_at: nowIso,
            sent_at: nowIso,
            updated_at: nowIso
          },
          { Prefer: 'return=minimal' }
        );
        if (orgId) {
          insertDeliveryLog_(config, {
            organization_id: orgId,
            user_id: userId,
            firebase_uid: row.firebase_uid || null,
            recipient_email: recipientEmail,
            template_type: 'WELCOME',
            status: 'SENT',
            subject: emailContent.subject,
            idempotency_key: idempotencyKey,
            queue_id: queueId,
            metadata: metadataObj
          });
        }
      } catch (patchErr) {
        recordDispatchViaRpc_(config, queueId, 'SENT', null, metadataObj);
      }
    }

    return {
      success: true,
      queueId: queueId,
      recipientEmail: recipientEmail,
      status: 'SENT',
      idempotencyKey: idempotencyKey
    };
  } catch (sendErr) {
    var errMsg = String(
      sendErr && sendErr.message ? sendErr.message : sendErr
    );
    if (queueId) {
      updateQueueRowStatus_(
        config,
        queueId,
        'FAILED',
        errMsg,
        row.attempts,
        idempotencyKey
      );
    }

    if (orgId) {
      insertDeliveryLog_(config, {
        organization_id: orgId,
        user_id: userId,
        firebase_uid: row.firebase_uid || null,
        recipient_email: recipientEmail,
        template_type: 'WELCOME',
        status: 'FAILED',
        subject: emailContent.subject,
        idempotency_key: idempotencyKey,
        queue_id: queueId,
        error_message: errMsg
      });
    }

    return {
      success: false,
      queueId: queueId,
      recipientEmail: recipientEmail,
      status: 'FAILED',
      error: errMsg
    };
  }
}

function updateQueueRowStatus_(
  config,
  queueId,
  status,
  errorMessage,
  currentAttempts,
  idempotencyKey
) {
  if (!queueId) return;
  var patch = {
    status: status,
    attempts: Number(currentAttempts || 0) + 1,
    error_message: errorMessage || null,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (idempotencyKey) {
    patch.idempotency_key = idempotencyKey;
  }
  try {
    supabaseRequest_(
      config,
      'email_queue?id=eq.' + encodeURIComponent(queueId),
      'patch',
      patch,
      { Prefer: 'return=minimal' }
    );
  } catch (err) {
    recordDispatchViaRpc_(config, queueId, status, errorMessage, {});
  }
}

/**
 * ============================================================================
 * 4. DAILY INVENTORY ALERT AUTOMATION AT 10:00 AM IST (Requirement B)
 * ============================================================================
 * Evaluates real inventory, supplier pack sizes, and open incoming orders per
 * organization. Never fabricates SKUs or metrics when inventory is empty.
 */
function runDailyInventoryAlerts() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return {
      success: false,
      skippedLock: true,
      message: 'Another daily inventory alert job is currently running.'
    };
  }

  try {
    var config = getAutomationConfig_();

    // First process any pending welcome emails in the queue
    var welcomeSummary = processPendingEmailQueueInternal_(config);

    var dateKeyIST = getTodayDateKeyIST_();
    var profiles = supabaseRequest_(
      config,
      'profiles?select=id,organization_id,firebase_uid,full_name,email,role,store_name',
      'get'
    );

    if (!profiles || profiles.length === 0) {
      return {
        success: true,
        dateKeyIST: dateKeyIST,
        welcomeQueue: welcomeSummary,
        evaluatedUsers: 0,
        sent: 0,
        skipped: 0,
        message: 'No user profiles found in public.profiles.'
      };
    }

    var allPrefs = supabaseRequest_(
      config,
      'user_email_preferences?select=*',
      'get'
    );
    var prefsByUserId = {};
    if (allPrefs) {
      for (var p = 0; p < allPrefs.length; p++) {
        prefsByUserId[allPrefs[p].user_id] = allPrefs[p];
      }
    }

    var orgs = supabaseRequest_(config, 'organizations?select=id,name', 'get');
    var orgNameById = {};
    if (orgs) {
      for (var o = 0; o < orgs.length; o++) {
        orgNameById[orgs[o].id] = orgs[o].name;
      }
    }

    var sentCount = 0;
    var skippedCount = 0;
    var failedCount = 0;
    var results = [];

    for (var i = 0; i < profiles.length; i++) {
      var profile = profiles[i];
      var email = String(profile.email || '')
        .trim()
        .toLowerCase();
      var orgId = profile.organization_id;

      if (!email || !orgId) {
        skippedCount++;
        continue;
      }

      var userPrefs = prefsByUserId[profile.id] || {
        stockout_alerts: true,
        price_change_alerts: true,
        pending_approval_digest: true,
        daily_inventory_alerts: true,
        frequency: 'INSTANT'
      };

      // Respect user email preferences: skip if daily alerts or stockout alerts are disabled or set to WEEKLY only
      var dailyEnabled =
        userPrefs.daily_inventory_alerts !== false &&
        userPrefs.stockout_alerts !== false &&
        userPrefs.frequency !== 'WEEKLY';

      if (!dailyEnabled) {
        skippedCount++;
        results.push({
          email: email,
          status: 'SKIPPED',
          reason: 'Disabled in user_email_preferences'
        });
        continue;
      }

      var idempotencyKey =
        'daily_alert:' + orgId + ':' + profile.id + ':' + dateKeyIST;

      // Check deduplication in email_queue and email_delivery_logs for today (Asia/Kolkata)
      var existingQueue = supabaseRequest_(
        config,
        'email_queue?idempotency_key=eq.' +
          encodeURIComponent(idempotencyKey) +
          '&status=eq.SENT&select=id',
        'get'
      );
      var existingLog = supabaseRequest_(
        config,
        'email_delivery_logs?idempotency_key=eq.' +
          encodeURIComponent(idempotencyKey) +
          '&status=eq.SENT&select=id',
        'get'
      );

      if (
        (existingQueue && existingQueue.length > 0) ||
        (existingLog && existingLog.length > 0)
      ) {
        skippedCount++;
        results.push({
          email: email,
          status: 'SKIPPED',
          reason: 'Already sent for ' + dateKeyIST + ' (Asia/Kolkata)'
        });
        continue;
      }

      if (MailApp.getRemainingDailyQuota() <= 0) {
        failedCount++;
        results.push({
          email: email,
          status: 'FAILED',
          error: 'MailApp daily quota exhausted'
        });
        continue;
      }

      // Fetch real workspace data strictly isolated to organization_id = orgId
      var inventoryItems = supabaseRequest_(
        config,
        'inventory_items?organization_id=eq.' +
          encodeURIComponent(orgId) +
          '&order=sku.asc&select=*',
        'get'
      );
      var suppliers = supabaseRequest_(
        config,
        'suppliers?organization_id=eq.' +
          encodeURIComponent(orgId) +
          '&select=*',
        'get'
      );
      var incomingOrders = supabaseRequest_(
        config,
        'incoming_orders?organization_id=eq.' +
          encodeURIComponent(orgId) +
          '&select=*',
        'get'
      );
      var reorderRequests = supabaseRequest_(
        config,
        'reorder_requests?organization_id=eq.' +
          encodeURIComponent(orgId) +
          '&select=*',
        'get'
      );

      var orgName =
        orgNameById[orgId] || profile.store_name || 'Your Store Workspace';

      var analysis = evaluateWorkspaceInventory_({
        inventoryItems: inventoryItems || [],
        suppliers: suppliers || [],
        incomingOrders: incomingOrders || [],
        reorderRequests: reorderRequests || [],
        preferences: userPrefs
      });

      var emailData = buildDailyInventoryEmailTemplate_({
        fullName: profile.full_name || email.split('@')[0],
        email: email,
        orgName: orgName,
        dateKeyIST: dateKeyIST,
        analysis: analysis,
        appUrl: config.appUrl
      });

      try {
        MailApp.sendEmail({
          to: email,
          subject: emailData.subject,
          body: emailData.plainBody,
          htmlBody: emailData.htmlBody,
          name: PRODUCT_NAME + ' Daily Inventory Briefing'
        });

        var nowIso = new Date().toISOString();

        // UpsertSENT record in email_queue for complete traceability
        supabaseRequest_(
          config,
          'email_queue?on_conflict=idempotency_key',
          'post',
          {
            organization_id: orgId,
            user_id: profile.id,
            firebase_uid: profile.firebase_uid || null,
            recipient_email: email,
            recipient_name: profile.full_name || email.split('@')[0],
            template_type: 'DAILY_INVENTORY_ALERT',
            subject: emailData.subject,
            payload: {
              date_ist: dateKeyIST,
              total_skus: analysis.totalSkus,
              critical_count: analysis.criticalItems.length,
              low_stock_count: analysis.lowStockItems.length,
              healthy_count: analysis.healthyItems.length
            },
            idempotency_key: idempotencyKey,
            status: 'SENT',
            attempts: 1,
            processed_at: nowIso,
            sent_at: nowIso,
            updated_at: nowIso
          },
          { Prefer: 'resolution=merge-duplicates,return=minimal' }
        );

        insertDeliveryLog_(config, {
          organization_id: orgId,
          user_id: profile.id,
          firebase_uid: profile.firebase_uid || null,
          recipient_email: email,
          template_type: 'DAILY_INVENTORY_ALERT',
          status: 'SENT',
          subject: emailData.subject,
          idempotency_key: idempotencyKey,
          metadata: {
            date_ist: dateKeyIST,
            total_skus: analysis.totalSkus,
            critical_count: analysis.criticalItems.length,
            low_stock_count: analysis.lowStockItems.length,
            healthy_count: analysis.healthyItems.length,
            empty_inventory_onboarding: analysis.totalSkus === 0
          }
        });

        sentCount++;
        results.push({
          email: email,
          status: 'SENT',
          totalSkus: analysis.totalSkus,
          idempotencyKey: idempotencyKey
        });
      } catch (err) {
        var errMsg = String(err && err.message ? err.message : err);
        failedCount++;
        insertDeliveryLog_(config, {
          organization_id: orgId,
          user_id: profile.id,
          firebase_uid: profile.firebase_uid || null,
          recipient_email: email,
          template_type: 'DAILY_INVENTORY_ALERT',
          status: 'FAILED',
          subject: emailData.subject,
          idempotency_key: idempotencyKey,
          error_message: errMsg
        });
        results.push({
          email: email,
          status: 'FAILED',
          error: errMsg
        });
      }
    }

    return {
      success: true,
      dateKeyIST: dateKeyIST,
      welcomeQueue: welcomeSummary,
      evaluatedUsers: profiles.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      results: results
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Deterministic Replenishment & Risk Evaluation for a Single Organization
 */
function evaluateWorkspaceInventory_(input) {
  var items = input.inventoryItems || [];
  var suppliers = input.suppliers || [];
  var orders = input.incomingOrders || [];
  var requests = input.reorderRequests || [];

  var supplierById = {};
  var priceJumpSuppliers = [];
  for (var s = 0; s < suppliers.length; s++) {
    var sup = suppliers[s];
    supplierById[sup.id] = sup;
    var curPrice = Number(sup.current_unit_price || 0);
    var prevPrice = Number(sup.previous_unit_price || 0);
    if (prevPrice > 0) {
      var pct = ((curPrice - prevPrice) / prevPrice) * 100;
      if (pct >= 20.0) {
        priceJumpSuppliers.push({
          id: sup.id,
          name: sup.name,
          previousPrice: prevPrice,
          currentPrice: curPrice,
          pctIncrease: pct.toFixed(1)
        });
      }
    }
  }

  var incomingBySku = {};
  for (var o = 0; o < orders.length; o++) {
    var ord = orders[o];
    var st = String(ord.status || '').toLowerCase();
    if (
      st !== 'received' &&
      st !== 'cancelled' &&
      st !== 'delivered'
    ) {
      var openQty = Number(
        ord.remaining_open_quantity !== null &&
          ord.remaining_open_quantity !== undefined
          ? ord.remaining_open_quantity
          : ord.ordered_quantity || 0
      );
      incomingBySku[ord.sku] = (incomingBySku[ord.sku] || 0) + Math.max(0, openQty);
    }
  }

  var pendingApprovals = [];
  for (var r = 0; r < requests.length; r++) {
    var req = requests[r];
    if (
      req.status === 'Pending Approval' ||
      req.status === 'Needs Budget Review' ||
      req.status === 'pending_approval' ||
      req.status === 'needs_budget_review'
    ) {
      pendingApprovals.push(req);
    }
  }

  var criticalItems = [];
  var lowStockItems = [];
  var healthyItems = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var sku = item.sku;
    var name = item.name || item.title || sku;
    var currentStock = Number(item.current_stock || 0);
    var reservedStock = Number(item.reserved_stock || 0);
    var effectiveStock = Math.max(0, currentStock - reservedStock);
    var avgDailySales = Number(item.average_daily_sales || 0);
    var leadTimeDays = Number(item.lead_time_days || 7);
    var safetyStock = Number(item.safety_stock || 0);
    var reorderThreshold = Number(item.reorder_threshold || 0);
    var incomingUnits = Number(incomingBySku[sku] || 0);

    var supplier = supplierById[item.supplier_id] || null;
    var packSize = Math.max(1, Number(supplier ? supplier.pack_size || 1 : 1));
    var unitPrice = Number(
      supplier ? supplier.current_unit_price || item.unit_price || 0 : item.unit_price || 0
    );

    var leadTimeDemand = Math.ceil(avgDailySales * leadTimeDays);
    var targetInventory = leadTimeDemand + safetyStock;
    var rawRequirement = Math.max(
      0,
      targetInventory - (effectiveStock + incomingUnits)
    );
    var recommendedCases =
      rawRequirement > 0 ? Math.ceil(rawRequirement / packSize) : 0;
    var recommendedUnits = recommendedCases * packSize;
    var daysOfCover =
      avgDailySales > 0
        ? Number((effectiveStock / avgDailySales).toFixed(1))
        : 999;

    var evaluated = {
      sku: sku,
      name: name,
      category: item.category || 'General',
      effectiveStock: effectiveStock,
      reorderThreshold: reorderThreshold,
      incomingUnits: incomingUnits,
      leadTimeDays: leadTimeDays,
      leadTimeDemand: leadTimeDemand,
      safetyStock: safetyStock,
      recommendedUnits: recommendedUnits,
      recommendedCases: recommendedCases,
      packSize: packSize,
      estimatedCost: recommendedUnits * unitPrice,
      daysOfCover: daysOfCover,
      supplierName: supplier ? supplier.name : 'Unassigned Supplier'
    };

    if (effectiveStock <= 0 || daysOfCover < leadTimeDays) {
      if (recommendedUnits > 0 || effectiveStock <= reorderThreshold) {
        criticalItems.push(evaluated);
      } else {
        healthyItems.push(evaluated);
      }
    } else if (effectiveStock <= reorderThreshold || recommendedUnits > 0) {
      lowStockItems.push(evaluated);
    } else {
      healthyItems.push(evaluated);
    }
  }

  return {
    totalSkus: items.length,
    criticalItems: criticalItems,
    lowStockItems: lowStockItems,
    healthyItems: healthyItems,
    priceJumpSuppliers: priceJumpSuppliers,
    pendingApprovals: pendingApprovals
  };
}

/**
 * ============================================================================
 * 5. EMAIL TEMPLATES (HTML + Plain-Text Fallback)
 * ============================================================================
 */
function buildWelcomeEmailTemplate_(data) {
  var name = escapeHtml_(data.fullName || 'Store Procurement Lead');
  var storeName = escapeHtml_(data.storeName || 'Your Store Workspace');
  var appUrl = data.appUrl;
  var subject =
    'Welcome to ' +
    PRODUCT_NAME +
    ' — Your Intelligent Inventory Workspace is Ready';

  var plainBody =
    'Welcome to ' +
    PRODUCT_NAME +
    ', ' +
    (data.fullName || 'Store Lead') +
    '!\n\n' +
    'Your retail replenishment workspace (' +
    (data.storeName || 'Your Store Workspace') +
    ') has been initialized.\n\n' +
    'What ' +
    PRODUCT_NAME +
    ' helps you do every day:\n' +
    '1. Predict Lead-Time Stockouts: Identify SKUs whose effective stock will deplete before supplier delivery arrives.\n' +
    '2. Reconcile Open Pipeline Orders: Factor in in-transit purchase orders so you never double-order.\n' +
    '3. Enforce Supplier Pack Multiples & Price Guardrails: Round order quantities to supplier case sizes and flag >=20% supplier price increases for budget review.\n\n' +
    'Recommended Next Steps:\n' +
    '- Open your workspace: ' +
    appUrl +
    '/home\n' +
    '- Add your first SKU or import your catalog CSV: ' +
    appUrl +
    '/inventory\n' +
    '- Ask ' +
    PRODUCT_NAME +
    ' Copilot for replenishment insights: ' +
    appUrl +
    '/agent\n' +
    '- Review your notification settings: ' +
    appUrl +
    '/settings\n\n' +
    '— ' +
    PRODUCT_NAME +
    ' Automated Replenishment Governance';

  var htmlBody =
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F8F6F2;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#46362F;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F6F2;padding:32px 16px;">' +
    '<tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E7E0D8;border-radius:12px;overflow:hidden;">' +
    '<tr><td style="background-color:#46362F;padding:28px 32px;color:#FFFFFF;">' +
    '<div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#D9C6A5;font-weight:600;margin-bottom:6px;">Replenishment Decision Intelligence</div>' +
    '<h1 style="margin:0;font-size:24px;font-weight:600;color:#FFFFFF;">Welcome to ' +
    PRODUCT_NAME +
    '</h1>' +
    '<p style="margin:6px 0 0 0;font-size:13px;color:#E8E2F0;">Workspace: <strong>' +
    storeName +
    '</strong></p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 32px;">' +
    '<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Hello <strong>' +
    name +
    '</strong>,</p>' +
    '<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#6B625B;">Your ' +
    PRODUCT_NAME +
    ' account is active and connected to your dedicated inventory workspace. Every replenishment recommendation is grounded in your real SKU stock levels, supplier lead times, pack multiples, and open inbound purchase orders.</p>' +
    '<div style="background-color:#F8F6F2;border:1px solid #E7E0D8;border-radius:10px;padding:18px 20px;margin-bottom:24px;">' +
    '<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#46362F;margin-bottom:10px;">First Steps to Initialize Your Catalog</div>' +
    '<ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#46362F;">' +
    '<li><strong>Register Suppliers & Lead Times:</strong> Set delivery lead times, pack sizes, and unit pricing in Suppliers.</li>' +
    '<li><strong>Add or Import Inventory SKUs:</strong> Add your products manually or upload a CSV in Inventory.</li>' +
    '<li><strong>Consult ' +
    PRODUCT_NAME +
    ' Copilot:</strong> Generate explainable reorder proposals with human approval guardrails.</li>' +
    '</ol>' +
    '</div>' +
    '<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>' +
    '<td style="background-color:#46362F;border-radius:8px;padding:12px 22px;">' +
    '<a href="' +
    escapeHtml_(appUrl + '/home') +
    '" style="color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;display:inline-block;">Open Your ' +
    PRODUCT_NAME +
    ' Workspace &rarr;</a>' +
    '</td></tr></table>' +
    '<p style="margin:0;font-size:12px;color:#6B625B;line-height:1.5;">You will also receive a daily inventory intelligence summary at 10:00 AM IST based on your workspace notification settings.</p>' +
    '</td></tr>' +
    '<tr><td style="background-color:#F8F6F2;border-top:1px solid #E7E0D8;padding:16px 32px;font-size:11px;color:#6B625B;">' +
    PRODUCT_NAME +
    ' &bull; Manage notification preferences anytime in <a href="' +
    escapeHtml_(appUrl + '/settings') +
    '" style="color:#46362F;font-weight:600;">Workspace Settings</a>.' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';

  return {
    subject: subject,
    plainBody: plainBody,
    htmlBody: htmlBody
  };
}

function buildDailyInventoryEmailTemplate_(data) {
  var name = escapeHtml_(data.fullName || 'Store Lead');
  var orgName = escapeHtml_(data.orgName || 'Your Store Workspace');
  var dateKeyIST = data.dateKeyIST;
  var analysis = data.analysis;
  var appUrl = data.appUrl;

  // CASE B: Zero inventory items in workspace — truthful onboarding reminder (no fake data)
  if (analysis.totalSkus === 0) {
    var emptySubject =
      PRODUCT_NAME +
      ' Daily Status (' +
      dateKeyIST +
      ') — Add Your First Inventory SKU';

    var emptyPlain =
      PRODUCT_NAME +
      ' Daily Inventory Briefing (' +
      dateKeyIST +
      ')\n' +
      'Workspace: ' +
      data.orgName +
      '\n\n' +
      'Hello ' +
      data.fullName +
      ',\n\n' +
      'Your workspace currently has 0 inventory items registered. ' +
      PRODUCT_NAME +
      ' never fabricates stock levels or artificial reorder recommendations.\n\n' +
      'To start receiving automated lead-time stockout alerts and reorder calculations tomorrow at 10:00 AM IST:\n' +
      '1. Add your first product or import a CSV catalog: ' +
      appUrl +
      '/inventory\n' +
      '2. Configure your suppliers and pack sizes: ' +
      appUrl +
      '/suppliers\n\n' +
      'Manage email preferences: ' +
      appUrl +
      '/settings';

    var emptyHtml =
      '<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F8F6F2;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#46362F;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F6F2;padding:32px 16px;">' +
      '<tr><td align="center">' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E7E0D8;border-radius:12px;overflow:hidden;">' +
      '<tr><td style="background-color:#46362F;padding:24px 32px;color:#FFFFFF;">' +
      '<div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#D9C6A5;font-weight:600;margin-bottom:4px;">Daily Inventory Check &bull; ' +
      escapeHtml_(dateKeyIST) +
      '</div>' +
      '<h1 style="margin:0;font-size:20px;font-weight:600;color:#FFFFFF;">' +
      orgName +
      ' — Catalog Ready for Setup</h1>' +
      '</td></tr>' +
      '<tr><td style="padding:28px 32px;">' +
      '<p style="margin:0 0 14px 0;font-size:14px;">Hello <strong>' +
      name +
      '</strong>,</p>' +
      '<p style="margin:0 0 18px 0;font-size:13px;line-height:1.6;color:#6B625B;">Our 10:00 AM IST daily check verified your workspace (<strong>' +
      orgName +
      '</strong>) and found <strong>0 registered inventory SKUs</strong>. Because ' +
      PRODUCT_NAME +
      ' operates strictly on verified database records, no reorder recommendations were generated today.</p>' +
      '<div style="background-color:#F8F6F2;border:1px solid #E7E0D8;border-radius:10px;padding:16px 20px;margin-bottom:22px;font-size:13px;color:#46362F;line-height:1.6;">' +
      '<strong>Activate Daily Lead-Time Monitoring:</strong><br/>' +
      'Add your first SKU or import a CSV catalog in the Inventory page to begin tracking stockout risk, supplier lead times, and case-pack replenishment.' +
      '</div>' +
      '<table cellpadding="0" cellspacing="0"><tr>' +
      '<td style="background-color:#46362F;border-radius:8px;padding:11px 20px;">' +
      '<a href="' +
      escapeHtml_(appUrl + '/inventory') +
      '" style="color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;display:inline-block;">Add Your First Inventory Item &rarr;</a>' +
      '</td></tr></table>' +
      '</td></tr>' +
      '<tr><td style="background-color:#F8F6F2;border-top:1px solid #E7E0D8;padding:14px 32px;font-size:11px;color:#6B625B;">' +
      'Generated at ' +
      escapeHtml_(getFormattedTimestampIST_()) +
      ' &bull; <a href="' +
      escapeHtml_(appUrl + '/settings') +
      '" style="color:#46362F;font-weight:600;">Notification Settings</a>' +
      '</td></tr></table></td></tr></table></body></html>';

    return {
      subject: emptySubject,
      plainBody: emptyPlain,
      htmlBody: emptyHtml
    };
  }

  // CASE A: Real inventory items exist in workspace
  var actionItems = analysis.criticalItems.concat(analysis.lowStockItems);
  var subject =
    PRODUCT_NAME +
    ' Daily Alert (' +
    dateKeyIST +
    '): ' +
    actionItems.length +
    ' SKU(s) Need Replenishment Review (' +
    data.orgName +
    ')';

  var plainLines = [
    PRODUCT_NAME + ' Daily Inventory Intelligence Report (' + dateKeyIST + ')',
    'Workspace: ' + data.orgName,
    'Total SKUs Evaluated: ' + analysis.totalSkus,
    'Critical Lead-Time Risk SKUs: ' + analysis.criticalItems.length,
    'Low-Stock / Reorder Threshold SKUs: ' + analysis.lowStockItems.length,
    'Healthy & Covered SKUs: ' + analysis.healthyItems.length,
    ''
  ];

  if (actionItems.length > 0) {
    plainLines.push('SKUs REQUIRING REPLENISHMENT:');
    for (var i = 0; i < actionItems.length; i++) {
      var item = actionItems[i];
      plainLines.push(
        '- ' +
          item.sku +
          ' (' +
          item.name +
          '): Effective Stock=' +
          item.effectiveStock +
          ', Reorder Point=' +
          item.reorderThreshold +
          ', In-Transit=' +
          item.incomingUnits +
          ', Recommended Order=' +
          item.recommendedUnits +
          ' units (' +
          item.recommendedCases +
          ' cases of ' +
          item.packSize +
          ') via ' +
          item.supplierName
      );
    }
    plainLines.push('');
  } else {
    plainLines.push(
      'All ' +
        analysis.totalSkus +
        ' SKU(s) are currently healthy and adequately covered across their supplier lead times.'
    );
    plainLines.push('');
  }

  plainLines.push('Open Workspace: ' + appUrl + '/inventory');
  plainLines.push('Manage Notification Preferences: ' + appUrl + '/settings');

  var rowsHtml = '';
  for (var j = 0; j < actionItems.length; j++) {
    var it = actionItems[j];
    var isCrit = j < analysis.criticalItems.length;
    var badgeBg = isCrit ? '#FDF0F2' : '#FFF8EB';
    var badgeColor = isCrit ? '#B42335' : '#9A6700';
    var badgeLabel = isCrit ? 'CRITICAL' : 'LOW STOCK';

    rowsHtml +=
      '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #E7E0D8;font-size:12px;"><strong>' +
      escapeHtml_(it.sku) +
      '</strong><br/><span style="color:#6B625B;font-size:11px;">' +
      escapeHtml_(it.name) +
      '</span></td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #E7E0D8;font-size:11px;"><span style="background-color:' +
      badgeBg +
      ';color:' +
      badgeColor +
      ';padding:2px 6px;border-radius:4px;font-weight:700;">' +
      badgeLabel +
      '</span></td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #E7E0D8;font-size:12px;">' +
      it.effectiveStock +
      ' <span style="color:#6B625B;font-size:11px;">(ROP: ' +
      it.reorderThreshold +
      ')</span></td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #E7E0D8;font-size:12px;font-weight:600;color:#46362F;">' +
      it.recommendedUnits +
      ' units<br/><span style="color:#6B625B;font-size:10px;font-weight:400;">' +
      it.recommendedCases +
      ' case(s) &times; ' +
      it.packSize +
      '</span></td>' +
      '</tr>';
  }

  var tableSectionHtml =
    actionItems.length > 0
      ? '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E7E0D8;border-radius:8px;overflow:hidden;margin-bottom:22px;">' +
        '<thead><tr style="background-color:#F8F6F2;text-align:left;font-size:11px;color:#6B625B;text-transform:uppercase;">' +
        '<th style="padding:10px 12px;border-bottom:1px solid #E7E0D8;">SKU / Product</th>' +
        '<th style="padding:10px 12px;border-bottom:1px solid #E7E0D8;">Status</th>' +
        '<th style="padding:10px 12px;border-bottom:1px solid #E7E0D8;">Effective Stock</th>' +
        '<th style="padding:10px 12px;border-bottom:1px solid #E7E0D8;">Recommended Order</th>' +
        '</tr></thead><tbody>' +
        rowsHtml +
        '</tbody></table>'
      : '<div style="background-color:#EBF7F0;border:1px solid #BCE8D3;border-radius:8px;padding:16px;margin-bottom:22px;font-size:13px;color:#324536;">' +
        '<strong>All ' +
        analysis.totalSkus +
        ' SKUs are healthy!</strong> Effective stock and open incoming orders cover all lead-time demand requirements today.' +
        '</div>';

  var htmlBody =
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F8F6F2;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#46362F;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F6F2;padding:32px 16px;">' +
    '<tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#FFFFFF;border:1px solid #E7E0D8;border-radius:12px;overflow:hidden;">' +
    '<tr><td style="background-color:#46362F;padding:24px 32px;color:#FFFFFF;">' +
    '<div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#D9C6A5;font-weight:600;margin-bottom:4px;">10:00 AM IST Daily Briefing &bull; ' +
    escapeHtml_(dateKeyIST) +
    '</div>' +
    '<h1 style="margin:0;font-size:20px;font-weight:600;color:#FFFFFF;">' +
    orgName +
    ' — Inventory Health Summary</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 32px;">' +
    '<p style="margin:0 0 16px 0;font-size:14px;">Hello <strong>' +
    name +
    '</strong>, here is your verified inventory replenishment summary for today:</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr>' +
    '<td width="32%" style="background-color:#FDF0F2;border:1px solid #F8C8CE;border-radius:8px;padding:12px;text-align:center;">' +
    '<div style="font-size:20px;font-weight:700;color:#B42335;">' +
    analysis.criticalItems.length +
    '</div><div style="font-size:11px;color:#B42335;font-weight:600;">Critical Risk</div></td>' +
    '<td width="2%"></td>' +
    '<td width="32%" style="background-color:#FFF8EB;border:1px solid #F5D9A6;border-radius:8px;padding:12px;text-align:center;">' +
    '<div style="font-size:20px;font-weight:700;color:#9A6700;">' +
    analysis.lowStockItems.length +
    '</div><div style="font-size:11px;color:#9A6700;font-weight:600;">Low Stock</div></td>' +
    '<td width="2%"></td>' +
    '<td width="32%" style="background-color:#EBF7F0;border:1px solid #BCE8D3;border-radius:8px;padding:12px;text-align:center;">' +
    '<div style="font-size:20px;font-weight:700;color:#324536;">' +
    analysis.healthyItems.length +
    '</div><div style="font-size:11px;color:#324536;font-weight:600;">Healthy SKUs</div></td>' +
    '</tr></table>' +
    tableSectionHtml +
    '<table cellpadding="0" cellspacing="0"><tr>' +
    '<td style="background-color:#46362F;border-radius:8px;padding:11px 20px;">' +
    '<a href="' +
    escapeHtml_(appUrl + '/inventory') +
    '" style="color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;display:inline-block;">Review Inventory &amp; Approve Reorders &rarr;</a>' +
    '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="background-color:#F8F6F2;border-top:1px solid #E7E0D8;padding:14px 32px;font-size:11px;color:#6B625B;">' +
    'Dispatched at ' +
    escapeHtml_(getFormattedTimestampIST_()) +
    ' &bull; <a href="' +
    escapeHtml_(appUrl + '/settings') +
    '" style="color:#46362F;font-weight:600;">Manage Email Preferences</a>' +
    '</td></tr></table></td></tr></table></body></html>';

  return {
    subject: subject,
    plainBody: plainLines.join('\n'),
    htmlBody: htmlBody
  };
}

/**
 * ============================================================================
 * 6. TRIGGER MANAGEMENT (No Duplicate Triggers)
 * ============================================================================
 * Run setupEmailAutomationTriggers() ONCE in the Apps Script Editor to:
 *   1. Remove any duplicate existing triggers for this project.
 *   2. Install the 10:00 AM Asia/Kolkata daily trigger for runDailyInventoryAlerts.
 *   3. Install a 5-minute queue poller trigger for processPendingEmailQueue so
 *      new sign-ups in public.email_queue receive their welcome email automatically.
 */
function setupEmailAutomationTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removedCount = 0;

  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (
      fn === 'runDailyInventoryAlerts' ||
      fn === 'processPendingEmailQueue'
    ) {
      ScriptApp.deleteTrigger(triggers[i]);
      removedCount++;
    }
  }

  // 1. Daily Inventory Alert Trigger at 10:00 AM Asia/Kolkata
  ScriptApp.newTrigger('runDailyInventoryAlerts')
    .timeBased()
    .inTimezone(AUTOMATION_TIMEZONE)
    .atHour(10)
    .everyDays(1)
    .create();

  // 2. Pending Welcome Email Queue Processor every 5 minutes
  ScriptApp.newTrigger('processPendingEmailQueue')
    .timeBased()
    .everyMinutes(5)
    .create();

  var summary = {
    success: true,
    removedOldTriggers: removedCount,
    installedTriggers: [
      'runDailyInventoryAlerts (Daily at 10:00–11:00 AM Asia/Kolkata)',
      'processPendingEmailQueue (Every 5 minutes)'
    ]
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * ============================================================================
 * 7. SAFE VERIFICATION & MANUAL TEST HELPERS
 * ============================================================================
 * Run verifyConfigurationAndProcessQueue() in the Apps Script Editor to:
 *   - Verify Script Properties & Supabase connectivity
 *   - Check remaining MailApp quota
 *   - Process any pending welcome email in public.email_queue
 */
function verifyConfigurationAndProcessQueue() {
  var config = getAutomationConfig_();
  var quota = MailApp.getRemainingDailyQuota();
  var orgs = supabaseRequest_(
    config,
    'organizations?select=id,name&limit=5',
    'get'
  );
  var queueResult = processPendingEmailQueue();

  var report = {
    status: 'VERIFIED',
    supabaseConnected: true,
    organizationsCount: orgs ? orgs.length : 0,
    remainingDailyQuota: quota,
    timezone: AUTOMATION_TIMEZONE,
    queueProcessingResult: queueResult
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
