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
#   sudo ./scripts/uninstall.sh --yes   # Skip confirmation
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
INSTALL_DIR="/opt/pusula"
CONFIG_DIR="/etc/pusula"
DATA_DIR="/var/lib/pusula"
LOG_DIR="/var/log/pusula"
SERVICE_USER="pusula"
BACKEND_SERVICE="pusula"
DOH_SERVICE="pusula-doh-proxy"

PURGE=false
AUTO_YES=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
        --yes|-y)
            AUTO_YES=true
            shift
            ;;
        -h|--help)
            echo "Pusula Uninstaller"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --purge    Remove all data including config and backups"
            echo "  --yes, -y  Skip confirmation prompts"
            echo ""
            echo "By default, /etc/pusula and /var/lib/pusula are preserved."
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
    if [[ "$AUTO_YES" == "true" ]]; then
        return 0
    fi
    
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
    
    # New naming
    if [[ -f "/etc/systemd/system/$BACKEND_SERVICE.service" ]]; then
        rm -f "/etc/systemd/system/$BACKEND_SERVICE.service"
        ((removed++))
    fi
    
    if [[ -f "/etc/systemd/system/$DOH_SERVICE.service" ]]; then
        rm -f "/etc/systemd/system/$DOH_SERVICE.service"
        ((removed++))
    fi
    
    # Old naming (cleanup)
    rm -f /etc/systemd/system/unbound-ui-backend.service 2>/dev/null || true
    rm -f /etc/systemd/system/unbound-ui-doh-proxy.service 2>/dev/null || true
    
    if [[ $removed -gt 0 ]]; then
        systemctl daemon-reload
        systemctl reset-failed 2>/dev/null || true
        log_success "Removed $removed unit file(s)"
    else
        log_info "No unit files found"
    fi
}

remove_sudoers() {
    log_info "Removing sudoers configuration..."
    
    if [[ -f "/etc/sudoers.d/pusula" ]]; then
        rm -f "/etc/sudoers.d/pusula"
        log_success "Removed /etc/sudoers.d/pusula"
    fi
    
    # Old naming cleanup
    rm -f /etc/sudoers.d/unbound-ui 2>/dev/null || true
    
    # Validate sudoers remains valid
    if visudo -c &>/dev/null; then
        log_success "Sudoers validation passed"
    else
        log_warn "Sudoers may have issues - run: sudo visudo -c"
    fi
}

remove_cli() {
    log_info "Removing CLI from all possible locations..."
    
    local CLI_PATHS=(
        "/usr/local/bin/pusula"
        "/usr/bin/pusula"
        "/bin/pusula"
        "/usr/local/sbin/pusula"
    )
    local removed=0
    
    for cli_path in "${CLI_PATHS[@]}"; do
        if [[ -f "$cli_path" ]] || [[ -L "$cli_path" ]]; then
            rm -f "$cli_path"
            log_success "Removed $cli_path"
            ((removed++))
        fi
    done
    
    if [[ $removed -eq 0 ]]; then
        log_info "CLI not found in any standard location"
    fi
    
    # Verify removal
    if command -v pusula &>/dev/null; then
        log_warn "CLI still found at: $(command -v pusula)"
    else
        log_success "CLI fully removed from PATH"
    fi
}

remove_temp_files() {
    log_info "Cleaning up temporary files..."
    
    rm -rf /tmp/pusula* 2>/dev/null || true
    rm -rf /var/tmp/pusula* 2>/dev/null || true
    
    log_success "Temp files cleaned"
}

remove_user() {
    log_info "Removing system user..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        userdel -f "$SERVICE_USER" 2>/dev/null || true
        log_success "Removed user: $SERVICE_USER"
    else
        log_info "User $SERVICE_USER not found"
    fi
    
    # Old user cleanup
    if id "unbound-ui" &>/dev/null; then
        userdel -f "unbound-ui" 2>/dev/null || true
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

remove_config() {
    log_info "Removing configuration..."
    
    if [[ -d "$CONFIG_DIR" ]]; then
        rm -rf "$CONFIG_DIR"
        log_success "Removed $CONFIG_DIR"
    else
        log_info "$CONFIG_DIR not found"
    fi
    
    # Old config cleanup
    rm -rf /etc/unbound-ui 2>/dev/null || true
    
    # Remove managed Unbound config
    if [[ -f "/etc/unbound/pusula-managed.conf" ]]; then
        rm -f "/etc/unbound/pusula-managed.conf"
        log_success "Removed /etc/unbound/pusula-managed.conf"
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
    
    # Old data cleanup
    rm -rf /var/lib/unbound-ui 2>/dev/null || true
}

remove_logs() {
    log_info "Removing log directory..."
    
    if [[ -d "$LOG_DIR" ]]; then
        rm -rf "$LOG_DIR"
        log_success "Removed $LOG_DIR"
    else
        log_info "$LOG_DIR not found"
    fi
    
    # Old log cleanup
    rm -rf /var/log/unbound-ui 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         Pusula Uninstaller             ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    
    echo "This will remove:"
    echo "  - Pusula service and CLI"
    echo "  - Application files ($INSTALL_DIR)"
    echo ""
    
    if [[ "$PURGE" == "true" ]]; then
        echo -e "${RED}WARNING: --purge mode will also remove:${NC}"
        echo "  - Configuration files ($CONFIG_DIR)"
        echo "  - Backup snapshots ($DATA_DIR)"
        echo "  - Logs ($LOG_DIR)"
        echo ""
        confirm "Are you sure you want to purge all Pusula data?"
    else
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
    remove_cli
    remove_temp_files
    remove_user
    remove_app_directory
    
    # Only remove data with --purge
    if [[ "$PURGE" == "true" ]]; then
        remove_config
        remove_data
        remove_logs
    fi
    
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       ${GREEN}Uninstall Complete${CYAN}               ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "$PURGE" == "true" ]]; then
        echo -e "${GREEN}Purge completed. Verification:${NC}"
        echo "  Run: command -v pusula     (should return nothing)"
        echo "  Run: systemctl status pusula  (should show 'not found')"
        echo ""
    else
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
