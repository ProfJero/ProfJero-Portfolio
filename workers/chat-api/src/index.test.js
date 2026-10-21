import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const origin = "https://profjero.pages.dev";
const request = (body, headers = {}) => new Request("https://worker.example/api/chat", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

test("allows CORS preflight only for approved site origins", async () => {
  const ok = await worker.fetch(new Request("https://worker.example/api/chat", { method: "OPTIONS", headers: { Origin: origin } }), {});
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), origin);
  const no = await worker.fetch(new Request("https://worker.example/api/chat", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), {});
  assert.equal(no.status, 403);
});

test("rejects requests from unapproved origins", async () => {
  const response = await worker.fetch(request({ message: "hello" }, { Origin: "https://evil.example" }), { AI: { run: async () => ({ response: "no" }) } });
  assert.equal(response.status, 403);
});

test("reports missing Workers AI binding clearly", async () => {
  const response = await worker.fetch(request({ message: "What do you do?" }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /AI is not configured/i);
});

test("validates empty messages", async () => {
  const response = await worker.fetch(request({ message: "  " }), { AI: { run: async () => ({ response: "unused" }) } });
  assert.equal(response.status, 400);
});

test("returns an AI answer using the provided business context", async () => {
  let input;
  const response = await worker.fetch(request({ message: "How much is the website?", context: "Business website: GH₵ 9,500" }), {
    AI: { run: async (model, args) => { input = { model, args }; return { response: "The business website starts at GH₵ 9,500." }; } }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, "The business website starts at GH₵ 9,500.");
  assert.equal(input.model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.match(input.args.messages[0].content, /GH₵ 9,500/);
});
