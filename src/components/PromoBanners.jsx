import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchActiveBanners } from '../services/bannerApi';
import styles from './PromoBanners.module.css';

export default function PromoBanners() {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchActiveBanners();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setBanners(data);
        }
      } catch (err) {
        console.warn('Could not load promo banners:', err.message);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const nextSlide = useCallback(() => {
    setBanners((prev) => {
      if (prev.length <= 1) return prev;
      setCurrentIndex((curr) => (curr + 1) % prev.length);
      return prev;
    });
  }, []);

  const prevSlide = useCallback(() => {
    setBanners((prev) => {
      if (prev.length <= 1) return prev;
      setCurrentIndex((curr) => (curr - 1 + prev.length) % prev.length);
      return prev;
    });
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [banners.length, isPaused, nextSlide]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const current = banners[currentIndex];

  return (
    <section
      className={styles.bannerSection}
      aria-label="Promotional Highlights"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={styles.carouselContainer}>
        <div
          className={styles.bannerSlide}
          style={{ backgroundImage: `url("${current.image}")` }}
        >
          <div className={styles.overlay}>
            <div className={styles.content}>
              {current.badgeText && (
                <span className={styles.badge}>{current.badgeText}</span>
              )}
              <h2 className={styles.title}>{current.title}</h2>
              {current.subtitle && (
                <p className={styles.subtitle}>{current.subtitle}</p>
              )}
              {current.ctaText && current.ctaLink && (
                <Link to={current.ctaLink} className={styles.ctaButton}>
                  <span>{current.ctaText}</span>
                  <span className={styles.ctaArrow}>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={prevSlide}
              aria-label="Previous Slide"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={nextSlide}
              aria-label="Next Slide"
            >
              ›
            </button>

            <div className={styles.indicators}>
              {banners.map((b, idx) => (
                <button
                  key={b.id || idx}
                  type="button"
                  className={`${styles.dot} ${idx === currentIndex ? styles.activeDot : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

