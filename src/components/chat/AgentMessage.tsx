import { useSnapshot } from "valtio";
import { state } from "@/threads/index.js";
import { Text } from "@/components/index.js";
import { memo } from "react";

export const AgentMessage = memo(() => {
  const snap = useSnapshot(state);
  return (
    <>
      <Text>{snap.response}</Text>
    </>
  );
});

AgentMessage.displayName = "AgentMessage";
