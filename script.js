/* ===== settings ===== */
const site = (window.DI && window.DI.site) || {
  phone: "",
  phoneDisplay: "",
  email: "",
  demo: "invitation-demo/index.html",
};
const C = {
  phone: site.phone,
  demo: site.demo,
  logo: "" /* put your logo image here later */,
};
/* ==================== */
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  G = window.gsap,
  R = matchMedia("(prefers-reduced-motion:reduce)").matches,
  A = !!G && !!window.ScrollTrigger && !R,
  hov = matchMedia("(hover:hover) and (pointer:fine)").matches;
if (A) {
  G.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
}
const IMG = {
  seal: "assets/seal.webp",
  env: "assets/envelope.webp",
  pet: [
    "assets/petal-00.webp",
    "assets/petal-01.webp",
    "assets/petal-02.webp",
    "assets/petal-03.webp",
    "assets/petal-04.webp",
    "assets/petal-05.webp",
    "assets/petal-06.webp",
    "assets/petal-07.webp",
    "assets/petal-08.webp",
    "assets/petal-09.webp",
    "assets/petal-10.webp",
  ],
};
$("#lg").innerHTML = `<img src="${C.logo || IMG.seal}" alt="">`;
$$("[data-seal]").forEach((e) => (e.src = IMG.seal));
$$("[data-env]").forEach((e) => (e.src = IMG.env));
const EV = {
  wedding: {
    cap: "You’re invited",
    nm: "Ayesha & Ali",
    dt: "14 March 2027",
    k: "Animated digital invitations for weddings",
  },
  birthday: {
    cap: "Come celebrate",
    nm: "Sara turns 30",
    dt: "22 May 2027",
    k: "Animated digital invitations for birthdays",
  },
  baby: {
    cap: "A little one is on the way",
    nm: "Baby Noah",
    dt: "9 June 2027",
    k: "Animated digital invitations for baby showers",
  },
  corporate: {
    cap: "You’re cordially invited",
    nm: "Annual Summit",
    dt: "3 November 2027",
    k: "Animated digital invitations for corporate events",
  },
};
const vis = $("#vis"),
  hero = $("#top"),
  cb = $$(".cb"),
  ind2 = $(".ind2"),
  navOrder = $("#nav-order"),
  heroOrder = $("#hero-order"),
  rr = (a, b) => a + Math.random() * (b - a),
  cols = ["#ff7a66", "#ffc247", "#5fd0a7", "#6aa7ff", "#ff8fc3"];
