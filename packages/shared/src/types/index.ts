// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver extends User {
  licenseNumber: string;
  vehicleInfo: VehicleInfo;
  rating: number;
  totalRides: number;
  isAvailable: boolean;
  location?: Location;
}

export interface Customer extends User {
  rating: number;
  totalRides: number;
}

// Location Types
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp?: Date;
}

// Vehicle Types
export interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  capacity: number;
}

// Ride Types
export interface Ride {
  id: string;
  customerId: string;
  driverId?: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  status: RideStatus;
  fare?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum RideStatus {
  REQUESTED = 'requested',
  ACCEPTED = 'accepted',
  DRIVER_ARRIVING = 'driver_arriving',
  DRIVER_ARRIVED = 'driver_arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Socket Event Types
export interface SocketEvents {
  // Driver Events
  driver_connect: { driverId: string; location: Location };
  driver_disconnect: { driverId: string };
  location_update: { driverId: string; location: Location };
  availability_update: { driverId: string; isAvailable: boolean };
  ride_accept: { rideId: string; driverId: string };
  ride_status_update: { rideId: string; status: RideStatus; location?: Location };

  // Customer Events
  customer_connect: { customerId: string };
  customer_disconnect: { customerId: string };
  customer_location_update: { customerId: string; location: Location };
  ride_request: { customerId: string; pickupLocation: Location; dropoffLocation: Location };
  ride_cancel: { rideId: string; customerId: string };

  // Broadcast Events
  nearbyDriversUpdate: { drivers: Driver[] };
  rideUpdate: { ride: Ride };
  driverLocationUpdate: { driverId: string; location: Location };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Navigation Types
export interface NavigationParams {
  // Customer App
  CustomerHome: undefined;
  CustomerProfile: undefined;
  CustomerRideHistory: undefined;
  CustomerRideRequest: { pickupLocation?: Location; dropoffLocation?: Location };
  CustomerRideTracking: { rideId: string };

  // Driver App
  DriverHome: undefined;
  DriverProfile: undefined;
  DriverRideHistory: undefined;
  DriverRideDetails: { rideId: string };
  DriverEarnings: undefined;
}

export type UserType = 'customer' | 'driver';