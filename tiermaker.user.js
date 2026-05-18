// ==UserScript==
// @name         Tiermaker Liberator
// @namespace    interactive-tierlist
// @version      1.0.0
// @description  Export tierlist as JSON with rows + untiered; convert remote image URLs to data: URLs
// @match        *://tiermaker.com/*
// @match        file://*/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  const UNTIERED_RE = /untiered|unranked|not\s*tiered|remaining/i;
  const dataUrlCache = new Map();

  function textOf(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function firstNonEmpty(values) {
    for (const v of values) {
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
    return '';
  }

  function normalizeUrl(src) {
    if (!src) return '';
    if (src.startsWith('data:')) return src;
    try {
      return new URL(src, location.href).href;
    } catch {
      return src;
    }
  }

  function isLikelyRowName(name) {
    if (!name) return false;
    if (name.length > 48) return false;
    if (/share|download|copy|login|sign in|facebook|twitter|settings/i.test(name)) return false;
    return true;
  }

  function uniqueElements(arr) {
    return [...new Set(arr)];
  }

  function getRowImageElements(rowEl) {
    const explicit = Array.from(
      rowEl.querySelectorAll('.character img, .draggable img, img.character, img.draggable')
    );

    const imgs = explicit.length ? explicit : Array.from(rowEl.querySelectorAll('img'));

    return uniqueElements(
      imgs.filter((img) => {
        const src = img.currentSrc || img.getAttribute('src') || '';
        if (!src) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) return false;

        return true;
      })
    );
  }

  function extractRowName(rowEl) {
    const candidates = [];
    candidates.push(
      ...rowEl.querySelectorAll(
        '[class*="label"], [class*="tier"], [class*="rank"], span, h2, h3, h4, p'
      )
    );

    for (const el of candidates) {
      const t = textOf(el);
      if (isLikelyRowName(t)) return t;
    }

    return '';
  }

  function collectRowsFromParent(parentEl) {
    const rows = [];

    for (const child of Array.from(parentEl.children)) {
      const imgs = getRowImageElements(child);
      if (!imgs.length || imgs.length > 400) continue;

      const name = extractRowName(child);
      if (!isLikelyRowName(name)) continue;

      rows.push({ name, imgEls: imgs, rowEl: child });
    }

    return rows;
  }

  function findBestRowSet() {
    const main = document.querySelector('#main-container') || document.body;

    const seedSelectors = [
      '#char-tier-container-scroll',
      '#char-tier-outer-container-scroll',
      '#char-tier-container',
      '[id*="char-tier"]',
      '[id*="tier-container"]',
      '[class*="tier-container"]',
      '[class*="tier-list"]',
    ];

    const seeds = new Set();
    for (const sel of seedSelectors) {
      for (const el of document.querySelectorAll(sel)) seeds.add(el);
    }

    // Fallback seeds
    for (const el of Array.from(main.querySelectorAll('[id*="tier"], [class*="tier"]')).slice(0, 200)) {
      seeds.add(el);
    }
    seeds.add(main);

    let bestRows = [];
    let bestParent = null;

    for (const seed of seeds) {
      const parentCandidates = [seed, ...Array.from(seed.children)];
      for (const parent of parentCandidates) {
        const rows = collectRowsFromParent(parent);
        if (rows.length > bestRows.length) {
          bestRows = rows;
          bestParent = parent;
        }
      }
    }

    return { rows: bestRows, parent: bestParent };
  }

  function findUntieredElements(searchRoot, usedRowEls) {
    const selectors = [
      '[id*="untiered"]',
      '[class*="untiered"]',
      '[id*="unranked"]',
      '[class*="unranked"]',
    ];

    for (const sel of selectors) {
      for (const el of searchRoot.querySelectorAll(sel)) {
        if (usedRowEls.has(el)) continue;
        const imgs = getRowImageElements(el);
        if (imgs.length) return imgs;
      }
    }

    return [];
  }

  function detectTitle() {
    const h1 = textOf(document.querySelector('h1'));
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    let title = firstNonEmpty([h1, og, document.title, 'Untitled Tierlist']);
    title = title
      .replace(/\|\s*TierMaker.*$/i, '')
      .replace(/\s*Tier List Maker.*$/i, '')
      .trim();
    return title || 'Untitled Tierlist';
  }

  function getImageTitle(img) {
    return firstNonEmpty([
      img.getAttribute('data-title'),
      img.getAttribute('title'),
      img.getAttribute('alt'),
      img.closest('[data-title]')?.getAttribute('data-title'),
      img.closest('[title]')?.getAttribute('title'),
      '',
    ]);
  }

  function getImageDescription(img) {
    return firstNonEmpty([
      img.getAttribute('data-description'),
      img.getAttribute('data-desc'),
      img.closest('[data-description]')?.getAttribute('data-description'),
      img.closest('[data-desc]')?.getAttribute('data-desc'),
      '',
    ]);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed converting blob to data URL'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  }

  function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('GM_xmlhttpRequest unavailable'));
        return;
      }

      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        onload: (res) => {
          if (res.status < 200 || res.status >= 400 || !res.response) {
            reject(new Error(`GM request failed (${res.status})`));
            return;
          }

          const ctMatch = /content-type:\s*([^\r\n;]+)/i.exec(res.responseHeaders || '');
          const mime = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';
          resolve(new Blob([res.response], { type: mime }));
        },
        onerror: () => reject(new Error('GM request network error')),
      });
    });
  }

  async function toDataUrl(src) {
    const normalized = normalizeUrl(src);
    if (!normalized) return '';
    if (normalized.startsWith('data:')) return normalized;

    if (dataUrlCache.has(normalized)) return dataUrlCache.get(normalized);

    const p = (async () => {
      try {
        const res = await fetch(normalized);
        if (!res.ok) throw new Error(`fetch failed (${res.status})`);
        const blob = await res.blob();
        return await blobToDataUrl(blob);
      } catch {
        const blob = await gmFetchBlob(normalized);
        return await blobToDataUrl(blob);
      }
    })().catch(() => normalized); // final fallback: keep original URL

    dataUrlCache.set(normalized, p);
    return p;
  }

  async function imageElToTierImage(imgEl) {
    const rawSrc = imgEl.currentSrc || imgEl.getAttribute('src') || '';
    return {
      src: await toDataUrl(rawSrc),
      title: getImageTitle(imgEl),
      description: getImageDescription(imgEl),
    };
  }

  async function buildTierlistFile() {
    const { rows: rawRows, parent } = findBestRowSet();
    if (!rawRows.length) {
      throw new Error('Could not find tier rows in the page.');
    }

    const result = {
      title: detectTitle(),
      rows: [],
    };

    const usedRowEls = new Set();
    let untiered = null;

    for (const row of rawRows) {
      usedRowEls.add(row.rowEl);
      const imgs = await Promise.all(row.imgEls.map(imageElToTierImage));

      if (UNTIERED_RE.test(row.name)) {
        untiered = imgs;
      } else {
        result.rows.push({ name: row.name, imgs });
      }
    }

    if (!untiered) {
      const root = parent || document.body;
      const untieredEls = findUntieredElements(root, usedRowEls);
      if (untieredEls.length) {
        untiered = await Promise.all(untieredEls.map(imageElToTierImage));
      }
    }

    if (untiered && untiered.length) {
      result.untiered = untiered;
    }

    return result;
  }

  function downloadJson(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function slugify(name) {
    return (name || 'tierlist')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'tierlist';
  }

  async function exportNow() {
    const data = await buildTierlistFile();
    const json = JSON.stringify(data, null, 2);

    console.log('Tierlist JSON:', data);
    downloadJson(`${slugify(data.title)}.json`, json);

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).catch(() => {});
    }

    return data;
  }

  // Expose manual API for console use:
  window.exportTierlistJson = exportNow;

  // Small on-page button:
  const btn = document.createElement('button');
  btn.textContent = 'Export Tierlist JSON';
  btn.style.position = 'fixed';
  btn.style.right = '16px';
  btn.style.bottom = '16px';
  btn.style.zIndex = '999999';
  btn.style.padding = '8px 12px';
  btn.style.border = '1px solid #444';
  btn.style.borderRadius = '8px';
  btn.style.background = '#111';
  btn.style.color = '#fff';
  btn.style.cursor = 'pointer';

  btn.addEventListener('click', async () => {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Exporting...';
    try {
      await exportNow();
      btn.textContent = 'Exported ✔';
    } catch (err) {
      console.error(err);
      btn.textContent = 'Export failed';
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = original;
      }, 1800);
    }
  });

  document.body.appendChild(btn);
})();
