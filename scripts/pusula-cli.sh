#!/bin/bash
# =============================================================================
# Pusula CLI Management Tool
# =============================================================================
#
# A wrapper script for managing Pusula DNS Management services.
#
# Installation:
#   sudo cp scripts/pusula-cli.sh /usr/local/bin/pusula
#   sudo chmod +x /usr/local/bin/pusula
#
# Usage:
#   pusula start        - Start the backend service
#   pusula stop         - Stop the backend service
#   pusula restart      - Restart the backend service
#   pusula status       - Show service status
#   pusula autostart on|off - Enable/disable autostart
#   pusula logs [backend|unbound|proxy] - View logs
#   pusula health       - Check API health
#   pusula version      - Show version info
#   pusula help         - Show this help
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
BACKEND_SERVICE="pusula"
DOH_SERVICE="pusula-doh-proxy"
INSTALL_DIR="/opt/pusula/current"
CONFIG_DIR="/etc/pusula"
VERSION="1.1.0"
DEFAULT_PORT="${PUSULA_PORT:-3000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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
        log_error "This command requires root privileges. Use: sudo pusula $*"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------
cmd_start() {
    check_root "$@"
    log_info "Starting Pusula backend..."
    systemctl start "$BACKEND_SERVICE"
    sleep 1
    if systemctl is-active --quiet "$BACKEND_SERVICE"; then
        log_success "Pusula backend started"
    else
        log_error "Failed to start Pusula backend"
        exit 1
    fi
}

cmd_stop() {
    check_root "$@"
    log_info "Stopping Pusula backend..."
    systemctl stop "$BACKEND_SERVICE"
    log_success "Pusula backend stopped"
}

cmd_restart() {
    check_root "$@"
    log_info "Restarting Pusula backend..."
    systemctl restart "$BACKEND_SERVICE"
    sleep 1
    if systemctl is-active --quiet "$BACKEND_SERVICE"; then
        log_success "Pusula backend restarted"
    else
        log_error "Failed to restart Pusula backend"
        exit 1
    fi
}

cmd_status() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         Pusula Service Status          ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    # Backend status
    echo -n "  Backend:     "
    if systemctl is-active --quiet "$BACKEND_SERVICE" 2>/dev/null; then
        echo -e "${GREEN}● running${NC}"
    else
        echo -e "${RED}○ stopped${NC}"
    fi
    
    # Autostart status
    echo -n "  Autostart:   "
    if systemctl is-enabled --quiet "$BACKEND_SERVICE" 2>/dev/null; then
        echo -e "${GREEN}enabled${NC}"
    else
        echo -e "${YELLOW}disabled${NC}"
    fi
    
    # DoH Proxy status
    echo -n "  DoH Proxy:   "
    if systemctl is-active --quiet "$DOH_SERVICE" 2>/dev/null; then
        echo -e "${GREEN}● running${NC}"
    else
        echo -e "${YELLOW}○ not running${NC}"
    fi
    
    # Unbound status
    echo -n "  Unbound:     "
    if systemctl is-active --quiet unbound 2>/dev/null; then
        echo -e "${GREEN}● running${NC}"
    else
        echo -e "${RED}○ stopped${NC}"
    fi
    
    echo ""
}

cmd_autostart() {
    check_root "$@"
    local action="${1:-}"
    
    case "$action" in
        on|enable)
            log_info "Enabling Pusula autostart..."
            systemctl enable "$BACKEND_SERVICE"
            log_success "Autostart enabled"
            ;;
        off|disable)
            log_info "Disabling Pusula autostart..."
            systemctl disable "$BACKEND_SERVICE"
            log_success "Autostart disabled"
            ;;
        *)
            log_error "Usage: pusula autostart on|off"
            exit 1
            ;;
    esac
}

