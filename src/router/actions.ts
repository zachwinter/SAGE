import { View, state, Cycleable } from "./state.js";

export function setView(view: View) {
  state.view = view;
}

export function cycleView() {
  const currentIndex = Cycleable.indexOf(state.view as (typeof Cycleable)[number]);
  const nextIndex = (currentIndex + 1) % Cycleable.length;
  state.view = Cycleable[nextIndex];
}
