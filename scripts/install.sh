#!/bin/bash
# =============================================================================
# Pusula Installer
# =============================================================================
#
# One-command install for Raspberry Pi OS (Bookworm+)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/admin/pusula/main/scripts/install.sh | sudo bash
#
# Or locally:
#   sudo ./scripts/install.sh
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
PUSULA_VERSION="${PUSULA_VERSION:-main}"
INSTALL_DIR="/opt/pusula"
CONFIG_DIR="/etc/unbound-ui"
DATA_DIR="/var/lib/unbound-ui"
LOG_DIR="/var/log/unbound-ui"
SERVICE_USER="unbound-ui"
BACKEND_PORT="${PUSULA_PORT:-3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
        unbound \
        unbound-host \
        || log_error "Failed to install essential packages"
    
    # Install Node.js via NodeSource (LTS)
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js LTS..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
        apt-get install -y -qq nodejs
    else
        NODE_VERSION=$(node --version)
        log_info "Node.js already installed: $NODE_VERSION"
    fi
    
    # Verify Node.js version
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
    if [[ $NODE_MAJOR -lt 18 ]]; then
        log_error "Node.js 18+ required. Found: $(node --version)"
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
    
    # Config directory
    mkdir -p "$CONFIG_DIR"
    chmod 750 "$CONFIG_DIR"
    chown root:"$SERVICE_USER" "$CONFIG_DIR"
    
    # Data directory
    mkdir -p "$DATA_DIR/backups"
    chmod 750 "$DATA_DIR"
    chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"
    
    # Log directory
    mkdir -p "$LOG_DIR"
    chmod 750 "$LOG_DIR"
    chown "$SERVICE_USER":adm "$LOG_DIR"
    
    # Install directory
    mkdir -p "$INSTALL_DIR"
    
    log_success "Directories created"
}

# -----------------------------------------------------------------------------
# Step 4: Install Config Templates
# -----------------------------------------------------------------------------
install_config() {
    log_info "Installing configuration..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_DIR="$(dirname "$SCRIPT_DIR")"
    
    # Config file
    if [[ ! -f "$CONFIG_DIR/config.yaml" ]]; then
        if [[ -f "$REPO_DIR/system/config.yaml.example" ]]; then
            cp "$REPO_DIR/system/config.yaml.example" "$CONFIG_DIR/config.yaml"
        else
            # Create minimal config
            cat > "$CONFIG_DIR/config.yaml" << 'EOF'
server:
  host: "0.0.0.0"
  port: 3000

unbound:
  managedConfigPath: /etc/unbound/unbound-ui-managed.conf

pihole:
  enabled: false
  baseUrl: "http://localhost"
  apiToken: ""

alerts:
  enabled: true
  checkInterval: 60

backup:
  maxSnapshots: 10
  path: /var/lib/unbound-ui/backups

logging:
  level: info
  auditPath: /var/log/unbound-ui/audit.log
EOF
        fi
        chmod 640 "$CONFIG_DIR/config.yaml"
        chown root:"$SERVICE_USER" "$CONFIG_DIR/config.yaml"
        log_success "Created config.yaml"
    else
        log_info "config.yaml already exists, skipping"
    fi
    
    # Credentials file
    if [[ ! -f "$CONFIG_DIR/credentials.json" ]]; then
        # Default password
        INITIAL_PASSWORD="admin"
        
        # Generate bcrypt hash using node
        PASSWORD_HASH=$(node -e "
            const bcrypt = require('bcrypt');
            console.log(bcrypt.hashSync('$INITIAL_PASSWORD', 12));
        " 2>/dev/null || echo "")
        
        if [[ -z "$PASSWORD_HASH" ]]; then
            # Fallback: generate hash after backend is installed
            log_warn "Will generate password hash after backend installation"
            GENERATE_PASSWORD_LATER=1
        else
            cat > "$CONFIG_DIR/credentials.json" << EOF
{
  "username": "admin",
  "passwordHash": "$PASSWORD_HASH"
}
EOF
            chmod 600 "$CONFIG_DIR/credentials.json"
            chown "$SERVICE_USER":"$SERVICE_USER" "$CONFIG_DIR/credentials.json"
            log_success "Created credentials.json"
        fi
    else
        log_info "credentials.json already exists, skipping"
        INITIAL_PASSWORD=""
    fi
    
    # Environment file
    if [[ ! -f "$CONFIG_DIR/unbound-ui.env" ]]; then
        # Generate JWT secret
        JWT_SECRET=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 64)
        
        cat > "$CONFIG_DIR/unbound-ui.env" << EOF
# Pusula Environment Variables
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
CONFIG_PATH=$CONFIG_DIR/config.yaml
CREDENTIALS_PATH=$CONFIG_DIR/credentials.json
EOF
        chmod 640 "$CONFIG_DIR/unbound-ui.env"
        chown root:"$SERVICE_USER" "$CONFIG_DIR/unbound-ui.env"
        log_success "Created unbound-ui.env"
    else
        log_info "unbound-ui.env already exists, skipping"
    fi
}

