const extractBracketedJson = (value: string): string | null => {
  const start = value.search(/[[{]/);
  if (start < 0) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === '{' || character === '[') {
      stack.push(character);
      continue;
    }

    if (character === '}' || character === ']') {
      const opener = stack.at(-1);
      if (
        (character === '}' && opener === '{') ||
        (character === ']' && opener === '[')
      ) {
        stack.pop();
        if (stack.length === 0) {
          return value.slice(start, index + 1);
        }
      }
    }
  }

  return null;
};

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fencedMatch?.[1]?.trim() ?? trimmed;
};

export const parseJsonWithRecovery = <T>(value: string): T => {
  const normalized = stripCodeFence(value);

  try {
    return JSON.parse(normalized) as T;
  } catch (primaryError) {
    const extracted = extractBracketedJson(normalized);

    if (extracted) {
      try {
        return JSON.parse(extracted) as T;
      } catch {
        // Fall through to the original error below.
      }
    }

    throw primaryError;
  }
};
