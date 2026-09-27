import { DeliveryPartner } from '../models/DeliveryPartner.js';
import { isDbConnected } from '../config/db.js';

const DEMO_PARTNERS = [
  {
    id: 'DP-2081',
    name: 'Suraj Singh',
    phone: '+91 98765 43210',
    cleanPhone: '9876543210',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    totalDeliveries: 1420,
    vehicleType: 'Electric Cargo Scooter',
    vehicleNumber: 'UP-78-EV-2081',
    status: 'AVAILABLE',
    availabilityStatus: 'AVAILABLE',
    onlineStatus: true,
    currentLatitude: 26.4715,
    currentLongitude: 80.3440,
    assignedOrder: null,
    currentOrderId: null,
    isDemo: true,
  },
  {
    id: 'DP-3042',
    name: 'Amit Verma',
    phone: '+91 98765 43211',
    cleanPhone: '9876543211',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    rating: 4.8,
    totalDeliveries: 980,
    vehicleType: 'Motorcycle 150cc',
    vehicleNumber: 'UP-78-BK-3042',
    status: 'AVAILABLE',
    availabilityStatus: 'AVAILABLE',
    onlineStatus: true,
    currentLatitude: 26.4820,
    currentLongitude: 80.3210,
    assignedOrder: null,
    currentOrderId: null,
    isDemo: true,
  },
  {
    id: 'DP-4199',
    name: 'Rahul Gupta',
    phone: '+91 98765 43212',
    cleanPhone: '9876543212',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    rating: 4.95,
    totalDeliveries: 2150,
    vehicleType: 'Express EV Rider',
    vehicleNumber: 'UP-78-SC-4199',
    status: 'AVAILABLE',
    availabilityStatus: 'AVAILABLE',
    onlineStatus: true,
    currentLatitude: 26.5085,
    currentLongitude: 80.2435,
    assignedOrder: null,
    currentOrderId: null,
    isDemo: true,
  },
];

class DeliveryPartnerRepository {
  constructor() {
    this.memoryPartners = DEMO_PARTNERS.map((p) => ({ ...p }));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await DeliveryPartner.countDocuments();
      if (count === 0) {
        for (const partner of DEMO_PARTNERS) {
          await DeliveryPartner.findOneAndUpdate(
            { id: partner.id },
            { $set: partner },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
        console.log('[DeliveryPartnerRepository] Seeded initial delivery partners into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[DeliveryPartnerRepository] Failed to seed delivery partners to MongoDB:', err.message);
    }
  }

  async getAll() {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const docs = await DeliveryPartner.find().exec();
      if (docs && docs.length > 0) {
        return docs.map((d) => d.toJSON());
      }
    }
    return this.memoryPartners;
  }

  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await DeliveryPartner.findOne({ id: String(id) }).exec();
      if (doc) return doc.toJSON();
    }
    return this.memoryPartners.find((p) => p.id === id) || null;
  }

  async getPartnerById(id) {
    return this.getById(id);
  }

  async getFirstAvailable() {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await DeliveryPartner.findOne({
        status: 'AVAILABLE',
      }).exec();
      if (doc) return doc.toJSON();
    }

    return this.memoryPartners.find((p) => p.status === 'AVAILABLE') || this.memoryPartners[0];
  }

  async assignOrder(partnerId, orderId) {
    if (isDbConnected()) {
      const updated = await DeliveryPartner.findOneAndUpdate(
        { id: String(partnerId) },
        {
          $set: {
            status: 'BUSY',
            availabilityStatus: 'BUSY',
            assignedOrder: orderId,
            currentOrderId: orderId,
          },
        },
        { new: true }
      ).exec();
      return updated ? updated.toJSON() : null;
    }

    const partner = this.memoryPartners.find((p) => p.id === partnerId);
    if (!partner) return null;
    partner.status = 'BUSY';
    partner.availabilityStatus = 'BUSY';
    partner.assignedOrder = orderId;
    partner.currentOrderId = orderId;
    return partner;
  }

  async releasePartner(partnerId, orderId) {
    if (isDbConnected()) {
      const query = { id: String(partnerId) };
      if (orderId) query.$or = [{ assignedOrder: orderId }, { currentOrderId: orderId }];

      const updated = await DeliveryPartner.findOneAndUpdate(
        query,
        {
          $set: {
            status: 'AVAILABLE',
            availabilityStatus: 'AVAILABLE',
            assignedOrder: null,
            currentOrderId: null,
          },
        },
        { new: true }
      ).exec();
      return updated ? updated.toJSON() : null;
    }

    const partner = this.memoryPartners.find((p) => p.id === partnerId);
    if (partner) {
      if (!orderId || partner.assignedOrder === orderId || partner.currentOrderId === orderId) {
        partner.status = 'AVAILABLE';
        partner.availabilityStatus = 'AVAILABLE';
        partner.assignedOrder = null;
        partner.currentOrderId = null;
      }
    }
    return partner;
  }

  async releaseByOrderId(orderId) {
    if (isDbConnected()) {
      await DeliveryPartner.updateMany(
        { $or: [{ assignedOrder: orderId }, { currentOrderId: orderId }] },
        {
          $set: {
            status: 'AVAILABLE',
            availabilityStatus: 'AVAILABLE',
            assignedOrder: null,
            currentOrderId: null,
          },
        }
      ).exec();
      return;
    }

    for (const partner of this.memoryPartners) {
      if (partner.assignedOrder === orderId || partner.currentOrderId === orderId) {
        partner.status = 'AVAILABLE';
        partner.availabilityStatus = 'AVAILABLE';
        partner.assignedOrder = null;
        partner.currentOrderId = null;
      }
    }
  }

  async updateLocation(partnerId, latitude, longitude) {
    if (isDbConnected()) {
      const updated = await DeliveryPartner.findOneAndUpdate(
        { id: String(partnerId) },
        {
          $set: {
            currentLatitude: Number(latitude),
            currentLongitude: Number(longitude),
          },
        },
        { new: true }
      ).exec();
      return updated ? updated.toJSON() : null;
    }

    const partner = this.memoryPartners.find((p) => p.id === partnerId);
    if (partner) {
      partner.currentLatitude = Number(latitude);
      partner.currentLongitude = Number(longitude);
    }
    return partner;
  }

  async upsertMany(partnersList) {
    if (!Array.isArray(partnersList) || partnersList.length === 0) return [];

    if (isDbConnected()) {
      const ops = partnersList.map((p) => ({
        updateOne: {
          filter: { id: p.id },
          update: { $set: p },
          upsert: true,
        },
      }));
      await DeliveryPartner.bulkWrite(ops);
      return this.getAll();
    }

    partnersList.forEach((p) => {
      const idx = this.memoryPartners.findIndex((mp) => mp.id === p.id);
      if (idx !== -1) {
        this.memoryPartners[idx] = { ...this.memoryPartners[idx], ...p };
      } else {
        this.memoryPartners.push(p);
      }
    });
    return this.memoryPartners;
  }
}

export const deliveryPartnerRepository = new DeliveryPartnerRepository();
export default deliveryPartnerRepository;