# -----------------------------------------------------------------------------
# Step 5: Build and Install Backend + UI
# -----------------------------------------------------------------------------
install_application() {
    log_info "Installing Pusula application..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_DIR="$(dirname "$SCRIPT_DIR")"
    
    # Copy backend
    log_info "Installing backend..."
    cp -r "$REPO_DIR/apps/backend" "$INSTALL_DIR/"
    cd "$INSTALL_DIR/backend"
    npm ci --production --silent 2>/dev/null || npm install --production --silent
    npm run build --silent 2>/dev/null || true
    
    # Copy UI (pre-built or build)
    log_info "Installing UI..."
    if [[ -d "$REPO_DIR/apps/ui/dist" ]]; then
        cp -r "$REPO_DIR/apps/ui/dist" "$INSTALL_DIR/ui"
    else
        cp -r "$REPO_DIR/apps/ui" "$INSTALL_DIR/"
        cd "$INSTALL_DIR/ui"
        npm ci --silent 2>/dev/null || npm install --silent
        npm run build --silent
        # Keep only dist
        mv dist ../ui-dist
        cd ..
        rm -rf ui
        mv ui-dist ui
    fi
    
    # Set permissions
    chown -R root:root "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    
    # Generate password if needed
    if [[ "${GENERATE_PASSWORD_LATER:-0}" == "1" ]]; then
        cd "$INSTALL_DIR/backend"
        INITIAL_PASSWORD="admin"
        PASSWORD_HASH=$(node -e "
            const bcrypt = require('bcrypt');
            console.log(bcrypt.hashSync('$INITIAL_PASSWORD', 12));
        ")
        cat > "$CONFIG_DIR/credentials.json" << EOF
{
  "username": "admin",
  "passwordHash": "$PASSWORD_HASH"
}
EOF
        chmod 600 "$CONFIG_DIR/credentials.json"
        chown "$SERVICE_USER":"$SERVICE_USER" "$CONFIG_DIR/credentials.json"
        log_success "Created credentials.json"
    fi
    
    log_success "Application installed"
}

# -----------------------------------------------------------------------------
# Step 6: Install Systemd Units
# -----------------------------------------------------------------------------
install_systemd() {
    log_info "Installing systemd units..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_DIR="$(dirname "$SCRIPT_DIR")"
    
    # Copy service files
    cp "$REPO_DIR/systemd/unbound-ui-backend.service" /etc/systemd/system/
    cp "$REPO_DIR/systemd/unbound-ui-doh-proxy.service" /etc/systemd/system/
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start backend
    systemctl enable unbound-ui-backend
    systemctl start unbound-ui-backend
    
    log_success "Systemd units installed and started"
}

# -----------------------------------------------------------------------------
# Step 7: Install Sudoers
# -----------------------------------------------------------------------------
install_sudoers() {
    log_info "Installing sudoers configuration..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_DIR="$(dirname "$SCRIPT_DIR")"
    
    cp "$REPO_DIR/system/sudoers-unbound-ui" /etc/sudoers.d/unbound-ui
    chmod 440 /etc/sudoers.d/unbound-ui
    
    # Validate
    if visudo -c -f /etc/sudoers.d/unbound-ui &>/dev/null; then
        log_success "Sudoers configuration installed and validated"
    else
        log_error "Sudoers validation failed! Check /etc/sudoers.d/unbound-ui"
    fi
}

# -----------------------------------------------------------------------------
# Step 8: Post-Install Health Check
# -----------------------------------------------------------------------------
health_check() {
    log_info "Running health check..."
    
    # Wait for service to start
    sleep 3
    
    # Check service status
    if systemctl is-active --quiet unbound-ui-backend; then
        log_success "Service is running"
    else
        log_warn "Service may not be running. Check: journalctl -u unbound-ui-backend"
    fi
    
    # Check health endpoint
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/api/health" | grep -q "200"; then
        log_success "Health check passed"
    else
        log_warn "Health check failed. Service may still be starting..."
    fi
}

# -----------------------------------------------------------------------------
# Main Installation
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo "=========================================="
    echo "  Pusula DNS Management Installer"
    echo "=========================================="
    echo ""
    
    check_root
    check_os
    
    install_dependencies
    create_user
    create_directories
    install_config
    install_application
    install_systemd
    install_sudoers
    health_check
    
    # Get local IP
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "=========================================="
    echo -e "  ${GREEN}Installation Complete!${NC}"
    echo "=========================================="
    echo ""
    echo "  Access Pusula at:"
    echo -e "    ${BLUE}http://$LOCAL_IP:$BACKEND_PORT${NC}"
    echo ""
    if [[ -n "${INITIAL_PASSWORD:-}" ]]; then
        echo -e "  ${YELLOW}Initial Credentials:${NC}"
        echo "    Username: admin"
        echo -e "    Password: ${RED}$INITIAL_PASSWORD${NC}"
        echo ""
        echo -e "  ${YELLOW}⚠️  IMPORTANT: Save this password! It won't be shown again.${NC}"
    fi
    echo ""
    echo "  Useful commands:"
    echo "    sudo systemctl status unbound-ui-backend"
    echo "    sudo journalctl -u unbound-ui-backend -f"
    echo ""
}

main "$@"
