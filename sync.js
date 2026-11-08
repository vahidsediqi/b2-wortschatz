/*
  Saves the word marks in a secret GitHub gist, so they are the same on every device.

  The gist holds two files:
    b2-marks.json  the marks, plus the time each word was last changed
    vault.json     a GitHub token, encrypted with the username and password

  The password is never stored anywhere. Logging in downloads vault.json and
  tries to decrypt it; a wrong username or password simply fails to decrypt.
  The first login has no vault yet, so it asks once for a token (gist scope
  only) and saves it encrypted.
*/
(function () {
  "use strict";

  const API = "https://api.github.com/gists/0db89cd54cec49784d050ff2be2099aa";
  const MARKS_FILE = "b2-marks.json";
  const VAULT_FILE = "vault.json";
  const SESSION_KEY = "b2-session";

  const utf8 = new TextEncoder();
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function deriveKey(user, password, salt) {
    const secret = utf8.encode(user.trim().toLowerCase() + "\n" + password);
    const base = await crypto.subtle.importKey("raw", secret, "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function lock(user, password, token) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(user, password, salt);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8.encode(token));
    return JSON.stringify({ v: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(data) });
  }

  async function unlock(user, password, vaultText) {
    try {
      const v = JSON.parse(vaultText);
      const key = await deriveKey(user, password, fromB64(v.salt));
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(v.iv) }, key, fromB64(v.data));
      return new TextDecoder().decode(plain);
    } catch (e) {
      return null; // wrong username or password
    }
  }

  async function api(method, token, body) {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (body) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(API, { method, headers, body: body && JSON.stringify(body), cache: "no-store" });
    } catch (e) {
      throw Object.assign(new Error("offline"), { status: 0 });
    }
    if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { status: res.status });
    return res.json();
  }

  const fileText = (gist, name) => (gist.files && gist.files[name] ? gist.files[name].content : null);

  function session() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      return s && s.user && s.token ? s : null;
    } catch (e) {
      return null;
    }
  }

  // Returns { ok }, { needToken } or { error } with a message for the user.
  async function login(user, password, newToken) {
    let gist;
    try {
      gist = await api("GET");
    } catch (e) {
      return { error: "Keine Verbindung. Bitte versuchen Sie es später noch einmal." };
    }
    const vault = fileText(gist, VAULT_FILE);
    let token;
    if (vault) {
      token = await unlock(user, password, vault);
      if (!token) return { error: "Benutzername oder Passwort ist falsch." };
    } else {
      if (!newToken) return { needToken: true };
      token = newToken.trim();
      try {
        await api("PATCH", token, { files: { [VAULT_FILE]: { content: await lock(user, password, token) } } });
      } catch (e) {
        return {
          error: e.status === 0
            ? "Keine Verbindung. Bitte versuchen Sie es später noch einmal."
            : "Dieser Token funktioniert nicht. Er braucht die Berechtigung „gist“.",
        };
      }
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user.trim(), token }));
    } catch (e) {
      return { error: "Dieser Browser kann die Anmeldung nicht speichern." };
    }
    return { ok: true };
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* nothing to remove */ }
  }

  // For each word the newer change wins, so a mark removed on one phone does
  // not come back from another phone.
  function merge(a, b) {
    const marks = {};
    const times = {};
    const keys = new Set([...Object.keys(a.times), ...Object.keys(b.times), ...Object.keys(a.marks), ...Object.keys(b.marks)]);
    keys.forEach((k) => {
      const ta = a.times[k] || 0;
      const tb = b.times[k] || 0;
      const win = tb > ta ? b : a;
      const t = Math.max(ta, tb);
      if (t) times[k] = t;
      if (win.marks[k] && win.marks[k].length) marks[k] = win.marks[k];
    });
    return { marks, times };
  }

  // Merges local and saved marks, saves the result and returns it.
  async function sync(local) {
    const s = session();
    if (!s) throw Object.assign(new Error("logged out"), { status: 401 });
    const gist = await api("GET", s.token);
    let remote = { marks: {}, times: {} };
    try {
      const parsed = JSON.parse(fileText(gist, MARKS_FILE) || "{}");
      remote = { marks: parsed.marks || {}, times: parsed.times || {} };
    } catch (e) { /* an empty or broken file starts fresh */ }
    const merged = merge(local, remote);
    if (JSON.stringify(merged) !== JSON.stringify(remote)) {
      await api("PATCH", s.token, { files: { [MARKS_FILE]: { content: JSON.stringify(merged) } } });
    }
    return merged;
  }

  window.B2Sync = { session, login, logout, sync };
})();
