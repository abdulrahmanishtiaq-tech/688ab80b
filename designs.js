/* Designs page: shared contact links, event filters and gallery offers. */
(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const site = (window.DI && window.DI.site) || {
    phone: "",
    phoneDisplay: "",
    email: "",
    demo: "",
  };
  const catalog = window.DI && window.DI.catalog;
  const pricing = window.DI && window.DI.pricing;
  const reduceMotion = matchMedia("(prefers-reduced-motion:reduce)").matches;

  const logo = $("#lg");
  if (logo) logo.innerHTML = '<img src="assets/seal.webp" alt="">';
  $$("[data-seal]").forEach((image) => (image.src = "assets/seal.webp"));
  $$("[data-demo]").forEach((link) => (link.href = site.demo));
  $$("[data-wa]").forEach((link) => {
    link.href = site.phone
      ? `https://wa.me/${site.phone}?text=${encodeURIComponent(link.dataset.wa)}`
      : "#contact";
    if (site.phone) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
  $$("[data-contact-whatsapp]").forEach((link) => {
    link.href = site.phone
      ? `https://wa.me/${site.phone}?text=${encodeURIComponent(link.dataset.wa || "Hello! I’d like a free preview of my invitation.")}`
      : "#contact";
    if (site.phone) {
      if (!link.querySelector("svg"))
        link.textContent = link.textContent || site.phoneDisplay || `+${site.phone}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else if (!link.querySelector("svg")) {
      link.textContent = link.textContent || "Contact us on WhatsApp";
    }
  });
  $$("[data-contact-email]").forEach((link) => {
    if (site.email) {
      link.href = `mailto:${site.email}?subject=${encodeURIComponent("Digital Invitations enquiry")}&body=${encodeURIComponent("Hello! I would like to ask about a digital invitation.")}`;
      if (link.querySelector("svg")) link.setAttribute("aria-label", `Email ${site.email}`);
      else link.textContent = site.email;
    } else if (!link.querySelector("svg")) {
      link.href = "#contact";
      link.textContent = "Email support";
    }
  });
  $$("[data-instagram]").forEach((link) => {
    link.href = site.instagram || "#contact";
    if (site.instagram) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });

  if (catalog && pricing) {
    const quote = pricing.calculateQuote({}, catalog);
    const price = pricing.formatMoney(quote.totalUSD, catalog.currency || "USD", catalog);
    $$("[data-gallery-offer]").forEach((element) => {
      element.textContent = price;
    });
  }

  const nav = $("#nav");
  if (nav) {
    addEventListener(
      "scroll",
      () => nav.classList.toggle("s", window.scrollY > 20),
      { passive: true },
    );
    const toggle = $("#nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      nav.querySelectorAll("nav a").forEach((link) => {
        link.addEventListener("click", () => {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !nav.classList.contains("is-open")) return;
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      });
    }
  }

  function initFilters() {
    try {
      const tabs = $$(".tab");
      const indicator = $(".ind");
      const cards = $$(".tc");
      if (!tabs.length || !indicator) return;
      let current = 0;
      function place() {
        const tab = tabs[current];
        if (!tab) return;
        indicator.style.width = tab.offsetWidth + "px";
        indicator.style.height = tab.offsetHeight + "px";
        indicator.style.transform = `translate(${tab.offsetLeft - 4}px,${tab.offsetTop - 4}px)`;
      }
      function select(index, animate) {
        current = index;
        const filter = tabs[index].dataset.f;
        tabs.forEach((tab, i) =>
          tab.setAttribute("aria-selected", String(i === index)),
        );
        place();
        cards.forEach((card) => {
          const show =
            filter === "all" || (card.dataset.ev || "").includes(filter);
          card.classList.toggle("off", !show);
          if (show && animate && !reduceMotion && card.animate) {
            card.animate(
              [
                { opacity: 0, transform: "translateY(18px)" },
                { opacity: 1, transform: "none" },
              ],
              {
                duration: 520,
                easing: "cubic-bezier(.2,.9,.2,1)",
              },
            );
          }
        });
      }
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => select(index, true));
      });
      select(0, false);
      let frame = 0;
      addEventListener(
        "resize",
        () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(place);
        },
        { passive: true },
      );
      if (document.fonts) document.fonts.ready.then(place);
    } catch (error) {
      console.error(
        "[Digital Invitations] designs filter initialization failed",
        error,
      );
    }
  }

  initFilters();
}());
