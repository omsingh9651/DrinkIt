import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { locationApi } from '../services/locationService';
import { checkDeliveryServiceability } from '../services/serviceabilityService';

const LocationContext = createContext(null);

const STORAGE_KEY = 'drinkit_selected_location_v1';

export function LocationProvider({ children }) {
  // Load saved location from localStorage on init
  const [selectedLocation, setSelectedLocationState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved location from localStorage:', e);
    }
    return null;
  });

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);

  // Check Google API status on mount
  useEffect(() => {
    let mounted = true;
    locationApi.checkConfig().then((res) => {
      if (mounted) {
        setIsGoogleConfigured(Boolean(res.configured));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Update selected location in state and localStorage
  const setSelectedLocation = useCallback((loc) => {
    setSelectedLocationState(loc);
    try {
      if (loc) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to persist location to localStorage:', e);
    }
  }, []);

  // Clear selected location
  const clearLocation = useCallback(() => {
    setSelectedLocationState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to remove location from localStorage:', e);
    }
  }, []);

  const openLocationPicker = useCallback(() => {
    setIsLocationPickerOpen(true);
  }, []);

  const closeLocationPicker = useCallback(() => {
    setIsLocationPickerOpen(false);
  }, []);

  // Compute live serviceability for current location
  const serviceability = useMemo(() => {
    return checkDeliveryServiceability(selectedLocation);
  }, [selectedLocation]);

  const value = useMemo(
    () => ({
      selectedLocation,
      setSelectedLocation,
      clearLocation,
      isLocationPickerOpen,
      openLocationPicker,
      closeLocationPicker,
      serviceability,
      isGoogleConfigured,
      refreshConfig: async () => {
        const res = await locationApi.checkConfig();
        setIsGoogleConfigured(Boolean(res.configured));
        return res.configured;
      },
    }),
    [
      selectedLocation,
      setSelectedLocation,
      clearLocation,
      isLocationPickerOpen,
      openLocationPicker,
      closeLocationPicker,
      serviceability,
      isGoogleConfigured,
    ]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
