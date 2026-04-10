`wsm.dahanda.dev`는 소재 제작 전용 백엔드입니다.

구성:
- `dahanda.dev`, `www.dahanda.dev`: Vercel 프론트
- `wsm.dahanda.dev`: Ubuntu 백엔드 + 파일 저장

필수 패키지:

```bash
sudo apt update
sudo apt install -y nginx ffmpeg fonts-noto-cjk certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

저장 폴더:

```bash
sudo mkdir -p /srv/dahanda/creative
sudo chown -R $USER:$USER /srv/dahanda
```

앱 설치:

```bash
git clone <your-repo-url> /opt/wsmedia-focusmap
cd /opt/wsmedia-focusmap/web
npm ci
npm run build
cp /opt/wsmedia-focusmap/infra/wsm.dahanda.dev/env.production.example /opt/wsmedia-focusmap/web/.env.production
```

시스템 서비스:

```bash
sudo cp /opt/wsmedia-focusmap/infra/wsm.dahanda.dev/dahanda-creative.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dahanda-creative
sudo systemctl status dahanda-creative
```

Nginx:

```bash
sudo cp /opt/wsmedia-focusmap/infra/wsm.dahanda.dev/nginx.conf /etc/nginx/sites-available/wsm.dahanda.dev
sudo ln -s /etc/nginx/sites-available/wsm.dahanda.dev /etc/nginx/sites-enabled/wsm.dahanda.dev
sudo nginx -t
sudo systemctl reload nginx
```

인증서:

```bash
sudo certbot --nginx -d wsm.dahanda.dev
```

Vercel 프론트 환경변수:

```bash
NEXT_PUBLIC_CREATIVE_API_BASE=https://wsm.dahanda.dev
```
