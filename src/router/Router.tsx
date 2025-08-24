import { type FC } from "react";
import { useSnapshot } from "valtio";
import * as app from "./state.js";
import { Text } from "@/components/index.js";
import * as Views from "@/views/index.js";

export const Router: FC = () => {
  const { view } = useSnapshot(app.state);

  const renderView = () => {
    switch (view) {
      case app.Home:
        return <Views.Home />;
      case app.Menu:
        return <Views.Menu />;
      case app.Threads:
        return <Views.Threads />;
      case app.SelectModel:
        return <Views.SelectModel />;
      case app.MCPMenu:
        return <Views.MCPMenu />;
      case app.DiscoverMCP:
        return <Views.DiscoverMCP />;
      case app.ManageMCP:
        return <Views.ManageMCP />;
      case app.MCPTools:
        return <Views.MCPTools />;
      default:
        return <Text>`{view}` doesn't exist. How did you even get here?</Text>;
    }
  };

  return renderView();
};
