import { render } from "ink";
import { Row, Text, View } from "../components";
import { theme } from "../config";
import { getVersion } from "../utils/version";

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
