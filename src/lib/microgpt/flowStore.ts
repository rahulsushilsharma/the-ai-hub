import { create } from "zustand";

/** Shared hover state: hover a letter or attention dot anywhere, everything related lights up. */
type FlowState = {
  hoverToken: number | null;
  hoverCell: { row: number; col: number } | null;
  set: (p: Partial<Pick<FlowState, "hoverToken" | "hoverCell">>) => void;
};

export const useFlow = create<FlowState>((set) => ({
  hoverToken: null,
  hoverCell: null,
  set: (p) => set(p),
}));
