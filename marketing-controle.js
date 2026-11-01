/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/marketing-controle.ts — NE PAS MODIFIER À LA MAIN.
   Contrôle de pertinence et de cohérence des contenus marketing (base de faits vérifiés + règles), utilisé par la page Marketing de la console. */
(function () {
'use strict';
// KALEA — MARKETING : BASE DE FAITS VÉRIFIÉS + CONTRÔLE DE PERTINENCE ET DE COHÉRENCE (logique pure, aucun réseau).
//
// RÈGLE PERMANENTE (fixée par le propriétaire le 2026-11-01) : rien n'est publié ni promu sans analyse de sa pertinence et de sa cohérence.
// Ce fichier est cette règle sous forme de code : il ne juge pas le style, il REFUSE ce qui est faux, invérifiable ou incohérent, et il explique
// pourquoi. Une publication « bloquée » ne part pas ; un « avertissement » demande un regard humain. La décision finale reste celle du propriétaire.
//
// SOURCES DE VÉRITÉ (à tenir d'accord) : la grille tarifaire vit dans l'application (OFFRE_GRILLE…) et dans parcpacifique/simulateur-tarifs.js ;
// la liste des fonctions publiées vit dans parcpacifique/outils/seo-config.mjs. Un test compare cette base à ces fichiers (tests/marketing-controle.test.mjs).

                                
                                                                                                                      

                       
            
                                         
            
            
                                                                                              
                
                                                                                       
                                                            
                                  
                
                    
 

// Faits utilisables dans une publication : SEULS ceux au statut « verifie ». Les autres sont des pistes en attente de vérification (écran à l'appui).
const FAITS         = [
  { id: 'offre-gratuit', sujet: 'offre', statut: 'verifie', verifie_le: '2026-11-02', mots: ['gratuit', 'free'],
    fr: 'L\'offre Gratuit couvre 2 machines et 1 utilisateur, sans limite de durée.', en: 'The Free plan covers 2 machines and 1 user, with no time limit.',
    preuve: 'parcpacifique/simulateur-tarifs.js (OFFRES free : incluses 2, max 2, utilisateurs 1) ; seo-config ACCUEIL « Gratuit pour 2 machines »' },
  { id: 'offre-starter', sujet: 'offre', statut: 'verifie', verifie_le: '2026-11-02', mots: ['starter'],
    fr: 'Starter : 12 € par mois, 5 machines incluses, 2 € par machine en plus, 1 utilisateur.', en: 'Starter: €12 per month, 5 machines included, €2 per extra machine, 1 user.',
    preuve: 'parcpacifique/simulateur-tarifs.js (starter : base 12, incluses 5, extra 2, utilisateurs 1)' },
  { id: 'offre-business', sujet: 'offre', statut: 'verifie', verifie_le: '2026-11-02', mots: ['business'],
    fr: 'Business : 39 € par mois, 20 machines incluses, 1,50 € par machine en plus, utilisateurs illimités.', en: 'Business: €39 per month, 20 machines included, €1.50 per extra machine, unlimited users.',
    preuve: 'parcpacifique/simulateur-tarifs.js (business : base 39, incluses 20, extra 1.5, utilisateurs 9999)' },
  { id: 'offre-enterprise', sujet: 'offre', statut: 'verifie', verifie_le: '2026-11-02', mots: ['enterprise'],
    fr: 'Enterprise : 79 € par mois, 40 machines incluses, tarif dégressif au-delà, utilisateurs illimités.', en: 'Enterprise: €79 per month, 40 machines included, tiered pricing beyond, unlimited users.',
    preuve: 'parcpacifique/simulateur-tarifs.js (enterprise : base 79, incluses 40, tranches, utilisateurs 9999)' },
  { id: 'plans-depuis-manuels', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['manuel', 'manual', 'carnet'],
    fr: 'Plans d\'entretien générés à partir des manuels constructeur.', en: 'Maintenance plans built from manufacturer manuals.',
    preuve: 'parcpacifique/outils/seo-config.mjs APPLICATION.fonctions[0] (publié sur le site)' },
  { id: 'suivi-compteur', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['heures', 'kilomètre', 'kilometre', 'hours', 'calendrier', 'calendar'],
    fr: 'Suivi aux heures, au kilomètre ou au calendrier.', en: 'Tracking by hours, kilometres or calendar.',
    preuve: 'seo-config.mjs APPLICATION.fonctions[1]' },
  { id: 'rappels', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['rappel', 'reminder', 'alerte', 'alert'],
    fr: 'Rappels d\'échéance par notification.', en: 'Due-date reminders by notification.',
    preuve: 'seo-config.mjs APPLICATION.fonctions[2] (reformulé le 2026-11-02 : « avant panne » promettait plus que ce qu\'on peut prouver)' },
  { id: 'service-plan-29', sujet: 'offre', statut: 'verifie', verifie_le: '2026-11-02', mots: ['29 €', '29€', '€29', 'plaque constructeur', 'manufacturer plate'],
    fr: 'Service « Établissement de ton plan d\'entretien » : 29 € l\'acte. Sur photo de la plaque constructeur, KALEA recherche et configure le plan complet dans l\'application.', en: 'Maintenance-plan setup service: €29 per plan. From a photo of the manufacturer plate, KALEA researches and configures the full plan in the application.',
    preuve: 'parcpacifique/decouvrir.html (bloc service, 29 € l\'acte) ; confirmé d\'actualité par le propriétaire le 2026-11-02' },
  { id: 'message-cle', sujet: 'message', statut: 'verifie', verifie_le: '2026-11-02', mots: [],
    fr: 'Évitez les pannes faute d\'un suivi efficace.', en: 'Avoid breakdowns caused by weak maintenance tracking.',
    preuve: 'formulation décidée par le propriétaire le 2026-11-02 pour remplacer « rappels avant panne » ; utilisée dans la description du site' },
  { id: 'stock', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['stock', 'pièces', 'pieces', 'fournisseur', 'supplier'],
    fr: 'Stock de pièces détachées et commandes fournisseurs.', en: 'Spare-parts stock and supplier orders.',
    preuve: 'seo-config.mjs APPLICATION.fonctions[3]' },
  { id: 'tco', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['tco', 'coût de possession', 'cout de possession', 'cost of ownership'], offre_min: 'business',
    fr: 'Coût de possession (TCO) par machine, à partir de l\'offre Business.', en: 'Total cost of ownership (TCO) per machine, from the Business plan.',
    preuve: 'seo-config.mjs APPLICATION.fonctions[4] ; mémoire « TCO plan gating » (Business et Enterprise seulement)' },
  { id: 'qr-codes', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['qr'],
    fr: 'QR codes sur les machines.', en: 'QR codes on machines.', preuve: 'seo-config.mjs APPLICATION.fonctions[5]' },
  { id: 'appli-android', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['android', 'google play', 'play store'],
    fr: 'Application mobile Android.', en: 'Android mobile app.', preuve: 'seo-config.mjs APPLICATION.fonctions[6] ; lien Google Play publié' },
  { id: 'telemetrie', sujet: 'fonction', statut: 'verifie', verifie_le: '2026-11-02', mots: ['télémétrie', 'telemetrie', 'telemetry', 'boîtier', 'boitier', 'tracker', 'gps'], offre_min: 'enterprise',
    fr: 'Télémétrie (compteur automatique et position des machines cochées « Localiser »), réservée à l\'offre Enterprise.', en: 'Telemetry (automatic counter and position of machines ticked “Track location”), Enterprise plan only.',
    preuve: 'parcpacifique/politique-confidentialite.html §2 et §3 (« option de l\'offre Enterprise »)' },
  // ── pistes à vérifier avant tout usage (une fonction ne se promet pas de mémoire) ──
  { id: 'saisie-hors-ligne', sujet: 'fonction', statut: 'a_verifier', verifie_le: '', mots: ['hors ligne', 'sans réseau', 'offline'],
    fr: 'Saisie sans réseau, envoyée au retour de la connexion.', en: 'Entries without network, sent when the connection returns.', preuve: 'app-18-copie-locale.js (à vérifier sur un appareil)' },
  { id: 'signaler-panne', sujet: 'fonction', statut: 'a_verifier', verifie_le: '', mots: ['panne', 'breakdown'],
    fr: 'Signaler une panne depuis le terrain avec suivi par le gérant.', en: 'Report a breakdown from the field, followed by the manager.', preuve: 'mémoire « signaler une panne » (validé sur appareil le 2026-10-13) — à relire' },
  { id: 'ordres-travail', sujet: 'fonction', statut: 'a_verifier', verifie_le: '', mots: ['ordre de travail', 'ordres de travail', 'work order'],
    fr: 'Ordres de travail.', en: 'Work orders.', preuve: 'app-17-ordres-travail.js (à vérifier)' },
]

const OFFRES = ['free', 'starter', 'business', 'enterprise']         
// Montants (€) qui existent : grille d'abonnement (base, machine en plus par offre et par tranche) + le service « plan d'entretien » à 29 €.
const MONTANTS_AUTORISES = new Set([0, 12, 39, 79, 2, 1.5, 1, 0.7, 0.45, 0.3, 29])
// Montants propres à chaque offre : prix de base puis prix de la machine en plus (Enterprise : tranches dégressives).
const PRIX_PAR_OFFRE                              = { starter: new Set([12, 2]), business: new Set([39, 1.5]), enterprise: new Set([79, 1, 0.7, 0.45, 0.3]) }

                                                                                                                                                 
                                                                                                               
                                                                                               

const sansAccents = (s        ) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const nombre = (s        ) => Number(s.replace(',', '.'))

// Montants écrits dans le texte : « 12 € », « 12€ », « €12 », « 12 euros », « $12 », « 12 USD », « 12 XPF »
function montantsDuTexte(texte        )           {
  const motifs = [/(\d+(?:[.,]\d+)?)\s?(?:€|euros?|eur\b|\$|usd\b|xpf\b|f\s?cfp\b)/gi, /(?<!\d)(?<!\d\s)(?:€|\$)\s?(\d+(?:[.,]\d+)?)/g]
  const trouves           = []
  for (const m of motifs) for (const r of texte.matchAll(m)) trouves.push(nombre(r[1]))
  return trouves
}

const SUPERLATIFS = /(\bn\s?[°o]\s?1\b|\bnum[ée]ro\s?1\b|#1\b|\bleader\b|\ble meilleur\b|\bla meilleure\b|\bthe best\b|\bbest[- ]in[- ]class\b|\bgaranti(?:e|s|es)?\b|\bguarantee[sd]?\b|\bsans risque\b|\brisk[- ]free\b|\b100\s?%)/i
const PREUVE_SOCIALE = /(ils nous font confiance|nous font confiance|d[ée]j[àa] (?:utilis[ée]|adopt[ée])e? par|nos clients|notre client|t[ée]moignage|avis clients?|des centaines (?:de|d')|des milliers (?:de|d')|trusted by|our customers|our clients|testimonial|loved by)/i
const PROMESSE_ABSOLUE = /(plus jamais d[e']|jamais plus d[e']|z[ée]ro panne|aucune panne|sans (?:aucune )?panne|never again|no more (?:breakdowns|downtime|stopped)|zero (?:breakdowns?|downtime)|breakdown[- ]free)/i
const AVANT_PANNE = /(avant (?:la |une |qu'une |que la )?panne|before (?:a |the )?breakdowns?|before (?:it|they) breaks?)/i
const CONCURRENTS =/\b(mainter|fleetio|limble|upkeep|maintainx|fiix|samsara)\b/i
const ECONOMIES = /([ée]conomis(?:ez|ons|er)\s+(?:jusqu['’]à\s+)?\d|\br[ée]duisez? (?:de|vos)\b.{0,30}\d|\bdivisez\b|\bsave (?:up to )?\d|\bcut (?:your )?costs? by\b)/i
const MOTS_CIBLE = /(parc|engin|machine|flotte|v[ée]hicule|entretien|maintenance|chantier|fleet|equipment|vehicle|maintenance)/i

function excedent(max        , texte        )         { return Math.max(0, texte.length - max) }

// Les limites réelles des réseaux sont plus larges ; on garde une marge de lisibilité.
const LONGUEUR_MAX                                 = { linkedin: 2500, facebook: 1500, email_froid: 1200, email_inscrits: 3000, video_script: 2500 }

function controlerPublication(e        )        {
  const texte = e.texte || ''
  const norm = sansAccents(texte)
  const c             = []
  const bloc = (id        , axe                 , message        ) => c.push({ id, niveau: 'bloquant', axe, message })
  const avert = (id        , axe                 , message        ) => c.push({ id, niveau: 'avertissement', axe, message })
  const ok = (id        , axe                 , message        ) => c.push({ id, niveau: 'ok', axe, message })

  if (!texte.trim()) bloc('vide', 'pertinence', 'Le texte est vide.')

  // ── COHÉRENCE : la marque
  if (/keeva/i.test(texte)) bloc('marque', 'coherence', 'Le nom « KEEVA » est l\'ancien nom : la marque est KALEA.')
  else ok('marque', 'coherence', 'Marque : KALEA.')

  // ── COHÉRENCE : les chiffres
  const montants = montantsDuTexte(texte)
  const inconnus = montants.filter((m) => !MONTANTS_AUTORISES.has(m))
  if (inconnus.length) bloc('montants', 'coherence', `Montant(s) absent(s) de la grille tarifaire : ${[...new Set(inconnus)].join(', ')}. Seuls les prix de la grille peuvent être cités.`)
  else if (montants.length) ok('montants', 'coherence', 'Montants conformes à la grille tarifaire.')
  if (/\d\s?%/.test(texte) || /\bpour ?cent\b|\bpercent\b/i.test(texte)) bloc('pourcentage', 'coherence', 'Un pourcentage est cité : aucun pourcentage n\'est vérifié (réduction de coûts, gain de temps…). Retirez-le.')
  if (ECONOMIES.test(texte)) bloc('economies', 'coherence', 'Promesse d\'économie chiffrée : aucune mesure réelle ne l\'étaye pour l\'instant.')

  // prix cité à côté du nom d'une offre : doit être celui de la grille
  for (const r of texte.matchAll(/\b(starter|business|enterprise)\b[^.\n]{0,40}?(\d+(?:[.,]\d+)?)\s?(?:€|euros?|\$)/gi)) {
    const offre = r[1].toLowerCase()
    const valeur = nombre(r[2])
    if (!MONTANTS_AUTORISES.has(valeur)) continue          // déjà bloqué plus haut (montant absent de la grille)
    if (!PRIX_PAR_OFFRE[offre].has(valeur)) bloc('prix-offre', 'coherence', `« ${r[1]} » est cité avec ${r[2]} € : les prix de cette offre sont ${[...PRIX_PAR_OFFRE[offre]].join(' €, ')} € (base, puis machine en plus). Un montant d'une autre offre ou du service à 29 € ne peut pas lui être attribué.`)
  }

  // ── COHÉRENCE : ce qu'on prétend
  if (SUPERLATIFS.test(texte)) bloc('superlatifs', 'coherence', 'Superlatif ou garantie non démontrable (« n°1 », « meilleur », « garanti », « 100 % »…).')
  if (PREUVE_SOCIALE.test(texte)) bloc('preuve-sociale', 'coherence', 'Preuve sociale : KALEA n\'a pas encore de client réel à citer (clients, témoignages, « ils nous font confiance »).')
  if (PROMESSE_ABSOLUE.test(texte)) bloc('promesse-absolue', 'coherence', 'Promesse absolue (« plus jamais de… », « zéro panne »…) : aucun outil ne peut la tenir. Dites plutôt « Évitez les pannes faute d\'un suivi efficace ».')
  else if (AVANT_PANNE.test(texte)) avert('avant-panne', 'coherence', 'Promesse d\'agir « avant la panne » : ce qu\'on peut prouver, ce sont des rappels d\'échéance. Préférez « Évitez les pannes faute d\'un suivi efficace ».')
  if (CONCURRENTS.test(texte)) avert('concurrents', 'coherence', 'Un concurrent est nommé : on ne compare pas nominativement sans fait sourcé.')
  if (/essai gratuit|free trial/i.test(texte)) avert('essai', 'coherence', '« Essai gratuit » : il n\'y a pas d\'essai limité dans le temps mais une offre Gratuite durable pour 2 machines. Dites plutôt « gratuit pour 2 machines ».')
  if (/\bgratuit(?:e|es|s)?\b|\bfree\b/i.test(texte) && !/\b2 machines?\b|\btwo machines\b|\b2 engins\b/i.test(texte)) avert('gratuit', 'coherence', '« Gratuit » est cité sans préciser « pour 2 machines » : la gratuité est limitée à 2 machines.')

  // ── COHÉRENCE : les faits cités
  const cites = e.faits_cites || []
  const parId = new Map(FAITS.map((f) => [f.id, f]))
  for (const id of cites) {
    const f = parId.get(id)
    if (!f) bloc('fait-inconnu', 'coherence', `Le fait « ${id} » n'existe pas dans la base de faits vérifiés.`)
    else if (f.statut !== 'verifie') bloc('fait-non-verifie', 'coherence', `Le fait « ${id} » n'est pas encore vérifié : ${f.preuve}`)
  }
  for (const f of FAITS) {
    if (f.statut !== 'verifie' || f.sujet !== 'fonction') continue
    if (f.mots.some((m) => norm.includes(sansAccents(m))) && !cites.includes(f.id)) {
      avert('fait-non-cite', 'coherence', `Le texte évoque « ${f.fr.replace(/\.$/, '')} » sans citer le fait « ${f.id} » : confirmez que la formulation est exacte.`)
    }
  }
  // fonction réservée à une offre : le texte doit la rattacher à l'offre
  for (const f of FAITS) {
    if (!f.offre_min || f.statut !== 'verifie') continue
    if (f.mots.some((m) => norm.includes(sansAccents(m)))) {
      const nomOffre = f.offre_min === 'enterprise' ? 'enterprise' : 'business'
      if (!norm.includes(nomOffre) && !(f.offre_min === 'business' && norm.includes('enterprise'))) {
        avert('offre-requise', 'coherence', `« ${f.id} » n'est disponible qu'à partir de l'offre ${f.offre_min === 'enterprise' ? 'Enterprise' : 'Business'} : le texte ne le précise pas.`)
      }
    }
  }

  // ── PERTINENCE
  if (!MOTS_CIBLE.test(texte)) avert('hors-cible', 'pertinence', 'Aucun mot ne renvoie à la cible (parc, engins, machines, flotte, entretien…) : le message parle-t-il à un responsable de parc ?')
  else ok('cible', 'pertinence', 'Le message parle de la cible (parc, machines, entretien).')
  const max = LONGUEUR_MAX[e.canal]
  if (max && texte.length > max) avert('longueur', 'pertinence', `Texte trop long pour ce canal : ${texte.length} caractères (lisibilité conseillée : ${max}). À raccourcir de ${excedent(max, texte)}.`)
  const liens = [...texte.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0].replace(/[.,;]+$/, ''))
  const liensKalea = liens.filter((l) => /^https?:\/\/(www\.)?kalea\.pro/i.test(l))
  const sansUtm = liensKalea.filter((l) => !/[?&]utm_source=/.test(l) || !/[?&]utm_medium=/.test(l))
  if (sansUtm.length) bloc('utm', 'pertinence', 'Un lien vers kalea.pro n\'a pas de utm_source et utm_medium : la mesure ne saurait pas d\'où viennent les inscrits.')
  else if (liensKalea.length) ok('utm', 'pertinence', 'Les liens vers kalea.pro portent leur origine (utm).')
  else if (e.canal !== 'note' && e.canal !== 'video_script') avert('appel-action', 'pertinence', 'Aucun lien vers kalea.pro : où la personne doit-elle aller ensuite ?')
  const langueDetectee = detecterLangue(texte)
  if (langueDetectee && langueDetectee !== e.langue) avert('langue', 'coherence', `Le texte semble écrit en ${langueDetectee === 'fr' ? 'français' : 'anglais'} alors que la publication est prévue en ${e.langue === 'fr' ? 'français' : 'anglais'}.`)

  // ── DROIT : la prospection par e-mail (les liens sont écartés : « utm_source » ou « kalea.pro » ne prouvent rien)
  if (e.canal === 'email_froid') {
    const corps = texte.replace(/https?:\/\/\S+/g, ' ')
    if (!/(ne plus recevoir|ne souhaitez plus|d[ée]sinscri|opposer|r[ée]pondez? (?:stop|« ?stop|"stop)|unsubscribe|opt[- ]out|do not wish to receive|no longer wish)/i.test(corps)) bloc('desinscription', 'droit', 'Prospection par e-mail : la possibilité de refuser de nouveaux messages doit figurer clairement dans le texte.')
    else ok('desinscription', 'droit', 'La possibilité de se désinscrire est indiquée.')
    if (!/(votre adresse|your (?:email|address)|trouv[ée]e|provient|source|annuaire|found your|public)/i.test(corps)) bloc('origine-donnee', 'droit', 'Prospection par e-mail : indiquez d\'où vient l\'adresse (annuaire professionnel, fournisseur de données…), comme le promet la politique de confidentialité.')
    else ok('origine-donnee', 'droit', 'L\'origine de l\'adresse est indiquée.')
    if (!/kalea/i.test(corps)) bloc('identite', 'droit', 'L\'expéditeur doit être identifié (KALEA).')
    if (/^\s*(re|tr|fwd)\s?:/i.test(texte)) bloc('faux-reponse', 'droit', 'L\'objet ne doit pas imiter une réponse (« Re : »).')
  }

  const bloquants = c.filter((x) => x.niveau === 'bloquant').length
  const avertissements = c.filter((x) => x.niveau === 'avertissement').length
  return { publiable: bloquants === 0 && !!texte.trim(), bloquants, avertissements, controles: c }
}

// Détection grossière FR / EN par mots courants (suffisante pour repérer un texte collé dans la mauvaise langue).
function detecterLangue(texte        )                {
  const t = ' ' + sansAccents(texte).replace(/[^a-z\s']/g, ' ') + ' '
  const fr = (t.match(/\s(le|la|les|des|de|en|une|un|et|pour|vos|votre|avec|sur|est|dans|que|qui|du|au|aux|ne|pas|plus)\s/g) || []).length
  const en = (t.match(/\s(the|and|for|your|with|you|is|are|in|that|of|to|a|an|not|from)\s/g) || []).length
  if (fr + en < 5) return null
  if (fr > en * 1.5) return 'fr'
  if (en > fr * 1.5) return 'en'
  return null
}

// Mise en forme de la fiche pour l'humain (console ou conversation).
function fiche(f       )         {
  const icone = { ok: '✔', avertissement: '!', bloquant: '✘' }         
  const lignes = f.controles.map((x) => `${icone[x.niveau]} [${x.axe}] ${x.message}`)
  return [f.publiable ? (f.avertissements ? 'PUBLIABLE sous réserve de relecture' : 'PUBLIABLE') : 'BLOQUÉ — à corriger', ...lignes].join('\n')
}

window.marketingControle = { FAITS, OFFRES, MONTANTS_AUTORISES, montantsDuTexte, controlerPublication, detecterLangue, fiche };
}());
