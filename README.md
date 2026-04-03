# DailyAI — Autonomous Investigative Newsroom

**DailyAI** is a fully autonomous editorial pipeline that replaces every stage of traditional human journalism with AI agents. From source discovery to final publication, no human editor is involved.

Powered by high-parameter Large Language Models (NVIDIA Nemotron Ultra 253B via NIMs), this platform executes a multi-stage journalistic process — sourcing real wire data, cross-referencing facts, performing deep analytical synthesis, authoring long-form investigative reports, and auto-publishing — all without human intervention.

## 🚀 The AI-Driven Editorial Process

DailyAI operates a **5-stage autonomous pipeline** that replaces the entire human editorial staff:

| Stage | Traditional Role Replaced | AI Implementation |
|-------|--------------------------|-------------------|
| **1. Source Discovery** | Assignment Editors | Real-time multi-API wire monitoring with signal-to-noise ranking |
| **2. Fact Verification** | Fact-Checking Desk | Cross-source validation, clickbait filtering, duplicate removal |
| **3. Deep Analysis** | Investigative Analysts | 253B parameter LLM contextual synthesis (NVIDIA Nemotron Ultra) |
| **4. Article Writing** | Staff Writers + Copy Editors | AI-authored long-form reporting calibrated to Reuters/Bloomberg standards |
| **5. Auto-Publishing** | Managing Editor + Production | Automated formatting, caching, and live deployment with zero human review |

### Zero Human Involvement
The entire editorial workflow — from story selection through publication — operates autonomously. No human writes, edits, reviews, or approves content before it goes live. The AI is the entire editorial staff.

### Investigative Focus
Content coverage targets **geopolitics, macroeconomics, technology policy, scientific breakthroughs, and systemic global events**. Culture and trends are explicitly deprioritized in favor of substantive, analytical reporting.

## 🛠️ Tech Stack
- **AI Engine**: NVIDIA NIM — Nemotron Ultra 253B (deep analysis + article generation)
- **Fast Inference**: Llama 3.1 70B (real-time Q&A and interactive chat)
- **Data Sources**: Multi-API wire integration (live headlines from multiple categories)
- **Backend**: Netlify Serverless Functions + Blob Store (persistent cache)
- **Frontend**: Vite SPA with custom glassmorphic design system
- **Architecture**: Asynchronous Pre-Generation → Instant UI Load

## 📦 Features
- **Continuous Intelligence Feed**: AI-generated investigative briefings covering global events
- **Investigative Deep Dives**: 1000-1500 word long-form reports authored end-to-end by AI
- **Global Intelligence Brief**: Structured executive digest of critical developments
- **Interactive Q&A Verification**: Query any article's AI reasoning and source logic
- **Bureau Chief Chat**: Persistent analytical assistant for geopolitical and market analysis

## ⚙️ Setup & Deployment

### 1. Environment Variables
- `NVIDIA_API_KEY`: Your NVIDIA API key (used for LLM inference)
- `NVIDIA_BASE_URL`: (Optional) Defaults to NVIDIA's primary integration endpoint

### 2. Local Development
```bash
npm install
npm run dev
```

### 3. Netlify Deployment
Link your repository and add `NVIDIA_API_KEY` to Netlify site settings under **Environment Variables**.

## ⚖️ License
This project was developed as part of the 2026 Vibeathon. All AI-generated content is for demonstration purposes.

---
*Built by the future of reporting — zero human editors required.*
