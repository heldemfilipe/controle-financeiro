import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, isValidRole } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/admin/users/[id] — edita ou ativa/desativa usuário
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { display_name, role, banned, password } = body;

  if (role !== undefined && !isValidRole(role)) {
    return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};

  if (password !== undefined) {
    updatePayload.password = password;
  }

  if (role !== undefined || display_name !== undefined) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error || !data.user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (display_name !== undefined) {
      updatePayload.user_metadata = { ...data.user.user_metadata, display_name };
    }
    if (role !== undefined) {
      updatePayload.app_metadata = { ...data.user.app_metadata, role };
    }
  }

  if (banned !== undefined) {
    updatePayload.ban_duration = banned ? "876600h" : "none";
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload as Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// POST /api/admin/users/[id] — envia e-mail de reset de senha
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(id);
  if (userErr || !userRes.user?.email) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: userRes.user.email,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
