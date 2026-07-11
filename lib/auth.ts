export const AUTH_COOKIE = "avos_auth";

/** Session token stored in the cookie. Server-only secret; without it a
 *  visitor can't forge the cookie. Set AUTH_SECRET in production. */
export function authToken(): string {
  return process.env.AUTH_SECRET || "avos-dev-secret-change-me";
}

export function appPassword(): string {
  return process.env.APP_PASSWORD || "avenue";
}
