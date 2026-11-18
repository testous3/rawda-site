const build = require('./rawda_build.js');
const fs = require('fs');

const OUTDIR = '/tmp/rawda-final-v2';
fs.mkdirSync(OUTDIR, { recursive: true });

const jobs = [
  { file: 'marketing_1_dua_fr.png', line1: 'Ton feed de douaas,', line2: 'à ton rythme' },
  { file: 'marketing_2_miracle_fr.png', line1: 'Swipe et découvre', line2: 'un miracle' },
  { file: 'marketing_3_filter_fr.png', line1: 'Choisis tes sujets', line2: 'préférés' },
  { file: 'marketing_4_theme_fr.png', line1: 'Un fond pour chaque', line2: 'affirmation' },
  { file: 'marketing_5_widget_fr.png', line1: 'Rawda sur ton écran', line2: "d'accueil" },
  { file: 'marketing_6_lockscreen_fr.png', line1: 'Ton affirmation,', line2: 'même verrouillé' },
  { file: 'marketing_7_notification_fr.png', line1: 'Un rappel doux,', line2: 'chaque jour' },
  { file: 'marketing_8_languages_fr.png', line1: 'Disponible en 6', line2: 'langues' },
];

(async () => {
  for (const j of jobs) {
    await build({
      srcImg: `/tmp/rawda-screens/${j.file}`,
      out: `${OUTDIR}/${j.file}`,
      line1: j.line1,
      line2: j.line2,
    });
  }
})().catch(e => { console.error(e); process.exit(1); });
