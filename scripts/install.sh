#!/usr/bin/env bash
#
# Pusula Installer
# One-command installer for Raspberry Pi OS
#
# Usage: sudo ./scripts/install.sh
#
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/pusula"
CONFIG_DIR="/etc/unbound-ui"
DATA_DIR="/var/lib/unbound-ui"
LOG_DIR="/var/log/unbound-ui"
SERVICE_USER="unbound-ui"
NODE_VERSION="20"

# Print functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check OS
check_os() {
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot detect OS. This script is for Raspberry Pi OS."
        exit 1
    fi
    
    source /etc/os-release
    if [[ "$ID" != "raspbian" && "$ID" != "debian" ]]; then
        log_warn "This script is designed for Raspberry Pi OS / Debian."
        log_warn "Detected: $PRETTY_NAME"
    fi
}

# Install Node.js via NodeSource
install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}.x..."
    
    if command -v node &> /dev/null; then
        local current_version
        current_version=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [[ "$current_version" -ge "${NODE_VERSION}" ]]; then
            log_success "Node.js $(node --version) already installed"
            return 0
        fi
    fi
    
    # Install NodeSource repo
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    log_success "Node.js $(node --version) installed"
}

# Install system dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    apt-get update
    apt-get install -y \
        unbound \
        unbound-anchor \
        curl \
        jq \
        openssl
    
    # Ensure unbound-control is enabled
    if [[ ! -f /etc/unbound/unbound_control.key ]]; then
        log_info "Setting up unbound-control..."
        unbound-control-setup
    fi
    
    log_success "Dependencies installed"
}

# Create service user
create_user() {
    log_info "Creating service user ${SERVICE_USER}..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        log_success "User ${SERVICE_USER} already exists"
    else
        useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
        log_success "User ${SERVICE_USER} created"
    fi
    
    # Add to unbound group for unbound-control access
    usermod -aG unbound "$SERVICE_USER" 2>/dev/null || true
    
    # Add to systemd-journal for log reading
    usermod -aG systemd-journal "$SERVICE_USER" 2>/dev/null || true
}

# Create directories
create_directories() {
    log_info "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$DATA_DIR/backups"
    mkdir -p "$LOG_DIR"
    
    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$LOG_DIR"
    
    # Secure config directory
    chown root:$SERVICE_USER "$CONFIG_DIR"
    chmod 750 "$CONFIG_DIR"
    
    log_success "Directories created"
}

# Copy application files
copy_application() {
    log_info "Copying application files..."
    
    # Get script directory (repo root)
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    # Copy backend
    cp -r "$script_dir/backend" "$INSTALL_DIR/"
    
    # Build frontend if dist doesn't exist
    if [[ -d "$script_dir/ui/dist" ]]; then
        cp -r "$script_dir/ui/dist" "$INSTALL_DIR/frontend/"
    else
        log_warn "UI not built. Run 'npm run build' in ui/ first."
    fi
    
    # Install backend dependencies
    cd "$INSTALL_DIR/backend"
    npm ci --omit=dev
    npm run build
    
    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    log_success "Application files copied"
}

