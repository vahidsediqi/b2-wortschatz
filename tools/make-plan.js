/*
  Builds plan.js: which month each word is learned in before the exam at the
  end of January 2027.

    node tools/make-plan.js

  Words already in plan.js keep their month, so the plan never reshuffles.
  New words go to the month they were added in (January after that).

  The first run split the words by the days left in each month, so every
  day has about the same number of new words. Each word type is split on
  its own, so every month has nouns, verbs, adjectives and connectors.
*/
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PLAN_FILE = path.join(ROOT, "plan.js");

const MONTHS = [
  { id: "nov", label: "November", year: 2026, from: "2026-11-20", to: "2026-11-30" },
  { id: "dec", label: "Dezember", year: 2026, from: "2026-12-01", to: "2026-12-31" },
  { id: "jan", label: "Januar", year: 2027, from: "2027-01-01", to: "2027-01-31" },
];

global.window = {};
require(path.join(ROOT, "words.js"));
const W = window.WORDS;

const slug = (w) =>
  w.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// A fixed mixing order, so the same words always land in the same month.
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

let words = {};
if (fs.existsSync(PLAN_FILE)) {
  const sandbox = {};
  new Function("window", fs.readFileSync(PLAN_FILE, "utf8"))(sandbox);
  words = sandbox.PLAN.words;
}

const today = new Date().toISOString().slice(0, 10);
const currentMonth = (MONTHS.find((m) => today <= m.to) || MONTHS[MONTHS.length - 1]).id;
const days = (m) => (Date.parse(m.to) - Date.parse(m.from)) / 864e5 + 1;
const firstRun = Object.keys(words).length === 0;

const all = new Set();
let added = 0;
for (const list of Object.values(W)) {
  const fresh = list.map((i) => slug(i.w)).filter((s) => !words[s]);
  list.forEach((i) => all.add(slug(i.w)));
  if (!fresh.length) continue;
  added += fresh.length;
  if (!firstRun) {
    fresh.forEach((s) => (words[s] = currentMonth));
    continue;
  }
  fresh.sort((a, b) => hash(a) - hash(b));
  const total = MONTHS.reduce((n, m) => n + days(m), 0);
  let start = 0;
  let used = 0;
  MONTHS.forEach((m, i) => {
    used += days(m);
    const end = i === MONTHS.length - 1 ? fresh.length : Math.round((fresh.length * used) / total);
    fresh.slice(start, end).forEach((s) => (words[s] = m.id));
    start = end;
  });
}

// Words removed from words.js leave the plan too.
let removed = 0;
for (const s of Object.keys(words)) {
  if (!all.has(s)) {
    delete words[s];
    removed++;
  }
}

const sorted = Object.fromEntries(Object.keys(words).sort().map((s) => [s, words[s]]));
const out =
  "/* Made by tools/make-plan.js. Run it again after adding words. */\n" +
  "window.PLAN = " + JSON.stringify({ exam: "Ende Januar 2027", months: MONTHS, words: sorted }, null, 1) + ";\n";
fs.writeFileSync(PLAN_FILE, out);

const count = (id) => Object.values(sorted).filter((m) => m === id).length;
console.log(
  added + " added, " + removed + " removed. " +
  MONTHS.map((m) => m.label + " " + count(m.id)).join(", ")
);
