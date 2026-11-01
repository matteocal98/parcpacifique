/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/marketing-tri.ts — NE PAS MODIFIER À LA MAIN.
   Tri des contacts de prospection par règles (taille, fonction, secteur), utilisé par la page Marketing de la console. */
(function () {
'use strict';
// KALEA — MARKETING : TRI DES CONTACTS DE PROSPECTION PAR RÈGLES (logique pure, aucun réseau, aucune IA, aucune donnée envoyée à un tiers).
//
// POURQUOI DES RÈGLES ET PAS UNE IA : les critères qui décident si un contact vaut un message sont nets (taille de l'entreprise, fonction, secteur) ;
// des règles écrites donnent le même résultat à chaque fois, s'expliquent contact par contact (« raisons »), ne coûtent rien et n'exposent aucune
// donnée personnelle. Elles sont tirées du tri manuel des 75 contacts de l'essai Apollo du 2026-11-01 (environ un contact sur quatre seulement était
// pertinent : cabinet de gestion de flottes, grands groupes, « conducteurs de travaux », constructeurs, associations).
//
// CIBLE (plan marketing) : entreprises de 5 à 250 salariés qui ont des engins ou des véhicules ; le décideur est le gérant, le dirigeant ou le
// responsable de parc / de matériel / d'atelier / de maintenance.
//
// NIVEAUX : A = à contacter en priorité · B = bon contact · C = à garder en réserve · X = ne pas contacter (hors cible, concurrent, constructeur…).
// Ce tri ne dit pas « publier » : la décision de contacter reste humaine, et tout message passe ensuite par le contrôleur de pertinence et de cohérence.

                                          
                                                                                                                                                                
                                                                               

const sansAccents = (s        ) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ── fonction
const DECIDEUR = /\b(gerant|gerante|dirigeant|dirigeante|president|presidente|directeur general|directrice generale|dg|proprietaire|patron|patronne|fondateur|fondatrice|chef d'entreprise|ceo|owner|founder|managing director|general manager|co-?founder)\b/
const PARC = /(responsable|chef|manager|gestionnaire|directeur|directrice|head|regulateur|superviseur|coordinateur|coordinatrice)[^,;]{0,30}(parc|materiel|flotte|fleet|equipment|atelier|workshop|maintenance|engins|vehicule)|\b(parc|materiel|flotte|atelier|maintenance|fleet)\b[^,;]{0,25}(responsable|manager|chef|gestionnaire)|^maintenance manager$|^fleet manager$|^responsable (de )?parc/
const FONCTION_ELOIGNEE = /(conducteur de travaux|conductrice de travaux|chef de chantier|chargee? d'affaires|assistante?|stagiaire|apprenti|comptable|ressources humaines|\brh\b|commercial|marketing|juridique|qualite|\bhse\b|securite|acheteur|achats|secretaire|metreur|ingenieur etudes|technicien|operateur|conducteur d'engins)/

// ── secteur et entreprise (texte de l'entreprise + secteur d'activité + mots-clés)
const SECTEUR_CIBLE = /(location d'engins|location de materiel|equipment rental|rental|btp|batiment|travaux publics|terrassement|construction|genie civil|civil engineering|vrd|levage|grue|manutention|transport|trucking|routier|logistique|logistics|agricol|agriculture|forestier|forestry|carriere|quarry|mining|mines?|dechets|waste|nettoyage industriel|demenagement|groupes? electrogenes?)/
const SECTEUR_HORS_CIBLE = /(consulting|conseil|cabinet|association|non-?profit|nonprofit|education|sport|retail|commerce de detail|banking|banque|insurance|assurance|software|logiciel|saas|defense|military|militaire|staffing|recrutement|recruitment|government|administration publique|hotel|restauration|tourisme|leisure|real estate agency|agence immobiliere)/
const CONSTRUCTEUR = /(manufactur|fabricant|constructeur|machinery manufacturing)|\b(john deere|caterpillar|komatsu|volvo ce|volvo construction|kubota|jcb|liebherr|hitachi construction|manitou|hyundai construction|new holland|claas|doosan|terex|sany|xcmg|bobcat|case ce|case construction)\b/
const CONCESSIONNAIRE = /(concessionnaire|dealer|distributeur|distribution d'engins|revendeur)/
const CONCURRENT = /(gestion de flotte|fleet management|fleet consulting|fleet gestion|gmao|cmms|telematique|telematics|suivi de flotte)/

function evaluerContact(c               )           {
  const raisons           = []
  let points = 0
  let plafond                = null
  let exclu = false
  const ajoute = (n        , texte        ) => { points += n; raisons.push(`${n > 0 ? '+' : n < 0 ? '−' : '='}${Math.abs(n)} ${texte}`) }

  // taille
  const eff = typeof c.effectif === 'number' && Number.isFinite(c.effectif) ? c.effectif : null
  if (eff === null) raisons.push('= taille inconnue : à compléter')
  else if (eff < 5) ajoute(-1, `${eff} salarié(s) : très petite structure (l'offre gratuite peut suffire)`)
  else if (eff <= 250) ajoute(3, `${eff} salariés : taille cible (5 à 250)`)
  else if (eff <= 1000) ajoute(0, `${eff} salariés : entreprise moyenne-grande`)
  else if (eff <= 5000) ajoute(-2, `${eff} salariés : grande entreprise, souvent déjà outillée`)
  else { ajoute(-4, `${eff} salariés : grand groupe, outils déjà en place et cycle d'achat long`); plafond = 'C' }

  // fonction
  const fonction = sansAccents(String(c.fonction || '')).replace(/\s+/g, ' ').trim()
  if (!fonction) raisons.push('= fonction inconnue')
  else if (DECIDEUR.test(fonction)) ajoute(3, 'décideur (gérant, dirigeant, propriétaire…)')
  else if (PARC.test(fonction)) ajoute(3, 'responsable de parc, de matériel ou de maintenance')
  else if (FONCTION_ELOIGNEE.test(fonction)) ajoute(-3, 'fonction éloignée du choix d\'un outil de parc (chantier, achats, support…)')
  else raisons.push('= fonction sans lien clair avec le parc')

  // secteur et entreprise
  const texte = sansAccents(`${c.secteur || ''} ${c.entreprise || ''}`)
  if (CONCURRENT.test(texte)) { ajoute(-5, 'gestion de flotte, GMAO ou télématique : concurrent ou prestataire, pas client'); exclu = true }
  if (CONSTRUCTEUR.test(texte)) { ajoute(-3, 'constructeur de machines : partenaire possible, pas client'); plafond = plafond || 'C' }
  else if (CONCESSIONNAIRE.test(texte)) ajoute(-1, 'concessionnaire ou distributeur : partenaire possible plutôt que client')
  if (SECTEUR_HORS_CIBLE.test(texte) && !SECTEUR_CIBLE.test(texte)) ajoute(-3, 'secteur hors cible (conseil, association, commerce, services…)')
  else if (SECTEUR_CIBLE.test(texte)) ajoute(2, 'secteur cible (engins, travaux, transport, agriculture, levage…)')
  else if (texte.trim()) raisons.push('= secteur sans lien clair avec les parcs d\'engins')

  let niveau         = points >= 7 ? 'A' : points >= 4 ? 'B' : points >= 1 ? 'C' : 'X'
  if (exclu) niveau = 'X'
  if (plafond && (niveau === 'A' || niveau === 'B') && plafond === 'C') niveau = 'C'
  return { niveau, points, raisons }
}

// Un seul contact par entreprise : le mieux classé (puis le plus de points, puis l'ordre d'arrivée). Renvoie les identifiants à garder.
function meilleurParEntreprise                                                                                    (contacts     )              {
  const parEntreprise = new Map           ()
  const sansEntreprise      = []                      // sans entreprise renseignée : on ne regroupe pas
  const cle = (c   ) => sansAccents(String(c.entreprise || '')).replace(/[^a-z0-9]+/g, ' ').trim()
  for (const c of contacts) {
    const k = cle(c)
    if (!k) { sansEntreprise.push(c); continue }
    const actuel = parEntreprise.get(k)
    if (!actuel || (c.score_points ?? -99) > (actuel.score_points ?? -99)) parEntreprise.set(k, c)
  }
  return new Set([...parEntreprise.values(), ...sansEntreprise].map((c) => c.id))
}

const LIBELLES_NIVEAU                         = { A: 'A — priorité', B: 'B — bon contact', C: 'C — en réserve', X: 'X — ne pas contacter' }

window.marketingTri = { evaluerContact, meilleurParEntreprise, LIBELLES_NIVEAU };
}());
