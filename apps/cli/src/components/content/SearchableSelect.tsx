import { Search, SearchProps } from "./Search.js";
import { Text, Box, Row } from "../index.js";

export interface SelectOption {
  label: string;
  value: string;
  key?: string;
}

export interface SearchableSelectProps
  extends Omit<
    SearchProps<SelectOption>,
    "collection" | "renderItem" | "onSelect" | "getKey"
  > {
  options: SelectOption[];
  onChange?: (value: string) => void;
}

export const SearchableSelect = ({
  options,
  onChange,
  placeholder = `filter ${options.length} items`,
  ...searchProps
}: SearchableSelectProps) => {
  const handleSelect = (option: SelectOption) => {
    if (onChange) {
      onChange(option.value);
    }
  };

  const renderOption = (
    option: SelectOption,
    isSelected: boolean,
    index: number
  ) => (
    <Box
      key={`${option.value}-${index}`}
      paddingLeft={isSelected ? 0 : 1}
      borderStyle={isSelected ? "round" : undefined}
      borderColor={isSelected ? "magenta" : undefined}
    >
      <Row paddingLeft={1}>
        {option.label !== option.value ? (
          <Row gap={1}>
            <Row>
              <Text color="gray">(</Text>
              <Text color="magenta">
                {option.value === "escape" ? "ESC" : option.value?.toUpperCase()}
              </Text>
              <Text color="gray">)</Text>
            </Row>

            <Text>{option.label}</Text>
          </Row>
        ) : (
          <Text>{option.value}</Text>
        )}
      </Row>
    </Box>
  );

  return (
    <Search<SelectOption>
      collection={options}
      onSelect={handleSelect}
      placeholder={placeholder}
      renderItem={renderOption}
      getKey={(option, index) => `${option.value}-${index}`}
      {...searchProps}
    />
  );
};
