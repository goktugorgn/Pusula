#!/usr/bin/env bash
#
# Pusula Post-Install Health Check
#
# Usage: ./scripts/postinstall-healthcheck.sh
#
set -euo pipefail

PORT="${PORT:-3000}"
HOST="${HOST:-localhost}"
BASE_URL="http://${HOST}:${PORT}/api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Pusula Health Check"
echo "========================================"
echo ""

# Check backend service
echo -n "Backend service status: "
if systemctl is-active --quiet unbound-ui-backend; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}not running${NC}"
    echo "  Run: sudo systemctl start unbound-ui-backend"
fi

# Check Unbound service
echo -n "Unbound service status: "
if systemctl is-active --quiet unbound; then
    echo -e "${GREEN}running${NC}"
else
    echo -e "${RED}not running${NC}"
    echo "  Run: sudo systemctl start unbound"
fi

# Check API health endpoint
echo -n "API health check: "
if response=$(curl -sf "${BASE_URL}/health" 2>/dev/null); then
    status=$(echo "$response" | jq -r '.data.status // "unknown"')
    version=$(echo "$response" | jq -r '.data.version // "unknown"')
    echo -e "${GREEN}OK${NC} (status: $status, version: $version)"
else
    echo -e "${RED}FAILED${NC}"
    echo "  Cannot reach ${BASE_URL}/health"
fi

# Check unbound-control
echo -n "unbound-control access: "
if sudo -u unbound-ui unbound-control status &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}WARNING${NC}"
    echo "  Service user may not have access to unbound-control"
fi

# Check configuration files
echo ""
echo "Configuration files:"
for file in /etc/unbound-ui/config.yaml /etc/unbound-ui/credentials.json /var/lib/unbound-ui/upstream.json; do
    echo -n "  $file: "
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}exists${NC}"
    else
        echo -e "${RED}missing${NC}"
    fi
done

# Check directories
echo ""
echo "Directories:"
for dir in /opt/pusula /var/lib/unbound-ui/backups /var/log/unbound-ui; do
    echo -n "  $dir: "
    if [[ -d "$dir" ]]; then
        echo -e "${GREEN}exists${NC}"
    else
        echo -e "${RED}missing${NC}"
    fi
done

# Print access info
echo ""
echo "========================================"
ip_address=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo -e "Access URL: ${GREEN}http://${ip_address}:${PORT}${NC}"
echo "========================================"
