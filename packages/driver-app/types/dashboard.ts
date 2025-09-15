export interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: number;
  estimated_price: number;
  cargo_type: string;
  cargo_weight?: number;
  cargo_dimensions?: string;
  special_instructions?: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
}

export interface DriverInfo {
  id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  license_plate: string;
  rating: number;
  total_trips: number;
  is_online: boolean;
  current_location?: {
    latitude: number;
    longitude: number;
  };
  profile_image_url?: string;
}

export interface OrderData {
  id: number;
  pickupAddress: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destinationAddress: string;
  delivery_latitude: number;
  delivery_longitude: number;
  weight: number;
  laborCount: number;
  estimatedPrice: number;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  distance?: number;
  estimatedArrival?: number;
  cargo_photo_urls?: string;
}

export interface RoutePhase {
  id: string;
  type: 'pickup' | 'delivery';
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  completed: boolean;
  completed_at?: string;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface SocketEvents {
  'new-customer': (customer: Customer) => void;
  'customer-cancelled': (customerId: number) => void;
  'order-update': (order: OrderData) => void;
  'driver-location-update': (location: LocationCoords) => void;
}