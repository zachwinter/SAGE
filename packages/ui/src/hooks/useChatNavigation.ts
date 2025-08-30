import { useState, useCallback } from "react";

export const useChatNavigation = (messageCount: number, maxVisible: number = 3) => {
  const [viewIndex, setViewIndex] = useState(0);

  const navigateUp = useCallback(() => {
    // Move up in the conversation history (show older messages)
    setViewIndex(prev => Math.min(prev + 1, Math.max(0, messageCount - maxVisible)));
  }, [messageCount, maxVisible]);

  const navigateDown = useCallback(() => {
    // Move down in the conversation history (show newer messages)
    setViewIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const resetNavigation = useCallback(() => {
    // Reset to show the most recent messages
    setViewIndex(0);
  }, []);

  // Calculate the start index for displaying messages
  const startIndex = Math.max(0, messageCount - maxVisible - viewIndex);
  const endIndex = Math.min(messageCount, startIndex + maxVisible);

  return {
    viewIndex,
    navigateUp,
    navigateDown,
    resetNavigation,
    startIndex,
    endIndex
  };
};
