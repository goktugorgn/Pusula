#!/bin/bash
# =============================================================================
# Pusula Post-Install Health Check
# =============================================================================
#
# Verifies the installation is working correctly.
#
# Usage:
#   sudo ./scripts/postinstall-healthcheck.sh
#
# =============================================================================

set -euo pipefail

# Configuration
BACKEND_PORT="${PUSULA_PORT:-3000}"
SERVICE_NAME="unbound-ui-backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

check() {
    local name="$1"
    local result="$2"
    
    if [[ "$result" == "ok" ]]; then
        echo -e "${GREEN}✓${NC} $name"
    else
        echo -e "${RED}✗${NC} $name: $result"
        ((ERRORS++))
    fi
}

echo ""
echo "Pusula Health Check"
echo "==================="
echo ""

# Check 1: Service running
if systemctl is-active --quiet "$SERVICE_NAME"; then
    check "Systemd service" "ok"
else
    check "Systemd service" "not running"
fi

# Check 2: Port listening
if ss -tlnp | grep -q ":$BACKEND_PORT"; then
    check "Port $BACKEND_PORT" "ok"
else
    check "Port $BACKEND_PORT" "not listening"
fi

# Check 3: Health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
    check "Health endpoint" "ok"
else
    check "Health endpoint" "HTTP $HTTP_CODE"
fi

# Check 4: Unbound running
if systemctl is-active --quiet unbound; then
    check "Unbound service" "ok"
else
    check "Unbound service" "not running"
fi

# Check 5: Unbound control
if sudo -n unbound-control status &>/dev/null; then
    check "Unbound control access" "ok"
else
    check "Unbound control access" "permission denied"
fi

# Check 6: Config files
if [[ -f /etc/unbound-ui/config.yaml ]]; then
    check "Config file" "ok"
else
    check "Config file" "missing"
fi

if [[ -f /etc/unbound-ui/credentials.json ]]; then
    check "Credentials file" "ok"
else
    check "Credentials file" "missing"
fi

# Check 7: Directories
if [[ -d /var/lib/unbound-ui/backups ]]; then
    check "Data directory" "ok"
else
    check "Data directory" "missing"
fi

if [[ -d /var/log/unbound-ui ]]; then
    check "Log directory" "ok"
else
    check "Log directory" "missing"
fi

# Check 8: Sudoers
if [[ -f /etc/sudoers.d/unbound-ui ]]; then
    if visudo -c -f /etc/sudoers.d/unbound-ui &>/dev/null; then
        check "Sudoers config" "ok"
    else
        check "Sudoers config" "invalid syntax"
    fi
else
    check "Sudoers config" "missing"
fi

echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    echo "Access Pusula at: http://$LOCAL_IP:$BACKEND_PORT"
    exit 0
else
    echo -e "${YELLOW}$ERRORS check(s) failed.${NC}"
    echo "Review the output above and check logs: journalctl -u $SERVICE_NAME"
    exit 1
fi
