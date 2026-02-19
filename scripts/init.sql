-- Run once on first Postgres startup via docker-entrypoint-initdb.d
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
