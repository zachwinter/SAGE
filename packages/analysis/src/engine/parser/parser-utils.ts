export interface ContextLine {
  number: number;
  content: string;
}

export function getContextLines(
  lines: string[],
  lineNumber: number,
  contextSize: number
): ContextLine[] {
  if (!contextSize || contextSize === 0) return [];

  const contextLines: ContextLine[] = [];
  const startLine = Math.max(0, lineNumber - contextSize - 1);
  const endLine = Math.min(lines.length - 1, lineNumber + contextSize - 1);

  for (let i = startLine; i <= endLine; i++) {
    if (i !== lineNumber - 1) {
      // Skip the actual entity line since it's already in signature
      contextLines.push({
        number: i + 1,
        content: lines[i]
      });
    }
  }

  return contextLines;
}
