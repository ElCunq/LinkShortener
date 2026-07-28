# Custom Domain Link Shortener SaaS (Dual Microservice Architecture)

Özel domain destekli, yüksek performanslı, güvenli ve White-Label (markadan bağımsız) URL kısaltma SaaS altyapısı. Çift mikro-servis mimarisi (`admin-panel` ve `shortener-engine`) sayesinde yönetim paneli ve link yönlendirici tamamen izole çalışır.

---

## 🌟 Öne Çıkan Özellikler

- 🏢 **Çift Mikro-Servis Mimarisi (Dual Architecture)**:
  - **`admin-panel`**: Web arayüzü, Giriş/Kayıt, API Key üretimi, İstatistikler.
  - **`shortener-engine`**: Sadece 301/302 yönlendirmesi yapar. Kısaltma domaininden admin paneline erişilemez (güvenli 404 isolasyonu).
- 🔗 **%100 Deploysuz Özel Domain Desteği**: Müşterileriniz kendi subdomainlerini (örn: `link.sirket.com`) CNAME olarak yönlendirir. Yeni müşteri domainleri için **asla sunucuyu yeniden başlatmaya veya Coolify'da deploy yapmaya gerek kalmaz.**
- 🛡️ **DNS Sahiplik Doğrulaması**: CNAME ve TXT kaydı (`_shortlink-verification.<domain>`) sorgulayarak domain sahipliğini otomatik doğrulama.
- ⚡ **Canlı Akışlı Tıklama Analitiği (Live Stream)**: Tıklama sayıları, cihazlar, tarayıcılar ve yönlendiren siteler (referrer) sayfa yenilenmeden 5 saniyede bir canlı güncellenir.
- 🔐 **Esnek Kimlik Doğrulama**: JWT (Access + Refresh Token) ve Canlı API Key (`sl_live_...`) desteği (API Key'ler SHA-256 ile saklanır).
- 📱 **Entegre QR Kod Oluşturucu**: Her kısa link için anında yüksek çözünürlüklü QR kod üretimi ve PNG olarak indirme.
- 🛡️ **Siber Güvenlik & Anti-SSRF**: Sadece `http://` ve `https://` protokollerine izin verilir. `javascript:`, `data:`, `localhost` ve özel IP blokları (127.0.0.1, 10.x, 192.168.x) otomatik engellenir.

---

## 🚀 Coolify Sıfır-Ayar Kurulum Rehberi

Proje **Coolify** üzerinde `docker-compose.yml` ile doğrudan ayağa kaldırılır.

### Coolify FQDN (Domains) Yapılandırması
Coolify panelinde uygulamanın **Domains (FQDN)** alanına 2 domaininizi yazmanız yeterlidir:

```
https://shorts.orfa.dev,https://go.orfa.dev
```

- **1. Domain (`shorts.orfa.dev`)** → `admin-panel` (Yönetim Paneli) olarak otomatik atanır.
- **2. Domain (`go.orfa.dev`)** → `shortener-engine` (Kısaltma Servisi) olarak otomatik atanır.

*Ortam değişkenlerinde (Environment Variables) hiçbir hardcoded domain saklanmaz.*

---

## 💻 Yerel Geliştirme (Local Setup)

### 1. Bağımlılıkların Yüklenmesi
```bash
npm install
```

### 2. Derleme & Test
```bash
# TypeScript Derleme
npm run build

# Entegrasyon Testleri (19 Test PASSED)
npm test
```

---

## 📑 REST API Dokümantasyonu

Tüm API isteklerinizi canlı API anahtarınız ile atabilirsiniz:

```http
Authorization: Bearer sl_live_hesap_anahtariniz
```

### Örnek cURL Kullanımları

#### 1. Kısa Link Oluşturma
```bash
curl -X POST https://shorts.orfa.dev/api/v1/links \
  -H "Authorization: Bearer sl_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com","slug":"github"}'
```

#### 2. Tıklama Analitiği Alma
```bash
curl -X GET https://shorts.orfa.dev/api/v1/links/lnk_xyz/analytics \
  -H "Authorization: Bearer sl_live_YOUR_KEY"
```

#### 3. Özel Domain Ekleme
```bash
curl -X POST https://shorts.orfa.dev/api/v1/domains \
  -H "Authorization: Bearer sl_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"link.sirketiniz.com"}'
```

#### 4. Domain Listesini Çekme
```bash
curl -X GET https://shorts.orfa.dev/api/v1/domains \
  -H "Authorization: Bearer sl_live_YOUR_KEY"
```

#### 5. Domain DNS Doğrulaması Başlatma
```bash
curl -X POST https://shorts.orfa.dev/api/v1/domains/dom_xyz/verify \
  -H "Authorization: Bearer sl_live_YOUR_KEY"
```

#### 6. QR Kodu Üretme (Base64 PNG)
```bash
curl -X GET https://shorts.orfa.dev/api/v1/links/lnk_xyz/qrcode \
  -H "Authorization: Bearer sl_live_YOUR_KEY"
```

#### 7. Kısa Link Silme
```bash
curl -X DELETE https://shorts.orfa.dev/api/v1/links/lnk_xyz \
  -H "Authorization: Bearer sl_live_YOUR_KEY"
```

#### 8. Canlı API Key Üretme
```bash
curl -X POST https://shorts.orfa.dev/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_JWT_OR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunucu Entegrasyonu"}'
```

---

## 📁 Proje Yapısı

```text
├── Dockerfile           # Multi-Stage önbellekli Docker imajı
├── docker-compose.yml   # Coolify çift servis yapılandırması
├── public/              # Web Dashboard UI, CSS ve dinamik JavaScript
│   ├── index.html       # Yönetim Paneli & API Rehberi HTML
│   └── app.js           # Canlı akış ve istemci mantığı
├── src/
│   ├── app.ts           # Dual-mode Express uygulaması
│   ├── server.ts        # Sunucu başlatıcı
│   ├── db/              # Veritabanı bağlantısı ve schema.sql
│   ├── middleware/      # JWT & API Key auth middleware
│   ├── routes/          # Auth, Domains, Links, API Keys endpoint'leri
│   └── services/        # Data, DNS, Security, QR ve Redirect servisleri
└── tests/               # Entegrasyon ve güvenlik testleri
```
