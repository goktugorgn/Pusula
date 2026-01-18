#!/bin/bash
# =============================================================================
# Setup Local Development Environment
# Creates .local-dev/ directory structure with default configs
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_DEV="$REPO_ROOT/.local-dev"

echo "=== Pusula Local DEV Setup ==="
echo ""

# Create directory structure
echo "Creating .local-dev/ directory structure..."
mkdir -p "$LOCAL_DEV/etc/unbound-ui"
mkdir -p "$LOCAL_DEV/etc/unbound"
mkdir -p "$LOCAL_DEV/var/lib/unbound-ui/backups"
mkdir -p "$LOCAL_DEV/var/log/unbound-ui"

# Generate bcrypt hash for 'admin' password
# Using Node.js since bcrypt is available in the backend
echo "Generating credentials..."
BCRYPT_HASH=$(cd "$REPO_ROOT/apps/backend" && node -e "
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('admin', 12);
console.log(hash);
" 2>/dev/null || echo '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.HB9XdOMhq6z6Hy')

# Create credentials.json
cat > "$LOCAL_DEV/etc/unbound-ui/credentials.json" << EOF
{
  "username": "admin",
  "passwordHash": "$BCRYPT_HASH"
}
EOF
echo "  Created credentials.json (username: admin, password: admin)"

# Create config.yaml
cat > "$LOCAL_DEV/etc/unbound-ui/config.yaml" << 'EOF'
# Pusula DEV Mode Configuration
server:
  host: "0.0.0.0"
  port: 3000

# Pi-hole integration (disabled in DEV)
pihole:
  enabled: false
  baseUrl: "http://localhost"
  apiToken: ""

# Unbound paths (unused in DEV, mocked)
unbound:
  managedIncludePath: ".local-dev/etc/unbound/unbound-ui-managed.conf"
EOF
echo "  Created config.yaml"

# Create upstream.json with default DoT mode
cat > "$LOCAL_DEV/var/lib/unbound-ui/upstream.json" << 'EOF'
{
  "mode": "dot",
  "dotProviders": [
    {
      "name": "Cloudflare",
      "address": "1.1.1.1",
      "port": 853,
      "hostname": "cloudflare-dns.com",
      "enabled": true
    },
    {
      "name": "Cloudflare Secondary",
      "address": "1.0.0.1",
      "port": 853,
      "hostname": "cloudflare-dns.com",
      "enabled": true
    }
  ],
  "dohProxyPort": 5053,
  "dohUpstream": "https://cloudflare-dns.com/dns-query"
}
EOF
echo "  Created upstream.json (DoT mode with Cloudflare)"

# Create empty alerts.json
echo "[]" > "$LOCAL_DEV/var/lib/unbound-ui/alerts.json"
echo "  Created alerts.json (empty)"

# Create managed.conf placeholder
cat > "$LOCAL_DEV/etc/unbound/unbound-ui-managed.conf" << 'EOF'
# Pusula Managed Configuration (DEV Mode)
# This file would be written by Pusula in production
# In DEV mode, this is a placeholder

# forward-zone:
#   name: "."
#   forward-tls-upstream: yes
#   forward-addr: 1.1.1.1@853#cloudflare-dns.com
#   forward-addr: 1.0.0.1@853#cloudflare-dns.com
EOF
echo "  Created unbound-ui-managed.conf placeholder"

# Initialize empty audit log
touch "$LOCAL_DEV/var/log/unbound-ui/audit.log"
echo "  Created audit.log"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Directory structure:"
echo "  $LOCAL_DEV/"
echo "  ├── etc/unbound-ui/"
echo "  │   ├── config.yaml"
echo "  │   └── credentials.json"
echo "  ├── etc/unbound/"
echo "  │   └── unbound-ui-managed.conf"
echo "  └── var/"
echo "      ├── lib/unbound-ui/"
echo "      │   ├── upstream.json"
echo "      │   ├── alerts.json"
echo "      │   └── backups/"
echo "      └── log/unbound-ui/"
echo "          └── audit.log"
echo ""
echo "Next steps:"
echo "  1. cd apps/backend"
echo "  2. cp .env.dev .env"
echo "  3. npm run dev"
echo ""
echo "Login credentials: admin / admin"
