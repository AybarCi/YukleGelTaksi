import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface Modal {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  buttons: ModalButton[];
}

interface UiState {
  modal: Modal;
  isNetworkConnected: boolean;
  theme: 'light' | 'dark';
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
  };
  loading: {
    global: boolean;
    overlay: boolean;
  };
}

const initialState: UiState = {
  modal: {
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  },
  isNetworkConnected: true,
  theme: 'light',
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
  },
  loading: {
    global: false,
    overlay: false,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showModal: (
      state,
      action: PayloadAction<{
        title: string;
        message: string;
        type: 'success' | 'warning' | 'error' | 'info';
        buttons?: ModalButton[];
      }>
    ) => {
      state.modal = {
        visible: true,
        title: action.payload.title,
        message: action.payload.message,
        type: action.payload.type,
        buttons: action.payload.buttons || [
          {
            text: 'Tamam',
            onPress: () => {},
            style: 'default',
          },
        ],
      };
    },
    hideModal: (state) => {
      state.modal.visible = false;
    },
    setNetworkStatus: (state, action: PayloadAction<boolean>) => {
      state.isNetworkConnected = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    updateNotificationSettings: (
      state,
      action: PayloadAction<Partial<UiState['notifications']>>
    ) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    setOverlayLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.overlay = action.payload;
    },
  },
});

export const {
  showModal,
  hideModal,
  setNetworkStatus,
  setTheme,
  updateNotificationSettings,
  setGlobalLoading,
  setOverlayLoading,
} = uiSlice.actions;

export default uiSlice.reducer;