import { createClient } from "@supabase/supabase-js";

const anonSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "الإيميل وكلمة المرور مطلوبين" });

  const { data, error } = await anonSupabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error)
    return res.status(401).json({ error: "الإيميل أو كلمة المرور غلط" });

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  return res.status(200).json({
    token: data.session.access_token,
    user: { ...profile, email: data.user.email },
  });
}
