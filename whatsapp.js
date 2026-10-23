(function (root) {
  'use strict';
  root.DI = root.DI || {};

  function normalizeWhatsApp(raw) {
    let value = String(raw || '').replace(/[\s+()-]/g, '');
    const site = root.DI && root.DI.site ? root.DI.site : {};
    const defaultCountry = site.defaultCountryCode || (site.phone ? String(site.phone).slice(0, 2) : '92');
    if (value.indexOf('00') === 0) {
      value = value.slice(2);
    } else if (value.indexOf('0') === 0) {
      value = defaultCountry + value.slice(1);
    }
    return { value, valid: /^\d{7,15}$/.test(value) };
  }

  function buildCustomerOrderMessage(order) {
    const total = order.total_minor == null ? '' : `${order.currency || 'USD'} ${(order.total_minor / 100).toFixed(2)}`;
    return [
      `Order ${order.public_id || ''}`,
      `Name: ${order.customer_name || ''}`,
      `Offer: ${order.offer_id || ''}`,
      `Template: ${order.template_id || ''}`,
      `Event date: ${order.event_date || 'Not provided'}`,
      `Total: ${total}`,
      `Confirmation: ${order.confirmation_url || ''}`
    ].join('\n');
  }

  function resolveTid(order) {
    if (order.tid && String(order.tid).trim()) return String(order.tid).trim();
    if (Array.isArray(order.payments) && order.payments.length) {
      const p = order.payments[0];
      if (p && p.reference && String(p.reference).trim()) return String(p.reference).trim();
    }
    const details = order.details || {};
    const inv = details.invitation || {};
    const invDetails = inv.details || {};
    const pay = invDetails.payment || {};
    if (pay.tid && String(pay.tid).trim()) return String(pay.tid).trim();
    return '';
  }

  function buildStepMessage(step, order, options) {
    if (!order) throw new Error('Order data is required to build WhatsApp message.');
    const stepKey = `step${step}`;
    const templates = root.DI.whatsappSteps || {};
    const template = templates[stepKey];
    if (!template) throw new Error(`No message template found for Step ${step}.`);

    const site = root.DI.site || {};
    const business = site.businessName || 'Digital Invitations';
    const name = (order.customer_name || (order.details && order.details.customer && order.details.customer.full_name) || '').trim();
    const orderId = (order.public_id || '').trim();
    const tid = resolveTid(order);
    const previewLink = (order.preview_link || '').trim();
    const finalLink = (order.final_link || '').trim();

    const replacements = {
      '{name}': name,
      '{business}': business,
      '{orderId}': orderId,
      '{tid}': tid,
      '{previewLink}': previewLink,
      '{finalLink}': finalLink
    };

    let message = template;
    for (const [token, value] of Object.entries(replacements)) {
      if (template.includes(token)) {
        if (!value) {
          const fieldName = token.replace(/[{}]/g, '');
          throw new Error(`Cannot build WhatsApp message: missing value for {${fieldName}}.`);
        }
        message = message.split(token).join(value);
      }
    }

    const unreplaced = message.match(/\{[a-zA-Z0-9_]+\}/g);
    if (unreplaced && unreplaced.length > 0) {
      throw new Error(`Message contains unfilled placeholder: ${unreplaced.join(', ')}`);
    }

    const norm = normalizeWhatsApp(order.whatsapp);
    if (!norm.valid) {
      throw new Error('Customer WhatsApp number is missing or invalid (must be 7 to 15 digits with country code).');
    }

    const url = `https://wa.me/${norm.value}?text=${encodeURIComponent(message)}`;

    if (!options || options.dryRun !== true) {
      const win = window.open(url, '_blank');
      if (!win) {
        throw new Error('Pop-up was blocked. Please allow pop-ups for this dashboard to open WhatsApp.');
      }
      try { win.opener = null; } catch (error) {}
    }

    return { text: message, url };
  }

  root.DI.whatsapp = {
    normalizeWhatsApp,
    buildCustomerOrderMessage,
    buildStepMessage,
    resolveTid
  };
}(window));
