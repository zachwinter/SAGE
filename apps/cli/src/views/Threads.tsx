import { View } from "../components/index";
import type { KeyBinding } from "../components/layout/View";
import { setView } from "../router/actions";
import { Home } from "../router/state";
import { state as threadState } from "../threads/state/state";

export const Threads = () => {
  const keyBindings: KeyBinding[] = [
    {
      key: "n",
      action: () => {
        // Create a new thread by resetting the active thread state
        threadState.active = null;
        threadState.activeThreadId = null;

        // Navigate to Home view to start the new thread
        setView(Home);
      },
      label: "Start New Thread"
    },
    {
      key: "escape",
      action: () => setView(Home),
      label: "Back to Home"
    }
  ];

  return (
    <View
      title="Threads"
      keyBindings={keyBindings}
    />
  );
};
