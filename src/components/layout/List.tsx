import { Text, Column } from "@/components/index.js";
import type { Key } from "react";

export const List = ({ title, items }: { title?: string; items: unknown[] }) => (
  <Column>
    {title && <Text variant="listTitle">{title}</Text>}
    {items.map((item, index) => {
      // More robust key generation logic
      let key: Key = index; // Default to index as a fallback

      if (typeof item === "string" || typeof item === "number") {
        // Use the primitive value itself (assumes uniqueness among siblings)
        key = item;
      } else if (typeof item === "object" && item !== null) {
        // Look for standard identifier properties
        const obj = item as Record<string, unknown>;
        if (
          obj.id != null &&
          (typeof obj.id === "string" || typeof obj.id === "number")
        ) {
          key = obj.id;
        } else if (
          obj.key != null &&
          (typeof obj.key === "string" || typeof obj.key === "number")
        ) {
          key = obj.key;
        } else if (obj.name != null && typeof obj.name === "string") {
          // Also try name as a fallback
          key = `${obj.name}-${index}`;
        }
      }

      return (
        <Text key={key}>
          {typeof item === "string" ? item : JSON.stringify(item)}
        </Text>
      );
    })}
  </Column>
);
