# Runbook

## Operational Procedures

This runbook provides step-by-step procedures for common operational scenarios.

---

## Startup Procedures

### Start All Services

```bash
sudo systemctl start unbound
sudo systemctl start unbound-ui-doh-proxy  # If using DoH
sudo systemctl start unbound-ui-backend
```

### Verify Startup

```bash
# Check service status
sudo systemctl status unbound-ui-backend unbound

# Verify web UI
curl -k https://localhost:3000/api/health
```

---

## Shutdown Procedures

### Graceful Shutdown

```bash
sudo systemctl stop unbound-ui-backend
sudo systemctl stop unbound-ui-doh-proxy  # If enabled
sudo systemctl stop unbound
```

> [!WARNING]
> Stopping Unbound will disrupt DNS resolution for all LAN clients.

---

## Configuration Changes

### Safe Apply Procedure

1. Make changes via UI
2. UI triggers: Snapshot → Validate → Apply → Self-Test
3. If self-test fails, automatic rollback occurs
4. Review audit log for confirmation

### Manual Config Apply

```bash
# 1. Create snapshot
sudo cp /etc/unbound/unbound.conf.d/10-forward.conf \
  /opt/pusula/snapshots/$(date +%Y%m%dT%H%M%S)_forward.conf

# 2. Edit configuration
sudo nano /etc/unbound/unbound.conf.d/10-forward.conf

# 3. Validate
sudo unbound-checkconf

# 4. Apply
sudo unbound-control reload

# 5. Test
dig example.com @127.0.0.1
```

### Rollback Procedure

```bash
# 1. List snapshots
ls -la /opt/pusula/snapshots/

# 2. Restore snapshot
sudo cp /opt/pusula/snapshots/<timestamp>_forward.conf \
  /etc/unbound/unbound.conf.d/10-forward.conf

# 3. Validate and reload
sudo unbound-checkconf && sudo unbound-control reload
```

---

## Troubleshooting

### Unbound Not Responding

```bash
# Check status
sudo systemctl status unbound

# Check logs
sudo journalctl -u unbound -n 50

# Test control socket
sudo unbound-control status

# Restart if necessary
sudo systemctl restart unbound
```

### High SERVFAIL Rate

```bash
# Check upstream connectivity
dig @1.1.1.1 example.com +tcp +tls  # For DoT
curl -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=example.com"  # For DoH

# Check Unbound stats
sudo unbound-control stats_noreset | grep servfail

# Run self-test
curl -X POST https://localhost:3000/api/self-test \
  -H "Authorization: Bearer $TOKEN"
```

### Cannot Login

```bash
# Check for lockout
grep "login_failure" /var/log/unbound-ui/audit.log | tail -20

# Check rate limit
grep "rate_limited" /var/log/unbound-ui/audit.log | tail -10

# Reset lockout (emergency)
sudo systemctl restart unbound-ui-backend
```

### Backend Not Starting

```bash
# Check logs
sudo journalctl -u unbound-ui-backend -n 100

# Common issues:
# - Port already in use: lsof -i :3000
# - Config error: Check /etc/unbound-ui/config.yaml
# - Permission error: Check file ownership

# Validate config syntax
cat /etc/unbound-ui/config.yaml | head -20
```

### Permission Denied (sudo -n)

```bash
# Symptom: Backend can't run unbound-control / Dashboard shows empty data
# Check sudoers file exists
ls -la /etc/sudoers.d/pusula

# Validate sudoers syntax
sudo visudo -c -f /etc/sudoers.d/pusula

# Test sudo access as pusula user
sudo -u pusula sudo -n /usr/sbin/unbound-control status

# If fails, re-run installer to reinstall sudoers:
sudo ./scripts/install.sh --upgrade
```

### Unbound-Control Certificate Errors

```bash
# Symptom: "SSL handshake failed" or "connection refused"

# Check if unbound-control is enabled
grep -A 3 "remote-control:" /etc/unbound/unbound.conf

# Should have:
# remote-control:
#   control-enable: yes
#   control-interface: 127.0.0.1

# Regenerate control keys if needed
sudo unbound-control-setup
sudo systemctl restart unbound

# Test
sudo unbound-control status
```

### Port 3000 Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000
# or
sudo ss -tlnp | grep :3000

# Kill the process (if appropriate)
sudo kill <PID>

# Or change Pusula port in config
sudo nano /etc/unbound-ui/config.yaml
# Change: port: 3001

sudo systemctl restart unbound-ui-backend
```

### Node.js Version Too Old

```bash
# Check version
node --version  # Should be v18+

# Upgrade via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt-get install -y nodejs

# Verify
node --version
```

---

## Maintenance

### Log Rotation

Logs rotate automatically via logrotate:

```bash
# Manual rotation
sudo logrotate -f /etc/logrotate.d/pusula
```

### Clear DNS Cache

```bash
# Via UI: Dashboard → Flush Cache

# Via CLI
sudo unbound-control flush_zone .
```

### Cleanup Snapshots

```bash
# List snapshots
ls -la /var/lib/unbound-ui/backups/

# Remove old snapshots (keep last 10)
cd /var/lib/unbound-ui/backups
ls -t | tail -n +11 | xargs rm -f
```

---

## Disaster Recovery

### Complete Reinstall

```bash
# 1. Backup current config
sudo tar -czf /tmp/pusula-backup.tar.gz \
  /opt/pusula/config \
  /opt/pusula/snapshots \
  /etc/unbound/unbound.conf.d

