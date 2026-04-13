import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-admin-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: "غير مصرح" });

  try {
    // Get all auth users
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
    if (authError) return res.status(500).json({ error: authError.message });

    // Get all profiles
    const { data: profiles, error: profileError } = await adminSupabase
      .from("profiles")
      .select("*");
    if (profileError) return res.status(500).json({ error: profileError.message });

    // Merge
    const users = authData.users.map((u) => {
      const p = profiles.find((x) => x.id === u.id) || {};
      return {
        id: u.id,
        email: u.email,
        name: p.name || "—",
        phone: p.phone || "—",
        analyses_used: p.analyses_used ?? 0,
        analyses_limit: p.analyses_limit ?? 3,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
      };
    });

    // Sort by created_at desc
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const stats = {
      total_users: users.length,
      total_analyses: users.reduce((s, u) => s + u.analyses_used, 0),
      out_of_limit: users.filter((u) => u.analyses_used >= u.analyses_limit).length,
    };

    return res.status(200).json({ users, stats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
