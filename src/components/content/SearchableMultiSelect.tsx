import { Search, SearchProps } from "./Search.js";
import { Text, Box, Row, Column } from "../index.js";

export interface MultiSelectOption {
  label: string;
  value: string;
  key?: string;
  selected?: boolean;
  description?: string;
  status?: "connected" | "connecting" | "error" | "disconnected" | "not_added";
  statusMessage?: string;
}

export interface SearchableMultiSelectProps
  extends Omit<
    SearchProps<MultiSelectOption>,
    "collection" | "renderItem" | "onSelect" | "onKeySelect" | "getKey"
  > {
  options: MultiSelectOption[];
  onToggle?: (value: string) => void;
  onRemove?: (value: string) => void;
  groupBy?: (option: MultiSelectOption) => string;
}

export const SearchableMultiSelect = ({
  options,
  onToggle,
  onRemove,
  placeholder = `manage ${options.length} items`,
  groupBy,
  ...searchProps
}: SearchableMultiSelectProps) => {
  const handleSelect = (option: MultiSelectOption) => {
    if (onToggle) {
      onToggle(option.value);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "connected":
        return "green";
      case "connecting":
        return "yellow";
      case "error":
        return "red";
      case "disconnected":
        return "gray";
      default:
        return "gray";
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "connected":
        return "✓";
      case "connecting":
        return "⋯";
      case "error":
        return "✗";
      case "disconnected":
        return "○";
      default:
        return "?";
    }
  };

  const renderOption = (
    option: MultiSelectOption,
    isSelected: boolean,
    index: number
  ) => {
    const statusColor = getStatusColor(option.status);
    const statusIcon = getStatusIcon(option.status);

    return (
      <Box
        key={`${option.value}-${index}`}
        paddingLeft={1}
        borderStyle={isSelected ? "round" : undefined}
        borderColor={isSelected ? "magenta" : undefined}
      >
        <Column>
          <Row gap={1}>
            {/* Selection checkbox */}
            <Text color={option.selected ? "green" : "red"}>
              {option.selected ? "✓" : "○"}
            </Text>

            {/* Server name */}
            <Text color="magenta">{option.label}</Text>

            {/* Status indicator */}
            {option.status && (
              <>
                <Text color={statusColor}>{statusIcon}</Text>
                <Text color={statusColor}>{option.statusMessage}</Text>
              </>
            )}
          </Row>

          {/* Description/command line */}
          {option.description && (
            <Row paddingLeft={2}>
              <Text dimColor>{option.description}</Text>
            </Row>
          )}

          {/* Controls hint */}
          {isSelected && (
            <Row paddingLeft={2}>
              <Text dimColor>[SPACE] toggle [R] remove</Text>
            </Row>
          )}
        </Column>
      </Box>
    );
  };

  const handleKeySelect = (option: MultiSelectOption) => {
    // This gets called when a key matches option.key, so we check the key value
    if (option.key === " " || option.key === "enter") {
      // Toggle with space or enter
      if (onToggle) onToggle(option.value);
    } else if (option.key === "r") {
      // Remove with 'r'
      if (onRemove) onRemove(option.value);
    }
  };

  // Group options if groupBy function is provided
  let displayOptions = options;
  if (groupBy) {
    const grouped = options.reduce(
      (acc, option) => {
        const group = groupBy(option);
        if (!acc[group]) acc[group] = [];
        acc[group].push(option);
        return acc;
      },
      {} as Record<string, MultiSelectOption[]>
    );

    // Flatten with group headers
    displayOptions = [];
    Object.entries(grouped).forEach(([groupName, groupOptions]) => {
      // Add a header option (non-selectable)
      displayOptions.push({
        label: `─── ${groupName} ───`,
        value: `header-${groupName}`,
        key: `header-${groupName}`
      });
      displayOptions.push(...groupOptions);
    });
  }

  return (
    <Search<MultiSelectOption>
      collection={displayOptions}
      onSelect={handleSelect}
      onKeySelect={handleKeySelect}
      placeholder={placeholder}
      renderItem={renderOption}
      getKey={(option, index) => option.key || `${option.value}-${index}`}
      {...searchProps}
    />
  );
};
