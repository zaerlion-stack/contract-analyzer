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

  const { userId, action, value } = req.body;
  if (!userId || !action) return res.status(400).json({ error: "بيانات ناقصة" });

  try {
    // Get current profile
    const { data: profile, error: fetchError } = await adminSupabase
      .from("profiles")
      .select("analyses_limit, analyses_used")
      .eq("id", userId)
      .single();
    if (fetchError) return res.status(404).json({ error: "المستخدم مش موجود" });

    let updates = {};

    if (action === "increase") {
      updates.analyses_limit = profile.analyses_limit + 1;
    } else if (action === "decrease") {
      updates.analyses_limit = Math.max(0, profile.analyses_limit - 1);
    } else if (action === "set") {
      const num = parseInt(value);
      if (isNaN(num) || num < 0) return res.status(400).json({ error: "قيمة غير صحيحة" });
      updates.analyses_limit = num;
    } else if (action === "reset_usage") {
      updates.analyses_used = 0;
    } else {
      return res.status(400).json({ error: "action غير معروف" });
    }

    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);
    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.status(200).json({ success: true, updated: updates });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
