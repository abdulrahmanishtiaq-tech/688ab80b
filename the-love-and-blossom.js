/* =====================================================================
   A. CONFIG — the one place to edit
   ===================================================================== */
const weddingConfig = {
  couple: { partnerOne: "Eesha", partnerTwo: "Abdurrahman" },
  timezone: "Asia/Karachi",
  rsvp: { whatsapp: "" },
  copy: {
    welcomeKicker: "Two Hearts, One Beautiful Beginning",
    welcomeInvite: "Together with their families,<br>we joyfully invite you to celebrate<br>the beginning of their forever.",
    swipeHint: "Swipe to explore the celebrations",
    countdownTitle: "Counting Down to Our Forever",
    countdownDone: "The celebrations have begun. Thank you for being part of our story.",
    saveTitle: "Save the Dates",
    saveText: "Keep every special moment close. Add our celebrations to your calendar.",
    finaleLine: "Your presence will mean the world to us.",
    finaleLove: "With love,",
    finaleFamilies: "and their families",
    replay: "Replay Invitation"
  },
  events: [
    { id:"mehndi", short:"Mehndi", title:"Mehndi Night", start:"2026-12-29T19:00:00", end:"2026-12-29T22:30:00", venue:"Noor Mahal, Bahawalpur, Pakistan", art:"assets/love-blossom/mehndi.png", message:"An evening of colour, laughter, music, and beautiful memories." },
    { id:"nikkah", short:"Nikkah", title:"Nikkah Ceremony", start:"2026-12-30T11:00:00", end:"2026-12-30T13:30:00", venue:"Noor Mahal, Bahawalpur, Pakistan", art:"assets/love-blossom/baraat.png", message:"Before Allah and our loved ones, we celebrate the beginning of a blessed journey together." },
    { id:"walima", short:"Walima", title:"Walima Reception", start:"2026-12-31T19:00:00", end:"2026-12-31T22:30:00", venue:"Noor Mahal, Bahawalpur, Pakistan", art:"assets/love-blossom/waleema.png", message:"With grateful hearts, we invite you to join us for an evening of joy and the beginning of a beautiful new chapter." }
  ],
  /* the celebratory track — starts on the tap that opens the card */
  music: { startAt: 0, fadeIn: 1.5, loopFade: 1.5, volume: 0.9 }
};

/* =====================================================================
   B. HELPERS
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cfg = weddingConfig, TZ = cfg.timezone;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const coupleText = `${cfg.couple.partnerOne} & ${cfg.couple.partnerTwo}`;
const coupleScript = `${cfg.couple.partnerOne} &amp; ${cfg.couple.partnerTwo}`;
const stage = $("#stage");
const video = $("#introVideo");
const deckEl = $("#deck");
const track = $("#track");
const skipBtn = $("#skip");

if (new URLSearchParams(location.search).get("debug") === "1") stage.classList.add("debug");

/* zoned dates: "2026-12-30T11:00:00" means 11:00 in cfg.timezone */
function zonedParts(utcMs, tz) {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year:"numeric", month:"numeric", day:"numeric",
    hour:"numeric", minute:"numeric", second:"numeric" }).formatToParts(new Date(utcMs))
    .forEach(x => { if (x.type !== "literal") p[x.type] = +x.value; });
  return p;
}
function zonedToUtc(local, tz) {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error("Bad date: " + local);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const offsetAt = t => { const p = zonedParts(t, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t; };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return t;
}
const events = cfg.events.map(e => ({ ...e, startMs: zonedToUtc(e.start, TZ), endMs: zonedToUtc(e.end, TZ) }));
function fmtDate(ms) {
  const o = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday:"long", day:"numeric", month:"long", year:"numeric" })
    .formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
  return `${o.weekday}, ${o.day} ${o.month} ${o.year}`;
}
const fmtTime = ms => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour:"numeric", minute:"2-digit", hour12:true }).format(new Date(ms));
const fmtRange = e => `${fmtTime(e.startMs)} – ${fmtTime(e.endMs)}`;
const gcalStamp = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/* =====================================================================
   C. PAGES
   ===================================================================== */
