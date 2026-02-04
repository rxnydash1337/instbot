#!/bin/bash
cd "$(dirname "$0")"
systemctl stop nginx
git pull
docker compose build --no-cache
docker compose up -d
systemctl start nginx
