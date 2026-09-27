/**
 * Location Service (OpenStreetMap & Photon Provider)
 *
 * 100% Free & Open-Source OpenStreetMap Geocoding:
 * - Uses Photon (Komoot / Elasticsearch / Pelias OSM geocoder).
 * - Zero Google Cloud Platform dependency.
 * - Zero billing or credit card requirements.
 * - Supports debounced autocomplete, reverse geocoding, and location bias.
 */

// In-memory query cache: query -> { results, timestamp }
const queryCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const locationService = {
  /**
   * Always true — OpenStreetMap / Photon requires zero private API keys.
   */
  isConfigured() {
    return true;
  },

  /**
   * Search locations using Photon OSM Geocoder
   *
   * @param {string} query Search query (city, area, street, landmark, pincode)
   * @param {Object} [options] { latitude, longitude } for location bias
   * @returns {Promise<Object>} Formatted predictions list
   */
  async searchLocations(query, { latitude, longitude } = {}) {
    if (!query || !query.trim()) {
      return { configured: true, predictions: [] };
    }

    const cleanQuery = query.trim();
    const cacheKey = `search:${cleanQuery.toLowerCase()}:${latitude || ''},${longitude || ''}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { configured: true, predictions: cached.results };
    }

    try {
      // Build Photon URL with query and optional coordinate bias
      let endpoint = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=10&lang=en`;

      if (latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
        endpoint += `&lat=${Number(latitude)}&lon=${Number(longitude)}`;
      }

      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'DrinkIt-App/2.0 (OpenStreetMap Leaflet Client)',
        },
      });

      if (!response.ok) {
        throw new Error(`Photon search failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      const features = data.features || [];

      const predictions = features.map((feat) => {
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || [0, 0];
        const lng = coords[0];
        const lat = coords[1];

        const mainText = props.name || props.street || props.city || props.district || 'Location';
        const addressParts = [
          props.street,
          props.district,
          props.city,
          props.state,
          props.country || 'India',
        ].filter(Boolean);

        const secondaryText = addressParts.filter((p) => p !== mainText).join(', ');
        const fullText = secondaryText ? `${mainText}, ${secondaryText}` : mainText;

        const placeId = `osm_${props.osm_type || 'N'}_${props.osm_id || Math.random().toString(36).substring(2, 9)}`;

        return {
          placeId,
          fullText,
          mainText,
          secondaryText,
          latitude: lat,
          longitude: lng,
          locality: props.district || props.street || mainText,
          city: props.city || props.county || 'Kanpur',
          state: props.state || 'Uttar Pradesh',
          country: props.country || 'India',
          postalCode: props.postcode || '',
          type: props.type || props.osm_value || 'locality',
        };
      });

      // Cache results
      queryCache.set(cacheKey, { results: predictions, timestamp: Date.now() });
      if (queryCache.size > 300) {
        const oldest = queryCache.keys().next().value;
        queryCache.delete(oldest);
      }

      return {
        configured: true,
        predictions,
        provider: 'Photon (OpenStreetMap)',
      };
    } catch (err) {
      console.error('Photon search error:', err.message);
      return {
        configured: true,
        predictions: [],
        error: `Location search failed: ${err.message}`,
      };
    }
  },

  /**
   * Reverse geocode coordinates to human-readable address using Photon
   *
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<Object>} Standardized location object
   */
  async reverseGeocode(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return { configured: true, error: 'Valid latitude and longitude are required.' };
    }

    const cacheKey = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { configured: true, location: cached.results };
    }

    try {
      const endpoint = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'DrinkIt-App/2.0 (OpenStreetMap Leaflet Client)',
        },
      });

      let features = [];
      if (response.ok) {
        const data = await response.json();
        features = data.features || [];
      }

      if (features.length === 0) {
        // Fallback to Nominatim reverse geocoder
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
            {
              headers: {
                'User-Agent': 'DrinkIt-App/2.0 (OpenStreetMap Leaflet Client)',
              },
            }
          );
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (nomData && nomData.address) {
              const a = nomData.address;
              const houseNumber = a.house_number || a.building || '';
              const road = a.road || a.pedestrian || a.street || '';
              const houseRoad = [houseNumber, road].filter(Boolean).join(', ') || road || '';
              const locality = a.suburb || a.neighbourhood || a.residential || a.quarter || road || 'Detected Area';
              const city = a.city || a.town || a.village || a.county || 'Kanpur';
              const district = a.state_district || a.county || 'Kanpur Nagar';
              const state = a.state || 'Uttar Pradesh';
              const postalCode = a.postcode || '';
              const country = a.country || 'India';

              const location = {
                placeId: `osm_nom_${lat.toFixed(4)}_${lng.toFixed(4)}`,
                formattedAddress: nomData.display_name || `${houseRoad ? houseRoad + ', ' : ''}${locality}, ${city}, ${state}`,
                latitude: lat,
                longitude: lng,
                house: houseNumber,
                road,
                houseRoad,
                locality,
                city,
                district,
                state,
                country,
                postalCode,
                pinCode: postalCode,
                street: road,
              };

              queryCache.set(cacheKey, { results: location, timestamp: Date.now() });
              return { configured: true, location, provider: 'Nominatim (OpenStreetMap)' };
            }
          }
        } catch (nomErr) {
          console.warn('Nominatim fallback failed:', nomErr.message);
        }

        // Generic coordinates fallback if both providers have no metadata
        const fallbackLocation = {
          placeId: `osm_rev_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          formattedAddress: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          latitude: lat,
          longitude: lng,
          house: '',
          road: '',
          houseRoad: `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          locality: 'Detected Area',
          city: 'Kanpur',
          district: 'Kanpur Nagar',
          state: 'Uttar Pradesh',
          country: 'India',
          postalCode: '',
          pinCode: '',
          street: '',
        };
        return { configured: true, location: fallbackLocation };
      }

      const feat = features[0];
      const props = feat.properties || {};

      const houseNumber = props.housenumber || props.building || '';
      const road = props.street || '';
      const houseRoad = [houseNumber, road].filter(Boolean).join(', ') || props.name || road || '';
      const locality = props.district || props.suburb || props.neighbourhood || props.quarter || props.street || props.name || 'Detected Area';
      const city = props.city || props.town || props.county || 'Kanpur';
      const district = props.county || props.district || 'Kanpur Nagar';
      const state = props.state || 'Uttar Pradesh';
      const postalCode = props.postcode || '';
      const country = props.country || 'India';

      const addressParts = [
        props.name,
        props.street,
        props.district,
        props.city,
        props.state,
        props.postcode,
        props.country || 'India',
      ].filter(Boolean);

      // Deduplicate parts
      const uniqueParts = [...new Set(addressParts)];
      const formattedAddress = uniqueParts.join(', ');

      const location = {
        placeId: `osm_${props.osm_type || 'N'}_${props.osm_id || `${lat.toFixed(4)}_${lng.toFixed(4)}`}`,
        formattedAddress,
        latitude: lat,
        longitude: lng,
        house: houseNumber,
        road,
        houseRoad,
        locality,
        city,
        district,
        state,
        country,
        postalCode,
        pinCode: postalCode,
        street: road,
      };

      queryCache.set(cacheKey, { results: location, timestamp: Date.now() });

      return {
        configured: true,
        location,
        provider: 'Photon (OpenStreetMap)',
      };
    } catch (err) {
      console.error('Reverse geocode error:', err.message);
      // Fallback location on error
      return {
        configured: true,
        location: {
          placeId: `osm_gps_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          formattedAddress: `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          latitude: lat,
          longitude: lng,
          house: '',
          road: '',
          houseRoad: `GPS Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
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
   * Get Place Details (for OSM, search already returns coordinates and properties)
   */
  async getPlaceDetails(placeId, predictionData) {
    if (predictionData && predictionData.latitude && predictionData.longitude) {
      return {
        configured: true,
        location: {
          placeId: predictionData.placeId || placeId,
          formattedAddress: predictionData.fullText || `${predictionData.mainText}, ${predictionData.secondaryText}`,
          latitude: Number(predictionData.latitude),
          longitude: Number(predictionData.longitude),
          locality: predictionData.locality || predictionData.mainText,
          city: predictionData.city || 'Kanpur',
          state: predictionData.state || 'Uttar Pradesh',
          country: predictionData.country || 'India',
          postalCode: predictionData.postalCode || '',
        },
      };
    }

    return {
      configured: true,
      error: 'Place details already embedded in OSM suggestion.',
    };
  },
};
