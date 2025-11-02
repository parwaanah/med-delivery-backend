──────────────────────────────────────────────
💡 VS CODE BACKEND AUTO-START GUIDE
──────────────────────────────────────────────

📦 This folder has an automated backend controller:
   backend-master-v4.ps1

⚙️ It:
   • Starts PostgreSQL automatically
   • Ensures Redis is running (via WSL)
   • Rebuilds the backend with Prisma
   • Launches NestJS on port 3001
   • Monitors and auto-heals all services
   • Closes cleanly when VS Code is closed

🧠 How it works:
   - The VS Code task "Start Backend Master (auto)"
     runs automatically on folder open.
   - It uses PowerShell, logs to backend-master.log,
     and launches your backend silently in background.

⚠️ First-time setup:
   1. When you open the folder, VS Code will ask:
      "Allow Automatic Tasks on Folder Open?"
      → Click **Allow**.
   2. Wait ~10s for PostgreSQL/Redis checks.
   3. Swagger Docs open at:
      👉 http://localhost:3001/docs

🔴 To stop backend manually:
   • Close VS Code, or run:
     PowerShell → stop-backend.ps1

📘 Logs:
   • Realtime: check the terminal
   • Persistent log file: backend-master.log
──────────────────────────────────────────────
