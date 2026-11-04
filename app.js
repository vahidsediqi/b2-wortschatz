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

  const state = { tab: "verben", chapter: "alle", query: "", cardIndex: -1, listScroll: 0 };
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

  function visibleItems() {
    const q = state.query.trim().toLowerCase();
    return tab().items.filter((i) => {
      if (state.chapter !== "alle" && i.k !== state.chapter) return false;
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
        state.chapter = "alle";
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
    const chapters = [...new Set(tab().items.map((i) => i.k))].sort((a, b) => a - b);
    ["alle", ...chapters].forEach((c) => {
      const b = el("button", "chip", c === "alle" ? "Alle" : "Kapitel " + c);
      b.type = "button";
      b.setAttribute("aria-pressed", String(state.chapter === c));
      b.addEventListener("click", () => {
        state.chapter = c;
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
      b.append(word, el("span", "row-k", "K" + item.k));
      b.insertAdjacentHTML("beforeend", '<svg class="row-go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>');
      b.addEventListener("click", () => {
        state.listScroll = window.scrollY;
        location.hash = state.tab + "/" + slug(item.w);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    if (!items.length) {
      list.textContent = "";
      $("count").textContent = "Kein Wort gefunden. Prüfen Sie die Schreibweise oder wählen Sie „Alle“.";
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
  }

  function setFlipped(on, animate) {
    const card = $("card");
    card.classList.toggle("no-anim", !animate);
    card.classList.toggle("flipped", on);
    $("hint").textContent = on ? "Tippen, um das Wort zu sehen" : "Tippen zum Umdrehen";
    if (!animate) void card.offsetWidth;
    card.classList.remove("no-anim");
  }

  function showCard(index) {
    const items = visibleItems();
    const item = items[index];
    state.cardIndex = index;
    setFlipped(false, false);
    renderFront(item);
    renderBack(item);
    $("barTitle").textContent = tab().label;
    $("barPos").textContent = index + 1 + " / " + items.length;
    $("prev").disabled = index === 0;
    $("next").disabled = index === items.length - 1;
  }

  function step(delta) {
    const items = visibleItems();
    const i = state.cardIndex + delta;
    if (i < 0 || i >= items.length) return;
    history.replaceState(null, "", "#" + state.tab + "/" + slug(items[i].w));
    showCard(i);
  }

  function speak() {
    const item = visibleItems()[state.cardIndex];
    if (!item) return;
    const u = new SpeechSynthesisUtterance(item.w.replace("der/die", "der").replace(/^\(sich\) /, ""));
    u.lang = "de-DE";
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
      index = visibleItems().findIndex((i) => slug(i.w) === wordSlug);
      if (index < 0) {
        state.chapter = "alle";
        state.query = "";
        $("search").value = "";
        index = visibleItems().findIndex((i) => slug(i.w) === wordSlug);
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
  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));
  if ("speechSynthesis" in window) $("speak").addEventListener("click", speak);
  else $("speak").hidden = true;

  const card = $("card");
  const flip = () => setFlipped(!card.classList.contains("flipped"), true);
  card.addEventListener("click", flip);
  card.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  });
  document.addEventListener("keydown", (e) => {
    if ($("cardView").hidden) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
    if (e.key === "Escape") $("back").click();
  });

  // Horizontal swipe moves between words; vertical movement stays free for
  // scrolling a long explanation.
  let startX = 0, startY = 0;
  const scene = $("scene");
  scene.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  scene.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
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
