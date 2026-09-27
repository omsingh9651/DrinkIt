import { useState } from 'react';
import styles from './AccountCoupons.module.css';

const AVAILABLE_COUPONS = [
  {
    code: 'DRINKIT10',
    discount: '10% OFF',
    title: 'Storewide Tasting Welcome',
    description: 'Enjoy 10% instant discount on any cart order above ₹1,000.',
    minOrder: '₹1,000',
    expiry: 'Valid till 31 Dec 2026',
  },
  {
    code: 'FIRSTSIP',
    discount: '₹250 OFF',
    title: 'First DrinkIt Order',
    description: 'Flat ₹250 instant concession on your inaugural single malt or wine order.',
    minOrder: '₹2,500',
    expiry: 'Valid for new members',
  },
  {
    code: 'PARTYRESERVE',
    discount: '15% OFF',
    title: 'Bulk Reserve Celebration',
    description: 'Get 15% discount when stocking up 6 or more bottles for private gatherings.',
    minOrder: '₹8,000',
    expiry: 'Valid on 6+ bottles',
  },
  {
    code: 'SINGLEMALT',
    discount: '₹500 OFF',
    title: 'Premium Spirits Connoisseur',
    description: 'Flat ₹500 off on select premium Indian and Scottish Single Malts.',
    minOrder: '₹5,000',
    expiry: 'Limited period offer',
  },
];

export default function AccountCoupons() {
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className={styles.container}>
      {copiedCode && (
        <div className={styles.toast}>
          ✔ Coupon code <strong>{copiedCode}</strong> copied to clipboard!
        </div>
      )}

      <div className={styles.header}>
        <h1>Coupons & Exclusive Offers</h1>
        <p>Apply these promotional codes during checkout to enjoy member-only savings.</p>
      </div>

      <div className={styles.grid}>
        {AVAILABLE_COUPONS.map((c) => (
          <div key={c.code} className={styles.couponCard}>
            <div className={styles.cardTop}>
              <span className={styles.discountBadge}>{c.discount}</span>
              <span className={styles.expiryBadge}>{c.expiry}</span>
            </div>

            <div className={styles.couponDetails}>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#e5a84b' }}>
                Min Order: {c.minOrder}
              </div>
            </div>

            <div className={styles.cardBottom}>
              <span className={styles.codeBox}>{c.code}</span>
              <button
                type="button"
                onClick={() => handleCopy(c.code)}
                className={styles.copyBtn}
              >
                {copiedCode === c.code ? '✔ Copied' : 'Copy Code'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
