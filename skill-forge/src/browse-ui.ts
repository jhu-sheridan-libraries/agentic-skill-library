/**
 * Browse UI — HTML template generation for the catalog browser SPA.
 *
 * Extracted from browse.ts to keep the route handler and server bootstrap
 * lean. All CSS and JS are inlined in the generated HTML string.
 */

import type { CatalogEntry } from "./schemas";

/**
 * Escapes HTML special characters to prevent XSS in embedded content.
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

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
      /* Typography */
      --font-display: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: "Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace;
      /* Colors — Neutral palette (warm grays) */
      --color-bg: #f7f7f5;
      --color-surface: #fff;
      --color-surface-alt: #fafaf8;
      --color-border: #e4e4e0;
      --color-border-subtle: #e8e8e4;
      --color-border-hover: #c8c8c4;
      --color-text-primary: #1a1a1a;
      --color-text-secondary: #555;
      --color-text-muted: #999;
      --color-text-faint: #aaa;
      /* Colors — Semantic */
      --color-success: #0a3622;
      --color-success-bg: #d1e7dd;
      --color-warning: #856404;
      --color-warning-bg: #fff3cd;
      --color-error: #842029;
      --color-error-bg: #f8d7da;
      --color-info: #084298;
      --color-info-bg: #cfe2ff;
      /* Colors — Status indicators (manifest sync) */
      --color-status-synced: #16a34a;
      --color-status-outdated: #ca8a04;
      --color-status-missing: #dc2626;
      /* Spacing scale (4px base) */
      --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
      --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
      /* Radii */
      --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-pill: 20px;
      /* Shadows */
      --shadow-card-hover: 0 4px 16px rgba(0,0,0,0.07);
      --shadow-modal: 0 8px 32px rgba(0,0,0,0.12);
      --shadow-toast: 0 4px 12px rgba(0,0,0,0.1);
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

    /* --- Card: collection modifier --- */
    .card--collection {
      border-left: 3px solid var(--color-border);
    }
    .card--collection:hover {
      border-left-color: var(--color-border-hover);
    }
    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 14px;
    }
    .card-tags span {
      font-size: 0.7rem;
      border: 1px solid var(--color-border);
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--color-bg);
      color: #666;
      letter-spacing: 0.01em;
    }

    /* --- Form panel --- */
    .form-panel {
      max-width: 640px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-10);
    }
    .form-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-6);
    }
    .form-panel-header h2 {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .form-panel-header .close-btn {
      background: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 4px 10px;
      cursor: pointer;
      font-size: 0.8rem;
      color: var(--color-text-muted);
      transition: color 0.15s, border-color 0.15s;
    }
    .form-panel-header .close-btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-border-hover);
    }
    .form-group {
      margin-bottom: var(--space-5);
    }
    .form-label {
      display: block;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
      letter-spacing: 0.01em;
    }
    .form-input,
    .form-textarea,
    .form-select {
      width: 100%;
      font-family: var(--font-body);
      font-size: 0.875rem;
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-alt);
      color: var(--color-text-primary);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
      border-color: var(--color-text-muted);
      box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
    }
    .form-textarea {
      min-height: 120px;
      resize: vertical;
      line-height: 1.5;
    }
    .form-textarea.mono {
      font-family: var(--font-mono);
      font-size: 0.8rem;
    }
    .form-checkbox-group,
    .form-radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .form-checkbox-group label,
    .form-radio-group label {
      font-size: 0.78rem;
      color: var(--color-text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px 2px 6px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      transition: background 0.1s, border-color 0.1s;
      user-select: none;
    }
    .form-checkbox-group label:hover,
    .form-radio-group label:hover {
      background: #f2f2ef;
      border-color: #ddd;
    }
    .form-checkbox-group input[type="checkbox"],
    .form-radio-group input[type="radio"] {
      accent-color: #555;
      width: 12px;
      height: 12px;
      cursor: pointer;
    }
    .form-checkbox-group label:has(input:checked),
    .form-radio-group label:has(input:checked) {
      background: var(--color-text-primary);
      border-color: var(--color-text-primary);
      color: #fff;
    }
    .form-select {
      cursor: pointer;
      appearance: auto;
    }
    .form-error {
      font-size: 0.75rem;
      color: var(--color-error);
      margin-top: var(--space-1);
    }
    .form-input.has-error,
    .form-textarea.has-error,
    .form-select.has-error {
      border-color: var(--color-error);
    }
    .form-actions {
      display: flex;
      gap: var(--space-3);
      justify-content: flex-end;
      padding-top: var(--space-6);
      border-top: 1px solid var(--color-border);
      margin-top: var(--space-6);
    }
    .form-actions button {
      font-family: var(--font-body);
      font-size: 0.825rem;
      font-weight: 500;
      padding: 8px 18px;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .form-actions .btn-cancel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }
    .form-actions .btn-cancel:hover {
      border-color: var(--color-border-hover);
      color: var(--color-text-primary);
    }
    .form-actions .btn-submit {
      background: var(--color-text-primary);
      border: 1px solid var(--color-text-primary);
      color: #fff;
    }
    .form-actions .btn-submit:hover {
      background: #333;
    }

    /* --- Badge: type and status modifiers --- */
    .badge-type-artifact   { background: #e8e8e4; color: #555; }
    .badge-type-collection { background: #ede9f6; color: #5b3ea3; }
    .badge-status-synced   { background: #d1e7dd; color: var(--color-status-synced); }
    .badge-status-outdated { background: #fff3cd; color: var(--color-status-outdated); }
    .badge-status-missing  { background: #f8d7da; color: var(--color-status-missing); }

    /* --- Toast notifications --- */
    .toast-container {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 0.825rem;
      box-shadow: var(--shadow-toast);
      pointer-events: auto;
      animation: toast-in 0.2s ease-out;
    }
    .toast--success {
      background: var(--color-success-bg);
      color: var(--color-success);
      border: 1px solid #a3cfbb;
    }
    .toast--error {
      background: var(--color-error-bg);
      color: var(--color-error);
      border: 1px solid #f1aeb5;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* --- Modal --- */
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 900;
    }
    .modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.3);
    }
    .modal-dialog {
      position: relative;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      max-width: 420px;
      width: 90%;
      box-shadow: var(--shadow-modal);
    }
    .modal-dialog h3 {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: var(--space-3);
      color: var(--color-text-primary);
    }
    .modal-dialog p {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin-bottom: var(--space-5);
    }
    .modal-actions {
      display: flex;
      gap: var(--space-3);
      justify-content: flex-end;
    }
    .modal-actions button {
      font-family: var(--font-body);
      font-size: 0.825rem;
      font-weight: 500;
      padding: 8px 18px;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .modal-actions .btn-cancel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }
    .modal-actions .btn-cancel:hover {
      border-color: var(--color-border-hover);
    }
    .modal-actions .btn-danger {
      background: var(--color-error);
      border: 1px solid var(--color-error);
      color: #fff;
    }
    .modal-actions .btn-danger:hover {
      background: #6b1a21;
    }

    /* --- Tab navigation --- */
    .tab-nav {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 0 24px;
    }
    .tab-nav-item {
      padding: 12px 16px;
      font-size: 0.825rem;
      font-weight: 500;
      color: var(--color-text-muted);
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      user-select: none;
    }
    .tab-nav-item:hover {
      color: var(--color-text-primary);
    }
    .tab-nav-item--active {
      color: var(--color-text-primary);
      border-bottom-color: var(--color-text-primary);
    }
  </style>
</head>
<body>
  <header>
    <h1>Skill Forge</h1>
    <div class="header-divider"></div>
    <span id="artifact-count"></span>
    <span style="flex:1"></span>
    <button id="new-btn" style="font-family:var(--font-body);font-size:0.8rem;font-weight:500;padding:6px 14px;border-radius:var(--radius-md);background:var(--color-text-primary);color:#fff;border:1px solid var(--color-text-primary);cursor:pointer;transition:background 0.15s" onclick="handleNewButton()">+ New Artifact</button>
  </header>
  <nav class="tab-nav" id="tab-nav">
    <div class="tab-nav-item tab-nav-item--active" data-view="artifacts" onclick="showView('artifacts')">Artifacts</div>
    <div class="tab-nav-item" data-view="collections" onclick="showView('collections')">Collections</div>
    <div class="tab-nav-item" data-view="manifest" onclick="showView('manifest')">Manifest</div>
  </nav>
  <div class="filters" id="artifact-filters">
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
  <div id="collection-filters" style="display:none" class="filters">
    <div class="filter-search-row">
      <input type="text" id="collection-search-input" placeholder="Search collections..." style="font-family:inherit;font-size:0.875rem;padding:6px 12px;border:1px solid #d0d0cc;border-radius:6px;background:#fafaf8;color:#1a1a1a;outline:none;min-width:260px">
    </div>
    <div class="filter-groups-row">
      <div class="filter-group">
        <div class="filter-group-label">Trust</div>
        <div class="filter-group-items" id="trust-filter"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-label">Tags</div>
        <div class="filter-group-items" id="tag-filter-input-wrap">
          <input type="text" id="tag-filter-input" placeholder="Filter by tag..." style="font-family:inherit;font-size:0.78rem;padding:4px 8px;border:1px solid #d0d0cc;border-radius:4px;background:#fafaf8;color:#1a1a1a;outline:none;width:140px">
        </div>
      </div>
    </div>
  </div>
  <div id="collection-grid" style="display:none"></div>
  <div id="collection-detail-view" style="display:none"></div>
  <div id="manifest-view" style="display:none"></div>
  <div id="form-panel-container" style="display:none"></div>
  <div class="toast-container" id="toast-container"></div>
  <div class="modal" id="modal">
    <div class="modal-overlay" onclick="hideModal()"></div>
    <div class="modal-dialog">
      <h3 id="modal-title"></h3>
      <p id="modal-message"></p>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="hideModal()">Cancel</button>
        <button class="btn-danger" id="modal-confirm-btn">Confirm</button>
      </div>
    </div>
  </div>
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
      document.getElementById('artifact-filters').style.display = 'none';
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

      // Build collection badges for this artifact (task 9.4)
      var collectionBadgesHtml = '';
      if (entry.collections && entry.collections.length > 0) {
        collectionBadgesHtml = '<div class="detail-section-label">Collections</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">';
        for (var ci = 0; ci < entry.collections.length; ci++) {
          var cName = entry.collections[ci];
          collectionBadgesHtml += '<a href="#" class="artifact-collection-badge" data-collection="' + escapeHtmlJs(cName) + '" style="text-decoration:none">' +
            '<span class="badge badge-trust-community" style="cursor:pointer">' + escapeHtmlJs(cName) + '</span></a>';
        }
        collectionBadgesHtml += '</div>';
      }

      var html =
        '<div class="detail-back" id="detail-back-link"><span class="detail-back-arrow">\u2190</span> Catalog</div>' +
        '<div class="detail-title-row">' +
          '<h2>' + escapeHtmlJs(entry.displayName) + '</h2>' +
          '<span style="font-size:0.85rem;color:#999">' + escapeHtmlJs(entry.version) + '</span>' +
        '</div>' +
        '<div class="detail-pkg-name">' + escapeHtmlJs(entry.name) + '</div>' +
        (entry.description ? '<div class="detail-description">' + escapeHtmlJs(entry.description) + '</div>' : '') +
        '<div class="detail-badges">' + detailMaturityBadge + detailTrustBadge + '</div>' +
        (keywordsHtml ? '<div class="card-keywords" style="margin-bottom:20px">' + keywordsHtml + '</div>' : '') +
        '<div style="margin-bottom:16px">' +
          '<button id="detail-edit-btn" style="font-size:0.78rem;padding:5px 12px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);cursor:pointer;margin-right:8px">Edit</button>' +
          '<button id="detail-delete-btn" style="font-size:0.78rem;padding:5px 12px;border:1px solid var(--color-error);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-error);cursor:pointer">Delete</button>' +
        '</div>' +
        collectionBadgesHtml +
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

      // Wire edit/delete buttons (task 8.2)
      wireDetailActions(entry);

      // Wire collection badge clicks (task 9.4)
      var colBadges = detailView.querySelectorAll('.artifact-collection-badge');
      for (var bi = 0; bi < colBadges.length; bi++) {
        colBadges[bi].addEventListener('click', function(e) {
          e.preventDefault();
          var colName = this.getAttribute('data-collection');
          document.getElementById('detail-view').style.display = 'none';
          currentView = 'collections';
          showView('collections');
          setTimeout(function() { showCollectionDetail(colName); }, 200);
        });
      }

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
      showView(currentView);
    }

    // END task 5.3

    // --- Task 7.2: Shared render functions ---

    var currentView = 'artifacts';
    var collectionsData = [];
    var manifestData = null;
    var manifestStatusData = null;

    var ALL_HARNESSES = ['kiro','claude-code','copilot','cursor','windsurf','cline','qdeveloper'];
    var ALL_CATEGORIES = ['testing','security','code-style','devops','documentation','architecture','debugging','performance','accessibility'];
    var ARTIFACT_TYPES = ['skill','power','rule'];
    var INCLUSION_MODES = ['always','fileMatch','manual'];

    function renderBadge(text, variant) {
      return '<span class="badge badge-' + escapeHtmlJs(variant) + '">' + escapeHtmlJs(text) + '</span>';
    }

    function showToast(message, type) {
      var container = document.getElementById('toast-container');
      var toast = document.createElement('div');
      toast.className = 'toast toast--' + (type || 'success');
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 4000);
    }

    var _modalConfirmCb = null;
    function showModal(title, message, onConfirm) {
      var modal = document.getElementById('modal');
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').textContent = message;
      _modalConfirmCb = onConfirm;
      var confirmBtn = document.getElementById('modal-confirm-btn');
      var newBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
      newBtn.id = 'modal-confirm-btn';
      newBtn.addEventListener('click', function() {
        hideModal();
        if (_modalConfirmCb) _modalConfirmCb();
      });
      modal.classList.add('active');
    }

    function hideModal() {
      document.getElementById('modal').classList.remove('active');
      _modalConfirmCb = null;
    }

    function showView(viewName) {
      currentView = viewName;
      // Hide all content areas
      document.getElementById('card-grid').style.display = 'none';
      document.getElementById('detail-view').style.display = 'none';
      document.getElementById('collection-grid').style.display = 'none';
      document.getElementById('collection-detail-view').style.display = 'none';
      document.getElementById('manifest-view').style.display = 'none';
      document.getElementById('form-panel-container').style.display = 'none';
      document.getElementById('artifact-filters').style.display = 'none';
      document.getElementById('collection-filters').style.display = 'none';

      // Update tab active state
      var tabs = document.querySelectorAll('.tab-nav-item');
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-view') === viewName) {
          tabs[i].classList.add('tab-nav-item--active');
        } else {
          tabs[i].classList.remove('tab-nav-item--active');
        }
      }

      // Update new button label
      var newBtn = document.getElementById('new-btn');
      if (viewName === 'artifacts') {
        newBtn.textContent = '+ New Artifact';
        newBtn.style.display = '';
      } else if (viewName === 'collections') {
        newBtn.textContent = '+ New Collection';
        newBtn.style.display = '';
      } else if (viewName === 'manifest') {
        newBtn.textContent = '+ Add Entry';
        newBtn.style.display = '';
      }

      if (viewName === 'artifacts') {
        document.getElementById('artifact-filters').style.display = 'flex';
        document.getElementById('card-grid').style.display = 'grid';
      } else if (viewName === 'collections') {
        document.getElementById('collection-filters').style.display = 'flex';
        document.getElementById('collection-grid').style.display = 'grid';
        loadCollections();
      } else if (viewName === 'manifest') {
        document.getElementById('manifest-view').style.display = 'block';
        loadManifest();
      }
    }

    function handleNewButton() {
      if (currentView === 'artifacts') {
        showArtifactForm('create', null);
      } else if (currentView === 'collections') {
        showCollectionForm('create', null);
      } else if (currentView === 'manifest') {
        showManifestEntryForm('create', null);
      }
    }

    function renderCard(data, type) {
      var card = document.createElement('div');
      card.className = 'card' + (type === 'collection' ? ' card--collection' : '');
      card.setAttribute('data-name', data.name);

      if (type === 'collection') {
        var trustBadge = data.trust ? renderBadge(data.trust, 'trust-' + data.trust) : '';
        var tagsHtml = '';
        if (data.tags && data.tags.length > 0) {
          tagsHtml = '<div class="card-tags">' + data.tags.map(function(t) {
            return '<span>' + escapeHtmlJs(t) + '</span>';
          }).join('') + '</div>';
        }
        card.innerHTML =
          '<div class="card-header">' +
            '<span class="card-display-name">' + escapeHtmlJs(data.displayName || data.name) + '</span>' +
            '<span class="card-version">' + escapeHtmlJs(data.version || '') + '</span>' +
          '</div>' +
          '<div class="card-name">' + escapeHtmlJs(data.name) + '</div>' +
          (data.description ? '<div class="card-description">' + escapeHtmlJs(data.description) + '</div>' : '') +
          tagsHtml +
          '<div class="card-footer">' +
            '<span></span>' +
            '<div class="card-badges">' + trustBadge + '</div>' +
          '</div>';
        card.addEventListener('click', function() { showCollectionDetail(data.name); });
      } else {
        // artifact card - reuse existing renderCards logic inline
        var keywordsHtml = '';
        if (data.keywords && data.keywords.length > 0) {
          keywordsHtml = data.keywords.map(function(kw) {
            return '<span>' + escapeHtmlJs(kw) + '</span>';
          }).join('');
        }
        var harnessesHtml = '';
        if (data.harnesses && data.harnesses.length > 0) {
          harnessesHtml = data.harnesses.map(function(h) {
            var icon = HARNESS_ICONS[h] || h.charAt(0).toUpperCase();
            var fmt = data.formatByHarness && data.formatByHarness[h] ? data.formatByHarness[h] : '';
            var title = h + (fmt ? ': ' + fmt : '');
            return '<span class="harness-icon" title="' + escapeHtmlJs(title) + '">' + icon + '</span>';
          }).join('');
        }
        var maturity = data.maturity || 'experimental';
        var maturityBadge = renderBadge(maturity, 'maturity-' + maturity);
        var trustBadge2 = data.trust ? renderBadge(data.trust, 'trust-' + data.trust) : '';
        card.innerHTML =
          '<div class="card-header">' +
            '<span class="card-display-name">' + escapeHtmlJs(data.displayName) + '</span>' +
            '<span class="card-version">' + escapeHtmlJs(data.version || '') + '</span>' +
          '</div>' +
          '<div class="card-name">' + escapeHtmlJs(data.name) + '</div>' +
          (data.description ? '<div class="card-description">' + escapeHtmlJs(data.description) + '</div>' : '') +
          (keywordsHtml ? '<div class="card-keywords">' + keywordsHtml + '</div>' : '') +
          '<div class="card-footer">' +
            '<span class="card-harnesses">' + harnessesHtml + '</span>' +
            '<div class="card-badges">' + maturityBadge + trustBadge2 + '</div>' +
          '</div>';
        card.addEventListener('click', function() { showDetailView(data.name); });
      }
      return card;
    }

    function renderForm(fields, mode, onSubmit) {
      var container = document.getElementById('form-panel-container');
      var title = mode === 'create' ? fields._title || 'Create' : fields._title || 'Edit';
      var html = '<div class="form-panel">' +
        '<div class="form-panel-header"><h2>' + escapeHtmlJs(title) + '</h2>' +
        '<button class="close-btn" id="form-close-btn">Cancel</button></div>' +
        '<form id="admin-form">';

      var fieldDefs = fields._fields || [];
      for (var i = 0; i < fieldDefs.length; i++) {
        var f = fieldDefs[i];
        html += '<div class="form-group">';
        html += '<label class="form-label" for="field-' + f.key + '">' + escapeHtmlJs(f.label) + '</label>';

        if (f.type === 'text') {
          html += '<input class="form-input" type="text" id="field-' + f.key + '" name="' + f.key + '" value="' + escapeHtmlJs(f.value || '') + '"' + (f.mono ? ' style="font-family:var(--font-mono);font-size:0.8rem"' : '') + '>';
        } else if (f.type === 'textarea') {
          html += '<textarea class="form-textarea' + (f.mono ? ' mono' : '') + '" id="field-' + f.key + '" name="' + f.key + '">' + escapeHtmlJs(f.value || '') + '</textarea>';
        } else if (f.type === 'checkbox-group') {
          html += '<div class="form-checkbox-group" id="field-' + f.key + '">';
          for (var j = 0; j < f.options.length; j++) {
            var opt = f.options[j];
            var checked = f.value && f.value.indexOf(opt) !== -1 ? ' checked' : '';
            html += '<label><input type="checkbox" name="' + f.key + '" value="' + escapeHtmlJs(opt) + '"' + checked + '> ' + escapeHtmlJs(opt) + '</label>';
          }
          html += '</div>';
        } else if (f.type === 'radio-group') {
          html += '<div class="form-radio-group" id="field-' + f.key + '">';
          for (var j = 0; j < f.options.length; j++) {
            var opt = f.options[j];
            var checked = f.value === opt ? ' checked' : '';
            html += '<label><input type="radio" name="' + f.key + '" value="' + escapeHtmlJs(opt) + '"' + checked + '> ' + escapeHtmlJs(opt) + '</label>';
          }
          html += '</div>';
        } else if (f.type === 'select') {
          html += '<select class="form-select" id="field-' + f.key + '" name="' + f.key + '">';
          for (var j = 0; j < f.options.length; j++) {
            var opt = f.options[j];
            var selected = f.value === opt ? ' selected' : '';
            html += '<option value="' + escapeHtmlJs(opt) + '"' + selected + '>' + escapeHtmlJs(opt) + '</option>';
          }
          html += '</select>';
        }
        html += '<div class="form-error" id="error-' + f.key + '"></div>';
        html += '</div>';
      }

      html += '<div class="form-actions">' +
        '<button type="button" class="btn-cancel" id="form-cancel-btn">Cancel</button>' +
        '<button type="submit" class="btn-submit">' + (mode === 'create' ? 'Create' : 'Save') + '</button>' +
        '</div></form></div>';

      container.innerHTML = html;
      container.style.display = 'block';

      document.getElementById('form-close-btn').addEventListener('click', function() { closeForm(); });
      document.getElementById('form-cancel-btn').addEventListener('click', function() { closeForm(); });
      document.getElementById('admin-form').addEventListener('submit', function(e) {
        e.preventDefault();
        onSubmit();
      });
    }

    function closeForm() {
      document.getElementById('form-panel-container').style.display = 'none';
      showView(currentView);
    }

    function clearFormErrors() {
      var errors = document.querySelectorAll('.form-error');
      for (var i = 0; i < errors.length; i++) errors[i].textContent = '';
      var inputs = document.querySelectorAll('.has-error');
      for (var i = 0; i < inputs.length; i++) inputs[i].classList.remove('has-error');
    }

    function showFieldError(key, msg) {
      var el = document.getElementById('error-' + key);
      if (el) el.textContent = msg;
      var input = document.getElementById('field-' + key);
      if (input) input.classList.add('has-error');
    }

    function toKebabCase(str) {
      return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
    }

    function isKebabCase(str) {
      return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);
    }

    // END task 7.2
    // --- Task 8.1: Artifact create/edit form ---

    function showArtifactForm(mode, artifactName) {
      // Hide other views
      document.getElementById('card-grid').style.display = 'none';
      document.getElementById('detail-view').style.display = 'none';
      document.getElementById('artifact-filters').style.display = 'none';
      document.getElementById('collection-grid').style.display = 'none';
      document.getElementById('collection-filters').style.display = 'none';
      document.getElementById('manifest-view').style.display = 'none';

      var defaults = {
        name: '', displayName: '', description: '', keywords: '',
        author: '', version: '0.1.0', harnesses: ALL_HARNESSES.slice(),
        type: 'skill', inclusion: 'always', categories: [],
        ecosystem: '', depends: '', enhances: '', body: ''
      };

      if (mode === 'edit' && artifactName) {
        var entry = null;
        for (var i = 0; i < catalogData.length; i++) {
          if (catalogData[i].name === artifactName) { entry = catalogData[i]; break; }
        }
        if (entry) {
          defaults.name = entry.name || '';
          defaults.displayName = entry.displayName || '';
          defaults.description = entry.description || '';
          defaults.keywords = (entry.keywords || []).join(', ');
          defaults.author = entry.author || '';
          defaults.version = entry.version || '0.1.0';
          defaults.harnesses = entry.harnesses || ALL_HARNESSES.slice();
          defaults.type = entry.type || 'skill';
          defaults.inclusion = entry.inclusion || 'always';
          defaults.categories = entry.categories || [];
          defaults.ecosystem = (entry.ecosystem || []).join(', ');
          defaults.depends = (entry.depends || []).join(', ');
          defaults.enhances = (entry.enhances || []).join(', ');
          defaults.body = '';
        }
        // Fetch body content
        fetch('/api/artifact/' + encodeURIComponent(artifactName) + '/content')
          .then(function(res) { return res.ok ? res.text() : ''; })
          .then(function(text) {
            // Extract body after frontmatter
            var parts = text.split('---');
            if (parts.length >= 3) {
              defaults.body = parts.slice(2).join('---').trim();
            }
            var bodyEl = document.getElementById('field-body');
            if (bodyEl) bodyEl.value = defaults.body;
          })
          .catch(function() {});
      }

      var fields = {
        _title: mode === 'create' ? 'New Artifact' : 'Edit Artifact',
        _fields: [
          { key: 'displayName', label: 'Display Name', type: 'text', value: defaults.displayName },
          { key: 'name', label: 'Name (kebab-case)', type: 'text', value: defaults.name, mono: true },
          { key: 'description', label: 'Description', type: 'text', value: defaults.description },
          { key: 'author', label: 'Author', type: 'text', value: defaults.author },
          { key: 'version', label: 'Version', type: 'text', value: defaults.version },
          { key: 'harnesses', label: 'Harnesses', type: 'checkbox-group', options: ALL_HARNESSES, value: defaults.harnesses },
          { key: 'type', label: 'Type', type: 'radio-group', options: ARTIFACT_TYPES, value: defaults.type },
          { key: 'inclusion', label: 'Inclusion', type: 'radio-group', options: INCLUSION_MODES, value: defaults.inclusion },
          { key: 'categories', label: 'Categories', type: 'checkbox-group', options: ALL_CATEGORIES, value: defaults.categories },
          { key: 'keywords', label: 'Keywords (comma-separated)', type: 'text', value: defaults.keywords },
          { key: 'ecosystem', label: 'Ecosystem (comma-separated)', type: 'text', value: defaults.ecosystem },
          { key: 'depends', label: 'Depends (comma-separated)', type: 'text', value: defaults.depends },
          { key: 'enhances', label: 'Enhances (comma-separated)', type: 'text', value: defaults.enhances },
          { key: 'body', label: 'Body (Markdown)', type: 'textarea', value: defaults.body, mono: true }
        ]
      };

      renderForm(fields, mode, function() { submitArtifactForm(mode, artifactName); });

      // Wire up auto-generate name from displayName
      var displayNameInput = document.getElementById('field-displayName');
      var nameInput = document.getElementById('field-name');
      if (displayNameInput && nameInput) {
        displayNameInput.addEventListener('input', function() {
          if (!nameInput.value || nameInput.dataset.autoGenerated === 'true') {
            nameInput.value = toKebabCase(displayNameInput.value);
            nameInput.dataset.autoGenerated = 'true';
            validateNameField(nameInput);
          }
        });
        nameInput.addEventListener('input', function() {
          nameInput.dataset.autoGenerated = '';
          validateNameField(nameInput);
        });
        if (mode === 'create') nameInput.dataset.autoGenerated = 'true';
      }
    }

    function validateNameField(input) {
      var errEl = document.getElementById('error-name');
      if (!errEl) return;
      if (input.value && !isKebabCase(input.value)) {
        errEl.textContent = 'Must be kebab-case (e.g. my-artifact-name)';
        input.classList.add('has-error');
      } else {
        errEl.textContent = '';
        input.classList.remove('has-error');
      }
    }

    function parseCommaSeparated(str) {
      if (!str || !str.trim()) return [];
      return str.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
    }

    function getFormData() {
      var data = {};
      data.name = (document.getElementById('field-name') || {}).value || '';
      data.displayName = (document.getElementById('field-displayName') || {}).value || '';
      data.description = (document.getElementById('field-description') || {}).value || '';
      data.author = (document.getElementById('field-author') || {}).value || '';
      data.version = (document.getElementById('field-version') || {}).value || '';
      data.body = (document.getElementById('field-body') || {}).value || '';

      // Checkboxes: harnesses
      var hCbs = document.querySelectorAll('input[name="harnesses"]:checked');
      data.harnesses = [];
      for (var i = 0; i < hCbs.length; i++) data.harnesses.push(hCbs[i].value);

      // Radio: type
      var typeRadio = document.querySelector('input[name="type"]:checked');
      data.type = typeRadio ? typeRadio.value : 'skill';

      // Radio: inclusion
      var inclRadio = document.querySelector('input[name="inclusion"]:checked');
      data.inclusion = inclRadio ? inclRadio.value : 'always';

      // Checkboxes: categories
      var cCbs = document.querySelectorAll('input[name="categories"]:checked');
      data.categories = [];
      for (var i = 0; i < cCbs.length; i++) data.categories.push(cCbs[i].value);

      // Comma-separated fields
      data.keywords = parseCommaSeparated((document.getElementById('field-keywords') || {}).value);
      data.ecosystem = parseCommaSeparated((document.getElementById('field-ecosystem') || {}).value);
      data.depends = parseCommaSeparated((document.getElementById('field-depends') || {}).value);
      data.enhances = parseCommaSeparated((document.getElementById('field-enhances') || {}).value);

      return data;
    }

    function submitArtifactForm(mode, originalName) {
      clearFormErrors();
      var data = getFormData();

      // Client-side validation
      if (!data.name) { showFieldError('name', 'Name is required'); return; }
      if (!isKebabCase(data.name)) { showFieldError('name', 'Must be kebab-case'); return; }

      var url, method;
      if (mode === 'create') {
        url = '/api/artifact';
        method = 'POST';
      } else {
        url = '/api/artifact/' + encodeURIComponent(originalName);
        method = 'PUT';
      }

      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      .then(function(res) {
        if (res.ok) return res.json();
        return res.json().then(function(err) { throw { status: res.status, data: err }; });
      })
      .then(function(result) {
        showToast(mode === 'create' ? 'Artifact created' : 'Artifact updated', 'success');
        // Refresh catalog
        fetch('/api/catalog').then(function(r) { return r.json(); }).then(function(d) {
          catalogData = d;
          updateArtifactCount(catalogData.length);
          populateHarnessFilter(catalogData);
          populateFormatFilter(catalogData);
          populateMaturityFilter(catalogData);
          populateCollectionFilter(catalogData);
          document.getElementById('form-panel-container').style.display = 'none';
          showView('artifacts');
          showDetailView(data.name);
        });
      })
      .catch(function(err) {
        handleApiError(err);
      });
    }

    // END task 8.1
    // --- Task 8.2: Artifact delete and error handling ---

    function handleApiError(err) {
      if (!err || !err.status) {
        showToast('An unexpected error occurred', 'error');
        return;
      }
      if (err.status === 400 && err.data && err.data.details) {
        // Validation errors - show next to fields
        var details = err.data.details;
        if (Array.isArray(details)) {
          for (var i = 0; i < details.length; i++) {
            var d = details[i];
            if (d.path && d.path.length > 0) {
              showFieldError(d.path[d.path.length - 1], d.message || 'Invalid');
            }
          }
        } else if (typeof details === 'object') {
          var keys = Object.keys(details);
          for (var i = 0; i < keys.length; i++) {
            showFieldError(keys[i], details[keys[i]]);
          }
        }
        showToast(err.data.error || 'Validation failed', 'error');
      } else if (err.status === 409) {
        showToast(err.data.error || 'Name already exists', 'error');
      } else if (err.status === 404) {
        showToast(err.data.error || 'Not found', 'error');
        closeForm();
        showView(currentView);
      } else {
        showToast(err.data.error || 'Operation failed', 'error');
      }
    }

    function wireDetailActions(entry) {
      var editBtn = document.getElementById('detail-edit-btn');
      var deleteBtn = document.getElementById('detail-delete-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          showArtifactForm('edit', entry.name);
        });
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          showModal(
            'Delete Artifact',
            'Are you sure you want to permanently delete "' + entry.name + '"? This action cannot be undone.',
            function() {
              fetch('/api/artifact/' + encodeURIComponent(entry.name), { method: 'DELETE' })
                .then(function(res) {
                  if (res.ok) {
                    showToast('Artifact deleted', 'success');
                    fetch('/api/catalog').then(function(r) { return r.json(); }).then(function(d) {
                      catalogData = d;
                      updateArtifactCount(catalogData.length);
                      populateHarnessFilter(catalogData);
                      populateFormatFilter(catalogData);
                      populateMaturityFilter(catalogData);
                      populateCollectionFilter(catalogData);
                      showView('artifacts');
                    });
                  } else {
                    return res.json().then(function(err) { throw { status: res.status, data: err }; });
                  }
                })
                .catch(function(err) { handleApiError(err); });
            }
          );
        });
      }
    }

    // END task 8.2

    // --- Task 9.1: Collection list and detail views ---

    function loadCollections() {
      fetch('/api/collections')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          collectionsData = data;
          renderCollectionGrid(collectionsData);
        })
        .catch(function() {
          document.getElementById('collection-grid').innerHTML = '<div class="empty-state">Failed to load collections</div>';
        });
    }

    function renderCollectionGrid(collections) {
      var grid = document.getElementById('collection-grid');
      grid.innerHTML = '';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(360px, 1fr))';
      grid.style.gap = '12px';
      grid.style.padding = '24px';
      grid.style.maxWidth = '1440px';
      grid.style.margin = '0 auto';

      if (collections.length === 0) {
        grid.innerHTML = '<div class="empty-state">No collections found</div>';
        return;
      }
      for (var i = 0; i < collections.length; i++) {
        grid.appendChild(renderCard(collections[i], 'collection'));
      }
    }

    function showCollectionDetail(name) {
      document.getElementById('collection-grid').style.display = 'none';
      document.getElementById('collection-filters').style.display = 'none';
      var detailView = document.getElementById('collection-detail-view');
      detailView.style.display = 'block';
      detailView.style.padding = '32px 40px';
      detailView.style.maxWidth = '860px';
      detailView.style.margin = '0 auto';
      detailView.innerHTML = '<div class="empty-state">Loading...</div>';

      fetch('/api/collections/' + encodeURIComponent(name))
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var col = data.collection;
          var members = data.members || [];
          var trustBadge = col.trust ? renderBadge(col.trust, 'trust-' + col.trust) : '';
          var tagsHtml = '';
          if (col.tags && col.tags.length > 0) {
            tagsHtml = '<div class="card-tags" style="margin-bottom:20px">' + col.tags.map(function(t) {
              return '<span>' + escapeHtmlJs(t) + '</span>';
            }).join('') + '</div>';
          }
          var membersHtml = '';
          if (members.length > 0) {
            membersHtml = '<div class="detail-section-label">Member Artifacts</div><div style="display:flex;flex-direction:column;gap:6px">';
            for (var i = 0; i < members.length; i++) {
              membersHtml += '<a href="#" class="collection-member-link" data-name="' + escapeHtmlJs(members[i]) + '" style="font-family:var(--font-mono);font-size:0.825rem;color:var(--color-info);text-decoration:none">' + escapeHtmlJs(members[i]) + '</a>';
            }
            membersHtml += '</div>';
          } else {
            membersHtml = '<div class="detail-section-label">Member Artifacts</div><div style="font-size:0.875rem;color:#999">No member artifacts</div>';
          }

          detailView.innerHTML =
            '<div class="detail-back" id="collection-back-link"><span class="detail-back-arrow">\u2190</span> Collections</div>' +
            '<div class="detail-title-row"><h2>' + escapeHtmlJs(col.displayName || col.name) + '</h2><span style="font-size:0.85rem;color:#999">' + escapeHtmlJs(col.version || '') + '</span></div>' +
            '<div class="detail-pkg-name">' + escapeHtmlJs(col.name) + '</div>' +
            (col.description ? '<div class="detail-description">' + escapeHtmlJs(col.description) + '</div>' : '') +
            '<div class="detail-badges" style="margin-bottom:20px">' + trustBadge + '</div>' +
            tagsHtml +
            '<div style="margin-bottom:16px">' +
              '<button id="col-edit-btn" style="font-size:0.78rem;padding:5px 12px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);cursor:pointer;margin-right:8px">Edit</button>' +
              '<button id="col-delete-btn" style="font-size:0.78rem;padding:5px 12px;border:1px solid var(--color-error);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-error);cursor:pointer">Delete</button>' +
            '</div>' +
            membersHtml;

          document.getElementById('collection-back-link').addEventListener('click', function() {
            detailView.style.display = 'none';
            showView('collections');
          });

          // Wire member links
          var links = detailView.querySelectorAll('.collection-member-link');
          for (var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function(e) {
              e.preventDefault();
              var artifactName = this.getAttribute('data-name');
              detailView.style.display = 'none';
              currentView = 'artifacts';
              showView('artifacts');
              showDetailView(artifactName);
            });
          }

          // Wire edit/delete
          document.getElementById('col-edit-btn').addEventListener('click', function() {
            showCollectionForm('edit', col.name);
          });
          document.getElementById('col-delete-btn').addEventListener('click', function() {
            showModal('Delete Collection', 'Are you sure you want to permanently delete "' + col.name + '"?', function() {
              fetch('/api/collections/' + encodeURIComponent(col.name), { method: 'DELETE' })
                .then(function(res) {
                  if (res.ok) {
                    showToast('Collection deleted', 'success');
                    detailView.style.display = 'none';
                    showView('collections');
                  } else {
                    return res.json().then(function(err) { throw { status: res.status, data: err }; });
                  }
                })
                .catch(function(err) { handleApiError(err); });
            });
          });
        })
        .catch(function() {
          detailView.innerHTML = '<div class="empty-state">Failed to load collection</div>';
        });
    }

    // END task 9.1
    // --- Task 9.2: Collection create/edit form ---

    function showCollectionForm(mode, collectionName) {
      document.getElementById('collection-grid').style.display = 'none';
      document.getElementById('collection-detail-view').style.display = 'none';
      document.getElementById('collection-filters').style.display = 'none';

      var defaults = { name: '', displayName: '', description: '', version: '0.1.0', trust: 'community', tags: '' };

      if (mode === 'edit' && collectionName) {
        var col = null;
        for (var i = 0; i < collectionsData.length; i++) {
          if (collectionsData[i].name === collectionName) { col = collectionsData[i]; break; }
        }
        if (col) {
          defaults.name = col.name || '';
          defaults.displayName = col.displayName || '';
          defaults.description = col.description || '';
          defaults.version = col.version || '0.1.0';
          defaults.trust = col.trust || 'community';
          defaults.tags = (col.tags || []).join(', ');
        }
      }

      var fields = {
        _title: mode === 'create' ? 'New Collection' : 'Edit Collection',
        _fields: [
          { key: 'displayName', label: 'Display Name', type: 'text', value: defaults.displayName },
          { key: 'name', label: 'Name (kebab-case)', type: 'text', value: defaults.name, mono: true },
          { key: 'description', label: 'Description', type: 'text', value: defaults.description },
          { key: 'version', label: 'Version', type: 'text', value: defaults.version },
          { key: 'trust', label: 'Trust Level', type: 'select', options: ['official', 'community'], value: defaults.trust },
          { key: 'tags', label: 'Tags (comma-separated)', type: 'text', value: defaults.tags }
        ]
      };

      renderForm(fields, mode, function() { submitCollectionForm(mode, collectionName); });

      // Wire auto-generate name
      var displayNameInput = document.getElementById('field-displayName');
      var nameInput = document.getElementById('field-name');
      if (displayNameInput && nameInput) {
        displayNameInput.addEventListener('input', function() {
          if (!nameInput.value || nameInput.dataset.autoGenerated === 'true') {
            nameInput.value = toKebabCase(displayNameInput.value);
            nameInput.dataset.autoGenerated = 'true';
          }
        });
        nameInput.addEventListener('input', function() { nameInput.dataset.autoGenerated = ''; });
        if (mode === 'create') nameInput.dataset.autoGenerated = 'true';
      }
    }

    function submitCollectionForm(mode, originalName) {
      clearFormErrors();
      var data = {
        name: (document.getElementById('field-name') || {}).value || '',
        displayName: (document.getElementById('field-displayName') || {}).value || '',
        description: (document.getElementById('field-description') || {}).value || '',
        version: (document.getElementById('field-version') || {}).value || '',
        trust: (document.getElementById('field-trust') || {}).value || 'community',
        tags: parseCommaSeparated((document.getElementById('field-tags') || {}).value)
      };

      if (!data.name) { showFieldError('name', 'Name is required'); return; }
      if (!isKebabCase(data.name)) { showFieldError('name', 'Must be kebab-case'); return; }

      var url, method;
      if (mode === 'create') {
        url = '/api/collections';
        method = 'POST';
      } else {
        url = '/api/collections/' + encodeURIComponent(originalName);
        method = 'PUT';
      }

      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      .then(function(res) {
        if (res.ok) return res.json();
        return res.json().then(function(err) { throw { status: res.status, data: err }; });
      })
      .then(function(result) {
        showToast(mode === 'create' ? 'Collection created' : 'Collection updated', 'success');
        document.getElementById('form-panel-container').style.display = 'none';
        showView('collections');
        setTimeout(function() { showCollectionDetail(data.name); }, 200);
      })
      .catch(function(err) { handleApiError(err); });
    }

    // END task 9.2

    // --- Task 9.3: Collection filtering ---

    function filterCollections() {
      var query = (document.getElementById('collection-search-input') || {}).value || '';
      query = query.toLowerCase();

      var trustCbs = document.querySelectorAll('#trust-filter input:checked');
      var selectedTrusts = [];
      for (var i = 0; i < trustCbs.length; i++) selectedTrusts.push(trustCbs[i].value);

      var tagInput = (document.getElementById('tag-filter-input') || {}).value || '';
      var tagFilter = tagInput.trim().toLowerCase();

      var filtered = collectionsData.filter(function(col) {
        if (query) {
          var nameMatch = (col.name || '').toLowerCase().indexOf(query) !== -1;
          var displayMatch = (col.displayName || '').toLowerCase().indexOf(query) !== -1;
          var descMatch = (col.description || '').toLowerCase().indexOf(query) !== -1;
          if (!nameMatch && !displayMatch && !descMatch) return false;
        }
        if (selectedTrusts.length > 0) {
          if (selectedTrusts.indexOf(col.trust || '') === -1) return false;
        }
        if (tagFilter) {
          var tags = col.tags || [];
          var hasTag = false;
          for (var i = 0; i < tags.length; i++) {
            if (tags[i].toLowerCase().indexOf(tagFilter) !== -1) { hasTag = true; break; }
          }
          if (!hasTag) return false;
        }
        return true;
      });

      renderCollectionGrid(filtered);
    }

    function populateTrustFilter() {
      var trusts = {};
      for (var i = 0; i < collectionsData.length; i++) {
        var t = collectionsData[i].trust || 'community';
        trusts[t] = true;
      }
      var container = document.getElementById('trust-filter');
      container.innerHTML = '';
      Object.keys(trusts).sort().forEach(function(t) {
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = t;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + t));
        container.appendChild(label);
      });
    }

    // Wire collection filter events
    document.addEventListener('DOMContentLoaded', function() {
      var searchEl = document.getElementById('collection-search-input');
      if (searchEl) searchEl.addEventListener('input', filterCollections);
      var trustEl = document.getElementById('trust-filter');
      if (trustEl) trustEl.addEventListener('change', filterCollections);
      var tagEl = document.getElementById('tag-filter-input');
      if (tagEl) tagEl.addEventListener('input', filterCollections);
    });

    // Override loadCollections to also populate trust filter
    var _origLoadCollections = loadCollections;
    loadCollections = function() {
      fetch('/api/collections')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          collectionsData = data;
          populateTrustFilter();
          filterCollections();
        })
        .catch(function() {
          document.getElementById('collection-grid').innerHTML = '<div class="empty-state">Failed to load collections</div>';
        });
    };

    // END task 9.3

    // --- Task 9.4: Collection badges on artifact detail ---
    // (Integrated into showDetailView override below)

    // END task 9.4
    // --- Task 10.1: Manifest table view ---

    function loadManifest() {
      var view = document.getElementById('manifest-view');
      view.style.padding = '24px';
      view.style.maxWidth = '1200px';
      view.style.margin = '0 auto';
      view.innerHTML = '<div class="empty-state">Loading manifest...</div>';

      Promise.all([
        fetch('/api/manifest').then(function(r) { return r.ok ? r.json() : { artifacts: [] }; }),
        fetch('/api/manifest/status').then(function(r) { return r.ok ? r.json() : { entries: [], syncedAt: null }; })
      ]).then(function(results) {
        manifestData = results[0];
        manifestStatusData = results[1];
        renderManifestTable();
      }).catch(function() {
        view.innerHTML = '<div class="empty-state">Failed to load manifest</div>';
      });
    }

    function renderManifestTable() {
      var view = document.getElementById('manifest-view');
      var entries = (manifestData && manifestData.artifacts) || [];
      var statusEntries = (manifestStatusData && manifestStatusData.entries) || [];

      if (entries.length === 0) {
        view.innerHTML = '<div class="empty-state">No manifest entries. Add entries to declare artifact dependencies.</div>';
        return;
      }

      var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.825rem">' +
        '<thead><tr style="border-bottom:2px solid var(--color-border);text-align:left">' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Type</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Identifier</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Version</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Mode</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Harnesses</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Backend</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Status</th>' +
        '<th style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Actions</th>' +
        '</tr></thead><tbody>';

      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var isCollection = !!e.collection;
        var identifier = isCollection ? e.collection : e.name;
        var typeIcon = isCollection ? '\u25C6' : '\u25CF';
        var typeLabel = isCollection ? 'collection' : 'artifact';
        var typeBadge = renderBadge(typeLabel, 'type-' + typeLabel);

        var harnessIcons = '';
        if (e.harnesses && e.harnesses.length > 0) {
          harnessIcons = e.harnesses.map(function(h) {
            var icon = HARNESS_ICONS[h] || h.charAt(0).toUpperCase();
            return '<span class="harness-icon" title="' + escapeHtmlJs(h) + '" style="font-size:0.85rem">' + icon + '</span>';
          }).join('');
        } else {
          harnessIcons = '<span style="color:var(--color-text-muted);font-size:0.75rem">all</span>';
        }

        var modeBadge = e.mode === 'required'
          ? '<span style="font-size:0.7rem;font-weight:600;padding:2px 6px;border-radius:4px;background:var(--color-text-primary);color:#fff">' + escapeHtmlJs(e.mode) + '</span>'
          : '<span style="font-size:0.7rem;font-weight:600;padding:2px 6px;border-radius:4px;border:1px solid var(--color-border);color:var(--color-text-secondary)">' + escapeHtmlJs(e.mode || 'optional') + '</span>';

        // Find status
        var status = 'missing';
        for (var s = 0; s < statusEntries.length; s++) {
          if (statusEntries[s].identifier === identifier) {
            status = statusEntries[s].status || 'missing';
            break;
          }
        }
        var statusColor = status === 'synced' ? 'var(--color-status-synced)' : status === 'outdated' ? 'var(--color-status-outdated)' : 'var(--color-status-missing)';
        var statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + statusColor + '" title="' + escapeHtmlJs(status) + '"></span>';

        html += '<tr style="border-bottom:1px solid var(--color-border-subtle)" data-identifier="' + escapeHtmlJs(identifier) + '">' +
          '<td style="padding:10px 12px">' + typeIcon + ' ' + typeBadge + '</td>' +
          '<td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.8rem">' + escapeHtmlJs(identifier) + '</td>' +
          '<td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.8rem">' + escapeHtmlJs(e.version || '') + '</td>' +
          '<td style="padding:10px 12px">' + modeBadge + '</td>' +
          '<td style="padding:10px 12px">' + harnessIcons + '</td>' +
          '<td style="padding:10px 12px;font-size:0.8rem;color:var(--color-text-secondary)">' + escapeHtmlJs(e.backend || '\u2014') + '</td>' +
          '<td style="padding:10px 12px">' + statusDot + '</td>' +
          '<td style="padding:10px 12px">' +
            '<button class="manifest-edit-btn" data-idx="' + i + '" style="background:none;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:3px 8px;cursor:pointer;font-size:0.75rem;margin-right:4px" title="Edit">\u270E</button>' +
            '<button class="manifest-remove-btn" data-identifier="' + escapeHtmlJs(identifier) + '" style="background:none;border:1px solid var(--color-error);border-radius:var(--radius-sm);padding:3px 8px;cursor:pointer;font-size:0.75rem;color:var(--color-error)" title="Remove">\u00D7</button>' +
          '</td></tr>';
      }

      html += '</tbody></table></div>';
      view.innerHTML = html;

      // Wire edit buttons
      var editBtns = view.querySelectorAll('.manifest-edit-btn');
      for (var i = 0; i < editBtns.length; i++) {
        editBtns[i].addEventListener('click', function() {
          var idx = parseInt(this.getAttribute('data-idx'), 10);
          var entry = manifestData.artifacts[idx];
          if (entry) showManifestEntryForm('edit', entry);
        });
      }

      // Wire remove buttons
      var removeBtns = view.querySelectorAll('.manifest-remove-btn');
      for (var i = 0; i < removeBtns.length; i++) {
        removeBtns[i].addEventListener('click', function() {
          var id = this.getAttribute('data-identifier');
          showModal('Remove Entry', 'Remove "' + id + '" from the manifest?', function() {
            fetch('/api/manifest/entries/' + encodeURIComponent(id), { method: 'DELETE' })
              .then(function(res) {
                if (res.ok) {
                  showToast('Entry removed', 'success');
                  loadManifest();
                } else {
                  return res.json().then(function(err) { throw { status: res.status, data: err }; });
                }
              })
              .catch(function(err) { handleApiError(err); });
          });
        });
      }
    }

    // END task 10.1
    // --- Task 10.2: Manifest add/edit/remove controls ---

    function showManifestEntryForm(mode, existingEntry) {
      document.getElementById('manifest-view').style.display = 'none';

      var isCollection = existingEntry ? !!existingEntry.collection : false;
      var defaults = {
        refType: isCollection ? 'collection' : 'artifact',
        name: existingEntry ? (existingEntry.name || '') : '',
        collection: existingEntry ? (existingEntry.collection || '') : '',
        version: existingEntry ? (existingEntry.version || '') : '',
        mode: existingEntry ? (existingEntry.mode || 'required') : 'required',
        harnesses: existingEntry ? (existingEntry.harnesses || []) : [],
        backend: existingEntry ? (existingEntry.backend || '') : ''
      };

      var fields = {
        _title: mode === 'create' ? 'Add Manifest Entry' : 'Edit Manifest Entry',
        _fields: [
          { key: 'refType', label: 'Reference Type', type: 'radio-group', options: ['artifact', 'collection'], value: defaults.refType },
          { key: 'name', label: 'Artifact Name', type: 'text', value: defaults.name, mono: true },
          { key: 'collection', label: 'Collection Name', type: 'text', value: defaults.collection, mono: true },
          { key: 'version', label: 'Version', type: 'text', value: defaults.version, mono: true },
          { key: 'mode', label: 'Mode', type: 'radio-group', options: ['required', 'optional'], value: defaults.mode },
          { key: 'harnesses', label: 'Harnesses', type: 'checkbox-group', options: ALL_HARNESSES, value: defaults.harnesses },
          { key: 'backend', label: 'Backend (optional)', type: 'text', value: defaults.backend }
        ]
      };

      renderForm(fields, mode, function() { submitManifestEntryForm(mode, existingEntry); });

      // Toggle name/collection visibility based on refType
      function updateRefTypeVisibility() {
        var refType = 'artifact';
        var radio = document.querySelector('input[name="refType"]:checked');
        if (radio) refType = radio.value;
        var nameGroup = document.getElementById('field-name');
        var colGroup = document.getElementById('field-collection');
        if (nameGroup) nameGroup.parentNode.style.display = refType === 'artifact' ? '' : 'none';
        if (colGroup) colGroup.parentNode.style.display = refType === 'collection' ? '' : 'none';
      }
      updateRefTypeVisibility();
      var refRadios = document.querySelectorAll('input[name="refType"]');
      for (var i = 0; i < refRadios.length; i++) {
        refRadios[i].addEventListener('change', updateRefTypeVisibility);
      }
    }

    function submitManifestEntryForm(mode, existingEntry) {
      clearFormErrors();
      var refType = 'artifact';
      var radio = document.querySelector('input[name="refType"]:checked');
      if (radio) refType = radio.value;

      var data = {};
      if (refType === 'artifact') {
        data.name = (document.getElementById('field-name') || {}).value || '';
      } else {
        data.collection = (document.getElementById('field-collection') || {}).value || '';
      }
      data.version = (document.getElementById('field-version') || {}).value || '';
      var modeRadio = document.querySelector('input[name="mode"]:checked');
      data.mode = modeRadio ? modeRadio.value : 'required';

      var hCbs = document.querySelectorAll('input[name="harnesses"]:checked');
      data.harnesses = [];
      for (var i = 0; i < hCbs.length; i++) data.harnesses.push(hCbs[i].value);
      if (data.harnesses.length === 0) delete data.harnesses;

      var backend = (document.getElementById('field-backend') || {}).value || '';
      if (backend) data.backend = backend;

      if (refType === 'artifact' && !data.name) { showFieldError('name', 'Name is required'); return; }
      if (refType === 'collection' && !data.collection) { showFieldError('collection', 'Collection name is required'); return; }
      if (!data.version) { showFieldError('version', 'Version is required'); return; }

      var url, method;
      if (mode === 'create') {
        url = '/api/manifest/entries';
        method = 'POST';
      } else {
        var identifier = existingEntry.collection || existingEntry.name;
        url = '/api/manifest/entries/' + encodeURIComponent(identifier);
        method = 'PUT';
      }

      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      .then(function(res) {
        if (res.ok) return res.json();
        return res.json().then(function(err) { throw { status: res.status, data: err }; });
      })
      .then(function() {
        showToast(mode === 'create' ? 'Entry added' : 'Entry updated', 'success');
        document.getElementById('form-panel-container').style.display = 'none';
        showView('manifest');
      })
      .catch(function(err) { handleApiError(err); });
    }

    // END task 10.2

    // --- Task 11.1: Tab navigation (wired in HTML above) ---
    // showView() already handles tab switching, filter visibility, and content rendering.
    // The tab nav HTML and new button are in the header.
    // END task 11.1

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