cmd_logs() {
    local target="${1:-backend}"
    local lines="${2:-50}"
    
    case "$target" in
        backend|b)
            log_info "Showing Pusula backend logs (last $lines lines, follow mode)..."
            echo ""
            journalctl -u "$BACKEND_SERVICE" -n "$lines" -f
            ;;
        unbound|u)
            log_info "Showing Unbound logs (last $lines lines, follow mode)..."
            echo ""
            sudo journalctl -u unbound -n "$lines" -f
            ;;
        proxy|doh|p)
            log_info "Showing DoH Proxy logs (last $lines lines, follow mode)..."
            echo ""
            journalctl -u "$DOH_SERVICE" -n "$lines" -f
            ;;
        audit|a)
            log_info "Showing audit log..."
            echo ""
            if [[ -f /var/log/pusula/audit.log ]]; then
                sudo tail -n "$lines" -f /var/log/pusula/audit.log
            else
                log_warn "Audit log not found at /var/log/pusula/audit.log"
            fi
            ;;
        *)
            log_error "Unknown log target: $target"
            echo "Usage: pusula logs [backend|unbound|proxy|audit]"
            exit 1
            ;;
    esac
}

cmd_health() {
    echo ""
    echo -e "${CYAN}Checking Pusula health...${NC}"
    echo ""
    
    local port="$DEFAULT_PORT"
    local url="http://localhost:$port/api/health"
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    local response
    local http_code
    
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null) || http_code="000"
    
    if [[ "$http_code" == "200" ]]; then
        response=$(curl -s "$url" 2>/dev/null)
        log_success "API is healthy"
        echo ""
        echo "  URL:      $url"
        echo "  Status:   $http_code"
        echo ""
        if command -v jq &> /dev/null; then
            echo "$response" | jq -r '.data // .'
        else
            echo "$response"
        fi
    else
        log_error "API health check failed (HTTP $http_code)"
        echo ""
        echo "  URL:      $url"
        echo "  Status:   $http_code"
        echo ""
        echo "Troubleshooting:"
        echo "  - Check if service is running: pusula status"
        echo "  - Check logs: pusula logs backend"
        exit 1
    fi
    echo ""
}

cmd_version() {
    echo ""
    echo -e "${CYAN}Pusula${NC} DNS Management"
    echo ""
    echo "  CLI Version:  $VERSION"
    
    # Try to get backend version from package.json
    if [[ -f "$INSTALL_DIR/apps/backend/package.json" ]]; then
        local backend_version
        backend_version=$(grep -o '"version": *"[^"]*"' "$INSTALL_DIR/apps/backend/package.json" | cut -d'"' -f4)
        echo "  Backend:      $backend_version"
    fi
    
    # Try to get git commit
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        local commit
        commit=$(git -C "$INSTALL_DIR" rev-parse --short HEAD 2>/dev/null) || commit="unknown"
        echo "  Commit:       $commit"
    fi
    
    echo ""
    echo "  Install dir:  $INSTALL_DIR"
    echo "  Config dir:   $CONFIG_DIR"
    echo ""
}

cmd_help() {
    echo ""
    echo -e "${CYAN}Pusula${NC} - DNS Management CLI v${VERSION}"
    echo ""
    echo "Usage: pusula <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start           Start the Pusula backend service"
    echo "  stop            Stop the Pusula backend service"
    echo "  restart         Restart the Pusula backend service"
    echo "  status          Show status of all Pusula services"
    echo "  autostart on    Enable autostart on boot"
    echo "  autostart off   Disable autostart on boot"
    echo "  logs [target]   View logs (backend|unbound|proxy|audit)"
    echo "  health          Check API health endpoint"
    echo "  version         Show version information"
    echo "  help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  sudo pusula start"
    echo "  sudo pusula autostart on"
    echo "  pusula logs backend"
    echo "  pusula status"
    echo "  pusula health"
    echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        start)
            cmd_start "$@"
            ;;
        stop)
            cmd_stop "$@"
            ;;
        restart)
            cmd_restart "$@"
            ;;
        status|st)
            cmd_status
            ;;
        autostart|auto)
            cmd_autostart "$@"
            ;;
        logs|log|l)
            cmd_logs "$@"
            ;;
        health|h)
            cmd_health
            ;;
        version|-v|--version)
            cmd_version
            ;;
        help|-h|--help)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
