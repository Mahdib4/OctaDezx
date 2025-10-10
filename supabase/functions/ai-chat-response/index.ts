// supabase/functions/ai-chat-response/index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// --- CORS setup ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Interfaces ---
interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  policies: string | null;
  ai_instructions: string | null;
  products: Product[];
}

interface ChatMessage {
  sender_type: string;
  content: string;
}

interface HistoryMessage {
  role: string;
  content: string;
}

// --- Utility functions ---
function normalizePrice(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function formatCurrency(n: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function detectLanguage(text: string): string {
  const t = (text || "").toLowerCase();
  if (/[\u0900-\u097F]/.test(t)) return "hi"; // Hindi
  if (/[\u0980-\u09FF]/.test(t)) return "bn"; // Bengali
  if (/[\u0600-\u06FF]/.test(t)) return "ar"; // Arabic
  if (/\b(hola|gracias|cuánto|precio|comprar)\b/i.test(t)) return "es"; // Spanish
  return "en";
}

function localSmartReply(userMessage: string, products: Product[], business: Business): string {
  const hasProducts = Array.isArray(products) && products.length > 0;
  const lang = detectLanguage(userMessage);

  const responses: Record<string, Record<string, string>> = {
    en: {
      greeting: `Thanks for reaching out to ${business.name}!`,
      recommendations: "Here are a few recommendations:",
      tellMe: "Tell me what you're looking for and I'll tailor suggestions.",
      helpToday: `Thanks for contacting ${business.name}! How can I help?`,
    },
    es: {
      greeting: `¡Gracias por contactar a ${business.name}!`,
      recommendations: "Aquí tienes algunas recomendaciones:",
      tellMe: "Dime qué estás buscando y te daré sugerencias.",
      helpToday: `¡Gracias por contactar a ${business.name}! ¿Cómo puedo ayudarte?`,
    },
    bn: {
      greeting: `${business.name} এ যোগাযোগ করার জন্য ধন্যবাদ!`,
      recommendations: "এখানে কিছু সুপারিশ রয়েছে:",
      tellMe: "আপনি কী খুঁজছেন তা আমাকে বলুন এবং আমি সুপারিশ করব।",
      helpToday: `${business.name} এ যোগাযোগ করার জন্য ধন্যবাদ! আমি কিভাবে সাহায্য করতে পারি?`,
    },
  };

  const l = responses[lang] || responses.en;

  if (hasProducts) {
    const picks = products
      .slice(0, 3)
      .map((p: Product) => {
        const price = p.price != null ? ` – ${formatCurrency(Number(p.price))}` : "";
        return `• ${p.name}${price}`;
      })
      .join("\n");
    return `${l.greeting} ${l.recommendations}\n\n${picks}\n\n${l.tellMe}`;
  }

  return l.helpToday;
}

function isGenericAIResponse(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    t.includes("as an ai") ||
    t.includes("i am an ai") ||
    t.includes("i'm an ai") ||
    t.includes("as a language model") ||
    t.includes("i don't have")
  );
}

// --- AI API calls ---
async function callGemini(message: string, system: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    console.log("🚨 GEMINI_API_KEY not configured");
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: system + "\n\n" + message }] }],
    generationConfig: { temperature: 0.25, maxOutputTokens: 450 },
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      console.error("❌ Gemini API error:", r.status, await r.text());
      return null;
    }

    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) console.log("✅ Gemini response received");
    return text || null;
  } catch (err) {
    console.error("💥 Gemini error:", err);
    return null;
  }
}

async function callGroq(messages: HistoryMessage[]): Promise<string | null> {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) {
    console.log("🚨 GROQ_API_KEY not configured");
    return null;
  }

  const body = {
    model: "llama-3.1-8b-instant",
    messages,
    max_tokens: 450,
    temperature: 0.3,
  };

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      console.error("❌ Groq API error:", r.status, await r.text());
      return null;
    }

    const j = await r.json();
    const text = j.choices?.[0]?.message?.content?.trim();
    if (text) console.log("✅ Groq response received");
    return text || null;
  } catch (err) {
    console.error("💥 Groq error:", err);
    return null;
  }
}

// --- Main Serve Function ---
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, businessId, sessionId } = await req.json();
    if (!message || !businessId || !sessionId) {
      throw new Error("Missing required fields: message, businessId, or sessionId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase configuration missing");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: session } = await supabase
      .from("chat_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if (session?.status === "escalated") {
      return new Response(
        JSON.stringify({
          response: null,
          escalated: true,
          reason: "Session already escalated to human agent",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select(`*, products (id, name, description, category, price)`)
      .eq("id", businessId)
      .single();

    if (bErr || !business) throw new Error("Business not found");

    const { data: hist } = await supabase
      .from("chat_messages")
      .select("sender_type, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10);

    const history: HistoryMessage[] = (hist || []).map((m: ChatMessage) => ({
      role: m.sender_type === "ai" ? "assistant" : "user",
      content: m.content,
    }));

    const products: Product[] = (business.products || []).slice(0, 20).map((p: Product) => ({
      id: p.id,
      name: p.name,
      category: p.category || "General",
      price: normalizePrice(p.price),
      description: (p.description || "").slice(0, 200),
    }));

    const catalog = products.length
      ? products
          .map((p) => `${p.name} (${p.category})${p.price ? ` – ${formatCurrency(p.price)}` : ""}`)
          .join("\n")
      : "No products available";

    const lang = detectLanguage(message);

    const systemPrompt = `
You are a helpful, sales-focused Customer Support assistant for ${business.name}.

Business:
- Name: ${business.name}
- Description: ${business.description || ""}
- Policies: ${business.policies || "Standard policies apply."}

Instructions: ${business.ai_instructions || "Be friendly, helpful, and professional."}

Rules:
- Never mention being AI or a bot
- Respond in the same language (detected: ${lang})
- Recommend products with prices when relevant
- Escalate only if user requests a human agent or serious issue
- Focus on helping the customer quickly

Available Products:
${catalog}
`;

    let reply: string | null = await callGemini(message, systemPrompt);
    if (!reply) {
      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ];
      reply = await callGroq(groqMessages);
    }

    if (!reply || isGenericAIResponse(reply)) {
      reply = localSmartReply(message, products, business as Business);
    }

    return new Response(JSON.stringify({ response: reply, escalated: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("💥 Function error:", err);
    return new Response(
      JSON.stringify({ escalated: true, reason: "System error: " + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
npx sup