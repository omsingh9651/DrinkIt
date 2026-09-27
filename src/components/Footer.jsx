import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const FOOTER_SECTIONS = [
  {
    heading: 'Shop',
    links: [
      { label: 'Wine', to: '/products?category=Wine' },
      { label: 'Whisky', to: '/products?category=Whisky' },
      { label: 'Beer', to: '/products?category=Beer' },
      { label: 'Cocktails', to: '/products?category=Cocktails' },
      { label: 'All Products', to: '/products' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Careers', to: '/about' },
      { label: 'Press & Media', to: '/about' },
      { label: 'Our Cellars', to: '/about' },
    ],
  },
  {
    heading: 'Customer Care',
    links: [
      { label: 'Cart', to: '/cart' },
      { label: 'My Account', to: '/login' },
      { label: 'Shipping Policy', to: '/about' },
      { label: 'Returns & FAQ', to: '/about' },
    ],
  },
];

const SOCIAL = [
  { label: 'Instagram', icon: '📸', url: '#' },
  { label: 'Twitter', icon: '🐦', url: '#' },
  { label: 'Facebook', icon: '👤', url: '#' },
];

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Brand column */}
        <div className={styles.brandCol}>
          <Link to="/" className={styles.logo}>
            🥃 DrinkIt
          </Link>
          <p className={styles.tagline}>
            Curated fine wines, aged whiskies, craft brews & cocktails delivered straight to your door.
          </p>
          <div className={styles.socials}>
            {SOCIAL.map(({ label, icon, url }) => (
              <a
                key={label}
                href={url}
                className={styles.socialLink}
                aria-label={label}
                onClick={(e) => e.preventDefault()}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {FOOTER_SECTIONS.map((section) => (
          <div key={section.heading} className={styles.linkCol}>
            <h4 className={styles.colHeading}>{section.heading}</h4>
            <ul className={styles.linkList}>
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} DrinkIt. All rights reserved.</p>
        <p className={styles.legal}>
          <Link to="/about">Privacy Policy</Link> · <Link to="/about">Terms of Service</Link>
        </p>
        <p className={styles.ageNote}>🔞 Please drink responsibly. Must be 18+ to purchase.</p>
      </div>
    </footer>
  );
}

export default Footer;
