import { CHAT_MODELS } from "@/consts/consts";
import type { ChatSettings, Message, Model, Session } from "@/types/types";
import { create } from "zustand";

type StoreState = {
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  appState: {
    settingsOpen: boolean;
  };
  setAppState: (appState: StoreState["appState"]) => void;
};

type ChatSettingsState = {
  settings: ChatSettings;
  model: Model;
  setChatSettings: (settings: ChatSettings) => void;
  setModel: (model: Model) => void;
};

const useAppStore = create<StoreState>()((set) => ({
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
  appState: { settingsOpen: false },
  setAppState: (appState) =>
    set((state) => {
      return { appState: { ...state.appState, ...appState } };
    }),
}));

const useChatSettings = create<ChatSettingsState>()((set) => ({
  settings: {
    temperature: 0.7,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    max_new_tokens: 512,
    stream: true,
    model: "",
    modelType: "api",
  },
  setChatSettings: (settings) => set({ settings }),
  model: {
    ...CHAT_MODELS[0],
    loaded: false,
  },
  setModel: (model) => set({ model }),
}));
export { useAppStore, useChatSettings };
