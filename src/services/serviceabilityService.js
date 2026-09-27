/**
 * DrinkIt Delivery Serviceability Engine
 *
 * Configurable architecture defining delivery hubs, express zones,
 * delivery fees, minimum order amounts, and estimated delivery times.
 */

// Delivery hubs and express areas configuration
const SERVICEABLE_CITIES = [
  {
    name: 'Kanpur',
    state: 'Uttar Pradesh',
    expressAreas: [
      'kalyanpur',
      'kakadeo',
      'swaroop nagar',
      'kidwai nagar',
      'govind nagar',
      'civil lines',
      'kanpur central',
      'mirpur',
      'arya nagar',
      'harsh nagar',
      'tilak nagar',
      'sharda nagar',
      'gumti no 5',
      'barra',
      'panki',
      'chakeri',
    ],
    pincodes: ['208001', '208002', '208004', '208005', '208012', '208014', '208017', '208024', '208025', '208027'],
    expressEstimate: '25–35 mins',
    cityEstimate: '45–60 mins',
  },
  {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    expressAreas: ['gomti nagar', 'hazratganj', 'aliganj', 'indira nagar'],
    expressEstimate: '35–45 mins',
    cityEstimate: '60–75 mins',
  },
  {
    name: 'Delhi NCR',
    state: 'Delhi',
    aliases: ['delhi', 'new delhi', 'noida', 'gurugram', 'gurgaon', 'ghaziabad', 'faridabad'],
    expressEstimate: '30–45 mins',
    cityEstimate: '45–60 mins',
  },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    aliases: ['mumbai', 'navi mumbai', 'thane'],
    expressEstimate: '30–45 mins',
    cityEstimate: '60–90 mins',
  },
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    aliases: ['bengaluru', 'bangalore'],
    expressEstimate: '30–45 mins',
    cityEstimate: '60–90 mins',
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    expressEstimate: '35–45 mins',
    cityEstimate: '60–75 mins',
  },
];

/**
 * Check delivery serviceability for a chosen location
 * @param {Object|null} location Standardized location object
 * @returns {Object} Serviceability status and details
 */
export function checkDeliveryServiceability(location) {
  if (!location) {
    return {
      isServiceable: false,
      status: 'NO_LOCATION',
      tier: 'UNSERVICEABLE',
      estimatedTimeText: 'Select location',
      badgeText: '📍 Set Location',
      deliveryFee: 49,
      freeDeliveryThreshold: 999,
      minOrderAmount: 0,
      message: 'Please select your delivery location to check instant availability.',
    };
  }

  const city = (location.city || '').trim().toLowerCase();
  const locality = (location.locality || '').trim().toLowerCase();
  const postalCode = (location.postalCode || '').trim();

  // Look for matching city hub
  const matchedHub = SERVICEABLE_CITIES.find((hub) => {
    if (hub.name.toLowerCase() === city) return true;
    if (hub.aliases && hub.aliases.some((a) => a.toLowerCase() === city)) return true;
    if (hub.pincodes && hub.pincodes.includes(postalCode)) return true;
    return false;
  });

  if (matchedHub) {
    // Check if locality is an express hotspot
    const isExpress =
      matchedHub.expressAreas &&
      matchedHub.expressAreas.some(
        (area) => locality.includes(area) || area.includes(locality)
      );

    if (isExpress) {
      return {
        isServiceable: true,
        status: 'EXPRESS_ACTIVE',
        tier: 'EXPRESS_30',
        hubName: matchedHub.name,
        estimatedTimeText: matchedHub.expressEstimate,
        badgeText: '⚡ 30-Min Express',
        deliveryFee: 0,
        freeDeliveryThreshold: 499,
        minOrderAmount: 199,
        message: `Express 30-min doorstep delivery available in ${location.locality || matchedHub.name}!`,
      };
    }

    return {
      isServiceable: true,
      status: 'SERVICEABLE',
      tier: 'CITY_EXPEDITE',
      hubName: matchedHub.name,
      estimatedTimeText: matchedHub.cityEstimate,
      badgeText: '🚚 Fast Delivery',
      deliveryFee: 49,
      freeDeliveryThreshold: 999,
      minOrderAmount: 299,
      message: `Standard priority delivery available in ${location.city || matchedHub.name}.`,
    };
  }

  // Location is outside primary metro hubs
  return {
    isServiceable: true, // Graceful delivery across India via courier partners
    status: 'REGIONAL_DELIVERY',
    tier: 'STANDARD_REGIONAL',
    hubName: 'Domestic Cellar Network',
    estimatedTimeText: '2–3 days',
    badgeText: '📦 Standard Shipping',
    deliveryFee: 99,
    freeDeliveryThreshold: 1499,
    minOrderAmount: 499,
    message: `Delivery available via refrigerated courier to ${location.city || 'your area'}.`,
  };
}

/**
 * Returns supported city hub list for display / suggestions
 */
export function getSupportedCities() {
  return SERVICEABLE_CITIES.map((c) => ({
    name: c.name,
    state: c.state,
    expressEstimate: c.expressEstimate,
  }));
}

