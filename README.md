# Tumbuh-v0

Tumbuh is your plant that pays you to water it.

### Database setup

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