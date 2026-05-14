const axios = require('axios');
const config = require('../../config.json');

async function getAIResponse(messages, maxIterations = 3) {
  const provider = config.activeProvider;
  const providerConfig = config.aiProviders[provider];
  if (!providerConfig) throw new Error(`AI provider '${provider}' not configured`);

  // Resolve API key
  let apiKey = providerConfig.apiKey || providerConfig.apikey;
  if (apiKey && apiKey.startsWith('${') && apiKey.endsWith('}')) {
    apiKey = process.env[apiKey.slice(2, -1)];
    if (!apiKey) throw new Error(`Environment variable ${apiKey} not set`);
  } else if (apiKey && apiKey.includes('${')) {
    apiKey = apiKey.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
  }

  const baseUrl = providerConfig.baseUrl;
  const model = providerConfig.model;
  const maxTokens = providerConfig.maxTokens || 4096;
  const temperature = providerConfig.temperature || 0.7;
  const timeout = providerConfig.timeout || 120000;

  // Build endpoint
  let endpoint = baseUrl;
  if (endpoint.endsWith('/v1')) endpoint += '/chat/completions';
  else if (!endpoint.includes('/chat/completions')) endpoint += '/chat/completions';

  // Helper to call the AI model
  const callAI = async (msgArray) => {
    const requestBody = { model, messages: msgArray, max_tokens: maxTokens, temperature };
    const response = await axios.post(endpoint, requestBody, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout
    });
    const data = response.data;
    if (data.choices?.[0]?.message) return data.choices[0].message.content;
    if (data.response) return data.response;
    if (data.content) return data.content;
    return JSON.stringify(data);
  };

  // System prompt – Dora identity + clear instruction to use live data
  const systemMessage = {
    role: 'system',
    content: `You are Dora AI, a friendly, intelligent assistant created by Rahaman Leon from Bangladesh. 
You help with coding, answering questions, brainstorming, writing, and problem-solving.
Always introduce yourself as Dora AI when asked who you are. Never claim to be Claude, GPT, Gemini, or any other AI.
Never use images. Show your name "Dora AI" every time in a random creative style.

**Critical rule about live data:**
If the system gives you a "Search result for ..." message containing real‑time information (weather, time, news, etc.), you MUST use that data directly in your answer. Do NOT say you don't have access to real‑time data. The data is already provided to you — simply present it to the user in a natural, helpful way.

If you need real-time information (weather, time, news, etc.) and cannot answer accurately from your training data, output EXACTLY the text: [SEARCH: your search query] on a separate line. Otherwise answer normally.`
  };

  let currentMessages = [systemMessage, ...messages];
  let response = await callAI(currentMessages);

  // Auto‑search loop
  for (let i = 0; i < maxIterations; i++) {
    const searchMatch = response.match(/\[SEARCH:\s*(.*?)\]/i);
    if (!searchMatch) return response; // final answer

    const searchQuery = searchMatch[1].trim();
    console.log(`AI requested search: "${searchQuery}"`);

    let searchResult = '';

    // ────────── 🌤️ Weather handler ──────────
    if (searchQuery.match(/(weather|forecast|temperature|climate|meteo)/i)) {
      try {
        let city = searchQuery
          .replace(/(weather|forecast|temperature|climate|meteo|current|now|today|tomorrow|live)/gi, '')
          .replace(/\bin\b|\bat\b|\bfor\b/gi, '')
          .trim();
        if (!city) city = searchQuery;

        const weatherRes = await axios.get(
          `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%w&m`,
          { timeout: 8000 }
        );
        searchResult = `Current weather in ${city}: ${weatherRes.data.trim()}`;
      } catch (err) {
        searchResult = `Weather lookup failed: ${err.message}`;
      }
    }

    // ────────── 🕐 Time handler ──────────
    else if (searchQuery.match(/\b(time|clock|current time)\b/i)) {
      try {
        let location = searchQuery
          .replace(/(time|clock|current time|right now)/gi, '')
          .replace(/\bin\b|\bat\b|\bfor\b/gi, '')
          .trim();
        if (!location) location = 'Kolkata';

        const timeRes = await axios.get(
          `https://worldtimeapi.org/api/timezone/Asia/${encodeURIComponent(location)}`,
          { timeout: 8000 }
        );
        const datetime = new Date(timeRes.data.datetime);
        searchResult = `Current time in ${location}: ${datetime.toLocaleTimeString('en-IN', { timeZone: timeRes.data.timezone })}`;
      } catch (err) {
        searchResult = `Time lookup failed: ${err.message}`;
      }
    }

    // ────────── 🔍 General web search ──────────
    else {
      try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=en`;
        const fetchRes = await axios.get(searchUrl, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const body = String(fetchRes.data);
        const snippet =
          body.match(/<span class="st">([\s\S]*?)<\/span>/i)?.[1] ||
          body.match(/<div class="BNeawe s3v9rd AP7Wnd">([\s\S]*?)<\/div>/i)?.[1] ||
          body.match(/<div class="BNeawe iBp4i AP7Wnd">([\s\S]*?)<\/div>/i)?.[1] ||
          '';
        searchResult = snippet.replace(/<[^>]+>/g, '').trim().substring(0, 1000) || 'No snippet found.';
      } catch (err) {
        searchResult = `Search failed: ${err.message}`;
      }
    }

    // Feed search result back to the AI
    const resultMessage = {
      role: 'system',
      content: `Search result for "${searchQuery}": ${searchResult}`
    };
    currentMessages = [systemMessage, ...messages, { role: 'assistant', content: response }, resultMessage];
    response = await callAI(currentMessages);
  }

  return response;
}

module.exports = { getAIResponse };
