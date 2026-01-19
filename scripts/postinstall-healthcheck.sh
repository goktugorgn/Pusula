#!/bin/bash
# =============================================================================
# Pusula Post-Install Health Check
# =============================================================================
#
# Verifies that Pusula is installed and running correctly.
#
# Usage:
#   sudo ./scripts/postinstall-healthcheck.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
#
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKEND_PORT="${PUSULA_PORT:-3000}"
ERRORS=0

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}     Pusula Health Check${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

# 1. Service status
echo -n "1. Service status:      "
if systemctl is-active --quiet pusula 2>/dev/null; then
    echo -e "${GREEN}● running${NC}"
else
    echo -e "${RED}○ not running${NC}"
    ((ERRORS++))
fi

# 2. Service enabled
echo -n "2. Autostart enabled:   "
if systemctl is-enabled --quiet pusula 2>/dev/null; then
    echo -e "${GREEN}yes${NC}"
else
    echo -e "${YELLOW}no${NC}"
fi

# 3. Health endpoint
echo -n "3. Health endpoint:     "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null) || HTTP_CODE="000"
if [[ "$HTTP_CODE" == "200" ]]; then
    echo -e "${GREEN}OK (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}FAILED (HTTP $HTTP_CODE)${NC}"
    ((ERRORS++))
fi

# 4. Config directory
echo -n "4. Config directory:    "
if [[ -d /etc/pusula ]]; then
    echo -e "${GREEN}exists${NC}"
else
    echo -e "${RED}missing${NC}"
    ((ERRORS++))
fi

# 5. Config file
echo -n "5. Config file:         "
if [[ -f /etc/pusula/config.yaml ]]; then
    echo -e "${GREEN}exists${NC}"
else
    echo -e "${RED}missing${NC}"
    ((ERRORS++))
fi

# 6. Credentials file
echo -n "6. Credentials:         "
if [[ -f /etc/pusula/credentials.json ]]; then
    echo -e "${GREEN}exists${NC}"
else
    echo -e "${YELLOW}missing${NC}"
fi

# 7. CLI installed
echo -n "7. CLI installed:       "
if [[ -x /usr/local/bin/pusula ]]; then
    echo -e "${GREEN}yes${NC}"
else
    echo -e "${RED}no${NC}"
    ((ERRORS++))
fi

# 8. Unbound status
echo -n "8. Unbound service:     "
if systemctl is-active --quiet unbound 2>/dev/null; then
    echo -e "${GREEN}● running${NC}"
else
    echo -e "${YELLOW}○ not running${NC}"
fi

# 9. Log directory
echo -n "9. Log directory:       "
if [[ -d /var/log/pusula ]]; then
    echo -e "${GREEN}exists${NC}"
else
    echo -e "${YELLOW}missing${NC}"
fi

# 10. Backup directory
echo -n "10. Backup directory:   "
if [[ -d /var/lib/pusula/backups ]]; then
    echo -e "${GREEN}exists${NC}"
else
    echo -e "${YELLOW}missing${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    echo ""
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || LOCAL_IP="localhost"
    echo "Access Pusula at: http://$LOCAL_IP:$BACKEND_PORT"
    exit 0
else
    echo -e "${RED}$ERRORS critical check(s) failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check service logs: pusula logs backend"
    echo "  - Check service status: pusula status"
    echo "  - Try restarting: sudo pusula restart"
    exit 1
fi
