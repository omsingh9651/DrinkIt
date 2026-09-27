/**
 * OSRM Road Routing & ETA Service
 *
 * Computes real driving road routes and accurate ETAs using OpenStreetMap data.
 * Zero Google Cloud dependency.
 */

// In-memory cache for routes: key -> { data, timestamp }
const routeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const routingService = {
  /**
   * Calculate real driving road route between two coordinate points
   *
   * @param {Object} from { latitude, longitude }
   * @param {Object} to { latitude, longitude }
   * @returns {Promise<Object>} Route details including GeoJSON LineString coordinates, distance, and ETA
   */
  async calculateDeliveryRoute(from, to) {
    if (!from?.latitude || !from?.longitude || !to?.latitude || !to?.longitude) {
      throw new Error('Valid coordinates for both origin (from) and destination (to) are required.');
    }

    const fromLat = Number(from.latitude);
    const fromLng = Number(from.longitude);
    const toLat = Number(to.latitude);
    const toLng = Number(to.longitude);

    // Cache key based on 4 decimal places (~11 meters resolution)
    const cacheKey = `${fromLat.toFixed(4)},${fromLng.toFixed(4)}->${toLat.toFixed(4)},${toLng.toFixed(4)}`;
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      // OSRM expects coordinates in order: {longitude},{latitude}
      const endpoint = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'DrinkIt-App/2.0 (Express/Node.js)',
        },
      });

      if (!response.ok) {
        throw new Error(`OSRM routing failed with HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
        throw new Error(`No route found: ${json.message || json.code}`);
      }

      const bestRoute = json.routes[0];
      const distanceMeters = Math.round(bestRoute.distance);
      const durationSeconds = Math.round(bestRoute.duration);
      const distanceKm = Number((distanceMeters / 1000).toFixed(1));
      const etaMinutes = Math.max(1, Math.ceil(durationSeconds / 60));

      const result = {
        code: 'Ok',
        provider: 'OSRM (OpenStreetMap)',
        geometry: bestRoute.geometry, // GeoJSON { type: 'LineString', coordinates: [[lon, lat], ...] }
        distanceMeters,
        durationSeconds,
        distanceKm,
        etaMinutes,
        waypoints: json.waypoints,
        calculatedAt: new Date().toISOString(),
      };

      // Cache result
      routeCache.set(cacheKey, { data: result, timestamp: Date.now() });

      // Clean old cache entries if map grows large
      if (routeCache.size > 200) {
        const oldestKey = routeCache.keys().next().value;
        routeCache.delete(oldestKey);
      }

      return result;
    } catch (err) {
      console.warn('OSRM external call failed, generating direct route fallback:', err.message);
      return this.generateDirectRouteFallback(fromLat, fromLng, toLat, toLng);
    }
  },

  /**
   * Resilient fallback if external routing network is offline
   */
  generateDirectRouteFallback(fromLat, fromLng, toLat, toLng) {
    // Haversine formula for distance
    const R = 6371; // Earth radius in km
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((fromLat * Math.PI) / 180) *
        Math.cos((toLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDistKm = R * c;

    // Road factor ~1.3x straight line
    const roadDistKm = Number((straightDistKm * 1.3).toFixed(1));
    const distanceMeters = Math.round(roadDistKm * 1000);
    // Assume average delivery scooter speed in Indian city traffic: 25 km/h
    const etaMinutes = Math.max(2, Math.round((roadDistKm / 25) * 60));
    const durationSeconds = etaMinutes * 60;

    // Generate 5 intermediate points along direct vector
    const coordinates = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const lat = fromLat + (toLat - fromLat) * frac;
      const lng = fromLng + (toLng - fromLng) * frac;
      coordinates.push([lng, lat]);
    }

    return {
      code: 'Ok',
      provider: 'OSRM-Fallback (Interpolated)',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      distanceMeters,
      durationSeconds,
      distanceKm: roadDistKm,
      etaMinutes,
      calculatedAt: new Date().toISOString(),
    };
  },
};

