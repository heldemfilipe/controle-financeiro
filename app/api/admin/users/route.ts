import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, getUserRole, isValidRole } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/admin/users — lista todos os usuários
export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.user_metadata?.display_name ?? "",
    role: getUserRole(u),
    banned: !!u.banned_until,
    created_at: u.created_at,
  }));

  return NextResponse.json(users);
}

// POST /api/admin/users — cria novo usuário
export async function POST(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { email, password, display_name, role = "user" } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha obrigatórios" }, { status: 400 });
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { display_name },
    app_metadata: { role },
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.user.id });
}
