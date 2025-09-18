import type { ReactNode } from "react";
import { BuilderShell } from "./components/BuilderShell";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <BuilderShell>{children}</BuilderShell>;
}
