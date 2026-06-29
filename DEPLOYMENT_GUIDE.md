# TerraDairy — Deployment Guide

This guide covers deploying TerraDairy to production. It includes local setup verification, Docker containerization, reverse proxy configuration, process management, SSL/TLS, monitoring, and backup strategies.

---

## 1. Prerequisites

Before deploying TerraDairy, ensure the following are available on the target server or container environment:

| Requirement | Minimum Version | Notes |
|---|---|---|
| Node.js | 18.17+ | LTS recommended (18.x or 20.x) |
| npm | 9.x+ | Bundled with Node.js |
| PostgreSQL | 14+ | 15 or 16 recommended for performance |
| Git | 2.x+ | For cloning the repository |
| System memory | 512 MB minimum | 1 GB+ recommended for production builds |
| Disk space | 2 GB+ | For node_modules, build output, and database |

On Ubuntu/Debian, install system dependencies:

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql-client curl git
```

For Red Hat/CentOS:

```bash
sudo dnf install -y nodejs npm postgresql curl git
```

---

## 2. Environment Configuration

TerraDairy requires exactly three environment variables. Create a `.env.local` file in the project root (this file is gitignored):

```env
# PostgreSQL connection string for Prisma pg adapter
DATABASE_URL=postgresql://terradairy_user:your_secure_password@localhost:5432/terradairy_db

# JWT signing secret — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-random-64-char-secret-here

# Public base URL of your application (used by NextAuth for callbacks)
NEXTAUTH_URL=https://dairy.yourdomain.com
```

### DATABASE_URL Format

TerraDairy uses `@prisma/adapter-pg` (the PostgreSQL driver adapter), not the default Prisma query engine. The `DATABASE_URL` must be a standard PostgreSQL connection string:

```
postgresql://[user]:[password]@[host]:[port]/[database]?[options]
```

Common SSL options for cloud-hosted PostgreSQL:

```
DATABASE_URL=postgresql://user:pass@db.example.com:5432/terradairy?sslmode=require
```

### Generating NEXTAUTH_SECRET

Generate a cryptographically secure random string:

```bash
openssl rand -base64 32
```

This value must be identical across all instances in a horizontally scaled deployment. Changing it will invalidate all existing sessions.

### NEXTAUTH_URL

Set this to the fully qualified public URL of your application, including the protocol. NextAuth uses this for CSRF protection and callback URLs. It must match the `Host` header that browsers send.

---

## 3. Database Setup

### Create the Database and User

Connect to PostgreSQL as a superuser and create a dedicated database and user:

```sql
CREATE USER terradairy_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE terradairy_db OWNER terradairy_user;
GRANT ALL PRIVILEGES ON DATABASE terradairy_db TO terradairy_user;
```

### Run Seed Data (if available)

The project includes a `sql_queries.sql` file with initial data:

```bash
psql $DATABASE_URL -f sql_queries.sql
```

### Generate Prisma Client and Push Schema

```bash
npx prisma generate
npx prisma db push
```

`db push` synchronizes the Prisma schema with the database without generating migration files. For production environments where you want tracked migrations, use:

```bash
npx prisma migrate deploy
```

### Verify the Database

Open Prisma Studio to visually inspect the database:

```bash
npx prisma studio
```

This opens a web interface at `http://localhost:5555` showing all tables and data.

---

## 4. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/terradairy.git
cd terradairy
npm install --legacy-peer-deps --ignore-scripts
npx prisma generate
```

Verify the installation by running the test suite:

```bash
npm test
```

All 197 unit tests should pass. Then start the development server to confirm the application works:

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. You should be redirected to the login page.

---

## 5. Development Mode

For local development:

```bash
# Terminal 1: Application server (hot-reload)
npm run dev