let r = 0;
const rv = (extra = "") => `class="reveal ${extra}" style="--i:${r++}"`;
const dv = (n, w) => `<span class="dv reveal" style="--i:${r++};--dw:${w}"><img class="dv-img" data-src="assets/love-blossom/div-${n}.png" alt="" aria-hidden="true"><svg class="dv-svg" viewBox="0 0 200 16" aria-hidden="true"><use href="#divider"></use></svg></span>`;

function welcomePanel() {
  r = 0; const c = cfg.copy;
  return `<section class="panel panel-welcome" aria-label="Welcome">
    <img class="w-bism reveal" style="--i:${r++}" src="assets/love-blossom/bismillah.png" alt="Bismillah — In the name of Allah, the Most Compassionate, the Most Merciful" decoding="async">
    <div class="w-frame reveal" style="--i:${r++}"><img class="w-art" src="assets/love-blossom/couple-swing.png" alt="" decoding="async"></div>
    <p ${rv("kicker")}>${c.welcomeKicker}</p>
    <h1 ${rv("names")}><span class="nm nm1">${cfg.couple.partnerOne}</span><span class="amp">&amp;</span><span class="nm nm2">${cfg.couple.partnerTwo}</span></h1>
    <p ${rv("body-text")}>${c.welcomeInvite}</p>
    <div ${rv("swipe-cue")} role="img" aria-label="${c.swipeHint}"><svg viewBox="0 0 46 14" aria-hidden="true"><path d="M1 7h36M31 2l6 5-6 5"/></svg></div>
  </section>`;
}

const DIV_FOR = { mehndi: 4, nikkah: 5, walima: 6 };
function eventPanel(e) {
  r = 0;
  const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(e.venue);
  return `<section class="panel panel-event" aria-label="${esc(e.title)}">
    <h2 ${rv("title")}>${esc(e.title)}</h2>
    <p ${rv("couple")}>${coupleScript}</p>
    <img ${rv("event-art")} src="${e.art}" alt="" decoding="async">
    ${dv(DIV_FOR[e.id], 40)}
    <p ${rv("date")}>${fmtDate(e.startMs)}</p>
    <p ${rv("time")}>${fmtRange(e)}</p>
    <div ${rv("kv")}><span class="k">Venue</span><span class="v">${esc(e.venue)}</span></div>
    <div ${rv("actions")}>
      <button class="link-btn" type="button" data-ics="${e.id}">Add to Calendar</button>
      <a class="link-btn" href="${maps}" target="_blank" rel="noopener">Directions</a>
    </div>
  </section>`;
}

function countPanel() {
  r = 0; const c = cfg.copy;
  const cells = ["Days","Hours","Minutes","Seconds"].map(l =>
    `<div class="cd"><strong data-u="${l.toLowerCase()}">00</strong><small>${l}</small></div>`).join("");
  return `<section class="panel panel-count" aria-label="Countdown and calendar">
    <h2 ${rv("title-sm")}>${c.countdownTitle}</h2>
    <div ${rv("next")} id="nextBox"><b id="nextTitle"></b><span id="nextDate"></span></div>
    <div ${rv("countdown")} id="countdown" role="timer" aria-live="off" aria-label="Time until the Nikkah ceremony">${cells}</div>
    <p class="finished" id="finished" hidden>${c.countdownDone}</p>
    ${dv(1, 44)}
    <h3 ${rv("h-sm")}>${c.saveTitle}</h3>
    <p ${rv("body-text")}>${c.saveText}</p>
    <button ${rv("cal-btn")} type="button" data-ics="all">Add to Calendar</button>
    ${dv(9, 34)}
  </section>`;
}

function rsvpPanel() {
  r = 0;
  return `<section class="panel panel-rsvp" aria-label="RSVP">
    <h2 ${rv("rsvp-title")}>RSVP</h2>
    <p ${rv("ur rsvp-ur-t")} lang="ur" dir="rtl">جوابِ دعوت</p>
    ${dv(7, 44)}
    <button ${rv("wax wax-photo")} id="rsvpSeal" type="button" aria-label="Open the RSVP form"><img src="assets/love-blossom/seal.png" alt="" decoding="async"></button>
    <p ${rv("rsvp-hint")}>Tap the seal to RSVP</p>
    <p ${rv("ur rsvp-hint-ur")} lang="ur" dir="rtl">جواب دینے کے لیے مہر پر ٹیپ کریں</p>
  </section>`;
}

