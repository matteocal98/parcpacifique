/** Config Tailwind IDENTIQUE à celle embarquée dans mockup.html (Stitch) —
 *  reprise telle quelle : ce mockup a lui-même repris les noms de tokens de
 *  outils/tw-modifier-machine/ (voir prompt-stitch-ajouter-machine.md), donc
 *  ici c'est vraiment la config source, pas une retranscription. */
module.exports = {
  important: '.machine-modal-add',
  // integration-scan.html : extrait réel de stepFormUnique() dans app.html
  // (pas juste le mockup Stitch) — certaines classes utilitaires ajoutées
  // pendant l'intégration (min-h-0, w-1/3…) n'existaient pas dans le mockup
  // et n'auraient jamais été compilées sans ça.
  content: ['./mockup.html', './integration-scan.html'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: '#006591',
        'primary-dark': '#004f73',
        'on-surface': '#0b1c30',
        surface: '#f8f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'tertiary-container': '#ee7d1a',
        'tertiary-container-hover': '#d96c0d',
        'tertiary-light': '#fff7ed',
        outline: '#6e7881',
        'modal-bg': '#F2F4F8',
        'navy-deep': '#0E1333',
        'turquoise-keeva': '#24B5A8',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        modal: '0 25px 60px -15px rgba(14, 19, 51, 0.28)',
        subtle: '0 1px 3px rgba(14, 19, 51, 0.05), 0 1px 2px rgba(14, 19, 51, 0.03)',
        card: '0 2px 10px -2px rgba(14, 19, 51, 0.04)',
        'inner-soft': 'inset 0 2px 4px rgba(14, 19, 51, 0.04)',
      },
    },
  },
};
