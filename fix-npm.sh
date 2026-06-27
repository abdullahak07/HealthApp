#!/usr/bin/env bash
set -u

REPORT="npm-fix-report.txt"
STATUS="PASS"

exec > >(tee "$REPORT") 2>&1

echo "================================================"
echo "HealthApp npm repair"
echo "================================================"

echo
echo "[1/5] Setting the official public npm registry..."
printf 'registry=https://registry.npmjs.org/\n' > .npmrc

echo
echo "[2/5] Removing the lockfile containing the internal URL..."
rm -rf node_modules package-lock.json

echo
echo "[3/5] Checking registry..."
REGISTRY="$(npm config get registry)"
echo "Registry: $REGISTRY"

if [[ "$REGISTRY" != "https://registry.npmjs.org/" ]]; then
    echo "FAIL: npm is not using the public registry."
    STATUS="FAIL"
fi

echo
echo "[4/5] Installing dependencies and creating a clean lockfile..."
if ! npm install --registry=https://registry.npmjs.org/; then
    echo "FAIL: npm install failed."
    STATUS="FAIL"
fi

echo
echo "[5/5] Running production build..."
if [[ "$STATUS" == "PASS" ]] && npm run build; then
    echo "Build completed successfully."
else
    echo "FAIL: production build failed."
    STATUS="FAIL"
fi

echo
echo "================================================"
echo "OVERALL RESULT: $STATUS"
echo "Report saved to: $(pwd)/$REPORT"
echo "================================================"

[[ "$STATUS" == "PASS" ]]
