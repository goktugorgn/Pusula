# Pusula 🧭

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi%20OS%20%7C%20Debian-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green?style=flat-square)
![Status](https://img.shields.io/badge/status-active-success?style=flat-square)
![LAN Only](https://img.shields.io/badge/network-LAN%20Only-informational?style=flat-square)
![Homelab](https://img.shields.io/badge/use--case-homelab-purple?style=flat-square)

**Raspberry Pi için Modern Unbound DNS Yönetim Arayüzü**

Pusula, Unbound DNS sunucunuzu Raspberry Pi üzerinde güvenli ve kolay bir şekilde yönetmeniz için tasarlanmış, LAN tabanlı bir web arayüzüdür. Doğrudan işletim sistemi üzerinde hafif ve performanslı çalışır.

---

## Özellikler

### Güvenli DNS Yönetimi

- **Çoklu Mod Desteği:**
  - **Recursive (Yinelemeli):** Kök sunuculardan doğrudan çözümleme (En yüksek gizlilik).
  - **DoT (DNS-over-TLS):** Şifreli DNS sorguları (otomatik port 853).
  - **DoH (DNS-over-HTTPS):** HTTPS üzerinden DNS (Cloudflared/Dnscrypt gerektirir).
- **Güvenli Uygulama (Safe Apply):** Yanlış bir konfigürasyon DNS servisinizi durdurmaz! Değişiklikler önce doğrulanır, test edilir, bir sorun varsa otomatik olarak **geri alınır (rollback)**.

### Modern Arayüz ve İzleme

- **Canlı Dashboard:** Saniyelik sorgu hızı, önbellek performansı (Cache Hit Rate) ve hataları izleyin.
- **Glassmorphism Tasarım:** Şık, modern ve hızlı tepki veren (responsive) arayüz.
- **Detaylı Loglar:** Unbound loglarını seviye (Error/Info) ve zamana göre filtreleyerek inceleyin.
- **Pi-hole Entegrasyonu:** Eğer sistemde Pi-hole varsa, istatistiklerini (engellenen reklamlar vb.) Pusula içinden görebilirsiniz (salt okunur).

### Güvenlik Odaklı

- **Tek Kullanıcı:** Ev kullanıcısı (Homelab) için optimize edilmiş, güvenli tek oturum.
- **Denetim Kayıtları (Audit Logs):** Kim, ne zaman, hangi ayarı değiştirdi? Tüm kritik işlemler kayıt altına alınır.
- **Kaba Kuvvet Koruması:** Üst üste hatalı girişlerde IP bazlı geçici engelleme.
- **Yetki Yönetimi:** "Least Privilege" prensibiyle çalışır; backend servisi sadece izin verilen komutları çalıştırabilir.

---

## 🛠️ Kurulum

Pusula, **Raspberry Pi OS (Bookworm ve üzeri)** veya **Debian 12+** sistemler için tasarlanmıştır.

### Hızlı Kurulum

Tek bir komutla tüm bağımlılıkları (Node.js, Unbound vb.) kurabilir ve servisi başlatabilirsiniz:

```bash
curl -fsSL https://raw.githubusercontent.com/goktugorgn/Pusula/refs/heads/main/scripts/install.sh | sudo bash
```

### Kurulum Sonrası

Kurulum tamamlandığında aşağıdaki gibi bir çıktı göreceksiniz:

```
  Access Pusula at:
    http://<RASPBERRY_PI_IP>:3000

  Initial Credentials:
    Username: admin
    Password: admin
```

Tarayıcınızdan `http://<IP_ADRESINIZ>:3000` adresine gidin ve giriş yapın.

> **Önemli:** İlk girişten sonra şifrenizi "Ayarlar" (Settings) menüsünden değiştirmeniz tavsiye edilir.

### Firewall (Güvenlik Duvarı)

Eğer `ufw` aktifse, port 3000'e izin vermeniz gerekir:

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

### Dosya Konumları

| Konum              | Açıklama                       |
| ------------------ | ------------------------------ |
| `/opt/pusula/`     | Uygulama dosyaları             |
| `/etc/pusula/`     | Konfigürasyon dosyaları        |
| `/var/lib/pusula/` | Veri (yedekler, upstream.json) |
| `/var/log/pusula/` | Log dosyaları                  |

---

## Geliştirme (Local Development)

Projeyi macOS veya Linux üzerinde, Raspberry Pi olmadan geliştirmek için **DEV Modu** mevcuttur. Bu modda sistem servisleri (systemd, unbound-control) taklit edilir (mock).

### Gereksinimler

- Node.js 18+
- npm

### Başlangıç

1.  **Repoyu klonlayın:**

    ```bash
    git clone https://github.com/goktugorgun/pusula.git
    cd pusula
    ```

2.  **Dev ortamını hazırlayın:**

    ```bash
    ./scripts/setup-local-dev.sh
    ```

3.  **Backend'i başlatın:**

    ```bash
    cd apps/backend
    cp .env.dev .env
    npm install
    npm run dev
    ```

4.  **Arayüzü (UI) başlatın:**
    Yeni bir terminalde:

    ```bash
    cd apps/ui
    npm install
    npm run dev
    ```

5.  Tarayıcıda `http://localhost:5173` adresine gidin.
    - Kullanıcı: `admin`
    - Şifre: `admin`

---

## CLI Kullanımı

Pusula, terminal üzerinden servis yönetimi için bir CLI aracı sunar. Bu araç kurulum sırasında `/usr/local/bin/pusula` konumuna otomatik olarak yüklenir, `pusula` komutu ile servisi yönetebilirsiniz

### Komutlar

| Komut                      | Açıklama                                                        | Root Gerekli |
| -------------------------- | --------------------------------------------------------------- | ------------ |
| `pusula status`            | Tüm servislerin durumunu gösterir (Backend, Unbound, DoH Proxy) | ❌           |
| `pusula health`            | API sağlık kontrolü yapar (`/api/health` endpoint)              | ❌           |
| `pusula logs [hedef]`      | Logları canlı takip eder                                        | ❌           |
| `pusula version`           | Sürüm bilgilerini gösterir                                      | ❌           |
| `pusula start`             | Backend servisini başlatır                                      | ✅           |
| `pusula stop`              | Backend servisini durdurur                                      | ✅           |
| `pusula restart`           | Backend servisini yeniden başlatır                              | ✅           |
| `pusula autostart on\|off` | Otomatik başlatmayı açar/kapatır                                | ✅           |

### Log Hedefleri

`pusula logs` komutu aşağıdaki hedefleri destekler:

- `backend` veya `b` - Pusula backend logları
- `unbound` veya `u` - Unbound DNS logları
- `proxy` veya `p` - DoH Proxy logları
- `audit` veya `a` - Güvenlik denetim logları

### Örnekler

```bash
# Servis durumunu göster
pusula status

# API sağlık kontrolü
pusula health

# Backend loglarını canlı takip et
pusula logs backend

# Servisi yeniden başlat
sudo pusula restart

# Otomatik başlatmayı etkinleştir
sudo pusula autostart on

# Sürüm bilgisini göster
pusula version
```

Tüm komutlar için: `pusula help`

---

## Sorun Giderme

### LAN'dan Erişilemiyor

1. **Servis çalışıyor mu?**

   ```bash
   sudo systemctl status pusula-backend
   ```

2. **Port dinleniyor mu?**

   ```bash
   sudo ss -tulpn | grep 3000
   ```

   `0.0.0.0:3000` veya `*:3000` görmeniz gerekir. Sadece `127.0.0.1:3000` görüyorsanız, `/etc/pusula/config.yaml` dosyasında `host: "0.0.0.0"` ayarlayın.

3. **Firewall açık mı?**
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   ```

### Servis Başlamıyor

```bash
# Hata loglarını görüntüle
sudo journalctl -u pusula-backend -n 50

# Manuel test
cd /opt/pusula/current/backend
sudo -u pusula node dist/index.js
```

### Yaygın Hatalar

| Hata                    | Çözüm                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `EADDRINUSE`            | Port 3000 başka bir işlem tarafından kullanılıyor. `sudo lsof -i :3000` ile kontrol edin. |
| `credentials not found` | `/etc/pusula/credentials.json` dosyası eksik veya okunamıyor.                             |
| `JWT_SECRET missing`    | `/etc/pusula/pusula.env` dosyasında `JWT_SECRET` tanımlı değil.                           |

---

## Dokümantasyon

Projenin teknik detayları `docs/memorybank` klasöründe "Single Source of Truth" (SSOT) olarak tutulmaktadır:

- **Mimari:** [docs/memorybank/02-architecture.md](docs/memorybank/02-architecture.md)
- **Güvenlik:** [docs/memorybank/05-security.md](docs/memorybank/05-security.md)
- **Operasyon & Sorun Giderme:** [docs/memorybank/09-runbook.md](docs/memorybank/09-runbook.md)
- **Değişiklik Günlüğü:** [docs/memorybank/10-changelog.md](docs/memorybank/10-changelog.md)

---

## Lisans

Bu proje MIT lisansı ile lisanslanmıştır.
