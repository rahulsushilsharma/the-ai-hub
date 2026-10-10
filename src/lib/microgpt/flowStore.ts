import { create } from "zustand";

/** Shared hover state: hover a letter or attention dot anywhere, everything related lights up. */
type FlowState = {
  hoverToken: number | null;
  hoverCell: { row: number; col: number } | null;
  replayTick: number; // bump to replay the full flow animation from anywhere
  replay: () => void;
  set: (p: Partial<Pick<FlowState, "hoverToken" | "hoverCell">>) => void;
};

export const useFlow = create<FlowState>((set) => ({
  hoverToken: null,
  hoverCell: null,
  replayTick: 0,
  replay: () => set((s) => ({ replayTick: s.replayTick + 1 })),
  set: (p) => set(p),
}));
