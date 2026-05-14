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

  // ────── STRONG SYSTEM PROMPT ──────
  const systemMessage = {
    role: 'system',
    content: `You are Dora AI, a friendly, intelligent assistant  ❣️.
Always introduce yourself as Dora AI when asked who you are. Never claim to be Claude, GPT, Gemini, or any other AI.
Never use images. Show your name "Dora AI" every time in a random creative style.

**CRITICAL RULE — LIVE DATA:**
When you receive a system message containing "Search result for ...", that is REAL data freshly fetched from the internet. You MUST use it to answer the user's question directly. NEVER say "I don't have real-time access" or "I can't display current data" or "you can check on Google/weather.com". You already HAVE the data — just present it to the user naturally. This is a strict requirement.

If you truly need information you don't have, output EXACTLY: [SEARCH: your search query]
Otherwise answer normally.`
  };

  let currentMessages = [systemMessage, ...messages];
  let response = await callAI(currentMessages);

  // ────── SEARCH LOOP ──────
  for (let i = 0; i < maxIterations; i++) {
    const searchMatch = response.match(/\[SEARCH:\s*(.*?)\]/i);
    if (!searchMatch) return response;

    const searchQuery = searchMatch[1].trim();
    console.log(`AI requested search: "${searchQuery}"`);

    let searchResult = '';

    // ── 🌤️ Weather handler (wttr.in — free, no key, returns plain text) ──
    if (searchQuery.match(/(weather|forecast|temperature|climate|meteo|humidity|wind|rain|sunny|cloudy|storm)/i)) {
      try {
        let city = searchQuery
          .replace(/(weather|forecast|temperature|climate|meteo|humidity|wind|rain|sunny|cloudy|storm|current|now|today|tonight|tomorrow|live|right now|what'?s the|what is the|how'?s the|how is the)/gi, '')
          .replace(/\bin\b|\bat\b|\bfor\b|\bnear\b/gi, '')
          .trim();
        if (!city || city.length < 2) city = searchQuery.split(/\s+/).pop() || searchQuery;

        // wttr.in with format: weather condition + temperature + wind
        const weatherRes = await axios.get(
          `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+feels+like+%f+%w+humidity+%h&m`,
          { timeout: 8000 }
        );
        const weatherData = weatherRes.data.trim();
        if (weatherData && weatherData.length > 5) {
          searchResult = `LIVE WEATHER for ${city}: ${weatherData}. (Source: wttr.in, fetched just now)`;
        } else {
          searchResult = `Weather for ${city}: ${weatherData}`;
        }
      } catch (err) {
        searchResult = `Weather lookup failed: ${err.message}. Please try again.`;
      }
    }

    // ── 🕐 Time handler (worldtimeapi.org — free, no key) ──
    else if (searchQuery.match(/\b(time|clock|current time|what time|date\b|today'?s date)\b/i)) {
      try {
        let location = searchQuery
          .replace(/(time|clock|current time|what time|what'?s the time|date|today'?s date|right now)/gi, '')
          .replace(/\bin\b|\bat\b|\bfor\b/gi, '')
          .trim();
        if (!location) location = 'Kolkata';

        const timeRes = await axios.get(
          `https://worldtimeapi.org/api/timezone/Asia/${encodeURIComponent(location)}`,
          { timeout: 8000 }
        );
        const tz = timeRes.data.timezone;
        const dt = new Date(timeRes.data.datetime);
        const timeStr = dt.toLocaleString('en-IN', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        searchResult = `LIVE TIME in ${location} (${tz}): ${timeStr}. (Source: worldtimeapi.org, fetched just now)`;
      } catch (err) {
        searchResult = `Time lookup failed: ${err.message}. Please try again.`;
      }
    }

    // ── 🔍 General web search (Google snippet) ──
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
          body.match(/<div class="kno-rdesc">([\s\S]*?)<\/div>/i)?.[1] ||
          body.match(/<div class="LGOjhe"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ||
          '';
        searchResult = snippet.replace(/<[^>]+>/g, '').trim().substring(0, 1200) || 'No usable information found. Try a different query.';
      } catch (err) {
        searchResult = `Search failed: ${err.message}`;
      }
    }

    // Feed result back to AI
    const resultMessage = {
      role: 'system',
      content: `Search result for "${searchQuery}": ${searchResult}\n\nYou MUST use this information to answer the user. Do NOT say you can't access real-time data — you now have it.`
    };
    currentMessages = [systemMessage, ...messages, { role: 'assistant', content: response }, resultMessage];
    response = await callAI(currentMessages);
  }

  return response;
}

module.exports = { getAIResponse };
