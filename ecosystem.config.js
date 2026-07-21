// PM2 process config for the Dufat showcase (Next.js).
// The app binds to 127.0.0.1 only — nginx terminates TLS and reverse-proxies to it.
// Next.js loads .env from cwd at startup, so DB/Redis/secrets come from there.
module.exports = {
  apps: [
    {
      name: "dufat",
      cwd: "/home/deploy/dufat-app",
      script: "./node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3050",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: "3050",
        HOSTNAME: "127.0.0.1",
      },
      out_file: "/home/deploy/dufat-app/logs/pm2-out.log",
      error_file: "/home/deploy/dufat-app/logs/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
