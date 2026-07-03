# Dora AI Agent 🤖

> Lightweight AI Agent API with persistent memory, web tools, and dynamic skill loading — powered by Groq LLM.

## Features

[![Author](https://img.shields.io/badge/Author-Rahaman%20Leon-blue)](https://github.com/rahamanleon)


- 💬 **AI Chat** — natural conversation with Groq LLM (free tier)
- 🧠 **Persistent Memory** — MongoDB-backed user memories persist across sessions
- 🔍 **Web Tools** — search, URL fetching, image generation
- ⚡ **Dynamic Skills** — hot-load new capabilities at runtime
- 🌐 **REST API** — simple HTTP interface for integration

## Quick Start

```bash
npm install
cp config.example.json config.json  # edit with your API keys
npm start
```

## Configuration

Edit `config.json` with your:
- Groq API key
- MongoDB connection string
- Other service credentials

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /chat` | Send a message to the AI |
| `GET /memory/:id` | Retrieve user memory |
| `POST /memory` | Store user memory |
| `GET /skills` | List loaded skills |

## Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## License

MIT &mdash; see [LICENSE](LICENSE).


---

## 📬 Links & Contact
- **Repository**: [https://github.com/rahamanleon/Dora-agent](https://github.com/rahamanleon/Dora-agent)
- **Issues**: [https://github.com/rahamanleon/Dora-agent/issues](https://github.com/rahamanleon/Dora-agent/issues)
