#!/bin/bash
# =============================================================================
# Pusula Installer
# =============================================================================
#
# One-command install for Raspberry Pi OS (Bookworm+) / Debian 12+
#
# Usage (remote):
#   curl -fsSL https://raw.githubusercontent.com/goktugorgn/Pusula/refs/heads/main/scripts/install.sh | sudo bash
#
# Usage (local):
#   sudo ./scripts/install.sh
#
# Options:
#   --upgrade    Force upgrade mode (skip config creation)
#   --yes        Skip confirmations
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
PUSULA_VERSION="${PUSULA_VERSION:-main}"
INSTALL_DIR="/opt/pusula"
CURRENT_DIR="$INSTALL_DIR/current"
CONFIG_DIR="/etc/pusula"
DATA_DIR="/var/lib/pusula"
LOG_DIR="/var/log/pusula"
SERVICE_USER="pusula"
SERVICE_GROUP="pusula"
BACKEND_PORT="${PUSULA_PORT:-3000}"
REPO_URL="https://github.com/goktugorgn/Pusula.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Flags
UPGRADE_MODE=false
REMOTE_INSTALL=false
AUTO_YES=false
INITIAL_PASSWORD=""

# -----------------------------------------------------------------------------
# Parse Arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --upgrade)
            UPGRADE_MODE=true
            shift
            ;;
        --yes|-y)
            AUTO_YES=true
            shift
            ;;
        -h|--help)
            echo "Pusula Installer"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --upgrade    Force upgrade mode (preserve existing config)"
            echo "  --yes, -y    Skip confirmations"
            echo "  -h, --help   Show this help"
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
    exit 1
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Use: sudo $0"
    fi
}

check_os() {
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot detect OS. /etc/os-release not found."
    fi
    
    source /etc/os-release
    
    if [[ "$ID" != "raspbian" && "$ID" != "debian" && "$ID" != "ubuntu" ]]; then
        log_warn "Detected OS: $ID. This script is tested on Raspberry Pi OS / Debian."
    fi
    
    log_info "Detected OS: $PRETTY_NAME"
}

detect_install_mode() {
    # Check if this is a re-install (upgrade)
    if [[ -d "$CURRENT_DIR" && -f "$CONFIG_DIR/config.yaml" ]]; then
        log_info "Existing installation detected. Running in upgrade mode."
        UPGRADE_MODE=true
    fi
    
    # Detect if running from pipe (remote install)
    if [[ ! -t 0 ]]; then
        REMOTE_INSTALL=true
    fi
}

# -----------------------------------------------------------------------------
# Step 1: Install Dependencies
# -----------------------------------------------------------------------------
install_dependencies() {
    log_info "Installing system dependencies..."
    
    apt-get update -qq
    
    # Essential packages
    apt-get install -y -qq \
        curl \
        gnupg \
        ca-certificates \
        git \
        unbound \
        unbound-host \
        jq \
        || log_error "Failed to install essential packages"
    
    # Install Node.js 20 LTS via NodeSource (NOT lts.x which may be v24+)
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    else
        NODE_VERSION=$(node --version)
        log_info "Node.js already installed: $NODE_VERSION"
    fi
    
    # Verify Node.js version (must be 18-22, not 23+)
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
    if [[ $NODE_MAJOR -lt 18 ]]; then
        log_error "Node.js 18+ required. Found: $(node --version)"
    fi
    if [[ $NODE_MAJOR -ge 23 ]]; then
        log_error "Node.js 22 or lower required (v23+ has compatibility issues). Found: $(node --version)"
    fi
    
    log_success "Dependencies installed"
}

