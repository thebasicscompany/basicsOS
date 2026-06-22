#!/usr/bin/env bash
# Clone the pinned upstream hermes-agent into ./vendor/hermes-agent.
#
# Needed for:
#   - the `docker compose ... up --build` path (compose builds from this LOCAL
#     context — a local context works with bake; a remote git URL does not).
#   - referencing the exact pinned source for the M4 `_meta` passthrough patch.
#
# The vendor/ dir is gitignored (it's ~5k upstream files). Re-run is a no-op.
set -euo pipefail

TAG="v2026.6.19"
DEST="$(dirname "$0")/vendor/hermes-agent"

if [ -d "${DEST}/.git" ] || [ -f "${DEST}/Dockerfile" ]; then
  echo ">> ${DEST} already present — skipping."
  exit 0
fi

echo ">> Cloning hermes-agent ${TAG} into ${DEST}"
git clone --depth 1 --branch "${TAG}" https://github.com/NousResearch/hermes-agent.git "${DEST}"

# Apply our pinned patches (e.g. the _meta session-key passthrough, M4).
PATCH_DIR="$(dirname "$0")/patches"
if [ -d "${PATCH_DIR}" ]; then
  for p in "${PATCH_DIR}"/*.patch; do
    [ -e "$p" ] || continue
    if git -C "${DEST}" apply --reverse --check "$p" 2>/dev/null; then
      echo ">> patch already applied: $(basename "$p")"
    else
      echo ">> applying patch: $(basename "$p")"
      git -C "${DEST}" apply "$p"
    fi
  done
fi
echo ">> Done."
