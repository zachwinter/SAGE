import { highlight } from "cli-highlight";
import { Text } from "../../components";

export const Code = ({
  children,
  language
}: {
  children: string;
  language?: string;
}) => {
  let highlightedContent: string;
  let appliedLanguage = language;

  switch (language) {
    case "ts":
    case "tsx":
      appliedLanguage = "typescript";
      break;
    case "js":
    case "jsx":
      appliedLanguage = "javascript";
      break;
  }

  try {
    highlightedContent = highlight(children, {
      language: appliedLanguage,
      ignoreIllegals: true
    });
  } catch (e) {
    highlightedContent = children;
  }

  return <Text>{highlightedContent}</Text>;
};
