"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, appPassword, authToken } from "@/lib/auth";

export async function login(password: string): Promise<{ error?: string }> {
  if (password !== appPassword()) {
    return { error: "პაროლი არასწორია" };
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, authToken(), {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}
