# ALICE TUI Development Context

## AliceScreen Base Class (ADR-013)

Location: `tui/screens/base.py`

All TUI screens (except HomeScreen, QuitScreen) inherit `AliceScreen`:

```python
class AliceScreen(Screen[None]):
    BINDINGS = [Binding("escape", "pop_screen", "Back")]

    @property
    def config(self) -> CLIConfig: ...        # self.app.alice_config typed
    @property
    def _wordstar(self) -> bool: ...          # self.app.wordstar flag
    def _create_session(self) -> Session: ... # boto3 session from config profile/region
    def _handle_error(self, exc, output): ... # consistent error display
```

| Method | Purpose |
|---|---|
| `self.config` | Returns `CLIConfig` — no `type: ignore` needed |
| `self._wordstar` | Reads `self.app.wordstar` for typewriter mode |
| `self._create_session()` | Creates `boto3.Session(profile_name=..., region_name=...)` |
| `self._handle_error(exc, output)` | Formats `AliceCLIError`, `ClientError`, generic exceptions |

## Screen Registry (ADR-015)

Location: `tui/screens/home.py`

```python
_SCREEN_REGISTRY: dict[str, tuple[str, str]] = {
    "invoke":   ("alice_cli.tui.screens.invoke",   "InvokeScreen"),
    "chat":     ("alice_cli.tui.screens.chat",     "ChatScreen"),
    "teaparty": ("alice_cli.tui.screens.teaparty", "TeaPartyScreen"),
    # ... one line per screen
}
```

- Adding a screen: add one entry to `_SCREEN_REGISTRY`
- Lazy import via `importlib.import_module()` — screens load on first navigation
- `_SCREEN_VERBS` derived from registry keys

## Worker Thread Pattern (ADR-014)

```python
# In any AliceScreen method:
def _do_work(self):
    worker = self.run_worker(self._background_task, thread=True)

async def _background_task(self):
    # Network call (Bedrock, S3, Polly)
    result = client.converse_stream(...)
    # UI update — MUST use app.call_from_thread
    self.app.call_from_thread(self._update_ui, result)
```

- All Bedrock/S3/Polly calls run in `self.run_worker(thread=True)`
- UI updates from threads: `self.app.call_from_thread(callback, *args)`
- Never mutate widgets directly from a worker thread
- Error handling in workers: route through `self.app.call_from_thread(self._handle_error, exc, output)`

## Widget Inventory

| Widget | File | Purpose |
|---|---|---|
| BreadcrumbBar | `widgets/breadcrumb.py` | Screen path trail ("Home › Chat") |
| TokenTracker | `widgets/token_tracker.py` | Cumulative token count + cost display |
| HelpOverlay | `widgets/help_overlay.py` | Modal keybinding reference (`?` key) |
| ChatLog | `widgets/chat_log.py` | Scrollable user/assistant message log |
| CommandPalette | `widgets/command_palette.py` | Fuzzy-search verb navigation (`/` key) |
| AliceHeaderBar | `widgets/header_bar.py` | App header with title + clock |
| OutputPanel | `widgets/output.py` | Rich markdown output with WordStar support |
| WordStarBar | `widgets/wordstar_bar.py` | WordStar mode status indicator |

## CRT Theme Conventions

- Aesthetic: amber-on-black retro CRT
- Theme files: `theme.tcss` (amber), `theme_soft.tcss` (reduced contrast), `theme_blue.tcss` (JHU DOS-blue)
- Shared CSS class: `.alice-panel` — retro-blue background `#0A1628`, border `tall #1A3A5C`
- Theme toggle: `Ctrl+T` cycles variants, persisted in `~/.alice/tui_state.json`
- Palette constants in `theme.py`

## Screen Layout Pattern

```python
class MyScreen(AliceScreen):
    def compose(self) -> ComposeResult:
        yield AliceHeaderBar()
        yield BreadcrumbBar()  # "Home › MyScreen"
        with Container(classes="alice-panel"):
            yield ...  # screen content
```

## TUI State Persistence

- File: `~/.alice/tui_state.json`
- Contains: last_model, last_screen, prompt_history (per screen), theme
- Load: `load_tui_state()` in `app.py`
- Save: `save_tui_state()` on quit
- Corrupt/missing file → default state, no error

## Keybindings

| Key | Scope | Action |
|---|---|---|
| `/` | Global (no text input) | Open CommandPalette |
| `?` | Global (no text input) | Open HelpOverlay |
| `Ctrl+T` | Global | Cycle theme |
| `Ctrl+K` | Global | Toggle TokenTracker |
| `j`/`k` | Lists/tables | Focus down/up |
| `g` + char | Global | Go-to screen (gc=chat, gi=invoke, etc.) |
| `Escape` | Any screen | Pop screen (back) |