function finalePanel() {
  r = 0; const c = cfg.copy;
  return `<section class="panel panel-final" aria-label="Thank you">
    <p ${rv("fin-line")}>${c.finaleLine}</p>
    ${dv(8, 46)}
    <p ${rv("fin-love")}>${c.finaleLove}</p>
    <div ${rv("fin-names")}><span class="sc sc1">${cfg.couple.partnerOne}</span><span class="amp">&amp;</span><span class="sc sc2">${cfg.couple.partnerTwo}</span></div>
    <p ${rv("fin-fam")}>${c.finaleFamilies}</p>
    <button ${rv("replay")} id="replayBtn" type="button">${c.replay}</button>
  </section>`;
}

track.innerHTML = welcomePanel() + events.map(eventPanel).join("") + countPanel() + rsvpPanel() + finalePanel();
const panels = $$(".panel", track);

/* optional artwork: pick files up when present, fall back to the gold SVG dividers */
$$(".dv-img").forEach(img => {
  const wrap = img.closest(".dv");
  img.addEventListener("load", () => { wrap.classList.add("loaded"); fitAll(); });
  img.addEventListener("error", () => { wrap.classList.add("failed"); img.remove(); });
  img.src = img.dataset.src;
});
$$(".w-bism, .w-art, .event-art").forEach(img => {
  const done = () => fitAll();
  if (img.complete && img.naturalWidth) done(); else img.addEventListener("load", done);
});

/* =====================================================================
   D. AUTO-FIT — shrink --fit until each page sits inside the beige area
   ===================================================================== */
function fitPanel(p) {
  const avail = p.clientHeight;
  if (!avail) return;
  const set = f => p.style.setProperty("--fit", String(f));
  const frame = p.querySelector(".w-frame");
  const art = p.querySelector(".event-art");
  if (frame) frame.style.width = "";
  if (art) art.style.maxHeight = "";
  set(1);
  if (p.scrollHeight > avail) {
    let lo = 0.72, hi = 1, best = 0.72;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      set(mid);
      if (p.scrollHeight <= avail) { best = mid; lo = mid; } else { hi = mid; }
    }
    set(best.toFixed(3));
  }
  /* at the fit floor, shrink the illustration rather than clip text */
  if (frame && p.scrollHeight > avail) {
    let guard = 0;
    while (p.scrollHeight > avail && guard++ < 60) {
      const w = frame.getBoundingClientRect().width;
      if (w <= 40) break;
      frame.style.width = w - 2 + "px";
    }
  }
  if (art && p.scrollHeight > avail) {
    let h = art.getBoundingClientRect().height;
    while (p.scrollHeight > avail && h > 48) {
      h -= 2;
      art.style.maxHeight = h + "px";
    }
  }
  p.scrollTop = 0;
}
let fitQueued = false;
function capWidths(p) {
  const strict = $$(".names .nm, .fin-names .sc", p);
  if (!strict.length) return;
  strict.forEach(el => { el.style.fontSize = ""; });
  const inset = parseFloat(getComputedStyle(p).paddingLeft) || 0;
  const avail = p.clientWidth - inset * 2;
  strict.forEach(el => {
    const w = el.getBoundingClientRect().width;
    if (w > avail) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = Math.max(7, Math.floor(fs * avail / w * 99.5) / 100) + "px";
    }
  });
}
function fitAll() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => {
    fitQueued = false;
    panels.forEach(fitPanel);
    panels.forEach(capWidths);
  });
}
fitAll();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll).catch(() => {});

/* =====================================================================
   E. CALENDAR (.ics)
   ===================================================================== */
