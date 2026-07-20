# Backend Deployment Runbook

This repo is the API/backend only.

Recommended production topology when you have:
- a web admin dashboard
- a mobile app
- one VPS handling public traffic

Use:
- `https://api.alkayan.website` for this backend
- `https://alkayan.website` and/or `https://www.alkayan.website` for the admin web app

The mobile app should call only the API hostname. It does not need its own DNS record unless you also host a mobile landing page or asset endpoint.

## Architecture

This project already includes an internal Nginx container in `docker-compose.prod.yml`. That container is intended to sit behind an external TLS terminator or reverse proxy.

By default, `.env.prod.example` uses:

```bash
NGINX_BIND_IP=127.0.0.1
NGINX_HOST_PORT=800
```

That means the backend is reachable only from the VPS itself at `127.0.0.1:800`.

For a normal public deployment:
1. Keep the internal compose Nginx bound to `127.0.0.1:800`.
2. Put host-level Nginx or another reverse proxy in front of it on ports `80/443`.
3. Route `api.alkayan.website` to `http://127.0.0.1:800`.
4. Terminate TLS at the host-level reverse proxy.

Example host-level Nginx config:
- [deploy/nginx/api.vhost.conf.example](../deploy/nginx/api.vhost.conf.example)

## Prerequisites
- Docker + Docker Compose installed on the VPS
- host-level Nginx installed on the VPS for public TLS termination
- `.env` created from `.env.prod.example`
- `DATABASE_URL` pointing to production PostgreSQL
- Cloudinary credentials configured
- Resend credentials configured when `OTP_PROVIDER=resend`
- DNS records for `api`, and optionally `@` and `www`, pointing to the VPS public IP

## DNS

If your DNS currently points these records to the same VPS IP:
- `@`
- `www`
- `api`

that is fine.

What matters is the web server routing:
- `api.alkayan.website` must proxy to this backend
- `alkayan.website` and `www.alkayan.website` must serve the admin dashboard

## Production Environment

Start from the template:

```bash
cp .env.prod.example .env
```

Update at minimum:

```bash
NODE_ENV=production
CORS_ORIGINS=https://alkayan.website,https://www.alkayan.website
DATABASE_URL=postgres://...
DATABASE_SSL=true
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
OTP_SIGNING_SECRET=...
STORAGE_SIGNING_SECRET=...
OTP_PROVIDER=resend
RESEND_API_KEY=...
RESEND_FROM_EMAIL=no-reply@alkayan.website
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NGINX_BIND_IP=127.0.0.1
NGINX_HOST_PORT=800
```

Notes:
- Set `CORS_ORIGINS` to every browser-based frontend origin that will call the API.
- Mobile apps are not enforced by browser CORS, but using the same `https://api.alkayan.website` base URL keeps both clients aligned.
- Keep `OTP_DEV_MODE=false` in production.
- `OTP_PROVIDER=console` is not suitable for production.

## First-Time Setup

```bash
cp .env.prod.example .env
# edit .env with real values
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d redis app nginx
docker compose -f docker-compose.prod.yml exec -T app npm run db:migrate
docker compose -f docker-compose.prod.yml exec -T app npm run db:validate
docker compose -f docker-compose.prod.yml exec -T app sh -lc 'ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123 ADMIN_PHONE=+201000000000 npm run seed:admin:prod'
```

Then verify locally on the VPS:

```bash
curl -fsS http://127.0.0.1:800/api/health/live
curl -fsS http://127.0.0.1:800/api/health/ready
```

## Public Reverse Proxy

After the compose stack is healthy, configure host-level Nginx so:
- `https://api.alkayan.website/api/*` proxies to `http://127.0.0.1:800/api/*`
- `https://api.alkayan.website/socket.io/*` proxies to `http://127.0.0.1:800/socket.io/*`
- websocket upgrade headers are preserved

Once Nginx is enabled and TLS is issued, verify:

```bash
curl -fsS https://api.alkayan.website/api/health/live
curl -fsS https://api.alkayan.website/api/health/ready
```

Swagger should then be available at:

```bash
https://api.alkayan.website/api/docs
```

## Admin Dashboard and Mobile App

Use these production base URLs:
- web admin API base URL: `https://api.alkayan.website`
- mobile app API base URL: `https://api.alkayan.website`
- Socket.io namespace for both: `https://api.alkayan.website/chat`

If the admin dashboard is a separate frontend deployment on the same VPS, serve it from a different Nginx server block for:
- `alkayan.website`
- `www.alkayan.website`

Do not proxy the admin dashboard through this backend container unless that frontend is intentionally bundled elsewhere.

## Start Production Compose

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Deploy Script

```bash
bash scripts/deploy.sh
```

The deploy script only validates the internal endpoint on `localhost:800`. Public TLS and DNS routing remain the responsibility of the host-level reverse proxy.

## Staging / Release Validation

```bash
docker compose -f docker-compose.prod.yml exec -T app npm run db:migrate
docker compose -f docker-compose.prod.yml exec -T app npm run db:validate
docker compose -f docker-compose.prod.yml exec -T app sh -lc 'ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123 ADMIN_PHONE=+201000000000 npm run seed:admin:prod'
BASE_URL=http://127.0.0.1:800 bash scripts/smoke-test.sh
```

Recommended manual checks:
1. Open `https://api.alkayan.website/api/docs`
2. Log in from the admin dashboard against the production API
3. Verify OTP email delivery
4. Verify one file upload to Cloudinary
5. Verify one Socket.io chat connection through `api.alkayan.website`

## Manual Rollback
1. Pull the previous image tag or restore the previous code revision.
2. Rebuild/restart the compose services.
3. Re-run health checks on `127.0.0.1:800`.
4. Re-check the public `https://api.alkayan.website/api/health/ready` endpoint.

## Admin Seeding Notes
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are required for the current auth contract.
- `ADMIN_PHONE` is optional but recommended.
- Inside production containers, use `seed:admin:prod` because `seed:admin` depends on `ts-node`.