# 2. Reinstall
curl -fsSL https://raw.githubusercontent.com/goktugorgn/pusula/main/install.sh | sudo bash

# 3. Restore config
sudo tar -xzf /tmp/pusula-backup.tar.gz -C /

# 4. Restart services
sudo systemctl restart unbound unbound-ui-backend
```

### Password Reset

```bash
# Generate new password hash using bcrypt
NEW_PASSWORD="your-new-password"
node -e "const bcrypt=require('bcrypt'); \
  console.log(bcrypt.hashSync('$NEW_PASSWORD', 12))"

# Update credentials file
sudo nano /etc/unbound-ui/credentials.json
# Replace passwordHash value

# Restart backend
sudo systemctl restart unbound-ui-backend
```

---

## Security Incident Response

### Suspected Unauthorized Access

1. **Isolate**: Disable network access to Pusula port
2. **Review**: Check audit log for suspicious activity
3. **Reset**: Change password immediately
4. **Analyze**: Review all recent config changes
5. **Restore**: Rollback to known-good snapshot if needed

```bash
# Review recent login attempts
grep "login" /var/log/unbound-ui/audit.log | tail -50

# Review config changes
grep "config_apply\|upstream_change" /var/log/unbound-ui/audit.log
```

---

## Health Checks

### Quick Smoke Test Checklist

After installation or updates, run these checks to verify the system is working:

```bash
#!/bin/bash
# Save as: /opt/pusula/smoke-test.sh

echo "=== Pusula Smoke Test ==="
echo ""

# 1. Service status
echo "1. Service Status:"
echo -n "   Backend:  "
systemctl is-active unbound-ui-backend 2>/dev/null || echo "NOT RUNNING"

echo -n "   Unbound:  "
systemctl is-active unbound 2>/dev/null || echo "NOT RUNNING"
echo ""

# 2. Health endpoint
echo "2. Health Endpoint:"
echo -n "   HTTP API: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health && echo " OK" || echo " FAILED"
echo ""

# 3. DNS resolution
echo "3. DNS Resolution:"
echo -n "   Query:    "
dig +short example.com @127.0.0.1 | head -1 || echo "FAILED"
echo ""

# 4. Unbound control
echo "4. Unbound Control:"
echo -n "   Status:   "
sudo unbound-control status 2>/dev/null | head -1 || echo "FAILED"
echo ""

# 5. File permissions
echo "5. File Permissions:"
echo -n "   Config:   "
[ -r /etc/unbound-ui/config.yaml ] && echo "OK" || echo "NOT READABLE"
echo -n "   Creds:    "
[ -f /etc/unbound-ui/credentials.json ] && echo "OK" || echo "MISSING"
echo ""

echo "=== Smoke Test Complete ==="
```

### Manual Verification Steps

| Check            | Command                                                | Expected    |
| ---------------- | ------------------------------------------------------ | ----------- |
| Backend running  | `systemctl is-active unbound-ui-backend`               | `active`    |
| Unbound running  | `systemctl is-active unbound`                          | `active`    |
| Health endpoint  | `curl -s localhost:3000/api/health \| jq .data.status` | `"healthy"` |
| DNS working      | `dig +short example.com @127.0.0.1`                    | IP address  |
| Login page loads | Open `http://<pi-ip>:3000` in browser                  | Login form  |

---

## Local DEV Troubleshooting (macOS)

### DEV Mode Not Activating

```bash
# Symptom: Backend tries to execute real commands
# Check: Verify environment variable is set
echo $UNBOUND_UI_ENV  # Should be "dev"

# Solution: Ensure .env file is loaded
cd apps/backend
cat .env | grep UNBOUND_UI_ENV
# Should show: UNBOUND_UI_ENV=dev

# If using npm run dev, ensure dotenv is loading first
```

### Missing .local-dev Directory

```bash
# Symptom: "ENOENT: config.yaml not found"
# Solution: Run setup script
./scripts/setup-local-dev.sh

# Or create manually
mkdir -p .local-dev/etc/unbound-ui
mkdir -p .local-dev/var/lib/unbound-ui/backups
mkdir -p .local-dev/var/log/unbound-ui
```

### Port 3000 Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill process or change port
export PORT=3001
npm run dev
```

### Login Failing with 401

```bash
# Symptom: Cannot login in DEV mode
# Check credentials.json exists and has valid format
cat .local-dev/etc/unbound-ui/credentials.json

# Default dev credentials:
# Username: admin
# Password: admin

# Regenerate if needed
./scripts/setup-local-dev.sh --reset-credentials
```

### Mock Data Not Loading

```bash
# Check mock data fixtures exist
ls -la apps/backend/mock-data/

# Verify file contents
cat apps/backend/mock-data/unbound-control/status.txt
```

### UI Cannot Connect to Backend

```bash
# Check backend is running
curl http://localhost:3000/api/health

# Check Vite proxy configuration (apps/ui/vite.config.ts)
# Ensure /api proxies to localhost:3000

# Alternative: set explicit API URL
VITE_API_BASE_URL=http://localhost:3000/api npm run dev
```

---

## Related Documents

- [06-operations.md](06-operations.md) – General operations
- [05-security.md](05-security.md) – Security procedures
- [07-testing.md](07-testing.md) – Self-test details
