export interface User {
  id: string;
  email: string;
  password_hash: string;
  status: 'active' | 'suspended';
  created_at: Date | string;
}

export interface Domain {
  id: string;
  user_id: string;
  hostname: string;
  verification_token: string;
  verification_status: 'pending' | 'active' | 'failed';
  ssl_status: 'pending' | 'active' | 'failed';
  created_at: Date | string;
}

export interface ShortLink {
  id: string;
  user_id: string;
  domain_id: string;
  slug: string;
  destination_url: string;
  redirect_type: number; // 301 | 302
  is_active: boolean;
  expires_at?: Date | string | null;
  password_hash?: string | null;
  created_at: Date | string;
}

export interface ClickEvent {
  id: string;
  short_link_id: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  country?: string;
  device_type?: string;
  browser?: string;
  created_at: Date | string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  expires_at: Date | string;
  created_at: Date | string;
}
