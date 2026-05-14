const axios = require('axios');
const config = require('../../config.json');

async function getAIResponse(messages, maxIterations = 5) {
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

  // ────────── SYSTEM PROMPT (strict identity + search rules) ──────────
  const systemMessage = {
    role: 'system',
    content: `You are Dora AI, a friendly, intelligent assistant ❣️ from Bangladesh.
Always introduce yourself as Dora AI. Never claim to be Claude, GPT, Gemini, or any other AI.
Never use images. Present your name "Dora AI" in a creative unicode style each time, like: 𝗗𝗼𝗿𝗮 𝗔𝗜 or Ⓓⓞⓡⓐ ⒶⒾ or 𝔇𝔬𝔯𝔞 𝔄ℑ – vary it.

**Search protocol (internal, never shown to user):**
If you lack information, you may request a web search by outputting EXACTLY: [SEARCH: your query]
I (the system) will fetch the data and give it to you silently. You MUST then use that data to write a complete, final answer.
Never mention the search to the user. Never say "I found" or "according to the search" – just present the information naturally.
If the search returns no data, respond helpfully that you couldn't find the information right now, but DO NOT suggest the user check external websites.`
  };

  let currentMessages = [systemMessage, ...messages];
  let response = await callAI(currentMessages);

  // ────────── SEARCH LOOP (invisible to user) ──────────
  for (let i = 0; i < maxIterations; i++) {
    const searchMatch = response.match(/\[SEARCH:\s*(.*?)\]/i);
    if (!searchMatch) return response; // final answer, no search needed

    const searchQuery = searchMatch[1].trim();
    console.log(`🔍 AI requested search: "${searchQuery}"`);

    let searchResult = '';

    // ─── Weather (wttr.in) ───────────────────────────
    if (searchQuery.match(/(weather|forecast|temperature|climate|meteo|humidity|wind|rain|sunny|cloudy|storm)/i)) {
      let city = searchQuery
        .replace(/(weather|forecast|temperature|climate|meteo|humidity|wind|rain|sunny|cloudy|storm|current|now|today|tonight|tomorrow|live|right now|what'?s the|what is the|how'?s the|how is the)/gi, '')
        .replace(/\bin\b|\bat\b|\bfor\b|\bnear\b/gi, '')
        .trim();
      if (!city) city = searchQuery;

      try {
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+feels+like+%f+%w+humidity+%h&m`, { timeout: 8000 });
        const data = res.data.trim();
        if (data && !data.startsWith('Unknown') && data.length > 3) {
          searchResult = `LIVE WEATHER for ${city}: ${data}. (from wttr.in)`;
        } else {
          searchResult = `Weather for ${city} is currently unavailable.`;
        }
      } catch (err) {
        searchResult = `Weather lookup failed: ${err.message}`;
      }
    }

    // ─── Time (worldtimeapi.org) ─────────────────────
    else if (searchQuery.match(/\b(time|clock|current time|what time|date\b|today'?s date)\b/i)) {
      let location = searchQuery.replace(/(time|clock|current time|what time|what'?s the time|date|today'?s date|right now)/gi, '').replace(/\bin\b|\bat\b|\bfor\b/gi, '').trim();
      if (!location) location = 'Kolkata';

      try {
        const res = await axios.get(`https://worldtimeapi.org/api/timezone/Asia/${encodeURIComponent(location)}`, { timeout: 8000 });
        const dt = new Date(res.data.datetime);
        const timeStr = dt.toLocaleString('en-IN', { timeZone: res.data.timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        searchResult = `LIVE TIME in ${location}: ${timeStr} (${res.data.timezone}).`;
      } catch (err) {
        searchResult = `Time lookup for ${location} failed: ${err.message}`;
      }
    }

    // ─── General Web Search (DuckDuckGo Instant Answer) ─
    else {
      try {
        // 1) DuckDuckGo Instant Answer API – gives structured data
        const duckRes = await axios.get('https://api.duckduckgo.com', {
          params: { q: searchQuery, format: 'json', no_html: 1, skip_disambig: 1 },
          timeout: 8000
        });

        const duck = duckRes.data;
        let instantText = '';

        // Extract the best available answer
        if (duck.AbstractText) instantText = duck.AbstractText;
        else if (duck.Answer) instantText = duck.Answer;
        else if (duck.Definition) instantText = duck.Definition;
        else if (duck.Heading && duck.AbstractText) instantText = `${duck.Heading}: ${duck.AbstractText}`;
        else if (duck.RelatedTopics && duck.RelatedTopics.length > 0) {
          instantText = duck.RelatedTopics.slice(0, 3).map(t => t.Text || t).join(' | ');
        }

        if (instantText && instantText.length > 20) {
          searchResult = instantText.substring(0, 1500);
        } else {
          // 2) Fallback to DuckDuckGo Lite HTML scrape (clean results)
          const liteRes = await axios.get('https://lite.duckduckgo.com/lite/', {
            params: { q: searchQuery },
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoraBot/2.0)' }
          });
          const html = liteRes.data;
          // Extract result snippets from the simple HTML
          const snippets = [];
          const rowPattern = /<a[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>\s*<span[^>]*>([\s\S]*?)<\/span>/gi;
          let match;
          while ((match = rowPattern.exec(html)) !== null) {
            snippets.push(match[2].replace(/<[^>]+>/g, '').trim());
            if (snippets.length >= 3) break;
          }
          if (snippets.length > 0) {
            searchResult = snippets.join(' | ').substring(0, 1500);
          } else {
            searchResult = `No information found for "${searchQuery}".`;
          }
        }
      } catch (err) {
        searchResult = `Search failed: ${err.message}. Please try again later.`;
      }
    }

    // Feed result back to AI as system message
    const resultMessage = {
      role: 'system',
      content: `Search result for "${searchQuery}": ${searchResult}\n\nUse this information to write a complete final answer. Do NOT mention the search.`
    };
    currentMessages = [systemMessage, ...messages, { role: 'assistant', content: response }, resultMessage];
    response = await callAI(currentMessages);
  }

  return response;
}

module.exports = { getAIResponse };
