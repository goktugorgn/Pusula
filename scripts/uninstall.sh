#!/usr/bin/env bash
#
# Pusula Uninstaller
#
# Usage: sudo ./scripts/uninstall.sh [--purge]
#
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/pusula"
CONFIG_DIR="/etc/unbound-ui"
DATA_DIR="/var/lib/unbound-ui"
LOG_DIR="/var/log/unbound-ui"
SERVICE_USER="unbound-ui"

# Options
PURGE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --purge)
            PURGE=true
            shift
            ;;
    esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Check root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR]${NC} This script must be run as root"
    exit 1
fi

echo ""
echo "========================================"
echo "  Pusula Uninstaller"
echo "========================================"
echo ""

if [[ "$PURGE" == true ]]; then
    log_warn "PURGE mode: All config and data will be deleted!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Stop and disable services
log_info "Stopping services..."
systemctl stop unbound-ui-backend 2>/dev/null || true
systemctl disable unbound-ui-backend 2>/dev/null || true
rm -f /etc/systemd/system/unbound-ui-backend.service
systemctl daemon-reload
log_success "Services stopped and removed"

# Remove application files
log_info "Removing application files..."
rm -rf "$INSTALL_DIR"
log_success "Application files removed"

# Remove managed unbound config
log_info "Removing managed Unbound config..."
rm -f /etc/unbound/unbound-ui-managed.conf
# Remove include from unbound.conf
sed -i '/unbound-ui-managed.conf/d' /etc/unbound/unbound.conf 2>/dev/null || true
log_success "Unbound config cleaned"

# Optionally remove config and data
if [[ "$PURGE" == true ]]; then
    log_info "Purging configuration and data..."
    rm -rf "$CONFIG_DIR"
    rm -rf "$DATA_DIR"
    rm -rf "$LOG_DIR"
    
    # Remove user
    userdel "$SERVICE_USER" 2>/dev/null || true
    
    log_success "All data purged"
else
    log_info "Keeping configuration in $CONFIG_DIR"
    log_info "Keeping data in $DATA_DIR"
    log_info "Keeping logs in $LOG_DIR"
    log_warn "Use --purge to remove these as well"
fi

echo ""
echo -e "${GREEN}Pusula uninstalled successfully!${NC}"
echo ""
