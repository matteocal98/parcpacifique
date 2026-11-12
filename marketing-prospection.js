/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/marketing-prospection-contenu.ts — NE PAS MODIFIER À LA MAIN.
   Les 6 e-mails de prospection à froid (3 étapes × FR/EN), utilisés pour l'aperçu dans l'onglet Envoi de la page Marketing de la console. */
(function () {
'use strict';
// Marketing — moteur d'envoi : les 6 e-mails de prospection à froid (3 étapes × FR/EN) et leur fabrication. Aucun réseau, aucune dépendance.
//
// SOURCE UNIQUE : ce fichier remplace la copie des textes de communication/prospection-froid-2026-11.mjs pour tout ce qui part réellement.
// Chaque texte est rendu avec les VRAIES valeurs du contact puis passé au contrôleur de pertinence et de cohérence (canal « email_froid »)
// AU MOMENT DE L'ENVOI : s'il n'est plus publiable (un fait repassé « à vérifier », par exemple), il ne part pas.
//
// Variables (mêmes noms que dans la préparation du 2026-11-12) : {{first_name}} {{company}} {{address_source}} {{segment}}.
//   {{address_source}} = ORIGINE RÉELLE de l'adresse (colonne source_donnee du contact) : obligation de la politique de confidentialité (§10).

                                
                                      

const SEQUENCE = 'froid-v1'
const ETAPES          = ['e1', 'e2', 'e3']

const SIGNATURE                         = {
  fr: 'Matthieu COURTOIS, KALEA, édité par SAMPORIA SAS (RCS Nouméa 1 684 349)',
  en: 'Matthieu COURTOIS, KALEA, published by SAMPORIA SAS (Nouméa trade register 1 684 349)',
}

const lien = (langue        , etape       ) =>
  `https://kalea.pro/${langue === 'en' ? 'en/' : ''}?utm_source=prospection&utm_medium=email&utm_campaign=froid-${langue}-${etape}&utm_content={{segment}}`

                                                                         

const MODELES                                        = {
  e1: {
    fr: {
      objet: 'Entretien du parc de {{company}} : une question',
      faits: ['message-cle', 'plans-depuis-manuels', 'suivi-compteur', 'rappels', 'offre-gratuit'],
      texte: `Bonjour {{first_name}},

Je suis Matthieu COURTOIS, de KALEA, un logiciel de suivi d'entretien pour parcs d'engins et de véhicules. J'ai trouvé votre adresse professionnelle dans {{address_source}}.

Un entretien oublié peut suffire à immobiliser une machine. KALEA transforme les manuels constructeur en plans d'entretien, suit chaque machine aux heures, au kilomètre ou au calendrier, et envoie des rappels d'échéance par notification.

Gratuit pour 2 machines, sans limite de durée : ${lien('fr', 'e1')}

Êtes-vous la bonne personne pour ce sujet ? Sinon, à qui me conseillez-vous d'écrire ?

${SIGNATURE.fr}
Pour ne plus recevoir de messages de ma part, répondez simplement STOP.`,
    },
    en: {
      objet: "Maintenance of {{company}}'s fleet: a question",
      faits: ['message-cle', 'plans-depuis-manuels', 'suivi-compteur', 'rappels', 'offre-gratuit'],
      texte: `Hello {{first_name}},

I'm Matthieu COURTOIS from KALEA, maintenance-tracking software for fleets of machines and vehicles. I found your email address in {{address_source}}.

One missed service can be enough to take a machine off the job. KALEA turns manufacturer manuals into maintenance plans, tracks each machine by hours, kilometres or calendar, and sends due-date reminders by notification.

Free for 2 machines, with no time limit: ${lien('en', 'e1')}

Are you the right person for this? If not, who would you suggest I write to?

${SIGNATURE.en}
If you do not wish to receive further messages from me, just reply STOP.`,
    },
  },
  e2: {
    fr: {
      objet: "Un plan d'entretien établi pour vous",
      faits: ['service-plan-29', 'offre-gratuit'],
      texte: `Bonjour {{first_name}},

Je relance une seule fois mon message précédent (j'ai trouvé votre adresse professionnelle dans {{address_source}}).

Pour démarrer sans effort : envoyez la photo de la plaque constructeur d'une machine, KALEA recherche et configure le plan d'entretien complet dans l'application, pour 29 € l'acte. Sinon, 2 machines se suivent gratuitement : ${lien('fr', 'e2')}

Si le sujet ne concerne pas {{company}}, ou pour ne plus recevoir de messages de ma part, répondez STOP : je ne vous écrirai plus.

${SIGNATURE.fr}`,
    },
    en: {
      objet: 'A maintenance plan set up for you',
      faits: ['service-plan-29', 'offre-gratuit'],
      texte: `Hello {{first_name}},

I'm following up just once on my previous message (I found your email address in {{address_source}}).

To get started with no effort: send a photo of a machine's manufacturer plate, and KALEA researches and configures the full maintenance plan in the application, for €29 per plan. Otherwise, 2 machines are free: ${lien('en', 'e2')}

If this does not concern {{company}}, or if you do not wish to receive further messages from me, just reply STOP and I will not write again.

${SIGNATURE.en}`,
    },
  },
  e3: {
    fr: {
      objet: 'Dernier message',
      faits: ['offre-gratuit'],
      texte: `Bonjour {{first_name}},

Dernier message de ma part. Si le suivi d'entretien des machines de {{company}} est un sujet, KALEA est gratuit pour 2 machines, sans limite de durée : ${lien('fr', 'e3')}

Sinon, bonne continuation. Pour ne plus recevoir de messages de ma part, répondez simplement STOP (adresse trouvée dans {{address_source}}).

${SIGNATURE.fr}`,
    },
    en: {
      objet: 'Last message',
      faits: ['offre-gratuit'],
      texte: `Hello {{first_name}},

This is my last message. If maintenance tracking for {{company}}'s machines is a topic, KALEA is free for 2 machines, with no time limit: ${lien('en', 'e3')}

Otherwise, thank you for your time. If you do not wish to receive further messages from me, just reply STOP (I found your email address in {{address_source}}).

${SIGNATURE.en}`,
    },
  },
}

                                 
             
                    
                 
                         
 

const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'van', 'von', 'der', 'den', 'da', 'di', 'del', 'al', 'el'])

