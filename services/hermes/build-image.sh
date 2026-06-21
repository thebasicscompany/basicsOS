#!/usr/bin/env bash
# Build the BasicsOS hermes image from the PINNED upstream git context.
#
# Why this script instead of `docker compose build`:
#   `docker compose build` routes through docker-bake, and bake mis-resolves a
#   REMOTE git-URL build context as a local path on Docker Desktop / Windows
#   (it tries to stat `…/basicsos/https:` and fails). The `docker build` CLI
#   handles git contexts natively (no bake), so we build the image here and let
#   compose just run it via `image:`. This still builds straight from the pinned
#   tag using Nous's maintained Dockerfile (s6 /init, system deps, uv extras).
#
# Usage:  ./services/hermes/build-image.sh        (from the basicsos repo root or here)
set -euo pipefail

TAG="v2026.6.19"
IMAGE="basicsos-hermes:${TAG}"
CONTEXT="https://github.com/NousResearch/hermes-agent.git#${TAG}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ">> Building base ${IMAGE} from ${CONTEXT}"
DOCKER_BUILDKIT=1 docker build "${CONTEXT}" -t "${IMAGE}"

# Layer office-document libs (docx/pptx/xlsx) on top so the agent can generate
# downloadable Office files. Retags the same image tag.
echo ">> Adding office-document libs (docx/pptx/xlsx)"
DOCKER_BUILDKIT=1 docker build -f "${HERE}/Dockerfile.office" --build-arg "BASE=${IMAGE}" -t "${IMAGE}" "${HERE}"

echo ">> Done. Run: docker compose -f services/hermes/docker-compose.hermes.yml up -d"