let dirty = 0;
const mk = (g, h, c) => {
    const d = document.createElement("div");
    d.className = c;
    d.dataset.g = g;
    d.innerHTML = h;
    vis.append(d);
  },
  pst = (T) =>
    `--x:${rr(-4, 100)}%;--t:${T}s;--dl:-${rr(0, T)}s;--dx:${rr(-60, 60)}px;--w:${rr(3, 5.5)}s`,
  cloud = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="35" cy="38" r="18"/><circle cx="60" cy="28" r="22"/><circle cx="88" cy="38" r="17"/><rect x="30" y="38" width="62" height="17" rx="8"/></g>`,
  cloudSvg =
    '<svg viewBox="0 0 120 60"><g fill="#fff">' + cloud(0, 0, 1) + "</g></svg>";
function setNames(v) {
  const t = v.trim() || "Your names",
    b = $("#pn");
  b.textContent = "";
  t.split(/\s*&\s*/).forEach((s, i) => {
    if (i) {
      const a = document.createElement("i");
      a.textContent = "&";
      b.append(a);
    }
    const l = document.createElement("span");
    l.textContent = s;
    b.append(l);
  });
}
function setEv(i) {
  const k = cb[i].dataset.e,
    E = EV[k];
  hero.dataset.ev = k;
  vis.dataset.ev = k;
  cb.forEach((x, j) => x.setAttribute("aria-selected", j == i));
  ind2.style.width = cb[i].offsetWidth + "px";
  ind2.style.height = cb[i].offsetHeight + "px";
  ind2.style.left = cb[i].offsetLeft + "px";
  ind2.style.top = cb[i].offsetTop + "px";
  ind2.style.bottom = "auto";
  ind2.style.transform = "none";
  $$(".td,.pg").forEach((x) => x.classList.toggle("on", x.dataset.g === k));
  $("#cap").textContent = E.cap;
  $("#dt").textContent = E.dt;
  $("#kick").textContent = E.k;
  navOrder.dataset.event = k;
  if (heroOrder) heroOrder.dataset.event = k;
  if (!dirty) {
    const nmInput = $("#nm");
    if (nmInput) nmInput.value = E.nm;
    setNames(E.nm);
  }
}
if (!R) {
  mk(
    "wedding",
    Array.from(
      { length: 10 },
      (_, k) =>
        `<i class="pt" style="${pst(rr(11, 19))};--s:${rr(26, 46)}px"><img src="${IMG.pet[k % IMG.pet.length]}" alt=""></i>`,
    ).join(""),
    "pg on",
  );
  const bal = (c) =>
    `<svg viewBox="0 0 40 70"><ellipse cx="20" cy="22" rx="16" ry="20" fill="${c}"/><path d="M20 42l-3 5h6z" fill="${c}"/><path d="M20 47c-4 8 4 12 0 22" stroke="#8a6a5a" fill="none"/><ellipse cx="14" cy="14" rx="4" ry="6" fill="#fff" opacity=".35"/></svg>`;
  mk(
    "birthday",
    Array.from(
      { length: 22 },
      (_, k) =>
        `<i class="pt cf" style="${pst(rr(8, 15))};--s:${rr(6, 11)}px;--c:${cols[k % 5]}"></i>`,
    ).join("") +
      [0, 1, 2]
        .map(
          (k) =>
            `<i class="pt up" style="${pst(rr(12, 18))};--s:34px">${bal(cols[(k * 2) % 5])}</i>`,
        )
        .join(""),
    "pg",
  );
  mk(
    "baby",
    [
      [6, "12%", 70],
      [58, "4%", 86],
      [62, "52%", 64],
      [8, "58%", 74],
    ]
      .map(
        ([x, y, s], k) =>
          `<i class="cl" style="left:${x}%;top:${y};--s:${s}px;--t:${9 + k * 2}s;--dx:${k % 2 ? -26 : 26}px">${cloudSvg}</i>`,
      )
      .join("") +
      Array.from(
        { length: 10 },
        (_, k) =>
          `<i class="st" style="left:${rr(4, 94)}%;top:${rr(4, 90)}%;font-size:${rr(10, 20)}px;--t:${rr(1.5, 3.5)}s;animation-delay:-${rr(0, 3)}s">✦</i>`,
      ).join(""),
    "pg",
  );
  mk(
    "corporate",
    Array.from(
      { length: 14 },
      (_, k) =>
        `<i class="pt up ${k % 3 ? "dm" : "rg"}" style="${pst(rr(10, 18))};--s:${rr(8, 18)}px"></i>`,
    ).join(""),
    "pg",
  );
}
let bs =
  '<svg class="tds" viewBox="0 0 300 100"><path d="M0 8Q150 78 300 8" fill="none" stroke="#a9683f" stroke-width="1.2"/>';
for (let i = 0; i < 13; i++) {
  const t = (i + 0.5) / 13,
    x = 300 * t,
    y = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * 78 + t * t * 8 + 0.5;
  bs += `<path d="M${x - 9} ${y}L${x + 9} ${y}L${x} ${y + 24}Z" fill="${cols[i % 5]}"/>`;
}
mk("birthday", bs + "</svg>", "td");
mk(
  "baby",
  '<svg class="tds" viewBox="0 0 300 100"><g fill="#fff" opacity=".95">' +
    cloud(-8, 14, 0.95) +
    cloud(88, -4, 1.15) +
    cloud(190, 14, 0.95) +
    "</g></svg>",
  "td",
);
mk(
  "corporate",
  '<svg class="tds" viewBox="0 0 300 100"><g fill="none" stroke="#b8903f" stroke-width="1"><path d="M10 95A140 85 0 0 1 290 95"/><path d="M40 95A110 65 0 0 1 260 95" opacity=".6"/><path d="M70 95A80 45 0 0 1 230 95" opacity=".35"/></g><g fill="#b8903f"><path d="M150 4l5 8-5 8-5-8z"/><circle cx="12" cy="95" r="2.5"/><circle cx="288" cy="95" r="2.5"/></g></svg>',
  "td",
);
const nmInput = $("#nm");
if (nmInput) {
  nmInput.oninput = (e) => {
    dirty = 1;
    setNames(e.target.value);
  };
}
cb.forEach((b, i) => (b.onclick = () => setEv(i)));
setEv(0);
let resizeRaf = null;
function handleWindowResize() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const activeEvIdx = cb.findIndex((b) => b.getAttribute("aria-selected") == "true");
    if (activeEvIdx >= 0) setEv(activeEvIdx);
  });
}
document.fonts &&
  document.fonts.ready.then(() => {
    setEv(cb.findIndex((b) => b.getAttribute("aria-selected") == "true"));
    if (A) ScrollTrigger.refresh();
  });
addEventListener("resize", handleWindowResize, { passive: true });
$$("[data-demo]").forEach((a) => (a.href = C.demo));
$$("[data-wa]").forEach((a) => {
  a.href = C.phone
    ? `https://wa.me/${C.phone}?text=${encodeURIComponent(a.dataset.wa)}`
    : "#contact";
  if (C.phone) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
});
$$("[data-contact-whatsapp]").forEach((a) => {
  a.href = C.phone
    ? `https://wa.me/${C.phone}?text=${encodeURIComponent(a.dataset.wa || "Hello! I’d like a free preview of my invitation.")}`
    : "#contact";
  if (C.phone) {
    if (!a.querySelector("svg"))
      a.textContent = a.textContent || site.phoneDisplay || `+${C.phone}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else if (!a.querySelector("svg")) {
    a.textContent = a.textContent || "Contact us on WhatsApp";
  }
});
$$("[data-contact-email]").forEach((a) => {
  if (site.email) {
    a.href = `mailto:${site.email}?subject=${encodeURIComponent("Digital Invitations enquiry")}&body=${encodeURIComponent("Hello! I would like to ask about a digital invitation.")}`;
    if (a.querySelector("svg")) a.setAttribute("aria-label", `Email ${site.email}`);
    else a.textContent = site.email;
  } else if (!a.querySelector("svg")) {
    a.href = "#contact";
    a.textContent = "Email support";
  }
});
$$("[data-instagram]").forEach((a) => {
  a.href = site.instagram || "#contact";
  if (site.instagram) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
});
const activeDiscount = (quote) => quote.discountUSD > 0,
  money = (amount) => DI.pricing.formatMoney(amount, (DI.catalog && DI.catalog.currency) || "USD", DI.catalog),
  baseQuote = DI.pricing.calculateQuote({}, DI.catalog);
const launchBar = $("#launch-bar"),
  launchCopy = $("#launch-copy"),
  discount = DI.catalog.discount;
const template = DI.catalog.templates[0];
const templateQuote = DI.pricing.calculateQuote({templateId: template.id}, DI.catalog);
function renderTemplatePricing() {
  const setText = (selector, text) => {
    const element = $(selector);
    if (element) element.textContent = text;
  };
  setText("[data-template-badge]", DI.catalog.copy.offerBadge);
  setText("[data-template-title]", DI.catalog.copy.templateTitle);
  setText("[data-template-description]", DI.catalog.copy.templateDescription);
  setText("[data-template-price]", money(templateQuote.totalUSD));
  setText("[data-template-list-price]", money(templateQuote.listTotalUSD));
  setText("[data-template-discount]", discount.label);
  setText("[data-delivery-standard]", DI.catalog.delivery.standard);
  setText("[data-delivery-express]", DI.catalog.delivery.express);
  setText("[data-template-count]", `${DI.catalog.templates.length} template${DI.catalog.templates.length === 1 ? "" : "s"} to choose from`);
  const list = $("[data-template-included]");
  DI.catalog.alwaysIncluded.forEach(label => {
    const item = document.createElement("li");
    item.textContent = label;
    list.append(item);
  });
  const thumbnails = $("[data-template-thumbnails]");
  DI.catalog.templates.forEach(item => {
    const link = document.createElement("a");
    link.className = "template-thumb";
    link.href = "#order";
    link.dataset.order = "";
    link.dataset.templateId = item.id;
    link.setAttribute("aria-label", `Choose ${item.label}`);
    link.addEventListener("click", event => {
      event.preventDefault();
      const orderButton = document.querySelector(".template-card [data-order]");
      if (orderButton) orderButton.click();
    });
    const preview = document.createElement("div");
    preview.className = "pv";
    preview.dataset.videoMp4 = item.preview.mp4;
    preview.dataset.videoWebm = item.preview.webm;
    preview.dataset.poster = item.preview.poster;
    const phone = document.createElement("div");
    phone.className = "phone-preview";
    const screen = document.createElement("div");
    screen.className = "phone-screen";
    const poster = document.createElement("img");
    poster.src = item.preview.poster;
    poster.alt = "";
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.poster = item.preview.poster;
    video.setAttribute("aria-hidden", "true");
    video.tabIndex = -1;
    video.disablePictureInPicture = true;
    video.setAttribute("disableremoteplayback", "");
    screen.append(poster, video);
    phone.append(screen);
    preview.append(phone);
    link.append(preview);
    thumbnails.append(link);
  });
}
renderTemplatePricing();
if (activeDiscount(baseQuote)) {
  const endText = discount.endsAt
    ? ` Ends ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(discount.endsAt))}.`
    : "";
  launchCopy.textContent = `${discount.label}: ${discount.percent}% off every invitation. Now ${money(baseQuote.totalUSD)} instead of ${money(baseQuote.listTotalUSD)}.${endText}`;
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem("di_launch_dismissed") === "1";
  } catch (error) {}
  launchBar.hidden = dismissed;
  $("#launch-dismiss").onclick = () => {
    launchBar.hidden = true;
    try {
      sessionStorage.setItem("di_launch_dismissed", "1");
    } catch (error) {}
  };
}
const heroOffer = $("#hero-offer"),
  badge = $("#offer-badge");
if (activeDiscount(baseQuote)) {
  heroOffer.hidden = false;
  heroOffer.append(
    "Now ",
    document.createElement("strong"),
    " instead of ",
    document.createElement("s"),
    " for your first invitation",
  );
  heroOffer.querySelector("strong").textContent = money(baseQuote.totalUSD);
  heroOffer.querySelector("s").textContent = money(baseQuote.listTotalUSD);
  badge.hidden = false;
  badge.querySelector("strong").textContent = `${discount.percent}% OFF`;
  badge.querySelector("span").textContent = discount.label;
}
$$("[data-gallery-offer]").forEach((e) => {
  e.textContent = `${money(baseQuote.totalUSD)} · ${discount.label}`;
});
$$(".btn").forEach((b) =>
  b.addEventListener("pointerdown", (e) => {
    if (R) return;
    const r = b.getBoundingClientRect(),
      s = document.createElement("i");
    s.className = "btn-ripple";
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    b.append(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  }),
);
const ev = [
  "Weddings",
  "Birthdays",
  "Baby showers",
  "Engagements",
  "Graduations",
  "Anniversaries",
  "Corporate events",
  "Quinceañeras",
];
const mqEl = $("#mq");
if (mqEl) mqEl.innerHTML = [...ev, ...ev].map((t) => `<span>${t}</span>`).join("");
const navEl = $("#nav");
if (navEl) {
  addEventListener(
    "scroll",
    () => navEl.classList.toggle("s", window.scrollY > 20),
    { passive: true },
  );
  const navToggle = $("#nav-toggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const open = navEl.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    navEl.querySelectorAll("nav a").forEach((link) => {
      link.addEventListener("click", () => {
        navEl.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !navEl.classList.contains("is-open")) return;
      navEl.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.focus();
    });
  }
}
function reportInitError(feature, error) {
  console.error(`[Digital Invitations] ${feature} initialization failed`, error);
}
/* faq */
function initFaq() {
  try {
    $$(".fq button").forEach(
      (b) =>
        (b.onclick = () => {
          const q = b.closest(".fq");
          if (!q) return;
          const o = !q.classList.contains("o");
          $$(".fq").forEach((x) => {
            x.classList.remove("o");
            const btn = x.querySelector("button");
            if (btn) btn.setAttribute("aria-expanded", "false");
          });
          if (o) {
            q.classList.add("o");
            b.setAttribute("aria-expanded", "true");
          }
        }),
    );
  } catch (error) {
    reportInitError("FAQ", error);
  }
}
initFaq();
/* motion */
function initMotion() {
  try {
  if (A) {
  G.timeline({ defaults: { ease: "expo.out" } })
    .from("#f1", {
      opacity: 0,
      scale: 0.92,
      transformOrigin: "50% 0",
      duration: 2,
      ease: "power2.out",
    })
    .from(
      ".ln>span,.ln em>span",
      { yPercent: 115, duration: 1.3, stagger: 0.14 },
      "<.2",
    )
    .from(
      ".hero .mut,.lead,.chips",
      { y: 20, opacity: 0, duration: 1, stagger: 0.12 },
      "<.3",
    )
    .from(".vis", { y: 60, opacity: 0, scale: 0.94, duration: 1.5 }, "<.1");
  G.to("#f1", {
    yPercent: -12,
    ease: "none",
    scrollTrigger: {
      trigger: "#top",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
  G.from("#f2", {
    yPercent: 30,
    opacity: 0,
    ease: "none",
    scrollTrigger: {
      trigger: "#contact",
      start: "top 85%",
      end: "center 70%",
      scrub: true,
    },
  });
  $$("h2").forEach((e) =>
    G.from(e, {
      y: 30,
      opacity: 0,
      duration: 1.1,
      ease: "expo.out",
      scrollTrigger: { trigger: e, start: "top 88%" },
    }),
  );
  $$(".wrap>p,.tabs,.fq").forEach((e) =>
    G.from(e, {
      y: 24,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: e, start: "top 91%" },
    }),
  );
  ScrollTrigger.batch(".tc,.ft,.pc", {
    start: "top 90%",
    onEnter: (b) =>
      G.from(b, {
        y: 50,
        opacity: 0,
        duration: 1.1,
        stagger: 0.12,
        ease: "expo.out",
        overwrite: true,
      }),
  });
  const stepList = $(".st"),
    stepItems = $$(".st li");
  G.fromTo(
    ".sl2",
    { scaleY: 0, scaleX: 0 },
    {
      scaleY: 1,
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: stepList,
        start: "top 70%",
        end: "bottom 70%",
        scrub: true,
      },
    },
  );
  stepItems.forEach((e, index) =>
    G.from(e, {
      y: 30,
      opacity: 0,
      duration: 1,
      ease: "expo.out",
      delay: index * 0.12,
      scrollTrigger: { trigger: e, start: "top 85%" },
    }),
  );
  if (hov) {
    $$(".tc").forEach((c) => {
      const i = c.firstElementChild;
      c.onpointermove = (e) => {
        const b = c.getBoundingClientRect(),
          x = (e.clientX - b.left) / b.width - 0.5,
          y = (e.clientY - b.top) / b.height - 0.5;
        G.to(i, {
          rotateY: x * 10,
          rotateX: -y * 10,
          duration: 0.5,
          ease: "power3.out",
        });
      };
      c.onpointerleave = () =>
        G.to(i, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.9,
          ease: "elastic.out(1,.5)",
        });
    });
  }
  }
  } catch (error) {
    reportInitError("hero and scroll animations", error);
  }
}
initMotion();

function initStepFlower() {
  try {
    const list = $("#how .st"),
      flower = $(".st-flower");
    if (!list || !flower) return;
    const steps = [...list.querySelectorAll("li")],
      line = list.querySelector(".sl2");
    if (!steps.length || !line) return;
    let points = [],
      progress = 0;
    const measure = () => {
      const horizontal = line.offsetWidth > line.offsetHeight;
      points = steps.map((step) => {
        const head = step.querySelector("h3") || step;
        return horizontal
          ? {
              x: step.offsetLeft + head.offsetLeft + head.offsetWidth / 2,
              y: line.offsetTop + line.offsetHeight / 2,
            }
          : {
              x: line.offsetLeft + line.offsetWidth / 2,
              y: step.offsetTop + head.offsetTop + head.offsetHeight / 2,
            };
      });
    };
    const place = (value) => {
      progress = Math.min(Math.max(value, 0), 1);
      if (points.length < 2) return;
      const pos = progress * (points.length - 1),
        i = Math.min(Math.floor(pos), points.length - 2),
        t = pos - i,
        a = points[i],
        b = points[i + 1];
      const nearest = Math.round(pos);
      steps.forEach((step, index) =>
        step.classList.toggle("is-lit", index === nearest),
      );
      flower.style.transform = `translate(${(a.x + (b.x - a.x) * t).toFixed(2)}px,${(a.y + (b.y - a.y) * t).toFixed(2)}px) translate(-50%,-50%)`;
      flower.classList.add("is-placed");
    };
    measure();
    place(0);
    if (!A) return;
    ScrollTrigger.create({
      trigger: list,
      start: "top 78%",
      end: "bottom 42%",
      onRefresh: (self) => {
        measure();
        place(self.progress);
      },
      onUpdate: (self) => place(self.progress),
    });
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(() => {
        measure();
        place(progress);
      });
  } catch (error) {
    reportInitError("step flower", error);
  }
}
initStepFlower();

function initTypewriter() {
  const target = $("[data-typewriter]");
  if (!target) return;
  const phrases = [
    "Pay just 50% upfront to get started.",
    "Pay the remaining 50% when your invitation is ready.",
  ];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.textContent = phrases[0];
    return;
  }
  let phrase = 0,
    index = 0,
    deleting = false,
    started = false;
  const tick = () => {
    const value = phrases[phrase];
    index += deleting ? -1 : 1;
    target.textContent = value.slice(0, index);
    let delay = deleting ? 26 : 52;
    if (!deleting && index >= value.length) {
      deleting = true;
      delay = 2800;
    } else if (deleting && index <= 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      delay = 450;
    }
    setTimeout(tick, delay);
  };
  const start = () => {
    if (started) return;
    started = true;
    tick();
  };
  if (!("IntersectionObserver" in window)) {
    start();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    },
    { threshold: 0.4 },
  );
  observer.observe(target);
}
initTypewriter();

function initHeroScreens() {
  try {
    const stage = $("#top"),
      screens = $$(".hero-screen");
    if (!stage || !screens.length) return;
    const conn = navigator.connection || {};
    if (R || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;
    const webm = !!document.createElement("video").canPlayType(
      'video/webm; codecs="vp9"',
    );
    let inView = false;
    const play = (video) => {
      if (!video.src) return;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function")
        attempt.catch(() => {});
    };
    const pause = (video) => {
      if (!video.paused) video.pause();
    };
    const load = (video) => {
      if (video.dataset.loaded) return;
      const mp4 = video.dataset.screenMp4,
        wb = video.dataset.screenWebm,
        src = webm && wb ? wb : mp4 || wb;
      if (!src) return;
      video.dataset.loaded = "1";
      video.preload = "auto";
      video.addEventListener(
        "loadeddata",
        () => video.classList.add("is-ready"),
        { once: true },
      );
      video.addEventListener("error", () => {
        if (video.dataset.fallback || !mp4 || src === mp4) return;
        video.dataset.fallback = "1";
        video.src = mp4;
        video.load();
        if (inView && !document.hidden) play(video);
      });
      video.src = src;
      video.load();
    };
    const sync = (on) => {
      inView = on;
      screens.forEach((video) => {
        if (on && !document.hidden) {
          load(video);
          play(video);
        } else pause(video);
      });
    };
    if (!("IntersectionObserver" in window)) sync(true);
    else
      new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) =>
            sync(entry.isIntersecting && entry.intersectionRatio >= 0.25),
          ),
        { threshold: [0, 0.25] },
      ).observe(stage);
    document.addEventListener("visibilitychange", () =>
      screens.forEach((video) => {
        if (document.hidden) pause(video);
        else if (inView) {
          load(video);
          play(video);
        }
      }),
    );
  } catch (error) {
    reportInitError("hero preview videos", error);
  }
}
initHeroScreens();
