#!/bin/bash
# =============================================================================
# Pusula Uninstaller
# =============================================================================
#
# Removes Pusula DNS Management from the system.
#
# Usage:
#   sudo ./scripts/uninstall.sh         # Keep config and backups
#   sudo ./scripts/uninstall.sh --purge # Remove everything
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
INSTALL_DIR="/opt/pusula"
CONFIG_DIR="/etc/unbound-ui"
DATA_DIR="/var/lib/unbound-ui"
LOG_DIR="/var/log/unbound-ui"
SERVICE_USER="unbound-ui"
BACKEND_SERVICE="unbound-ui-backend"
DOH_SERVICE="unbound-ui-doh-proxy"

PURGE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# -----------------------------------------------------------------------------
# Parse Arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --purge)
            PURGE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--purge]"
            echo ""
            echo "Options:"
            echo "  --purge    Remove all data including config and backups"
            echo ""
            echo "By default, /etc/unbound-ui and /var/lib/unbound-ui are preserved."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Use: sudo $0"
        exit 1
    fi
}

confirm() {
    local prompt="$1"
    local response
    
    echo -e "${YELLOW}$prompt${NC}"
    read -r -p "Type 'yes' to confirm: " response
    
    if [[ "$response" != "yes" ]]; then
        echo "Aborted."
        exit 0
    fi
}

# -----------------------------------------------------------------------------
# Uninstall Steps
# -----------------------------------------------------------------------------
stop_services() {
    log_info "Stopping services..."
    
    if systemctl is-active --quiet "$BACKEND_SERVICE" 2>/dev/null; then
        systemctl stop "$BACKEND_SERVICE" || true
        log_success "Stopped $BACKEND_SERVICE"
    fi
    
    if systemctl is-active --quiet "$DOH_SERVICE" 2>/dev/null; then
        systemctl stop "$DOH_SERVICE" || true
        log_success "Stopped $DOH_SERVICE"
    fi
}

disable_services() {
    log_info "Disabling services..."
    
    if systemctl is-enabled --quiet "$BACKEND_SERVICE" 2>/dev/null; then
        systemctl disable "$BACKEND_SERVICE" || true
        log_success "Disabled $BACKEND_SERVICE"
    fi
    
    if systemctl is-enabled --quiet "$DOH_SERVICE" 2>/dev/null; then
        systemctl disable "$DOH_SERVICE" || true
        log_success "Disabled $DOH_SERVICE"
    fi
}

remove_unit_files() {
    log_info "Removing systemd unit files..."
    
    local removed=0
    
    if [[ -f "/etc/systemd/system/$BACKEND_SERVICE.service" ]]; then
        rm -f "/etc/systemd/system/$BACKEND_SERVICE.service"
        ((removed++))
    fi
    
    if [[ -f "/etc/systemd/system/$DOH_SERVICE.service" ]]; then
        rm -f "/etc/systemd/system/$DOH_SERVICE.service"
        ((removed++))
    fi
    
    if [[ $removed -gt 0 ]]; then
        systemctl daemon-reload
        log_success "Removed $removed unit file(s)"
    else
        log_info "No unit files found"
    fi
}

remove_sudoers() {
    log_info "Removing sudoers configuration..."
    
    if [[ -f "/etc/sudoers.d/unbound-ui" ]]; then
        rm -f "/etc/sudoers.d/unbound-ui"
        log_success "Removed /etc/sudoers.d/unbound-ui"
    else
        log_info "Sudoers file not found"
    fi
}

remove_user() {
    log_info "Removing system user..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        userdel "$SERVICE_USER" 2>/dev/null || true
        log_success "Removed user: $SERVICE_USER"
    else
        log_info "User $SERVICE_USER not found"
    fi
}

remove_app_directory() {
    log_info "Removing application directory..."
    
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
        log_success "Removed $INSTALL_DIR"
    else
        log_info "$INSTALL_DIR not found"
    fi
}

remove_cli() {
    log_info "Removing CLI..."
    
    if [[ -f "/usr/local/bin/pusula" ]]; then
        rm -f "/usr/local/bin/pusula"
        log_success "Removed /usr/local/bin/pusula"
    else
        log_info "CLI not found at /usr/local/bin/pusula"
    fi
}

remove_config() {
    log_info "Removing configuration..."
    
    if [[ -d "$CONFIG_DIR" ]]; then
        rm -rf "$CONFIG_DIR"
        log_success "Removed $CONFIG_DIR"
    else
        log_info "$CONFIG_DIR not found"
    fi
}

remove_data() {
    log_info "Removing data directory..."
    
    if [[ -d "$DATA_DIR" ]]; then
        rm -rf "$DATA_DIR"
        log_success "Removed $DATA_DIR"
    else
        log_info "$DATA_DIR not found"
    fi
}

remove_logs() {
    log_info "Removing log directory..."
    
    if [[ -d "$LOG_DIR" ]]; then
        rm -rf "$LOG_DIR"
        log_success "Removed $LOG_DIR"
    else
        log_info "$LOG_DIR not found"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo "=========================================="
    echo "  Pusula Uninstaller"
    echo "=========================================="
    echo ""
    
    check_root
    
    if [[ "$PURGE" == "true" ]]; then
        echo -e "${RED}WARNING: --purge mode will remove ALL data including:${NC}"
        echo "  - Configuration files ($CONFIG_DIR)"
        echo "  - Backup snapshots ($DATA_DIR)"
        echo "  - Audit logs ($LOG_DIR)"
        echo ""
        confirm "Are you sure you want to purge all Pusula data?"
    else
        echo "This will remove Pusula services and application files."
        echo ""
        echo -e "${YELLOW}The following will be PRESERVED:${NC}"
        echo "  - Configuration: $CONFIG_DIR"
        echo "  - Backups: $DATA_DIR"
        echo ""
        echo "Use --purge to remove everything."
        echo ""
        confirm "Proceed with uninstall?"
    fi
    
    echo ""
    
    # Always remove services and app
    stop_services
    disable_services
    remove_unit_files
    remove_sudoers
    remove_user
    remove_app_directory
    remove_cli
    
    # Only remove data with --purge
    if [[ "$PURGE" == "true" ]]; then
        remove_config
        remove_data
        remove_logs
    fi
    
    echo ""
    echo "=========================================="
    echo -e "  ${GREEN}Uninstall Complete${NC}"
    echo "=========================================="
    echo ""
    
    if [[ "$PURGE" != "true" ]]; then
        echo "Preserved directories:"
        [[ -d "$CONFIG_DIR" ]] && echo "  - $CONFIG_DIR"
        [[ -d "$DATA_DIR" ]] && echo "  - $DATA_DIR"
        echo ""
        echo "To remove these, run: sudo $0 --purge"
    fi
    
    echo ""
    echo "Note: Unbound DNS service was NOT modified."
    echo ""
}

main "$@"
