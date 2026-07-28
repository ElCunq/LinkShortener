-- Link Shortener SaaS Schema for PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domains (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    hostname VARCHAR(255) UNIQUE NOT NULL,
    verification_token VARCHAR(255) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, active
    ssl_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS short_links (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    domain_id VARCHAR(36) REFERENCES domains(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    destination_url TEXT NOT NULL,
    redirect_type INT DEFAULT 302, -- 301 or 302
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    password_hash VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_domain_slug UNIQUE (domain_id, slug)
);

CREATE TABLE IF NOT EXISTS click_events (
    id VARCHAR(36) PRIMARY KEY,
    short_link_id VARCHAR(36) REFERENCES short_links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    country VARCHAR(10),
    device_type VARCHAR(50),
    browser VARCHAR(50),
    operating_system VARCHAR(50),
    referrer TEXT,
    ip_hash VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE NULL,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast lookups & analytical queries
CREATE INDEX IF NOT EXISTS idx_domains_hostname ON domains(hostname);
CREATE INDEX IF NOT EXISTS idx_short_links_lookup ON short_links(domain_id, slug);
CREATE INDEX IF NOT EXISTS idx_click_events_link ON click_events(short_link_id);

-- ════════════════════════════════════════════════════════════
-- SUPABASE AUTOMATED DATABASE WEBHOOK (pg_net Trigger)
-- ════════════════════════════════════════════════════════════
-- Enables real-time HTTP push to our backend whenever a click occurs
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_click_webhook()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://shorts.orfa.dev/api/v1/webhooks/clicks',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'click_events',
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_click_event_created ON click_events;
CREATE TRIGGER on_click_event_created
  AFTER INSERT ON click_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_click_webhook();

-- Register webhook in Supabase Studio UI (_webhooks table) so it shows in Dashboard
INSERT INTO public._webhooks (name, target_table, target_url, events, status)
VALUES (
  'click_events_webhook',
  'click_events',
  'https://shorts.orfa.dev/api/v1/webhooks/clicks',
  'INSERT',
  'active'
) ON CONFLICT DO NOTHING;

