// OPTIONAL local language model support. Never required, never paid, no API keys.
// Works with a model running on the player's own computer:
//   • Ollama  (https://ollama.com)  – default endpoint http://localhost:11434
//   • LM Studio / any OpenAI-compatible local server – e.g. http://localhost:1234/v1
// The rule-based engine still decides WHAT the caller knows and reveals; the model
// only rephrases that answer in character. If the model is slow or unreachable the
// game silently uses the rule-based line, so gameplay never depends on it.
// Note: browsers block requests to localhost from some hosted pages unless the
// local server allows the page's origin (for Ollama set OLLAMA_ORIGINS="*").

export class LocalLLM {
  constructor(settings) { this.settings = settings; this.status = 'off'; this.lastError = ''; }
  get cfg() { return this.settings.data.llm; }
  get enabled() { return !!this.cfg.enabled && this.status !== 'error'; }

  async request(messages, { timeout = 7000, maxTokens = 90 } = {}) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const base = this.cfg.endpoint.replace(/\/$/, '');
      let res, text;
      if (this.cfg.kind === 'ollama') {
        res = await fetch(`${base}/api/chat`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.cfg.model, messages, stream: false, options: { temperature: 0.8, num_predict: maxTokens } }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = (await res.json())?.message?.content;
      } else {
        res = await fetch(`${base}/chat/completions`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.cfg.model, messages, temperature: 0.8, max_tokens: maxTokens }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = (await res.json())?.choices?.[0]?.message?.content;
      }
      return (text || '').trim();
    } finally { clearTimeout(timer); }
  }

  async test() {
    try {
      const out = await this.request([{ role: 'user', content: 'Reply with the single word: ready' }], { timeout: 12000, maxTokens: 5 });
      this.status = out ? 'ok' : 'error'; this.lastError = out ? '' : 'Empty reply';
      return { ok: !!out, reply: out };
    } catch (e) { this.status = 'error'; this.lastError = e.name === 'AbortError' ? 'Timed out' : e.message; return { ok: false, error: this.lastError }; }
  }

  /** Rephrase a caller reply in character, keeping every fact. */
  async rephrase(call, dispatcherText, ruleReply) {
    const sc = call.sc;
    const sys = `You are role-playing a person who called 911 in a video game. Persona: ${sc.caller.persona}. Situation: ${sc.nature}. ` +
      'Rewrite the DRAFT reply so it sounds natural for this persona, in 1-2 short spoken sentences. Keep every fact, number, name and address exactly as in the draft. ' +
      'Do not add new facts. Do not mention being an AI. Output only the reply.';
    const recent = call.transcript.slice(-6).map((l) => `${l.who === 'dispatcher' ? 'Dispatcher' : l.who === 'caller' ? 'Caller' : 'System'}: ${l.text}`).join('\n');
    const user = `Conversation so far:\n${recent}\n\nDispatcher just said: "${dispatcherText}"\nDRAFT reply: "${ruleReply}"`;
    try {
      const out = await this.request([{ role: 'system', content: sys }, { role: 'user', content: user }]);
      const cleaned = out.replace(/^["']|["']$/g, '').replace(/^Caller:\s*/i, '').trim();
      // guard: keep the rule reply if the model dropped key digits (addresses/phones)
      const digits = (ruleReply.match(/\d{2,}/g) || []);
      if (!cleaned || digits.some((d) => !cleaned.includes(d)) || cleaned.length > ruleReply.length * 3 + 80) return ruleReply;
      return cleaned;
    } catch (e) { this.lastError = e.message; return ruleReply; }
  }

  async staffReply(npc, playerText, ruleReply) {
    const sys = `You are ${npc.name}, ${npc.role} at a 911 dispatch center in a video game. Personality: ${npc.personality}. ` +
      'Answer the player in 1-3 short friendly sentences. Use the DRAFT for any facts. Output only your reply.';
    try { const out = await this.request([{ role: 'system', content: sys }, { role: 'user', content: `Player says: "${playerText}"\nDRAFT: "${ruleReply}"` }]); return out || ruleReply; }
    catch { return ruleReply; }
  }
}