# Terminal 2: Prisma Studio (database GUI)
npx prisma studio
```

The development server starts on port 3000 by default. Next.js hot-reload is enabled, so code changes are reflected immediately in the browser without restarting.

### Environment Variables in Development

Create `.env.local` in the project root. Next.js automatically loads this file. Never commit `.env.local` to version control.

---

## 6. Production Build

### Standard Build

```bash
npm run build
```

This runs `prisma generate` (to regenerate the client) followed by `next build`, which produces an optimized production bundle in the `.next/` directory.

### Start the Production Server

```bash
npm start
```

This starts the Next.js production server on port 3000. It uses Node.js's HTTP server with optimized code and no hot-reload overhead.

### Standalone Output Mode

For containerized or minimal deployments, add `output: 'standalone'` to `next.config.js`:

```js
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};
module.exports = nextConfig;
```

After building, the standalone output is in `.next/standalone/`. You can run it directly:

```bash
node .next/standalone/server.js
```

This bundles all necessary dependencies and does not require `node_modules` at runtime (except for native modules like `pg`).

---

## 7. Docker Deployment

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### .dockerignore

```
node_modules
.next
.git
.env.local
*.md
__tests__
e2e
scripts
```

### docker-compose.yml

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: terradairy_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: terradairy_db
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./sql_queries.sql:/docker-entrypoint-initdb.d/01-seed.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U terradairy_user -d terradairy_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://terradairy_user:${DB_PASSWORD:-changeme}@db:5432/terradairy_db
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-change-this-to-a-random-secret}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3000}
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

### Running with Docker Compose

```bash
# Create .env with secrets
echo "DB_PASSWORD=your-db-password" >> .env
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "NEXTAUTH_URL=https://dairy.yourdomain.com" >> .env

# Start services
docker compose up -d --build

# View logs
docker compose logs -f app

# Stop
docker compose down

# Stop and remove volumes (destroys database)
docker compose down -v
```

---

## 8. Nginx Reverse Proxy

Place Nginx in front of Next.js for TLS termination, static asset caching, and security headers:

```nginx
upstream nextjs_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name dairy.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dairy.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/dairy.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dairy.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Cache Next.js static assets aggressively
    location /_next/static/ {
        alias /home/deploy/terradairy/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # Cache favicon and images
    location /_next/image/ {
        proxy_pass http://nextjs_backend;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy all other requests to Next.js
    location / {
        proxy_pass http://nextjs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/terradairy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Process Management

### PM2

Install PM2 and create an ecosystem file:

```bash
npm install -g pm2
```

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: "terradairy",
      script: "npm",
      args: "start",
      cwd: "/home/deploy/terradairy",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/terradairy/err.log",
      out_file: "/var/log/terradairy/out.log",
      time: true,
    },
  ],
};
```

Start and manage:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # generates systemd service command
```

### Systemd Service

Alternatively, create `/etc/systemd/system/terradairy.service`:

```ini
[Unit]
Description=TerraDairy Dairy Farm Management
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/terradairy
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/home/deploy/terradairy/.env.local

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable terradairy
sudo systemctl start terradairy
sudo systemctl status terradairy
```

---

## 10. SSL/TLS

### Let's Encrypt (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dairy.yourdomain.com
```

Certbot will automatically configure Nginx and set up auto-renewal via a systemd timer. Verify renewal:

```bash
sudo certbot renew --dry-run
```

### Cloud-Managed Certificates

If deploying behind a cloud load balancer (AWS ALB, GCP Load Balancer, Cloudflare), terminate TLS at the load balancer and forward traffic to Nginx (or directly to the app) over HTTP. Set `NEXTAUTH_URL` to the external HTTPS URL.

---

## 11. Monitoring and Health Checks

### Health Check Endpoint

TerraDairy does not yet have a dedicated `/api/health` endpoint, but you can use the NextAuth CSRF endpoint as a liveness probe. A more robust approach is to add a simple health route that checks database connectivity.

For container orchestrators and load balancers, configure a health check against any authenticated endpoint that returns a predictable status code. The login page itself (HTTP 200) serves as a basic liveness check.

### Application Logging

Next.js logs to stdout/stderr. Configure your process manager to capture these:

- **PM2**: Automatically writes to `~/.pm2/logs/` or the paths in `ecosystem.config.js`
- **Systemd**: Logs available via `journalctl -u terradairy -f`
- **Docker**: Logs available via `docker compose logs -f app`

### Error Tracking

Integrate Sentry or a similar service by adding the Next.js SDK:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest
```

