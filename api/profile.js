import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "غير مصرح" });

  const anonSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await anonSupabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "جلسة منتهية، سجل دخول تاني" });

  const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return res.status(200).json({ ...profile, email: user.email });
}
