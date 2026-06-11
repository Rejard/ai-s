const COUNCIL_BRIEFING_MAX_OUTPUT_TOKENS = 8192;
const COUNCIL_BRIEFING_MAX_CHARS = 600;

function makeCouncilBriefingGenerationConfig() {
  return {
    maxOutputTokens: COUNCIL_BRIEFING_MAX_OUTPUT_TOKENS,
    temperature: 0.7
  };
}

function extractCompleteGeminiText(responseData) {
  const candidate = responseData && responseData.candidates && responseData.candidates[0];
  const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
    ? candidate.content.parts
    : [];
  const text = parts
    .map(part => part && typeof part.text === 'string' ? part.text : '')
    .join('')
    .trim();

  if (candidate && candidate.finishReason === 'MAX_TOKENS') {
    const err = new Error('Gemini council briefing response was truncated by max output tokens');
    err.code = 'GEMINI_RESPONSE_TRUNCATED';
    throw err;
  }

  if (!text) {
    const err = new Error('Gemini council briefing response did not include text');
    err.code = 'GEMINI_RESPONSE_EMPTY';
    throw err;
  }

  return text.length > COUNCIL_BRIEFING_MAX_CHARS
    ? text.slice(0, COUNCIL_BRIEFING_MAX_CHARS).trimEnd()
    : text;
}

module.exports = {
  COUNCIL_BRIEFING_MAX_CHARS,
  COUNCIL_BRIEFING_MAX_OUTPUT_TOKENS,
  extractCompleteGeminiText,
  makeCouncilBriefingGenerationConfig
};
