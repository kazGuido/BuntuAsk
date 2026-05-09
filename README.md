# BuntuAsk

Gamified micro-tasking platform for translation and data-labeling workflows.

## Phase 1 scaffold

This branch contains the infrastructure and database foundation:

- Docker Compose topology for PostgreSQL 15, Redis 7, MinIO, FastAPI, and a WhatsApp sidecar scaffold.
- FastAPI package structure with SPA catch-all routing and `/api/v1/health`.
- SQLModel domain models for users, projects, policies, tasks, submissions, reviews, transactions, and fraud alerts.
- Alembic configuration plus the initial PostgreSQL schema migration.

Run the stack with:

```bash
docker compose up --build
```

The API is exposed on `http://localhost:8000`, MinIO API on `http://localhost:9000`, and MinIO Console on `http://localhost:9001`.
