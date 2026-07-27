# Custom Domain Link Shortener API & Service

Özel domain destekli, performanslı ve güvenli URL kısaltma SaaS API ve Yönlendirme Servisi. Sunucunuzda barındırılan Supabase / PostgreSQL veritabanı (`db.orfa.dev`) ile entegre çalışır.

---

## 🌟 Öne Çıkan Özellikler

- 🔗 **Özel Domain Desteği**: Kullanıcıların kendi alt alan adlarını (örn. `go.kullanici.com`) bağlayabilmesi.
- 🛡️ **DNS Sahiplik Doğrulaması**: CNAME ve TXT kaydı (`_shortlink-verification.<domain>`) sorgulayarak domain sahipliğini otomatik olarak doğrulama.
- ⚡ **Yüksek Performanslı Yönlendirme**: Önceden önbelleğe alınmış URL bilgileriyle milisaniyeler içinde `301` veya `302` HTTP yönlendirmesi.
- 🔐 **Gelişmiş Kimlik Doğrulama**: JWT (Access + Refresh Token) ve Canlı API Key (`sl_live_...`) desteği (API Key'ler SHA-256 ile hash'lenerek saklanır).
- 📊 **Detaylı Tıklama Analitiği**: Tıklama sayıları, yönlendiren siteler (referrer), tarayıcı, işletim sistemi ve cihaz türü istatistikleri.
- 🛡️ **Siber Güvenlik & Anti-SSRF**: Sadece `http://` ve `https://` protokollerine izin verilir. `javascript:`, `data:`, `localhost` ve özel IP blokları (127.0.0.1, 10.x, 192.168.x) otomatik engellenir. IP adresleri anonimleştirilerek saklanır.

---

## 🚀 Kurulum ve Çalıştırma Rehberi

### 1. Gereksinimler
- **Node.js**: v18 veya üzeri (Node v26 test edilmiştir)
- **Veritabanı**: Supabase / PostgreSQL (`db.orfa.dev`)

### 2. Bağımlılıkların Yüklenmesi
```bash
npm install
```

### 3. Ortam Değişkenlerinin Yapılandırılması (`.env`)
`https://db.orfa.dev/project/link-shortener` (Supabase Studio) panelinizde **Project Settings -> Database** bölümüne giderek bağlantı bilgilerinizi alın ve projedeki `.env` dosyasını doldurun:

```env
PORT=3000
NODE_ENV=development

# Supabase / PostgreSQL Veritabanı Bağlantısı
DB_HOST=db.orfa.dev
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=supabase_veritabani_sifreniz
DB_NAME=postgres
DB_SSL=true

# JWT Gizli Anahtarları
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key
JWT_REFRESH_EXPIRES_IN=7d

# Domain ve CNAME Yapılandırması
CNAME_TARGET=domains.shortlink-service.com
SYSTEM_DOMAIN=go.orfa.dev
```

### 4. Veritabanı Tablolarının Oluşturulması (Supabase SQL Editor)
Supabase PostgREST API üzerinden ham SQL komutları doğrudan çalıştırılamaz (`PGRST202` hatası almamak için):

1. `https://db.orfa.dev/project/link-shortener` adresine gidin.
2. Sol menüden **SQL Editor** sekmesini açın.
3. Projedeki [`src/db/schema.sql`](file:///home/cunq/Desktop/LinkShortener/src/db/schema.sql) dosyasının içeriğini kopyalayıp yapıştırın ve **Run** (Çalıştır) butonuna basın.

### 5. Geliştirme Modunda Çalıştırma
```bash
npm run dev
```

### 6. Üretim (Production) Derlemesi ve Çalıştırma
```bash
npm run build
npm start
```

### 7. Entegrasyon Testlerini Çalıştırma
```bash
npm test
```

---

## 📑 API Kullanım Örnekleri

### 1. Kullanıcı Kaydı ve Giriş
- **Kayıt**: `POST /api/v1/auth/register`
  ```json
  {
    "email": "kullanici@orfa.dev",
    "password": "GuvenliSifre123!"
  }
  ```
- **Giriş**: `POST /api/v1/auth/login`

### 2. Domain Ekleme ve Doğrulama
- **Domain Ekle**: `POST /api/v1/domains`
  ```json
  {
    "hostname": "go.orfa.dev"
  }
  ```
  *Yanıt olarak eklenmesi gereken CNAME ve TXT DNS kayıtları döner.*
- **DNS Doğrula**: `POST /api/v1/domains/:id/verify`

### 3. Kısa Link Oluşturma
- **Link Oluştur**: `POST /api/v1/links`
  ```json
  {
    "domain_id": "dom_123456",
    "destination_url": "https://github.com/torvalds/linux",
    "custom_slug": "github",
    "redirect_type": 302
  }
  ```

### 4. API Key İle İstek Atma
```http
GET /api/v1/links
Authorization: Bearer sl_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📁 Proje Yapısı

```text
├── apiDocumentation.txt # Detaylı API dokümantasyonu
├── memory_bank/         # Proje hafızası ve süreç dökümantasyonu
├── src/
│   ├── app.ts           # Express uygulaması ve Yönlendirme motoru
│   ├── server.ts        # Sunucu başlatıcı
│   ├── db/              # Veritabanı bağlantısı ve schema.sql
│   ├── middleware/      # Auth (JWT ve API Key) middleware
│   ├── routes/          # Auth, Domains, Links ve API Keys endpoint'leri
│   └── services/        # Data, DNS, Security ve Redirect servisleri
└── tests/               # Jest entegrasyon testleri
```
