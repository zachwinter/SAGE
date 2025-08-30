import { proxy } from "valtio";

export const Home = "Home";
export const Menu = "Menu";
export const Threads = "Threads";
export const SelectModel = "SelectModel";
export const SelectProvider = "SelectProvider";

export const Views = [
  Home,
  Menu,
  Threads,
  SelectModel,
  SelectProvider
] as const;

export type View = (typeof Views)[number];
export const Cycleable = [Home, Menu] as const;
export const state = proxy<{
  initialized: boolean;
  view: View;
}>({
  initialized: false,
  view: Home
});