const icsEscape = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function foldLine(line) {
  const enc = new TextEncoder(); let out = "", cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { out += cur + "\r\n "; cur = ""; bytes = 1; }
    cur += ch; bytes += b;
  }
  return out + cur;
}
function vevent(e) {
  const desc = `${coupleText}\n${e.message}`;
  return ["BEGIN:VEVENT",
    `UID:${`${cfg.couple.partnerOne}-${cfg.couple.partnerTwo}-${e.id}-${gcalStamp(e.startMs)}`.toLowerCase().replace(/[^a-z0-9-]/g, "")}@wedding-invitation`,
    `DTSTAMP:${gcalStamp(Date.now())}`, `DTSTART:${gcalStamp(e.startMs)}`, `DTEND:${gcalStamp(e.endMs)}`,
    `SUMMARY:${icsEscape(`${e.title} - ${coupleText}`)}`, `LOCATION:${icsEscape(e.venue)}`, `DESCRIPTION:${icsEscape(desc)}`,
    "STATUS:CONFIRMED", "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title + " is tomorrow")}`, "END:VALARM", "END:VEVENT"];
}
const buildICS = list => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wedding Invitation//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ...list.flatMap(vevent), "END:VCALENDAR"].map(foldLine).join("\r\n") + "\r\n";
function downloadICS(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const toast = (() => {
  const el = $("#toast"); let t;
  return msg => { el.textContent = msg; el.classList.add("show"); clearTimeout(t); t = setTimeout(() => el.classList.remove("show"), 3600); };
})();
const baseName = `${cfg.couple.partnerOne}-${cfg.couple.partnerTwo}`;
track.addEventListener("click", e => {
  const b = e.target.closest("[data-ics]"); if (!b) return;
  const list = b.dataset.ics === "all" ? events : [events.find(x => x.id === b.dataset.ics)];
  const name = b.dataset.ics === "all" ? "Wedding-Events" : list[0].short;
  downloadICS(`${baseName}-${name}.ics`, buildICS(list));
  toast("Calendar file downloaded. Open it to add the date to your calendar.");
});

/* =====================================================================
   F. RSVP — full-width bottom sheet
   ===================================================================== */
(function buildSheet() {
  const shortDay = ms => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(ms));
  const chips = events.map(e => `<label class="chip"><input type="checkbox" name="ev" value="${esc(e.id)}"><span>${esc(e.short)}<small>${shortDay(e.startMs)}</small></span></label>`).join("");
  $("#sheetBody").innerHTML = `<form class="rsvp-form" id="rsvpForm" novalidate autocomplete="off">
    <div class="f"><label class="flab" for="rfName"><span>Guest name</span><span class="ur" lang="ur" dir="rtl">مہمان کا نام</span></label><input class="in-x" id="rfName" name="name" type="text" autocomplete="name"></div>
    <div class="f"><span class="flab"><span>Attendance</span><span class="ur" lang="ur" dir="rtl">شرکت</span></span>
      <div class="chips c2">
        <label class="chip"><input type="radio" name="att" value="yes"><span>Accepts<small>with pleasure</small></span></label>
        <label class="chip"><input type="radio" name="att" value="no"><span>Regretfully<small>declines</small></span></label>
      </div></div>
    <div class="f"><span class="flab"><span>Events attending</span><span class="ur" lang="ur" dir="rtl">تقریبات</span></span><div class="chips c3">${chips}</div></div>
    <div class="two">
      <div class="f"><label class="flab" for="rfGuests"><span>Guests</span><span class="ur" lang="ur" dir="rtl">تعداد</span></label><input class="in-x" id="rfGuests" name="guests" type="number" min="1" max="20" value="1" inputmode="numeric"></div>
      <div class="f"><label class="flab" for="rfPhone"><span>Phone <em>(optional)</em></span><span class="ur" lang="ur" dir="rtl">فون</span></label><input class="in-x" id="rfPhone" name="phone" type="tel" autocomplete="tel"></div>
    </div>
    <div class="f"><label class="flab" for="rfMsg"><span>Message to the couple <em>(optional)</em></span><span class="ur" lang="ur" dir="rtl">پیغام</span></label><textarea class="in-x" id="rfMsg" name="msg" rows="2"></textarea></div>
    <button class="send" type="submit">Send RSVP</button>
  </form>`;

  const sheet = $("#rsvpSheet"), scrim = $("#scrim"), form = $("#rsvpForm");
  const openSheet = () => {
    sheet.classList.add("open"); scrim.classList.add("open");
    sheet.setAttribute("aria-hidden", "false"); sheet.inert = false;
    deckEl.inert = true;
    setTimeout(() => $("#rfName").focus(), 380);
  };
  const closeSheet = (restore = true) => {
    sheet.classList.remove("open"); scrim.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true"); sheet.inert = true;
    deckEl.inert = false;
    if (restore) $("#rsvpSeal").focus();
  };
  $("#rsvpSeal").addEventListener("click", openSheet);
  $("#sheetClose").addEventListener("click", () => closeSheet());
  scrim.addEventListener("click", () => closeSheet());
  addEventListener("keydown", e => { if (e.key === "Escape" && sheet.classList.contains("open")) closeSheet(); });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(form), name = (fd.get("name") || "").trim(), att = fd.get("att"), evs = fd.getAll("ev");
    if (!name) { toast("Please enter your name."); return; }
    if (!att) { toast("Please choose whether you can attend."); return; }
    if (att === "yes" && !evs.length) { toast("Please select the events you will attend."); return; }
    const titles = evs.map(id => (events.find(x => x.id === id) || {}).short).filter(Boolean).join(", ");
    const lines = [`RSVP - ${coupleText}`, `Name: ${name}`, `Response: ${att === "yes" ? "Accepts with pleasure" : "Regretfully declines"}`];
    if (att === "yes") lines.push(`Events: ${titles}`, `Guests: ${fd.get("guests") || 1}`);
    if ((fd.get("phone") || "").trim()) lines.push(`Phone: ${fd.get("phone").trim()}`);
    if ((fd.get("msg") || "").trim()) lines.push(`Message: ${fd.get("msg").trim()}`);
    const num = String((cfg.rsvp && cfg.rsvp.whatsapp) || "").replace(/\D/g, "");
    const url = `https://wa.me/${num}?text=${encodeURIComponent(lines.join("\n"))}`;
    toast("Opening WhatsApp to send your RSVP.");
    const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url;
    closeSheet(false);
  });
})();

