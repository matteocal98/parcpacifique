// Réglages SEO du site public (kalea.pro) : lus par outils/generer-pages-publiques.mjs.
// Modifier ici, relancer le générateur, puis recompiler le CSS (voir outils/css-site/README.md).

export const SITE = 'https://kalea.pro';

export const RESEAUX = {
  facebook: 'https://www.facebook.com/profile.php?id=61595294425802',
  linkedin: 'https://www.linkedin.com/company/kalea-software/',
};

// Image d'aperçu pour les partages (Facebook, LinkedIn, WhatsApp…) : 1200 × 630, à la racine du site.
export const IMAGE_PARTAGE = {
  chemin: { fr: '/partage-og.jpg', en: '/partage-og-en.jpg' }, largeur: 1200, hauteur: 630,
  alt: { fr: 'KALEA : suivi d\'entretien de parc, du manuel constructeur au plan d\'entretien', en: 'KALEA: fleet maintenance tracking, from the manufacturer manual to the maintenance plan' },
};

// Page d'accueil : titre ≤ 60 caractères et description ≤ 155 (Google coupe au-delà).
export const ACCUEIL = {
  fr: {
    titre: 'KALEA — Logiciel GMAO pour parc d\'engins et de machines',
    description: 'Transformez vos manuels constructeur en plans d\'entretien. Suivi aux heures, au km ou au calendrier, rappels avant panne, QR codes. Gratuit pour 2 machines.',
  },
  en: {
    titre: 'KALEA — Maintenance software for equipment fleets',
    description: 'Turn manufacturer manuals into maintenance plans. Track by hours, km or calendar, get reminders before breakdowns, use QR codes. Free for 2 machines.',
  },
};

// Identité de l'éditeur, pour les données structurées (Organization / SoftwareApplication).
export const ORGANISATION = {
  nom: 'KALEA',
  email: 'support@kalea.pro',
  logo: '/icones/icone-512.png',
  adresse: { ville: 'Dumbéa', pays: 'NC', codePostal: '98836' },
  description: {
    fr: 'KALEA transforme vos manuels constructeur en plans d\'entretien réels, suit chaque machine à l\'heure, au kilomètre ou au calendrier, et alerte avant qu\'une panne ne coûte cher.',
    en: 'KALEA turns your manufacturer manuals into real maintenance plans, tracks each machine by the hour, the kilometre or the calendar, and alerts you before a breakdown gets expensive.',
  },
};

// Offres affichées sur le site (prix en euros par mois) : à tenir d'accord avec la section « Tarifs » de la page d'accueil.
export const OFFRES = [
  { nom: 'Gratuit', prix: 0 },
  { nom: 'Starter', prix: 12 },
  { nom: 'Business', prix: 39 },
  { nom: 'Enterprise', prix: 79 },
];
