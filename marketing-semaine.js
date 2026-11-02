/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/marketing-semaine-contenu.ts — NE PAS MODIFIER À LA MAIN.
   La semaine marketing en clair (points, alertes, à faire), utilisée par l'onglet Semaine de la console : les mêmes mots que dans le récapitulatif envoyé par e-mail. */
(function () {
'use strict';
// KALEA — MARKETING, MODULE 6 : LA SEMAINE EN CLAIR (logique pure) — transforme les chiffres de marketing_semaine() en trois choses lisibles :
//   · POINTS   : ce qui s'est passé (visites, inscrits, contacts, contenus, séquence), comparé à la semaine d'avant ;
//   · ALERTES  : ce qui ne va pas (le plus important : un rapport qui ne dit que du bien ne sert à rien) ;
//   · À FAIRE  : les relances dues, les contenus à valider, ce qui est prévu cette semaine.
// Utilisé deux fois, avec les MÊMES mots : dans le récapitulatif hebdomadaire envoyé par e-mail (recap-hebdo) et dans l'onglet « Semaine » de la console.
// DONNÉES PERSONNELLES : aucune adresse e-mail ; pour les relances, seulement le nom, l'entreprise et l'action prévue. Écrit pour le propriétaire : en français.

                          
                                                    
                                                                                                                                                                                     
                                                                                                                                    
                                                                                                                           
                                                                                                                                                                                      
                                                                                    
                                                                                                           
                                                                                                               
                                                                    
 
                                                                                   

const CANAUX                         = { linkedin: 'LinkedIn', facebook: 'Facebook', email_froid: 'e-mail de prospection', email_inscrits: 'e-mail aux inscrits', page_site: 'page du site', video_script: 'script de vidéo', note: 'note' }
const STATUTS                         = { brouillon: 'brouillon', a_relire: 'à relire', valide: 'validé', publie: 'publié', abandonne: 'abandonné' }

const jourCourt = (iso        ) => { const [, m, j] = String(iso).slice(0, 10).split('-'); return m && j ? `${j}/${m}` : String(iso) }
function variation(actuel        , precedent        )         {
  if (actuel === precedent) return 'comme la semaine précédente'
  if (precedent === 0) return `contre 0 la semaine précédente`
  const d = actuel - precedent
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} par rapport à la semaine précédente (${precedent})`
}
const pluriel = (n        , un        , plusieurs        ) => `${n} ${n > 1 ? plusieurs : un}`

function synthese(d         )           {
  const points           = []
  const alertes           = []
  const afaire           = []
  const v = d.visites, i = d.inscrits, k = d.contacts, c = d.contenus, s = d.sequences

  points.push(`Visites du site : ${pluriel(v.pages, 'page vue', 'pages vues')}, ${pluriel(v.visiteurs_jours, 'visiteur par jour', 'visiteurs par jour')} (${variation(v.pages, v.precedent.pages)}).`)
  if (v.sources.length) points.push(`D'où viennent les visites : ${v.sources.map((x) => `${x.source} ${x.visites}`).join(', ')}.`)
  points.push(`Inscrits : ${i.total} (${variation(i.total, i.precedent)})${i.total ? `, dont ${i.avec_machine} avec une machine et ${i.payants} avec une offre payante` : ''}.`)
  if (i.par_source.length) points.push(`Origine des inscrits : ${i.par_source.map((x) => `${x.source} ${x.n}`).join(', ')}.`)
  points.push(`Contacts : ${k.contactes} sollicité(s), ${k.reponses} réponse(s), ${k.ajoutes} ajouté(s) au fichier${k.desinscrits ? `, ${k.desinscrits} désinscrit(s)` : ''}.`)
  points.push(`Contenus : ${pluriel(c.publies, 'publié', 'publiés')} cette semaine.`)
  if (s.actif || s.envoyes || s.desabonnes) points.push(`Séquence de démarrage : ${s.actif ? 'allumée' : 'éteinte'}, ${pluriel(s.envoyes, 'message envoyé', 'messages envoyés')}${s.desabonnes ? `, ${s.desabonnes} désabonné(s)` : ''}.`)

  // Ce qui ne va pas
  if (v.pages === 0) alertes.push(v.precedent.pages === 0 ? 'Aucune visite enregistrée depuis deux semaines : la mesure est-elle bien en ligne, et a-t-on publié quelque chose ?' : 'Aucune visite enregistrée cette semaine (la semaine précédente en avait).')
  else if (v.pages < v.precedent.pages / 2) alertes.push(`Les visites ont plus que diminué de moitié (${v.pages} contre ${v.precedent.pages}).`)
  if (c.publies === 0) alertes.push('Aucune publication cette semaine (le plan en prévoit 2 à 3 par semaine sur LinkedIn).')
  if (c.en_retard > 0) alertes.push(`${pluriel(c.en_retard, 'contenu en retard', 'contenus en retard')} : ${c.retards.map((x) => `« ${x.titre} » (prévu le ${jourCourt(x.prevu_le)})`).join(', ')}.`)
  if (k.a_relancer > 0) alertes.push(`${pluriel(k.a_relancer, 'relance à faire ou en retard', 'relances à faire ou en retard')}.`)
  if (k.contactes > 0 && k.reponses === 0) alertes.push('Des personnes ont été sollicitées mais aucune n\'a répondu cette semaine : relire le message ou le ciblage.')
  if (i.total > 0 && i.avec_machine === 0) alertes.push('Aucun inscrit de la semaine n\'a encore ajouté de machine : c\'est l\'étape à travailler.')
  if (i.total > 0 && !s.actif) alertes.push('Des sociétés se sont inscrites mais la séquence de démarrage est éteinte.')
  if (k.total > 0 && k.qualite && k.qualite.non > 0) alertes.push(`${pluriel(k.qualite.non, 'contact pas encore qualifié', 'contacts pas encore qualifiés')} (bouton « Qualifier » dans l'onglet Contacts).`)

  // À faire
  for (const r of k.a_relancer_liste) afaire.push(`Relance ${jourCourt(r.le)} : ${r.nom}${r.entreprise ? ` (${r.entreprise})` : ''}${r.action ? ` — ${r.action}` : ''}.`)
  if (k.a_relancer > k.a_relancer_liste.length) afaire.push(`… et ${k.a_relancer - k.a_relancer_liste.length} autre(s) relance(s).`)
  if (c.a_relire > 0) afaire.push(`${pluriel(c.a_relire, 'contenu à relire ou à valider', 'contenus à relire ou à valider')}, ${c.valides ? `${c.valides} validé(s) à publier` : 'aucun validé en attente de publication'}.`)
  for (const x of c.prochains) afaire.push(`${jourCourt(x.prevu_le)} : ${x.titre} (${CANAUX[x.canal] || x.canal}, ${String(x.langue).toUpperCase()}, ${STATUTS[x.statut] || x.statut}).`)
  return { points, alertes, afaire }
}

function titreSemaine(d         )         { return `Marketing — du ${jourCourt(d.periode.du)} au ${jourCourt(d.periode.au)}` }

// Version texte (pour le récapitulatif par e-mail) : l'essentiel d'abord, ce qui ne va pas ensuite, puis ce qu'il y a à faire.
function lignesTexte(d         )           {
  const s = synthese(d)
  const l = [titreSemaine(d), '']
  l.push('Ce qui ne va pas :')
  if (s.alertes.length) for (const a of s.alertes) l.push(`  ! ${a}`); else l.push('  Rien à signaler.')
  l.push('', 'La semaine :'); for (const p of s.points) l.push(`  · ${p}`)
  l.push('', 'À faire :')
  if (s.afaire.length) for (const a of s.afaire) l.push(`  · ${a}`); else l.push('  Rien de prévu.')
  return l
}

const echapper = (v         ) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// Version HTML (même habillage que le récapitulatif existant : titres h3, listes simples).
function blocHtml(d         )         {
  const s = synthese(d)
  const liste = (titre        , lignes          , vide        , couleur = '#0E1333') => `
    <h3 style="margin:22px 0 6px;font-size:15px;color:#0E1333;">${echapper(titre)}</h3>
    ${lignes.length ? `<ul style="margin:0;padding-left:18px;color:${couleur};font-size:14px;line-height:1.6;">${lignes.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>` : `<p style="margin:0;color:#5A6070;font-size:14px;">${echapper(vide)}</p>`}`
  return `<div style="margin-top:34px;padding-top:6px;border-top:2px solid #0E1333;">
    <h2 style="margin:18px 0 0;font-size:19px;color:#0E1333;">${echapper(titreSemaine(d))}</h2>
    ${liste('Ce qui ne va pas', s.alertes, 'Rien à signaler.', '#9A2C2C')}
    ${liste('La semaine', s.points, '')}
    ${liste('À faire', s.afaire, 'Rien de prévu.')}
  </div>`
}

window.marketingSemaine = { synthese, lignesTexte, blocHtml, titreSemaine, variation, jourCourt };
}());