# Create configuration files
create_config() {
    log_info "Creating configuration files..."
    
    # Config file
    if [[ ! -f "$CONFIG_DIR/config.yaml" ]]; then
        cat > "$CONFIG_DIR/config.yaml" << 'EOF'
# Pusula Configuration
server:
  port: 3000
  host: 0.0.0.0

unbound:
  managedIncludePath: /etc/unbound/unbound-ui-managed.conf

rateLimit:
  login:
    max: 5
    windowMs: 60000
  api:
    max: 60
    windowMs: 60000

lockout:
  threshold: 5
  durationMs: 900000
  extendedThreshold: 10
  extendedDurationMs: 3600000

pihole:
  enabled: false
  baseUrl: http://localhost/admin/api.php
EOF
        chmod 640 "$CONFIG_DIR/config.yaml"
        chown root:$SERVICE_USER "$CONFIG_DIR/config.yaml"
        log_success "Created config.yaml"
    else
        log_warn "config.yaml already exists, skipping"
    fi
    
    # Generate JWT secret
    local jwt_secret
    jwt_secret=$(openssl rand -base64 32)
    
    # Create .env file
    cat > "$INSTALL_DIR/backend/.env" << EOF
NODE_ENV=production
JWT_SECRET=${jwt_secret}
CONFIG_PATH=${CONFIG_DIR}/config.yaml
CREDENTIALS_PATH=${CONFIG_DIR}/credentials.json
UPSTREAM_PATH=${DATA_DIR}/upstream.json
BACKUP_DIR=${DATA_DIR}/backups
AUDIT_LOG_PATH=${LOG_DIR}/audit.log
EOF
    chmod 600 "$INSTALL_DIR/backend/.env"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backend/.env"
    
    # Credentials file
    if [[ ! -f "$CONFIG_DIR/credentials.json" ]]; then
        local random_password
        random_password=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
        local password_hash
        password_hash=$(node -e "const bcrypt=require('bcrypt');bcrypt.hash('${random_password}',12).then(console.log)" 2>/dev/null || echo "")
        
        if [[ -z "$password_hash" ]]; then
            # Fallback - install bcrypt temporarily
            cd "$INSTALL_DIR/backend"
            npm install bcrypt --save 2>/dev/null || true
            password_hash=$(node -e "const bcrypt=require('bcrypt');bcrypt.hash('${random_password}',12).then(console.log)")
        fi
        
        cat > "$CONFIG_DIR/credentials.json" << EOF
{
  "username": "goktugorgn",
  "passwordHash": "${password_hash}"
}
EOF
        chmod 600 "$CONFIG_DIR/credentials.json"
        chown root:$SERVICE_USER "$CONFIG_DIR/credentials.json"
        
        # Save password for display at end
        echo "$random_password" > /tmp/pusula_initial_password
        log_success "Created credentials with random password"
    else
        log_warn "credentials.json already exists, skipping"
    fi
    
    # Upstream config
    if [[ ! -f "$DATA_DIR/upstream.json" ]]; then
        cat > "$DATA_DIR/upstream.json" << 'EOF'
{
  "mode": "recursive",
  "dotProviders": [],
  "dohProviders": []
}
EOF
        chown "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR/upstream.json"
        log_success "Created upstream.json"
    fi
    
    # Unbound managed config
    if [[ ! -f /etc/unbound/unbound-ui-managed.conf ]]; then
        cat > /etc/unbound/unbound-ui-managed.conf << 'EOF'
# Pusula managed configuration
# DO NOT EDIT MANUALLY - changes will be overwritten

# Mode: Recursive (direct root resolution)
EOF
        chown root:unbound /etc/unbound/unbound-ui-managed.conf
        chmod 644 /etc/unbound/unbound-ui-managed.conf
        log_success "Created unbound-ui-managed.conf"
    fi
    
    # Add include to unbound.conf if not present
    if ! grep -q "unbound-ui-managed.conf" /etc/unbound/unbound.conf 2>/dev/null; then
        echo -e "\n# Pusula managed include\ninclude: /etc/unbound/unbound-ui-managed.conf" >> /etc/unbound/unbound.conf
        log_success "Added include to unbound.conf"
    fi
}

# Install systemd services
install_services() {
    log_info "Installing systemd services..."
    
    # Get script directory (repo root)
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    # Copy service files
    cp "$script_dir/systemd/unbound-ui-backend.service" /etc/systemd/system/
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start backend service
    systemctl enable unbound-ui-backend
    systemctl start unbound-ui-backend
    
    log_success "Services installed and started"
}

# Setup permissions for unbound-control
setup_permissions() {
    log_info "Setting up permissions..."
    
    # Allow service user to read unbound control socket
    if [[ -f /etc/unbound/unbound_control.key ]]; then
        chgrp unbound /etc/unbound/unbound_control.key
        chmod 640 /etc/unbound/unbound_control.key
    fi
    
    if [[ -f /etc/unbound/unbound_control.pem ]]; then
        chgrp unbound /etc/unbound/unbound_control.pem
        chmod 640 /etc/unbound/unbound_control.pem
    fi
    
    # Ensure unbound is running
    systemctl enable unbound
    systemctl restart unbound
    
    log_success "Permissions configured"
}

# Run health check
run_healthcheck() {
    log_info "Running health check..."
    
    # Wait for service to start
    sleep 3
    
    local health_url="http://localhost:3000/api/health"
    local max_attempts=5
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            log_success "Health check passed!"
            return 0
        fi
        log_warn "Attempt $attempt failed, retrying..."
        sleep 2
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    log_warn "Check logs: journalctl -u unbound-ui-backend -f"
    return 1
}

# Print summary
print_summary() {
    local ip_address
    ip_address=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}Pusula installed successfully!${NC}"
    echo "========================================"
    echo ""
    echo -e "Access URL: ${BLUE}http://${ip_address}:3000${NC}"
    echo ""
    
    if [[ -f /tmp/pusula_initial_password ]]; then
        local password
        password=$(cat /tmp/pusula_initial_password)
        echo -e "Initial credentials:"
        echo -e "  Username: ${BLUE}goktugorgn${NC}"
        echo -e "  Password: ${YELLOW}${password}${NC}"
        echo ""
        echo -e "${RED}⚠ Save this password! It will not be shown again.${NC}"
        rm -f /tmp/pusula_initial_password
    fi
    
    echo ""
    echo "Useful commands:"
    echo "  View logs:     journalctl -u unbound-ui-backend -f"
    echo "  Restart:       systemctl restart unbound-ui-backend"
    echo "  Status:        systemctl status unbound-ui-backend"
    echo ""
}

# Main
main() {
    echo ""
    echo "========================================"
    echo "  Pusula Installer"
    echo "  Unbound DNS Management for Raspberry Pi"
    echo "========================================"
    echo ""
    
    check_root
    check_os
    install_dependencies
    install_nodejs
    create_user
    create_directories
    copy_application
    create_config
    setup_permissions
    install_services
    run_healthcheck || true
    print_summary
}

main "$@"
