# Runbook

## Operational Procedures

This runbook provides step-by-step procedures for common operational scenarios.

---

## Startup Procedures

### Start All Services

```bash
sudo systemctl start unbound
sudo systemctl start cloudflared  # If using DoH
sudo systemctl start pusula
```

### Verify Startup

```bash
# Check service status
sudo systemctl status pusula unbound cloudflared

# Verify web UI
curl -k https://localhost:3000/api/health
```

---

## Shutdown Procedures

### Graceful Shutdown

```bash
sudo systemctl stop pusula
sudo systemctl stop cloudflared
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
grep "login_failure" /opt/pusula/logs/audit.log | tail -20

# Check rate limit
grep "rate_limited" /opt/pusula/logs/audit.log | tail -10

# Reset lockout (emergency)
sudo systemctl restart pusula
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
# Symptom: Backend can't run unbound-control
# Check sudoers file exists
ls -la /etc/sudoers.d/unbound-ui

# Validate sudoers syntax
sudo visudo -c -f /etc/sudoers.d/unbound-ui

# Test sudo access as unbound-ui
sudo -u unbound-ui sudo -n /usr/sbin/unbound-control status

# If fails, reinstall sudoers:
sudo cp /opt/pusula/../system/sudoers-unbound-ui /etc/sudoers.d/unbound-ui
sudo chmod 440 /etc/sudoers.d/unbound-ui
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
ls -la /opt/pusula/snapshots/

# Remove old snapshots (keep last 10)
cd /opt/pusula/snapshots
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
sudo systemctl restart unbound pusula
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
grep "login" /opt/pusula/logs/audit.log | tail -50

# Review config changes
grep "config_apply\|upstream_change" /opt/pusula/logs/audit.log
```

---

## Health Checks

### Quick Health Check

```bash
#!/bin/bash
echo "=== Pusula Health Check ==="

echo -n "Backend: "
curl -s -k https://localhost:3000/api/health | jq -r '.status // "DOWN"'

echo -n "Unbound: "
sudo unbound-control status | head -1

echo -n "DNS Test: "
dig +short example.com @127.0.0.1 || echo "FAILED"
```

---

## Related Documents

- [06-operations.md](06-operations.md) – General operations
- [05-security.md](05-security.md) – Security procedures
- [07-testing.md](07-testing.md) – Self-test details
