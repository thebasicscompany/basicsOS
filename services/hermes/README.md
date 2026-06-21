# hermes — per-company agent sidecar

This directory runs **one [hermes-agent](https://github.com/NousResearch/hermes-agent) instance per company**, alongside this company's `packages/server` backend. It is the brain behind in-app chat, automations, and (later) custom apps.

- **Upstream:** Nous Research `hermes-agent`, pinned to **`v2026.6.19` (v0.17.0)**, MIT. Docs: https://hermes-agent.nousresearch.com/docs/
- **Spec / plan:** `basicsAdmin/docs/PLATFORM_AGENT_AND_APPS_ARCHITECTURE.md` (§5) and `basicsAdmin/docs/BUILD_PLAN_HERMES.md`.

## How it wires in

```
backend ──HTTP (Bearer API_SERVER_KEY, X-Hermes-Session-Key)──► hermes API server :8642
hermes  ──model: custom, base_url=$BASICSOS_GATEWAY_URL/v1──► BasicsOS gateway (billing/usage central)
hermes  ──mcp_servers.broker──► this company's MCP Tool Broker (packages/server)
HERMES_HOME=/opt/data (durable volume) ── state.db (sessions+FTS5) + skills/ + config.yaml
```

- **Model calls** route through the BasicsOS gateway (`provider: custom`) so billing/BYOK/usage stay central — never directly to a model vendor.
- **Tools/data** come only from the MCP **Broker**; hermes holds no DB creds. Per-user identity for writes/connections is carried per-call via MCP `_meta` (see plan M4).
- **We drive it** over the built-in HTTP **API server** (`APIServerAdapter`), not the Telegram/Discord adapters. No source fork for chat.

## Run (local dev)

```bash
cp .env.example .env          # fill BASICSOS_API_KEY, API_SERVER_KEY, BROKER_*
docker compose -f docker-compose.hermes.yml up --build
# API server: http://127.0.0.1:8642  (send Authorization: Bearer $API_SERVER_KEY)
```

The compose file **builds the upstream image from the pinned git context** (`github.com/NousResearch/hermes-agent#v2026.6.19`), so we inherit Nous's maintained Dockerfile (s6-overlay `/init` entrypoint — don't bypass it — system deps, `uv` extras, console scripts). Our layer is just `command: ["gateway","run"]` + `config.yaml` + `.env` + the `hermes_state` volume.

`config.yaml.example` is the hermes config (model + mcp_servers); it is mounted to `$HERMES_HOME/config.yaml`. `${VAR}` placeholders are resolved by hermes from the environment at load. The local `Dockerfile` is only an offline/vendored fallback (see its header).
