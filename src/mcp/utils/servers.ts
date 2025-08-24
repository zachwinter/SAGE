import type { MultiSelectOption } from "@/components/content/SearchableMultiSelect.js";

export function groupServersByRepo(option: MultiSelectOption): string {
  const colonIndex = option.label.indexOf(": ");
  if (colonIndex > 0) return option.label.substring(0, colonIndex);
  return "Other";
}
