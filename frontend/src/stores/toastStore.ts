import { create } from 'zustand';

interface ToastState {
  message: string | null;
  icon: string | null;
  showToast: (message: string, icon?: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  icon: null,
  showToast: (message, icon) => {
    set({ message, icon: icon ?? null });
    setTimeout(() => set({ message: null, icon: null }), 2000);
  },
}));
