#!/bin/bash
# =============================================================================
# Pusula Uninstall Self-Check
# =============================================================================
#
# Verifies that ./uninstall.sh --purge completely removed Pusula.
# Run this after uninstall to verify cleanup.
#
# Usage:
#   sudo ./scripts/uninstall-selfcheck.sh
#
# Exit codes:
#   0 = All checks passed (Pusula fully removed)
#   1 = Some remnants found
#
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FAILED=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=1
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}[ERROR]${NC} This script must be run as root. Use: sudo $0"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------
check_cli_removed() {
    echo ""
    echo "Checking CLI removal..."
    
    local CLI_PATHS=(
        "/usr/local/bin/pusula"
        "/usr/bin/pusula"
        "/bin/pusula"
        "/usr/local/sbin/pusula"
    )
    
    for cli_path in "${CLI_PATHS[@]}"; do
        if [[ -f "$cli_path" ]] || [[ -L "$cli_path" ]]; then
            log_fail "CLI still exists: $cli_path"
        fi
    done
    
    if command -v pusula &>/dev/null; then
        log_fail "CLI still in PATH: $(command -v pusula)"
    else
        log_pass "CLI not found in PATH"
    fi
}

check_services_removed() {
    echo ""
    echo "Checking systemd services..."
    
    if systemctl list-unit-files 2>/dev/null | grep -q "^pusula"; then
        log_fail "Pusula unit files still registered"
    else
        log_pass "No pusula unit files registered"
    fi
    
    if [[ -f "/etc/systemd/system/pusula.service" ]]; then
        log_fail "Service file exists: /etc/systemd/system/pusula.service"
    else
        log_pass "pusula.service removed"
    fi
    
    if [[ -f "/etc/systemd/system/pusula-doh-proxy.service" ]]; then
        log_fail "Service file exists: /etc/systemd/system/pusula-doh-proxy.service"
    else
        log_pass "pusula-doh-proxy.service removed"
    fi
}

check_directories_removed() {
    echo ""
    echo "Checking directories (purge mode)..."
    
    local PURGE_DIRS=(
        "/opt/pusula"
        "/etc/pusula"
        "/var/lib/pusula"
        "/var/log/pusula"
    )
    
    for dir in "${PURGE_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            log_fail "Directory still exists: $dir"
        else
            log_pass "Removed: $dir"
        fi
    done
}

check_sudoers_removed() {
    echo ""
    echo "Checking sudoers..."
    
    if [[ -f "/etc/sudoers.d/pusula" ]]; then
        log_fail "Sudoers file exists: /etc/sudoers.d/pusula"
    else
        log_pass "Sudoers file removed"
    fi
    
    # Also check old naming
    if [[ -f "/etc/sudoers.d/unbound-ui" ]]; then
        log_warn "Old sudoers file exists: /etc/sudoers.d/unbound-ui"
    fi
}

check_temp_files() {
    echo ""
    echo "Checking temp files..."
    
    local tmp_files
    tmp_files=$(find /tmp /var/tmp -maxdepth 1 -name 'pusula*' 2>/dev/null | wc -l)
    
    if [[ $tmp_files -gt 0 ]]; then
        log_warn "Temp files found: $tmp_files files in /tmp or /var/tmp"
    else
        log_pass "No temp files found"
    fi
}

check_user_removed() {
    echo ""
    echo "Checking system user..."
    
    if id "pusula" &>/dev/null; then
        log_warn "User 'pusula' still exists (may be intentional)"
    else
        log_pass "User 'pusula' removed"
    fi
}

check_unbound_config() {
    echo ""
    echo "Checking Unbound managed config..."
    
    if [[ -f "/etc/unbound/pusula-managed.conf" ]]; then
        log_fail "Managed config exists: /etc/unbound/pusula-managed.conf"
    else
        log_pass "Managed config removed"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Pusula Uninstall Self-Check        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    
    check_root
    
    check_cli_removed
    check_services_removed
    check_directories_removed
    check_sudoers_removed
    check_temp_files
    check_user_removed
    check_unbound_config
    
    echo ""
    echo "========================================"
    
    if [[ $FAILED -eq 0 ]]; then
        echo -e "${GREEN}All checks passed! Pusula fully removed.${NC}"
        exit 0
    else
        echo -e "${RED}Some checks failed. See above for details.${NC}"
        exit 1
    fi
}

main "$@"
