# Project Handover: THE SIGNAL (AI-Native Newsroom)

## Current Status
The project is successfully running locally. The core block—the Gemini API hitting Quota/Rate limit errors—has been permanently resolved by migrating the backend LLM provider to NVIDIA NIMs.

## Key Changes Made
1. **API Provider Migration**:
   - The backend was initially built using the `@google/generative-ai` SDK (Gemini).
   - Due to rate limits, we built a transparent "Shim" layer in `netlify/functions/gemini-config.js`.
   - This shim intercepts calls meant for Gemini and translates them into OpenAI-compatible payload structures.
   - These requests are then dispatched to `https://integrate.api.nvidia.com/v1/chat/completions`.

2. **Model Optimization**:
   - We tested several NVIDIA NIM models for speed vs capability.
   - To overcome Netlify's rigid 10-second serverless execution limit, the default model was switched to `meta/llama-3.1-8b-instruct`.
   - This ensures that complex bulk generation tasks (like generating 8 complete article cards for the Feed) complete within ~3 seconds, completely eliminating the previous `500 Internal Server Error` timeouts.

3. **Environment Setup**:
   - `NVIDIA_API_KEY` and `NVIDIA_BASE_URL` were added to the `.env` file.
   - Development server now relies on these variables, making it more robust against shell variable conflicts.

## Project Structure
- **Frontend**: Vite SPA (React/Vanilla JS approach), running on `http://localhost:8888`.
- **Backend / API**: Netlify Serverless Functions (located in `netlify/functions/`).
  - `feed.js`: Generates the front-page article cards.
  - `article.js`: Generates full article content when a user clicks a feed card.
  - `digest.js`: Generates the daily newsletter summary.
  - `ask.js`, `chat.js`: Handles interactive elements.
  - `gemini-config.js`: **[CRITICAL]** The core configuration file that routes all LLM generation traffic through the NVIDIA API shim.

## Next Steps / Run Book

1. **Starting the Dev Server**:
   To start the environment perfectly, run this command in the terminal:
   ```bash
   $env:NVIDIA_API_KEY='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'; $env:NVIDIA_BASE_URL='https://integrate.api.nvidia.com/v1'; npm run dev
   ```
   *(Note: The `netlify dev` command is currently running fine, but ensure the environment variables are injected like above if restarting in a fresh terminal).*

2. **Model Upgrades**:
   - If Netlify is upgraded to a Pro account (allowing 30s+ execution limits) or deployed to an environment without strict timeouts, you can upgrade the model in `gemini-config.js` back to `meta/llama-3.3-70b-instruct` or `nvidia/llama-3.1-nemotron-70b-instruct` for superior journalistic article generation.

3. **Trading Architect Context**:
   - We located the `test_llm.py` and `main.py` files in the `Trading` directory.
   - If work resumes on the Trading agent, it can now utilize the same `nvapi-` key verified during this Vibeathon newsroom integration.

---

## Vibeathon Competition Updates (Apr 2, 2026)

### UI/UX Polish Applied

1. **Article card click feedback** — Added `:active` scale transform for tactile feel
2. **Trending item hover state** — Improved color transition on hover
3. **Keyboard navigation** — Focus states on interactive elements
4. **Scroll behavior** — Smooth scroll-to-top on page navigation

### Submission Checklist

**Pre-Submission:**
- [x] Core requirement met: AI-generated real reporting (no human in editorial path)
- [x] Optional features implemented: digest, Q&A, chat layer, trending sidebar
- [x] UI/UX polished per scoring criteria

**Deployment & Submission:**
1. Deploy to Netlify — The `netlify.toml` is already configured
2. Get live HTTPS URL from Netlify
3. Go to https://saasmarket.to and create a listing
4. Submit entry page URL before hype week ends (April 13, 2026)

**Scoring Estimate:**
| Category | Score (0-25) |
|----------|--------------|
| Editorial | ~22 - Strong AI-generated content |
| UI Design | ~20 - Custom design system |
| UX Design | ~20 - Clean routing, clear flows |
| Extras | ~18 - Chat, Q&A, digest layers |
| **Total JAI** | ~80/100 |

**Final Score (without Virlo multiplier):** ~80/100 × 1 = 80

### Running the Project

```powershell
# Start dev server
$env:NVIDIA_API_KEY='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'
$env:NVIDIA_BASE_URL='https://integrate.api.nvidia.com/v1'
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