# -----------------------------------------------------------------------------
# Step 2: Create System User
# -----------------------------------------------------------------------------
create_user() {
    log_info "Creating system user: $SERVICE_USER"
    
    if id "$SERVICE_USER" &>/dev/null; then
        log_info "User $SERVICE_USER already exists"
    else
        useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
        log_success "Created user: $SERVICE_USER"
    fi
    
    # Add to required groups
    usermod -aG unbound "$SERVICE_USER" 2>/dev/null || true
    usermod -aG adm "$SERVICE_USER" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Step 3: Create Directories
# -----------------------------------------------------------------------------
create_directories() {
    log_info "Creating directories..."
    
    # Install directory
    mkdir -p "$INSTALL_DIR"
    
    # Config directory
    mkdir -p "$CONFIG_DIR"
    chmod 750 "$CONFIG_DIR"
    chown root:"$SERVICE_GROUP" "$CONFIG_DIR"
    
    # Data directory
    mkdir -p "$DATA_DIR/backups"
    chmod 750 "$DATA_DIR"
    chown -R "$SERVICE_USER":"$SERVICE_GROUP" "$DATA_DIR"
    
    # Log directory
    mkdir -p "$LOG_DIR"
    chmod 750 "$LOG_DIR"
    chown "$SERVICE_USER":adm "$LOG_DIR"
    
    log_success "Directories created"
}

# -----------------------------------------------------------------------------
# Step 4: Install Configuration (skip in upgrade mode if exists)
# -----------------------------------------------------------------------------
install_config() {
    log_info "Installing configuration..."
    
    # Config file
    if [[ ! -f "$CONFIG_DIR/config.yaml" ]]; then
        cat > "$CONFIG_DIR/config.yaml" << 'EOF'
server:
  host: "0.0.0.0"
  port: 3000

unbound:
  managedConfigPath: /etc/unbound/pusula-managed.conf

pihole:
  enabled: false
  baseUrl: "http://localhost"
  apiToken: ""

alerts:
  enabled: true
  checkInterval: 60

backup:
  maxSnapshots: 10
  path: /var/lib/pusula/backups

logging:
  level: info
  auditPath: /var/log/pusula/audit.log
EOF
        chmod 640 "$CONFIG_DIR/config.yaml"
        chown root:"$SERVICE_GROUP" "$CONFIG_DIR/config.yaml"
        log_success "Created config.yaml"
    else
        log_info "config.yaml already exists, preserving"
    fi
    
    # Credentials file
    if [[ ! -f "$CONFIG_DIR/credentials.json" ]]; then
        INITIAL_PASSWORD="admin"
        log_info "Will create credentials after backend installation"
    else
        log_info "credentials.json already exists, preserving"
    fi
    
    # Environment file
    if [[ ! -f "$CONFIG_DIR/pusula.env" ]]; then
        # Generate JWT secret (|| true to prevent SIGPIPE exit)
        JWT_SECRET=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 64 || true)
        
        cat > "$CONFIG_DIR/pusula.env" << EOF
# Pusula Environment Variables
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
CONFIG_PATH=$CONFIG_DIR/config.yaml
CREDENTIALS_PATH=$CONFIG_DIR/credentials.json
UPSTREAM_PATH=$CONFIG_DIR/upstream.json
BACKUP_DIR=$DATA_DIR/backups
AUDIT_LOG_PATH=$LOG_DIR/audit.log
ALERTS_PATH=$DATA_DIR/alerts.json
UI_STATIC_PATH=$CURRENT_DIR/apps/ui/dist
EOF
        chmod 640 "$CONFIG_DIR/pusula.env"
        chown root:"$SERVICE_GROUP" "$CONFIG_DIR/pusula.env"
        log_success "Created pusula.env"
    else
        log_info "pusula.env already exists, preserving"
    fi
    
    # Create managed Unbound config file (required for systemd ReadWritePaths)
    local MANAGED_CONF="/etc/unbound/pusula-managed.conf"
    if [[ ! -f "$MANAGED_CONF" ]]; then
        # Ensure /etc/unbound exists
        mkdir -p /etc/unbound
        touch "$MANAGED_CONF"
        chown "$SERVICE_USER":unbound "$MANAGED_CONF"
        chmod 664 "$MANAGED_CONF"
        log_success "Created $MANAGED_CONF"
    else
        # Ensure correct ownership
        chown "$SERVICE_USER":unbound "$MANAGED_CONF" 2>/dev/null || true
        chmod 664 "$MANAGED_CONF" 2>/dev/null || true
        log_info "Managed config already exists"
    fi
}

