import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anonSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password)
    return res.status(400).json({ error: "كل الحقول مطلوبة" });

  // Create user in Supabase Auth
  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "الإيميل ده مسجل قبل كده"
      : authError.message;
    return res.status(400).json({ error: msg });
  }

  // Create profile
  const { error: profileError } = await adminSupabase.from("profiles").insert({
    id: authData.user.id,
    name,
    phone,
    analyses_used: 0,
    analyses_limit: 3,
  });

  if (profileError)
    return res.status(400).json({ error: profileError.message });

  // Sign in to get token
  const { data: signInData, error: signInError } =
    await anonSupabase.auth.signInWithPassword({ email, password });

  if (signInError)
    return res.status(400).json({ error: signInError.message });

  return res.status(200).json({
    token: signInData.session.access_token,
    user: { name, phone, email, analyses_used: 0, analyses_limit: 3 },
  });
}
