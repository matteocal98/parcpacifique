// Réglages SEO du site public (kalea.pro) : lus par outils/generer-pages-publiques.mjs.
// Modifier ici, relancer le générateur, puis recompiler le CSS (voir outils/css-site/README.md).

export const SITE = 'https://kalea.pro';

export const RESEAUX = {
  facebook: 'https://www.facebook.com/kalea.pro',
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
    description: 'Évitez les pannes faute de suivi : plans d\'entretien tirés de vos manuels, suivi aux heures, km ou calendrier, rappels, QR codes. Gratuit pour 2 machines.',
  },
  en: {
    titre: 'KALEA — Maintenance software for equipment fleets',
    description: 'Avoid breakdowns caused by weak tracking: maintenance plans from your manuals, tracking by hours, km or calendar, reminders, QR codes. Free for 2 machines.',
  },
};

// Identité de l'éditeur, pour les données structurées (Organization / SoftwareApplication).
export const ORGANISATION = {
  nom: 'KALEA',
  email: 'support@kalea.pro',
  logo: '/icones/icone-512.png',
  adresse: { ville: 'Dumbéa', pays: 'NC', codePostal: '98836' },
  description: {
    fr: 'KALEA transforme vos manuels constructeur en plans d\'entretien réels, suit chaque machine à l\'heure, au kilomètre ou au calendrier, pour vous éviter les pannes faute d\'un suivi efficace.',
    en: 'KALEA turns your manufacturer manuals into real maintenance plans, tracks each machine by the hour, the kilometre or the calendar, to help you avoid breakdowns caused by weak maintenance tracking.',
  },
};

// Données structurées de l'application (SoftwareApplication) : lien Google Play, captures (adresses sous kalea.pro), fonctions.
export const APPLICATION = {
  googlePlay: 'https://play.google.com/store/apps/details?id=pro.kalea.app',
  captures: ['/captures-app/tableau-de-bord-v2.png', '/captures-app/plan-entretien.png', '/captures-app/stock.png', '/captures-app/tco.png', '/captures-app/agenda.png', '/captures-app/fiche-machine.png'],
  fonctions: {
    fr: ['Plans d\'entretien générés à partir des manuels constructeur', 'Suivi aux heures, au kilomètre ou au calendrier', 'Rappels d\'échéance par notification', 'Stock de pièces détachées et commandes fournisseurs', 'Coût de possession (TCO) par machine', 'QR codes sur les machines', 'Application mobile Android'],
    en: ['Maintenance plans built from manufacturer manuals', 'Tracking by hours, kilometres or calendar', 'Due-date reminders by notification', 'Spare-parts stock and supplier orders', 'Total cost of ownership (TCO) per machine', 'QR codes on machines', 'Android mobile app'],
  },
  zones: ['NC', 'FR', 'PF', 'WF', 'VU'],
};

// Offres affichées sur le site (prix en euros par mois) : à tenir d'accord avec la section « Tarifs » de la page d'accueil.
export const OFFRES = [
  { nom: 'Gratuit', prix: 0 },
  { nom: 'Starter', prix: 12 },
  { nom: 'Business', prix: 39 },
  { nom: 'Enterprise', prix: 79 },
];
