# 🤖 AI Setup Guide for OctaDezx

## Quick Fix - What Was Wrong?
- The AI wasn't working because API keys were missing
- I've fixed the code, now you just need to add the API keys

## Step-by-Step Setup (5 minutes)

### Option A: Use Gemini AI (Recommended - Free & Good)

#### 1. Get Gemini API Key
- Go to: https://makersuite.google.com/app/apikey
- Click "Create API Key"
- Copy the key (starts with `AIza...`)

#### 2. Add to Supabase
- Go to: https://supabase.com/dashboard/project/tmjfvsvpfmmlhvtozjwc/settings/functions
- Click on "Edge Function Secrets" or "Secrets" tab
- Click "Add New Secret"
- Name: `GEMINI_API_KEY`
- Value: (paste your key)
- Click "Save"

---

### Option B: Use Groq AI (Also Free & Very Fast)

#### 1. Get Groq API Key
- Go to: https://console.groq.com/
- Sign up/Login
- Go to "API Keys" section
- Click "Create API Key"
- Copy the key (starts with `gsk_...`)

#### 2. Add to Supabase
- Go to: https://supabase.com/dashboard/project/tmjfvsvpfmmlhvtozjwc/settings/functions
- Click on "Edge Function Secrets" or "Secrets" tab
- Click "Add New Secret"
- Name: `GROQ_API_KEY`
- Value: (paste your key)
- Click "Save"

---

### 3. Deploy the Function

Open your terminal in VS Code (Ctrl + `) and run:

```bash
cd D:\Octadezx\OctaDezx\OctaDezx
supabase functions deploy ai-chat-response
```

If you get an error about Supabase CLI not installed:
```bash
npm install -g supabase
supabase login
```

---

## Testing

After deployment, test your chat:
1. Go to your customer chat page
2. Send a message
3. The AI should respond within 2-3 seconds

---

## Troubleshooting

### "Function not found" error
- Make sure you deployed: `supabase functions deploy ai-chat-response`

### "API key not configured" in logs
- Go back to Supabase secrets and verify the key name is exactly:
  - `GEMINI_API_KEY` or `GROQ_API_KEY` (case sensitive!)

### AI still not responding
- Check Supabase logs: https://supabase.com/dashboard/project/tmjfvsvpfmmlhvtozjwc/logs/edge-functions
- Look for error messages

---

## What I Fixed

✅ Removed duplicate message storage
✅ Added better error handling
✅ Improved fallback responses
✅ Added multi-language support (English, Spanish, Bengali)
✅ Better logging for debugging

---

## Pro Tip: Use Both APIs

Add BOTH `GEMINI_API_KEY` and `GROQ_API_KEY` to have automatic fallback:
- If Gemini fails → Groq will be used
- If Groq fails → Smart local responses will be used

You now have a 3-tier fallback system! 🚀
