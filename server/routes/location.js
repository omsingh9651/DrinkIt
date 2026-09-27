import express from 'express';
import { locationService } from '../services/locationService.js';

const router = express.Router();

/**
 * GET /api/location/config
 * Returns OpenStreetMap provider status
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    configured: true,
    provider: 'OpenStreetMap (Photon & Leaflet)',
    message: 'OpenStreetMap / Photon search active. Zero Google Cloud billing required.',
  });
});

/**
 * GET or POST /api/location/autocomplete or /api/location/search
 * Query params or body: { input, query, latitude, longitude }
 */
const handleLocationSearch = async (req, res, next) => {
  try {
    const query = req.body?.input || req.body?.query || req.query?.input || req.query?.q || req.query?.query || '';
    const latitude = req.body?.latitude || (req.query?.latitude ? Number(req.query.latitude) : undefined);
    const longitude = req.body?.longitude || (req.query?.longitude ? Number(req.query.longitude) : undefined);

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.json({
        success: true,
        configured: true,
        predictions: [],
      });
    }

    const result = await locationService.searchLocations(query, {
      latitude,
      longitude,
    });

    res.json({
      success: true,
      configured: true,
      predictions: result.predictions || [],
      provider: result.provider,
    });
  } catch (err) {
    next(err);
  }
};

router.get(['/autocomplete', '/search'], handleLocationSearch);
router.post(['/autocomplete', '/search'], handleLocationSearch);

/**
 * GET /api/location/reverse-geocode?lat=...&lng=...
 * Reverse geocodes coordinates using Photon OSM
 */
router.get('/reverse-geocode', async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Both lat and lng query parameters are required.',
      });
    }

    const result = await locationService.reverseGeocode(lat, lng);

    res.json({
      success: true,
      configured: true,
      location: result.location,
      provider: result.provider,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/location/details/:placeId
 */
router.get('/details/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    const result = await locationService.getPlaceDetails(placeId, req.query);

    res.json({
      success: true,
      configured: true,
      location: result.location,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
