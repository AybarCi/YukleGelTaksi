import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_CONFIG } from '../../config/api';

// Types
export interface RouteStep {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  html_instructions: string;
  polyline: {
    points: string;
  };
  start_location: {
    lat: number;
    lng: number;
  };
  travel_mode: string;
}

export interface RouteLeg {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  end_address: string;
  end_location: {
    lat: number;
    lng: number;
  };
  start_address: string;
  start_location: {
    lat: number;
    lng: number;
  };
  steps: RouteStep[];
}

export interface RouteData {
  bounds: {
    northeast: {
      lat: number;
      lng: number;
    };
    southwest: {
      lat: number;
      lng: number;
    };
  };
  copyrights: string;
  legs: RouteLeg[];
  overview_polyline: {
    points: string;
  };
  summary: string;
  warnings: string[];
  waypoint_order: number[];
}

export interface DirectionsResponse {
  geocoded_waypoints: any[];
  routes: RouteData[];
  status: string;
}

export interface RouteState {
  currentRoute: RouteData | null;
  routePolyline: string | null;
  totalDistance: number;
  totalDuration: number;
  loading: boolean;
  error: string | null;
}

const initialState: RouteState = {
  currentRoute: null,
  routePolyline: null,
  totalDistance: 0,
  totalDuration: 0,
  loading: false,
  error: null,
};

// Async Thunks
export const getDirectionsRoute = createAsyncThunk(
  'route/getDirections',
  async (
    {
      origin,
      destination,
      waypoints,
      travelMode = 'DRIVING',
    }: {
      origin: string;
      destination: string;
      waypoints?: string[];
      travelMode?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const GOOGLE_MAPS_API_KEY = API_CONFIG.GOOGLE_MAPS_API_KEY;
      
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(destination)}&mode=${travelMode}&key=${GOOGLE_MAPS_API_KEY}`;

      if (waypoints && waypoints.length > 0) {
        const waypointsStr = waypoints.map(wp => encodeURIComponent(wp)).join('|');
        url += `&waypoints=${waypointsStr}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DirectionsResponse = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Directions API error: ${data.status}`);
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('Rota bulunamadı');
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        route,
        polyline: route.overview_polyline.points,
        totalDistance: leg.distance.value,
        totalDuration: leg.duration.value,
      };
    } catch (error: any) {
      console.error('Rota alınırken hata:', error);
      return rejectWithValue(error.message || 'Rota alınamadı');
    }
  }
);

export const calculateRouteWithCoordinates = createAsyncThunk(
  'route/calculateWithCoordinates',
  async (
    {
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      travelMode = 'DRIVING',
    }: {
      originLat: number;
      originLng: number;
      destinationLat: number;
      destinationLng: number;
      travelMode?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const GOOGLE_MAPS_API_KEY = API_CONFIG.GOOGLE_MAPS_API_KEY;
      
      const origin = `${originLat},${originLng}`;
      const destination = `${destinationLat},${destinationLng}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${travelMode}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DirectionsResponse = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Directions API error: ${data.status}`);
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('Rota bulunamadı');
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        route,
        polyline: route.overview_polyline.points,
        totalDistance: leg.distance.value,
        totalDuration: leg.duration.value,
      };
    } catch (error: any) {
      console.error('Koordinatlarla rota hesaplanırken hata:', error);
      return rejectWithValue(error.message || 'Rota hesaplanamadı');
    }
  }
);

// Slice
const routeSlice = createSlice({
  name: 'route',
  initialState,
  reducers: {
    clearRoute: (state) => {
      state.currentRoute = null;
      state.routePolyline = null;
      state.totalDistance = 0;
      state.totalDuration = 0;
    },
    setRoutePolyline: (state, action: PayloadAction<string>) => {
      state.routePolyline = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Directions Route
      .addCase(getDirectionsRoute.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getDirectionsRoute.fulfilled, (state, action) => {
        state.loading = false;
        state.currentRoute = action.payload.route;
        state.routePolyline = action.payload.polyline;
        state.totalDistance = action.payload.totalDistance;
        state.totalDuration = action.payload.totalDuration;
        state.error = null;
      })
      .addCase(getDirectionsRoute.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Calculate Route with Coordinates
      .addCase(calculateRouteWithCoordinates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(calculateRouteWithCoordinates.fulfilled, (state, action) => {
        state.loading = false;
        state.currentRoute = action.payload.route;
        state.routePolyline = action.payload.polyline;
        state.totalDistance = action.payload.totalDistance;
        state.totalDuration = action.payload.totalDuration;
        state.error = null;
      })
      .addCase(calculateRouteWithCoordinates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearRoute, setRoutePolyline, clearError } = routeSlice.actions;
export default routeSlice.reducer;