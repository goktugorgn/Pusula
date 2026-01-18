# Pusula Installation Guide

One-command DNS management for Raspberry Pi and Debian-based systems.

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/admin/pusula/main/scripts/install.sh | sudo bash
```

That's it! The installer will:

1. Install Node.js LTS and dependencies
2. Create the `unbound-ui` system user
3. Set up directories and permissions
4. Generate secure credentials
5. Build and install the application
6. Configure and start systemd services
7. Run a health check

## Prerequisites

| Requirement     | Version          | Notes                    |
| --------------- | ---------------- | ------------------------ |
| Raspberry Pi OS | 64-bit Bookworm+ | Or Debian 12+            |
| Unbound         | 1.17+            | Installed and configured |
| Memory          | 512MB+           | 1GB recommended          |

## Manual Installation

```bash
# Clone repository
git clone https://github.com/admin/pusula.git
cd pusula

# Run installer
sudo ./scripts/install.sh
```

## Post-Installation

After installation, you'll see:

```
==========================================
  Installation Complete!
==========================================

  Access Pusula at:
    http://192.168.1.50:3000

  Initial Credentials:
    Username: admin
    Password: admin

  ⚠️  IMPORTANT: Save this password!
```

## Verify Installation

```bash
sudo ./scripts/postinstall-healthcheck.sh
```

## Uninstall

```bash
# Keep config and backups
sudo ./scripts/uninstall.sh

# Remove everything
sudo ./scripts/uninstall.sh --purge
```

## Documentation

| Document                                                             | Contents                        |
| -------------------------------------------------------------------- | ------------------------------- |
| [docs/memorybank/06-operations.md](docs/memorybank/06-operations.md) | Service management, file layout |
| [docs/memorybank/09-runbook.md](docs/memorybank/09-runbook.md)       | Troubleshooting procedures      |
| [docs/memorybank/05-security.md](docs/memorybank/05-security.md)     | Security configuration          |

## Troubleshooting

### Common Issues

| Issue                 | Solution                                      |
| --------------------- | --------------------------------------------- |
| Port 3000 in use      | `sudo lsof -i :3000` then kill or change port |
| Permission denied     | Check `/etc/sudoers.d/unbound-ui` exists      |
| Unbound-control fails | Run `sudo unbound-control-setup`              |
| Node.js too old       | Upgrade via NodeSource LTS                    |

See [09-runbook.md](docs/memorybank/09-runbook.md) for detailed procedures.

## Support

- Issues: [GitHub Issues](https://github.com/admin/pusula/issues)
- Documentation: [docs/memorybank/](docs/memorybank/)
