import {writeFileSync} from 'node:fs';
const BS = String.fromCharCode(92);
const esc = (c) => c.replace(/([^a-zA-Z0-9_-])/g, (m) => BS + m);
const D = 'html[data-theme="dark"] ';
const R = []; const add = (cls, decl, extra='') => R.push(D + '.' + esc(cls) + extra + '{' + decl + '}');
const HV = (cls) => 'hover:' + cls;
const fond = (cls, v) => { add(cls, 'background-color:' + v + '!important'); add(HV(cls), 'background-color:' + v + '!important', ':hover'); };
const FOND = '#141A33', SOFT = 'rgba(255,255,255,.06)', TINT = '#1B2245';
// Fonds
for (const c of ['bg-white','bg-brand-cardBg']) fond(c, FOND);
for (const c of ['bg-white/90','bg-white/95']) add(c, 'background-color:rgba(11,15,34,.88)!important');
for (const c of ['bg-brand-surface','bg-slate-50','bg-slate-50/70','bg-slate-50/50','bg-slate-100','bg-slate-100/90','bg-[#f3f5fb]']) fond(c, 'rgba(255,255,255,.05)');
for (const c of ['bg-slate-200/60']) add(c, 'background-color:rgba(255,255,255,.1)!important');
for (const c of ['bg-brand-subtleBg','bg-[#dce9ff]','bg-[#e5eeff]','bg-[#eff4ff]','bg-[#f8f9ff]','bg-[#dcecf5]']) fond(c, TINT);
add('bg-[#dce9ff]/40','background-color:rgba(91,82,223,.16)!important');
add('hover:bg-slate-50','background-color:rgba(255,255,255,.08)!important',':hover');
add('hover:bg-slate-100','background-color:rgba(255,255,255,.1)!important',':hover');
add('hover:bg-blue-100','background-color:rgba(35,111,224,.25)!important',':hover');
for (const [c,v] of [['bg-teal-50','rgba(36,181,168,.14)'],['bg-emerald-50','rgba(16,185,129,.14)'],['bg-blue-50','rgba(35,111,224,.16)'],['bg-amber-50','rgba(245,158,11,.14)'],['bg-amber-100/70','rgba(245,158,11,.18)'],['bg-red-100/70','rgba(239,68,68,.18)']]) add(c,'background-color:'+v+'!important');
// Texte
const T = [['text-brand-ink','#F5F7FF'],['text-[#0b1c30]','#F5F7FF'],['text-[#0E1333]','#F5F7FF'],['text-slate-700','#DCE2F4'],['text-slate-600','#C9D0E6'],['text-[#585e74]','#C9D0E6'],['text-slate-500','#AEB7D3'],
 ['text-[#5B52DF]','#9D97FF'],['text-brand-indigo','#9D97FF'],['text-[#236FE0]','#6FA6FF'],['text-brand-primary','#6FA6FF'],['text-[#006591]','#5CC8F5'],['text-[#006591]/70','rgba(92,200,245,.75)'],
 ['text-amber-700','#FBBF24'],['text-amber-800','#FCD34D'],['text-emerald-700','#6EE7B7'],['text-teal-700','#5EEAD4'],['text-red-600','#FCA5A5'],['text-emerald-600','#34D399'],['hover:text-blue-800','#93C5FD'],['hover:text-brand-primary','#8DB8FF'],['hover:text-[#0b1c30]','#FFFFFF']];
for (const [c,v] of T) add(c,'color:'+v+'!important', c.startsWith('hover:')?':hover':'');
// Bordures
for (const c of ['border-slate-100','border-slate-200','border-slate-200/90','border-slate-200/80','border-slate-200/70','border-slate-200/60','border-slate-300','border-slate-150','border-brand-borderMuted','border-blue-200/60','border-blue-200/70','border-blue-200/80']) add(c,'border-color:rgba(255,255,255,.12)!important');
for (const c of ['divide-brand-borderMuted']) R.push(D+'.'+esc(c)+' > :not([hidden]) ~ :not([hidden]){border-color:rgba(255,255,255,.12)!important}');
add('ring-slate-200','--tw-ring-color:rgba(255,255,255,.14)!important');
add('hover:border-slate-200','border-color:rgba(255,255,255,.25)!important',':hover');
for (const [c,v] of [['border-teal-200/80','rgba(36,181,168,.4)'],['border-teal-200','rgba(36,181,168,.4)'],['border-emerald-200/80','rgba(16,185,129,.4)'],['border-amber-200/80','rgba(245,158,11,.4)']]) add(c,'border-color:'+v+'!important');
// Remise à l'état d'origine DANS les zones déjà sombres (pied de page, bandeaux encre) : leurs textes clairs ne doivent pas bouger.
const ZONES = ['.bg-brand-ink','.bg-brand-dark','.'+esc('bg-[#0E1333]'),'.'+esc('bg-[#213145]')];
const dansZone = (sel, decl) => R.push(ZONES.map((z) => D + z + ' ' + sel).join(',') + '{' + decl + '}');
dansZone('.text-brand-ink', 'color:#0E1333!important');
R.push(ZONES.map((z)=>D+z+' .bg-white:not(.x)').join(',')+'{background-color:#fff!important}');
// Grandes zones encre : plus sombres que la page pour rester lisibles ; boutons pleins encre : indigo.
R.push(D+'section.bg-brand-ink,'+D+'footer.bg-brand-ink,'+D+'div.bg-brand-ink,'+D+'section.bg-brand-dark,'+D+'footer.bg-brand-dark{background-color:#060919!important}');
const E0='.'+esc('bg-[#0E1333]');
R.push(D+'a.bg-brand-ink,'+D+'button.bg-brand-ink,'+D+'a'+E0+','+D+'button'+E0+'{background-color:#5B52DF!important;color:#fff!important}');
R.push(D+'a.bg-brand-ink:hover,'+D+'button.bg-brand-ink:hover,'+D+'a.'+esc('hover:bg-slate-900')+':hover,'+D+'button.'+esc('hover:bg-slate-900')+':hover{background-color:#7068F0!important}');
// Corps de page, éléments inline, formulaires
R.push(D+'body{background-color:#0B0F22!important;color:#F5F7FF!important}');
R.push(D+'.hero-glow{background:radial-gradient(circle at 80% 20%,rgba(36,181,168,.14) 0%,rgba(91,82,223,.1) 40%,transparent 70%)!important}');
R.push(D+'input,'+D+'select,'+D+'textarea{background-color:#0B0F22!important;color:#F5F7FF!important;border-color:rgba(255,255,255,.2)!important}');
R.push(D+'::selection{background:#5B52DF;color:#fff}');
R.push(D+'.'+esc('[&_strong]:text-brand-ink')+' strong{color:#F5F7FF!important}');
R.push(D+'.theme-bascule{color:#F5F7FF}');
writeFileSync('site-sombre.css', '/* KALEA — site vitrine, thème sombre. GÉNÉRÉ par outils/generer-sombre-site.mjs : ne pas modifier à la main. Actif seulement si html[data-theme="dark"] (theme.js). */\n' + R.join('\n') + '\n');
console.log(R.length, 'règles');
