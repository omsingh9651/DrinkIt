import { storeRepository } from '../repositories/storeRepository.js';

class StoreLocationService {
  /**
   * Get all active stores
   */
  async getAllStores() {
    return storeRepository.getAll();
  }

  /**
   * Get store by unique identifier
   */
  async getStoreById(id) {
    return storeRepository.getById(id);
  }

  /**
   * Calculate distance between two coordinates in kilometers using Haversine formula
   */
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    return storeRepository.calculateDistanceKm(lat1, lon1, lat2, lon2);
  }

  /**
   * Find nearest store to given coordinates
   */
  async findNearestStore(lat, lng) {
    return storeRepository.findNearest(lat, lng);
  }

  /**
   * Synchronous nearest lookup fallback for synchronous caller contexts
   */
  findNearestStoreSync(lat, lng) {
    return storeRepository.findNearest(lat, lng);
  }
}

export const storeLocationService = new StoreLocationService();
export default storeLocationService;
