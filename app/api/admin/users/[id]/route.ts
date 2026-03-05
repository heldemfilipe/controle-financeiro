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

// PATCH /api/admin/users/[id] — edita ou ativa/desativa usuário
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getRequestingUser();
  if (!requester || requester.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { display_name, role, banned, password } = body;

  const updatePayload: Record<string, unknown> = {};

  if (password !== undefined) {
    updatePayload.password = password;
  }

  if (display_name !== undefined || role !== undefined) {
    const currentUser = await supabaseAdmin.auth.admin.getUserById(id);
    updatePayload.user_metadata = {
      ...currentUser.data.user?.user_metadata,
      ...(display_name !== undefined && { display_name }),
      ...(role !== undefined && { role }),
    };
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
  const requester = await getRequestingUser();
  if (!requester || requester.user_metadata?.role !== "admin") {
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
