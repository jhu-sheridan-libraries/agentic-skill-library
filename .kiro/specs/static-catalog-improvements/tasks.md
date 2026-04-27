# Tasks

## Task 1: Add static-mode detection flag and tab hiding logic

- [x] 1.1 In the embedded `<script>` within `generateHtmlPage()` in `src/browse-ui.ts`, add `var isStaticMode = !!window.__CATALOG_DATA__;` at the top of the `DOMContentLoaded` handler, before the `initCatalog` call.
- [x] 1.2 After setting `isStaticMode`, add a conditional block that hides the tab-nav items with `data-view` values `collections`, `manifest`, `graph`, `workspace` by setting `style.display = 'none'` on each. Use `document.querySelectorAll('.tab-nav-item')` and check `getAttribute('data-view')`.
- [x] 1.3 In the same conditional block, also hide the Build tab. Note: the Build tab does not currently exist as a `tab-nav-item` in the nav — it is accessed via the header Build button which calls `showView('build')`. If a `data-view="build"` tab-nav-item exists, hide it; also ensure the build view cannot be reached in static mode.

## Task 2: Hide header action buttons in static mode

- [x] 2.1 In the same `isStaticMode` conditional block in the `DOMContentLoaded` handler, hide the Import button (`#import-btn`), Build button (`#build-btn`), New Artifact button (`#new-btn`), and build status indicator (`#build-status-indicator`) by setting `style.display = 'none'`.

## Task 3: Default collection filter to "jhu" in static mode

- [x] 3.1 In the `initCatalog` function (after `populateCollectionFilter` is called), add a check: if `isStaticMode` is true, find the `.collection-cb` checkbox with `value === 'jhu'` and set its `checked` property to `true`.
- [x] 3.2 After pre-selecting the "jhu" checkbox, call `filterAndRender()` so the filter is applied immediately on page load.
- [x] 3.3 Ensure the code handles the case where no "jhu" collection exists gracefully — if the checkbox is not found, skip pre-selection and display all artifacts.

## Task 4: Add unit tests for static-mode behavior

- [x] 4.1 Add tests in `src/__tests__/browse.test.ts` (or a new test file) verifying that `generateStaticHtmlPage` output contains the `isStaticMode` detection variable.
- [x] 4.2 Add tests verifying the static page JS contains logic to hide the interactive tabs (`collections`, `manifest`, `graph`, `workspace`, `build` data-view items).
- [x] 4.3 Add tests verifying the static page JS contains logic to hide header buttons (`import-btn`, `build-btn`, `new-btn`, `build-status-indicator`).
- [x] 4.4 Add tests verifying the static page JS contains logic to pre-select the "jhu" collection checkbox.
- [x] 4.5 Add regression tests verifying `generateHtmlPage` (live mode) output still contains all tabs and header buttons.
- [x] 4.6 Run `bun test` to confirm all existing and new tests pass.
