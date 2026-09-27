/**
 * Frontend Location Service (OpenStreetMap & Photon Provider)
 *
 * 100% Free & Open-Source OpenStreetMap Geocoding:
 * - Powered by Photon (OSM / Pelias).
 * - Zero Google Cloud Platform dependency.
 * - Supports debounced search, reverse geocoding, and in-memory caching.
 */

import { getApiUrl } from './apiConfig';

const BASE_URL = getApiUrl('/api/location');

// Client-side in-memory cache
const localCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const locationApi = {
  /**
   * Check location service configuration status
   */
  async checkConfig() {
    return {
      success: true,
      configured: true,
      provider: 'OpenStreetMap (Photon & Leaflet)',
    };
  },

  /**
   * Search locations using OpenStreetMap / Photon geocoder
   *
   * @param {string} query Search term
   * @param {Object} [options] { latitude, longitude, signal }
   * @returns {Promise<Object>} Search predictions
   */
  async searchLocations(query, { latitude, longitude, signal } = {}) {
    if (!query || !query.trim()) {
      return { success: true, configured: true, predictions: [] };
    }

    const cleanQuery = query.trim();
    const cacheKey = `search:${cleanQuery.toLowerCase()}:${latitude || ''},${longitude || ''}`;
    const cached = localCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { success: true, configured: true, predictions: cached.data };
    }

    try {
      const res = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: cleanQuery,
          latitude,
          longitude,
        }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`Location search returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const predictions = data.predictions || [];

      // Cache locally
      localCache.set(cacheKey, { data: predictions, timestamp: Date.now() });

      return {
        success: true,
        configured: true,
        predictions,
        provider: data.provider || 'Photon (OpenStreetMap)',
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { aborted: true, predictions: [] };
      }
      console.error('Location search error:', err);
      return {
        success: false,
        error: err.message || 'Failed to search locations.',
        predictions: [],
      };
    }
  },

  /**
   * Reverse Geocode device GPS coordinates
   *
   * @param {number} latitude
   * @param {number} longitude
   * @param {Object} [options] { signal }
   * @returns {Promise<Object>} Standardized location object
   */
  async reverseGeocode(latitude, longitude, { signal } = {}) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return { success: false, error: 'Valid coordinates required' };
    }

    const cacheKey = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = localCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { success: true, configured: true, location: cached.data };
    }

    try {
      const res = await fetch(
        `${BASE_URL}/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { signal }
      );

      if (!res.ok) {
        throw new Error(`Reverse geocode error: ${res.status}`);
      }

      const data = await res.json();
      if (data.location) {
        localCache.set(cacheKey, { data: data.location, timestamp: Date.now() });
      }

      return {
        success: true,
        configured: true,
        location: data.location,
        provider: data.provider || 'Photon (OpenStreetMap)',
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { aborted: true };
      }
      console.error('Reverse geocode error:', err);
      return {
        success: false,
        error: err.message || 'Failed to reverse geocode location',
        location: {
          placeId: `osm_gps_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          formattedAddress: `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          latitude: lat,
          longitude: lng,
          house: '',
          road: '',
          houseRoad: `Near GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          locality: 'Current Location',
          city: 'Kanpur',
          district: 'Kanpur Nagar',
          state: 'Uttar Pradesh',
          country: 'India',
          postalCode: '',
          pinCode: '',
          street: '',
        },
      };
    }
  },

  /**
   * Convert search prediction or custom point into standardized DrinkIt location record
   *
   * @param {Object} result
   * @returns {Object} Standardized location
   */
  getPlaceDetails(result) {
    if (!result) return null;

    const postalCode = result.postalCode || result.pinCode || '';
    const house = result.house || '';
    const road = result.road || result.street || '';
    const houseRoad = result.houseRoad || [house, road].filter(Boolean).join(', ') || result.mainText || '';

    return {
      placeId: result.placeId || `osm_manual_${Date.now()}`,
      formattedAddress: result.fullText || result.formattedAddress || `${result.mainText || ''}, ${result.secondaryText || ''}`,
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      house,
      road,
      houseRoad,
      city: result.city || 'Kanpur',
      district: result.district || result.city || 'Kanpur Nagar',
      state: result.state || 'Uttar Pradesh',
      country: result.country || 'India',
      postalCode,
      pinCode: postalCode,
      locality: result.locality || result.mainText || 'Selected Area',
      street: road,
    };
  },
};
