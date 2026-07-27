import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const dbHost = process.env.DB_HOST || 'db.orfa.dev';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'postgres';
const useSSL = process.env.DB_SSL === 'true';

export const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 3000
});

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

const MEMORY_DB_FILE = path.join(__dirname, '../../.memory_db.json');

// Persistent memory store with local JSON disk backup to survive server restarts
class MemoryDb {
  users: Map<string, any> = new Map();
  domains: Map<string, any> = new Map();
  shortLinks: Map<string, any> = new Map();
  clickEvents: Map<string, any> = new Map();
  apiKeys: Map<string, any> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  saveToDisk() {
    try {
      const data = {
        users: Array.from(this.users.entries()),
        domains: Array.from(this.domains.entries()),
        shortLinks: Array.from(this.shortLinks.entries()),
        clickEvents: Array.from(this.clickEvents.entries()),
        apiKeys: Array.from(this.apiKeys.entries())
      };
      fs.writeFileSync(MEMORY_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save memoryDb to disk:', err);
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(MEMORY_DB_FILE)) {
        const raw = fs.readFileSync(MEMORY_DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.users) this.users = new Map(data.users);
        if (data.domains) this.domains = new Map(data.domains);
        if (data.shortLinks) this.shortLinks = new Map(data.shortLinks);
        if (data.clickEvents) this.clickEvents = new Map(data.clickEvents);
        if (data.apiKeys) this.apiKeys = new Map(data.apiKeys);
      }
    } catch (err) {
      console.error('Failed to load memoryDb from disk:', err);
    }
  }

  clear() {
    this.users.clear();
    this.domains.clear();
    this.shortLinks.clear();
    this.clickEvents.clear();
    this.apiKeys.clear();
    if (fs.existsSync(MEMORY_DB_FILE)) {
      try { fs.unlinkSync(MEMORY_DB_FILE); } catch {}
    }
  }
}

export const memoryDb = new MemoryDb();

let isPostgresConnected = false;

export async function checkDbConnection(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(`✅ Live Supabase REST API connected at ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    return true;
  }

  try {
    const client = await pool.connect();
    client.release();
    isPostgresConnected = true;
    console.log(`✅ Successfully connected to PostgreSQL database at ${dbHost}:${dbPort}`);
    return true;
  } catch (err: any) {
    isPostgresConnected = false;
    console.warn(`⚠️ PostgreSQL connection to ${dbHost}:${dbPort} failed: ${err.message}.`);
    return false;
  }
}

export function isDbLive(): boolean {
  return isPostgresConnected || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
