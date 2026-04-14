import { exists, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { generateCatalog, SOURCE_DIRS, serializeCatalog } from "./catalog";
import type { CatalogEntry } from "./schemas";

/**
 * Escapes HTML special characters to prevent script injection.
 * The `&` character is replaced first to avoid double-escaping.
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export interface BrowseOptions {
	port: number;
}

/**
 * Parses a port string to an integer and validates it is in the range 1–65535.
 * Exits with a descriptive error if the input is invalid.
 */
export function validatePort(portStr: string): number {
	const port = Number.parseInt(portStr, 10);
	if (!Number.isFinite(port) || port < 1 || port > 65535) {
		console.error(
			chalk.red(
				`Invalid port "${portStr}": must be an integer between 1 and 65535`,
			),
		);
		process.exit(1);
	}
	return port;
}

/**
 * Entry point for `forge catalog browse`.
 * Validates the port option and starts the browse server.
 */
export async function browseCommand(options: { port: string }): Promise<void> {
	const port = validatePort(options.port);
	await startBrowseServer({ port });
}

/**
 * Generates the complete HTML page for the catalog browser SPA.
 * All CSS and JS are inlined — no external resources.
 */
export function generateHtmlPage(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skill Forge Catalog</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-display: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--font-body);
      background: #f7f7f5;
      color: #1a1a1a;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    }
    code, pre, .mono {
      font-family: "Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace;
    }
    header {
      padding: 16px 24px;
      border-bottom: 1px solid #e4e4e0;
      background: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h1 {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #111;
    }
    .header-divider {
      width: 1px;
      height: 16px;
      background: #e0e0dc;
    }
    #artifact-count {
      font-size: 0.8rem;
      color: #999;
      font-weight: 400;
    }
    .filters {
      display: flex;
      flex-direction: column;
      gap: 0;
      border-bottom: 1px solid #e0e0dc;
      background: #fff;
    }
    .filter-search-row {
      padding: 12px 24px 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .filter-groups-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0;
      padding: 0 24px 10px;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 4px 16px 4px 0;
      margin-right: 16px;
      border-right: 1px solid #e8e8e4;
    }
    .filter-group:last-child {
      border-right: none;
      margin-right: 0;
    }
    .filter-group-label {
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #aaa;
      user-select: none;
    }
    .filter-group-items {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    #search-input {
      font-family: inherit;
      font-size: 0.875rem;
      padding: 6px 12px;
      border: 1px solid #d0d0cc;
      border-radius: 6px;
      background: #fafaf8;
      color: #1a1a1a;
      outline: none;
      min-width: 260px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #search-input:focus {
      border-color: #999;
      box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
    }
    #search-input::placeholder {
      color: #aaa;
    }
    .filter-group label {
      font-size: 0.78rem;
      color: #555;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      user-select: none;
      padding: 2px 8px 2px 6px;
      border-radius: 4px;
      border: 1px solid transparent;
      transition: background 0.1s, border-color 0.1s;
      white-space: nowrap;
    }
    .filter-group label:hover {
      background: #f2f2ef;
      border-color: #ddd;
      color: #1a1a1a;
    }
    .filter-group input[type="checkbox"] {
      accent-color: #555;
      width: 12px;
      height: 12px;
      cursor: pointer;
    }
    .filter-group label:has(input:checked) {
      background: #1a1a1a;
      border-color: #1a1a1a;
      color: #fff;
    }
    .filter-group label:has(input:checked) input[type="checkbox"] {
      accent-color: #fff;
    }
    #card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 12px;
      padding: 24px;
      max-width: 1440px;
      margin: 0 auto;
    }
    .card {
      border: 1px solid #e4e4e0;
      border-radius: 8px;
      padding: 20px 22px 16px;
      cursor: pointer;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 0;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
    }
    .card:hover {
      border-color: #c8c8c4;
      box-shadow: 0 4px 16px rgba(0,0,0,0.07);
      transform: translateY(-1px);
    }
    .card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 2px;
    }
    .card-display-name {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1rem;
      color: #111;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
    .card-version {
      font-size: 0.72rem;
      color: #999;
      font-family: "Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", Menlo, monospace;
      flex-shrink: 0;
    }
    .card-name {
      font-size: 0.75rem;
      color: #888;
      font-family: "Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", Menlo, monospace;
      margin-bottom: 10px;
    }
    .card-description {
      font-size: 0.875rem;
      color: #555;
      line-height: 1.5;
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 14px;
    }
    .card-keywords span {
      font-size: 0.7rem;
      border: 1px solid #e4e4e0;
      padding: 2px 7px;
      border-radius: 20px;
      background: #f7f7f5;
      color: #666;
      letter-spacing: 0.01em;
    }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #f0f0ec;
    }
    .card-harnesses {
      display: flex;
      align-items: center;
      gap: 2px;
      line-height: 1;
    }
    .harness-icon {
      font-size: 1rem;
      cursor: default;
      opacity: 0.65;
      transition: opacity 0.1s;
      display: inline-block;
    }
    .harness-icon:hover {
      opacity: 1;
    }
    .card-badges {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .badge {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-maturity-experimental { background: #fff3cd; color: #856404; }
    .badge-maturity-beta         { background: #cfe2ff; color: #084298; }
    .badge-maturity-stable       { background: #d1e7dd; color: #0a3622; }
    .badge-maturity-deprecated   { background: #f8d7da; color: #842029; }
    .badge-trust-official        { background: #d1e7dd; color: #0a3622; }
    .badge-trust-partner         { background: #e2d9f3; color: #41217a; }
    .badge-trust-community       { background: #e0e0dc; color: #444; }
    .badge-trust-experimental    { background: #fff3cd; color: #856404; }
    #detail-view {
      padding: 32px 40px;
      max-width: 860px;
      margin: 0 auto;
    }
    .detail-back {
      cursor: pointer;
      text-decoration: none;
      color: #999;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      margin-bottom: 28px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px 5px 7px;
      border-radius: 5px;
      border: 1px solid #e8e8e4;
      background: #fafaf8;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .detail-back:hover {
      color: #1a1a1a;
      border-color: #ccc;
      background: #f2f2ef;
    }
    .detail-back-arrow {
      font-size: 0.9rem;
      line-height: 1;
      color: #bbb;
      transition: color 0.15s, transform 0.15s;
      display: inline-block;
    }
    .detail-back:hover .detail-back-arrow {
      color: #666;
      transform: translateX(-2px);
    }
    .detail-title-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }
    #detail-view h2 {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #111;
      margin: 0;
    }
    .detail-pkg-name {
      font-size: 0.85rem;
      font-family: "Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", Menlo, monospace;
      color: #888;
      margin-bottom: 16px;
    }
    .detail-description {
      font-size: 1rem;
      color: #444;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .detail-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .detail-meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 16px;
      margin-bottom: 24px;
      padding: 16px 20px;
      background: #f7f7f5;
      border-radius: 8px;
      border: 1px solid #e8e8e4;
    }
    .detail-meta-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      padding-top: 1px;
    }
    .detail-meta-value {
      font-size: 0.825rem;
      color: #333;
      line-height: 1.5;
    }
    .detail-section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      margin-top: 20px;
    }
    .detail-content pre {
      font-family: "Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", Menlo, monospace;
      font-size: 0.8rem;
      border: 1px solid #e0e0dc;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      background: #fafaf8;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
    }
    .empty-state {
      text-align: center;
      color: #999;
      padding: 48px 24px;
      font-size: 0.875rem;
    }
    .error-message {
      color: #b44;
      font-size: 0.825rem;
      padding: 12px 0;
    }
  </style>
</head>
<body>
  <header>
    <h1>Skill Forge</h1>
    <div class="header-divider"></div>
    <span id="artifact-count"></span>
  </header>
  <div class="filters">
    <div class="filter-search-row">
      <input type="text" id="search-input" placeholder="Search artifacts...">
    </div>
    <div class="filter-groups-row">
      <div class="filter-group">
        <div class="filter-group-label">Harness</div>
        <div class="filter-group-items" id="harness-filter"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-label">Format</div>
        <div class="filter-group-items" id="format-filter"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-label">Maturity</div>
        <div class="filter-group-items" id="maturity-filter"></div>
      </div>
      <div class="filter-group" id="collection-filter-group" style="display:none">
        <div class="filter-group-label">Collection</div>
        <div class="filter-group-items" id="collection-filter"></div>
      </div>
    </div>
  </div>
  <div id="card-grid"></div>
  <div id="detail-view" style="display:none"></div>
  <script>
    // --- Task 5.1: Catalog fetch and card rendering ---

    var catalogData = [];

    function renderCards(entries, hasActiveFilters) {
      var grid = document.getElementById('card-grid');
      grid.innerHTML = '';

      if (entries.length === 0) {
        var msg = hasActiveFilters ? 'No matching artifacts' : 'No artifacts found';
        grid.innerHTML = '<div class="empty-state">' + msg + '</div>';
        return;
      }

      entries.forEach(function(entry) {
        var card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-name', entry.name);

        var keywordsHtml = '';
        if (entry.keywords && entry.keywords.length > 0) {
          keywordsHtml = entry.keywords.map(function(kw) {
            return '<span>' + escapeHtmlJs(kw) + '</span>';
          }).join('');
        }

        // Card footer: icons only — compact, detail view shows full names
        var harnessesHtml = '';
        if (entry.harnesses && entry.harnesses.length > 0) {
          harnessesHtml = entry.harnesses.map(function(h) {
            var icon = HARNESS_ICONS[h] || h.charAt(0).toUpperCase();
            var fmt = entry.formatByHarness && entry.formatByHarness[h] ? entry.formatByHarness[h] : '';
            var title = h + (fmt ? ': ' + fmt : '');
            return '<span class="harness-icon" title="' + escapeHtmlJs(title) + '">' + icon + '</span>';
          }).join('');
        }

        var maturity = entry.maturity || 'experimental';
        var maturityBadge = '<span class="badge badge-maturity-' + escapeHtmlJs(maturity) + '">' + escapeHtmlJs(maturity) + '</span>';
        var trustBadge = entry.trust ? '<span class="badge badge-trust-' + escapeHtmlJs(entry.trust) + '">' + escapeHtmlJs(entry.trust) + '</span>' : '';
        var descHtml = entry.description ? '<div class="card-description">' + escapeHtmlJs(entry.description) + '</div>' : '';
        var kwHtml = keywordsHtml ? '<div class="card-keywords">' + keywordsHtml + '</div>' : '';

        card.innerHTML =
          '<div class="card-header">' +
            '<span class="card-display-name">' + escapeHtmlJs(entry.displayName) + '</span>' +
            '<span class="card-version">' + escapeHtmlJs(entry.version || '') + '</span>' +
          '</div>' +
          '<div class="card-name">' + escapeHtmlJs(entry.name) + '</div>' +
          descHtml +
          kwHtml +
          '<div class="card-footer">' +
            '<span class="card-harnesses">' + harnessesHtml + '</span>' +
            '<div class="card-badges">' + maturityBadge + trustBadge + '</div>' +
          '</div>';

        card.addEventListener('click', function() {
          showDetailView(entry.name);
        });

        grid.appendChild(card);
      });
    }

    function updateArtifactCount(count) {
      var el = document.getElementById('artifact-count');
      el.textContent = '(' + count + ' artifact' + (count !== 1 ? 's' : '') + ')';
    }

    var HARNESS_ICONS = {
      'kiro':         '👻',
      'claude-code':  '🤖',
      'copilot':      '🐙',
      'cursor':       '🖱️',
      'windsurf':     '🏄',
      'cline':        '🔧',
      'qdeveloper':   '☁️',
    };

    function populateHarnessFilter(entries) {
      var harnesses = {};
      entries.forEach(function(entry) {
        if (entry.harnesses) {
          entry.harnesses.forEach(function(h) {
            harnesses[h] = true;
          });
        }
      });
      var container = document.getElementById('harness-filter');
      container.innerHTML = '';
      Object.keys(harnesses).sort().forEach(function(h) {
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = h;
        cb.className = 'harness-cb';
        label.appendChild(cb);
        var icon = HARNESS_ICONS[h] || '';
        label.appendChild(document.createTextNode(' ' + (icon ? icon + ' ' : '') + h));
        container.appendChild(label);
      });
    }

    function populateFormatFilter(entries) {
      var formats = {};
      entries.forEach(function(entry) {
        if (entry.formatByHarness) {
          var keys = Object.keys(entry.formatByHarness);
          for (var i = 0; i < keys.length; i++) {
            formats[entry.formatByHarness[keys[i]]] = true;
          }
        }
      });
      var container = document.getElementById('format-filter');
      container.innerHTML = '';
      Object.keys(formats).sort().forEach(function(f) {
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = f;
        cb.className = 'format-cb';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + f));
        container.appendChild(label);
      });
    }

    function populateMaturityFilter(entries) {
      var maturities = {};
      entries.forEach(function(entry) {
        var m = entry.maturity || 'experimental';
        maturities[m] = true;
      });
      var container = document.getElementById('maturity-filter');
      container.innerHTML = '';
      ['experimental', 'beta', 'stable', 'deprecated'].forEach(function(m) {
        if (!maturities[m]) return;
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = m;
        cb.className = 'maturity-cb';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + m));
        container.appendChild(label);
      });
    }

    function populateCollectionFilter(entries) {
      var collections = {};
      entries.forEach(function(entry) {
        if (entry.collections && entry.collections.length > 0) {
          entry.collections.forEach(function(c) { collections[c] = true; });
        }
      });
      var names = Object.keys(collections).sort();
      var group = document.getElementById('collection-filter-group');
      var container = document.getElementById('collection-filter');
      container.innerHTML = '';
      if (names.length === 0) {
        group.style.display = 'none';
        return;
      }
      group.style.display = '';
      names.forEach(function(c) {
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = c;
        cb.className = 'collection-cb';
        label.appendChild(cb);
        // Humanise: replace hyphens with spaces and title-case
        var display = c.replace(/-/g, ' ').replace(/\bw/g, function(l) { return l.toUpperCase(); });
        label.appendChild(document.createTextNode(' ' + display));
        container.appendChild(label);
      });
    }

    function escapeHtmlJs(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    document.addEventListener('DOMContentLoaded', function() {
      function initCatalog(data) {
        catalogData = data;
        updateArtifactCount(catalogData.length);
        populateHarnessFilter(catalogData);
        populateFormatFilter(catalogData);
        populateMaturityFilter(catalogData);
        populateCollectionFilter(catalogData);
        renderCards(catalogData, false);

        // Wire up search and filter event listeners
        document.getElementById('search-input').addEventListener('input', filterAndRender);
        document.getElementById('harness-filter').addEventListener('change', filterAndRender);
        document.getElementById('format-filter').addEventListener('change', filterAndRender);
        document.getElementById('maturity-filter').addEventListener('change', filterAndRender);
        document.getElementById('collection-filter').addEventListener('change', filterAndRender);
      }

      if (window.__CATALOG_DATA__) {
        initCatalog(window.__CATALOG_DATA__);
      } else {
        fetch('/api/catalog')
          .then(function(res) { return res.json(); })
          .then(initCatalog)
          .catch(function(err) {
            console.error('Failed to load catalog:', err);
            var grid = document.getElementById('card-grid');
            grid.innerHTML = '<div class="empty-state">Failed to load catalog data</div>';
          });
      }
    });

    // --- Task 5.2: Search and filter functionality ---

    function filterAndRender() {
      var query = document.getElementById('search-input').value.toLowerCase();
      var harnessCheckboxes = document.querySelectorAll('.harness-cb:checked');
      var selectedHarnesses = [];
      for (var i = 0; i < harnessCheckboxes.length; i++) {
        selectedHarnesses.push(harnessCheckboxes[i].value);
      }
      var formatCheckboxes = document.querySelectorAll('.format-cb:checked');
      var selectedFormats = [];
      for (var i = 0; i < formatCheckboxes.length; i++) {
        selectedFormats.push(formatCheckboxes[i].value);
      }
      var maturityCheckboxes = document.querySelectorAll('.maturity-cb:checked');
      var selectedMaturities = [];
      for (var i = 0; i < maturityCheckboxes.length; i++) {
        selectedMaturities.push(maturityCheckboxes[i].value);
      }
      var collectionCheckboxes = document.querySelectorAll('.collection-cb:checked');
      var selectedCollections = [];
      for (var i = 0; i < collectionCheckboxes.length; i++) {
        selectedCollections.push(collectionCheckboxes[i].value);
      }

      var filtered = catalogData.filter(function(entry) {
        // Search filter
        if (query) {
          var nameMatch = (entry.name || '').toLowerCase().indexOf(query) !== -1;
          var displayNameMatch = (entry.displayName || '').toLowerCase().indexOf(query) !== -1;
          var descMatch = (entry.description || '').toLowerCase().indexOf(query) !== -1;
          var keywordMatch = false;
          if (entry.keywords) {
            for (var k = 0; k < entry.keywords.length; k++) {
              if (entry.keywords[k].toLowerCase().indexOf(query) !== -1) {
                keywordMatch = true;
                break;
              }
            }
          }
          if (!nameMatch && !displayNameMatch && !descMatch && !keywordMatch) {
            return false;
          }
        }
        // Harness filter
        if (selectedHarnesses.length > 0) {
          var hasHarness = false;
          if (entry.harnesses) {
            for (var h = 0; h < selectedHarnesses.length; h++) {
              if (entry.harnesses.indexOf(selectedHarnesses[h]) !== -1) {
                hasHarness = true;
                break;
              }
            }
          }
          if (!hasHarness) return false;
        }
        // Format filter
        if (selectedFormats.length > 0) {
          var hasFormat = false;
          if (entry.formatByHarness) {
            var fmtKeys = Object.keys(entry.formatByHarness);
            for (var f = 0; f < fmtKeys.length; f++) {
              if (selectedFormats.indexOf(entry.formatByHarness[fmtKeys[f]]) !== -1) {
                hasFormat = true;
                break;
              }
            }
          }
          if (!hasFormat) return false;
        }
        // Maturity filter
        if (selectedMaturities.length > 0) {
          var entryMaturity = entry.maturity || 'experimental';
          if (selectedMaturities.indexOf(entryMaturity) === -1) return false;
        }
        // Collection filter
        if (selectedCollections.length > 0) {
          var entryCollections = entry.collections || [];
          var inCollection = selectedCollections.some(function(c) {
            return entryCollections.indexOf(c) !== -1;
          });
          if (!inCollection) return false;
        }
        return true;
      });

      var hasActiveFilters = query || selectedHarnesses.length > 0 || selectedFormats.length > 0 || selectedMaturities.length > 0 || selectedCollections.length > 0;
      renderCards(filtered, hasActiveFilters);
    }

    // END task 5.2

    // --- Task 5.3: Detail view ---

    function showDetailView(name) {
      var entry = null;
      for (var i = 0; i < catalogData.length; i++) {
        if (catalogData[i].name === name) {
          entry = catalogData[i];
          break;
        }
      }
      if (!entry) return;

      document.getElementById('card-grid').style.display = 'none';
      var filtersEl = document.querySelector('.filters');
      if (filtersEl) filtersEl.style.display = 'none';
      var detailView = document.getElementById('detail-view');
      detailView.style.display = 'block';

      var harnessesHtml = '';
      if (entry.harnesses && entry.harnesses.length > 0) {
        harnessesHtml = entry.harnesses.map(function(h) {
          var icon = HARNESS_ICONS[h] ? HARNESS_ICONS[h] + ' ' : '';
          if (entry.formatByHarness && entry.formatByHarness[h]) {
            return icon + escapeHtmlJs(h) + ':' + escapeHtmlJs(entry.formatByHarness[h]);
          }
          return icon + escapeHtmlJs(h);
        }).join('  ');
      }

      var keywordsHtml = '';
      if (entry.keywords && entry.keywords.length > 0) {
        keywordsHtml = entry.keywords.map(function(kw) {
          return '<span>' + escapeHtmlJs(kw) + '</span>';
        }).join('');
      }


      var evalsStatus = entry.evals ? 'yes' : 'no';

      var detailMaturity = entry.maturity || 'experimental';
      var detailMaturityBadge = '<span class="badge badge-maturity-' + escapeHtmlJs(detailMaturity) + '">' + escapeHtmlJs(detailMaturity) + '</span>';
      var detailTrustBadge = entry.trust ? ' <span class="badge badge-trust-' + escapeHtmlJs(entry.trust) + '">' + escapeHtmlJs(entry.trust) + '</span>' : '';

      // Build metadata grid rows (label + value pairs)
      var metaRows = '';
      function metaRow(label, value) {
        return '<div class="detail-meta-label">' + label + '</div><div class="detail-meta-value">' + value + '</div>';
      }
      metaRows += metaRow('Package', '<span style="font-family:monospace">' + escapeHtmlJs(entry.name) + '</span>');
      metaRows += metaRow('Version', escapeHtmlJs(entry.version));
      if (entry.author) metaRows += metaRow('Author', escapeHtmlJs(entry.author));
      if (entry.license) metaRows += metaRow('License', escapeHtmlJs(entry.license));
      metaRows += metaRow('Type', escapeHtmlJs(entry.type || ''));
      if (entry.audience) metaRows += metaRow('Audience', escapeHtmlJs(entry.audience));
      if (entry['risk-level']) metaRows += metaRow('Risk', escapeHtmlJs(entry['risk-level']));
      metaRows += metaRow('Evals', evalsStatus);
      metaRows += metaRow('Path', '<span style="font-family:monospace;font-size:0.75rem">' + escapeHtmlJs(entry.path) + '</span>');
      if (entry.successor) metaRows += metaRow('Succeeded by', escapeHtmlJs(entry.successor));
      if (entry.replaces) metaRows += metaRow('Replaces', escapeHtmlJs(entry.replaces));

      var html =
        '<div class="detail-back" id="detail-back-link"><span class="detail-back-arrow">←</span> Catalog</div>' +
        '<div class="detail-title-row">' +
          '<h2>' + escapeHtmlJs(entry.displayName) + '</h2>' +
          '<span style="font-size:0.85rem;color:#999">' + escapeHtmlJs(entry.version) + '</span>' +
        '</div>' +
        '<div class="detail-pkg-name">' + escapeHtmlJs(entry.name) + '</div>' +
        (entry.description ? '<div class="detail-description">' + escapeHtmlJs(entry.description) + '</div>' : '') +
        '<div class="detail-badges">' + detailMaturityBadge + detailTrustBadge + '</div>' +
        (keywordsHtml ? '<div class="card-keywords" style="margin-bottom:20px">' + keywordsHtml + '</div>' : '') +
        '<div class="detail-section-label">Targets</div>' +
        '<div style="font-size:0.875rem;color:#444;margin-bottom:20px;line-height:2">' +
        entry.harnesses.map(function(h) {
          var icon = HARNESS_ICONS[h] ? HARNESS_ICONS[h] + ' ' : '';
          var fmt = entry.formatByHarness && entry.formatByHarness[h];
          return icon + '<strong style="font-weight:500">' + escapeHtmlJs(h) + '</strong>' +
            (fmt ? ' <span style="color:#bbb;font-size:0.8rem">→</span> <span style="color:#888">' + escapeHtmlJs(fmt) + '</span>' : '');
        }).join('<br>') +
        '</div>' +
        '<div class="detail-section-label">Details</div>' +
        '<div class="detail-meta">' + metaRows + '</div>' +
        '<div class="detail-section-label">Source</div>' +
        '<div class="detail-content"><pre>Loading...</pre></div>';

      detailView.innerHTML = html;

      document.getElementById('detail-back-link').addEventListener('click', function() {
        hideDetailView();
      });

      var inlineContent = null;
      if (window.__ARTIFACT_CONTENT__ &&
          Object.prototype.hasOwnProperty.call(window.__ARTIFACT_CONTENT__, name)) {
        inlineContent = window.__ARTIFACT_CONTENT__[name];
      }
      if (inlineContent !== null) {
        var contentEl = detailView.querySelector('.detail-content');
        if (contentEl) {
          contentEl.innerHTML = '<pre>' + escapeHtmlJs(inlineContent) + '</pre>';
        }
      } else {
        fetch('/api/artifact/' + encodeURIComponent(name) + '/content')
          .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .then(function(text) {
            var contentEl = detailView.querySelector('.detail-content');
            if (contentEl) {
              contentEl.innerHTML = '<pre>' + escapeHtmlJs(text) + '</pre>';
            }
          })
          .catch(function() {
            var contentEl = detailView.querySelector('.detail-content');
            if (contentEl) {
              contentEl.innerHTML = '<div class="error-message">Failed to load content</div>';
            }
          });
      }
    }

    function hideDetailView() {
      document.getElementById('detail-view').style.display = 'none';
      document.getElementById('card-grid').style.display = 'grid';
      var filtersEl = document.querySelector('.filters');
      if (filtersEl) filtersEl.style.display = 'flex';
    }

    // END task 5.3

    // END task 5.1
  </script>
</body>
</html>`;
}

/**
 * Safely serializes a value to JSON for embedding in an HTML `<script>` block.
 * Replaces `</script>` and `<!--` sequences that would confuse the HTML parser.
 */
function safeJsonEmbed(data: unknown): string {
	return JSON.stringify(data)
		.replace(/<\/script>/gi, "<\\/script>")
		.replace(/<!--/g, "<\\!--");
}

/**
 * Generates a fully self-contained static HTML page for the catalog browser.
 *
 * Catalog entries and artifact `knowledge.md` content are embedded as inline
 * `window.__CATALOG_DATA__` and `window.__ARTIFACT_CONTENT__` variables so the
 * page works without a backend server (e.g. GitHub Pages).  The client-side JS
 * in `generateHtmlPage()` checks for those globals before falling back to the
 * live `/api/*` endpoints, so local `forge catalog browse` continues to work
 * from the same HTML template.
 */
export function generateStaticHtmlPage(
	entries: CatalogEntry[],
	contentMap: Record<string, string>,
): string {
	const dataScript = `<script>window.__CATALOG_DATA__ = ${safeJsonEmbed(entries)};
window.__ARTIFACT_CONTENT__ = ${safeJsonEmbed(contentMap)};</script>`;
	return generateHtmlPage().replace("</head>", `${dataScript}\n</head>`);
}

export interface ExportOptions {
	output: string;
}

/**
 * Entry point for `forge catalog export`.
 *
 * Generates a self-contained static `index.html` (and a companion
 * `catalog.json`) suitable for hosting on GitHub Pages or any static file
 * server.  All catalog data and `knowledge.md` content are embedded inline so
 * no backend is required at runtime.
 */
export async function exportCommand(options: ExportOptions): Promise<void> {
	const { output } = options;

	const entries = await generateCatalog([...SOURCE_DIRS]);

	// Build name → knowledge.md content map
	const contentMap: Record<string, string> = {};
	for (const entry of entries) {
		const filePath = join(entry.path, "knowledge.md");
		try {
			const fileExists = await exists(filePath);
			if (fileExists) {
				contentMap[entry.name] = await Bun.file(filePath).text();
			}
		} catch {
			// Skip unreadable artifacts — the browser falls back to the live API
		}
	}

	const html = generateStaticHtmlPage(entries, contentMap);

	await mkdir(output, { recursive: true });
	await writeFile(join(output, "index.html"), html, "utf-8");
	await writeFile(
		join(output, "catalog.json"),
		serializeCatalog(entries),
		"utf-8",
	);

	console.error(
		chalk.green(
			`✓ Exported static catalog to ${output}/ (${entries.length} artifact${entries.length !== 1 ? "s" : ""})`,
		),
	);
}

/**
 * Routes incoming HTTP requests to the appropriate handler.
 */
export async function handleRequest(
	req: Request,
	catalogEntries: CatalogEntry[],
	htmlPage: string,
): Promise<Response> {
	const url = new URL(req.url);
	const pathname = url.pathname;

	// GET / → serve cached HTML page
	if (pathname === "/") {
		return new Response(htmlPage, {
			status: 200,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}

	// GET /api/catalog → serve JSON catalog entries
	if (pathname === "/api/catalog") {
		return new Response(JSON.stringify(catalogEntries), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	// GET /api/artifact/:name/content → serve knowledge.md content
	const artifactMatch = pathname.match(/^\/api\/artifact\/([^/]+)\/content$/);
	if (artifactMatch) {
		const name = decodeURIComponent(artifactMatch[1]);
		const entry = catalogEntries.find((e) => e.name === name);

		if (!entry) {
			return new Response(
				JSON.stringify({ error: `Artifact '${name}' not found` }),
				{ status: 404, headers: { "Content-Type": "application/json" } },
			);
		}

		const filePath = join(entry.path, "knowledge.md");
		try {
			const fileExists = await exists(filePath);
			if (!fileExists) {
				return new Response(
					JSON.stringify({ error: `Content not available for '${name}'` }),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}
			const content = await Bun.file(filePath).text();
			return new Response(content, {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			});
		} catch {
			return new Response(
				JSON.stringify({ error: `Content not available for '${name}'` }),
				{ status: 404, headers: { "Content-Type": "application/json" } },
			);
		}
	}

	// All other routes → 404
	return new Response(JSON.stringify({ error: "Not found" }), {
		status: 404,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Starts the Bun HTTP server for the catalog browser.
 * Loads catalog data, pre-generates the HTML page, starts the server,
 * opens the browser, and registers a SIGINT handler for clean shutdown.
 */
export async function startBrowseServer(options: BrowseOptions): Promise<void> {
	const { port } = options;

	// Load catalog entries on-the-fly from the knowledge/ directory
	const catalogEntries = await generateCatalog("knowledge");

	// Pre-generate the HTML page string (cached in memory)
	const htmlPage = generateHtmlPage();

	let server: ReturnType<typeof Bun.serve>;

	try {
		server = Bun.serve({
			hostname: "localhost",
			port,
			fetch(req) {
				return handleRequest(req, catalogEntries, htmlPage);
			},
		});
	} catch (err: unknown) {
		const error = err as { code?: string; message?: string };
		if (
			error.code === "EADDRINUSE" ||
			error.message?.includes("address already in use")
		) {
			console.error(
				chalk.red(
					`Port ${port} is already in use. Choose a different port with --port <number>.`,
				),
			);
			process.exit(1);
		}
		throw err;
	}

	const url = `http://localhost:${port}`;
	console.error(chalk.green(`Catalog browser running at ${chalk.bold(url)}`));

	// Attempt to open the default browser (best-effort, non-blocking)
	try {
		const platform = process.platform;
		const cmd =
			platform === "darwin"
				? "open"
				: platform === "win32"
					? "start"
					: "xdg-open";
		Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
	} catch {
		// Silently ignore — browser opening is best-effort
	}

	// Register SIGINT handler for clean shutdown
	process.on("SIGINT", () => {
		server.stop();
		console.error(chalk.yellow("\nBrowse server shut down."));
		process.exit(0);
	});
}
