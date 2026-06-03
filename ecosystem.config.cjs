/**
 * PM2 config — copy to VPS and adjust APP_DIR / PORT if needed.
 * Start: pm2 start ecosystem.config.cjs && pm2 save
 */
const APP_DIR = "/var/www/WhatsApp-audit";
const PORT = 3010;

module.exports = {
  apps: [
    {
      name: "g6-audit",
      cwd: APP_DIR,
      script: "node_modules/.bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT,
      },
      // Next.js loads .env.production from cwd when NODE_ENV=production.
      // File must live at: /var/www/WhatsApp-audit/.env.production
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
    },
  ],
};
