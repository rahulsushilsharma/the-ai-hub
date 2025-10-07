import type { Message, Session } from "@/types/types";
import { create } from "zustand";

type Store = {
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
};

const useAppStore = create<Store>()((set) => ({
  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => {
    set((state) => ({ sessions: [...state.sessions, session] }));
  },
  removeSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    }));
  },
  renameSession: (sessionId, newName) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, name: newName } : s
      ),
    }));
  },
  messages: [],
  setMessages: (messages) => set({ messages }),
}));

export { useAppStore };
