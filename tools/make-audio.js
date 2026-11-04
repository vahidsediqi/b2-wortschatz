#!/usr/bin/env node
// Records one German audio file per word with the Mac's Anna voice, so the
// sound button does not depend on the voices installed on each phone.
// Run from the repo root after adding words: node tools/make-audio.js
// Existing files are kept. The text and file name rules match app.js.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

global.window = {};
require(path.resolve("words.js"));

const slug = (w) =>
  w.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const spoken = (w) => w.replace("der/die", "der").replace(/^\(sich\) /, "");

let made = 0;
for (const item of Object.values(window.WORDS).flat()) {
  const file = path.join("audio", slug(item.w) + ".m4a");
  if (fs.existsSync(file)) continue;
  execFileSync("say", ["-v", "Anna", "-r", "160", "-o", file, "--file-format=m4af", "--data-format=aac", "--bit-rate=48000", spoken(item.w)]);
  made++;
}
console.log(made + " new files, " + fs.readdirSync("audio").length + " in audio/");
