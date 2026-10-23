/* Shared phone-preview video loader for the homepage, designs page and order dialog. */
(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector),
    $$ = (selector) => [...document.querySelectorAll(selector)];

  function reportInitError(feature, error) {
    console.error(`[Digital Invitations] ${feature} initialization failed`, error);
  }

  function initPreviewVideos() {
    try {
      const previews = $$(".pv[data-video-mp4]"),
        active = new Set(),
        reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
      const dataSaver =
        !!connection &&
        (connection.saveData ||
          /^(slow-2g|2g)$/.test(connection.effectiveType || ""));
      const canAutoplay = !reduced && !dataSaver;
      const visible = new Map();
      function isAvailable(card) {
        return !card.classList.contains("off") && visible.get(card) !== false;
      }
      function pause(card) {
        const video = card.querySelector("video");
        if (!video) return;
        video.pause();
        active.delete(card);
        const button = card.querySelector(".preview-play");
        if (button) {
          button.textContent = "▶";
          button.setAttribute("aria-label", "Play preview");
          button.setAttribute("aria-pressed", "false");
        }
      }
      function keepTwo(card) {
        if (active.size < 2) return;
        let farthest = null,
          distance = -1;
        active.forEach((item) => {
          const box = item.getBoundingClientRect(),
            center = innerHeight / 2;
          const itemDistance = Math.abs((box.top + box.bottom) / 2 - center);
          if (itemDistance > distance) {
            distance = itemDistance;
            farthest = item;
          }
        });
        if (farthest && farthest !== card) pause(farthest);
      }
      function load(card) {
        const video = card.querySelector("video");
        if (!video || video.dataset.loaded) return;
        const preview = card.querySelector(".pv[data-video-mp4]");
        if (!preview) return;
        [
          ["video/webm", preview.dataset.videoWebm],
          ["video/mp4", preview.dataset.videoMp4],
        ].forEach(([type, src]) => {
          if (!src) return;
          const source = document.createElement("source");
          source.src = src;
          source.type = type;
          video.append(source);
        });
        const webm = preview.dataset.videoWebm;
        const mp4 = preview.dataset.videoMp4;
        video.src =
          (webm && video.canPlayType("video/webm") ? webm : mp4) ||
          webm ||
          mp4;
        video.dataset.loaded = "true";
        video.addEventListener(
          "canplay",
          () => video.classList.add("is-ready"),
          { once: true },
        );
        video.addEventListener("error", () => {
          if (mp4 && video.src.endsWith(webm || "\0")) {
            video.src = mp4;
            video.load();
          } else {
            video.classList.remove("is-ready");
          }
        });
        video.load();
      }
      function play(card) {
        const video = card.querySelector("video");
        if (!video || !isAvailable(card) || document.hidden) return;
        keepTwo(card);
        load(card);
        const attempt = video.play();
        if (attempt && typeof attempt.catch === "function")
          attempt.catch((error) => {
            pause(card);
            const button = card.querySelector(".preview-play");
            if (button) button.hidden = false;
          });
        active.add(card);
      }
      function update(card, entry) {
        visible.set(card, entry.isIntersecting);
        if (card.classList.contains("off")) {
          pause(card);
          return;
        }
        if (entry.isIntersecting) load(card);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25 && canAutoplay)
          play(card);
        else if (!entry.isIntersecting || entry.intersectionRatio < 0.25)
          pause(card);
      }
      previews.forEach((preview) => {
        if (preview.dataset.previewInitialized === "true") return;
        preview.dataset.previewInitialized = "true";
        const card = preview.closest(".tc,.ord-template-card,.template-thumb"),
          video = preview.querySelector("video");
        if (!card || !video) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "preview-play";
        button.textContent = "▶";
        button.hidden = canAutoplay;
        button.setAttribute("aria-label", "Play preview");
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (video.paused) {
            load(card);
            const attempt = video.play();
            if (attempt && typeof attempt.catch === "function")
              attempt.catch((error) => {
                pause(card);
                button.hidden = false;
              });
            button.textContent = "❚❚";
            button.hidden = false;
            button.setAttribute("aria-label", "Pause preview");
            button.setAttribute("aria-pressed", "true");
          } else {
            pause(card);
            button.textContent = "▶";
            button.setAttribute("aria-label", "Play preview");
            button.setAttribute("aria-pressed", "false");
          }
        });
        preview.append(button);
        new IntersectionObserver(
          (entries) =>
            entries.forEach((entry) => {
              try {
                update(card, entry);
              } catch (error) {
                reportInitError("preview videos", error);
              }
            }),
          { rootMargin: "200px 0px", threshold: [0, 0.25] },
        ).observe(card);
      });
      const cards = previews
        .map((preview) => preview.closest(".tc"))
        .filter(Boolean);
      if (!window.DI_previewObsBound) {
        window.DI_previewObsBound = true;
        const grid = $(".grid");
        if (grid) {
          new MutationObserver(() =>
            cards.forEach((card) => {
              if (card.classList.contains("off")) pause(card);
            }),
          ).observe(grid, {
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
          });
        }
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) active.forEach(pause);
          else
            cards.forEach((card) => {
              if (
                isAvailable(card) &&
                visible.get(card) &&
                canAutoplay &&
                card.getBoundingClientRect().height
              )
                play(card);
            });
        });
      }
    } catch (error) {
      reportInitError("preview videos", error);
    }
  }

  window.DI = window.DI || {};
  window.DI.initPreviewVideos = initPreviewVideos;
  initPreviewVideos();
}());
