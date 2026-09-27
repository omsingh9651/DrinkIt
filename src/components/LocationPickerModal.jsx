import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocation } from '../context/LocationContext';
import { locationApi } from '../services/locationService';
import styles from './LocationPickerModal.module.css';

// Default center: Kanpur, Uttar Pradesh
const DEFAULT_COORDS = { lat: 26.4499, lng: 80.3319 };

/**
 * Creates custom luxury SVG pin marker for Leaflet
 */
function createMarkerIcon(isCurrentLocation = false) {
  return L.divIcon({
    className: styles.leafletMarkerWrapper,
    html: `
      <div class="${styles.customMarkerPin} ${isCurrentLocation ? styles.currentLocationPin : ''}">
        <div class="${styles.customMarkerCore}"></div>
      </div>
      <div class="${styles.markerPulseRing} ${isCurrentLocation ? styles.currentLocationPulse : ''}"></div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

function LocationPickerModalContent() {
  const {
    selectedLocation,
    setSelectedLocation,
    closeLocationPicker,
  } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // GPS Current Location Detection State
  const [isDetecting, setIsDetecting] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [detectSuccess, setDetectSuccess] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // Manual fallback inputs
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualArea, setManualArea] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualPin, setManualPin] = useState('');

  // Active map preview location
  const [previewLocation, setPreviewLocation] = useState(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      return selectedLocation;
    }
    return {
      placeId: 'default_kanpur',
      formattedAddress: 'Civil Lines, Kanpur, Uttar Pradesh, India',
      locality: 'Civil Lines',
      city: 'Kanpur',
      district: 'Kanpur Nagar',
      state: 'Uttar Pradesh',
      country: 'India',
      postalCode: '208001',
      pinCode: '208001',
      house: '',
      road: 'The Mall Road',
      houseRoad: 'The Mall Road',
      latitude: DEFAULT_COORDS.lat,
      longitude: DEFAULT_COORDS.lng,
    };
  });

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Reverse geocode and update preview location when dragged or clicked
  const handleCoordinatesSelected = useCallback(async (lat, lng) => {
    setSearchError('');
    setGeoError('');
    setDetectSuccess(false);
    try {
      const res = await locationApi.reverseGeocode(lat, lng);
      if (res.location) {
        setPreviewLocation(res.location);

        // Remove accuracy circle on manual pin reposition
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }

        if (markerInstanceRef.current) {
          markerInstanceRef.current.setIcon(createMarkerIcon(false));
          markerInstanceRef.current.unbindTooltip();
          markerInstanceRef.current
            .bindTooltip('Selected Destination', {
              permanent: true,
              direction: 'top',
              offset: [0, -32],
              className: styles.youAreHereTooltip,
            })
            .openTooltip();

          markerInstanceRef.current.bindPopup(
            `<strong>📍 Selected Location</strong><br/>${res.location.formattedAddress}`
          );
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
    }
  }, []);

  // Update map view when coordinates change
  const updateMapView = useCallback((lat, lng, zoom = 15) => {
    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], zoom, { animate: true });
      markerInstanceRef.current.setLatLng([lat, lng]);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = previewLocation.latitude || DEFAULT_COORDS.lat;
    const initialLng = previewLocation.longitude || DEFAULT_COORDS.lng;
    const isCurrent = Boolean(previewLocation.isCurrentLocation);

    // Create Leaflet map instance
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    // Add official OpenStreetMap tile layer (HTTPS with strict OSM attribution)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Create marker
    const marker = L.marker([initialLat, initialLng], {
      icon: createMarkerIcon(isCurrent),
      draggable: true,
    }).addTo(map);

    // Tooltip
    marker
      .bindTooltip(isCurrent ? 'You are here' : 'Selected Location', {
        permanent: true,
        direction: 'top',
        offset: [0, -32],
        className: styles.youAreHereTooltip,
      })
      .openTooltip();

    marker.bindPopup(
      `<strong>${isCurrent ? '📍 You are here' : 'Selected Location'}</strong><br/>${previewLocation.formattedAddress}`
    );

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    // Handle marker drag end (reverse geocode new coords)
    marker.on('dragend', async (e) => {
      const { lat, lng } = e.target.getLatLng();
      await handleCoordinatesSelected(lat, lng);
    });

    // Handle map click to set marker & reverse geocode
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      await handleCoordinatesSelected(lat, lng);
    });

    // Trigger resize after small delay to fix tile rendering in modal
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search handler (320ms) using Photon OpenStreetMap provider
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchError('');
    setGeoError('');
    setDetectSuccess(false);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (!val.trim()) {
      setPredictions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const res = await locationApi.searchLocations(val, {
          latitude: previewLocation?.latitude,
          longitude: previewLocation?.longitude,
          signal,
        });

        if (res.aborted) return;
        setIsSearching(false);

        if (res.error) {
          setSearchError(res.error);
          setPredictions([]);
          return;
        }

        setPredictions(res.predictions || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Search error:', err);
          setIsSearching(false);
          setSearchError('Unable to fetch locations. Please try again.');
        }
      }
    }, 320);
  };

  // Handle selecting a prediction from dropdown
  const handleSelectPrediction = (prediction) => {
    setPredictions([]);
    setSearchQuery('');
    setSearchError('');
    setGeoError('');
    setDetectSuccess(false);

    const formattedLoc = locationApi.getPlaceDetails(prediction);
    setPreviewLocation(formattedLoc);

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    if (formattedLoc.latitude && formattedLoc.longitude) {
      updateMapView(formattedLoc.latitude, formattedLoc.longitude, 16);

      if (markerInstanceRef.current) {
        markerInstanceRef.current.setIcon(createMarkerIcon(false));
        markerInstanceRef.current.unbindTooltip();
        markerInstanceRef.current
          .bindTooltip('Selected Destination', {
            permanent: true,
            direction: 'top',
            offset: [0, -32],
            className: styles.youAreHereTooltip,
          })
          .openTooltip();

        markerInstanceRef.current.bindPopup(
          `<strong>📍 ${formattedLoc.locality || formattedLoc.city}</strong><br/>${formattedLoc.formattedAddress}`
        );
      }
    }
  };

  /**
   * "📍 Use Current Location" Handler
   * Uses HTML5 Geolocation API: navigator.geolocation.getCurrentPosition()
   * Requests permission ONLY on button click.
   * Auto-centers map, displays "You are here" label & accuracy circle.
   * Reverse-geocodes with Photon/Nominatim and immediately persists location.
   */
  const handleUseCurrentLocation = () => {
    setGeoError('');
    setDetectSuccess(false);
    setSearchError('');

    // Check browser Geolocation API support
    if (!navigator.geolocation) {
      setGeoError('Your browser does not support current location.');
      return;
    }

    setIsDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(accuracy ? Math.round(accuracy) : null);

        try {
          // Reverse geocode real GPS coordinates
          const res = await locationApi.reverseGeocode(latitude, longitude);
          let resolvedLocation;

          if (res.location) {
            resolvedLocation = {
              ...res.location,
              isCurrentLocation: true,
              accuracy: accuracy ? Math.round(accuracy) : undefined,
            };
          } else {
            resolvedLocation = {
              placeId: `gps_${Date.now()}`,
              formattedAddress: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
              locality: 'Current Location',
              city: 'Kanpur',
              district: 'Kanpur Nagar',
              state: 'Uttar Pradesh',
              country: 'India',
              postalCode: '',
              pinCode: '',
              house: '',
              road: '',
              houseRoad: `GPS Point (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
              latitude,
              longitude,
              isCurrentLocation: true,
              accuracy: accuracy ? Math.round(accuracy) : undefined,
            };
          }

          // 1. Update preview location in modal
          setPreviewLocation(resolvedLocation);

          // 2. Persist detected location to context and localStorage immediately
          setSelectedLocation(resolvedLocation);

          // 3. Center Leaflet map and display "You are here" marker
          if (mapInstanceRef.current && markerInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true });

            markerInstanceRef.current.setLatLng([latitude, longitude]);
            markerInstanceRef.current.setIcon(createMarkerIcon(true));
            markerInstanceRef.current.unbindTooltip();
            markerInstanceRef.current
              .bindTooltip('You are here', {
                permanent: true,
                direction: 'top',
                offset: [0, -32],
                className: styles.youAreHereTooltip,
              })
              .openTooltip();

            markerInstanceRef.current.bindPopup(
              `<strong>📍 You are here</strong><br/>${resolvedLocation.formattedAddress}${
                accuracy ? `<br/><small style="color: #f0c040;">Accuracy: ±${Math.round(accuracy)}m</small>` : ''
              }`
            );

            // 4. Show accuracy circle if available
            if (accuracyCircleRef.current) {
              accuracyCircleRef.current.remove();
              accuracyCircleRef.current = null;
            }
            if (accuracy && accuracy > 0) {
              const circle = L.circle([latitude, longitude], {
                radius: Math.min(Math.max(accuracy, 15), 1500),
                color: '#f0c040',
                fillColor: '#f0c040',
                fillOpacity: 0.15,
                weight: 1.5,
                dashArray: '4, 4',
              }).addTo(mapInstanceRef.current);
              accuracyCircleRef.current = circle;
            }

            setTimeout(() => {
              mapInstanceRef.current?.invalidateSize();
            }, 100);
          }

          setIsDetecting(false);
          setDetectSuccess(true);
        } catch (err) {
          console.error('Reverse geocode error:', err);
          setIsDetecting(false);
          setGeoError('Current location is unavailable. Please try again.');
        }
      },
      (error) => {
        setIsDetecting(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError('Please allow location permission to detect your current location.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError('Current location is unavailable. Please try again.');
            break;
          case error.TIMEOUT:
            setGeoError('Location request timed out. Please try again.');
            break;
          default:
            setGeoError('Current location is unavailable. Please try again.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Confirm and save the previewed location
  const handleConfirmLocation = () => {
    if (previewLocation) {
      setSelectedLocation(previewLocation);
      closeLocationPicker();
    }
  };

  // Manual fallback submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualArea.trim() || !manualCity.trim()) {
      setSearchError('Please provide both Area/Locality and City.');
      return;
    }

    const manualLocation = {
      placeId: `manual_${Date.now()}`,
      formattedAddress: `${manualArea.trim()}, ${manualCity.trim()}${manualPin.trim() ? ' - ' + manualPin.trim() : ''}, India`,
      locality: manualArea.trim(),
      city: manualCity.trim(),
      district: manualCity.trim(),
      state: 'Uttar Pradesh',
      country: 'India',
      postalCode: manualPin.trim() || '',
      pinCode: manualPin.trim() || '',
      house: '',
      road: manualArea.trim(),
      houseRoad: manualArea.trim(),
      latitude: DEFAULT_COORDS.lat,
      longitude: DEFAULT_COORDS.lng,
    };

    setSelectedLocation(manualLocation);
    closeLocationPicker();
  };

  return (
    <div className={styles.modalOverlay} onClick={closeLocationPicker} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>📍</span>
            <div>
              <h2 className={styles.modalTitle}>Change Location</h2>
              <span className={styles.modalSub}>Select your doorstep delivery area</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeLocationPicker}
            aria-label="Close location selector"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Controls & Interactive Map */}
        <div className={styles.modalBodyGrid}>
          {/* Left Column: Use Current Location, Search, and Suggestions */}
          <div className={styles.controlsCol}>
            {/* 📍 Use Current Location Primary Button */}
            <div className={styles.currentLocationSection}>
              <button
                type="button"
                className={`${styles.useCurrentLocationBtn} ${isDetecting ? styles.detectingBtn : ''}`}
                onClick={handleUseCurrentLocation}
                disabled={isDetecting}
              >
                <span className={styles.detectBtnIcon}>
                  {isDetecting ? <span className={styles.detectSpinner} /> : '📍'}
                </span>
                <div className={styles.detectBtnTextCol}>
                  <span className={styles.detectBtnMain}>
                    {isDetecting ? 'Detecting your current location…' : '📍 Use Current Location'}
                  </span>
                  <span className={styles.detectBtnSub}>
                    {isDetecting
                      ? 'Fetching real GPS coordinates & address…'
                      : 'Use device GPS to auto-detect and save location'}
                  </span>
                </div>
              </button>

              {/* Success Notification */}
              {detectSuccess && (
                <div className={styles.detectSuccessBanner} role="status">
                  <span className={styles.successCheck}>✓</span>
                  <div>
                    <strong>Current location detected & saved!</strong>
                    <p>Navbar and checkout have been updated with your location.</p>
                  </div>
                </div>
              )}

              {/* Error Notification with Retry Option */}
              {geoError && (
                <div className={styles.geoErrorBanner} role="alert">
                  <div className={styles.geoErrorTop}>
                    <span className={styles.geoErrorIcon}>⚠️</span>
                    <span className={styles.geoErrorMsg}>{geoError}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.retryDetectBtn}
                    onClick={handleUseCurrentLocation}
                  >
                    🔄 Try Again
                  </button>
                </div>
              )}
            </div>

            {/* OR Divider */}
            <div className={styles.orDivider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>OR SEARCH MANUALLY</span>
              <span className={styles.dividerLine} />
            </div>

            {/* Search Input Bar */}
            <div className={styles.searchBar}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search area, street, landmark or pincode"
                value={searchQuery}
                onChange={handleSearchChange}
                aria-label="Search area, street, landmark or pincode"
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setSearchQuery('');
                    setPredictions([]);
                    setSearchError('');
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Suggestions List */}
            <div className={styles.suggestionsContainer}>
              {isSearching && (
                <div className={styles.searchingState}>
                  <div className={styles.spinner} />
                  <span>Searching OpenStreetMap locations...</span>
                </div>
              )}

              {searchError && (
                <div className={styles.errorBox}>
                  <span>⚠️</span>
                  <span>{searchError}</span>
                </div>
              )}

              {!isSearching && searchQuery.trim() && predictions.length === 0 && !searchError && (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📍</span>
                  <p className={styles.emptyTitle}>No locations found</p>
                  <p className={styles.emptySub}>Try searching another area, landmark or pincode.</p>
                </div>
              )}

              {!isSearching && predictions.length > 0 && (
                <ul className={styles.predictionsList}>
                  {predictions.map((p) => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        className={styles.predictionItem}
                        onClick={() => handleSelectPrediction(p)}
                      >
                        <span className={styles.itemPin}>📍</span>
                        <div className={styles.itemTexts}>
                          <span className={styles.itemMain}>{p.mainText}</span>
                          <span className={styles.itemSecondary}>{p.secondaryText || p.fullText}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Manual Entry Toggle */}
            <div className={styles.manualEntryRow}>
              <button
                type="button"
                className={styles.manualToggleBtn}
                onClick={() => setShowManualForm((prev) => !prev)}
              >
                {showManualForm ? 'Hide manual entry' : 'Enter location manually →'}
              </button>
            </div>

            {showManualForm && (
              <form onSubmit={handleManualSubmit} className={styles.manualForm}>
                <div className={styles.manualInputs}>
                  <input
                    type="text"
                    placeholder="Area / Locality (e.g. Kalyanpur)"
                    value={manualArea}
                    onChange={(e) => setManualArea(e.target.value)}
                    className={styles.manualInput}
                    required
                  />
                  <input
                    type="text"
                    placeholder="City (e.g. Kanpur)"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    className={styles.manualInput}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Pincode (optional)"
                    value={manualPin}
                    onChange={(e) => setManualPin(e.target.value)}
                    className={styles.manualInput}
                  />
                </div>
                <button type="submit" className={styles.manualSubmitBtn}>
                  Save Manual Location
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Interactive Leaflet Map & Selected Address Card */}
          <div className={styles.mapCol}>
            <div className={styles.mapWrapper}>
              <div ref={mapContainerRef} className={styles.leafletMapContainer} />
              <div className={styles.mapHintBadge}>
                <span>💡 Click map or drag pin to fine-tune destination</span>
              </div>
            </div>

            {/* Selected Address Display Card with Address Details Breakdown */}
            <div className={styles.selectedAddressCard}>
              <div className={styles.selectedHeaderRow}>
                <span
                  className={`${styles.selectedBadge} ${
                    previewLocation?.isCurrentLocation ? styles.currentLocationBadge : ''
                  }`}
                >
                  {previewLocation?.isCurrentLocation ? '📍 CURRENT LOCATION DETECTED' : 'SELECTED DESTINATION'}
                </span>
                {gpsAccuracy && (
                  <span className={styles.accuracyPill}>
                    ±{gpsAccuracy}m Accuracy
                  </span>
                )}
              </div>

              <h3 className={styles.selectedTitle}>
                {previewLocation?.locality || previewLocation?.city || 'Selected Location'}
              </h3>
              <p className={styles.selectedAddressText}>
                {previewLocation?.formattedAddress || `${previewLocation?.city || 'Kanpur'}, Uttar Pradesh, India`}
              </p>

              {/* Detailed Address Fields Breakdown */}
              <div className={styles.addressBreakdownGrid}>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>House / Road</span>
                  <strong className={styles.breakdownValue}>
                    {previewLocation?.houseRoad ||
                      previewLocation?.road ||
                      previewLocation?.street ||
                      previewLocation?.house ||
                      '—'}
                  </strong>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Locality</span>
                  <strong className={styles.breakdownValue}>
                    {previewLocation?.locality || '—'}
                  </strong>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>City</span>
                  <strong className={styles.breakdownValue}>
                    {previewLocation?.city || '—'}
                  </strong>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>District</span>
                  <strong className={styles.breakdownValue}>
                    {previewLocation?.district || previewLocation?.city || '—'}
                  </strong>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>State</span>
                  <strong className={styles.breakdownValue}>
                    {previewLocation?.state || '—'}
                  </strong>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>PIN Code</span>
                  <strong className={styles.breakdownValue}>
                    {previewLocation?.postalCode || previewLocation?.pinCode || '—'}
                  </strong>
                </div>
              </div>

              {/* Action Bar */}
              <div className={styles.confirmActionRow}>
                {previewLocation?.latitude && (
                  <span className={styles.selectedCoords}>
                    GPS: {Number(previewLocation.latitude).toFixed(4)}, {Number(previewLocation.longitude).toFixed(4)}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={handleConfirmLocation}
                >
                  Confirm & Use Location →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LocationPickerModal() {
  const { isLocationPickerOpen } = useLocation();

  if (!isLocationPickerOpen) return null;

  return <LocationPickerModalContent />;
}
