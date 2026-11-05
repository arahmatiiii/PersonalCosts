/* PersonalCost landing — small vanilla interactions */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fa = (n) => new Intl.NumberFormat("fa-IR").format(n);

  /* ---------- scroll progress + nav shadow ---------- */
  const bar = document.getElementById("bar");
  const nav = document.getElementById("nav");
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    if (bar) bar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + "%";
    if (nav) nav.classList.toggle("scrolled", doc.scrollTop > 8);
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- reveal on scroll ---------- */
  const revealables = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    document.documentElement.classList.add("no-io");
    revealables.forEach((el) => el.classList.add("in"));
  }

  /* ---------- demo pause / play ---------- */
  const gif = document.getElementById("demo-gif");
  const demoBtn = document.getElementById("demo-toggle");
  if (gif && demoBtn) {
    const gifSrc = gif.getAttribute("src");
    const poster = gif.dataset.poster;
    const label = demoBtn.querySelector("span");
    const icon = demoBtn.querySelector("use");
    demoBtn.addEventListener("click", () => {
      const paused = demoBtn.getAttribute("aria-pressed") === "true";
      demoBtn.setAttribute("aria-pressed", String(!paused));
      gif.src = paused ? gifSrc : poster;
      if (label) label.textContent = paused ? "دمو رو نگه دار" : "دمو رو پخش کن";
      if (icon) icon.setAttribute("href", paused ? "#i-pause" : "#i-play");
    });
  }

  /* ---------- gallery filter ---------- */
  const shots = Array.from(document.querySelectorAll("#gallery-grid .shot"));
  const chips = Array.from(document.querySelectorAll(".gallery-filters .chip"));

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      shots.forEach((shot) => {
        shot.hidden = !(filter === "all" || shot.dataset.group === filter);
      });
    });
  });

  /* ---------- lightbox ---------- */
  const lb = document.getElementById("lightbox");
  const lbImage = document.getElementById("lb-image");
  const lbCaption = document.getElementById("lb-caption");
  const lbCount = document.getElementById("lb-count");
  const lbClose = document.getElementById("lb-close");
  const lbPrev = lb.querySelector(".lb-prev");
  const lbNext = lb.querySelector(".lb-next");
  let view = [];
  let index = 0;
  let lastFocus = null;

  const collect = () =>
    shots
      .filter((shot) => !shot.hidden)
      .map((shot) => {
        const img = shot.querySelector("img");
        return {
          src: img.getAttribute("src"),
          alt: img.getAttribute("alt") || "",
          caption: shot.querySelector("figcaption")?.textContent.trim() || "",
        };
      });

  const render = () => {
    const item = view[index];
    if (!item) return;
    lbImage.src = item.src;
    lbImage.alt = item.alt;
    lbCaption.textContent = item.caption;
    lbCount.textContent = `${fa(index + 1)} / ${fa(view.length)}`;
  };

  const openAt = (i) => {
    view = collect();
    if (!view.length) return;
    index = (i + view.length) % view.length;
    lastFocus = document.activeElement;
    render();
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("lb-open");
    lbClose.focus({ preventScroll: true });
  };

  const close = () => {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lb-open");
    lbImage.removeAttribute("src");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  };

  const step = (dir) => {
    if (!view.length) return;
    index = (index + dir + view.length) % view.length;
    render();
  };

  shots.forEach((shot) => {
    shot.querySelector(".shot-btn")?.addEventListener("click", () => {
      const visible = shots.filter((s) => !s.hidden);
      openAt(visible.indexOf(shot));
    });
  });

  lbClose?.addEventListener("click", close);
  lbPrev?.addEventListener("click", () => step(-1));
  lbNext?.addEventListener("click", () => step(1));
  lb?.addEventListener("click", (event) => {
    if (event.target === lb || event.target.classList.contains("lb-stage")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (!lb.classList.contains("open")) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowLeft") step(1);
    else if (event.key === "ArrowRight") step(-1);
  });
})();
