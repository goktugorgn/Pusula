#!/bin/bash
# =============================================================================
# Local Smoke Test Script
# Tests backend DEV mode endpoints
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Backend URL
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo "=== Pusula Local Smoke Test ==="
echo "Backend: $BACKEND_URL"
echo ""

# Test function
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_code="${5:-200}"
  local token="$6"
  
  local curl_args=(-s -o /dev/null -w "%{http_code}" -X "$method")
  
  if [ -n "$token" ]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi
  
  if [ -n "$data" ]; then
    curl_args+=(-H "Content-Type: application/json" -d "$data")
  fi
  
  curl_args+=("${BACKEND_URL}${endpoint}")
  
  local code
  code=$(curl "${curl_args[@]}" 2>/dev/null || echo "000")
  
  if [ "$code" == "$expected_code" ]; then
    echo -e "${GREEN}✓${NC} $name (HTTP $code)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} $name (expected $expected_code, got $code)"
    ((FAILED++))
    return 1
  fi
}

# Get response function
get_response() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  local token="$4"
  
  local curl_args=(-s -X "$method")
  
  if [ -n "$token" ]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi
  
  if [ -n "$data" ]; then
    curl_args+=(-H "Content-Type: application/json" -d "$data")
  fi
  
  curl_args+=("${BACKEND_URL}${endpoint}")
  
  curl "${curl_args[@]}" 2>/dev/null
}

# Check Node version
echo "--- Prerequisites ---"
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
  echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Node.js $NODE_VERSION (need v18+)"
  ((FAILED++))
fi
echo ""

# Check backend is running
echo "--- Backend Connectivity ---"
if curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Backend is reachable"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Backend not reachable at $BACKEND_URL"
  echo ""
  echo "Start backend with:"
  echo "  cd apps/backend"
  echo "  cp .env.dev .env"
  echo "  npm run dev"
  echo ""
  exit 1
fi
echo ""

# Health endpoint
echo "--- Health Check ---"
test_endpoint "GET /api/health" GET "/api/health"
echo ""

# Login
echo "--- Authentication ---"
LOGIN_RESPONSE=$(get_response POST "/api/login" '{"username":"admin","password":"admin"}')
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓${NC} POST /api/login (got token)"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} POST /api/login (no token in response)"
  echo "Response: $LOGIN_RESPONSE"
  ((FAILED++))
  TOKEN=""
fi
echo ""

# Authenticated endpoints (only if we have a token)
if [ -n "$TOKEN" ]; then
  echo "--- Unbound Endpoints (DEV Mode) ---"
  test_endpoint "GET /api/unbound/status" GET "/api/unbound/status" "" "200" "$TOKEN"
  test_endpoint "GET /api/unbound/stats" GET "/api/unbound/stats" "" "200" "$TOKEN"
  test_endpoint "GET /api/unbound/logs" GET "/api/unbound/logs" "" "200" "$TOKEN"
  echo ""
  
  echo "--- Upstream Config ---"
  test_endpoint "GET /api/upstream" GET "/api/upstream" "" "200" "$TOKEN"
  echo ""
  
  echo "--- Alerts ---"
  test_endpoint "GET /api/alerts" GET "/api/alerts" "" "200" "$TOKEN"
  echo ""
  
  echo "--- Self-Test ---"
  # Self-test can take a while, increase timeout
  SELFTEST_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/self-test" 2>/dev/null)
  if echo "$SELFTEST_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC} POST /api/self-test (completed)"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} POST /api/self-test"
    echo "Response: $SELFTEST_RESPONSE"
    ((FAILED++))
  fi
  echo ""
  
  echo "--- Pi-hole (should return not configured) ---"
  test_endpoint "GET /api/pihole/summary" GET "/api/pihole/summary" "" "200" "$TOKEN"
  echo ""
fi

# Summary
echo "==================================="
echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}ALL TESTS PASSED${NC} ($PASSED passed)"
  exit 0
else
  echo -e "${RED}SOME TESTS FAILED${NC} ($PASSED passed, $FAILED failed)"
  exit 1
fi
