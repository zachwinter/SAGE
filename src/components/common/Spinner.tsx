import { Spinner as InkSpinner } from "@inkjs/ui";
import type { SpinnerName } from "cli-spinners";
import type { FC } from "react";
import { theme } from "@/config";

interface SpinnerProps {
  type?: SpinnerName;
}

export const Spinner: FC<SpinnerProps> = ({ type }) => {
  const spinnerType = type || (theme.spinner as SpinnerName) || "dots";
  return <InkSpinner type={spinnerType} />;
};

export type { SpinnerName };
