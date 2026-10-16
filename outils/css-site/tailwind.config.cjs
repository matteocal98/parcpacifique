/* Config Tailwind des pages publiques : identique à celle qui était embarquée dans decouvrir.html (script « tailwind-config »).
   Les sources analysées pour trouver les classes utilisées : les pages publiques et leurs scripts (les classes ajoutées
   par JavaScript — vidéos, simulateur de tarifs, bascule de langue — doivent être écrites en toutes lettres dans ces fichiers). */
module.exports = {
  darkMode: 'class',
  content: [
    '../../index.html', '../../decouvrir.html', '../../en/index.html', '../../gmao/*.html', '../../en/*/*.html',
    '../../videos-accueil.js', '../../simulateur-tarifs.js', '../../accueil-langue.js',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#0E1333', dark: '#070B19', primary: '#236FE0', indigo: '#5B52DF', teal: '#24B5A8', amber: '#EE7D1A',
          surface: '#F8F9FC', cardBg: '#FFFFFF', subtleBg: '#EFF4FF', borderMuted: '#E4E8F2',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        display: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
