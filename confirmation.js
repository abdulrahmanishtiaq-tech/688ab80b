(function () {
  'use strict';
  const DI = window.DI || {};
  const site = DI.site || {};
  const content = document.querySelector('#confirmation-content');
  const mark = document.querySelector('#brand-mark');
  const name = document.querySelector('#brand-name');
  const contactCopy = document.querySelector('#contact-copy');
  const phone = document.querySelector('#contact-phone');
  const email = document.querySelector('#contact-email');
  const token = new URLSearchParams(window.location.search).get('t');
  const currencySymbols = {USD: '$', EUR: '€', GBP: '£', AED: 'AED ', PKR: 'Rs '};
  const paymentStatusLabels = {
    awaiting_payment: 'Awaiting payment',
    payment_submitted: 'Advance submitted, awaiting verification',
    paid: 'Payment verified',
    partially_paid: 'Partial payment verified',
    refunded: 'Refunded'
  };
  const paymentStatus = value => paymentStatusLabels[value] || String(value || 'Awaiting payment').replace(/_/g, ' ');

  function el(tag, value, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function money(minor, currency) {
    const amountUSD = Number(minor || 0) / 100;
    if (DI.pricing && typeof DI.pricing.formatMoney === 'function') {
      try {
        return DI.pricing.formatMoney(amountUSD, currency || 'USD', DI.catalog);
      } catch (e) {}
    }
    const symbol = currencySymbols[currency] || `${currency || 'USD'} `;
    return `${symbol}${Number.isInteger(amountUSD) ? amountUSD : amountUSD.toFixed(2)}`;
  }
  function value(input, fallback) {
    return input === undefined || input === null || input === '' ? fallback : String(input);
  }
  function date(input) {
    if (!input) return 'Not provided';
    const parsed = new Date(`${input}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? String(input) : new Intl.DateTimeFormat('en-US', {dateStyle: 'long'}).format(parsed);
  }
  function setBrand() {
    if (name) name.textContent = value(site.businessName, 'Digital Invitations');
    if (mark) {
      if (site.logoUrl) {
        const image = document.createElement('img');
        image.src = site.logoUrl; image.alt = name ? name.textContent : ''; image.width = 42; image.height = 42;
        mark.replaceWith(image);
      } else {
        mark.className = 'confirmation-logo-mark';
        mark.textContent = value(site.logoText, 'DI');
      }
    }
    if (contactCopy) contactCopy.textContent = 'Questions? ';
    if (phone) {
      phone.textContent = value(site.phoneDisplay, site.phone);
      phone.href = `tel:+${site.phone}`;
    }
    if (email) {
      email.textContent = value(site.email, '');
      email.href = `mailto:${site.email}`;
    }
  }
  function action(label, className, handler) {
    const button = el('button', label, `btn ${className || ''}`);
    button.type = 'button'; button.addEventListener('click', handler); return button;
  }
  function link(label, href, className) {
    const anchor = el('a', label, `btn ${className || ''}`);
    anchor.href = href; return anchor;
  }
  function showError(title, message) {
    content.textContent = '';
    const panel = el('div', undefined, 'confirmation-error');
    panel.append(el('h1', title), el('p', message));
    const actions = el('div', undefined, 'confirmation-actions');
    actions.append(action('Try again', '', load), link('Back to site', 'index.html', 'btn-secondary'));
    panel.append(actions); content.append(panel);
  }
  function copyText(text, button) {
    const fallback = () => {
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select();
      try { document.execCommand('copy'); button.textContent = 'Link copied'; }
      catch (error) { console.error('[Digital Invitations] confirmation link copy failed', error); button.textContent = 'Copy failed'; }
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { button.textContent = 'Link copied'; }).catch(fallback);
    else fallback();
  }
  function renderOrder(order) {
    content.textContent = '';
    const details = order.details || {};
    const customerData = details.customer || {};
    const invitation = details.invitation || {};
    const invitationDetails = invitation.details || {};
    const events = Array.isArray(invitationDetails.events) ? invitationDetails.events : [];
    const payment = invitationDetails.payment || {};
    const userCurrency = details.currency || invitationDetails.currency || order.currency || 'USD';

    const pricing = [
      ['Template', order.subtotal_minor, ''],
      ['Discount', order.discount_minor, 'saving'],
      ['Express delivery', order.express_minor, '']
    ];
    const title = el('div', undefined, 'confirmation-intro');
    const heading = el('div'); heading.append(el('p', 'Saved order', 'confirmation-id'), el('h1', value(order.public_id, 'Order confirmation')));
    title.append(heading, el('p', `Payment: ${paymentStatus(order.payment_status)}`, 'confirmation-id')); content.append(title);
    
    const customer = el('section', undefined, 'confirmation-section');
    customer.append(el('h2', 'Your details'));
    const grid = el('dl', undefined, 'confirmation-grid');
    const customerFields = [
      ['Name', order.customer_name || customerData.full_name],
      ['WhatsApp', customerData.whatsapp],
      ['Email', customerData.email],
      ['Offer', order.offer_id],
      ['Template', order.template_id],
      ['Created', date(String(order.created_at || '').slice(0, 10))]
    ];
    if (payment.tid) {
      customerFields.push(['Transaction ID (TID)', payment.tid]);
    }
    customerFields.forEach(item => {
      const row = el('div');
      row.append(el('dt', item[0]), el('dd', value(item[1], 'Not provided')));
      grid.append(row);
    });
    customer.append(grid); content.append(customer);

    const invitationSection = el('section', undefined, 'confirmation-section');
    invitationSection.append(el('h2', 'Invitation details'));
    const invitationGrid = el('dl', undefined, 'confirmation-grid');
    [['Names', value(invitation.groom_name, '') + (invitation.bride_name ? ` & ${invitation.bride_name}` : '')], ['Date', date(invitation.wedding_date)], ['Time zone', invitation.time_zone], ['Language', invitationDetails.language], ['Music', invitationDetails.music]].forEach(item => { const row = el('div'); row.append(el('dt', item[0]), el('dd', value(item[1], 'Not provided'))); invitationGrid.append(row); });
    invitationSection.append(invitationGrid);
    if (events.length) {
      const eventList = el('div', undefined, 'confirmation-events');
      events.forEach((event, index) => {
        const card = el('article', undefined, 'confirmation-event');
        card.append(el('h3', value(event.customName || event.type, `Event ${index + 1}`)));
        card.append(el('p', `${date(event.date)}${event.time ? ` · ${event.time}` : ''}${event.endTime ? `–${event.endTime}` : ''}`));
        card.append(el('p', [event.venue, event.city].filter(Boolean).join(', ') || 'Venue not provided'));
        eventList.append(card);
      });
      invitationSection.append(eventList);
    }
    content.append(invitationSection);

    const priceSection = el('section', undefined, 'confirmation-section');
    priceSection.append(el('h2', 'Pricing'));
    const table = document.createElement('table'); table.className = 'confirmation-pricing';
    const body = document.createElement('tbody');
    pricing.filter(item => Number(item[1]) !== 0).forEach(item => {
      const row = document.createElement('tr');
      row.className = item[2];
      row.append(el('td', item[0]), el('td', `${item[2] === 'saving' ? '-' : ''}${money(Math.abs(item[1]), userCurrency)}`));
      body.append(row);
    });
    const foot = document.createElement('tfoot');
    const total = document.createElement('tr');
    total.append(el('td', 'Total'), el('td', money(order.total_minor, userCurrency)));
    foot.append(total);

    const advanceRow = document.createElement('tr');
    advanceRow.className = 'confirmation-advance-row';
    const status = order.payment_status || 'awaiting_payment';
    const advance = status === 'payment_submitted'
      ? ['Advance payment submitted (awaiting verification)', money(Math.round(order.total_minor * 0.5), userCurrency)]
      : status === 'paid'
        ? ['Payment verified', '—']
        : status === 'partially_paid'
          ? ['Partial payment verified', '—']
          : status === 'refunded'
            ? ['Payment refunded', '—']
            : ['Advance payment', 'Not confirmed'];
    advanceRow.append(el('td', advance[0]), el('td', advance[1]));
    foot.append(advanceRow);

    table.append(body, foot);
    priceSection.append(table);
    content.append(priceSection);

    const next = el('section', undefined, 'confirmation-section');
    next.append(el('h2', 'What happens next'));
    const nextList = el('ol', undefined, 'confirmation-next-steps');
    [
      'We’ll send your order confirmation message.',
      'We’ll send advance payment confirmation.',
      'We’ll send your invitation preview link for approval.',
      'We’ll send your final invitation link, ready to share.'
    ].forEach(step => nextList.append(el('li', step)));
    next.append(nextList);
    content.append(next);

    const url = window.location.href;
    const actions = el('div', undefined, 'confirmation-actions');
    actions.append(action('Download PDF', '', () => { window.print(); }));
    const copy = action('Copy link', 'btn-secondary', () => copyText(url, copy));
    actions.append(copy, link('Back to site', 'index.html', 'btn-secondary'));
    content.append(actions, el('p', 'Choose “Save as PDF” in the print dialog.', 'confirmation-print-hint'));
  }
  async function load() {
    if (!token) { showError('Link missing', 'This confirmation link needs an access token. Please use the complete link from your order message.'); return; }
    content.textContent = ''; const status = el('div', undefined, 'confirmation-status'); status.append(el('span', undefined, 'confirmation-spinner'), el('h1', 'Loading your order'), el('p', 'We are securely retrieving your saved details.')); content.append(status);
    try {
      if (!DI.orders || typeof DI.orders.getOrderByToken !== 'function') throw new Error(DI.supabaseError || 'Order service is unavailable.');
      const result = await DI.orders.getOrderByToken(token);
      const order = Array.isArray(result) ? result[0] : result;
      if (!order) { showError('Order not found', 'This link is invalid or the order is no longer available.'); return; }
      renderOrder(order);
    } catch (error) {
      console.error('[Digital Invitations] confirmation load failed', error);
      const message = /not found|expired|invalid/i.test(error.message || '') ? 'This link is invalid or expired. Please request a fresh confirmation link.' : 'We could not reach the order service. Check your connection and try again.';
      showError(/expired|invalid|not found/i.test(error.message || '') ? 'Link unavailable' : 'Could not load order', message);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  setBrand();
  load();
}());
