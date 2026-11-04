(function () {
  "use strict";

  const W = window.WORDS;
  const byWord = (a, b) => sortKey(a.w).localeCompare(sortKey(b.w), "de");

  const TABS = [
    { id: "verben", label: "Verben", items: W.verben.filter((v) => !v.sep && !v.prep) },
    { id: "adjektive", label: "Adjektive", items: W.adjektive },
    { id: "nomen", label: "Nomen", items: W.nomen },
    { id: "trennbar", label: "Trennbare Verben", items: W.verben.filter((v) => v.sep) },
    { id: "praeposition", label: "Verben + Präposition", items: W.verben.filter((v) => v.prep) },
    { id: "andere", label: "Andere", items: W.andere },
  ];
  TABS.forEach((t) => t.items.sort(byWord));

  const MARKS = [
    { id: "gelernt", label: "Gelernt", icon: '<path d="m5 12.500 4.500 4.500L19 7.500"/>' },
    { id: "schwer", label: "Schwer", icon: '<path d="M12 4 2.800 20h18.400zM12 10v4.500m0 2.700v.1"/>' },
    { id: "wichtig", label: "Wichtig", icon: '<path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900-4.300-4.100 5.900-.8z"/>' },
  ];
  const iconSvg = (m, cls) => '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' + m.icon + "</svg>";

  const state = { tab: "verben", filter: "alle", query: "", deck: [], cardIndex: -1, listScroll: 0 };
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function sortKey(w) {
    return w.replace(/^(der\/die|der|die|das)\s+/, "").replace(/^\(sich\)\s+|^sich\s+|^etwas\s+/, "").replace(/^etwas\s+/, "");
  }
  function slug(w) {
    return w.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  // "die Ausgabe" -> { art: "die", word: "Ausgabe" }
  function splitNoun(w) {
    const m = w.match(/^(der\/die|der|die|das)\s+(.+)$/);
    return m ? { art: m[1], word: m[2] } : { art: "", word: w };
  }
  const artClass = (art) => (art === "der/die" ? "any" : art);
  const tab = () => TABS.find((t) => t.id === state.tab);

  /* Marks are saved in this browser, keyed by word, so a verb shown in two
     tabs keeps the same marks in both. */
  const MARKS_KEY = "b2-marks";
  let marks = {};
  try { marks = JSON.parse(localStorage.getItem(MARKS_KEY)) || {}; } catch (e) { /* storage is optional */ }

  const hasMark = (item, id) => (marks[slug(item.w)] || []).includes(id);
  function toggleMark(item, id) {
    const key = slug(item.w);
    const current = marks[key] || [];
    const next = current.includes(id) ? current.filter((m) => m !== id) : [...current, id];
    if (next.length) marks[key] = next;
    else delete marks[key];
    try { localStorage.setItem(MARKS_KEY, JSON.stringify(marks)); } catch (e) { /* storage is optional */ }
  }

  function visibleItems() {
    const q = state.query.trim().toLowerCase();
    return tab().items.filter((i) => {
      if (state.filter !== "alle" && !hasMark(i, state.filter)) return false;
      if (!q) return true;
      return i.w.toLowerCase().includes(q) || i.en.toLowerCase().includes(q) || i.fa.includes(q);
    });
  }

  /* List view */
  function renderTabs() {
    const nav = $("tabs");
    nav.textContent = "";
    TABS.forEach((t) => {
      const b = el("button", "tab", t.label);
      b.type = "button";
      if (t.id === state.tab) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => {
        state.filter = "alle";
        state.query = "";
        $("search").value = "";
        location.hash = t.id;
      });
      nav.appendChild(b);
    });
    const active = nav.querySelector("[aria-current]");
    if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }

  function renderChips() {
    const box = $("chips");
    box.textContent = "";
    const items = tab().items;
    [{ id: "alle", label: "Alle" }, ...MARKS].forEach((m) => {
      const b = el("button", "chip chip-" + m.id);
      b.type = "button";
      b.setAttribute("aria-pressed", String(state.filter === m.id));
      const n = m.id === "alle" ? items.length : items.filter((i) => hasMark(i, m.id)).length;
      b.append(m.label + " ", el("span", "chip-n", String(n)));
      b.addEventListener("click", () => {
        state.filter = m.id;
        renderChips();
        renderList();
      });
      box.appendChild(b);
    });
  }

  function renderList() {
    const items = visibleItems();
    const list = $("list");
    list.textContent = "";
    $("count").textContent = items.length === 1 ? "1 Wort" : items.length + " Wörter";
    items.forEach((item) => {
      const li = el("li");
      const b = el("button", "row");
      b.type = "button";
      const word = el("span", "row-word");
      word.lang = "de";
      const { art, word: rest } = splitNoun(item.w);
      if (art) {
        word.appendChild(el("span", "art art-" + artClass(art), art));
        word.append(" " + rest);
      } else {
        word.textContent = item.w;
      }
      if (item.prep) word.append(" ", el("span", "row-prep", item.prep));
      b.appendChild(word);
      const icons = MARKS.filter((m) => hasMark(item, m.id));
      if (icons.length) {
        const box = el("span", "row-marks");
        box.setAttribute("aria-label", icons.map((m) => m.label).join(", "));
        box.innerHTML = icons.map((m) => iconSvg(m, "mark-" + m.id)).join("");
        b.appendChild(box);
      }
      b.insertAdjacentHTML("beforeend", '<svg class="row-go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>');
      b.addEventListener("click", () => {
        state.listScroll = window.scrollY;
        location.hash = state.tab + "/" + slug(item.w);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    if (!items.length) {
      const mark = MARKS.find((m) => m.id === state.filter);
      $("count").textContent = mark && !state.query.trim()
        ? "Noch kein Wort als „" + mark.label + "“ markiert. Öffnen Sie ein Wort und tippen Sie unter der Karte auf „" + mark.label + "“."
        : "Kein Wort gefunden. Prüfen Sie die Schreibweise.";
    }
  }

  /* Card view */
  function fontSizeFor(text) {
    const n = text.length;
    if (n <= 9) return "3rem";
    if (n <= 13) return "2.5rem";
    if (n <= 18) return "2.125rem";
    return "1.875rem";
  }

  function renderFront(item) {
    const front = $("front");
    front.textContent = "";
    const { art, word } = splitNoun(item.w);
    if (art) front.appendChild(el("span", "front-art art-" + artClass(art), art));
    const w = el("span", "front-word", word);
    w.lang = "de";
    w.style.fontSize = fontSizeFor(word);
    front.appendChild(w);
    if (item.prep) front.appendChild(el("span", "front-prep", item.prep));
  }

  function faBlock(label, cls, text) {
    const box = el("div", cls);
    box.dir = "rtl";
    box.lang = "fa";
    box.appendChild(el("span", "label", label));
    return { box, text };
  }

  // Latin words inside Farsi text stay left-to-right and use the German font.
  function appendMixed(p, text) {
    text.split(/([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .+-]*[A-Za-zÄÖÜäöüß.])/).forEach((part, i) => {
      if (i % 2) {
        const s = el("span", null, part);
        s.lang = "de";
        s.dir = "ltr";
        p.appendChild(s);
      } else {
        p.append(part);
      }
    });
  }

  function pluralLabel(pl) {
    if (pl === "Sg.") return "nur Singular";
    if (pl === "Pl.") return "nur Plural";
    return "Plural: " + pl;
  }

  function renderBack(item) {
    const back = $("backFace");
    back.textContent = "";
    back.scrollTop = 0;

    const head = el("div", "back-head");
    const title = el("span", "back-word", item.w + (item.prep ? " " + item.prep : ""));
    title.lang = "de";
    head.appendChild(title);
    if (item.pl) head.appendChild(el("span", "tag", pluralLabel(item.pl)));
    if (item.sep) head.appendChild(el("span", "tag", "er/sie " + item.sep));
    back.appendChild(head);

    const en = el("div", "block");
    en.append(el("span", "label", "English"), el("span", "en", item.en));
    back.appendChild(en);

    const fa = faBlock("فارسی", "block fa-block").box;
    fa.appendChild(el("span", "fa", item.fa));
    back.appendChild(fa);

    if (item.ex) {
      const ex = faBlock("توضیح", "explain").box;
      const p = el("p");
      appendMixed(p, item.ex);
      ex.appendChild(p);
      back.appendChild(ex);
    }

    if (item.bsp) {
      const bsp = el("div", "example");
      bsp.lang = "de";
      bsp.append(el("span", "label", "Beispiel"), el("p", null, item.bsp));
      back.appendChild(bsp);
    }
  }

  function setFlipped(on, animate) {
    const card = $("card");
    card.classList.toggle("no-anim", !animate);
    card.classList.toggle("flipped", on);
    $("hint").textContent = on ? "Tippen, um das Wort zu sehen" : "Tippen zum Umdrehen";
    if (!animate) void card.offsetWidth;
    card.classList.remove("no-anim");
  }

  function renderMarks(item) {
    const box = $("marks");
    box.textContent = "";
    MARKS.forEach((m) => {
      const b = el("button", "mark mark-" + m.id);
      b.type = "button";
      b.setAttribute("aria-pressed", String(hasMark(item, m.id)));
      b.innerHTML = iconSvg(m, "mark-icon");
      b.append(m.label);
      b.addEventListener("click", () => {
        toggleMark(item, m.id);
        b.setAttribute("aria-pressed", String(hasMark(item, m.id)));
      });
      box.appendChild(b);
    });
  }

  function showCard(index) {
    const items = state.deck;
    const item = items[index];
    state.cardIndex = index;
    setFlipped(false, false);
    renderFront(item);
    renderBack(item);
    renderMarks(item);
    $("barTitle").textContent = tab().label;
    $("barPos").textContent = index + 1 + " / " + items.length;
    $("prev").disabled = index === 0;
    $("next").disabled = index === items.length - 1;
  }

  function step(delta) {
    const items = state.deck;
    const i = state.cardIndex + delta;
    if (i < 0 || i >= items.length) return;
    history.replaceState(null, "", "#" + state.tab + "/" + slug(items[i].w));
    showCard(i);
  }

  /* Setting only u.lang is not enough: many browsers then read with the
     device's default voice, so German comes out with an English accent.
     The voice has to be chosen by hand. Android reports "de_DE", hence the replace. */
  function germanVoice(voices) {
    const german = voices.filter((v) => /^de\b/i.test(v.lang.replace("_", "-")));
    const rank = (v) =>
      (/^de[-_]DE/i.test(v.lang) ? 0 : 2) + (/anna|petra|markus|viktor|katja|hedda|google/i.test(v.name) ? 0 : 1);
    return german.sort((a, b) => rank(a) - rank(b))[0] || null;
  }

  function speak() {
    const item = state.deck[state.cardIndex];
    if (!item) return;
    const voices = speechSynthesis.getVoices();
    const voice = germanVoice(voices);
    // An empty list means the voices have not loaded yet, so still try with u.lang.
    if (voices.length && !voice) {
      $("hint").textContent = "No German voice on this device. Add German in your text-to-speech settings.";
      return;
    }
    const u = new SpeechSynthesisUtterance(item.w.replace("der/die", "der").replace(/^\(sich\) /, ""));
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang.replace("_", "-") : "de-DE";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* Routing: #tab shows the list, #tab/word shows the card */
  function route() {
    const [tabId, wordSlug] = location.hash.slice(1).split("/");
    const known = TABS.some((t) => t.id === tabId);
    const changedTab = known && tabId !== state.tab;
    if (known) state.tab = tabId;
    try { localStorage.setItem("b2-tab", state.tab); } catch (e) { /* storage is optional */ }

    let index = -1;
    if (wordSlug) {
      // The deck is fixed while a card is open, so removing a mark from a word
      // in a filtered list does not make the card disappear under your finger.
      state.deck = visibleItems();
      index = state.deck.findIndex((i) => slug(i.w) === wordSlug);
      if (index < 0) {
        state.filter = "alle";
        state.query = "";
        $("search").value = "";
        state.deck = visibleItems();
        index = state.deck.findIndex((i) => slug(i.w) === wordSlug);
      }
    }

    if (index >= 0) {
      $("listView").hidden = true;
      $("cardView").hidden = false;
      window.scrollTo(0, 0);
      showCard(index);
      return;
    }

    if ("speechSynthesis" in window) speechSynthesis.cancel();
    $("cardView").hidden = true;
    $("listView").hidden = false;
    renderTabs();
    renderChips();
    renderList();
    window.scrollTo(0, changedTab ? 0 : state.listScroll);
    if (changedTab) state.listScroll = 0;
  }

  /* Events */
  $("search").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderList();
  });
  $("back").addEventListener("click", () => {
    location.replace("#" + state.tab);
  });
  $("prev").addEventListener("click", () => slide(-1));
  $("next").addEventListener("click", () => slide(1));
  if ("speechSynthesis" in window) {
    speechSynthesis.getVoices(); // starts loading the list, which some browsers fill late
    $("speak").addEventListener("click", speak);
  } else {
    $("speak").hidden = true;
  }

  const card = $("card");
  let skipClick = false; // a swipe must not also flip the card
  const flip = () => setFlipped(!card.classList.contains("flipped"), true);
  card.addEventListener("click", () => {
    if (!skipClick) flip();
    skipClick = false;
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  });
  document.addEventListener("keydown", (e) => {
    if ($("cardView").hidden) return;
    if (e.key === "ArrowLeft") slide(-1);
    if (e.key === "ArrowRight") slide(1);
    if (e.key === "Escape") $("back").click();
  });

  /* Moving between words: the card leaves on one side and the next word
     arrives from the other. Swipes, the arrow buttons and keys all use this. */
  const scene = $("scene");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let sliding = false;

  const pose = (x) => "translateX(" + x + "px) rotate(" + (x / scene.offsetWidth) * 5 + "deg)";
  const move = (from, to, duration, easing) =>
    scene.animate([{ transform: pose(from) }, { transform: pose(to) }], { duration, easing, fill: "forwards" });

  async function settle(fromX) {
    sliding = true;
    scene.style.transform = "";
    const back = move(fromX, 0, 180, "ease-out");
    await back.finished.catch(() => {});
    back.cancel();
    sliding = false;
  }

  async function slide(delta, fromX = 0) {
    const i = state.cardIndex + delta;
    if (sliding) return;
    if (i < 0 || i >= state.deck.length) {
      if (fromX) settle(fromX);
      return;
    }
    scene.style.transform = "";
    if (calm.matches) {
      step(delta);
      return;
    }
    sliding = true;
    const off = (scene.offsetWidth + 32) * -delta;
    const leave = move(fromX, off, 160, "ease-in");
    await leave.finished.catch(() => {});
    // The list may have been reopened while the card was leaving.
    if (!$("cardView").hidden) step(delta);
    const arrive = move(-off, 0, 220, "cubic-bezier(.2, .8, .3, 1)");
    leave.cancel();
    await arrive.finished.catch(() => {});
    arrive.cancel();
    sliding = false;
  }

  // The card follows the finger. The first few pixels decide the direction, so
  // vertical movement stays free for scrolling a long explanation.
  let startX = 0, startY = 0, startT = 0, dragX = 0, dragging = null;
  const endDrag = () => {
    const wasDragging = dragging;
    dragging = null;
    return wasDragging;
  };
  scene.addEventListener("touchstart", (e) => {
    skipClick = false;
    if (sliding || e.touches.length > 1) {
      dragging = false;
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = e.timeStamp;
    dragX = 0;
    dragging = null;
  }, { passive: true });
  scene.addEventListener("touchmove", (e) => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (dragging === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dragging = Math.abs(dx) > Math.abs(dy);
    }
    if (!dragging) return;
    const delta = dx < 0 ? 1 : -1;
    const hasNext = state.deck[state.cardIndex + delta] !== undefined;
    dragX = hasNext ? dx : dx * 0.25; // resists at the first and last word
    scene.style.transform = pose(dragX);
  }, { passive: true });
  scene.addEventListener("touchend", (e) => {
    if (!endDrag()) return;
    skipClick = true;
    const speed = Math.abs(dragX) / Math.max(e.timeStamp - startT, 1);
    const far = Math.abs(dragX) > Math.min(80, scene.offsetWidth * 0.22);
    const flick = speed > 0.4 && Math.abs(dragX) > 25;
    if (far || flick) slide(dragX < 0 ? 1 : -1, dragX);
    else settle(dragX);
  }, { passive: true });
  scene.addEventListener("touchcancel", () => {
    if (endDrag()) settle(dragX);
  }, { passive: true });

  window.addEventListener("hashchange", route);

  if (!location.hash) {
    let saved = null;
    try { saved = localStorage.getItem("b2-tab"); } catch (e) { /* storage is optional */ }
    if (saved && TABS.some((t) => t.id === saved)) state.tab = saved;
    history.replaceState(null, "", "#" + state.tab);
  }
  route();
})();