---

## 12. Backup Strategy

### PostgreSQL Backups

Create a cron job that dumps the database daily:

```bash
# Create backup script
cat > /home/deploy/backup-terradairy.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U terradairy_user -F c -f "$BACKUP_DIR/terradairy_$DATE.dump" terradairy_db
# Retain only last 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
EOF

chmod +x /home/deploy/backup-terradairy.sh

# Add to crontab (runs daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/deploy/backup-terradairy.sh >> /var/log/terradairy-backup.log 2>&1
```

### Restore from Backup

```bash
PGPASSWORD="$DB_PASSWORD" pg_restore -h localhost -U terradairy_user -d terradairy_db -c /path/to/backup.dump
```

The `-c` flag drops existing tables before restoring (clean restore).

---

## 13. Troubleshooting

### Prisma Client Not Generated

**Symptom:** `Cannot find module '.prisma/client/default'`

**Fix:** Run `npx prisma generate`. This must be run after every `npm install` (it's in the `postinstall` script, but if you used `--ignore-scripts`, run it manually).

### DATABASE_URL Format for pg Adapter

**Symptom:** `Error: PGRST101: Not a valid PostgreSQL connection string`

**Fix:** Ensure the URL starts with `postgresql://` (not `postgres://`). The Prisma pg adapter requires the full protocol prefix. Also verify the user has permission to connect to the database.

### NEXTAUTH_SECRET Not Set

**Symptom:** `Error: NEXTAUTH_SECRET is not set`

**Fix:** Add `NEXTAUTH_SECRET` to `.env.local`. Generate one with `openssl rand -base64 32`. This is required in all environments, including development.

### Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Fix:** Either stop the process using port 3000 (`lsof -i :3000` then `kill <PID>`) or set `PORT=3001` in your environment.

### Memory Limits in Docker

**Symptom:** Container exits with OOM or builds fail.

**Fix:** Increase Docker memory limit in Docker Desktop settings (recommended: 4 GB+). For production servers, ensure the machine has at least 1 GB of available RAM.

### Build Fails with TypeScript Errors

**Symptom:** `npm run build` reports TypeScript errors.

**Fix:** The project has known pre-existing TypeScript errors unrelated to the application logic (Prisma client not generated at type-check time, some older pages missing `is_active` fields). Run `npx prisma generate` before building. If errors persist in specific files, they may be from older phases and do not affect runtime behavior.

---

## 14. Scaling Considerations

### Horizontal Scaling

Next.js with JWT-based auth (no server-side sessions) is inherently stateless and can be scaled horizontally behind a load balancer. No sticky sessions are required since all state is in the JWT cookie.

### Connection Pooling

Each Node.js process maintains its own PostgreSQL connection pool. For many instances, use PgBouncer as a connection pooler:

```yaml
# Add to docker-compose.yml
pgbouncer:
  image: edoburu/pgbouncer
  environment:
    DATABASE_URL: postgresql://terradairy_user:password@db:5432/terradairy_db
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 20
  ports:
    - "6432:6432"
  depends_on:
    db:
      condition: service_healthy
```

Then update the app's `DATABASE_URL` to point to PgBouncer on port 6432.

### Static Asset CDN

Nginx (or your load balancer) should cache `/_next/static/*` with `Cache-Control: public, immutable`. These assets are content-hashed by Next.js and never change.

### Redis for Session Caching (Optional)

While not required (JWT is stateless), adding Redis for server-side caching of dashboard aggregations or frequently accessed data can significantly reduce database load under high traffic. This is a future optimization, not a deployment requirement.