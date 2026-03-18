#!/usr/bin/env bash
# Prepare Apple code-signing certificate for GitHub Actions secrets.
# Run: ./scripts/prepare-apple-secrets.sh /path/to/DeveloperIDApplication.p12
# Then add the secrets at: https://github.com/thebasicscompany/basicsOS/settings/secrets/actions

set -e

if [[ -z "$1" || ! -f "$1" ]]; then
  echo "Usage: $0 /path/to/your-certificate.p12"
  echo ""
  echo "Steps:"
  echo "  1. Export your Developer ID Application cert from Keychain as .p12 (set a password)."
  echo "  2. Run this script with the .p12 path."
  echo "  3. Paste the output into GitHub repo secrets (see URL below)."
  exit 1
fi

P12_PATH="$1"
REPO_URL="https://github.com/thebasicscompany/basicsOS/settings/secrets/actions"

# Base64 one-line (no newlines) for CSC_LINK
BASE64_CERT=$(base64 -i "$P12_PATH" | tr -d '\n')

echo "----------------------------------------"
echo "CSC_LINK (base64 certificate)"
echo "----------------------------------------"
echo "$BASE64_CERT"
echo ""

if command -v pbcopy &>/dev/null; then
  echo "$BASE64_CERT" | pbcopy
  echo "  ^ Copied to clipboard. Paste as GitHub secret 'CSC_LINK'."
else
  echo "  Copy the block above (no spaces/newlines) and paste as GitHub secret 'CSC_LINK'."
fi

echo ""
echo "----------------------------------------"
echo "Next: add these in GitHub"
echo "----------------------------------------"
echo "  Repo secrets: $REPO_URL"
echo ""
echo "  1. New secret: Name = CSC_LINK, Value = (paste the base64 above)"
echo "  2. New secret: Name = CSC_KEY_PASSWORD, Value = (password you set when exporting .p12)"
echo "  3. New secret: Name = APPLE_ID, Value = (your Apple ID email)"
echo "  4. New secret: Name = APPLE_APP_SPECIFIC_PASSWORD, Value = (from appleid.apple.com → App-Specific Passwords)"
echo "  5. (Optional) New secret: Name = APPLE_TEAM_ID, Value = (10-char Team ID if using a team)"
echo ""