# -----------------------------------------------------------------------------
# Step 5: Clone/Update and Build Application
# -----------------------------------------------------------------------------
install_application() {
    log_info "Installing Pusula application..."
    log_info "  Remote install: $REMOTE_INSTALL"
    
    local SOURCE_DIR=""
    local RELEASE_DIR="$INSTALL_DIR/releases/$(date +%Y%m%d%H%M%S)"
    
    if [[ "$REMOTE_INSTALL" == "true" ]]; then
        # Remote install: clone from git
        log_info "Cloning repository..."
        mkdir -p "$RELEASE_DIR"
        git clone --depth 1 --branch "$PUSULA_VERSION" "$REPO_URL" "$RELEASE_DIR"
        SOURCE_DIR="$RELEASE_DIR"
    else
        # Local install: use script's directory
        local SCRIPT_DIR
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        SOURCE_DIR="$(dirname "$SCRIPT_DIR")"
        
        # Copy to release directory
        log_info "Copying from local source..."
        mkdir -p "$RELEASE_DIR"
        cp -r "$SOURCE_DIR/apps" "$RELEASE_DIR/"
        cp -r "$SOURCE_DIR/scripts" "$RELEASE_DIR/"
        cp -r "$SOURCE_DIR/systemd" "$RELEASE_DIR/"
        cp -r "$SOURCE_DIR/system" "$RELEASE_DIR/" 2>/dev/null || true
        cp -r "$SOURCE_DIR/docs" "$RELEASE_DIR/" 2>/dev/null || true
    fi
    
    # Build backend (CRITICAL: must install devDeps for TypeScript, then prune after)
    log_info "Building backend..."
    log_info "  → Installing backend dependencies (including devDeps for build)..."
    cd "$RELEASE_DIR/apps/backend"
    npm ci 2>&1 || npm install 2>&1
    log_info "  → Compiling TypeScript..."
    npm run build 2>&1
    if [[ ! -f "dist/index.js" ]]; then
        log_error "Backend build failed: dist/index.js not created"
    fi
    log_info "  → Pruning devDependencies for production..."
    npm prune --omit=dev 2>&1
    log_success "Backend built"
    
    # Build UI if not pre-built
    log_info "Building UI (this may take 5-10 minutes on Raspberry Pi)..."
    if [[ -d "$RELEASE_DIR/apps/ui/dist" ]]; then
        log_info "  → UI already built, skipping"
    elif [[ -d "$RELEASE_DIR/apps/ui" ]]; then
        cd "$RELEASE_DIR/apps/ui"
        log_info "  → Installing UI dependencies..."
        npm ci 2>&1 || npm install 2>&1
        log_info "  → Bundling UI assets (Vite)..."
        npm run build 2>&1
        log_success "UI built"
    fi
    
    # Update current symlink
    log_info "Updating current symlink..."
    rm -f "$CURRENT_DIR"
    ln -sf "$RELEASE_DIR" "$CURRENT_DIR"
    
    # Set permissions
    chown -R root:root "$RELEASE_DIR"
    chmod -R 755 "$RELEASE_DIR"
    
    # Generate password hash if needed
    if [[ -n "$INITIAL_PASSWORD" && ! -f "$CONFIG_DIR/credentials.json" ]]; then
        log_info "Generating credentials..."
        cd "$CURRENT_DIR/apps/backend"
        log_info "  → Hashing initial password with bcrypt..."
        
        PASSWORD_HASH=$(node -e "
            const bcrypt = require('bcrypt');
            console.log(bcrypt.hashSync('$INITIAL_PASSWORD', 12));
        " 2>&1) || PASSWORD_HASH=""
        
        if [[ -n "$PASSWORD_HASH" ]]; then
            cat > "$CONFIG_DIR/credentials.json" << EOF
{
  "username": "admin",
  "passwordHash": "$PASSWORD_HASH"
}
EOF
            chmod 600 "$CONFIG_DIR/credentials.json"
            chown "$SERVICE_USER":"$SERVICE_GROUP" "$CONFIG_DIR/credentials.json"
            log_success "Created credentials.json"
        else
            log_warn "Could not generate password hash. Manual setup required."
            INITIAL_PASSWORD=""
        fi
    fi
    
    log_success "Application installed"
}

# -----------------------------------------------------------------------------
# Step 6: Install CLI
# -----------------------------------------------------------------------------
install_cli() {
    log_info "Installing CLI..."
    
    local CLI_SOURCE="$CURRENT_DIR/scripts/pusula-cli.sh"
    
    if [[ -f "$CLI_SOURCE" ]]; then
        cp "$CLI_SOURCE" /usr/local/bin/pusula
        chmod +x /usr/local/bin/pusula
        log_success "CLI installed: /usr/local/bin/pusula"
    else
        log_warn "CLI script not found"
    fi
}

# -----------------------------------------------------------------------------
# Step 7: Install Systemd Units
# -----------------------------------------------------------------------------
install_systemd() {
    log_info "Installing systemd units..."
    
    # Stop existing service if running
    systemctl stop pusula 2>/dev/null || true
    systemctl stop pusula-doh-proxy 2>/dev/null || true
    
    # Remove old units if they exist
    rm -f /etc/systemd/system/unbound-ui-backend.service 2>/dev/null || true
    rm -f /etc/systemd/system/unbound-ui-doh-proxy.service 2>/dev/null || true
    
    # Copy new service files
    if [[ -f "$CURRENT_DIR/systemd/pusula.service" ]]; then
        cp "$CURRENT_DIR/systemd/pusula.service" /etc/systemd/system/
    fi
    
    if [[ -f "$CURRENT_DIR/systemd/pusula-doh-proxy.service" ]]; then
        cp "$CURRENT_DIR/systemd/pusula-doh-proxy.service" /etc/systemd/system/
    fi
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start backend
    systemctl enable pusula
    systemctl start pusula
    
    log_success "Systemd units installed and started"
}

# -----------------------------------------------------------------------------
# Step 8: Install Sudoers
# -----------------------------------------------------------------------------
install_sudoers() {
    log_info "Installing sudoers configuration..."
    
    cat > /etc/sudoers.d/pusula << 'EOF'
# Pusula sudoers configuration
# Allow pusula user to run specific commands without password

# Unbound control commands
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control status
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control stats_noreset
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control reload
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control flush_zone *
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control flush_requestlist
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-checkconf

# Systemctl (Unbound only)
pusula ALL=(ALL) NOPASSWD: /bin/systemctl is-active unbound
pusula ALL=(ALL) NOPASSWD: /bin/systemctl status unbound
pusula ALL=(ALL) NOPASSWD: /bin/systemctl reload unbound
pusula ALL=(ALL) NOPASSWD: /bin/systemctl restart unbound

# Journalctl (read-only)
pusula ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u unbound *
EOF
    
    chmod 440 /etc/sudoers.d/pusula
    
    # Validate
    if visudo -c -f /etc/sudoers.d/pusula &>/dev/null; then
        log_success "Sudoers configuration installed and validated"
    else
        log_warn "Sudoers validation failed, removing invalid file"
        rm -f /etc/sudoers.d/pusula
    fi
}

# -----------------------------------------------------------------------------
# Step 9: Post-Install Health Check
# -----------------------------------------------------------------------------
health_check() {
    log_info "Running health check..."
    
    # Wait for service to start
    sleep 3
    
    # Check service status
    if systemctl is-active --quiet pusula; then
        log_success "Backend service is running"
    else
        log_warn "Backend service may not be running. Check: journalctl -u pusula"
        return
    fi
    
    # Check health endpoint (retry a few times)
    local health_ok=false
    for i in {1..5}; do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null | grep -q "200"; then
            health_ok=true
            break
        fi
        sleep 1
    done
    
    if [[ "$health_ok" == "true" ]]; then
        log_success "Health endpoint responding"
    else
        log_warn "Health endpoint not responding yet. Service may still be starting..."
    fi
}

# -----------------------------------------------------------------------------
# Main Installation
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Pusula DNS Management Installer    ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    check_os
    detect_install_mode
    
    if [[ "$UPGRADE_MODE" == "true" ]]; then
        log_info "Running in upgrade mode"
    fi
    
    install_dependencies
    create_user
    create_directories
    install_config
    install_application
    install_cli
    install_systemd
    install_sudoers
    health_check
    
    # Get local IP
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || LOCAL_IP="localhost"
    
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       ${GREEN}Installation Complete!${CYAN}           ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "  Access Pusula at:"
    echo -e "    ${BLUE}http://$LOCAL_IP:$BACKEND_PORT${NC}"
    echo ""
    
    if [[ -n "${INITIAL_PASSWORD:-}" ]]; then
        echo -e "  ${YELLOW}Initial Credentials:${NC}"
        echo "    Username: admin"
        echo -e "    Password: ${RED}$INITIAL_PASSWORD${NC}"
        echo ""
        echo -e "  ${YELLOW}⚠️  IMPORTANT: Change your password after first login!${NC}"
    fi
    
    echo ""
    echo "  CLI commands:"
    echo "    pusula status       - Show service status"
    echo "    pusula health       - Check API health"
    echo "    pusula logs backend - View backend logs"
    echo "    sudo pusula restart - Restart service"
    echo ""
}

main "$@"
