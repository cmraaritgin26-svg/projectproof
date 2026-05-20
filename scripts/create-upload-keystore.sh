#!/usr/bin/env sh
set -eu

KEYSTORE_PATH="${1:-.play-signing/projectproof-upload-keystore.jks}"
KEY_ALIAS="${ANDROID_UPLOAD_KEY_ALIAS:-projectproof-upload}"

if [ -e "$KEYSTORE_PATH" ]; then
  echo "Refusing to overwrite existing keystore: $KEYSTORE_PATH" >&2
  exit 1
fi

if [ -z "${ANDROID_UPLOAD_KEYSTORE_PASSWORD:-}" ] || [ -z "${ANDROID_UPLOAD_KEY_PASSWORD:-}" ]; then
  echo "Set ANDROID_UPLOAD_KEYSTORE_PASSWORD and ANDROID_UPLOAD_KEY_PASSWORD before running." >&2
  echo "Example:" >&2
  echo "  export ANDROID_UPLOAD_KEYSTORE_PASSWORD='use-a-long-random-password'" >&2
  echo "  export ANDROID_UPLOAD_KEY_PASSWORD='use-another-long-random-password'" >&2
  echo "  export ANDROID_UPLOAD_KEY_ALIAS='projectproof-upload'" >&2
  echo "  sh scripts/create-upload-keystore.sh .play-signing/projectproof-upload-keystore.jks" >&2
  exit 1
fi

mkdir -p "$(dirname "$KEYSTORE_PATH")"

keytool -genkeypair \
  -v \
  -storetype JKS \
  -keystore "$KEYSTORE_PATH" \
  -storepass "$ANDROID_UPLOAD_KEYSTORE_PASSWORD" \
  -keypass "$ANDROID_UPLOAD_KEY_PASSWORD" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=ProjectProof Upload, OU=Release, O=Craigs Developments, L=Unknown, ST=Unknown, C=US"

echo "Created upload keystore: $KEYSTORE_PATH"
echo "Keep this file and both passwords private. Losing them can block app updates."
