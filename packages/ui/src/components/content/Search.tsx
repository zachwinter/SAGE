import { useInput } from "ink";
import { useEffect, useState } from "react";
import { Column, Text, TextInput } from "../../components";

const MAX_VISIBLE_ITEMS = 15;

export interface SearchProps<T> {
  collection: T[];
  onSelect?: (item: T) => void;
  onKeySelect?: (item: T) => void;
  placeholder?: string;
  maxItems?: number;
  filterFn?: (item: T, query: string) => boolean;
  renderItem: (item: T, isSelected: boolean, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => string;
  // Controlled state props (optional)
  query?: string;
  onQueryChange?: (query: string) => void;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  isSearchFocused?: boolean;
  onSearchFocusChange?: (focused: boolean) => void;
  showInput?: boolean;
}

export const Search = <T,>({
  collection,
  onSelect,
  onKeySelect,
  placeholder = `filter ${collection.length} items`,
  maxItems = MAX_VISIBLE_ITEMS,
  filterFn = (item: T, query: string) =>
    JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
  renderItem,
  getKey = (_, index) => index.toString(),
  query: controlledQuery,
  onQueryChange,
  selectedIndex: controlledSelectedIndex,
  onSelectedIndexChange,
  showInput
}: SearchProps<T>) => {
  const [internalQuery, setInternalQuery] = useState("");
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);

  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const selectedIndex =
    controlledSelectedIndex !== undefined
      ? controlledSelectedIndex
      : internalSelectedIndex;

  const setQuery = (newQuery: string) => {
    if (onQueryChange) {
      onQueryChange(newQuery);
    } else {
      setInternalQuery(newQuery);
    }
  };

  const setSelectedIndex = (newIndex: number) => {
    if (onSelectedIndexChange) {
      onSelectedIndexChange(newIndex);
    } else {
      setInternalSelectedIndex(newIndex);
    }
  };

  const filtered = collection.filter(item => filterFn(item, query));

  // Calculate the visible window of items
  const startIndex = Math.max(0, selectedIndex - Math.floor(maxItems / 2));
  const endIndex = Math.min(filtered.length, startIndex + maxItems);
  const adjustedStartIndex = Math.max(0, endIndex - maxItems);
  const sliced = filtered.slice(adjustedStartIndex, endIndex);

  useEffect(() => {
    if (controlledSelectedIndex === undefined) {
      setInternalSelectedIndex(0);
    }
  }, [query, controlledSelectedIndex]);

  useInput((input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < filtered.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    if (key.return && onSelect && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]);
    }

    // Handle key-based selection
    if (onKeySelect && input) {
      const matchingItem = filtered.find((item: any) => {
        const itemKey = item.key?.toLowerCase();
        const inputKey = input.toLowerCase();
        const isEscapeKey = input === "escape" && key.escape;
        return itemKey === inputKey || isEscapeKey;
      });

      if (matchingItem) {
        onKeySelect(matchingItem);
      }
    }
  });

  return (
    <Column>
      {showInput !== false && (
        <TextInput
          placeholder={placeholder}
          value={query}
          setValue={e => setQuery(e)}
        />
      )}
      <Column>
        {sliced.map((item, i) => {
          const actualIndex = adjustedStartIndex + i;
          const isSelected = actualIndex === selectedIndex;
          return renderItem(item, isSelected, actualIndex);
        })}
      </Column>
      <Column paddingTop={1}>
        <Text dimColor>
          {`NAVIGATE: ↑↓  •  Select: ENTER  •  (${selectedIndex + 1}/${filtered.length})`}
        </Text>
      </Column>
    </Column>
  );
};
