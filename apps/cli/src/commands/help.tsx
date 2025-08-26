import { render } from "ink";
import { Command, View } from "../components";

export function help() {
  render(
    <View title="SAGE">
      <Command
        name="ask"
        description="begin or resume an interactive agent thread"
      />
      <Command
        name="ingest"
        description="analyze & ingest the current directory into Kuzu"
      />
    </View>
  );
}
