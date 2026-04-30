@/home/wogny/.codex/RTK.md
@/home/wogny/projects/_bmad-output/project-context.md

# Canonical Codex Workspace

The canonical workspace for this project is:

`/home/wogny/projects/sistema-adalto`

Always use this Linux path for code edits, dependency installation, tests, lint, builds, and dev servers.

Do not run Node.js, npm, Vitest, Next.js, or dependency-management commands from the Windows-mounted copy under:

`/mnt/d/VICTOR/DADOS/SISTEMA ADALTO/sistema-adalto`

If a session starts in the Windows-mounted copy, immediately switch command `workdir` values to `/home/wogny/projects/sistema-adalto` before inspecting, editing, testing, or building. Treat the Linux copy as the source of truth for Codex work.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
