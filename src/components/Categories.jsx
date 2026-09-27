import { Link } from 'react-router-dom';
import styles from './Categories.module.css';

// Indian-market 6 core categories
const CATEGORIES = [
  {
    id: 1,
    emoji: '🍷',
    name: 'Wine',
    description: 'Nashik estate Shiraz, Super Tuscans & Nandi Hills reserves.',
    count: 'Sula, Fratelli, Grover',
    gradient: 'linear-gradient(135deg, #7b2d8b 0%, #c0392b 100%)',
  },
  {
    id: 2,
    emoji: '🥃',
    name: 'Whisky',
    description: 'Indian single malts, Solera reserves & premium blended Scotch.',
    count: 'Amrut, Blenders Pride, JW',
    gradient: 'linear-gradient(135deg, #b8860b 0%, #8b4513 100%)',
  },
  {
    id: 3,
    emoji: '🍺',
    name: 'Beer',
    description: 'Belgian wheat ales, crisp lagers & beechwood aged strong brews.',
    count: 'Kingfisher, Bira 91, Budweiser',
    gradient: 'linear-gradient(135deg, #e67e22 0%, #d4a017 100%)',
  },
  {
    id: 4,
    emoji: '🍸',
    name: 'Vodka',
    description: 'Triple-distilled pure grain vodkas & birch charcoal filtered spirits.',
    count: 'Smirnoff, Magic Moments',
    gradient: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)',
  },
  {
    id: 5,
    emoji: '🥃',
    name: 'Rum',
    description: 'Aged dark vatted rums, white rums & charred barrel selections.',
    count: 'Old Monk, Bacardi',
    gradient: 'linear-gradient(135deg, #870000 0%, #190a05 100%)',
  },
  {
    id: 6,
    emoji: '🍷',
    name: 'Brandy',
    description: 'French oak aged grape brandies & luxurious XO expressions.',
    count: 'Mansion House, Morpheus',
    gradient: 'linear-gradient(135deg, #780206 0%, #061161 100%)',
  },
];

function CategoryCard({ category }) {
  return (
    <Link
      to={`/products?category=${encodeURIComponent(category.name)}`}
      className={styles.card}
      style={{ '--gradient': category.gradient }}
      aria-label={`Browse ${category.name} category`}
    >
      {/* Colored top band */}
      <div className={styles.cardBand} />

      <div className={styles.cardBody}>
        <span className={styles.emoji}>{category.emoji}</span>
        <h3 className={styles.cardName}>{category.name}</h3>
        <p className={styles.cardDesc}>{category.description}</p>
        <span className={styles.count}>{category.count}</span>
        <span className={styles.shopBtn}>Explore Category →</span>
      </div>
    </Link>
  );
}

function Categories() {
  return (
    <section className={styles.section} id="categories">
      <div className={styles.header}>
        <p className={styles.label}>Curated Categories</p>
        <h2 className={styles.title}>Explore the DrinkIt Reserve</h2>
        <p className={styles.subtitle}>
          Discover authentic Indian wines, global single malts, craft brews, and iconic spirits.
        </p>
      </div>

      <div className={styles.grid}>
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </section>
  );
}

export default Categories;
