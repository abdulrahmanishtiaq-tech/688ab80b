(function () {
  'use strict';
  const DI = window.DI || {};
  // Capture the Supabase client initialised by supabase-client.js.
  const supabase = DI.supabase;
  if (!supabase) {
    console.error('[Digital Invitations] admin: Supabase client unavailable.', DI.supabaseError || 'No error detail.');
  }
  const pageSize = 25;
  let page = 0;
  let totalRows = 0;
  const $ = selector => document.querySelector(selector);
  const loginView = $('#login-view');
  const dashboardView = $('#dashboard-view');
  const ordersBody = $('#orders-body');
  const empty = $('#orders-empty');
  const detailView = $('#detail-view');
  let currentOrder = null;
  let activeUserId = null;
  let dashboardEntry = null;
  let offersLoaded = false;
  let detailLoadId = 0;
  let detailInFlightId = null;
  let refreshId = 0;
  let overviewRequestId = 0;
  let ordersRequestId = 0;

  const money = (minor, currency) => {
    const symbols = {USD: '$', EUR: '€', GBP: '£', AED: 'AED ', PKR: 'Rs '};
    const amount = Number(minor || 0) / 100;
    return `${symbols[currency] || `${currency || 'USD'} `}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  };

  // Prices are stored in the catalog currency (USD); show each order in the
  // currency the customer picked, using the same manual rates as the site.
  const currencyRate = code => {
    const currencies = (DI.catalog && DI.catalog.currencies) || {};
    const rate = Number((currencies[code] || {}).rate);
    return rate > 0 ? rate : 1;
  };
  const orderCurrency = order => {
    if (!order) return 'USD';
    const details = order.details;
    const chosen = order.order_currency || (details && details.invitation && details.invitation.details && details.invitation.details.currency);
    return chosen || order.currency || 'USD';
  };
  const orderMoney = (minor, order) => {
    const code = orderCurrency(order);
    return money(Math.round(Number(minor || 0) * currencyRate(code)), code);
  };

  const label = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
  const searchValue = value => String(value).replace(/[%(),.]/g, match => `%${match.charCodeAt(0).toString(16)}%`);

  const cell = (value, className, labelText) => {
    const node = document.createElement('td');
    if (className) node.className = className;
    if (labelText) node.dataset.label = labelText;
    node.textContent = value == null || value === '' ? '—' : String(value);
    return node;
  };

  function showLogin(message) {
    dashboardView.hidden = true;
    loginView.hidden = false;
    currentOrder = null;
    detailView.hidden = true;
    detailInFlightId = null;
    detailLoadId += 1;
    $('#overview-cards').hidden = false;
    document.querySelector('.admin-orders').hidden = false;
    $('#login-message').textContent = message || '';
  }

  function showDashboard(user) {
    loginView.hidden = true;
    dashboardView.hidden = false;
    $('#admin-identity').textContent = user && user.email ? `Signed in as ${user.email}` : '';
  }

  function errorMessage(error) {
    return error && error.message ? error.message : 'The dashboard could not load. Please try again.';
  }

  async function requireAdmin(user) {
    if (!user) {
      showLogin('Sign in to access the private dashboard.');
      return false;
    }
    const adminResult = await supabase.rpc('is_admin');
    if (adminResult.error) {
      console.error('[Digital Invitations] admin: is_admin() RPC failed.', {
        code: adminResult.error.code,
        message: adminResult.error.message,
        details: adminResult.error.details,
        hint: adminResult.error.hint
      });
      throw adminResult.error;
    }
    if (!adminResult.data) {
      await supabase.auth.signOut();
      showLogin('This account does not have admin access. Contact the site owner if this is unexpected.');
      return false;
    }
    return true;
  }

  function renderOverview(data) {
    const cards = [
      ['Total orders', data.total_orders],
      ['New', data.new_orders],
      ['Awaiting payment', data.awaiting_payment],
      ['Paid', data.paid_orders],
      ['In progress', data.in_progress],
      ['Completed', data.completed_orders],
      ['Confirmed revenue', Object.entries(data.confirmed_revenue_by_currency || {}).map(item => money(item[1], item[0])).join(' · ') || '0']
    ];
    const root = $('#overview-cards');
    root.textContent = '';
    cards.forEach(item => {
      const card = document.createElement('dl');
      card.className = 'admin-card';
      card.append(document.createElement('dt'), document.createElement('dd'));
      card.firstChild.textContent = item[0];
      card.lastChild.textContent = item[1] == null ? '0' : item[1];
      root.append(card);
    });
  }

  async function loadDisplayRevenue() {
    const revenue = {};
    const chunk = 1000;
    for (let from = 0; ; from += chunk) {
      const result = await supabase
        .from('orders')
        .select('total_minor,order_currency:details->invitation->details->>currency')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + chunk - 1);
      if (result.error) throw result.error;
      const rows = result.data || [];
      rows.forEach(order => {
        const code = order.order_currency || 'USD';
        revenue[code] = (revenue[code] || 0) + Math.round(Number(order.total_minor || 0) * currencyRate(code));
      });
      if (rows.length < chunk) break;
    }
    return revenue;
  }

  async function loadOverview() {
    const request = ++overviewRequestId;
    const [result, revenue] = await Promise.all([
      supabase.rpc('admin_order_overview'),
      loadDisplayRevenue().catch(error => {
        console.error('[Digital Invitations] admin: display revenue failed.', error);
        return null;
      })
    ]);
    if (request !== overviewRequestId) return;
    if (result.error) throw result.error;
    const data = Object.assign({}, result.data || {});
    if (revenue) data.confirmed_revenue_by_currency = revenue;
    renderOverview(data);
  }

  function filters() {
    return {
      search: $('#filter-search').value.trim(),
      orderStatus: $('#filter-order-status').value,
      paymentStatus: $('#filter-payment-status').value,
      offer: $('#filter-offer').value,
      from: $('#filter-from').value,
      to: $('#filter-to').value,
      sort: $('#filter-sort').value
    };
  }

  async function loadOffers() {
    const result = await supabase.from('catalog_offers').select('id,label').order('label');
    if (result.error) throw result.error;
    const select = $('#filter-offer');
    const previous = select.value;
    while (select.options.length > 1) select.remove(1);
    const seen = new Set(['']);
    (result.data || []).forEach(offer => {
      if (!offer || seen.has(offer.id)) return;
      seen.add(offer.id);
      const option = document.createElement('option');
      option.value = offer.id;
      option.textContent = offer.label;
      select.append(option);
    });
    if (previous && seen.has(previous)) select.value = previous;
    offersLoaded = true;
  }

  async function loadOrders() {
    const request = ++ordersRequestId;
    const filter = filters();
    let query = supabase.from('orders').select(
      'id,public_id,customer_name,whatsapp,offer_id,template_id,event_date,created_at,total_minor,currency,payment_status,order_status,workflow_step,order_currency:details->invitation->details->>currency',
      {count: 'exact'}
    );

    if (filter.search) {
      const term = searchValue(filter.search);
      query = query.or(`public_id.ilike.%${term}%,customer_name.ilike.%${term}%,whatsapp.ilike.%${term}%`);
    }

    if (filter.orderStatus) {
      if (filter.orderStatus.startsWith('step:')) {
        const stepNum = Number(filter.orderStatus.split(':')[1]);
        query = query.eq('workflow_step', stepNum);
      } else {
        query = query.eq('order_status', filter.orderStatus);
      }
    }

    if (filter.paymentStatus) query = query.eq('payment_status', filter.paymentStatus);
    if (filter.offer) query = query.eq('offer_id', filter.offer);
    if (filter.from) query = query.gte('created_at', `${filter.from}T00:00:00`);
    if (filter.to) query = query.lt('created_at', `${filter.to}T23:59:59.999`);

    const sort = filter.sort.split('.');
    query = query.order(sort[0], {ascending: sort[1] === 'asc'});

    const result = await query.range(page * pageSize, page * pageSize + pageSize - 1);
    if (request !== ordersRequestId) return;
    if (result.error) throw result.error;
    totalRows = result.count || 0;
    renderOrders(result.data || []);
  }

  function stepBadgeLabel(order) {
    if (order.order_status === 'cancelled') return 'Cancelled';
    const step = Number(order.workflow_step || 0);
    switch (step) {
      case 1: return 'Step 1 of 4: Order received';
      case 2: return 'Step 2 of 4: Advance payment verified';
      case 3: return 'Step 3 of 4: Preview ready';
      case 4: return 'Step 4 of 4: Completed';
      default: return 'Step 0: New';
    }
  }

  function renderOrders(rows) {
    ordersBody.textContent = '';
    empty.hidden = rows.length !== 0;
    rows.forEach(order => {
      const row = document.createElement('tr');
      const orderCell = document.createElement('td');
      const id = document.createElement('a');
      id.textContent = order.public_id;
      id.href = `#order-${encodeURIComponent(order.id)}`;
      id.addEventListener('click', event => {
        event.preventDefault();
        openDetail(order.id);
      });
      orderCell.append(id);
      orderCell.dataset.label = 'Order';

      const statusBadge = cell(stepBadgeLabel(order), `admin-badge ${order.order_status} step-${order.workflow_step || 0}`, 'Order status');
      row.append(
        orderCell,
        cell(order.customer_name, null, 'Customer'),
        cell(order.whatsapp, null, 'WhatsApp'),
        cell(`${order.offer_id} / ${order.template_id}`, null, 'Offer / template'),
        cell(order.event_date, null, 'Event date'),
        cell(new Date(order.created_at).toLocaleString(), null, 'Created'),
        cell(orderMoney(order.total_minor, order), null, 'Total'),
        cell(label(order.payment_status), `admin-badge ${order.payment_status}`, 'Payment'),
        statusBadge
      );
      ordersBody.append(row);
    });

    const pages = Math.max(1, Math.ceil(totalRows / pageSize));
    $('#page-label').textContent = `Page ${page + 1} of ${pages} · ${totalRows} orders`;
    $('#previous-page').disabled = page === 0;
    $('#next-page').disabled = page >= pages - 1;
  }

  async function refresh() {
    const request = ++refreshId;
    $('#dashboard-message').textContent = 'Loading live data…';
    try {
      await Promise.all([loadOverview(), loadOrders()]);
      if (request === refreshId) $('#dashboard-message').textContent = '';
    } catch (error) {
      if (request !== refreshId) return;
      console.error('[Digital Invitations] admin data load failed', error);
      $('#dashboard-message').textContent = errorMessage(error);
    }
  }

  function detailSection(title) {
    const section = document.createElement('section');
    section.className = 'admin-detail-card';
    section.append(document.createElement('h3'));
    section.firstChild.textContent = title;
    return section;
  }

  function addDefinition(section, title, value) {
    const row = document.createElement('div');
    row.className = 'admin-detail-row';
    const term = document.createElement('dt');
    term.textContent = title;
    const definition = document.createElement('dd');
    definition.textContent = value == null || value === '' ? '—' : String(value);
    row.append(term, definition);
    section.append(row);
  }

  function elText(value, className) {
    const node = document.createElement('p');
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  function openReceiptModal(dataUrl) {
    const dialog = $('#admin-receipt-dialog');
    const body = $('#admin-receipt-body');
    const fullLink = $('#admin-receipt-full');
    body.textContent = '';

    if (!dataUrl || !/^data:image\/(jpeg|png|webp);base64,/i.test(dataUrl)) {
      const err = document.createElement('p');
      err.className = 'admin-muted';
      err.textContent = 'Invalid or unsupported receipt image format.';
      body.append(err);
      fullLink.style.display = 'none';
    } else {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Transaction screenshot full preview';
      body.append(img);
      fullLink.href = dataUrl;
      fullLink.style.display = '';
    }
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }

  function renderSavedDetails(details) {
    const section = detailSection('Saved invitation details');
    if (!details || typeof details !== 'object') {
      section.append(elText('No saved details available.'));
      return section;
    }
    const inv = details.invitation || {};
    const invDet = inv.details || {};
    const rsvp = invDet.rsvp || {};
    const events = Array.isArray(invDet.events) ? invDet.events : [];

    const pairs = [
      ['Groom & Bride', [inv.groom_name, inv.bride_name].filter(Boolean).join(' & ')],
      ['Urdu Names', invDet.names_urdu],
      ['Name Order', invDet.name_order],
      ['Tagline', invDet.tagline],
      ['Tagline (Urdu)', invDet.tagline_urdu],
      ['Welcome Text', invDet.welcome],
      ['Welcome (Urdu)', invDet.welcome_urdu],
      ['Invitation Letter', invDet.letter_text],
      ['Closing Text', invDet.closingText || invDet.closing_text],
      ['Language', invDet.language],
      ['Music Track', invDet.music],
      ['Main Venue', invDet.venue_name],
      ['City / Country', invDet.city_country],
      ['Venue Map Link', invDet.venue_map],
      ['Venue Description', invDet.venue_description],
      ['RSVP WhatsApp', rsvp.whatsapp],
      ['RSVP Email', rsvp.email],
      ['Reply By Date', rsvp.reply_by],
      ['Ask Guests Count', rsvp.ask_guests ? 'Yes' : 'No'],
      ['Ask Needs / Dietary', rsvp.ask_needs ? 'Yes' : 'No'],
      ['Photos via WhatsApp', invDet.photos_whatsapp ? 'Yes' : 'No'],
      ['Notes', invDet.notes]
    ];

    pairs.forEach(pair => {
      if (pair[1] !== undefined && pair[1] !== null && String(pair[1]).trim() !== '') {
        addDefinition(section, pair[0], pair[1]);
      }
    });

    if (events.length > 0) {
      const heading = document.createElement('h4');
      heading.textContent = 'Events Timeline';
      section.append(heading);
      events.forEach((ev, idx) => {
        const title = ev.customName || ev.type || `Event ${idx + 1}`;
        const timeStr = [ev.date, ev.time, ev.endTime ? `to ${ev.endTime}` : ''].filter(Boolean).join(' · ');
        const locStr = [ev.venue, ev.city].filter(Boolean).join(', ');
        addDefinition(section, title, [timeStr, locStr, ev.notes].filter(Boolean).join(' — ') || 'No details');
      });
    }

    return section;
  }

  function renderTimelineWorkflow(order, payments) {
    const card = document.createElement('section');
    card.className = 'admin-workflow-card';

    const header = document.createElement('div');
    header.className = 'admin-workflow-header';
    header.append(elText('Order workflow (4 Steps)', 'admin-kicker'));
    const h3 = document.createElement('h3');
    h3.textContent = 'Order progress';
    header.append(h3);
    card.append(header);

    const timeline = document.createElement('div');
    timeline.className = 'admin-timeline';

    const currentStep = Number(order.workflow_step || 0);
    const orderDetails = order.details || {};
    const invDetails = (orderDetails.invitation && orderDetails.invitation.details) || {};
    const paymentData = invDetails.payment || {};
    const savedTid = (order.tid || paymentData.tid || (payments[0] && payments[0].reference) || '').trim();
    const screenshotData = paymentData.screenshot_data || null;

    // Helper: Build each step row
    function createStepRow(stepNum, titleText, timeStamp, isLocked, isCompleted, isCurrent, contentBoxes, canTick, tickHint, canWhatsApp, waHint) {
      const row = document.createElement('div');
      row.className = `admin-step-row${isCompleted ? ' is-completed' : ''}${isCurrent ? ' is-active' : ''}${isLocked ? ' is-locked' : ''}`;

      // Left Track with numbered Node & Connecting Line
      const track = document.createElement('div');
      track.className = 'admin-step-track';
      const node = document.createElement('div');
      node.className = 'admin-step-node';
      node.setAttribute('aria-hidden', 'true');
      node.textContent = isCompleted ? '✓' : isLocked ? '🔒' : String(stepNum);
      const line = document.createElement('div');
      line.className = 'admin-step-line';
      track.append(node, line);

      // Main content
      const main = document.createElement('div');
      main.className = 'admin-step-main';

      const top = document.createElement('div');
      top.className = 'admin-step-top';
      const title = document.createElement('h4');
      title.className = 'admin-step-title';
      title.textContent = `Step ${stepNum}: ${titleText}`;
      top.append(title);

      if (isCompleted && timeStamp) {
        const time = document.createElement('span');
        time.className = 'admin-step-time';
        time.textContent = `Completed ${new Date(timeStamp).toLocaleString()}`;
        top.append(time);
      }

      // Quiet Undo on the LATEST completed step only
      if (isCompleted && currentStep === stepNum) {
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'admin-step-undo-btn';
        undoBtn.textContent = 'Undo';
        undoBtn.setAttribute('aria-label', `Undo Step ${stepNum}`);
        undoBtn.addEventListener('click', async () => {
          if (!window.confirm(`Undo Step ${stepNum} for ${order.public_id}?`)) return;
          try {
            $('#detail-message').textContent = `Undoing Step ${stepNum}…`;
            await detailAction('admin_undo_step', {p_order_id: order.id});
            $('#detail-message').textContent = `Step ${stepNum} undone.`;
          } catch (err) {
            console.error('[Digital Invitations] undo step failed', err);
            $('#detail-message').textContent = errorMessage(err);
          }
        });
        top.append(undoBtn);
      }
      main.append(top);

      // Boxes
      const boxesWrap = document.createElement('div');
      boxesWrap.className = 'admin-step-boxes';
      contentBoxes.forEach(b => boxesWrap.append(b));
      main.append(boxesWrap);

      // Actions: Round W and Round Tick
      const actions = document.createElement('div');
      actions.className = 'admin-step-actions';

      // WhatsApp Button
      const waBtn = document.createElement('button');
      waBtn.type = 'button';
      waBtn.className = 'admin-circle-btn admin-wa-btn';
      waBtn.textContent = 'W';
      waBtn.setAttribute('aria-label', `Open WhatsApp message for Step ${stepNum}`);
      if (!canWhatsApp || isLocked) {
        waBtn.disabled = true;
        if (waHint) waBtn.title = waHint;
      }
      waBtn.addEventListener('click', () => {
        try {
          DI.whatsapp.buildStepMessage(stepNum, order);
        } catch (err) {
          console.error('[Digital Invitations] step WhatsApp failed', err);
          $('#detail-message').textContent = errorMessage(err);
          return;
        }
        void recordStepWhatsApp(order, stepNum);
      });

      // Tick Button
      const tickBtn = document.createElement('button');
      tickBtn.type = 'button';
      tickBtn.className = `admin-circle-btn admin-tick-btn${isCompleted ? ' is-completed' : ''}`;
      tickBtn.textContent = '✓';
      tickBtn.setAttribute('aria-label', isCompleted ? `Step ${stepNum} is complete` : `Mark Step ${stepNum} complete`);
      if (isCompleted || !canTick || isLocked) {
        tickBtn.disabled = true;
        if (tickHint) tickBtn.title = tickHint;
      }
      tickBtn.addEventListener('click', async () => {
        try {
          tickBtn.disabled = true;
          $('#detail-message').textContent = `Completing Step ${stepNum}…`;
          await detailAction('admin_complete_step', {p_order_id: order.id, p_step: stepNum});
          $('#detail-message').textContent = `Step ${stepNum} completed.`;
        } catch (err) {
          console.error('[Digital Invitations] complete step failed', err);
          $('#detail-message').textContent = errorMessage(err);
          tickBtn.disabled = false;
        }
      });

      actions.append(waBtn, tickBtn);
      row.append(track, main, actions);
      return row;
    }

    // Step 1: Order received
    const s1Boxes = [];
    const s1Box = document.createElement('div');
    s1Box.className = 'admin-step-box';
    s1Box.append(
      elText('Order Received', 'admin-form-heading'),
      elText(`Order ID: ${order.public_id}`),
      elText(`Placed: ${new Date(order.created_at).toLocaleString()}`)
    );
    s1Boxes.push(s1Box);

    const s1Completed = currentStep >= 1;
    const s1Row = createStepRow(
      1, 'Order received', order.step1_at || order.created_at,
      false, s1Completed, currentStep === 0, s1Boxes,
      !s1Completed, s1Completed ? 'Step 1 complete' : 'Mark Step 1 complete',
      true, 'Open WhatsApp message for Step 1'
    );
    timeline.append(s1Row);

    // Step 2: Advance payment
    const s2Locked = currentStep < 1;
    const s2Completed = currentStep >= 2;
    const s2Boxes = [];

    // Box A: Advance payment (TID + 50% amount)
    const s2BoxA = document.createElement('div');
    s2BoxA.className = 'admin-step-box';
    s2BoxA.append(elText('Advance Payment (50%)', 'admin-form-heading'));
    const advanceDue = orderMoney(Math.round(Number(order.total_minor || 0) * 0.5), order);
    s2BoxA.append(elText(`Advance due: ${advanceDue}`));

    const tidGroup = document.createElement('div');
    tidGroup.className = 'admin-box-input-group';
    const tidInput = document.createElement('input');
    tidInput.type = 'text';
    tidInput.id = 'admin-tid-input';
    tidInput.value = savedTid;
    tidInput.placeholder = 'Transaction ID (TID)';
    tidInput.disabled = s2Locked;
    const tidSaveBtn = document.createElement('button');
    tidSaveBtn.type = 'button';
    tidSaveBtn.className = 'btn btn-secondary';
    tidSaveBtn.textContent = 'Save';
    tidSaveBtn.disabled = s2Locked;
    tidSaveBtn.addEventListener('click', async () => {
      const val = tidInput.value.trim();
      if (!val) {
        $('#detail-message').textContent = 'Please enter a Transaction ID before saving.';
        return;
      }
      try {
        tidSaveBtn.disabled = true;
        $('#detail-message').textContent = 'Saving TID…';
        await detailAction('admin_set_tid', {p_order_id: order.id, p_tid: val});
        $('#detail-message').textContent = 'TID saved successfully.';
      } catch (err) {
        console.error('[Digital Invitations] save TID failed', err);
        $('#detail-message').textContent = errorMessage(err);
        tidSaveBtn.disabled = false;
      }
    });
    tidGroup.append(tidInput, tidSaveBtn);
    s2BoxA.append(tidGroup);
    s2Boxes.push(s2BoxA);

    // Box B: Payment receipt
    const s2BoxB = document.createElement('div');
    s2BoxB.className = 'admin-step-box';
    s2BoxB.append(elText('Payment Receipt', 'admin-form-heading'));
    if (screenshotData && /^data:image\/(jpeg|png|webp);base64,/i.test(screenshotData)) {
      const previewWrap = document.createElement('div');
      previewWrap.className = 'admin-receipt-preview';
      const thumb = document.createElement('img');
      thumb.src = screenshotData;
      thumb.alt = 'Receipt thumbnail';
      thumb.className = 'admin-receipt-thumb';
      thumb.tabIndex = 0;
      thumb.addEventListener('click', () => openReceiptModal(screenshotData));
      thumb.addEventListener('keydown', e => { if (e.key === 'Enter') openReceiptModal(screenshotData); });

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'admin-receipt-view-btn';
      viewBtn.textContent = 'View receipt';
      viewBtn.addEventListener('click', () => openReceiptModal(screenshotData));
      previewWrap.append(thumb, viewBtn);
      s2BoxB.append(previewWrap);
    } else {
      s2BoxB.append(elText('No receipt uploaded', 'admin-muted'));
    }
    s2Boxes.push(s2BoxB);

    const s2CanTick = !s2Completed && !s2Locked && Boolean(savedTid);
    const s2TickHint = s2Completed ? 'Step 2 complete' : s2Locked ? 'Complete Step 1 first' : !savedTid ? 'Transaction ID (TID) must be saved first' : 'Verify advance payment';
    const s2CanWa = !s2Locked && Boolean(savedTid);
    const s2WaHint = s2Locked ? 'Complete Step 1 first' : !savedTid ? 'Save the transaction ID (TID) first before messaging' : 'Open WhatsApp message for Step 2';
    const s2Row = createStepRow(
      2, 'Advance payment', order.step2_at,
      s2Locked, s2Completed, currentStep === 1, s2Boxes,
      s2CanTick, s2TickHint,
      s2CanWa, s2WaHint
    );
    timeline.append(s2Row);

    // Step 3: Preview
    const s3Locked = currentStep < 2;
    const s3Completed = currentStep >= 3;
    const s3Boxes = [];

    const s3BoxA = document.createElement('div');
    s3BoxA.className = 'admin-step-box';
    s3BoxA.append(
      elText('Preview Invitation', 'admin-form-heading'),
      elText('Send draft preview for customer approval.')
    );
    s3Boxes.push(s3BoxA);

    const s3BoxB = document.createElement('div');
    s3BoxB.className = 'admin-step-box';
    s3BoxB.append(elText('Preview Link', 'admin-form-heading'));
    const pGroup = document.createElement('div');
    pGroup.className = 'admin-box-input-group';
    const pInput = document.createElement('input');
    pInput.type = 'url';
    pInput.placeholder = 'https://...';
    pInput.value = order.preview_link || '';
    pInput.disabled = s3Locked || s3Completed;
    const pSaveBtn = document.createElement('button');
    pSaveBtn.type = 'button';
    pSaveBtn.className = 'btn btn-secondary';
    pSaveBtn.textContent = 'Save';
    pSaveBtn.disabled = s3Locked || s3Completed;
    pSaveBtn.addEventListener('click', async () => {
      const val = pInput.value.trim();
      if (!val || !val.startsWith('https://')) {
        $('#detail-message').textContent = 'Please enter a valid https:// URL.';
        return;
      }
      try {
        pSaveBtn.disabled = true;
        $('#detail-message').textContent = 'Saving preview link…';
        await detailAction('admin_set_link', {p_order_id: order.id, p_kind: 'preview', p_url: val});
        $('#detail-message').textContent = 'Preview link saved.';
      } catch (err) {
        console.error('[Digital Invitations] save preview link failed', err);
        $('#detail-message').textContent = errorMessage(err);
        pSaveBtn.disabled = false;
      }
    });
    pGroup.append(pInput, pSaveBtn);
    s3BoxB.append(pGroup);

    if (order.preview_link && order.preview_link.startsWith('https://')) {
      const openLink = document.createElement('a');
      openLink.className = 'admin-box-open-link';
      openLink.textContent = 'Open preview ↗';
      openLink.href = order.preview_link;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      s3BoxB.append(openLink);
    }
    s3Boxes.push(s3BoxB);

    const s3HasLink = Boolean(order.preview_link && order.preview_link.startsWith('https://'));
    const s3CanTick = !s3Completed && !s3Locked && s3HasLink;
    const s3TickHint = s3Completed ? 'Step 3 complete' : s3Locked ? 'Complete Step 2 first' : !s3HasLink ? 'A valid https preview link must be saved first' : 'Mark preview ready';
    const s3CanWa = !s3Locked && s3HasLink;
    const s3WaHint = s3Locked ? 'Complete Step 2 first' : !s3HasLink ? 'Save preview link first before messaging' : 'Open WhatsApp message for Step 3';

    const s3Row = createStepRow(
      3, 'Preview', order.step3_at,
      s3Locked, s3Completed, currentStep === 2, s3Boxes,
      s3CanTick, s3TickHint,
      s3CanWa, s3WaHint
    );
    timeline.append(s3Row);

    // Step 4: Confirmation (Final link)
    const s4Locked = currentStep < 3;
    const s4Completed = currentStep >= 4;
    const s4Boxes = [];

    const s4BoxA = document.createElement('div');
    s4BoxA.className = 'admin-step-box';
    s4BoxA.append(
      elText('Confirmation & Final Link', 'admin-form-heading'),
      elText('Deliver finalized invitation link.')
    );
    s4Boxes.push(s4BoxA);

    const s4BoxB = document.createElement('div');
    s4BoxB.className = 'admin-step-box';
    s4BoxB.append(elText('Final Link', 'admin-form-heading'));
    const fGroup = document.createElement('div');
    fGroup.className = 'admin-box-input-group';
    const fInput = document.createElement('input');
    fInput.type = 'url';
    fInput.placeholder = 'https://...';
    fInput.value = order.final_link || '';
    fInput.disabled = s4Locked || s4Completed;
    const fSaveBtn = document.createElement('button');
    fSaveBtn.type = 'button';
    fSaveBtn.className = 'btn btn-secondary';
    fSaveBtn.textContent = 'Save';
    fSaveBtn.disabled = s4Locked || s4Completed;
    fSaveBtn.addEventListener('click', async () => {
      const val = fInput.value.trim();
      if (!val || !val.startsWith('https://')) {
        $('#detail-message').textContent = 'Please enter a valid https:// URL.';
        return;
      }
      try {
        fSaveBtn.disabled = true;
        $('#detail-message').textContent = 'Saving final link…';
        await detailAction('admin_set_link', {p_order_id: order.id, p_kind: 'final', p_url: val});
        $('#detail-message').textContent = 'Final link saved.';
      } catch (err) {
        console.error('[Digital Invitations] save final link failed', err);
        $('#detail-message').textContent = errorMessage(err);
        fSaveBtn.disabled = false;
      }
    });
    fGroup.append(fInput, fSaveBtn);
    s4BoxB.append(fGroup);

    if (order.final_link && order.final_link.startsWith('https://')) {
      const openLink = document.createElement('a');
      openLink.className = 'admin-box-open-link';
      openLink.textContent = 'Open final link ↗';
      openLink.href = order.final_link;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      s4BoxB.append(openLink);
    }
    s4Boxes.push(s4BoxB);

    const s4HasLink = Boolean(order.final_link && order.final_link.startsWith('https://'));
    const s4CanTick = !s4Completed && !s4Locked && s4HasLink;
    const s4TickHint = s4Completed ? 'Step 4 complete' : s4Locked ? 'Complete Step 3 first' : !s4HasLink ? 'A valid https final link must be saved first' : 'Mark order completed';
    const s4CanWa = !s4Locked && s4HasLink;
    const s4WaHint = s4Locked ? 'Complete Step 3 first' : !s4HasLink ? 'Save final link first before messaging' : 'Open WhatsApp message for Step 4';

    const s4Row = createStepRow(
      4, 'Confirmation', order.step4_at,
      s4Locked, s4Completed, currentStep === 3, s4Boxes,
      s4CanTick, s4TickHint,
      s4CanWa, s4WaHint
    );
    timeline.append(s4Row);

    card.append(timeline);

    // Secondary actions: cancel, and permanent delete for completed orders
    const footerActions = document.createElement('div');
    footerActions.className = 'admin-cancel-order-wrap';

    if (order.order_status !== 'cancelled') {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'admin-cancel-link';
      cancelBtn.textContent = 'Cancel order';
      cancelBtn.addEventListener('click', async () => {
        if (!window.confirm(`Are you sure you want to cancel order ${order.public_id}?`)) return;
        try {
          await detailAction('set_status', {p_order_id: order.id, next_status: 'cancelled'});
          $('#detail-message').textContent = 'Order cancelled.';
        } catch (err) {
          console.error('[Digital Invitations] cancel order failed', err);
          $('#detail-message').textContent = errorMessage(err);
        }
      });
      footerActions.append(cancelBtn);
    }

    if (order.order_status === 'completed') {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'admin-delete-link';
      deleteBtn.textContent = 'Delete order';
      deleteBtn.title = 'Permanently delete this completed order and its records';
      deleteBtn.addEventListener('click', () => deleteCompletedOrder(order, deleteBtn));
      footerActions.append(deleteBtn);
    }

    if (footerActions.childElementCount) card.append(footerActions);

    return card;
  }

  function friendlyEventLabel(item) {
    if (item.type === 'step_completed' || item.type === 'step_undone' || item.type === 'link_updated' || item.type === 'tid_updated' || item.type === 'step_whatsapp_opened') {
      return item.to_value || label(item.type);
    }
    if (item.type === 'customer_chat_opened') {
      return 'Customer WhatsApp chat opened (not confirmed sent)';
    }
    if (item.type === 'order_status_changed') {
      return `Order status: ${label(item.to_value)}`;
    }
    if (item.type === 'payment_status_changed') {
      return `Payment status: ${label(item.to_value)}`;
    }
    return item.to_value ? `${label(item.type)}: ${item.to_value}` : label(item.type);
  }

  function renderDetail(data) {
    currentOrder = data.order;
    $('#detail-title').textContent = data.order.public_id;
    $('#detail-subtitle').textContent = `${data.order.customer_name} · ${data.order.whatsapp}`;
    const root = $('#detail-content');
    root.textContent = '';

    // 1. Order Overview
    const overview = detailSection('Order overview');
    addDefinition(overview, 'Customer', data.order.customer_name);
    addDefinition(overview, 'WhatsApp', data.order.whatsapp);
    addDefinition(overview, 'Email', data.order.email);
    addDefinition(overview, 'Offer', data.order.offer_id);
    addDefinition(overview, 'Template', data.order.template_id);
    addDefinition(overview, 'Event date', data.order.event_date);
    addDefinition(overview, 'Created', new Date(data.order.created_at).toLocaleString());
    const preview = DI.catalog && DI.catalog.templates && DI.catalog.templates.find(item => item.id === data.order.template_id);
    if (preview && preview.preview) {
      const image = document.createElement('img');
      image.className = 'admin-template-thumb';
      image.src = preview.preview.poster;
      image.alt = `${preview.label} preview`;
      overview.append(image);
    }

    // 2. The New 4-Step Timeline Workflow (replaces old Statuses block)
    const workflow = renderTimelineWorkflow(data.order, data.payments || []);

    // 3. Pricing Section
    const price = detailSection('Pricing');
    addDefinition(price, 'List price', orderMoney(data.order.subtotal_minor, data.order));
    addDefinition(price, 'Discount', `-${orderMoney(data.order.discount_minor, data.order)}`);
    addDefinition(price, 'Express delivery', orderMoney(data.order.express_minor, data.order));
    addDefinition(price, 'Order total', orderMoney(data.order.total_minor, data.order));
    addDefinition(price, '50% Advance amount', orderMoney(Math.round(Number(data.order.total_minor || 0) * 0.5), data.order));

    // 4. Saved Invitation Details (Allowlist only, no raw screenshots/names)
    const saved = renderSavedDetails(data.order.details);

    // 5. Previous orders with this WhatsApp
    const previous = detailSection('Previous orders with this WhatsApp');
    if (!data.previous.length) {
      previous.append(elText('No previous orders found.', 'admin-muted'));
    } else {
      data.previous.forEach(item => {
        const link = document.createElement('a');
        link.href = `#order-${encodeURIComponent(item.id)}`;
        link.textContent = `${item.public_id} · ${new Date(item.created_at).toLocaleDateString()} · ${stepBadgeLabel(item)}`;
        link.addEventListener('click', event => {
          event.preventDefault();
          openDetail(item.id);
        });
        previous.append(link);
      });
    }

    // 6. Friendly Event History (Newest first, clean step descriptions)
    const timeline = detailSection('Event history');
    if (!data.events.length) {
      timeline.append(elText('No events recorded.', 'admin-muted'));
    } else {
      data.events.forEach(item => {
        const entry = document.createElement('div');
        entry.className = 'admin-timeline-item';
        const actorName = item.actor === 'admin' ? 'Admin' : item.actor === 'customer' ? 'Customer' : 'System';
        entry.append(
          elText(friendlyEventLabel(item)),
          elText(`${actorName} · ${new Date(item.created_at).toLocaleString()}`, 'admin-muted')
        );
        timeline.append(entry);
      });
    }

    // 7. Customer WhatsApp Follow-up (Single button only)
    const actions = detailSection('Customer link and WhatsApp');
    const actionsRow = document.createElement('div');
    actionsRow.className = 'admin-actions';
    const chatBtn = document.createElement('button');
    chatBtn.className = 'btn btn-secondary';
    chatBtn.type = 'button';
    chatBtn.textContent = 'Open WhatsApp chat';
    chatBtn.addEventListener('click', () => openCustomerChat(data.order));
    actionsRow.append(chatBtn);
    actions.append(elText('General follow-up with customer via WhatsApp:', 'admin-muted-note'), actionsRow);

    root.append(overview, workflow, price, saved, previous, timeline, actions);
  }

  async function detailData(id) {
    const orderResult = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderResult.error) throw orderResult.error;
    const order = orderResult.data;
    const [payments, events, previous] = await Promise.all([
      supabase.from('payments').select('*').eq('order_id', id).order('submitted_at', {ascending: false}),
      supabase.from('order_events').select('*').eq('order_id', id).order('created_at', {ascending: false}),
      supabase.from('orders').select('id,public_id,created_at,order_status,workflow_step').eq('whatsapp', order.whatsapp).neq('id', id).order('created_at', {ascending: false})
    ]);
    for (const result of [payments, events, previous]) if (result.error) throw result.error;
    return {
      order,
      payments: payments.data || [],
      events: events.data || [],
      previous: previous.data || []
    };
  }

  async function loadDetail(id, options) {
    const opts = options || {};
    const request = ++detailLoadId;
    detailInFlightId = id;
    dashboardView.querySelector('#overview-cards').hidden = true;
    dashboardView.querySelector('.admin-orders').hidden = true;
    detailView.hidden = false;
    if (opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
    if (!opts.preserveMessage) $('#detail-message').textContent = 'Loading order…';
    try {
      const data = await detailData(id);
      if (request !== detailLoadId) return;
      renderDetail(data);
      if (!opts.preserveMessage) $('#detail-message').textContent = '';
    } catch (error) {
      if (request !== detailLoadId) return;
      console.error('[Digital Invitations] admin detail load failed', error);
      $('#detail-message').textContent = errorMessage(error);
    } finally {
      if (request === detailLoadId) detailInFlightId = null;
    }
  }

  async function openDetail(id, options) {
    const opts = options || {};
    if (opts.push !== false) {
      const hash = `#order-${encodeURIComponent(id)}`;
      if (location.hash !== hash) history.pushState({detail: true}, '', hash);
    }
    await loadDetail(id, {scroll: opts.scroll !== false});
  }

  function showList(options) {
    const opts = options || {};
    detailView.hidden = true;
    dashboardView.querySelector('#overview-cards').hidden = false;
    dashboardView.querySelector('.admin-orders').hidden = false;
    currentOrder = null;
    detailInFlightId = null;
    detailLoadId += 1;
    $('#detail-message').textContent = '';
    if (opts.updateHistory !== false) {
      history.replaceState({list: true}, '', location.pathname + location.search);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (opts.refreshList !== false) void refresh();
  }

  function routeFromHash() {
    if (dashboardView.hidden) return;
    const match = location.hash.match(/^#order-(.+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if ((currentOrder && currentOrder.id === id) || detailInFlightId === id) return;
      void openDetail(id, {push: false});
      return;
    }
    if (!detailView.hidden) showList({updateHistory: false});
  }

  async function reloadCurrentDetail(options) {
    if (!currentOrder) return;
    await loadDetail(currentOrder.id, Object.assign({scroll: false, preserveMessage: true}, options));
    await loadOverview();
  }

  async function deleteCompletedOrder(order, button) {
    if (order.order_status !== 'completed') {
      $('#detail-message').textContent = 'Only completed orders can be deleted.';
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete order ${order.public_id}?\n\nThis also deletes its payment records, notes, and history. This cannot be undone.`
    );
    if (!confirmed) return;
    if (button) button.disabled = true;
    $('#detail-message').textContent = `Deleting ${order.public_id}…`;
    try {
      const result = await supabase.rpc('admin_delete_completed_order', {p_order_id: order.id});
      if (result.error) throw result.error;
      showList({refreshList: false});
      await refresh();
      $('#dashboard-message').textContent = `Order ${order.public_id} deleted permanently.`;
    } catch (error) {
      console.error('[Digital Invitations] delete order failed', error);
      if (button) button.disabled = false;
      $('#detail-message').textContent = errorMessage(error);
    }
  }

  async function detailAction(name, args) {
    const result = await supabase.rpc(name, args);
    if (result.error) throw result.error;
    await reloadCurrentDetail();
  }

  async function recordChatOpened(order) {
    try {
      const result = await supabase.rpc('record_customer_chat_opened', {p_order_id: order.id});
      if (result.error) throw result.error;
    } catch (error) {
      console.error('[Digital Invitations] chat event recording failed', error);
      if (currentOrder && currentOrder.id === order.id) {
        $('#detail-message').textContent = 'WhatsApp opened, but the chat event could not be recorded.';
      }
    }
  }

  async function recordStepWhatsApp(order, step) {
    try {
      const result = await supabase.rpc('admin_record_step_whatsapp', {p_order_id: order.id, p_step: step});
      if (result.error) throw result.error;
    } catch (error) {
      console.error('[Digital Invitations] step WhatsApp event recording failed', error);
      if (currentOrder && currentOrder.id === order.id) {
        $('#detail-message').textContent = 'WhatsApp opened, but the message event could not be recorded.';
      }
    }
  }

  function openCustomerChat(order) {
    const norm = DI.whatsapp ? DI.whatsapp.normalizeWhatsApp(order.whatsapp) : {valid: true, value: order.whatsapp};
    if (!norm.valid) {
      $('#detail-message').textContent = 'This order does not have a valid WhatsApp number.';
      return;
    }
    const win = window.open(`https://wa.me/${norm.value}`, '_blank');
    if (!win) {
      $('#detail-message').textContent = 'Pop-up was blocked. Please allow pop-ups for this dashboard.';
      return;
    }
    try { win.opener = null; } catch (error) {}
    void recordChatOpened(order);
  }

  // Receipt modal close listeners
  $('#admin-receipt-close')?.addEventListener('click', () => {
    $('#admin-receipt-dialog')?.close();
  });
  $('#admin-receipt-dialog')?.addEventListener('click', event => {
    if (event.target === $('#admin-receipt-dialog')) {
      $('#admin-receipt-dialog').close();
    }
  });

  $('#login-business-name').textContent = (DI.site && DI.site.businessName) || 'Digital Invitations';

  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const submit = $('#login-form button[type="submit"]');
    if (!supabase) {
      showLogin(DI.supabaseError || 'Supabase is not configured.');
      return;
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showLogin('Enter a valid email address.');
      $('#login-email').focus();
      return;
    }
    if (!password) {
      showLogin('Enter your password.');
      $('#login-password').focus();
      return;
    }
    if (submit) submit.disabled = true;
    $('#login-message').textContent = 'Signing in…';
    try {
      const result = await supabase.auth.signInWithPassword({email, password});
      if (result.error) throw result.error;
      await enterDashboard(result.data.user);
    } catch (error) {
      console.error('[Digital Invitations] admin sign-in failed', {
        code: error.code, status: error.status, message: error.message,
        details: error.details, hint: error.hint
      });
      const isCredentialError = /invalid login|invalid credentials|email not confirmed|wrong password/i.test(error.message || '');
      showLogin(isCredentialError
        ? 'Incorrect email or password, or your account email is not yet confirmed. Check your details and try again.'
        : 'Sign-in failed. Check the browser console (F12 \u2192 Console) for the technical error, then contact the site owner if the problem persists.');
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  $('#logout-button').addEventListener('click', async () => {
    const button = $('#logout-button');
    button.disabled = true;
    try {
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
    } catch (error) {
      console.error('[Digital Invitations] admin sign-out failed', error);
      $('#dashboard-message').textContent = 'Sign out failed. Check your connection and try again.';
      return;
    } finally {
      button.disabled = false;
    }
    activeUserId = null;
    offersLoaded = false;
    showLogin('You have been signed out.');
  });

  $('#refresh-button').addEventListener('click', refresh);

  $('#detail-back').addEventListener('click', () => showList());

  $('#detail-refresh').addEventListener('click', () => {
    if (!currentOrder) return;
    void reloadCurrentDetail({preserveMessage: false}).catch(error => {
      console.error('[Digital Invitations] admin detail refresh failed', error);
      $('#detail-message').textContent = errorMessage(error);
    });
  });

  $('#filters-form').addEventListener('submit', event => {
    event.preventDefault();
    page = 0;
    refresh();
  });

  $('#previous-page').addEventListener('click', () => {
    if (page > 0) {
      page -= 1;
      refresh();
    }
  });

  $('#next-page').addEventListener('click', () => {
    if ((page + 1) * pageSize < totalRows) {
      page += 1;
      refresh();
    }
  });

  window.addEventListener('popstate', routeFromHash);
  window.addEventListener('hashchange', routeFromHash);

  async function enterDashboard(user) {
    if (!user) return;
    if (dashboardEntry) return dashboardEntry;
    if (activeUserId === user.id && !dashboardView.hidden) return;
    activeUserId = user.id;
    const entry = (async () => {
      try {
        if (!(await requireAdmin(user)) || activeUserId !== user.id) return;
        showDashboard(user);
        if (!offersLoaded) {
          try {
            await loadOffers();
          } catch (error) {
            console.error('[Digital Invitations] admin offers load failed', error);
          }
        }
        await refresh();
        if (activeUserId !== user.id) return;
        routeFromHash();
      } catch (error) {
        if (activeUserId !== user.id) return;
        console.error('[Digital Invitations] admin session check failed', error);
        showLogin('We could not verify this session. Please try again.');
      } finally {
        if (dashboardEntry === entry) dashboardEntry = null;
      }
    })();
    dashboardEntry = entry;
    return entry;
  }

  (async function init() {
    if (!supabase) {
      showLogin(DI.supabaseError || 'Supabase is not configured.');
      return;
    }
    supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setTimeout(() => { void enterDashboard(session.user); }, 0);
        return;
      }
      activeUserId = null;
      offersLoaded = false;
      dashboardEntry = null;
      if (event === 'SIGNED_OUT' && !dashboardView.hidden) {
        showLogin('You have been signed out.');
      }
    });
    try {
      const session = await supabase.auth.getSession();
      const user = session.data.session && session.data.session.user;
      if (user) await enterDashboard(user);
      else showLogin('Sign in to access the private dashboard.');
    } catch (error) {
      console.error('[Digital Invitations] admin initialization failed', error);
      showLogin('We could not verify this session. Please try again.');
    }
  }());
}());
