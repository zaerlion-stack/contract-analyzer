import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `أنت محلل قانوني متخصص في عقود العقارات المصرية.

مهمتك: تحليل العقد واستخراج المعلومات التالية بدقة تامة.
أجب بالعربي فقط.

مهم جداً: لكل معلومة تستخرجها، اذكر رقم البند أو المادة من العقد.
لو مش لاقي رقم بند محدد، اكتب "نص العقد العام".

صيغة الإجابة المطلوبة (JSON فقط):

{
  "فسخ_العقد": { "رقم_البند": "...", "النص": "..." },
  "غرامة_التاخير": { "رقم_البند": "...", "النص": "..." },
  "قرار_التخصيص": { "رقم_البند": "...", "النص": "..." },
  "طريقة_الدفع": { "رقم_البند": "...", "النص": "..." },
  "موعد_التسليم": { "رقم_البند": "...", "النص": "..." },
  "red_flags": [{ "رقم_البند": "...", "النص": "..." }],
  "ملاحظات_مهمة": [{ "رقم_البند": "...", "النص": "..." }]
}

قواعد:
- لو المعلومة غير موجودة: النص = "غير موجود في العقد" ورقم_البند = "-"
- في red_flags ابحث عن: غرامات باهظة، بنود تعسفية، تواريخ مفتوحة، حق البائع في تعديل الأسعار، إسقاط الحقوق
- أجب بـ JSON فقط`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Auth check
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "سجل دخول الأول" });

  const anonSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "جلسة منتهية، سجل دخول تاني" });

  // Check usage limit
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return res.status(404).json({ error: "المستخدم مش موجود" });

  if (profile.analyses_used >= profile.analyses_limit) {
    return res.status(403).json({
      error: `وصلت للحد المسموح (${profile.analyses_limit} عقود). تواصل معنا للترقية.`,
      limit_reached: true,
    });
  }

  const { text } = req.body;
  if (!text || text.trim().length < 20)
    return res.status(400).json({ error: "النص قصير جداً" });

  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `هذا نص العقد:\n\n${text.substring(0, 80000)}` }],
    });

    const rawText = response.content[0].text;
    let analysis;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: rawText };
    } catch {
      analysis = { raw: rawText };
    }

    // Increment usage
    await adminSupabase
      .from("profiles")
      .update({ analyses_used: profile.analyses_used + 1 })
      .eq("id", user.id);

    return res.status(200).json({
      analysis,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cost_usd: ((response.usage.input_tokens * 1.0 + response.usage.output_tokens * 5.0) / 1_000_000).toFixed(4),
      },
      remaining: profile.analyses_limit - profile.analyses_used - 1,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "خطأ في السيرفر" });
  }
}
