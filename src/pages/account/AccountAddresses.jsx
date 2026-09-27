import { useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useLocation } from '../../context/LocationContext';
import styles from './AccountAddresses.module.css';

const INITIAL_FORM = {
  fullName: '',
  mobileNumber: '',
  house: '',
  street: '',
  landmark: '',
  city: '',
  state: 'Uttar Pradesh',
  pinCode: '',
  type: 'Home',
  isDefault: false,
};

export default function AccountAddresses() {
  const { addresses, addAddress, editAddress, deleteAddress, setDefaultAddress, profile } = useUser();
  const { selectedLocation } = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = add, string = edit
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      ...INITIAL_FORM,
      fullName: profile?.fullName || '',
      mobileNumber: profile?.phoneNumber?.replace(/\D/g, '').slice(-10) || '',
      city: selectedLocation?.city || '',
      state: selectedLocation?.state || 'Uttar Pradesh',
      pinCode: selectedLocation?.postalCode || '',
      street: selectedLocation?.street || selectedLocation?.locality || '',
      landmark: selectedLocation?.landmark || '',
      isDefault: addresses.length === 0,
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (addr) => {
    setEditingId(addr.id);
    setFormData({ ...addr });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!formData.mobileNumber || formData.mobileNumber.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!formData.house.trim() || !formData.street.trim() || !formData.city.trim() || !formData.pinCode.trim()) {
      setErrorMessage('Please fill in complete address details.');
      return;
    }

    try {
      if (editingId) {
        await editAddress(editingId, formData);
      } else {
        await addAddress(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save address:', err);
      setErrorMessage('Failed to save address. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Saved Delivery Addresses</h1>
          <p>Manage your doorstep delivery destinations for express dispatch.</p>
        </div>

        <button type="button" onClick={handleOpenAdd} className={styles.addBtn}>
          <span>+</span>
          <span>Add New Address</span>
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No saved addresses found. Add an address for fast checkout.</p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`${styles.addressCard} ${
                addr.isDefault ? styles.addressCardDefault : ''
              }`}
            >
              <div>
                <div className={styles.cardTop}>
                  <span className={styles.typeBadge}>{addr.type || 'Home'}</span>
                  {addr.isDefault && (
                    <span className={styles.defaultBadge}>Default</span>
                  )}
                </div>

                <div className={styles.recipientName}>{addr.fullName}</div>
                <div className={styles.recipientPhone}>📞 {addr.mobileNumber}</div>

                <div className={styles.addressLines}>
                  {addr.house}, {addr.street}
                  {addr.landmark && `, near ${addr.landmark}`}
                  <br />
                  {addr.city}, {addr.state} — {addr.pinCode}
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(addr)}
                  className={styles.actionLinkBtn}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => deleteAddress(addr.id)}
                  className={`${styles.actionLinkBtn} ${styles.deleteBtn}`}
                >
                  Delete
                </button>

                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultAddress(addr.id)}
                    className={`${styles.actionLinkBtn} ${styles.makeDefaultBtn}`}
                  >
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
              </h2>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                {errorMessage && (
                  <div style={{ color: '#ff858d', fontSize: '0.85rem' }}>
                    ⚠️ {errorMessage}
                  </div>
                )}

                {selectedLocation && (
                  <button
                    type="button"
                    className={styles.autofillBtn}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        city: selectedLocation.city || prev.city,
                        state: selectedLocation.state || prev.state,
                        pinCode: selectedLocation.postalCode || prev.pinCode,
                        street: selectedLocation.street || selectedLocation.locality || prev.street,
                        landmark: selectedLocation.landmark || prev.landmark,
                      }));
                    }}
                  >
                    📍 Autofill with current location ({selectedLocation.locality || selectedLocation.city})
                  </button>
                )}

                <div className={styles.formGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Recipient Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikramaditya"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      maxLength="10"
                      placeholder="10-digit number"
                      value={formData.mobileNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobileNumber: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Flat / House / Building *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 402, Royal Palms Towers"
                      value={formData.house}
                      onChange={(e) =>
                        setFormData({ ...formData, house: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Street / Area / Colony *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Linking Road, Bandra West"
                      value={formData.street}
                      onChange={(e) =>
                        setFormData({ ...formData, street: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Landmark</label>
                    <input
                      type="text"
                      placeholder="e.g. Near Olive Bistro"
                      value={formData.landmark}
                      onChange={(e) =>
                        setFormData({ ...formData, landmark: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mumbai"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>State *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maharashtra"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength="6"
                      placeholder="400050"
                      value={formData.pinCode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pinCode: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Address Type</label>
                    <div className={styles.typeSelector}>
                      {['Home', 'Work', 'Other'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.typeBtn} ${
                            formData.type === t ? styles.typeBtnActive : ''
                          }`}
                          onClick={() => setFormData({ ...formData, type: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) =>
                          setFormData({ ...formData, isDefault: e.target.checked })
                        }
                      />
                      <span>Make this my default delivery address</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingId ? 'Update Address' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
