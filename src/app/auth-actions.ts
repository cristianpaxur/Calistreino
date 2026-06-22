"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function creds(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(formData: FormData) {
  const { email, password } = creds(formData);
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const { email, password } = creds(formData);
  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }
  if (data.session) {
    // Confirmação de e-mail desativada → já logado
    revalidatePath("/", "layout");
    redirect("/");
  }
  // Confirmação de e-mail ativada → avisar para checar a caixa de entrada
  redirect("/login?check=1");
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
