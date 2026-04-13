import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: "غير مصرح" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId مطلوب" });

  try {
    // Delete profile first
    await adminSupabase.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error } = await adminSupabase.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
