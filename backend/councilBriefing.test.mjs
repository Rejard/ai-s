import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  COUNCIL_BRIEFING_MAX_CHARS,
  COUNCIL_BRIEFING_MAX_OUTPUT_TOKENS,
  extractCompleteGeminiText,
  makeCouncilBriefingGenerationConfig
} = require('./councilBriefing.js');

const completeResponse = {
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [
          { text: '완성된 후보군 특징 분석입니다.' }
        ]
      }
    }
  ]
};

assert.equal(
  extractCompleteGeminiText(completeResponse),
  '완성된 후보군 특징 분석입니다.'
);

const truncatedResponse = {
  candidates: [
    {
      finishReason: 'MAX_TOKENS',
      content: {
        parts: [
          { text: '중간에서 끊긴 후보군 특징 분석' }
        ]
      }
    }
  ]
};

assert.throws(
  () => extractCompleteGeminiText(truncatedResponse),
  /truncated/i
);

assert.ok(
  COUNCIL_BRIEFING_MAX_OUTPUT_TOKENS >= 4096,
  'long-form council briefing needs enough output tokens'
);

assert.deepEqual(
  makeCouncilBriefingGenerationConfig(),
  {
    maxOutputTokens: COUNCIL_BRIEFING_MAX_OUTPUT_TOKENS,
    temperature: 0.7
  }
);

const longText = '가'.repeat(700);
const longResponse = {
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [
          { text: longText }
        ]
      }
    }
  ]
};

assert.equal(COUNCIL_BRIEFING_MAX_CHARS, 600);
assert.equal(
  extractCompleteGeminiText(longResponse).length,
  COUNCIL_BRIEFING_MAX_CHARS
);

console.log('councilBriefing tests passed');