/* =====================================================================
   G. COUNTDOWN
   ===================================================================== */
const nikkah = events.find(e => e.id === "nikkah");
let lastDay = null;
function renderCountdown() {
  const now = Date.now(), ev = nikkah && nikkah.startMs > now ? nikkah : null;
  const box = $("#nextBox"), cd = $("#countdown"), fin = $("#finished"), live = $("#cdLive");
  if (!ev) {
    if (box) box.hidden = true;
    if (cd) cd.hidden = true;
    if (fin) fin.hidden = false;
    return;
  }
  if (box) { box.hidden = false; cd.hidden = false; fin.hidden = true; }
  $("#nextTitle").textContent = ev.title;
  $("#nextDate").textContent = fmtDate(ev.startMs);
  let s = Math.max(0, Math.floor((ev.startMs - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const v = { days: d, hours: h, minutes: m, seconds: s };
  $$("[data-u]", cd).forEach(el => { const t = pad(v[el.dataset.u]); if (el.textContent !== t) el.textContent = t; });
  if (live && lastDay !== d) { live.textContent = `${d} day${d === 1 ? "" : "s"} until the Nikkah ceremony`; lastDay = d; }
}
renderCountdown();
setInterval(renderCountdown, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderCountdown(); });

/* =====================================================================
   H. DECK NAVIGATION
   ===================================================================== */
const viewport = deckEl, prevBtn = $("#prev"), nextBtn = $("#next"), dotsEl = $("#dots");
let idx = 0, drag = null, wheelLock = 0, suppressClick = false, deckLive = false;
dotsEl.innerHTML = panels.map((p, i) => `<button class="dot" type="button" data-i="${i}" aria-label="Go to page ${i + 1} of ${panels.length}"><i></i></button>`).join("");
const dots = $$(".dot", dotsEl);

function paint(dx = 0) {
  const w = viewport.clientWidth || 1;
  track.style.transform = `translate3d(calc(${-idx * 100}% + ${dx}px),0,0)`;
  panels.forEach((p, i) => {
    const d = Math.min(1, Math.abs(i - idx + dx / w));
    p.style.opacity = String(Math.max(0, 1 - d * 1.15));
  });
}
function setActive() {
  panels.forEach((p, i) => {
    const on = deckLive && i === idx;
    p.classList.toggle("is-active", on);
    p.setAttribute("aria-hidden", on ? "false" : "true");
    if (on) p.removeAttribute("inert"); else p.setAttribute("inert", "");
    p.setAttribute("role", "group");
    p.setAttribute("aria-roledescription", "slide");
    p.setAttribute("aria-label", `${i + 1} of ${panels.length}`);
  });
  dots.forEach((d, i) => d.setAttribute("aria-current", i === idx ? "true" : "false"));
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === panels.length - 1;
}
const sheenEl = $(".sheen");
function sweepSheen() {
  if (reduceMotion) return;
  sheenEl.classList.remove("sweep"); void sheenEl.offsetWidth; sheenEl.classList.add("sweep");
}
sheenEl.addEventListener("animationend", e => { if (e.animationName === "sheenQuick") sheenEl.classList.remove("sweep"); });
function go(i) {
  const before = idx;
  idx = Math.max(0, Math.min(panels.length - 1, i));
  setActive(); paint(0);
  if (idx !== before && stage.classList.contains("is-open")) sweepSheen();
}
prevBtn.onclick = () => go(idx - 1);
nextBtn.onclick = () => go(idx + 1);
dots.forEach(d => d.onclick = () => go(+d.dataset.i));

const skipDrag = el => !!(el && el.closest && el.closest("input,textarea,select,button,a,.sheet,.scrim,.nav,.sound"));
const canNav = () => stage.classList.contains("is-open") && !$("#rsvpSheet").classList.contains("open");
function dragStart(x, y) { drag = { x, y, dx: 0, on: false, lastX: x, lastT: performance.now(), v: 0 }; }
function dragMove(x, y, ev) {
  if (!drag) return;
  const dx = x - drag.x, dy = y - drag.y;
  if (!drag.on) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.1) return;
    drag.on = true; track.classList.add("dragging");
  }
  if (ev && ev.cancelable) ev.preventDefault();
  const now = performance.now();
  drag.v = (x - drag.lastX) / Math.max(1, now - drag.lastT);
  drag.lastX = x; drag.lastT = now;
  const atEdge = (idx === 0 && dx > 0) || (idx === panels.length - 1 && dx < 0);
  drag.dx = atEdge ? dx * 0.3 : dx;
  paint(drag.dx);
}
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  track.classList.remove("dragging");
  if (!d.on) return;
  suppressClick = true; setTimeout(() => suppressClick = false, 60);
  const w = viewport.clientWidth, fast = Math.abs(d.v) > 0.4;
  let to = idx;
  if (d.dx < -w * 0.16 || (fast && d.v < 0)) to = idx + 1;
  else if (d.dx > w * 0.16 || (fast && d.v > 0)) to = idx - 1;
  go(to); if (to === idx) paint(0);
}
stage.addEventListener("touchstart", e => {
  if (!canNav() || e.touches.length !== 1 || skipDrag(e.target)) { drag = null; return; }
  dragStart(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
stage.addEventListener("touchmove", e => {
  if (!drag || e.touches.length !== 1) return;
  dragMove(e.touches[0].clientX, e.touches[0].clientY, e);
}, { passive: false });
stage.addEventListener("touchend", endDrag);
stage.addEventListener("touchcancel", endDrag);
stage.addEventListener("pointerdown", e => {
  if (!canNav() || e.pointerType === "touch" || (e.pointerType === "mouse" && e.button !== 0) || skipDrag(e.target)) return;
  dragStart(e.clientX, e.clientY);
});
stage.addEventListener("pointermove", e => {
  if (e.pointerType === "touch" || !drag) return;
  dragMove(e.clientX, e.clientY, e);
  if (drag && drag.on) { try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
});
stage.addEventListener("pointerup", e => { if (e.pointerType !== "touch") endDrag(); });
stage.addEventListener("pointercancel", e => { if (e.pointerType !== "touch") endDrag(); });
stage.addEventListener("click", e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);
stage.addEventListener("wheel", e => {
  if (!canNav()) return;
  if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 24) return;
  e.preventDefault();
  const now = performance.now(); if (now < wheelLock) return;
  wheelLock = now + 700;
  go(idx + (e.deltaX > 0 ? 1 : -1));
}, { passive: false });
addEventListener("keydown", e => {
  if (!stage.classList.contains("is-open") || e.target.closest("input,textarea,select")) return;
  if ($("#rsvpSheet").classList.contains("open")) return;
  if (e.key === "ArrowRight") go(idx + 1);
  else if (e.key === "ArrowLeft") go(idx - 1);
});
addEventListener("resize", () => { paint(0); fitAll(); });
setActive();
paint(0);

/* =====================================================================
   I. MUSIC — optional assets/love-blossom/love-and-blossom.mp3
   ===================================================================== */
const Music = (() => {
  const el = $("#music"), btn = $("#sound"), m = cfg.music;
  let available = false, started = false, muted = false, pending = false;
  let ctx = null, gain = null, fadeRaf = 0, fadingOut = false;

  btn.hidden = true;
  el.src = "assets/love-blossom/love-and-blossom.mp3";
  el.addEventListener("canplay", () => {
    available = true; btn.hidden = false;
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Mute music");
    if (pending) start();
  });
  el.addEventListener("error", () => { available = false; btn.hidden = true; });

  function setLevel(v) {
    v = Math.max(0, Math.min(1, v));
    if (gain) gain.gain.value = v; else el.volume = v;
  }
  function fadeTo(target, seconds) {
    cancelAnimationFrame(fadeRaf);
    const from = gain ? gain.gain.value : el.volume;
    const t0 = performance.now(), dur = Math.max(60, seconds * 1000);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      setLevel(from + (target - from) * k);
      if (k < 1) fadeRaf = requestAnimationFrame(step);
    };
    fadeRaf = requestAnimationFrame(step);
  }
  function getCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      gain = ctx.createGain(); gain.gain.value = 0;
      gain.connect(ctx.destination);
    } catch (_) { ctx = null; gain = null; }
    return ctx;
  }
  function start() {
    if (started || !available) return;
    started = true; pending = false;
    if (getCtx()) {
      try {
        const src = ctx.createMediaElementSource(el);
        src.connect(gain);
      } catch (_) { /* source already bound */ }
      if (ctx.state === "suspended") ctx.resume();
    }
    try { el.currentTime = m.startAt || 0; } catch (_) {}
    if (!gain) el.volume = 0;
    el.play().catch(() => {});
    fadeTo(m.volume, m.fadeIn);
  }
  function begin() { if (started) return; if (!available) { pending = true; return; } start(); }
  function setMuted(v) {
    muted = v;
    btn.setAttribute("aria-pressed", String(!v));
    btn.setAttribute("aria-label", v ? "Unmute music" : "Mute music");
    if (!started) return;
    if (v) { fadeTo(0, 0.35); setTimeout(() => { if (muted) el.pause(); }, 380); }
    else { el.play().catch(() => {}); fadeTo(m.volume, 0.6); }
  }
  btn.addEventListener("click", () => setMuted(!muted));
  el.addEventListener("timeupdate", () => {
    if (!started || muted || !el.duration) return;
    const remain = el.duration - el.currentTime;
    if (remain < m.loopFade && !fadingOut) { fadingOut = true; fadeTo(0, Math.max(0.2, remain)); }
  });
  el.addEventListener("ended", () => {
    fadingOut = false;
    if (!started || muted) return;
    try { el.currentTime = m.startAt || 0; } catch (_) {}
    el.play().catch(() => {});
    fadeTo(m.volume, m.loopFade);
  });
  document.addEventListener("visibilitychange", () => {
    if (!started || muted) return;
    if (document.hidden) { el.pause(); cancelAnimationFrame(fadeRaf); }
    else { el.play().catch(() => {}); fadeTo(m.volume, 1); }
  });
  return { begin };
})();

