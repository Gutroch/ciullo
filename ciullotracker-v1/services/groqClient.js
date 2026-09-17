const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

/**
 * Esegue una chiamata di chat completion a Groq, con eventuale
 * supporto ai tools (function calling).
 *
 * @param {Object} params
 * @param {Array}  params.messages - array di messaggi in formato OpenAI
 *                 ({ role: 'system'|'user'|'assistant'|'tool', content, ... })
 * @param {Array}  [params.tools]  - definizioni dei tool disponibili
 * @param {string} [params.tool_choice] - 'auto' | 'none' | ...
 * @param {number} [params.temperature]
 * @returns {Promise<Object>} il messaggio dell'assistente (choices[0].message)
 */
async function chatCompletion({ messages, tools, tool_choice, temperature = 0.3 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY non configurata');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const body = {
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    messages,
    temperature,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = tool_choice || 'auto';
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`Groq API error ${response.status}: ${errText}`);
    err.code = 'GROQ_API_ERROR';
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const choice = data.choices && data.choices[0];
  if (!choice) {
    throw new Error('Risposta Groq priva di "choices"');
  }
  return choice.message;
}

module.exports = { chatCompletion };
