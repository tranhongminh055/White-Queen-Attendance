#!/usr/bin/env bash
set -euo pipefail

# Automated Ubuntu 22.04 / 24.04 VPS setup for SpaceX Biometric System
# Usage: sudo bash deploy/setup_vps.sh

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy/setup_vps.sh"
  exit 1
fi

echo "==> 1. Updating packages & installing Docker Engine + Compose..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> 2. Configuring UFW firewall (SSH 22, HTTP 80, HTTPS 443)..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 3. Checking .env configuration..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
  echo "IMPORTANT: Edit .env with your real DOMAIN_NAME, ALLOWED_ORIGINS, and strong SQLSERVER_PASSWORD before starting!"
  exit 0
fi

echo "==> 4. Building & starting Docker production cluster..."
docker compose up -d --build
docker compose ps
echo "Done! Verify health with: curl -fsS https://$(grep '^DOMAIN_NAME=' .env | cut -d= -f2)/api/health"

