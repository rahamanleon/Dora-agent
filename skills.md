---
name: dora-api
description: Dora API - AI agent service with memory, tools, and skill registry. Built with Node.js, MongoDB, Groq LLM, and dynamic skill loading.
homepage: https://github.com/rahamanleon/dora-api
metadata: {"nanobot":{"emoji":"🤖","category":"api","requires":{"runtime":"nodejs","env":["GROQ_API_KEY","MONGODB_URI"]}}}
---

# Dora API Skills

Dora API is a Node.js AI agent service with persistent memory, web tools, and dynamic skill loading via Groq LLM.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GROQ_API_KEY and MONGODB_URI

# Start server
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /chat | Send message, get AI response |
| GET | /chat/memory | Get user memories |
| POST | /chat/memory | Save a memory |
| DELETE | /chat/memory | Delete memories |
| GET | /chat/history | Get conversation history |
| GET | /tools | List all available tools |
| POST | /tools/execute | Execute a tool directly |
| POST | /tools/skill | Load dynamic skill (persistent) |
| POST | /tools/register | Register skill (in-memory) |

---

## Skills

### agent
- **Description:** Main AI agent service. Handles chat with memory, tool calls, and conversation management using Groq LLM.
- **Emoji:** 🤖
- **Requires:** GROQ_API_KEY

### chatController
- **Description:** Chat API controller. Handles user messages, memory management, and conversation history.
- **Emoji:** 💬
- **Requires:** express module

### memory
- **Description:** Persistent memory service. Stores user memories and conversation history in MongoDB.
- **Emoji:** 🧠
- **Requires:** MONGODB_URI

### memoryModel
- **Description:** MongoDB Memory model. Stores user key-value memories with timestamps.
- **Emoji:** 💾
- **Requires:** MONGODB_URI

### conversationModel
- **Description:** MongoDB Conversation model. Stores user/assistant chat messages with timestamps.
- **Emoji:** 💬
- **Requires:** MONGODB_URI

### toolController
- **Description:** Tool API controller. Manages tool listing, execution, and dynamic skill loading.
- **Emoji:** 🔧
- **Requires:** express module

### toolRegistry
- **Description:** Dynamic tool and skill registry. Manages tool loading, registration, and execution with dynamic skill loading support.
- **Emoji:** 🔧
- **Requires:** fs, path modules

### webSearch
- **Description:** Search the web using DuckDuckGo HTML (free, no API key required). Returns top 5 results.
- **Emoji:** 🔍
- **Requires:** curl, axios, cheerio

### fetchUrl
- **Description:** Fetch and parse web pages, extracting title and main content from any URL.
- **Emoji:** 🌐
- **Requires:** curl, axios, cheerio

### generateImage
- **Description:** Generate images from text prompts. Placeholder implementation for production image APIs.
- **Emoji:** 🎨
- **Requires:** External API (DALL-E/Stable Diffusion)

### groq
- **Description:** Groq API integration. Handles chat completions with function calling support using Llama models.
- **Emoji:** ⚡
- **Requires:** GROQ_API_KEY

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No | Server port (default: 3000) |
| MONGODB_URI | Yes | MongoDB connection string |
| GROQ_API_KEY | Yes | Groq API key for LLM |
| MAX_HISTORY | No | Max conversation history (default: 20) |

## Architecture

```
┌─────────────┐
│  Express    │
│  Router     │
└──────┬──────┘
       │
┌──────▼──────┐
│ chatController │     ┌─────────────┐
│ toolController │────►│ toolRegistry│
└──────┬──────┘       └──────┬──────┘
       │                     │
┌──────▼──────┐       ┌──────▼──────┐
│ agentService │──────►│   Groq     │
└──────┬──────┘       │   LLM      │
       │              └─────────────┘
┌──────▼──────┐
│memoryService│
└──────┬──────┘
       │
┌──────▼──────┐
│  MongoDB    │
│  (Memory & │
│  Conversation)│
└─────────────┘
```

## Tool Registry

Auto-loaded tools from `src/tools/`:
- **webSearch** - DuckDuckGo search
- **fetchUrl** - Web page fetch & parse
- **generateImage** - Image generation (placeholder)

Dynamic skills from `src/skills/`:
- User-defined skills persist here
- Load via POST /tools/skill

## Dynamic Skill Loading

```bash
# Register a skill (in-memory)
curl -X POST http://localhost:3000/tools/register \
  -H "Content-Type: application/json" \
  -d '{"name": "calculator", "code": "async function(params) { return { result: params.a + params.b }; }"}'

# Load a skill (persistent)
curl -X POST http://localhost:3000/tools/skill \
  -H "Content-Type: application/json" \
  -d '{"name": "mySkill", "code": "async function(params) { return { data: params }; }"}'

# Execute
curl -X POST http://localhost:3000/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123", "tool_name": "calculator", "params": {"a": 5, "b": 3}}'
```

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "groq-sdk": "^0.4.0",
  "axios": "^1.6.0",
  "cheerio": "^1.0.0-rc.12",
  "dotenv": "^16.3.1"
}
```
