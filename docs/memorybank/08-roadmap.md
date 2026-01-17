# Roadmap

## Version Planning

### Current: v0.x (Development)

Focus: Core functionality and stability.

---

## v1.0 – Initial Release

**Target:** Production-ready homelab deployment

### Features

- [x] User authentication with rate limiting
- [ ] Password change via UI
- [ ] Dashboard with real-time stats
- [ ] Resolver mode switching (Recursive / DoT / DoH)
- [ ] Upstream provider management
- [ ] Safe apply workflow with rollback
- [ ] Self-test engine
- [ ] Alerting system
- [ ] Pi-hole integration (read-only)
- [ ] Audit logging
- [ ] One-command installer

### Quality

- [ ] Unit test coverage > 80%
- [ ] Integration tests for all endpoints
- [ ] Documentation complete
- [ ] Security review completed

---

## v1.1 – Polish & Stability

**Target:** Improved user experience

### Features

- [ ] Log viewer with advanced filters
- [ ] Alert notification via email/webhook
- [ ] Theme customization (dark/light)
- [ ] Config export/import
- [ ] Scheduled cache flush

### Improvements

- [ ] Performance optimization
- [ ] Mobile-responsive UI improvements
- [ ] Accessibility enhancements

---

## v1.2 – Extended Integrations

**Target:** Broader ecosystem support

### Features

- [ ] Multiple DoH proxy support
- [ ] DNS blocklist management (via Unbound)
- [ ] Query log analysis (local)
- [ ] Grafana dashboard export

---

## v2.0 – Future Vision

**Target:** Advanced features (tentative)

### Potential Features

- [ ] Multi-site management (multiple Pi nodes)
- [ ] Backup to remote storage
- [ ] REST API for external automation
- [ ] Plugin system for extensions

> [!NOTE]
> v2.0 features are exploratory and subject to change based on community feedback.

---

## Non-Goals

The following are explicitly **not planned**:

| Item                   | Reason                               |
| ---------------------- | ------------------------------------ |
| Docker support         | Project scope is bare-metal Pi       |
| Multi-user RBAC        | Homelab single-admin model           |
| WAN access             | Security risk, use VPN instead       |
| Pi-hole config changes | Out of scope, Pi-hole has its own UI |

---

## Contributing

Feature requests and contributions welcome via GitHub issues.

---

## Related Documents

- [00-context.md](00-context.md) – Project scope
- [01-requirements.md](01-requirements.md) – Current requirements
- [10-changelog.md](10-changelog.md) – Release history
