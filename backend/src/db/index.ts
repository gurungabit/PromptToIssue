import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';

const sqlite = new Database('./app.db');
export const db = drizzle(sqlite, { schema });

export { schema };
export const { users, conversations, messages, tickets, platforms, userSettings, apiKeys } = schema; 