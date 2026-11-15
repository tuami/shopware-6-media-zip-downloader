// ==UserScript==
// @name shopware-6-media-zip-downloader
// @namespace https://github.com/tuami/shopware-6-media-zip-downloader
// @version 1.0.0
// @description Markierte Shopware-6-Bilder lokal als ZIP herunterladen.
// @author tuami
// @license MIT
// @match https://shop.example.invalid/admin*
// @run-at document-idle
// @grant none
// @sandbox raw
// @inject-into page
// @noframes
// ==/UserScript==

// Einrichtung: @match oben auf die eigene Shop-Domain und den Admin-Pfad ändern.
// Nur einmal installieren; keine zusätzliche JavaScript-Bibliothek erforderlich.
(() => {
  "use strict";

  const BUTTON_ID = "sw-selected-zip-button";
  const INSTANCE_KEY = "__shopwareMediaZipDownloader";
  const PAGE_SIZE = 100;
  const MAX_BYTES = 512 * 1024 * 1024; // Gesamte Bilddaten: 512 MiB.
  const REQUEST_TIMEOUT_MS = 60000;
  let downloading = false;
  let observer;
  let scheduled = false;
  let destroyed = false;
  let activeController = null;

  // Auf wiederholtes Einfügen reagieren, ohne zusätzliche Observer zu starten.
  if (window[INSTANCE_KEY]) {
    console.info("[Shopware ZIP] Bereits aktiviert; zum Aktualisieren Seite neu laden.");
    return;
  }

  function sidebar() {
    return document.querySelector(".sw-media-sidebar");
  }

  function findText(text) {
    return [...(sidebar()?.querySelectorAll("*") || [])].find(el =>
      el.children.length === 0 && el.textContent.trim() === text
    );
  }

  function getSelectionCount() {
    const headline = sidebar()?.querySelector(".sw-media-sidebar__headline");
    const match = headline?.textContent.trim().match(/^(\d+)\s+ausgewählte Dateien$/i);
    return match ? Number(match[1]) : 0;
  }

  function getFolderId() {
    const match = location.href.match(/\/sw\/media\/index\/([a-f0-9]{32})(?=[/?#]|$)/i);
    if (!match) throw new Error("Bitte einen konkreten Medienordner öffnen (nicht das Stammverzeichnis).");
    return match[1];
  }

  function getShopware() {
    const SW = window.Shopware;
    if (!SW?.Service || !SW?.Data?.Criteria || !SW?.Context?.api) {
      throw new Error("Shopware nicht erreichbar. Im Seitenkontext ausführen; „Isolated environment“ deaktivieren.");
    }
    return SW;
  }

  // Kleinbuchstaben, keine Leerzeichen, keine Pfade; kompatibel mit Windows.
  function normalizeName(value) {
    let name = String(value || "")
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-")
      .replace(/^[.\s-]+|[.\s-]+$/g, "");
    if (!name) name = "datei";
    if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = "datei-" + name;
    if (name.length > 160) {
      const extension = name.match(/\.[a-z0-9]{1,16}$/)?.[0] || "";
      name = name.slice(0, 160 - extension.length).replace(/[.-]+$/g, "") + extension;
    }
    return name;
  }

  // Originalnamen nur zum Auflösen der Auswahl verwenden.
  function fileName(media) {
    const name = String(media.fileName || media.id);
    const ext = String(media.fileExtension || "");
    return ext ? name + "." + ext : name;
  }

  function archiveName(folderName, count) {
    return "shopware-" + normalizeName(folderName) + "-" + count + "-bilder.zip";
  }

  async function getFolderName(folderId) {
    try {
      const SW = getShopware();
      const folder = await SW.Service("repositoryFactory")
        .create("media_folder").get(folderId, SW.Context.api);
      return folder?.name || "medien";
    } catch (error) {
      console.warn("[Shopware ZIP] Ordnername nicht abrufbar; verwende medien.", error);
      return "medien";
    }
  }

  // Vue-3-Interna sind keine stabile Shopware-API. Ausschließlich die
  // Komponenten der Auswahl-Seitenleiste prüfen, niemals das Medienraster.
  function selectionFromVue(expected) {
    const area = sidebar();
    if (!area) return null;
    const roots = [area.querySelector(".sw-media-quickinfo-multiple"), area].filter(Boolean);
    for (const root of roots) {
      const component = root.__vueParentComponent;
      if (!component) continue;
      for (const source of [component.props, component.setupState, component.proxy, component.ctx]) {
        if (!source) continue;
        for (const key of ["items", "selectedItems", "selectedMedia", "selectedMediaItems"]) {
          try {
            let items = source[key];
            if (!Array.isArray(items)) items = items?.value;
            if (!Array.isArray(items) || items.length !== expected) continue;
            if (!items.every(item => item && /^[a-f0-9]{32}$/i.test(item.id))) continue;
            if (items.some(item => typeof item.getEntityName === "function" &&
              item.getEntityName() !== "media")) {
              throw new Error("Die Auswahl enthält Ordner. Bitte ausschließlich Bilder markieren.");
            }
            const ids = items.map(item => item.id.toLowerCase());
            if (new Set(ids).size === expected) return ids;
          } catch (error) {
            if (error.message?.includes("enthält Ordner")) throw error;
            // Nicht passende/gettergeschützte Komponenten überspringen.
          }
        }
      }
    }
    return null;
  }

  // Auswahl vor der ersten Netzwerkanfrage einfrieren.
  function captureSelection() {
    const expected = getSelectionCount();
    if (expected < 2) throw new Error("Bitte mindestens zwei Bilder im selben Ordner auswählen.");
    const ids = selectionFromVue(expected);
    if (ids) return { expected, ids };
    const root = sidebar()?.querySelector(".sw-media-quickinfo-multiple");
    if (!root || !findText("Ausgewählte Dateien")) {
      throw new Error("Auswahlliste nicht eindeutig erkannt. Bitte Shopware-Version und Seitenkontext prüfen.");
    }
    const values = [];
    for (const el of root.querySelectorAll("*")) {
      if (el.closest("[role='dialog'],.sw-modal")) continue;
      if (el.children.length === 0) values.push(el.textContent.trim());
      for (const attr of ["title", "aria-label", "data-original-title"]) {
        const value = el.getAttribute(attr);
        if (value) values.push(value.trim());
      }
    }
    return { expected, values };
  }

  function resolveSelection(media, snapshot) {
    const { expected, ids, values } = snapshot;
    if (ids) {
      const wanted = new Set(ids);
      const selected = media.filter(item => wanted.has(item.id.toLowerCase()));
      if (selected.length !== expected) {
        throw new Error("Nicht alle markierten Medien gehören zum geöffneten Ordner. Auswahl erneut setzen.");
      }
      return selected;
    }
    const available = new Map();
    for (const item of media) {
      const key = fileName(item).toLowerCase();
      available.set(key, [...(available.get(key) || []), item]);
    }
    const names = new Set(values.map(value => value.toLowerCase()).filter(value => available.has(value)));
    if (names.size !== expected) {
      throw new Error("Die Auswahlliste ist unvollständig. Bereich „Ausgewählte Dateien“ vollständig aufklappen.");
    }
    return [...names].map(name => {
      const matches = available.get(name);
      if (matches.length !== 1) throw new Error("Dateiname nicht eindeutig: " + name);
      return matches[0];
    });
  }

  async function loadMedia(setStatus, folderId, assertRoute) {
    const SW = getShopware();
    const { Criteria } = SW.Data;
    const repo = SW.Service("repositoryFactory").create("media");
    const media = [];
    const seen = new Set();
    for (let page = 1; ; page++) {
      assertRoute();
      setStatus("Suche Bilder (" + media.length + ") …");
      const criteria = new Criteria(page, PAGE_SIZE);
      criteria.addFilter(Criteria.equals("mediaFolderId", folderId));
      criteria.addSorting(Criteria.sort("id", "ASC"));
      const result = await repo.search(criteria, SW.Context.api);
      assertRoute();
      const elements = typeof result.getElements === "function" ? result.getElements() : result;
      const rows = Array.from(elements);
      for (const row of rows) {
        if (!row?.id || seen.has(row.id.toLowerCase())) {
          throw new Error("Medienliste hat doppelte oder ungültige IDs. Bitte erneut versuchen.");
        }
        seen.add(row.id.toLowerCase());
        media.push(row);
      }
      if (rows.length < PAGE_SIZE) return media;
    }
  }

  async function fetchFile(media, remainingBytes, assertRoute) {
    if (!media.url) throw new Error("Keine Original-Bild-URL vorhanden.");
    const url = new URL(media.url, location.origin);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Ungültige Datei-URL.");
    const candidates = [url.href];
    if (url.origin !== location.origin && url.pathname.startsWith("/media/")) {
      candidates.push(location.origin + url.pathname + url.search);
    }
    let lastError;
    for (const candidate of candidates) {
      assertRoute();
      const controller = new AbortController();
      activeController = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let reader;
      try {
        const target = new URL(candidate);
        const response = await fetch(candidate, {
          credentials: target.origin === location.origin ? "same-origin" : "omit",
          signal: controller.signal
        });
        assertRoute();
        if (!response.ok) throw new Error("HTTP " + response.status);
        const type = (response.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
        if (type && !type.startsWith("image/") && type !== "application/octet-stream") {
          throw new Error("Antwort ist keine Bilddatei (" + type + ").");
        }
        if (Number(response.headers.get("content-length")) > remainingBytes) {
          throw new Error("Speicherlimit von 512 MiB überschritten; kleinere Auswahl verwenden.");
        }
        // Streaming begrenzt auch Antworten ohne Content-Length.
        reader = response.body?.getReader();
        let data;
        if (reader) {
          const chunks = [];
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            assertRoute();
            if (done) break;
            total += value.byteLength;
            if (total > remainingBytes) throw new Error("Speicherlimit von 512 MiB überschritten; kleinere Auswahl verwenden.");
            chunks.push(value);
          }
          data = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
        } else {
          data = new Uint8Array(await response.arrayBuffer());
          if (data.length > remainingBytes) throw new Error("Speicherlimit von 512 MiB überschritten; kleinere Auswahl verwenden.");
        }
        assertRoute();
        if (!data.length) throw new Error("Leere Bilddatei erhalten.");
        // Auch falsch als Bild ausgezeichnete Login-/Fehlerseiten ablehnen.
        const prefix = new TextDecoder().decode(data.subarray(0, 256)).trimStart();
        if (/^(?:<!doctype\s+html|<html(?:\s|>))/i.test(prefix)) throw new Error("HTML statt Bild erhalten.");
        return data;
      } catch (error) {
        assertRoute();
        lastError = error.name === "AbortError" ? new Error("Bildabruf nach 60 Sekunden abgebrochen.") : error;
        if (lastError.message.includes("Speicherlimit")) throw lastError;
      } finally {
        clearTimeout(timeout);
        if (reader) await reader.cancel().catch(() => {});
        controller.abort();
        activeController = null;
      }
    }
    throw lastError;
  }

  function createZip(files) {
    if (files.length > 65535) throw new Error("Zu viele Dateien für ZIP32.");
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    const crcTable = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
      let c = n;

      for (let k = 0; k < 8; k++) {
        c = c & 1
          ? 0xEDB88320 ^ (c >>> 1)
          : c >>> 1;
      }

      crcTable[n] = c >>> 0;
    }

    function crc32(data) {
      let crc = 0xFFFFFFFF;

      for (const b of data) {
        crc = crcTable[(crc ^ b) & 255] ^
          (crc >>> 8);
      }

      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    let offset = 0;
    const usedNames = new Set();

    for (const file of files) {
      const data = file.data;

      let name = normalizeName(file.name);

      if (usedNames.has(name.toLowerCase())) {
        const dot = name.lastIndexOf(".");

        const base = dot >= 0
          ? name.slice(0, dot)
          : name;

        const ext = dot >= 0
          ? name.slice(dot)
          : "";

        let number = 2;

        do {
          name = `${base}-${number++}${ext}`;
        } while (usedNames.has(name.toLowerCase()));
      }

      usedNames.add(name.toLowerCase());

      const filename = encoder.encode(name);
      if (filename.length > 65535) throw new Error("Dateiname zu lang.");
      const checksum = crc32(data);

      if (
        data.length > 0xFFFFFFFF ||
        offset + 30 + filename.length +
          data.length > 0xFFFFFFFF
      ) {
        throw new Error("ZIP-Größenlimit überschritten.");
      }

      const local = new Uint8Array(
        30 + filename.length
      );

      const l = new DataView(local.buffer);

      l.setUint32(0, 0x04034B50, true);
      l.setUint16(4, 20, true);
      l.setUint16(6, 0x0800, true);
      l.setUint16(12, 0x0021, true); // Gültiges DOS-Datum: 1980-01-01.
      l.setUint32(14, checksum, true);
      l.setUint32(18, data.length, true);
      l.setUint32(22, data.length, true);
      l.setUint16(26, filename.length, true);

      local.set(filename, 30);

      const central = new Uint8Array(
        46 + filename.length
      );

      const c = new DataView(central.buffer);

      c.setUint32(0, 0x02014B50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(14, 0x0021, true);
      c.setUint32(16, checksum, true);
      c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true);
      c.setUint16(28, filename.length, true);
      c.setUint32(42, offset, true);

      central.set(filename, 46);

      localParts.push(local, data);
      centralParts.push(central);

      offset += local.length + data.length;
    }

    if (files.length > 65535) {
      throw new Error("Zu viele Dateien.");
    }

    const centralSize = centralParts.reduce(
      (sum, part) => sum + part.length,
      0
    );

    if (offset + centralSize + 22 > 0xFFFFFFFF) {
      throw new Error("ZIP ist größer als 4 GB.");
    }

    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);

    e.setUint32(0, 0x06054B50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);

    return new Blob(
      [...localParts, ...centralParts, end],
      { type: "application/zip" }
    );
  }


  async function downloadSelected(button) {
    if (downloading) return;
    downloading = true;
    button.disabled = true;
    const originalRoute = location.href;
    const assertRoute = () => {
      if (destroyed || location.href !== originalRoute) {
        throw new Error("Medienansicht während des Downloads gewechselt. Bitte erneut starten.");
      }
    };
    const status = text => { button.textContent = text; };
    try {
      const folderId = getFolderId();
      const snapshot = captureSelection();
      const folderName = await getFolderName(folderId);
      assertRoute();
      const media = await loadMedia(status, folderId, assertRoute);
      const selected = resolveSelection(media, snapshot);
      if (selected.some(item => !item.mimeType?.toLowerCase().startsWith("image/"))) {
        throw new Error("Die Auswahl enthält Nicht-Bilddateien. Bitte ausschließlich Bilder markieren.");
      }
      const files = [];
      const failures = [];
      let bytes = 0;
      for (let i = 0; i < selected.length; i++) {
        assertRoute();
        const item = selected[i];
        status("Lade " + (i + 1) + "/" + selected.length + " …");
        try {
          const data = await fetchFile(item, MAX_BYTES - bytes, assertRoute);
          bytes += data.byteLength;
          files.push({ name: fileName(item), data });
        } catch (error) {
          assertRoute();
          if (error.message.includes("Speicherlimit")) throw error;
          console.error("[Shopware ZIP] Bildabruf fehlgeschlagen:", fileName(item), error);
          failures.push(fileName(item));
        }
        assertRoute();
      }
      if (!files.length) throw new Error("Kein Bild konnte geladen werden. Netzwerkzugriff und CORS prüfen.");
      if (failures.length && !confirm(
        failures.length + " Bilder konnten nicht geladen werden:\n\n" +
        failures.join("\n") + "\n\nZIP mit " + files.length + " Bildern trotzdem erstellen?"
      )) return;
      assertRoute();
      status("Erstelle ZIP …");
      const zip = createZip(files);
      assertRoute();
      const zipFileName = archiveName(folderName, files.length);
      const zipUrl = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = zipFileName;
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);
      }
      status("✓ " + files.length + " Bilder");
      console.info("[Shopware ZIP] Download angestoßen:", zipFileName);
    } catch (error) {
      console.error("[Shopware ZIP] Fehler:", error);
      alert("ZIP-Download fehlgeschlagen:\n\n" + error.message);
    } finally {
      downloading = false;
      button.disabled = false;
      setTimeout(() => { button.textContent = "Auswahl als ZIP"; }, 2000);
    }
  }

  function removeButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    (button.closest("[data-sw-zip-slot]") || button).remove();
  }

  function injectButton() {
    if (destroyed) return;
    const oldButton = document.getElementById(BUTTON_ID);
    if (!/\/sw\/media\/index\/[a-f0-9]{32}(?=[/?#]|$)/i.test(location.href) ||
      getSelectionCount() < 2) {
      if (!downloading) removeButton();
      return;
    }
    if (oldButton) return;
    const area = sidebar();
    if (!findText("Aktionen")) return;
    const controls = [...area.querySelectorAll("button,a,[role='button']")];
    const move = controls.find(el => el.textContent.trim() === "Verschieben");
    const remove = controls.find(el => el.textContent.trim() === "Löschen");
    if (!move || !remove) return;
    // Echtes Button-Element: Enter/Leertaste funktionieren ohne geerbte Aktionen.
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Auswahl als ZIP";
    button.title = "Die aktuell markierten Bilder als ZIP herunterladen";
    Object.assign(button.style, {
      display: "inline-flex", alignItems: "center", cursor: "pointer",
      color: "#0b67ed", background: "transparent", border: "none",
      padding: "8px", font: "inherit", textAlign: "left"
    });
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      void downloadSelected(button);
    });
    const item = move.closest("li");
    if (item && ["UL", "OL"].includes(item.parentElement?.tagName)) {
      const slot = document.createElement("li");
      slot.setAttribute("data-sw-zip-slot", "");
      slot.appendChild(button);
      item.after(slot);
    } else {
      move.after(button);
    }
  }

  function start() {
    if (destroyed) return;
    injectButton();
    observer = new MutationObserver(() => {
      if (scheduled || destroyed) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; injectButton(); });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.info("[Shopware ZIP] Aktiviert.");
  }

  // BOOTSTRAP
  window[INSTANCE_KEY] = {
    stop() {
      destroyed = true;
      activeController?.abort();
      observer?.disconnect();
      removeButton();
      delete window[INSTANCE_KEY];
    }
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
