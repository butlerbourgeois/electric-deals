---
name: feedback-cmd-execution
description: How to run Node/npm commands in this WSL2+Windows environment
metadata:
  type: feedback
---

Always run npm/npx/node commands via `cmd.exe /c "cd /d C:\\coding\\repos\\electric-deals && <command>"`.

**Why:** Node.js 24 is installed as a Windows binary, not in the WSL Linux layer. Direct `node`, `npm`, `npx` calls fail with "command not found" in bash. The `.cmd` wrapper scripts have Windows line endings that break when bash tries to execute them directly.

**How to apply:** Any time you need to run npm install, npm run build, npx, etc. — always wrap in `cmd.exe /c "cd /d C:\\coding\\repos\\electric-deals && ..."`. Git commands work natively in bash (Linux git is installed). The gh CLI is at `/mnt/c/Program Files/GitHub CLI/gh.exe` and works directly from bash.
