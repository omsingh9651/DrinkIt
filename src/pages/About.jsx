import { Link } from 'react-router-dom';
import styles from './About.module.css';

const PILLARS = [
  {
    icon: '🍇',
    title: 'Rare & Curated Cellars',
    description:
      'We partner directly with family-owned vineyards, boutique distilleries, and micro-breweries to source hard-to-find vintages and award-winning spirits.',
  },
  {
    icon: '❄️',
    title: 'Temperature-Controlled Logistics',
    description:
      'Every delicate bottle travels in thermally insulated, shock-absorbent packaging to ensure pristine preservation of aroma, effervescence, and body.',
  },
  {
    icon: '🛡️',
    title: '100% Verified Authenticity',
    description:
      'Every batch passes a strict multi-point authenticity check. No counterfeits, no compromises — just pure liquid craftsmanship in every pour.',
  },
  {
    icon: '🍸',
    title: 'Sommelier & Mixologist Support',
    description:
      'Whether pairing a vintage Cabernet with wagyu or crafting a smoked cocktail flight, our certified experts guide your choice.',
  },
];

const STATS = [
  { value: '500+', label: 'Artisanal Spirits & Vintages' },
  { value: '50+', label: 'Global Distilleries & Wineries' },
  { value: '10,000+', label: 'Delighted Connoisseurs' },
  { value: '4.8 ★', label: 'Customer Satisfaction Score' },
];

export default function About() {
  return (
    <div className={styles.container}>
      {/* Hero Header */}
      <section className={styles.heroSection}>
        <span className={styles.badge}>Our Story & Philosophy</span>
        <h1 className={styles.heroTitle}>
          Elevating Every Pour, <br />
          <span className={styles.goldText}>One Bottle at a Time</span>
        </h1>
        <p className={styles.heroLead}>
          DrinkIt was founded with a singular conviction: discovering and savouring world-class drinks should be as delightful as the first sip itself.
        </p>
      </section>

      {/* Stats Bar */}
      <section className={styles.statsBar}>
        {STATS.map((stat) => (
          <div key={stat.label} className={styles.statItem}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </section>

      {/* Story & Mission Section */}
      <section className={styles.storySection}>
        <div className={styles.storyContent}>
          <span className={styles.storyLabel}>Behind the Brand</span>
          <h2 className={styles.storyTitle}>Born from Passion for Liquid Art</h2>
          <p className={styles.storyParagraph}>
            In a market overflowing with mass-produced options, true liquid artistry was often locked behind exclusive cellar doors or distant specialty importers. We set out to change that.
          </p>
          <p className={styles.storyParagraph}>
            DrinkIt bridges the world’s most celebrated appellations directly to your doorstep. From centuries-old Speyside single malts and Premier Cru Bordeaux to cutting-edge craft IPAs and mixologist cocktail kits, our cellar represents the pinnacle of taste and craftsmanship.
          </p>
        </div>

        <div className={styles.storyVisual}>
          <div className={styles.visualCard}>
            <span className={styles.visualEmoji}>🥃</span>
            <div className={styles.visualQuote}>
              &ldquo;DrinkIt delivers not just alcohol, but memorable moments shared across dinner tables and celebratory glasses.&rdquo;
            </div>
            <span className={styles.visualAuthor}>— The DrinkIt Curatorial Team</span>
          </div>
        </div>
      </section>

      {/* Pillars Grid */}
      <section className={styles.pillarsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.storyLabel}>Why DrinkIt</span>
          <h2 className={styles.sectionTitle}>The DrinkIt Distinction</h2>
          <p className={styles.sectionSubtitle}>
            What makes our digital cellar the preferred destination for beverage enthusiasts.
          </p>
        </div>

        <div className={styles.pillarsGrid}>
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className={styles.pillarCard}>
              <span className={styles.pillarIcon}>{pillar.icon}</span>
              <h3 className={styles.pillarTitle}>{pillar.title}</h3>
              <p className={styles.pillarDesc}>{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to Experience the Cellar?</h2>
          <p className={styles.ctaText}>
            Explore our curated inventory of wines, whiskies, craft beers, and ready-to-pour cocktail collections today.
          </p>
          <Link to="/products" className={styles.ctaButton}>
            Browse Full Collection →
          </Link>
        </div>
      </section>
    </div>
  );
}