/** Met la première lettre de chaque partie (séparée par espace, tiret ou apostrophe) en capitale : « jean-pierre » → « Jean-Pierre ». */
function capitaliser(mot        )         {
  return mot.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (_m, sep        , c        ) => sep + c.toUpperCase())
}

/**
 * Le prénom à partir du champ « nom » d'un contact (« Jean Dupont », « DUPONT Jean », « Marie-Claire de la Tour »).
 * Renvoie '' quand on ne peut pas le dire avec certitude (nom d'un seul mot, initiale seule, texte douteux) : le message dit alors « Bonjour, ».
 */
function prenomDe(nom                           )         {
  const mots = String(nom ?? '').replace(/[(),;:]/g, ' ').split(/\s+/).filter(Boolean)
  if (mots.length < 2) return ''
  const estMajuscules = (m        ) => (m.match(/\p{L}/gu) ?? []).length >= 2 && m === m.toUpperCase()   // « DUPONT » oui ; une initiale (« J. ») non
  let prenom = mots[0]
  if (estMajuscules(mots[0])) {
    const autre = mots.slice(1).find((m) => !estMajuscules(m) && !PARTICULES.has(m.toLowerCase()))
    if (autre) prenom = autre
  }
  const propre = prenom.replace(/\.$/, '')
  if (propre.length < 2 || !/^[\p{L}][\p{L}'’-]*$/u.test(propre)) return ''
  return capitaliser(propre)
}

/** Le segment va dans une adresse web (utm_content) : lettres minuscules, chiffres, tiret ; sinon « autre ». */
function segmentSur(segment                           )         {
  const s = String(segment ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  return s || 'autre'
}

/** Remplace les variables. Refuse tout message où une variable manque ou reste vide (un message à moitié rempli ne part jamais). */
function rendre(modele        , c                )         {
  const entreprise = String(c.entreprise ?? '').replace(/\s+/g, ' ').trim()
  const origine = String(c.origine ?? '').replace(/\s+/g, ' ').trim()
  if (!entreprise) throw new Error('variable manquante : entreprise')
  if (!origine) throw new Error("variable manquante : origine de l'adresse")
  const prenom = prenomDe(c.nom)
  let t = modele
  if (!prenom) t = t.replace(/(Bonjour|Hello) \{\{first_name\}\},/g, '$1,')
  t = t.replace(/\{\{first_name\}\}/g, prenom)
    .replace(/\{\{company\}\}/g, entreprise)
    .replace(/\{\{address_source\}\}/g, origine)
    .replace(/\{\{segment\}\}/g, segmentSur(c.segment))
  if (/\{\{|\}\}/.test(t)) throw new Error('variable inconnue ou non remplacée')
  return t
}

                                                                                   

function construireMessage(etape       , langue        , c                )                   {
  const m = MODELES[etape]?.[langue]
  if (!m) throw new Error(`étape ou langue inconnue : ${etape}/${langue}`)
  const objet = rendre(m.objet, c).replace(/\s+/g, ' ').trim()
  if (objet.length > 200) throw new Error("objet trop long")
  return { objet, texte: rendre(m.texte, c), faits: m.faits }
}

/** Contact d'exemple pour la console (aperçu) et pour les tests. */
const CONTACT_EXEMPLE                                 = {
  fr: { nom: 'Claire Martin', entreprise: 'Entreprise Exemple', origine: "l'annuaire public des entreprises de Nouvelle-Calédonie (RIDET)", segment: 'btp' },
  en: { nom: 'Claire Martin', entreprise: 'Example Company', origine: "your company's website", segment: 'btp' },
}

                                  
              
                
                                             
                   
                                    
                                              
 

                            
              
            
                 
              
                   
                                 
                 
 

/** Nom d'affichage sûr pour un en-tête : pas de guillemets ni de retours à la ligne. */
const nomAffichable = (n        ) => n.replace(/["\r\n<>]/g, '').trim()

/**
 * Le message complet, prêt pour l'envoi : TEXTE SIMPLE uniquement (ni image, ni pièce jointe, ni pixel de suivi), en-tête List-Unsubscribe (mailto : STOP),
 * fil de discussion (In-Reply-To / References) pour les étapes 2 et 3.
 */
function construireEnvoi(e                 )            {
  const m = construireMessage(e.etape, e.langue, e.contact)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.contact.email)) throw new Error('adresse du destinataire invalide')
  if (!/^<[A-Za-z0-9._-]+@[A-Za-z0-9.-]+>$/.test(e.messageId)) throw new Error('Message-ID invalide')
  const headers                         = {
    'List-Unsubscribe': `<mailto:${e.expediteur.adresse}?subject=STOP>`,
  }
  if (e.precedentMessageId) {
    if (!/^<[A-Za-z0-9._-]+@[A-Za-z0-9.-]+>$/.test(e.precedentMessageId)) throw new Error('Message-ID précédent invalide')
    headers['In-Reply-To'] = e.precedentMessageId
    headers['References'] = e.precedentMessageId
  }
  return {
    from: `"${nomAffichable(e.expediteur.nom)}" <${e.expediteur.adresse}>`,
    to: e.contact.email,
    subject: m.objet,
    text: m.texte,
    messageId: e.messageId,
    headers,
    faits: m.faits,
  }
}

/** Un Message-ID sur le domaine d'envoi : <identifiant-aléatoire@kaleapro.com>. */
function genererMessageId(adresseExpediteur        , uuid        )         {
  const domaine = adresseExpediteur.split('@')[1] ?? ''
  if (!/^[A-Za-z0-9.-]+$/.test(domaine) || !/^[A-Za-z0-9-]{8,64}$/.test(uuid)) throw new Error('Message-ID impossible à fabriquer')
  return `<${uuid}@${domaine}>`
}

window.marketingProspection = { ETAPES, MODELES, SIGNATURE, CONTACT_EXEMPLE, construireMessage, prenomDe, segmentSur };
}());
