/* GÉNÉRÉ par outils/generer-controle-marketing.mjs à partir de kalea-serveur/supabase/functions/_shared/marketing-sequences-contenu.ts — NE PAS MODIFIER À LA MAIN.
   Séquence de démarrage des nouvelles sociétés (étapes, conditions, textes FR/EN), utilisée pour l'aperçu dans la page Marketing de la console. */
(function () {
'use strict';
// KALEA — MARKETING, MODULE 5 : SÉQUENCE DE DÉMARRAGE pour les sociétés qui viennent de s'inscrire (logique pure : étapes, conditions, textes FR/EN).
//
// PRINCIPE : accompagner, pas harceler. Trois messages au plus, uniquement à la société qui n'a PAS encore franchi l'étape concernée (la séquence s'arrête
// d'elle-même dès que la personne avance), jamais plus d'un message tous les 2 jours, jamais à une société du personnel, jamais après un désabonnement.
// Chaque texte est passé au contrôleur de pertinence et de cohérence (marketing-controle.ts) par les tests : faits vérifiés, aucune promesse, aucun chiffre inventé.
//
//   J+1  « première machine »  — si la société n'a encore AUCUNE machine
//   J+3  « premier plan »      — si elle a une machine mais AUCUN plan d'entretien
//   J+14 « un mot »            — si elle n'a toujours AUCUN plan d'entretien : on demande ce qui a manqué (la réponse arrive directement à l'équipe)
//
// Un message n'est envoyé que dans les 4 jours qui suivent son échéance (rien ne part « en retard »). L'interrupteur général est éteint par défaut (base) et la
// séquence ne concerne que les sociétés créées APRÈS son allumage : jamais les clients existants.

                                
                                                                    

                              
                                                                                     
                     
                  
                                                           
                                           
                     
                               
                                                                                                     
 
                                                                                                             

const FENETRE_JOURS = 4            // un message qui n'est pas parti dans les 4 jours suivant son échéance est abandonné
const ESPACEMENT_JOURS = 2         // jamais deux messages à moins de 2 jours d'intervalle

const ETAPES          = [
  { id: 'premiere-machine', jour: 1, condition: (e) => e.nb_machines === 0, faits: ['plans-depuis-manuels'] },
  { id: 'premier-plan', jour: 3, condition: (e) => e.nb_machines >= 1 && e.nb_plans === 0, faits: ['plans-depuis-manuels', 'service-plan-29'] },
  { id: 'un-mot', jour: 14, condition: (e) => e.nb_plans === 0, faits: [] },
]

const ADRESSE_VALIDE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// La première étape à envoyer maintenant, ou null.
function etapeDue(e             )               {
  if (e.desabonnee || e.societe_du_personnel) return null
  if (!e.adresse || !ADRESSE_VALIDE.test(e.adresse)) return null
  if (e.dernier_envoi_il_y_a_jours !== null && e.dernier_envoi_il_y_a_jours < ESPACEMENT_JOURS) return null
  for (const etape of ETAPES) {
    if (e.envoyees.includes(etape.id)) continue
    if (e.age_jours < etape.jour || e.age_jours > etape.jour + FENETRE_JOURS) continue
    if (!etape.condition(e)) continue
    return etape
  }
  return null
}

                                                                         

const LIEN_APP = (etape         ) => `https://kalea.pro/app.html?utm_source=sequence&utm_medium=email&utm_campaign=${etape}`

const TEXTES                                                                                      = {
  'premiere-machine': {
    fr: {
      sujet: 'Votre première machine dans KALEA',
      corps: [
        'Bonjour,',
        'Votre compte KALEA est créé. Il ne manque plus que votre première machine.',
        'Ajoutez-la dans l\'application : KALEA génère son plan d\'entretien à partir du manuel constructeur.',
      ],
      ouvrir: 'Ouvrir KALEA',
    },
    en: {
      sujet: 'Your first machine in KALEA',
      corps: [
        'Hello,',
        'Your KALEA account is ready. All that is missing is your first machine.',
        'Add it in the application: KALEA builds its maintenance plan from the manufacturer manual.',
      ],
      ouvrir: 'Open KALEA',
    },
  },
  'premier-plan': {
    fr: {
      sujet: 'Donnez un plan d\'entretien à votre machine',
      corps: [
        'Bonjour,',
        'Votre machine est dans KALEA. Son plan d\'entretien peut être généré à partir de son manuel constructeur : ajoutez le manuel dans l\'application.',
        'Pas de manuel sous la main ? Répondez à ce message avec la photo de la plaque constructeur : nous recherchons et configurons le plan d\'entretien complet dans l\'application. C\'est un service à 29 € l\'acte.',
      ],
      ouvrir: 'Ouvrir KALEA',
    },
    en: {
      sujet: 'Give your machine a maintenance plan',
      corps: [
        'Hello,',
        'Your machine is in KALEA. Its maintenance plan can be built from its manufacturer manual: add the manual in the application.',
        'No manual at hand? Reply to this message with a photo of the manufacturer plate: we research and set up the complete maintenance plan in the application. It is a service at €29 per plan.',
      ],
      ouvrir: 'Open KALEA',
    },
  },
  'un-mot': {
    fr: {
      sujet: 'Qu\'est-ce qui a manqué ?',
      corps: [
        'Bonjour,',
        'Vous avez créé un compte KALEA il y a deux semaines, mais votre parc n\'a pas encore de plan d\'entretien.',
        'Qu\'est-ce qui a manqué : du temps, une fonction, une explication ? Répondez à ce message en une ligne. Il arrive directement à l\'équipe KALEA, et votre retour nous aide à améliorer l\'application.',
      ],
      ouvrir: 'Ouvrir KALEA',
    },
    en: {
      sujet: 'What was missing?',
      corps: [
        'Hello,',
        'You created a KALEA account two weeks ago, but your fleet does not have a maintenance plan yet.',
        'What was missing: time, a feature, an explanation? Reply to this message in one line. It goes straight to the KALEA team, and your feedback helps us improve the application.',
      ],
      ouvrir: 'Open KALEA',
    },
  },
}

function construireMessage(etape         , langue        )          {
  const t = TEXTES[etape][langue]
  const lien = LIEN_APP(etape)
  return { sujet: t.sujet, corps: [...t.corps, `${t.ouvrir} : ${lien}`, langue === 'en' ? 'The KALEA team' : 'L\'équipe KALEA'], lien }
}

// Le texte qui est CONTRÔLÉ : l'objet puis le corps (le pied de page légal est vérifié à part).
function texteAControler(etape         , langue        )         {
  const m = construireMessage(etape, langue)
  return `${m.sujet}\n${m.corps.join('\n')}`
}

function pied(langue        , lienDesabonnement        )           {
  return langue === 'en'
    ? ['You are receiving this message because you created a KALEA account. These are getting-started tips: at most three, and they stop as soon as you move forward.',
       `Do not want to receive them? Unsubscribe: ${lienDesabonnement}`]
    : ['Vous recevez ce message parce que vous avez créé un compte KALEA. Ce sont des conseils de démarrage : trois au plus, et ils s\'arrêtent dès que vous avancez.',
       `Vous ne souhaitez plus les recevoir ? Vous désabonner : ${lienDesabonnement}`]
}

function lienDesabonnement(jeton        , langue         = 'fr')         { return `https://kalea.pro/desabonnement.html?j=${jeton}${langue === 'en' ? '&l=en' : ''}` }

const echapper = (v         ) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Le même habillage que les e-mails de rappel et d'alerte (bandeau KALEA, cadre encre), les liens étant cliquables.
function construireHtml(m         , langue        , societe        , lienDesabo        )         {
  const encre = '#0E1333', accent = '#24B5A8'
  const lien = (ligne        ) => {
    const e = echapper(ligne)
    return e.replace(/(https:\/\/kalea\.pro\/[^\s<]*)/g, (u) => `<a href="${u}" style="color:${encre};font-weight:600;">${u}</a>`)
  }
  const [aide, desabo] = pied(langue, lienDesabo)
  const coupe = desabo.indexOf('https://')
  const texteDesabo = desabo.slice(0, coupe)
  const urlDesabo = desabo.slice(coupe)
  return `<!doctype html><html lang="${langue}"><body style="margin:0;padding:24px;background:#FFFFFF;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${encre};">
  <div style="max-width:520px;margin:0 auto;border:2.5px solid ${encre};border-radius:14px;overflow:hidden;">
    <div style="background:${encre};color:#FFFFFF;padding:16px 20px;font-size:16px;font-weight:600;">KALEA · ${echapper(societe)}</div>
    <div style="padding:20px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${accent};">${langue === 'en' ? 'Getting started' : 'Pour bien démarrer'}</p>
      <h1 style="margin:0 0 12px;font-size:19px;line-height:1.3;">${echapper(m.sujet)}</h1>
      ${m.corps.map((l) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;">${lien(l)}</p>`).join('')}
    </div>
    <div style="padding:12px 20px;border-top:1px solid ${encre};font-size:12px;line-height:1.5;">
      <p style="margin:0 0 6px;">${echapper(aide)}</p>
      <p style="margin:0;">${echapper(texteDesabo)}<a href="${echapper(urlDesabo)}" style="color:${encre};">${echapper(urlDesabo)}</a></p>
    </div>
  </div>
</body></html>`
}

window.marketingSequences = { ETAPES, FENETRE_JOURS, ESPACEMENT_JOURS, etapeDue, construireMessage, texteAControler, pied, lienDesabonnement, construireHtml };
}());
