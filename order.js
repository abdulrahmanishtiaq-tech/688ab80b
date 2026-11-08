(function () {
  'use strict';
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Digital Invitations] Supabase client script is missing from window.supabase.');
  }
  if (!window.DI || !DI.site || !DI.site.supabaseUrl || !DI.site.supabaseAnonKey) {
    console.error('[Digital Invitations] Supabase credentials missing at runtime: DI.site.supabaseUrl or DI.site.supabaseAnonKey.');
  }
  const dialog = document.querySelector('#orderDialog');
  if (!dialog || !window.DI || !DI.catalog || !DI.pricing) return;
  const catalog = DI.catalog, pricing = DI.pricing, templates = catalog.templates;
  const $ = selector => dialog.querySelector(selector);
  const storageKey = 'di_template_order_v1';
  const newSubmissionId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const value = Math.random() * 16 | 0;
      return (char === 'x' ? value : value & 3 | 8).toString(16);
    });
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const visitorTimeZone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (error) { return 'UTC'; }
  };
  const zones = () => {
    try { return Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC', 'Asia/Karachi', 'Asia/Dubai', 'Europe/London']; }
    catch (error) { return ['UTC', 'Asia/Karachi', 'Asia/Dubai', 'Europe/London']; }
  };
  const defaultEvent = () => ({type: 'Nikkah', customName: '', date: '', time: '', endTime: '', venue: '', city: '', map: '', dressCode: '', titleEn: '', titleUr: '', subtitle: '', description: ''});
  const defaultState = () => ({
    submissionId: newSubmissionId(),
    templateId: templates[0].id, express: false, step: 1,
    currency: catalog.currency || 'USD', groomName: '', brideName: '', nameOrder: 'groom', writeUrdu: false,
    namesUrdu: '', tagline: 'A celebration written in the stars.', welcome: '',
    taglineUrdu: '', welcomeUrdu: '', letterText: '', closingText: '',
    weddingDate: '', dateNotFinal: false, startTime: '', endTime: '', timeZone: visitorTimeZone(),
    events: [defaultEvent()], venueName: '', cityCountry: '', venueDescription: '', venueMap: '', noorMap: '',
    language: 'englishUrdu', urduHelp: 'translate', rsvpWhatsApp: '', rsvpEmail: '', replyBy: '',
    askGuests: false, askNeeds: false, askContact: false, music: 'noMusic', photosWhatsApp: false,
    fullName: '', contactWhatsApp: '', email: '', preferredContact: 'whatsapp', notes: '', tid: '', paymentScreenshot: '', paymentScreenshotName: '', serverOrder: null, paymentSubmitted: false, paymentError: '',     website: '', sent: false
  });
  let state = defaultState(), opener = null;

  let draftTimer = null;
  function report(error) { console.error('[Digital Invitations] order dialog initialization failed', error); }
  function saveDraftImmediate() {
    try {
      const draft = Object.assign({}, state);
      draft.paymentScreenshot = '';
      delete draft.serverOrder;
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (error) { report(error); }
  }
  function compressScreenshot(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Image processing is not available in this browser.');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('That image could not be read. Please choose a JPG, PNG or WebP file.'));
      };
      image.src = url;
    });
  }
  function saveDraft() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraftImmediate, 200);
  }
  function loadDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (isDraftValid(draft)) state = Object.assign(defaultState(), draft, {step: 1});
      else if (draft) localStorage.removeItem(storageKey);
    } catch (error) { report(error); }
  }
  function isDraftValid(draft) {
    return Boolean(draft && typeof draft === 'object' && templates.some(item => item.id === draft.templateId) &&
      Array.isArray(draft.events) && draft.events.length >= 1 && draft.events.length <= 6 &&
      draft.events.every(event => event && typeof event === 'object') && typeof draft.express === 'boolean');
  }
  function text(tag, value, className) { const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = value; return el; }
  function getPath(key) { return key.split('.').reduce((value, part) => value == null ? undefined : value[part], state); }
  function setPath(key, value) {
    const parts = key.split('.'); const last = parts.pop(); const target = parts.reduce((value, part) => value[part], state);
    target[last] = value; saveDraft();
  }
  function setValue(input, key) { setPath(key, input.type === 'checkbox' ? input.checked : input.value); }
  function field(root, label, key, type, options) {
    const wrap = text('div', undefined, 'ord-field');
    const labelEl = text('label', undefined, 'ord-form-label'); labelEl.htmlFor = `ord-${key}`;
    const line = text('span', `${label}${options.required ? ' *' : ''}`); labelEl.append(line);
    let input = type === 'textarea' ? document.createElement('textarea') : document.createElement(type === 'select' ? 'select' : 'input');
    input.id = `ord-${key}`; input.name = key;
    if (type !== 'select' && type !== 'textarea') input.type = type;
    if (options.autocomplete) input.autocomplete = options.autocomplete;
    if (options.max) input.maxLength = options.max;
    if (options.min) input.min = options.min;
    if (options.pattern) input.pattern = options.pattern;
    if (options.dir) input.dir = options.dir;
    if (type === 'select') options.choices.forEach(choice => { const option = text('option', choice.label); option.value = choice.value; input.append(option); });
    if (type === 'date' && options.min === 'today') input.min = today();
    const savedValue = getPath(key);
    if (type !== 'checkbox') input.value = savedValue || '';
    if (type === 'checkbox') input.checked = Boolean(savedValue);
    if (options.disabled) input.disabled = options.disabled();
    input.addEventListener('input', () => { setValue(input, key); if (options.counter) options.counter.textContent = `${input.value.length}/${options.max}`; });
    input.addEventListener('change', () => { setValue(input, key); if (options.onChange) options.onChange(input); });
    input.addEventListener('blur', () => validateField(input, options));
    labelEl.append(input);
    if (options.helper) labelEl.append(text('small', options.helper, 'ord-field-note'));
    const error = text('small', '', 'ord-field-error'); error.id = `${input.id}-error`;
    wrap.append(labelEl, error); root.append(wrap);
    if (options.counter) { options.counter.textContent = `${input.value.length}/${options.max}`; labelEl.append(options.counter); }
    return input;
  }
  function fieldset(root, legend, helper) { const fs = document.createElement('fieldset'); fs.append(text('legend', legend)); if (helper) fs.append(text('p', helper, 'ord-inline-note')); root.append(fs); return fs; }
  function selectChoices(choices) { return choices.map(value => ({value, label: value})); }
  function validateField(input, options) {
    if (!input || input.type === 'checkbox' && !options.required) return true;
    if (input.disabled) return true;
    let message = '';
    if (options.required && ((input.type === 'checkbox' && !input.checked) || (input.type !== 'checkbox' && !input.value.trim()))) message = 'This field is required.';
    if (!message && input.value && options.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)) message = 'Enter a valid email address.';
    if (!message && input.value && options.phone && !/^\+?\d{7,15}$/.test(input.value.replace(/[\s()-]/g, ''))) message = 'Use 7 to 15 digits, with an optional leading plus.';
    if (!message && input.value && options.https && !/^https:\/\//i.test(input.value)) message = 'Use a valid https URL.';
    const error = document.getElementById(`${input.id}-error`);
    if (error) error.textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) input.setAttribute('aria-describedby', error.id); else input.removeAttribute('aria-describedby');
    return !message;
  }
  function selectTemplate(templateId) {
    if (state.templateId === templateId) return;
    state.templateId = templateId; saveDraft(); render();
  }
  function renderStepOne() {
    const root = $('#ord-step-one'); root.textContent = '';
    root.append(text('p', 'Every design is fully personalised to you: your colors, your photos, your text.', 'ord-step-intro'));
    const grid = text('div', undefined, 'ord-template-grid');
    templates.forEach(template => {
      const card = text('article', undefined, `ord-template-card${state.templateId === template.id ? ' is-selected' : ''}`);
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'order-template'; radio.checked = state.templateId === template.id; radio.setAttribute('aria-label', `Choose ${template.label}`);
      radio.addEventListener('change', () => selectTemplate(template.id));
      const preview = text('div', undefined, 'ord-template-preview pv'); preview.dataset.videoMp4 = template.preview.mp4; preview.dataset.videoWebm = template.preview.webm; preview.dataset.poster = template.preview.poster;
      const phone = text('div', undefined, 'phone-preview'), screen = text('div', undefined, 'phone-screen'), poster = document.createElement('img'), video = document.createElement('video');
      poster.src = template.preview.poster; poster.alt = ''; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none'; video.poster = template.preview.poster; video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1; video.disablePictureInPicture = true; video.setAttribute('disableremoteplayback', '');
      screen.append(poster, video); phone.append(screen); preview.append(phone);
      const demo = document.createElement('a'); demo.href = template.demo; demo.target = '_blank'; demo.rel = 'noopener'; demo.textContent = 'See live example';
      card.addEventListener('click', event => { if (!event.target.closest('a, button')) selectTemplate(template.id); });
      card.append(radio, preview, text('span', template.badge, 'ord-template-badge'), text('span', '✓', 'ord-template-check'), text('h4', template.label), text('p', template.shortDescription), demo); grid.append(card);
    });
    root.append(grid);
    if (typeof DI.initPreviewVideos === 'function') DI.initPreviewVideos();
  }
  function renderEvents(root) {
    const list = text('div', undefined, 'ord-events-list');
    state.events.forEach((event, index) => {
      const row = text('div', undefined, 'ord-event-row'); row.dataset.index = index;
      row.append(text('h4', `Event ${index + 1}`));
      field(row, 'Event type', `events.${index}.type`, 'select', {required: true, choices: selectChoices(['Nikkah', 'Mehndi', 'Barat', 'Walima', 'Dholki', 'Reception', 'Other'])});
      field(row, 'Custom name if Other', `events.${index}.customName`, 'text', {autocomplete: 'off'});
      field(row, 'English event title', `events.${index}.titleEn`, 'text', {max: 80});
      field(row, 'Urdu event title', `events.${index}.titleUr`, 'text', {max: 80, dir: 'auto'});
      field(row, 'Subtitle', `events.${index}.subtitle`, 'text', {max: 120});
      field(row, 'Description', `events.${index}.description`, 'textarea', {max: 200});
      field(row, 'Date', `events.${index}.date`, 'date', {required: true, min: 'today'});
      field(row, 'Start time', `events.${index}.time`, 'time', {required: true});
      field(row, 'End time', `events.${index}.endTime`, 'time', {});
      field(row, 'Venue name', `events.${index}.venue`, 'text', {required: true, autocomplete: 'address-line1'});
      field(row, 'City', `events.${index}.city`, 'text', {required: true, autocomplete: 'address-level2'});
      field(row, 'Google Maps link', `events.${index}.map`, 'url', {https: true, helper: 'Optional; must start with https://'});
      field(row, 'Dress code', `events.${index}.dressCode`, 'text', {});
      const remove = text('button', 'Remove event', 'btn ord-remove-event'); remove.type = 'button'; remove.disabled = state.events.length === 1; remove.addEventListener('click', () => { state.events.splice(index, 1); saveDraft(); render(); document.querySelector(`[data-index="${Math.max(0, index - 1)}"] input`)?.focus(); }); row.append(remove); list.append(row);
    });
    const add = text('button', 'Add event', 'btn ord-add-event'); add.type = 'button'; add.disabled = state.events.length >= 6; add.addEventListener('click', () => { state.events.push(defaultEvent()); saveDraft(); render(); list.lastElementChild.querySelector('input,select')?.focus(); });
    root.append(list, add);
  }
  function renderDetails() {
    const root = $('#ord-step-two'); root.textContent = '';
    const summary = text('div', '', 'ord-error-summary'); summary.id = 'ord-error-summary'; summary.setAttribute('aria-live', 'polite'); root.append(summary);
    let fs = fieldset(root, 'The couple', 'Use the names exactly as you want them shown.');
    field(fs, "Groom's name", 'groomName', 'text', {required: true, autocomplete: 'given-name'});
    field(fs, "Bride's name", 'brideName', 'text', {required: true, autocomplete: 'given-name'});
    const order = document.createElement('div'); order.className = 'ord-inline-options'; ['groom', 'bride'].forEach(value => { const label = document.createElement('label'), radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'nameOrder'; radio.value = value; radio.checked = state.nameOrder === value; radio.addEventListener('change', () => { state.nameOrder = value; saveDraft(); }); label.append(radio, ` ${value === 'groom' ? 'Groom' : 'Bride'} first`); order.append(label); }); fs.append(text('span', 'Which name appears first'), order);
    field(fs, 'Please write our names in Urdu for us', 'writeUrdu', 'checkbox', {helper: 'We can prepare the Urdu script for you.'});
    field(fs, 'Names in Urdu script', 'namesUrdu', 'text', {dir: 'auto', helper: 'Optional; leave blank if you want us to translate.'});
    fs = fieldset(root, 'Opening words', 'These appear beneath the couple’s names.');
    field(fs, 'Short line under the names', 'tagline', 'text', {required: true, max: 80, helper: 'Maximum 80 characters.'});
    field(fs, 'Welcome message', 'welcome', 'textarea', {max: 200, helper: 'Optional; maximum 200 characters.'});
    field(fs, 'Urdu short line', 'taglineUrdu', 'text', {max: 80, dir: 'auto'});
    field(fs, 'Urdu welcome message', 'welcomeUrdu', 'textarea', {max: 200, dir: 'auto'});
    field(fs, 'Invitation letter text', 'letterText', 'textarea', {max: 1000, helper: 'Optional; the demo uses a longer bilingual letter.'});
    field(fs, 'Closing message', 'closingText', 'textarea', {max: 200});
    fs = fieldset(root, 'The date', 'Set the main date and ceremony time.');
    const date = field(fs, 'Wedding date', 'weddingDate', 'date', {required: true, min: 'today'}); field(fs, 'Main start time', 'startTime', 'time', {required: true}); field(fs, 'Main end time', 'endTime', 'time', {});
    field(fs, 'Time zone', 'timeZone', 'select', {choices: selectChoices(zones())});
    field(fs, 'Date not final yet', 'dateNotFinal', 'checkbox', {onChange: input => { date.disabled = input.checked; if (input.checked) { date.removeAttribute('aria-invalid'); } }});
    date.disabled = state.dateNotFinal;
    fs = fieldset(root, 'Events', 'Add between 1 and 6 event rows.'); renderEvents(fs);
    fs = fieldset(root, 'A place to remember', 'Your main venue details.');
    field(fs, 'Venue name', 'venueName', 'text', {required: true, autocomplete: 'organization'});
    field(fs, 'City and country', 'cityCountry', 'text', {required: true, autocomplete: 'address-level2'});
    field(fs, 'Short description', 'venueDescription', 'textarea', {max: 140});
    field(fs, 'Map link', 'venueMap', 'url', {https: true});
    field(fs, 'Urdu map link', 'noorMap', 'url', {https: true, helper: 'The demo’s separate Urdu map link.'});
    fs = fieldset(root, 'Language', 'Choose the language treatment for the invitation.');
    field(fs, 'Language', 'language', 'select', {choices: [{value: 'englishUrdu', label: 'English and Urdu (as in the live example)'}, {value: 'english', label: 'English only'}, {value: 'urdu', label: 'Urdu only'}, {value: 'other', label: 'Other language (tell us in the notes)'}]});
    field(fs, 'Urdu text', 'urduHelp', 'select', {choices: [{value: 'provide', label: 'I will provide the Urdu text'}, {value: 'translate', label: 'Please translate for us'}]});
    fs = fieldset(root, 'RSVP', 'Tell us where guest replies should go.');
    field(fs, 'WhatsApp number', 'rsvpWhatsApp', 'tel', {required: !state.rsvpEmail, phone: true, autocomplete: 'tel'});
    field(fs, 'Email', 'rsvpEmail', 'email', {required: !state.rsvpWhatsApp, email: true, autocomplete: 'email'});
    field(fs, 'Reply-by date', 'replyBy', 'date', {});
    [['askGuests', 'Ask guests how many are attending'], ['askNeeds', 'Ask about dietary or accessibility needs'], ['askContact', 'Ask for a contact number']].forEach(([key, label]) => field(fs, label, key, 'checkbox', {}));
    fs = fieldset(root, 'Music', 'The demo currently supports music.');
    field(fs, 'Music choice', 'music', 'select', {choices: catalog.musicTracks.concat([{value: 'suggest', label: 'Suggest something similar (we pick royalty-free)'}, {value: 'noMusic', label: 'No music'}])});
    field(fs, 'Photos', 'photosWhatsApp', 'checkbox', {helper: 'I will send my photos on WhatsApp after I place the order.'});
    fs = fieldset(root, 'Delivery', 'Choose standard delivery or pay the configured express price.');
    const standard = document.createElement('label'), express = document.createElement('label'); standard.className = express.className = 'ord-delivery-option';
    const standardInput = document.createElement('input'); standardInput.type = 'radio'; standardInput.name = 'delivery'; standardInput.checked = !state.express; standardInput.addEventListener('change', () => { state.express = false; saveDraft(); updateTotal(); });
    const expressInput = document.createElement('input'); expressInput.type = 'radio'; expressInput.name = 'delivery'; expressInput.checked = state.express; expressInput.addEventListener('change', () => { state.express = true; saveDraft(); updateTotal(); });
    standard.append(standardInput, ` Standard — ${catalog.delivery.standard}`); express.append(expressInput, ` Express — ${catalog.delivery.express} (+${pricing.formatMoney(catalog.expressPrice, state.currency, catalog)})`); fs.append(standard, express);
    fs = fieldset(root, 'Your contact details', 'We use this to send your preview.');
    field(fs, 'Full name', 'fullName', 'text', {required: true, autocomplete: 'name'});
    field(fs, 'WhatsApp number', 'contactWhatsApp', 'tel', {required: true, phone: true, autocomplete: 'tel', helper: 'Country code included; 7 to 15 digits.'});
    field(fs, 'Email', 'email', 'email', {email: true, autocomplete: 'email'});
    field(fs, 'Preferred contact method', 'preferredContact', 'select', {choices: [{value: 'whatsapp', label: 'WhatsApp'}, {value: 'email', label: 'Email'}]});
    const counter = text('small', '', 'ord-char-counter'); field(fs, 'Notes', 'notes', 'textarea', {max: 600, counter, helper: 'Maximum 600 characters.'});
    const honeypot = document.createElement('input'); honeypot.type = 'text'; honeypot.name = 'website'; honeypot.autocomplete = 'off'; honeypot.tabIndex = -1; honeypot.hidden = true; honeypot.addEventListener('input', () => { state.website = honeypot.value; saveDraft(); }); root.append(honeypot);
  }
  function updateTotal() {
    const quote = pricing.calculateQuote(state, catalog);
    const total = $('#ord-total');
    const next = pricing.formatMoney(quote.totalUSD, state.currency, catalog);
    if (total.textContent === next) return;
    total.textContent = next;
    total.classList.remove('is-bump');
    void total.offsetWidth;
    total.classList.add('is-bump');
  }
  function formatDate(value) {
    if (!value) return 'Not final yet';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', {dateStyle: 'long'}).format(date);
  }
  function money(amount) { return pricing.formatMoney(amount, state.currency, catalog); }
  function optionLabel(value, choices) {
    const item = choices.find(choice => choice.value === value);
    return item ? item.label : value || 'Not provided';
  }
  
  function validateOrderState() {
    state = Object.assign(state, pricing.validateState(state, catalog));
    if (!validateDetails()) {
      state.step = 2; saveDraft(); render(); validateDetails(); return false;
    }
    return !state.website;
  }
  function eventLines() {
    return state.events.map((event, index) => [
      `${index + 1}. ${event.type === 'Other' ? (event.customName || 'Other event') : event.type}${event.titleEn ? ` — ${event.titleEn}` : ''}`,
      `   Date: ${formatDate(event.date)}${event.time ? `, ${event.time}` : ''}${event.endTime ? `-${event.endTime}` : ''}`,
      `   Venue: ${event.venue || 'Not provided'}${event.city ? `, ${event.city}` : ''}`,
      `   Map: ${event.map || 'Not provided'}`,
      `   Dress code: ${event.dressCode || 'Not provided'}`,
      `   Urdu title: ${event.titleUr || 'Not provided'}`,
      `   Subtitle: ${event.subtitle || 'Not provided'}`,
      `   Description: ${event.description || 'Not provided'}`
    ].join('\n')).join('\n');
  }
  function buildOrderMessage() {
    const quote = pricing.calculateQuote(state, catalog);
    const template = templates.find(item => item.id === state.templateId) || templates[0];
    const lines = quote.lines.map(line => {
      const prefix = line.type === 'express' ? '+' : '';
      return `${line.label}: ${prefix}${money(line.amountUSD)}`;
    }).join('\n');
    return [
      `Digital Invitations order inquiry`,
      '',
      `Template: ${template.label}`,
      `Couple: ${state.nameOrder === 'bride' ? state.brideName + ' & ' + state.groomName : state.groomName + ' & ' + state.brideName}`,
      `Names in Urdu: ${state.namesUrdu || (state.writeUrdu ? 'Please prepare Urdu names' : 'Not requested')}`,
      `Tagline: ${state.tagline}`,
      `Welcome message: ${state.welcome || 'Not provided'}`,
      `Wedding date: ${formatDate(state.weddingDate)}`,
      `Main time: ${state.startTime || 'Not provided'}${state.endTime ? `-${state.endTime}` : ''}`,
      `Time zone: ${state.timeZone}`,
      '',
      'Events:',
      eventLines(),
      '',
      `Main venue: ${state.venueName}, ${state.cityCountry}`,
      `Venue description: ${state.venueDescription || 'Not provided'}`,
      `Venue map: ${state.venueMap || 'Not provided'}`,
      `Urdu map: ${state.noorMap || 'Not provided'}`,
      `Language: ${state.language}`,
      `Urdu text: ${state.urduHelp}`,
      `RSVP WhatsApp: ${state.rsvpWhatsApp || 'Not provided'}`,
      `RSVP email: ${state.rsvpEmail || 'Not provided'}`,
      `Reply by: ${formatDate(state.replyBy)}`,
      `RSVP questions: ${[state.askGuests && 'attendance count', state.askNeeds && 'dietary/accessibility needs', state.askContact && 'contact number'].filter(Boolean).join(', ') || 'None'}`,
      `Music: ${state.music}`,
      `Photos: ${state.photosWhatsApp ? 'Will send photos on WhatsApp after placing the order' : 'Photo plan not provided'}`,
      `Delivery: ${state.express ? catalog.delivery.express : catalog.delivery.standard}`,
      '',
      'Price:',
      lines,
      `Total: ${money(quote.totalUSD)}`,
      '',
      `Contact name: ${state.fullName}`,
      `Contact WhatsApp: ${state.contactWhatsApp}`,
      `Contact email: ${state.email || 'Not provided'}`,
      `Preferred contact: ${state.preferredContact}`,
      `Notes: ${state.notes || 'None'}`,
      '',
      'Advance payment: 50%\n' + ('TID: ' + (state.tid || 'Pending')) + (state.paymentScreenshotName ? '\nScreenshot: ' + state.paymentScreenshotName : '')
    ].join('\n');
  }
  async function postOrder(message) {
    if (!DI.site.formEndpoint) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(DI.site.formEndpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({reference: state.reference, state, message}), signal: controller.signal});
      if (!response.ok) throw new Error(`Order endpoint returned ${response.status}`);
    } catch (error) {
      console.error('[Digital Invitations] order submission failed', error);
    } finally { clearTimeout(timer); }
  }
  function copyMessage(message, button) {
    const fallback = () => {
      const area = document.createElement('textarea'); area.value = message; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
      try { document.execCommand('copy'); button.textContent = 'Copied'; } catch (error) { console.error('[Digital Invitations] copy order message failed', error); button.textContent = 'Copy failed'; }
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(message).then(() => { button.textContent = 'Copied'; }).catch(fallback);
    else fallback();
  }
  function renderThanks(serverOrder) {
    if (serverOrder) state.serverOrder = serverOrder;
    const currentOrder = serverOrder || state.serverOrder;
    const root = $('#ord-step-four') || $('#ord-step-three');
    root.textContent = '';
    const panel = text('div', undefined, 'ord-success-panel');
    root.append(panel);

    const publicId = currentOrder && currentOrder.public_id ? currentOrder.public_id : '';
    const totalMinor = currentOrder && Number.isFinite(Number(currentOrder.total_minor)) ? Number(currentOrder.total_minor) : null;
    const quote = pricing.calculateQuote(state, catalog);
    const amountUSD = totalMinor !== null ? (totalMinor / 100) : quote.totalUSD;
    const formattedTotal = money(amountUSD);
    const advanceAmount = money(amountUSD * 0.5);

    if (publicId) panel.append(text('p', publicId, 'ord-reference'));
    panel.append(text('h4', 'Thank you!'));
    panel.append(text('p', `Order total: ${formattedTotal}`, 'ord-server-total'));

    if (state.paymentSubmitted) {
      panel.append(text('p', `Advance payment submitted: ${advanceAmount} (awaiting verification)`, 'ord-advance-confirm'));
    } else {
      const warning = text('div', undefined, 'ord-error-summary ord-payment-warning');
      warning.append(text('p', 'Your order is saved, but we could not submit your payment proof. You can retry below or contact us on WhatsApp.'));
      if (currentOrder && currentOrder.access_token && state.tid && DI.orders && typeof DI.orders.submitPaymentReference === 'function') {
        const retry = text('button', 'Retry payment proof', 'ord-copy');
        retry.type = 'button';
        retry.addEventListener('click', () => retryPaymentProof(currentOrder, retry, warning));
        warning.append(retry);
      }
      panel.append(warning);
    }

    const slipPath = (DI.site && DI.site.confirmationPath) || 'confirmation.html';
    const confirmationUrl = currentOrder && currentOrder.access_token
      ? `${location.origin}${location.pathname.replace(/[^/]+$/, '')}${slipPath}?t=${encodeURIComponent(currentOrder.access_token)}`
      : '';

    // Action buttons: View confirmation slip & Back to site (No WhatsApp button)
    const actions = text('div', undefined, 'ord-send-actions');
    if (confirmationUrl) {
      const slipBtn = text('a', 'View confirmation slip', 'btn');
      slipBtn.href = confirmationUrl;
      slipBtn.target = '_blank';
      slipBtn.rel = 'noopener';
      actions.append(slipBtn);
    }

    const backBtn = text('a', 'Back to site', 'btn ord-secondary-action');
    backBtn.href = '#designs';
    backBtn.addEventListener('click', close);
    actions.append(backBtn);

    panel.append(actions);

    // What happens next section with the 4 specific points
    panel.append(text('h5', 'What happens next'));
    const next = text('ol');
    const steps = [
      'We’ll send your order confirmation message.',
      'We’ll send advance payment confirmation.',
      'We’ll send your invitation preview link for approval.',
      'We’ll send your final invitation link, ready to share.'
    ];
    steps.forEach(item => next.append(text('li', item)));
    panel.append(next);

    const again = text('button', catalog.copy.startAgain, 'btn ord-secondary-action');
    again.type = 'button';
    again.addEventListener('click', () => {
      state = defaultState();
      saveDraft();
      state.step = 1;
      render();
      focusStep();
    });
    panel.append(again);

    // Explicitly hide footer navigation buttons on Step 4
    const footer = dialog.querySelector('.ord-footer');
    if (footer) {
      footer.hidden = true;
      footer.style.display = 'none';
    }
    const continueBtn = $('#ord-continue');
    if (continueBtn) {
      continueBtn.hidden = true;
      continueBtn.style.display = 'none';
    }
    const backBtnNav = $('#ord-back');
    if (backBtnNav) {
      backBtnNav.hidden = true;
      backBtnNav.style.display = 'none';
    }
  }
  async function retryPaymentProof(order, button, warning) {
    if (!order || !order.access_token || !state.tid) return;
    button.disabled = true;
    button.textContent = 'Retrying…';
    try {
      const advanceMinor = Math.max(0, Math.round(Number(order.total_minor || 0) * 0.5));
      await DI.orders.submitPaymentReference(order.access_token, 'other', state.tid.trim(), advanceMinor);
      state.paymentSubmitted = true;
      state.paymentError = '';
      try { localStorage.removeItem(storageKey); } catch (error) {}
      warning.className = 'ord-advance-confirm';
      warning.textContent = `Advance payment submitted: ${money(Number(order.total_minor || 0) / 100 * 0.5)} (awaiting verification).`;
    } catch (error) {
      console.error('[Digital Invitations] retry payment submission failed', error);
      warning.textContent = 'We still could not submit your payment proof. Please try again or contact us on WhatsApp.';
      button.disabled = false;
      button.textContent = 'Retry payment proof';
    }
  }
  function buildServerPayload() {
    const cleanPhone = raw => {
      if (DI.whatsapp && typeof DI.whatsapp.normalizeWhatsApp === 'function') {
        const res = DI.whatsapp.normalizeWhatsApp(raw);
        return res ? res.value : '';
      }
      return String(raw || '').replace(/\D/g, '');
    };
    return {
      submission_id: state.submissionId,
      offer_id: 'template-invitation',
      template_id: state.templateId,
      customer: {
        full_name: (state.fullName || '').trim(),
        whatsapp: cleanPhone(state.contactWhatsApp),
        email: state.email ? state.email.trim() : null,
        preferred_contact: state.preferredContact || 'whatsapp'
      },
      invitation: {
        groom_name: (state.groomName || '').trim(),
        bride_name: (state.brideName || '').trim(),
        wedding_date: state.weddingDate || null,
        start_time: state.startTime || null,
        end_time: state.endTime || null,
        time_zone: state.timeZone || 'UTC',
        event_type: (state.events && state.events[0] && state.events[0].type) || 'Nikkah',
        details: {
          currency: state.currency,
          name_order: state.nameOrder,
          names_urdu: state.namesUrdu,
          write_urdu: Boolean(state.writeUrdu),
          tagline: state.tagline,
          welcome: state.welcome,
          tagline_urdu: state.taglineUrdu,
          welcome_urdu: state.welcomeUrdu,
          letter_text: state.letterText,
          closing_text: state.closingText,
          events: state.events,
          venue_name: state.venueName,
          city_country: state.cityCountry,
          venue_description: state.venueDescription,
          venue_map: state.venueMap,
          urdu_map: state.noorMap,
          language: state.language,
          urdu_help: state.urduHelp,
          rsvp: {
            whatsapp: cleanPhone(state.rsvpWhatsApp),
            email: state.rsvpEmail || null,
            reply_by: state.replyBy || null,
            ask_guests: Boolean(state.askGuests),
            ask_needs: Boolean(state.askNeeds),
            ask_contact: Boolean(state.askContact)
          },
          music: state.music,
          photos_whatsapp: Boolean(state.photosWhatsApp),
          notes: state.notes,
          payment: {
            tid: (state.tid || '').trim(),
            screenshot_name: state.paymentScreenshotName || '',
            screenshot_data: state.paymentScreenshot || null,
            advance_percent: 50
          }
        }
      },
      delivery: { express: Boolean(state.express) }
    };
  }
  async function sendOrder() {
    if (!validateOrderState()) return;
    const button = $('#ord-continue');
    const summary = $('#ord-step-three-error') || $('#ord-error-summary');
    const localMessage = buildOrderMessage();
    const showError = message => {
      if (!summary) return;
      summary.textContent = message;
      summary.hidden = false;
      const fallback = text('a', 'Send on WhatsApp instead (not saved)', 'ord-copy');
      fallback.href = `https://wa.me/${DI.site.phone}?text=${encodeURIComponent(localMessage)}`;
      fallback.target = '_blank';
      fallback.rel = 'noopener';
      summary.append(document.createTextNode(' '), fallback);
    };

    if (!state.tid || !state.tid.trim()) {
      showError('Please enter your Transaction ID (TID) for the 50% advance payment.');
      $('#ord-tid')?.focus();
      return;
    }
    if (!state.paymentScreenshot) {
      showError('Please attach the transaction screenshot of your 50% advance payment.');
      $('#ord-screenshot')?.focus();
      return;
    }

    if (!DI.orders || typeof DI.orders.createOrder !== 'function') {
      showError(DI.supabaseError || 'Online order saving is not configured. You can send this order by WhatsApp instead (this order will NOT be saved).');
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving order…';
    if (summary) { summary.textContent = ''; summary.hidden = true; }

    try {
      const created = await DI.orders.createOrder(buildServerPayload());
      const order = Array.isArray(created) ? created[0] : created;
      if (!order || !order.public_id) {
        throw new Error('The order service returned an unexpected response. Please retry or contact us on WhatsApp.');
      }

      state.serverOrder = order;
      state.paymentSubmitted = false;
      state.paymentError = '';
      if (order.access_token && typeof DI.orders.submitPaymentReference === 'function') {
        button.textContent = 'Submitting payment proof…';
        const advanceMinor = Math.max(0, Math.round(Number(order.total_minor || 0) * 0.5));
        try {
          await DI.orders.submitPaymentReference(order.access_token, 'other', state.tid.trim(), advanceMinor);
          state.paymentSubmitted = true;
        } catch (paymentError) {
          console.error('[Digital Invitations] submit payment reference failed', paymentError);
          state.paymentError = paymentError && paymentError.message ? paymentError.message : 'Payment proof could not be submitted.';
        }
      } else {
        state.paymentError = 'Payment proof submission is unavailable.';
      }

      state.sent = true;
      if (state.paymentSubmitted) {
        try { localStorage.removeItem(storageKey); } catch (error) {}
      } else {
        saveDraftImmediate();
      }
      state.step = 4;
      render();
      focusStep();
    } catch (error) {
      console.error('[Digital Invitations] create order failed', {
        code: error && error.code,
        message: error && error.message,
        details: error && error.details,
        hint: error && error.hint,
        error
      });

      let userMsg = 'We could not save your order at this time. Your details are preserved; please retry.';
      const errMsg = (error && error.message) || '';
      if (/rate limit/i.test(errMsg)) {
        userMsg = 'Too many order attempts for this WhatsApp number in the last hour. Please try again later or contact us on WhatsApp.';
      } else if (/invalid whatsapp/i.test(errMsg)) {
        userMsg = 'Please enter a valid WhatsApp number with country code (7 to 15 digits).';
      } else if (/invalid customer name/i.test(errMsg)) {
        userMsg = 'Please provide a valid full name.';
      } else if (/fetch|network|connection/i.test(errMsg)) {
        userMsg = 'Network connection issue. Please check your internet connection and try again.';
      } else if (errMsg) {
        userMsg = `Could not save order: ${errMsg}`;
      }

      button.disabled = false;
      button.textContent = 'Place order →';
      showError(userMsg);
    }
  }
  function renderReview() {
    const root = $('#ord-step-three'); root.textContent = '';
    const errBox = text('div', '', 'ord-error-summary'); errBox.id = 'ord-step-three-error'; errBox.hidden = true; root.append(errBox);
    const quote = pricing.calculateQuote(state, catalog);
    const receipt = text('div', undefined, 'ord-receipt');
    const items = text('div', undefined, 'ord-receipt-items');
    quote.lines.forEach(line => {
      const prefix = line.type === 'express' ? '+' : '';
      const row = text('div', undefined, 'ord-receipt-line');
      row.append(text('span', line.label), text('strong', `${prefix}${money(line.amountUSD)}`)); items.append(row);
    });
    const total = text('div', undefined, 'ord-receipt-total');
    total.append(text('span', 'Total'), text('strong', money(quote.totalUSD)));
    
    const advanceRow = text('div', undefined, 'ord-receipt-line ord-advance-line');
    advanceRow.append(text('span', '50% Advance payable'), text('strong', money(quote.totalUSD * 0.5)));
    receipt.append(items, total, advanceRow);

    // Highlighted Bank Transfer Box
    const bankBox = text('div', undefined, 'ord-bank-box');
    bankBox.append(text('h4', 'Advance Payment Instructions', 'ord-bank-heading'));
    bankBox.append(text('p', 'In order to confirm your order you have to pay 50% of total amount in advance. Kindly transfer the amount in the following banks:', 'ord-bank-intro'));
    
    const banksGrid = text('div', undefined, 'ord-banks-grid');

    // HBL Card
    const hbl = text('div', undefined, 'ord-bank-card');
    hbl.append(text('span', 'HBL', 'ord-bank-name'));
    const hblUser = text('div', undefined, 'ord-bank-detail');
    hblUser.append(text('span', 'Username:'), text('strong', 'Abdurrahman'));
    const hblAcc = text('div', undefined, 'ord-bank-detail');
    hblAcc.append(text('span', 'Account number:'), text('strong', '01357902935703'));
    hbl.append(hblUser, hblAcc);

    // EasyPaisa Card
    const ep = text('div', undefined, 'ord-bank-card');
    ep.append(text('span', 'EasyPaisa', 'ord-bank-name'));
    const epUser = text('div', undefined, 'ord-bank-detail');
    epUser.append(text('span', 'Username:'), text('strong', 'Abdurrahman'));
    const epAcc = text('div', undefined, 'ord-bank-detail');
    epAcc.append(text('span', 'Account number:'), text('strong', '03042570503'));
    ep.append(epUser, epAcc);

    banksGrid.append(hbl, ep);
    bankBox.append(banksGrid);
    receipt.append(bankBox);

    // Transaction ID & Screenshot inputs (in place of 'Your choices')
    const paymentGroup = text('div', undefined, 'ord-payment-inputs-group');
    paymentGroup.append(text('h4', 'Payment Verification'));

    // TID input
    const tidField = text('div', undefined, 'ord-field');
    const tidLabel = text('label', undefined, 'ord-form-label');
    tidLabel.htmlFor = 'ord-tid';
    tidLabel.append(text('span', 'Transaction ID (TID) *'));
    const tidInput = document.createElement('input');
    tidInput.type = 'text';
    tidInput.id = 'ord-tid';
    tidInput.name = 'tid';
    tidInput.placeholder = 'e.g. 01357902935703 or TID from receipt';
    tidInput.value = state.tid || '';
    tidInput.required = true;
    tidInput.addEventListener('input', () => {
      state.tid = tidInput.value;
      saveDraft();
    });
    tidLabel.append(tidInput, text('small', 'Enter the reference or TID from your payment transfer receipt.', 'ord-field-note'));
    tidField.append(tidLabel);

    // Screenshot file upload input
    const fileField = text('div', undefined, 'ord-field');
    const fileLabel = text('label', undefined, 'ord-form-label');
    fileLabel.htmlFor = 'ord-screenshot';
    fileLabel.append(text('span', 'Transaction screenshot *'));
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'ord-screenshot';
    fileInput.name = 'screenshot';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.className = 'ord-file-input';
    const fileError = text('small', '', 'ord-field-error');
    fileError.id = 'ord-screenshot-error';
    fileError.setAttribute('aria-live', 'polite');

    const previewWrap = text('div', undefined, 'ord-screenshot-preview-wrap');
    if (state.paymentScreenshot) {
      const img = document.createElement('img');
      img.src = state.paymentScreenshot;
      img.alt = 'Transaction screenshot preview';
      img.className = 'ord-screenshot-thumb';
      const removeBtn = text('button', 'Remove screenshot', 'ord-remove-thumb-btn');
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', () => {
        state.paymentScreenshot = '';
        state.paymentScreenshotName = '';
        saveDraft();
        renderReview();
      });
      previewWrap.append(img, removeBtn);
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      fileError.textContent = '';
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        fileError.textContent = 'Please attach a JPG, PNG or WebP image.';
        fileInput.value = '';
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        fileError.textContent = 'Please attach an image smaller than 15 MB.';
        fileInput.value = '';
        return;
      }
      fileError.textContent = 'Preparing screenshot…';
      try {
        const data = await compressScreenshot(file);
        state.paymentScreenshot = data;
        state.paymentScreenshotName = file.name;
        saveDraft();
        renderReview();
      } catch (error) {
        console.error('[Digital Invitations] screenshot preparation failed', error);
        fileError.textContent = error.message || 'That image could not be read. Please choose another file.';
        fileInput.value = '';
      }
    });

    fileLabel.append(fileInput, text('small', 'Attach screenshot showing your 50% advance payment confirmation.', 'ord-field-note'), fileError);
    fileField.append(fileLabel, previewWrap);

    paymentGroup.append(tidField, fileField);
    receipt.append(paymentGroup);



    // Moved to very bottom: "Your order number will be created when you place the order"
    const reference = text('p', 'Your order number will be created when you place the order', 'ord-reference ord-reference-bottom');
    receipt.append(reference);

    root.append(receipt);
    $('#ord-continue').hidden = false; $('#ord-back').hidden = false;
  }
  function validateDetails() {
    const invalid = [];
    dialog.querySelectorAll('#step-2 input, #step-2 textarea, #step-2 select').forEach(input => {
      if (input.name === 'website') return;
      const options = {required: ['groomName', 'brideName', 'tagline', 'weddingDate', 'startTime', 'venueName', 'cityCountry', 'fullName', 'contactWhatsApp'].includes(input.name) || input.name.endsWith('.date') || input.name.endsWith('.time') || input.name.endsWith('.venue') || input.name.endsWith('.city'), phone: ['contactWhatsApp', 'rsvpWhatsApp'].includes(input.name), email: ['email', 'rsvpEmail'].includes(input.name), https: ['venueMap', 'noorMap'].includes(input.name) || input.name.endsWith('.map')};
      if (!validateField(input, options)) invalid.push(input);
    });
    const honeypot = dialog.querySelector('#step-2 [name="website"]');
    const rsvpFields = [$('#ord-rsvpWhatsApp'), $('#ord-rsvpEmail')];
    if (!state.rsvpWhatsApp && !state.rsvpEmail) rsvpFields.forEach(input => { if (!validateField(input, {required: true})) invalid.push(input); });
    const summary = $('#ord-error-summary'); summary.textContent = invalid.length ? `${invalid.length} field${invalid.length === 1 ? '' : 's'} need attention.` : '';
    if (honeypot && honeypot.value) { summary.textContent = 'Please leave the hidden website field empty.'; return false; }
    if (invalid[0]) { invalid[0].focus(); return false; }
    return true;
  }
  function render() {
    $('#ord-title').textContent = catalog.copy.title; $('#ord-summary').textContent = catalog.copy.templateTitle;
    const currencySelect = $('#ord-currency'); if (currencySelect) currencySelect.value = state.currency;
    
    renderStepOne();
    renderDetails();
    if (state.step === 3) renderReview();
    if (state.step === 4 && state.serverOrder) renderThanks(state.serverOrder);
    updateTotal();

    const steps = dialog.querySelectorAll('.ord-step');
    steps.forEach(step => {
      const active = Number(step.dataset.step) === state.step;
      step.hidden = !active;
      step.classList.toggle('is-active', active);
    });

    $('#ord-step-label').textContent = `Step ${state.step} of 4`;
    $('#ord-progress-fill').style.transform = `scaleX(${state.step / 4})`;

    const footer = dialog.querySelector('.ord-footer');
    const continueBtn = $('#ord-continue');
    const backBtn = $('#ord-back');

    if (state.step === 4) {
      if (footer) { footer.hidden = true; footer.style.display = 'none'; }
      if (continueBtn) { continueBtn.hidden = true; continueBtn.style.display = 'none'; }
      if (backBtn) { backBtn.hidden = true; backBtn.style.display = 'none'; }
    } else {
      if (footer) { footer.hidden = false; footer.style.display = ''; }
      if (backBtn) {
        backBtn.hidden = state.step === 1;
        backBtn.style.display = state.step === 1 ? 'none' : '';
      }
      if (continueBtn) {
        continueBtn.hidden = false;
        continueBtn.style.display = '';
        continueBtn.textContent = state.step === 3 ? 'Place order →' : 'Continue →';
      }
    }
  }
  function resetBodyScroll() {
    dialog.scrollTop = 0;
    const bodyEl = dialog.querySelector('.ord-body');
    if (bodyEl) bodyEl.scrollTop = 0;
  }
  function focusStep() {
    $(`#step-${state.step}-title`)?.focus({preventScroll: true});
    resetBodyScroll();
  }
  function open(source, templateId) {
    if (dialog.open) return;
    opener = source || document.activeElement;
    loadDraft();
    if (templates.some(item => item.id === templateId)) state.templateId = templateId;
    state.step = 1;
    saveDraft();
    render();
    dialog.showModal();
    resetBodyScroll();
    document.body.classList.add('ord-open');
    history.replaceState(null, '', `#order?template=${encodeURIComponent(state.templateId)}`);
    focusStep();
  }
  function close() {
    if (dialog.open) dialog.close();
    document.body.classList.remove('ord-open');
    if (location.hash.startsWith('#order')) history.replaceState(null, '', location.pathname + location.search);
    if (opener?.focus) opener.focus();
  }
  function openFromHash() {
    if (!location.hash.startsWith('#order') || dialog.open) return;
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    open(null, params.get('template'));
  }
  document.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); open(button, button.dataset.templateId); }));
  $('#ord-close').addEventListener('click', close); $('#ord-back').addEventListener('click', () => { state.step = Math.max(1, state.step - 1); saveDraft(); render(); focusStep(); });
  $('#ord-continue').addEventListener('click', () => {
    if (state.step === 2 && !validateDetails()) return;
    if (state.step === 3) { sendOrder(); return; }
    state.step = Math.min(3, state.step + 1); saveDraft(); render(); focusStep();
  });
  $('#ord-currency').addEventListener('change', event => { state.currency = event.target.value; saveDraft(); render(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); }); dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  window.addEventListener('hashchange', openFromHash);
  loadDraft(); render(); openFromHash();
}());
