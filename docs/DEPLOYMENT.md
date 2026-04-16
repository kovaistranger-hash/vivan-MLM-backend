# VPS Deployment Guide

## Backend
1. Install Node.js 20+, MySQL, Nginx, PM2.
2. Upload project to VPS.
3. Create MySQL database and import `database/schema.sql`.
4. Edit `backend/.env`.
5. Run:
   ```bash
   cd backend
   npm install
   npm run build
   pm2 start dist/server.js --name meb-api
   pm2 save
   ```

## Frontend
1. Edit `frontend/.env`.
2. Run:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
3. Serve `frontend/dist` with Nginx.

## Nginx Sample
```nginx
server {
    server_name yourdomain.com;

    root /var/www/meb/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
    }
}
```
