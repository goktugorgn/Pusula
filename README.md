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

Kurulumdan sonra `pusula` komutu ile servisi yönetebilirsiniz:

```bash
# Servis durumunu göster
pusula status

# API sağlık kontrolü
pusula health

# Logları takip et
pusula logs backend

# Servisi yeniden başlat
sudo pusula restart

# Otomatik başlatmayı etkinleştir
sudo pusula autostart on
```

Tüm komutlar için: `pusula help`

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
