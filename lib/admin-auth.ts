import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { AppUser } from "@/types";

/** Papel do usuário. Fica em app_metadata porque user_metadata é editável pelo próprio usuário. */
export function getUserRole(user: Pick<User, "app_metadata">): AppUser["role"] {
  return user.app_metadata?.role === "admin" ? "admin" : "user";
}

export function isValidRole(role: unknown): role is AppUser["role"] {
  return role === "admin" || role === "user";
}

/** Usuário logado que fez a requisição, se for admin; caso contrário, null. */
export async function getAdminUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user && getUserRole(user) === "admin" ? user : null;
}
