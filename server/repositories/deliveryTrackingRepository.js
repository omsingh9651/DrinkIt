import { DeliveryTracking } from '../models/DeliveryTracking.js';
import { isDbConnected } from '../config/db.js';

class DeliveryTrackingRepository {
  constructor() {
    this.memoryTracking = new Map();
  }

  async getByOrderId(orderId) {
    if (!orderId) return null;

    if (isDbConnected()) {
      const doc = await DeliveryTracking.findOne({ orderId: String(orderId) }).exec();
      return doc ? doc.toJSON() : null;
    }

    return this.memoryTracking.get(String(orderId)) || null;
  }

  async updateTracking(orderId, trackingData = {}) {
    if (!orderId) return null;

    const payload = {
      orderId: String(orderId),
      lastUpdated: new Date(),
    };

    if (trackingData.deliveryPartnerId) {
      payload.deliveryPartnerId = trackingData.deliveryPartnerId;
    }

    if (trackingData.location) {
      payload.currentLatitude = Number(trackingData.location.latitude);
      payload.currentLongitude = Number(trackingData.location.longitude);
      if (trackingData.location.heading !== undefined) {
        payload.heading = Number(trackingData.location.heading) || 0;
      }
      if (trackingData.location.speed !== undefined) {
        payload.speed = Number(trackingData.location.speed) || 0;
      }
    } else if (trackingData.currentDeliveryLocation) {
      payload.currentLatitude = Number(trackingData.currentDeliveryLocation.latitude);
      payload.currentLongitude = Number(trackingData.currentDeliveryLocation.longitude);
      if (trackingData.currentDeliveryLocation.heading !== undefined) {
        payload.heading = Number(trackingData.currentDeliveryLocation.heading) || 0;
      }
      if (trackingData.currentDeliveryLocation.speed !== undefined) {
        payload.speed = Number(trackingData.currentDeliveryLocation.speed) || 0;
      }
    } else if (trackingData.latitude !== undefined && trackingData.longitude !== undefined) {
      payload.currentLatitude = Number(trackingData.latitude);
      payload.currentLongitude = Number(trackingData.longitude);
      if (trackingData.heading !== undefined) {
        payload.heading = Number(trackingData.heading) || 0;
      }
      if (trackingData.speed !== undefined) {
        payload.speed = Number(trackingData.speed) || 0;
      }
    }

    if (trackingData.route !== undefined) {
      payload.routeGeometry = trackingData.route;
    }
    if (trackingData.estimatedMinutes !== undefined) {
      payload.etaMinutes = Number(trackingData.estimatedMinutes) || 0;
    }
    if (trackingData.distanceRemainingKm !== undefined) {
      payload.distanceRemainingKm = Number(trackingData.distanceRemainingKm) || 0;
    }
    if (trackingData.deliveryStatus) {
      payload.trackingStatus = trackingData.deliveryStatus;
    }

    if (isDbConnected()) {
      const updated = await DeliveryTracking.findOneAndUpdate(
        { orderId: String(orderId) },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();

      const json = updated.toJSON();
      this.memoryTracking.set(String(orderId), json);
      return json;
    }

    const merged = { ...(this.memoryTracking.get(String(orderId)) || {}), ...payload };
    this.memoryTracking.set(String(orderId), merged);
    return merged;
  }
}

export const deliveryTrackingRepository = new DeliveryTrackingRepository();
export default deliveryTrackingRepository;
