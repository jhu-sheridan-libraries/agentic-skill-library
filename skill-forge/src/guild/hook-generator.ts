// ---------------------------------------------------------------------------
// Shell Snippet Generator — generate shell profile snippets for auto-sync
// ---------------------------------------------------------------------------

export type ShellType = "bash" | "zsh" | "fish" | "powershell";

/**
 * Generate a shell snippet that auto-syncs on directory change.
 * The snippet detects `.forge/manifest.yaml` and runs
 * `forge guild sync --auto-update` in the background.
 * All output is redirected to /dev/null (or $null on PowerShell).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.7
 */
export function generateHookSnippet(shell: ShellType): string {
  switch (shell) {
    case "bash":
      return bashSnippet();
    case "zsh":
      return zshSnippet();
    case "fish":
      return fishSnippet();
    case "powershell":
      return powershellSnippet();
  }
}

/**
 * Detect the current shell from the SHELL environment variable.
 * Returns null if SHELL is not set.
 *
 * Requirements: 7.5, 7.6
 */
export function detectShell(): ShellType | null {
  const shellEnv = process.env.SHELL;
  if (!shellEnv) return null;

  if (shellEnv.includes("zsh")) return "zsh";
  if (shellEnv.includes("bash")) return "bash";
  if (shellEnv.includes("fish")) return "fish";

  return null;
}

// ---------------------------------------------------------------------------
// Shell-specific snippets
// ---------------------------------------------------------------------------

function bashSnippet(): string {
  return `# Skill Forge auto-sync hook (bash)
_forge_guild_autosync() {
  if [ -f ".forge/manifest.yaml" ]; then
    forge guild sync --auto-update > /dev/null 2>&1 &
  fi
}

cd() {
  builtin cd "$@" && _forge_guild_autosync
}`;
}

function zshSnippet(): string {
  return `# Skill Forge auto-sync hook (zsh)
_forge_guild_autosync() {
  if [ -f ".forge/manifest.yaml" ]; then
    forge guild sync --auto-update > /dev/null 2>&1 &
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd _forge_guild_autosync`;
}

function fishSnippet(): string {
  return `# Skill Forge auto-sync hook (fish)
function _forge_guild_autosync --on-variable PWD
  if test -f ".forge/manifest.yaml"
    forge guild sync --auto-update > /dev/null 2>&1 &
  end
end`;
}

function powershellSnippet(): string {
  return `# Skill Forge auto-sync hook (PowerShell)
function Invoke-ForgeGuildAutoSync {
  if (Test-Path ".forge/manifest.yaml") {
    Start-Process -NoNewWindow -FilePath "forge" -ArgumentList "guild","sync","--auto-update" -RedirectStandardOutput $null -RedirectStandardError $null
  }
}

# Override Set-Location to trigger auto-sync
$ExecutionContext.SessionState.InvokeCommand.CommandNotFoundAction = $null
function Set-Location {
  [CmdletBinding()]
  param([string]$Path)
  Microsoft.PowerShell.Management\\Set-Location $Path
  Invoke-ForgeGuildAutoSync
}
Set-Alias -Name cd -Value Set-Location -Force`;
}
