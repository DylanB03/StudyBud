import { describe, expect, it } from 'vitest';

import { parseJsonWithRecovery } from './json-repair';

describe('parseJsonWithRecovery', () => {
  it('extracts a JSON object from fenced wrapper text', () => {
    const result = parseJsonWithRecovery<{ questions: Array<{ prompt: string }> }>(`
Here is the response:

\`\`\`json
{
  "questions": [
    { "prompt": "Recovered question" }
  ]
}
\`\`\`
`);

    expect(result.questions[0]?.prompt).toBe('Recovered question');
  });
});
