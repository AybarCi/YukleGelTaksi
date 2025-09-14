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

interface RideRequest {
  id: number;
  passenger_name: string;
  pickup_location: string;
  destination: string;
  distance: number;
  estimated_fare: number;
  pickup_coordinates: {
    latitude: number;
    longitude: number;
  };
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
  rideRequest: {
    visible: boolean;
    data: RideRequest | null;
    timeLeft: number;
  };
  mapSettings: {
    showTraffic: boolean;
    followLocation: boolean;
    mapType: 'standard' | 'satellite' | 'hybrid';
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
  rideRequest: {
    visible: false,
    data: null,
    timeLeft: 0,
  },
  mapSettings: {
    showTraffic: false,
    followLocation: true,
    mapType: 'standard',
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
    showRideRequest: (state, action: PayloadAction<{ data: RideRequest; timeLeft: number }>) => {
      state.rideRequest = {
        visible: true,
        data: action.payload.data,
        timeLeft: action.payload.timeLeft,
      };
    },
    hideRideRequest: (state) => {
      state.rideRequest = {
        visible: false,
        data: null,
        timeLeft: 0,
      };
    },
    updateRideRequestTimer: (state, action: PayloadAction<number>) => {
      state.rideRequest.timeLeft = action.payload;
      if (action.payload <= 0) {
        state.rideRequest.visible = false;
        state.rideRequest.data = null;
      }
    },
    updateMapSettings: (
      state,
      action: PayloadAction<Partial<UiState['mapSettings']>>
    ) => {
      state.mapSettings = { ...state.mapSettings, ...action.payload };
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
  showRideRequest,
  hideRideRequest,
  updateRideRequestTimer,
  updateMapSettings,
} = uiSlice.actions;

export default uiSlice.reducer;