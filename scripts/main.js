(() => {
  const config = window.WEDDING_CONFIG || {};
  const INTRO_SEEN_KEY = "wedding_intro_seen";

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const formatDate = (iso) => {
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  };

  const formatMonthYear = (iso) => {
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric"
    }).format(date);
  };

  const setText = (id, value) => {
    const el = byId(id);
    if (el && value !== undefined && value !== null) el.textContent = String(value);
  };

  const readStorage = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  };

  const writeStorage = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      // Ignore unavailable storage.
    }
  };

  const initIntro = () => {
    const splash = byId("intro-splash");
    const stage = byId("intro-stage");
    const shell = byId("intro-map-shell");
    const canvas = byId("intro-stars-canvas");
    if (!splash || !stage || !shell || !canvas) return;

    const intro = config.intro || {};
    const enabled = intro.enabled !== false;
    const showEveryVisit = intro.showEveryVisit !== false;
    const seen = readStorage(INTRO_SEEN_KEY) === "1";
    const shouldShow = enabled && (showEveryVisit || !seen);
    if (!shouldShow) {
      splash.classList.add("is-hidden");
      splash.setAttribute("aria-hidden", "true");
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setText("intro-title-line1", intro.titleLine1 || "ВАС ХОТЯТ КОЕ-КУДА");
    setText("intro-title-line2", intro.titleLine2 || "ПРИГЛАСИТЬ");
    setText("intro-coords", intro.coordsText || "");
    setText("intro-date", intro.dateLine || "");
    document.body.classList.add("intro-lock");

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      splash.classList.add("is-hidden");
      document.body.classList.remove("intro-lock");
      return;
    }

    const warpDuration = clamp(Number(intro.warpDurationMs) || 1200, 300, 4000);
    const fadeDuration = clamp(Number(intro.fadeDurationMs) || 500, 200, 2000);
    const starCount = clamp(Number(intro.starCount) || 900, 150, 2200);
    const accentRatio = clamp(Number(intro.accentStarRatio) || 0.02, 0, 0.1);
    const stars = [];
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const size = 0.5 + Math.pow(Math.random(), 1.8) * 2.8;
      const twinkle = 0.45 + Math.random() * 0.55;
      const accent = Math.random() < accentRatio;
      stars.push({
        x,
        y,
        size,
        twinkle,
        accent,
        depth: 0.25 + Math.random() * 1.35,
        phase: Math.random() * Math.PI * 2
      });
    }

    let rafId = 0;
    let isWarping = false;
    let isTransitioning = false;
    let warpStartedAt = 0;
    const cleanupFns = [];
    const sparkleNodes = new Set();

    const state = {
      cx: 0,
      cy: 0,
      radius: 0,
      dpr: Math.max(1, window.devicePixelRatio || 1),
      parallaxX: 0,
      parallaxY: 0
    };

    const resizeCanvas = () => {
      const rect = shell.getBoundingClientRect();
      state.cx = rect.width / 2;
      state.cy = rect.height / 2;
      state.radius = Math.max(rect.width, rect.height) * 0.54;
      canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    };

    const setParallax = (x, y) => {
      state.parallaxX = clamp(x, -1, 1);
      state.parallaxY = clamp(y, -1, 1);
      splash.style.setProperty("--parallax-x", `${state.parallaxX.toFixed(3)}px`);
      splash.style.setProperty("--parallax-y", `${state.parallaxY.toFixed(3)}px`);
    };

    const draw = (now) => {
      const w = canvas.width / state.dpr;
      const h = canvas.height / state.dpr;
      ctx.clearRect(0, 0, w, h);

      const elapsed = isWarping ? now - warpStartedAt : 0;
      const progress = isWarping ? clamp(elapsed / warpDuration, 0, 1) : 0;
      const boost = reducedMotion ? 1 + progress * 2.4 : 1 + progress * progress * 22;
      const trailLen = reducedMotion ? 1.6 : 10 + progress * 70;
      const twinkleTime = now * 0.001;
      const parallaxStrength = 34;

      stars.forEach((star) => {
        const starParallaxX = state.parallaxX * parallaxStrength * star.depth;
        const starParallaxY = state.parallaxY * parallaxStrength * star.depth;
        const sx = state.cx + star.x * state.radius * boost + starParallaxX;
        const sy = state.cy + star.y * state.radius * boost + starParallaxY;
        const alpha = star.twinkle * (0.74 + Math.sin(twinkleTime + star.phase) * 0.2);
        const color = star.accent ? `rgba(255, 156, 35, ${alpha.toFixed(3)})` : `rgba(255, 255, 255, ${alpha.toFixed(3)})`;

        if (isWarping && !reducedMotion) {
          const px = state.cx + star.x * state.radius * Math.max(1, boost - trailLen / 100) + starParallaxX;
          const py = state.cy + star.y * state.radius * Math.max(1, boost - trailLen / 100) + starParallaxY;
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.45, star.size * (0.55 + progress * 0.8));
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }

        const radius = Math.max(0.45, star.size * (0.8 + progress * 2));
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      rafId = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const rect = splash.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      setParallax(nx, ny);
    };
    splash.addEventListener("pointermove", onPointerMove);
    cleanupFns.push(() => splash.removeEventListener("pointermove", onPointerMove));

    let gotGyroSignal = false;
    if ("DeviceOrientationEvent" in window) {
      if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
        const requestGyroPermission = () => {
          window.DeviceOrientationEvent.requestPermission().catch(() => {});
        };
        splash.addEventListener("pointerdown", requestGyroPermission, { once: true });
      }
      const onOrientation = (event) => {
        if (typeof event.gamma !== "number" || typeof event.beta !== "number") return;
        gotGyroSignal = true;
        setParallax(event.gamma / 28, event.beta / 40);
      };
      window.addEventListener("deviceorientation", onOrientation);
      cleanupFns.push(() => window.removeEventListener("deviceorientation", onOrientation));
    }

    let lastSparkleTime = 0;
    const spawnSparkles = (touch) => {
      if (!touch) return;
      const layers = [1, 0.9, 0.8, 0.5, 0.2];
      layers.forEach((layer) => {
        const spread = (1 - layer) * 75;
        const sparkle = document.createElement("span");
        sparkle.className = "intro-sparkle";
        sparkle.textContent = Math.random() > 0.78 ? "✶" : "✦";
        const offsetX = Math.round(Math.random() * spread - spread / 2);
        const offsetY = Math.round(Math.random() * spread - spread / 2);
        sparkle.style.left = `${touch.clientX + offsetX}px`;
        sparkle.style.top = `${touch.clientY + offsetY}px`;
        sparkle.style.fontSize = `${8 + Math.random() * (12 * layer)}px`;
        sparkle.style.color = Math.random() > 0.82 ? "rgba(255, 174, 72, 0.95)" : "rgba(255, 255, 255, 0.95)";
        splash.appendChild(sparkle);
        sparkleNodes.add(sparkle);
        const ttl = Math.max(120, Math.round(Math.random() * layer * 600));
        window.setTimeout(() => {
          sparkle.remove();
          sparkleNodes.delete(sparkle);
        }, ttl);
      });
    };
    const onTouchStart = (event) => {
      const touch = event.touches && event.touches[0];
      spawnSparkles(touch);
      lastSparkleTime = performance.now();
    };
    const onTouchMove = (event) => {
      const touch = event.touches && event.touches[0];
      const now = performance.now();
      if (now - lastSparkleTime < 34) return;
      lastSparkleTime = now;
      spawnSparkles(touch);
    };
    const onTouchEnd = (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      spawnSparkles(touch);
    };
    splash.addEventListener("touchstart", onTouchStart, { passive: true });
    splash.addEventListener("touchmove", onTouchMove, { passive: true });
    splash.addEventListener("touchend", onTouchEnd, { passive: true });
    splash.addEventListener("touchcancel", onTouchEnd, { passive: true });
    cleanupFns.push(() => splash.removeEventListener("touchstart", onTouchStart));
    cleanupFns.push(() => splash.removeEventListener("touchmove", onTouchMove));
    cleanupFns.push(() => splash.removeEventListener("touchend", onTouchEnd));
    cleanupFns.push(() => splash.removeEventListener("touchcancel", onTouchEnd));

    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    cleanupFns.push(() => window.removeEventListener("resize", onResize));

    const cleanup = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      cleanupFns.forEach((fn) => fn());
      sparkleNodes.forEach((node) => node.remove());
      sparkleNodes.clear();
      splash.classList.add("is-hidden");
      splash.setAttribute("aria-hidden", "true");
      document.body.classList.remove("intro-lock");
      if (!showEveryVisit) writeStorage(INTRO_SEEN_KEY, "1");
    };

    const startTransition = () => {
      if (isTransitioning) return;
      isTransitioning = true;
      isWarping = true;
      warpStartedAt = performance.now();
      splash.classList.add("is-warping");

      window.setTimeout(() => {
        splash.classList.add("is-fading");
      }, warpDuration);

      window.setTimeout(() => {
        cleanup();
      }, warpDuration + fadeDuration);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      startTransition();
    };

    splash.addEventListener("click", startTransition);
    splash.addEventListener("keydown", onKeyDown);
    cleanupFns.push(() => splash.removeEventListener("click", startTransition));
    cleanupFns.push(() => splash.removeEventListener("keydown", onKeyDown));

    resizeCanvas();
    setParallax(0, 0);
    rafId = window.requestAnimationFrame(draw);
  };

  const initHero = () => {
    const names = config.coupleNames || {};
    const groom = String(names.groom || "").trim();
    const bride = String(names.bride || "").trim();
    const displayNames = [groom, bride].filter(Boolean).join(" и ");
    const heroNamesEl = byId("hero-names");
    if (heroNamesEl) {
      if (groom && bride) {
        heroNamesEl.textContent = "";
        heroNamesEl.append(document.createTextNode(`${groom} `));
        const amp = document.createElement("span");
        amp.className = "hero-amp";
        amp.textContent = "&";
        heroNamesEl.appendChild(amp);
        heroNamesEl.appendChild(document.createElement("br"));
        heroNamesEl.append(document.createTextNode(bride));
      } else {
        heroNamesEl.textContent = displayNames;
      }
    }
    setText("footer-names", displayNames);
    setText("hero-subtitle", config.heroSubtitle);
    setText("hero-description", config.heroDescription);
    setText("hero-date", formatDate(config.eventDateISO));
    setText("hero-time", config.eventTime);
  };

  const initStory = () => {
    setText("story-title", config.storyTitle);
    setText("story-text", config.storyText);
  };

  const initDate = () => {
    setText("date-text", config.dateText);
    setText("date-full", formatDate(config.eventDateISO));
    setText("date-time", config.eventTime);
    setText("calendar-month", formatMonthYear(config.eventDateISO));
  };

  const initLocation = () => {
    setText("location-title", config.locationTitle);
    setText("location-subtitle", config.locationSubtitle);
    setText("location-address", config.locationAddress);
    setText("location-time", config.locationTime);

    const address = String(config.locationAddress || "").trim();
    const encodedAddress = encodeURIComponent(address);
    const fallbackRouteUrl = address
      ? `https://yandex.ru/maps/?rtext=~${encodedAddress}&rtt=auto`
      : "https://yandex.ru/maps/";
    const fallbackMapUrl = address
      ? `https://yandex.ru/map-widget/v1/?text=${encodedAddress}&z=17`
      : "https://yandex.ru/map-widget/v1/";

    const route = byId("location-route");
    if (route) {
      const rawRoute = String(config.locationRouteUrl || "").trim();
      route.href = rawRoute && rawRoute !== "https://yandex.ru/maps" ? rawRoute : fallbackRouteUrl;
    }

    const map = byId("location-map");
    if (map) {
      const rawEmbed = String(config.locationMapEmbedUrl || "").trim();
      map.src = rawEmbed || fallbackMapUrl;
    }
  };

  const initTimeline = () => {
    const grid = byId("timeline-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (config.timelineItems || []).forEach((item) => {
      const card = document.createElement("div");
      card.className = "timeline-card";
      card.innerHTML = `
        <div class="timeline-time">${item.time || ""}</div>
        <div class="timeline-title">${item.title || ""}</div>
        <div class="timeline-desc">${item.description || ""}</div>
      `;
      grid.appendChild(card);
    });
  };

  const initWishes = () => {
    const titleEl = byId("wishes-title");
    const textEl = byId("wishes-text");
    const copyEl = titleEl ? titleEl.closest(".wishes-copy") : null;
    const prevBtn = byId("wishes-prev");
    const nextBtn = byId("wishes-next");
    const contactsPane = byId("wishes-pane-contacts");
    const dresscodePane = byId("wishes-pane-dresscode");
    if (!titleEl || !textEl || !copyEl || !prevBtn || !nextBtn || !contactsPane || !dresscodePane) return;

    const slides = [
      {
        title: "Пожелания",
        text: config.wishesText || "Ваше присутствие - лучший подарок для нас.",
        pane: contactsPane
      },
      {
        title: "Дресс-код",
        text: config.dressCodeText || "Будем рады, если в этот день вы поддержите атмосферу праздника и выберете наряды в нашей палитре.",
        pane: dresscodePane
      }
    ];

    let activeIndex = 0;
    let switching = false;

    const render = () => {
      slides.forEach((slide, index) => {
        slide.pane.classList.toggle("is-active", index === activeIndex);
      });
      titleEl.textContent = slides[activeIndex].title;
      textEl.textContent = slides[activeIndex].text;
    };

    const switchTo = (nextIndex) => {
      if (switching) return;
      switching = true;
      copyEl.classList.add("is-switching");
      window.setTimeout(() => {
        activeIndex = nextIndex;
        render();
        copyEl.classList.remove("is-switching");
        window.setTimeout(() => {
          switching = false;
        }, 220);
      }, 140);
    };

    prevBtn.addEventListener("click", () => {
      const nextIndex = (activeIndex - 1 + slides.length) % slides.length;
      switchTo(nextIndex);
    });
    nextBtn.addEventListener("click", () => {
      const nextIndex = (activeIndex + 1) % slides.length;
      switchTo(nextIndex);
    });

    render();
  };

  const initContacts = () => {
    const grid = byId("contacts-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (config.contacts || []).forEach((person) => {
      const card = document.createElement("div");
      card.className = "contact-card";
      card.innerHTML = `
        <div class="contact-role">${person.role || ""}</div>
        <div class="contact-name">${person.name || ""}</div>
        <div>${person.phone || ""}</div>
        <div>${person.messenger || ""}</div>
      `;
      grid.appendChild(card);
    });
  };

  const initDressCode = () => {
    const carousel = byId("dresscode-carousel");
    const track = byId("dresscode-track");
    if (!track || !carousel) return;
    const sourceItems = (config.dressCodeColors || []).filter((item) => item && (item.label || item.value));
    if (!sourceItems.length) {
      track.innerHTML = "";
      return;
    }

    const slides = sourceItems.slice();
    while (slides.length < 3) {
      slides.push(sourceItems[slides.length % sourceItems.length]);
    }

    const createCard = (item) => {
      const card = document.createElement("article");
      card.className = "dresscode-card";
      card.innerHTML = `
        <div class="dresscode-photo" style="background-color: ${item.value || "#f4efe9"};">Фото</div>
        <div class="dresscode-label">${item.label || ""}</div>
      `;
      return card;
    };

    const extended = [slides[slides.length - 1], ...slides, slides[0]];
    track.innerHTML = "";
    extended.forEach((item) => track.appendChild(createCard(item)));

    let index = 1;
    let step = 0;
    let autoId = 0;
    let isAnimating = false;
    let pendingDir = 0;
    const transitionValue = "transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1)";

    const setTrackPosition = () => {
      track.style.transform = `translate3d(${-index * step}px, 0, 0)`;
    };

    const hardJumpTo = (nextIndex) => {
      index = nextIndex;
      track.style.transition = "none";
      setTrackPosition();
      track.offsetHeight;
      track.style.transition = transitionValue;
    };

    const normalizeIndexIfNeeded = () => {
      if (index >= slides.length + 1) {
        hardJumpTo(1);
      } else if (index <= 0) {
        hardJumpTo(slides.length);
      }
    };

    const navigate = (dir) => {
      if (!step) return;
      if (isAnimating) {
        pendingDir = clamp(pendingDir + (dir > 0 ? 1 : -1), -4, 4);
        return;
      }
      isAnimating = true;
      index += dir > 0 ? 1 : -1;
      setTrackPosition();
    };

    const measure = () => {
      const first = track.querySelector(".dresscode-card");
      if (!first) return;
      const style = window.getComputedStyle(track);
      const gap = Number.parseFloat(style.gap || "0") || 0;
      step = first.getBoundingClientRect().width + gap;
      index = clamp(index, 0, slides.length + 1);
      hardJumpTo(index);
      isAnimating = false;
    };

    const onTransitionEnd = () => {
      normalizeIndexIfNeeded();
      isAnimating = false;
      if (pendingDir !== 0) {
        const dir = pendingDir > 0 ? 1 : -1;
        pendingDir += dir > 0 ? -1 : 1;
        navigate(dir);
      }
    };

    const startAuto = () => {
      if (autoId) clearInterval(autoId);
      autoId = window.setInterval(() => navigate(1), 2600);
    };

    let touchStartX = 0;
    const onTouchStart = (event) => {
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      if (autoId) clearInterval(autoId);
    };
    const onTouchEnd = (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) {
        startAuto();
        return;
      }
      const dx = touch.clientX - touchStartX;
      if (Math.abs(dx) > 14) {
        if (dx < 0) navigate(1);
        else navigate(-1);
      }
      startAuto();
    };

    let pointerStartX = 0;
    let pointerActive = false;
    const onPointerDown = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pointerActive = true;
      pointerStartX = event.clientX;
      if (autoId) clearInterval(autoId);
      track.setPointerCapture?.(event.pointerId);
    };
    const onPointerUp = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (!pointerActive) return;
      pointerActive = false;
      const dx = event.clientX - pointerStartX;
      if (Math.abs(dx) > 14) {
        if (dx < 0) navigate(1);
        else navigate(-1);
      }
      startAuto();
    };

    let wheelLock = false;
    const onWheel = (event) => {
      const primary = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(primary) < 1.5 || wheelLock) return;
      wheelLock = true;
      if (primary > 0) navigate(1);
      else navigate(-1);
      window.setTimeout(() => {
        wheelLock = false;
      }, 180);
    };

    track.addEventListener("transitionend", onTransitionEnd);
    track.addEventListener("mouseenter", () => autoId && clearInterval(autoId));
    track.addEventListener("mouseleave", startAuto);
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointerup", onPointerUp);
    carousel.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", measure);

    measure();
    startAuto();
  };

  const initCalendar = () => {
    const grid = byId("calendar-grid");
    if (!grid || !config.eventDateISO) return;
    const date = new Date(`${config.eventDateISO}T00:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth();
    const eventDay = date.getDate();

    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    grid.innerHTML = "";
    for (let i = 0; i < startWeekday; i += 1) {
      const cell = document.createElement("span");
      cell.textContent = "";
      grid.appendChild(cell);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = document.createElement("span");
      cell.textContent = String(day);
      cell.classList.add("in-month");
      if (day === eventDay) cell.classList.add("is-event");
      grid.appendChild(cell);
    }
  };

  const initCountdown = () => {
    const daysEl = byId("count-days");
    const hoursEl = byId("count-hours");
    const minsEl = byId("count-mins");
    const secsEl = byId("count-secs");
    if (!daysEl || !hoursEl || !minsEl || !secsEl || !config.eventDateISO) return;

    let timerId = null;

    const setZero = () => {
      daysEl.textContent = "0";
      hoursEl.textContent = "0";
      minsEl.textContent = "0";
      secsEl.textContent = "0";
    };

    const update = () => {
      const target = new Date(`${config.eventDateISO}T${config.eventTime || "00:00"}:00`);
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        setZero();
        if (timerId) clearInterval(timerId);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const remMins = minutes % 60;
      const remSecs = totalSeconds % 60;
      daysEl.textContent = String(days);
      hoursEl.textContent = String(remHours);
      minsEl.textContent = String(remMins);
      secsEl.textContent = String(remSecs);
    };

    update();
    timerId = setInterval(update, 1000);
  };

  const initRSVP = () => {
    const form = byId("rsvp-form");
    const status = byId("form-status");
    const deadline = byId("rsvp-deadline");
    if (deadline && config.deadlineRSVP) {
      deadline.textContent = formatDate(config.deadlineRSVP);
    }
    if (!form || !status) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";

      const data = new FormData(form);
      const guestName = String(data.get("guestName") || "").trim();
      const attendance = String(data.get("attendance") || "").trim();
      const plusOne = String(data.get("plusOne") || "no").trim();
      const drinkPreference = data.getAll("drinks").map((item) => String(item).trim()).filter(Boolean).join(", ");
      const wish = String(data.get("wish") || "").trim();
      const honeypot = String(data.get("company") || "").trim();

      if (honeypot) return;
      if (!guestName || !attendance) {
        status.textContent = "Пожалуйста, заполните имя и выберите ответ.";
        return;
      }

      const payload = {
        guestName,
        attendance,
        plusOne,
        drinkPreference,
        wish,
        submittedAt: new Date().toISOString(),
        source: String(config.rsvpSource || "wedding-site"),
        userAgent: window.navigator.userAgent || "",
        tzOffsetMin: new Date().getTimezoneOffset(),
        eventTitle: String(config.eventTitle || "")
      };

      const endpoint = (config.rsvpEndpoint || "").trim();
      const apiKey = (config.rsvpApiKey || "").trim();
      const button = byId("rsvp-submit");
      if (button) button.disabled = true;
      status.textContent = "Отправляем...";

      try {
        if (!endpoint) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          status.textContent = "Спасибо! Ответ записан.";
          form.reset();
          return;
        }
        const headers = {
          "Content-Type": "text/plain;charset=utf-8",
          Accept: "application/json"
        };
        if (apiKey && config.rsvpApiKeyHeader === true) {
          headers["x-api-key"] = apiKey;
        } else if (apiKey) {
          payload.apiKey = apiKey;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        const raw = await response.text();
        let result = {};
        if (raw) {
          try {
            result = JSON.parse(raw);
          } catch (err) {
            result = {};
          }
        }
        if (response.ok && result.ok) {
          status.textContent = "Спасибо! Ответ записан.";
          form.reset();
        } else {
          const details = result.details ? ` (${result.details})` : "";
          status.textContent = (result.error ? `${result.error}${details}` : `Ошибка отправки (${response.status || 0}). Попробуйте позже.`);
        }
      } catch (err) {
        status.textContent = "Сеть недоступна. Попробуйте позже.";
      } finally {
        if (button) button.disabled = false;
      }
    });
  };

  const initReveal = () => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    elements.forEach((el) => observer.observe(el));
  };

  initIntro();
  initHero();
  initStory();
  initDate();
  initLocation();
  initTimeline();
  initWishes();
  initContacts();
  initDressCode();
  initCalendar();
  initCountdown();
  initRSVP();
  initReveal();
})();
