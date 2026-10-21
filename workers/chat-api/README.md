# ProfJero Chat API (Cloudflare Workers)

This Worker replaces Firebase Cloud Functions for the public AI chat. Firestore remains the conversation store and Firebase Authentication remains unchanged.

## Deploy

1. Install Wrangler at the repository root: `npm install`.
2. From `workers/chat-api`, run `npx wrangler login` if needed.
3. Deploy: `npx wrangler deploy`.
4. In Cloudflare Workers & Pages, open the Worker settings and ensure the Workers AI binding named `AI` is enabled (the `wrangler.toml` declares it).
5. Copy the deployed Worker URL and set `window.PROFJERO_CHAT_API` to that URL plus `/api/chat` in each site's shared site bootstrap, or use a same-origin route/proxy to forward `/api/chat` to this Worker.
6. The allowed origin list in `src/index.js` intentionally permits only the two production sites. Add local development origins only while testing, then remove them.

The Worker has no Firebase Admin credentials and does not use Firebase Cloud Functions. AI answers are written to the visitor's own thread by the browser, subject to Firestore rules. Human handoff stops automatic AI replies for that thread.

## Important

- The first deploy is not complete until the AI binding is available and the frontend API URL points to the deployed Worker.
- Worker AI usage is subject to Cloudflare account availability, limits and billing.
- Do not put provider secrets in browser JavaScript.
