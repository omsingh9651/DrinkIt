import { deliveryPartnerRepository } from '../repositories/deliveryPartnerRepository.js';

class DeliveryPartnerService {
  async getAllPartners() {
    return deliveryPartnerRepository.getAll();
  }

  async getPartnerById(id) {
    return deliveryPartnerRepository.getById(id);
  }

  async getFirstAvailablePartner() {
    return deliveryPartnerRepository.getFirstAvailable();
  }

  async assignOrder(partnerId, orderId) {
    return deliveryPartnerRepository.assignOrder(partnerId, orderId);
  }

  async releasePartner(partnerId, orderId) {
    return deliveryPartnerRepository.releasePartner(partnerId, orderId);
  }

  async releaseByOrderId(orderId) {
    return deliveryPartnerRepository.releaseByOrderId(orderId);
  }

  async updateLocation(partnerId, latitude, longitude) {
    return deliveryPartnerRepository.updateLocation(partnerId, latitude, longitude);
  }
}

export const deliveryPartnerService = new DeliveryPartnerService();
export default deliveryPartnerService;
