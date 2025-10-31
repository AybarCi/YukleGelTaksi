import { LocationCoords } from '../types/dashboard';

export interface NavigationStep {
  instruction: string;
  distance: string;
  duration: number; // seconds
  maneuver: string;
  location: LocationCoords;
}

export interface NavigationRoute {
  coordinates: LocationCoords[];
  distance: number; // meters
  duration: number; // seconds
  steps: NavigationStep[];
  currentStepIndex: number;
  estimatedArrival: Date;
}

export interface NavigationUpdate {
  currentLocation: LocationCoords;
  distanceToDestination: number;
  timeToDestination: number;
  currentStep: NavigationStep | null;
  nextStep: NavigationStep | null;
  offRoute: boolean;
}

class NavigationService {
  private currentRoute: NavigationRoute | null = null;
  private navigationInterval: number | null = null;
  private lastKnownLocation: LocationCoords | null = null;
  private onRouteUpdateCallback: ((update: NavigationUpdate) => void) | null = null;
  private GOOGLE_MAPS_API_KEY = 'AIzaSyBh078SvpaOnhvq5QGkGJ4hQV-Z0mpI81M';

  // Google Directions API ile rota hesaplama
  async calculateRoute(
    origin: LocationCoords,
    destination: LocationCoords,
    waypoints?: LocationCoords[]
  ): Promise<NavigationRoute> {
    try {
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${this.GOOGLE_MAPS_API_KEY}&mode=driving&departure_time=now&traffic_model=best_guess&language=tr`;

      if (waypoints && waypoints.length > 0) {
        const waypointStr = waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join('|');
        url += `&waypoints=${waypointStr}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes.length) {
        throw new Error(`Route calculation failed: ${data.status}`);
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      // Polyline decode etme
      const coordinates = this.decodePolyline(route.overview_polyline.points);

      // Navigasyon adımlarını oluştur
      const steps: NavigationStep[] = leg.steps.map((step: any) => ({
        instruction: this.cleanHtmlInstructions(step.html_instructions),
        distance: step.distance.text,
        duration: step.duration.value,
        maneuver: step.maneuver || '',
        location: {
          latitude: step.end_location.lat,
          longitude: step.end_location.lng
        }
      }));

      const navigationRoute: NavigationRoute = {
        coordinates,
        distance: leg.distance.value,
        duration: leg.duration.value,
        steps,
        currentStepIndex: 0,
        estimatedArrival: new Date(Date.now() + leg.duration.value * 1000)
      };

      this.currentRoute = navigationRoute;
      return navigationRoute;

    } catch (error) {
      console.error('Route calculation error:', error);
      throw error;
    }
  }

  // Gerçek zamanlı navigasyonu başlat
  startNavigation(
    currentLocation: LocationCoords,
    onRouteUpdate: (update: NavigationUpdate) => void
  ): void {
    if (!this.currentRoute) {
      throw new Error('No route calculated. Call calculateRoute first.');
    }

    this.lastKnownLocation = currentLocation;
    this.onRouteUpdateCallback = onRouteUpdate;

    // Navigasyon güncellemelerini başlat
    this.navigationInterval = setInterval(() => {
      this.updateNavigation();
    }, 5000); // 5 saniyede bir güncelle

    // İlk güncellemeyi hemen yap
    this.updateNavigation();
  }

  // Navigasyonu durdur
  stopNavigation(): void {
    if (this.navigationInterval) {
      clearInterval(this.navigationInterval);
      this.navigationInterval = null;
    }
    this.onRouteUpdateCallback = null;
  }

  // Navigasyon aktif mi?
  isNavigating(): boolean {
    return this.navigationInterval !== null;
  }

  // Mevcut rotayı al
  getCurrentRoute(): NavigationRoute | null {
    return this.currentRoute;
  }

  // Konum güncellendiğinde çağır
  updateLocation(currentLocation: LocationCoords): void {
    this.lastKnownLocation = currentLocation;
  }

  // Navigasyon güncellemesi
  private updateNavigation(): void {
    if (!this.currentRoute || !this.lastKnownLocation || !this.onRouteUpdateCallback) {
      return;
    }

    const currentStep = this.currentRoute.steps[this.currentRoute.currentStepIndex];
    const nextStep = this.currentRoute.steps[this.currentRoute.currentStepIndex + 1] || null;

    // Hedefe kalan mesafe ve süre
    const distanceToDestination = this.calculateDistance(
      this.lastKnownLocation,
      this.currentRoute.coordinates[this.currentRoute.coordinates.length - 1]
    );

    const timeToDestination = this.estimateTimeToDestination(distanceToDestination);

    // Rotadan sapma kontrolü
    const offRoute = this.isOffRoute(this.lastKnownLocation, this.currentRoute.coordinates);

    // Adım ilerleme kontrolü
    if (currentStep && this.shouldAdvanceToNextStep(this.lastKnownLocation, currentStep)) {
      this.currentRoute.currentStepIndex++;
    }

    const update: NavigationUpdate = {
      currentLocation: this.lastKnownLocation,
      distanceToDestination,
      timeToDestination,
      currentStep,
      nextStep,
      offRoute
    };

    this.onRouteUpdateCallback(update);
  }

  // Bir sonraki adıma geçmeli mi?
  private shouldAdvanceToNextStep(currentLocation: LocationCoords, currentStep: NavigationStep): boolean {
    const distanceToStep = this.calculateDistance(currentLocation, currentStep.location);
    return distanceToStep < 50; // 50 metre yakına gelince bir sonraki adıma geç
  }

  // Rotadan sapma kontrolü
  private isOffRoute(currentLocation: LocationCoords, routeCoordinates: LocationCoords[]): boolean {
    const threshold = 100; // 100 metre
    let minDistance = Infinity;

    for (const coord of routeCoordinates) {
      const distance = this.calculateDistance(currentLocation, coord);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance > threshold;
  }

  // İki nokta arası mesafe hesaplama (Haversine formülü)
  private calculateDistance(loc1: LocationCoords, loc2: LocationCoords): number {
    const R = 6371000; // Dünya yarıçapı (metre)
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Tahmini varış süresi hesaplama
  private estimateTimeToDestination(distance: number): number {
    // Ortalama 30 km/h hız ile tahmin
    const averageSpeed = 30 / 3.6; // m/s
    return Math.round(distance / averageSpeed);
  }

  // Dereceyi radyana çevir
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Polyline decode etme
  private decodePolyline(encoded: string): LocationCoords[] {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  // HTML instruction temizleme
  private cleanHtmlInstructions(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  // Sesli navigasyon komutu oluştur
  getVoiceCommand(step: NavigationStep): string {
    const maneuver = step.maneuver;
    let command = step.instruction;

    // Türkçe komutlar
    if (maneuver.includes('turn-left')) {
      command = 'Sola dönün';
    } else if (maneuver.includes('turn-right')) {
      command = 'Sağa dönün';
    } else if (maneuver.includes('straight')) {
      command = 'Düz devam edin';
    } else if (maneuver.includes('roundabout')) {
      command = 'Kavşaktan dönün';
    }

    return `${command}. Mesafe: ${step.distance}`;
  }
}

export const navigationService = new NavigationService();