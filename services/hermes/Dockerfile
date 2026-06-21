# NOT used by default. `docker-compose.hermes.yml` builds the upstream image
# directly from the pinned git context (github.com/NousResearch/hermes-agent#v2026.6.19),
# which uses Nous's maintained Dockerfile (s6-overlay /init entrypoint, the full system-dep
# set, and `uv sync --extra all --extra messaging …`). Do not bypass that /init entrypoint.
#
# This file is only an OFFLINE fallback: if you've vendored the source locally, build the
# image with the upstream Dockerfile from that checkout rather than re-deriving it here.
#
#   git clone --branch v2026.6.19 https://github.com/NousResearch/hermes-agent vendor/hermes
#   docker build -t basicsos-hermes:v2026.6.19 vendor/hermes
#
# Then point docker-compose.hermes.yml's `image:` at basicsos-hermes:v2026.6.19.
