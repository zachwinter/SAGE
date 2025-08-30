import { render } from "ink";
import { getVersion } from "../../../../packages/utils/src/version";
import { Row, Text, View } from "../components";
import { theme } from "../config";

export function version() {
  render(
    <View>
      <Row gap={theme.padding}>
        <Text color={theme.primary}>SAGE</Text>
        <Text>{getVersion()}</Text>
      </Row>
    </View>
  );
}
