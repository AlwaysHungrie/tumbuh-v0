# Tumbuh-v0

Tumbuh is your plant that pays you to water it.

### Database setup

sudo -i -u postgres

psql -U postgres -c "CREATE DATABASE tumbuhdb;"
psql -U postgres -c "CREATE DATABASE shadow_tumbuhdb;"
psql -U postgres -c "CREATE USER tumbuh_user WITH PASSWORD 'tumbuh_user_password';"

psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tumbuhdb TO tumbuh_user;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE shadow_tumbuhdb TO tumbuh_user;"

psql -U postgres -d tumbuhdb -c "GRANT ALL PRIVILEGES ON SCHEMA public TO tumbuh_user;"
psql -U postgres -d shadow_tumbuhdb -c "GRANT ALL PRIVILEGES ON SCHEMA public TO tumbuh_user;"

DATABASE_URL=postgresql://tumbuh_user:tumbuh_user_password@localhost:5432/tumbuhdb
SHADOW_DATABASE_URL=postgresql://tumbuh_user:tumbuh_user_password@localhost:5432/shadow_tumbuhdb

npx prisma migrate dev --name init
npx prisma generate

## Deploy

chmod 400 awsKey.pem

export EC2_DNS="ec2-$(echo $PUBLIC_IP | tr '.' '-').ap-south-1.compute.amazonaws.com"
ssh -i awsKey.pem ubuntu@$EC2_DNS

cd tumbuh-v0

npm install

npm run build

pm2 start npm --name "tumbuh-v0" -- start

sudo vim /etc/nginx/sites-available/primordial-api.gettumbuh.com

server {
    listen 80;
    server_name api.constella.one;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/api.constella.one /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d api.constella.one
sudo systemctl restart nginx