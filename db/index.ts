import { drizzle } from "drizzle-orm/node-postgres";
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a new pool for PostgreSQL connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a drizzle instance
export const db = drizzle(pool, { schema });