import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getRequestingUser() {
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
  return user;
}

// GET /api/admin/users — lista todos os usuários
export async function GET() {
  const requester = await getRequestingUser();
  if (!requester || requester.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.user_metadata?.display_name ?? "",
    role: u.user_metadata?.role ?? "user",
    banned: !!u.banned_until,
    created_at: u.created_at,
  }));

  return NextResponse.json(users);
}

// POST /api/admin/users — cria novo usuário
export async function POST(request: NextRequest) {
  const requester = await getRequestingUser();
  if (!requester || requester.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { email, password, display_name, role } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { display_name, role: role ?? "user" },
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.user.id });
}