/* =====================================================================
   J. INTRO — poster, glow, tap, skip, crossfade
   ===================================================================== */
let introStarted = false, introFinished = false, crossfading = false, monitoring = false;
let watchdog = 0, skipTimer = 0;

function showSkip() {
  if (introFinished || reduceMotion) return;
  skipBtn.hidden = false;
}

function finishIntro() {
  if (crossfading || introFinished) return;
  crossfading = true; introFinished = true;
  clearTimeout(watchdog); clearTimeout(skipTimer);
  skipBtn.hidden = true;
  $("#introHit").disabled = true;
  stage.classList.add("is-crossfade");
  setTimeout(() => stage.classList.add("is-deck-in"), reduceMotion ? 120 : 300);
  setTimeout(() => {
    try { video.pause(); } catch (_) {}
    video.hidden = true;
    stage.classList.add("is-open");
    stage.classList.remove("is-glimmer");
    deckLive = true;
    setActive();
    fitAll();
  }, reduceMotion ? 620 : 900);
}

function monitorVideo() {
  if (crossfading) return;
  const d = video.duration;
  if (video.ended) { finishIntro(); return; }
  if (isFinite(d) && d > 1 && video.currentTime >= d - 0.9) { finishIntro(); return; }
  requestAnimationFrame(monitorVideo);
}

