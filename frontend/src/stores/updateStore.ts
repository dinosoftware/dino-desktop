import { create } from 'zustand';
import type { UpdateInfo, DownloadProgress } from '@/platform/types';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  errorMessage: string | null;
  isAppImage: boolean | null;

  setUpdateStatus: (status: UpdateStatus) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setProgress: (progress: DownloadProgress | null) => void;
  setError: (msg: string | null) => void;
  setIsAppImage: (val: boolean) => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  updateInfo: null,
  progress: null,
  errorMessage: null,
  isAppImage: null,

  setUpdateStatus: (status) => set({ status }),
  setUpdateInfo: (updateInfo) => set({ updateInfo }),
  setProgress: (progress) => set({ progress }),
  setError: (errorMessage) => set({ errorMessage }),
  setIsAppImage: (isAppImage) => set({ isAppImage }),
  reset: () => set({ status: 'idle', updateInfo: null, progress: null, errorMessage: null }),
}));
