import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  __venueos_pool?: Pool;
};

const pool =
  globalForDb.__venueos_pool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://bekagogava@localhost:5432/venue_os",
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__venueos_pool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