function openIntro() {
  if (introStarted) return;
  introStarted = true;
  stage.classList.add("is-tapped");
  if (reduceMotion) { finishIntro(); return; }
  stage.classList.add("is-glimmer");
  setTimeout(() => stage.classList.remove("is-glimmer"), 520);
  Music.begin();
  const p = video.play();
  if (p && p.catch) {
    p.catch(() => {
      video.muted = true;
      const p2 = video.play();
      if (p2 && p2.catch) p2.catch(() => finishIntro());
    });
  }
  watchdog = setTimeout(() => { if (video.readyState < 2 || video.paused) finishIntro(); }, 3000);
}

video.addEventListener("playing", () => {
  clearTimeout(watchdog);
  if (!monitoring) { monitoring = true; requestAnimationFrame(monitorVideo); }
  clearTimeout(skipTimer);
  skipTimer = setTimeout(showSkip, 1500);
});
video.addEventListener("ended", finishIntro);
video.addEventListener("error", () => { if (introStarted) finishIntro(); });
$("#introHit").addEventListener("click", openIntro);
skipBtn.addEventListener("click", e => { e.stopPropagation(); finishIntro(); });

/* replay only the pages, never the intro */
$("#replayBtn").addEventListener("click", () => go(0));

/* =====================================================================
   K. PRELOAD — fade the stage in once the poster, fonts and card decoded
   ===================================================================== */
(function preload() {
  const settle = src => new Promise(res => {
    const im = new Image();
    im.onload = () => (im.decode ? im.decode().catch(() => {}).then(res) : res());
    im.onerror = res;
    im.src = src;
    if (im.complete && im.naturalWidth) im.onload();
  });
  const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  const all = Promise.all([
    settle("assets/love-blossom/intro-poster.jpg"),
    settle("assets/love-blossom/scroll-base.jpg"),
    settle("assets/love-blossom/bismillah.png"),
    settle("assets/love-blossom/couple-swing.png"),
    settle("assets/love-blossom/mehndi.png"),
    settle("assets/love-blossom/baraat.png"),
    settle("assets/love-blossom/waleema.png"),
    settle("assets/love-blossom/seal.png"),
    Promise.race([fonts, new Promise(r => setTimeout(r, 2500))])
  ]);
  Promise.race([all, new Promise(r => setTimeout(r, 9000))]).then(() => {
    requestAnimationFrame(() => { stage.classList.add("is-ready"); fitAll(); });
  });
})();
