export type GaitColor = 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
export type GaitType = 'lateral' | 'diagonal' | 'mixed';

export interface GaitStep {
  legs: string[];
  label: string;
}

/** Scientific reference */
export interface GaitReference {
  author: string;
  year: number;
  title: string;
  journal?: string;
  note?: string;
}

export interface GaitInfo {
  id: string;
  name: string;
  beats: number;
  pattern: string;
  description: string;
  speed: string;
  sequence: GaitStep[];
  color: GaitColor;
  dmrt3Required: boolean;
  category: 'basic' | 'lateral' | 'american';
  gaitType: GaitType;
  comfortRating: number;
  breeds: string[];
  dmrt3Genotype?: string;

  /** Footfall timeline: for each leg, array of booleans per step (true = on ground). 12 steps. */
  footfall: Record<string, boolean[]>;

  /** Phase offset per leg: 0–1 normalized within one stride cycle (Hildebrand notation) */
  phaseOffsets: Record<string, number>;

  /** Duty cycle: fraction of stride a leg is on the ground (0–1). ~0.5 = walk, ~0.35 = fast gaits */
  dutyCycle: number;

  /** Suspension duration as fraction of stride (0 = no suspension, e.g. walk/tölt) */
  suspensionFraction: number;

  /** Laterality index: 0 = pure diagonal, 0.5 = even, 1 = pure lateral (Hildebrand 1965) */
  lateralityIndex: number;

  /** Cadence range in strides/min */
  cadenceRange: [number, number];

  /** Scientific references */
  references: GaitReference[];
}

// ─── Scientific References ───────────────────────────────────────────

const REF_HILDEBRAND: GaitReference = {
  author: 'Hildebrand, M.',
  year: 1965,
  title: 'Symmetrical gaits of horses',
  journal: 'Science 150(3697):701-708',
  note: 'Foundation of footfall diagram notation, duty cycle, and laterality index.',
};

const REF_ANDERSSON: GaitReference = {
  author: 'Andersson, L.S. et al.',
  year: 2012,
  title: 'Mutations in DMRT3 affect locomotion in horses and spinal circuit function in mice',
  journal: 'Nature 488:642-646',
  note: 'Discovery of DMRT3 "Gait Keeper" mutation enabling lateral gaits.',
};

const REF_BIKNEVICIUS: GaitReference = {
  author: 'Biknevicius, A.R. et al.',
  year: 2004,
  title: 'Locomotion in the Icelandic horse: gaits, kinematics, and ground reaction forces',
  journal: 'Equine Vet J 36(7):590-596',
  note: 'Kinematic and force analysis of tölt, trot, pace in Icelandic horses.',
};

const REF_CLAYTON: GaitReference = {
  author: 'Clayton, H.M.',
  year: 2004,
  title: 'The Dynamic Horse',
  journal: 'Sport Horse Publications',
  note: 'Biomechanics of equine locomotion including canter and gallop.',
};

const REF_NICODEMUS: GaitReference = {
  author: 'Nicodemus, M.C. & Clayton, H.M.',
  year: 2003,
  title: 'Temporal variables of four-beat, stepping gaits of gaited horses',
  journal: 'Applied Animal Behaviour Science 80(2):133-142',
  note: 'Phase timing of rack, running walk, fox trot, and stepping pace.',
};

const REF_ROBILLIARD: GaitReference = {
  author: 'Robilliard, J.J. et al.',
  year: 2007,
  title: 'Gait characterisation and classification in horses',
  journal: 'Journal of Experimental Biology 210:187-197',
  note: 'Duty cycle and phase offset classification framework.',
};

// ─── 13 Gait Types ────────────────────────────────────────────────────

export const GAIT_TYPES: GaitInfo[] = [
  // ──── BASIC ────
  {
    id: 'walk', name: 'הליכה (Walk)', beats: 4, pattern: 'LH → LF → RH → RF',
    description: 'צעד בסיסי עם 4 פעימות נפרדות. תמיד לפחות רגל אחת על הקרקע. ההפרדה בזמנים בין רגליים קדמיות ואחוריות מספקת יציבות מרבית.',
    speed: '6-8 קמ"ש', category: 'basic', gaitType: 'mixed', comfortRating: 3,
    breeds: ['כל הגזעים'],
    phaseOffsets: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 },
    dutyCycle: 0.65, suspensionFraction: 0, lateralityIndex: 0.5,
    cadenceRange: [48, 60],
    sequence: [
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל - חפיפה' },
      { legs: ['LF'], label: 'קדמית שמאל' },
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין - חפיפה' },
      { legs: ['RF'], label: 'קדמית ימין' },
    ],
    footfall: {
      LF: [false, true,  true,  true,  false, false, false, false, false, false, false, false],
      RF: [false, false, false, false, false, false, false, true,  true,  true,  false, false],
      LH: [true,  true,  false, false, false, false, false, false, false, false, false, true],
      RH: [false, false, false, false, true,  true,  true,  true,  false, false, false, false],
    },
    color: 'emerald', dmrt3Required: false,
    references: [REF_HILDEBRAND, REF_ROBILLIARD],
  },
  {
    id: 'trot', name: 'טרוט (Trot)', beats: 2, pattern: 'LH+RF ↔ RH+LF',
    description: 'צעד אלכסוני סימטרי — רגליים מנוגדות באלכסון נעות ביחד. כולל שלב suspension (מעוף) ללא מגע קרקע. הצעד ה"קופצני" ביותר.',
    speed: '12-20 קמ"ש', category: 'basic', gaitType: 'diagonal', comfortRating: 2,
    breeds: ['כל הגזעים'],
    phaseOffsets: { LH: 0, RF: 0, RH: 0.5, LF: 0.5 },
    dutyCycle: 0.42, suspensionFraction: 0.16, lateralityIndex: 0,
    cadenceRange: [70, 95],
    sequence: [
      { legs: ['LH', 'RF'], label: 'אלכסון שמאל' },
      { legs: [], label: 'מעוף (Suspension)' },
      { legs: ['RH', 'LF'], label: 'אלכסון ימין' },
      { legs: [], label: 'מעוף (Suspension)' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, true,  true,  true,  true,  false, false],
      RF: [true,  true,  true,  true,  false, false, false, false, false, false, false, false],
      LH: [true,  true,  true,  true,  false, false, false, false, false, false, false, false],
      RH: [false, false, false, false, false, false, true,  true,  true,  true,  false, false],
    },
    color: 'blue', dmrt3Required: false,
    references: [REF_HILDEBRAND, REF_ROBILLIARD, REF_CLAYTON],
  },
  {
    id: 'canter', name: 'קאנטר (Canter)', beats: 3, pattern: 'RH → LH+RF → LF → suspension',
    description: 'דהירה אסימטרית עם 3 פעימות ורגע מעוף. תנועה "מתגלגלת" עם רגל מובילה (lead leg). הצעד הטבעי ביותר למעבר למהירות.',
    speed: '15-25 קמ"ש', category: 'basic', gaitType: 'mixed', comfortRating: 4,
    breeds: ['כל הגזעים'],
    phaseOffsets: { RH: 0, LH: 0.25, RF: 0.25, LF: 0.5 },
    dutyCycle: 0.40, suspensionFraction: 0.2, lateralityIndex: 0.5,
    cadenceRange: [55, 75],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין (initiator)' },
      { legs: ['LH', 'RF'], label: 'אלכסון (diagonal support)' },
      { legs: ['LF'], label: 'קדמית שמאל (lead leg)' },
      { legs: [], label: 'מעוף (Suspension)' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, true,  true,  true,  false, false, false],
      RF: [false, false, false, true,  true,  true,  true,  false, false, false, false, false],
      LH: [false, false, false, true,  true,  true,  false, false, false, false, false, false],
      RH: [true,  true,  true,  false, false, false, false, false, false, false, false, false],
    },
    color: 'rose', dmrt3Required: false,
    references: [REF_HILDEBRAND, REF_CLAYTON],
  },

  // ──── LATERAL ────
  {
    id: 'pace', name: 'פייס (Pace)', beats: 2, pattern: 'LH+LF ↔ RH+RF',
    description: 'צעד צדדי סימטרי — רגליים באותו צד נעות יחד. כולל suspension. חלק לרוכב אך עלול לגרום לנדנוד צדדי (rolling).',
    speed: '15-25 קמ"ש', category: 'lateral', gaitType: 'lateral', comfortRating: 4,
    breeds: ['איסלנדי', 'סטנדרדברד', 'פרואני'],
    dmrt3Genotype: 'AA',
    phaseOffsets: { LH: 0, LF: 0, RH: 0.5, RF: 0.5 },
    dutyCycle: 0.40, suspensionFraction: 0.18, lateralityIndex: 1.0,
    cadenceRange: [75, 100],
    sequence: [
      { legs: ['LH', 'LF'], label: 'צד שמאל' },
      { legs: [], label: 'מעוף (Suspension)' },
      { legs: ['RH', 'RF'], label: 'צד ימין' },
      { legs: [], label: 'מעוף (Suspension)' },
    ],
    footfall: {
      LF: [true,  true,  true,  true,  false, false, false, false, false, false, false, false],
      RF: [false, false, false, false, false, false, true,  true,  true,  true,  false, false],
      LH: [true,  true,  true,  true,  false, false, false, false, false, false, false, false],
      RH: [false, false, false, false, false, false, true,  true,  true,  true,  false, false],
    },
    color: 'amber', dmrt3Required: true,
    references: [REF_HILDEBRAND, REF_ANDERSSON, REF_BIKNEVICIUS],
  },
  {
    id: 'tolt', name: 'טולט (Tölt)', beats: 4, pattern: 'LH → LF → RH → RF (lateral)',
    description: 'צעד 4-פעימות שוות (isochronous) של הסוס האיסלנדי. אין שלב suspension — תמיד לפחות רגל אחת על הקרקע. טווח מהירויות רחב מ-8 עד 30 קמ"ש. Duty cycle גבוה מהטרוט.',
    speed: '8-30 קמ"ש', category: 'lateral', gaitType: 'lateral', comfortRating: 5,
    breeds: ['איסלנדי'],
    dmrt3Genotype: 'AA / CA',
    phaseOffsets: { LH: 0, LF: 0.15, RH: 0.5, RF: 0.65 },
    dutyCycle: 0.55, suspensionFraction: 0, lateralityIndex: 0.7,
    cadenceRange: [60, 110],
    sequence: [
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה' },
      { legs: ['LF'], label: 'קדמית שמאל' },
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה' },
      { legs: ['RF'], label: 'קדמית ימין' },
    ],
    footfall: {
      LF: [false, true,  true,  true,  true,  false, false, false, false, false, false, false],
      RF: [false, false, false, false, false, false, false, true,  true,  true,  true,  false],
      LH: [true,  true,  true,  false, false, false, false, false, false, false, false, true],
      RH: [false, false, false, false, false, true,  true,  true,  false, false, false, false],
    },
    color: 'purple', dmrt3Required: true,
    references: [REF_ANDERSSON, REF_BIKNEVICIUS, REF_ROBILLIARD],
  },
  {
    id: 'rack', name: 'ראק / סינגלפוט (Rack)', beats: 4, pattern: 'RH → RF → LH → LF',
    description: 'צעד 4-פעימות שוות במהירות גבוהה — "רגל אחת בכל פעם". ראש יציב לחלוטין. אין suspension. הצעד החלק ביותר בעולם הסוסים הגייטד.',
    speed: '15-32 קמ"ש', category: 'lateral', gaitType: 'lateral', comfortRating: 5,
    breeds: ['אמריקאי סאדלברד', 'טנסי ווקר'],
    dmrt3Genotype: 'AA',
    phaseOffsets: { RH: 0, RF: 0.15, LH: 0.5, LF: 0.65 },
    dutyCycle: 0.50, suspensionFraction: 0, lateralityIndex: 0.7,
    cadenceRange: [90, 130],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה' },
      { legs: ['RF'], label: 'קדמית ימין' },
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה' },
      { legs: ['LF'], label: 'קדמית שמאל' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, true,  true,  true,  true,  false],
      RF: [false, true,  true,  true,  true,  false, false, false, false, false, false, false],
      LH: [false, false, false, false, false, true,  true,  true,  false, false, false, false],
      RH: [true,  true,  true,  false, false, false, false, false, false, false, false, true],
    },
    color: 'amber', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON],
  },
  {
    id: 'stepping_pace', name: 'סטפינג פייס (Stepping Pace)', beats: 4, pattern: 'RH → RF → LH → LF (lateral bias)',
    description: 'צעד 4-פעימות עם נטייה לטרלית חזקה — רגליים מאותו צד כמעט ביחד (lateral couplet). "פייס שבור" חלק. Laterality index ~0.85.',
    speed: '8-14 קמ"ש', category: 'lateral', gaitType: 'lateral', comfortRating: 4,
    breeds: ['איסלנדי', 'פאסו פרואני'],
    dmrt3Genotype: 'AA / CA',
    phaseOffsets: { RH: 0, RF: 0.08, LH: 0.5, LF: 0.58 },
    dutyCycle: 0.52, suspensionFraction: 0, lateralityIndex: 0.85,
    cadenceRange: [55, 80],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'צד ימין (חפיפה)' },
      { legs: ['RF'], label: 'קדמית ימין' },
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'צד שמאל (חפיפה)' },
      { legs: ['LF'], label: 'קדמית שמאל' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, true,  true,  true,  true,  false],
      RF: [false, true,  true,  true,  true,  false, false, false, false, false, false, false],
      LH: [false, false, false, false, false, false, true,  true,  true,  false, false, false],
      RH: [true,  true,  true,  true,  false, false, false, false, false, false, false, true],
    },
    color: 'amber', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON, REF_BIKNEVICIUS],
  },
  {
    id: 'saddle_rack', name: 'סאדל ראק (Saddle Rack)', beats: 4, pattern: 'RH → RF → LH → LF',
    description: 'גרסה מתונה ואלגנטית של הראק עם הרמת רגליים גבוהה (High Action). מועדף בתחרויות הצגה. Cadence נמוך יותר מהראק המהיר.',
    speed: '10-20 קמ"ש', category: 'lateral', gaitType: 'lateral', comfortRating: 5,
    breeds: ['אמריקאי סאדלברד'],
    dmrt3Genotype: 'AA',
    phaseOffsets: { RH: 0, RF: 0.15, LH: 0.5, LF: 0.65 },
    dutyCycle: 0.52, suspensionFraction: 0, lateralityIndex: 0.7,
    cadenceRange: [70, 100],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה (High Action)' },
      { legs: ['RF'], label: 'קדמית ימין (High Action)' },
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה (High Action)' },
      { legs: ['LF'], label: 'קדמית שמאל (High Action)' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, true,  true,  true,  true,  false],
      RF: [false, true,  true,  true,  true,  false, false, false, false, false, false, false],
      LH: [false, false, false, false, false, true,  true,  true,  false, false, false, false],
      RH: [true,  true,  true,  false, false, false, false, false, false, false, false, true],
    },
    color: 'purple', dmrt3Required: true,
    references: [REF_NICODEMUS],
  },

  // ──── AMERICAN GAITED ────
  {
    id: 'running_walk', name: 'הליכה רצה (Running Walk)', beats: 4, pattern: 'RH → RF → LH → LF',
    description: 'גרסה מהירה של ההליכה עם Over-Stride — הרגל האחורית עוקפת את טביעת הקדמית. ניהנון ראש אופייני (head nod). Duty cycle גבוה ולכן חלק מאוד.',
    speed: '10-16 קמ"ש', category: 'american', gaitType: 'lateral', comfortRating: 5,
    breeds: ['טנסי ווקינג הורס'],
    dmrt3Genotype: 'AA / CA',
    phaseOffsets: { RH: 0, RF: 0.18, LH: 0.5, LF: 0.68 },
    dutyCycle: 0.60, suspensionFraction: 0, lateralityIndex: 0.65,
    cadenceRange: [50, 70],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה' },
      { legs: ['RF'], label: 'קדמית ימין' },
      { legs: ['LH'], label: 'אחורית שמאל (Over-Stride)' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה' },
      { legs: ['LF'], label: 'קדמית שמאל' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, false, true,  true,  true,  true],
      RF: [false, false, true,  true,  true,  true,  false, false, false, false, false, false],
      LH: [false, false, false, false, false, false, true,  true,  true,  true,  false, false],
      RH: [true,  true,  true,  true,  false, false, false, false, false, false, false, true],
    },
    color: 'emerald', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON],
  },
  {
    id: 'fox_trot', name: 'פוקס טרוט (Fox Trot)', beats: 4, pattern: 'LF → RH → RF → LH',
    description: 'צעד 4-פעימות עם נטייה דיאגונלית. הקדמיות "מהלכות" והאחוריות "טורטות" (sliding). אין suspension — חלק במיוחד בשטח הררי.',
    speed: '8-13 קמ"ש', category: 'american', gaitType: 'diagonal', comfortRating: 4,
    breeds: ['מיזורי פוקס טרוטר'],
    dmrt3Genotype: 'AA / CA',
    phaseOffsets: { LF: 0, RH: 0.15, RF: 0.5, LH: 0.65 },
    dutyCycle: 0.58, suspensionFraction: 0, lateralityIndex: 0.3,
    cadenceRange: [50, 70],
    sequence: [
      { legs: ['LF'], label: 'קדמית שמאל (walk)' },
      { legs: ['LF', 'RH'], label: 'אלכסון — חפיפה' },
      { legs: ['RH'], label: 'אחורית ימין (slide)' },
      { legs: ['RF'], label: 'קדמית ימין (walk)' },
      { legs: ['RF', 'LH'], label: 'אלכסון — חפיפה' },
      { legs: ['LH'], label: 'אחורית שמאל (slide)' },
    ],
    footfall: {
      LF: [true,  true,  true,  true,  false, false, false, false, false, false, false, false],
      RF: [false, false, false, false, false, false, true,  true,  true,  true,  false, false],
      LH: [false, false, false, false, false, false, false, false, true,  true,  true,  true],
      RH: [false, false, true,  true,  true,  true,  false, false, false, false, false, false],
    },
    color: 'blue', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON],
  },
  {
    id: 'paso_fino', name: 'פאסו פינו (Paso Fino)', beats: 4, pattern: 'RH → RF → LH → LF (rapid)',
    description: 'צעד 4-פעימות קצרצרות ומהירות במיוחד. הצעדים הקצרים ביותר מכל סוג — stride length ~50 ס"מ. נבדק על לוח תהודה (sounding board). Cadence גבוה מאוד.',
    speed: '3-6 קמ"ש', category: 'american', gaitType: 'lateral', comfortRating: 5,
    breeds: ['פאסו פינו'],
    dmrt3Genotype: 'AA',
    phaseOffsets: { RH: 0, RF: 0.15, LH: 0.5, LF: 0.65 },
    dutyCycle: 0.58, suspensionFraction: 0, lateralityIndex: 0.7,
    cadenceRange: [100, 150],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה (rapid)' },
      { legs: ['RF'], label: 'קדמית ימין' },
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה (rapid)' },
      { legs: ['LF'], label: 'קדמית שמאל' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, true,  true,  true,  true,  false],
      RF: [false, true,  true,  true,  true,  false, false, false, false, false, false, false],
      LH: [false, false, false, false, false, true,  true,  true,  false, false, false, false],
      RH: [true,  true,  true,  false, false, false, false, false, false, false, false, true],
    },
    color: 'rose', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON],
  },
  {
    id: 'paso_largo', name: 'פאסו לארגו (Paso Largo)', beats: 4, pattern: 'RH → RF → LH → LF (extended)',
    description: 'הצעד המהיר ביותר של הפאסו פינו — אותו מקצב 4 פעימות אבל עם צעדים ארוכים ומהירים. Duty cycle נמוך יותר מפאסו פינו.',
    speed: '14-24 קמ"ש', category: 'american', gaitType: 'lateral', comfortRating: 4,
    breeds: ['פאסו פינו'],
    dmrt3Genotype: 'AA',
    phaseOffsets: { RH: 0, RF: 0.15, LH: 0.5, LF: 0.65 },
    dutyCycle: 0.48, suspensionFraction: 0.04, lateralityIndex: 0.7,
    cadenceRange: [70, 100],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה' },
      { legs: ['RF'], label: 'קדמית ימין' },
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה' },
      { legs: ['LF'], label: 'קדמית שמאל' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, true,  true,  true,  false, false],
      RF: [false, true,  true,  true,  false, false, false, false, false, false, false, false],
      LH: [false, false, false, false, false, true,  true,  true,  false, false, false, false],
      RH: [true,  true,  false, false, false, false, false, false, false, false, false, true],
    },
    color: 'rose', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON],
  },
  {
    id: 'sobreandando', name: 'סוברה-אנדנדו (Sobreandando)', beats: 4, pattern: 'RH → RF → LH → LF (+ Termino)',
    description: 'צעד 4-פעימות של הפאסו הפרואני עם Termino — תנועת רגליים קדמיות סיבובית כלפי חוץ. ייחודי לגזע זה בלבד. מעריכים ב-"Brio" — אנרגיה ונוכחות.',
    speed: '10-18 קמ"ש', category: 'american', gaitType: 'lateral', comfortRating: 5,
    breeds: ['פאסו פרואני'],
    dmrt3Genotype: 'AA',
    phaseOffsets: { RH: 0, RF: 0.15, LH: 0.5, LF: 0.65 },
    dutyCycle: 0.55, suspensionFraction: 0, lateralityIndex: 0.7,
    cadenceRange: [60, 85],
    sequence: [
      { legs: ['RH'], label: 'אחורית ימין' },
      { legs: ['RH', 'RF'], label: 'ימין — חפיפה (Termino)' },
      { legs: ['RF'], label: 'קדמית ימין (Termino)' },
      { legs: ['LH'], label: 'אחורית שמאל' },
      { legs: ['LH', 'LF'], label: 'שמאל — חפיפה (Termino)' },
      { legs: ['LF'], label: 'קדמית שמאל (Termino)' },
    ],
    footfall: {
      LF: [false, false, false, false, false, false, false, true,  true,  true,  true,  false],
      RF: [false, true,  true,  true,  true,  false, false, false, false, false, false, false],
      LH: [false, false, false, false, false, true,  true,  true,  false, false, false, false],
      RH: [true,  true,  true,  false, false, false, false, false, false, false, false, true],
    },
    color: 'purple', dmrt3Required: true,
    references: [REF_NICODEMUS, REF_ANDERSSON],
  },
];

export const GAIT_CATEGORIES = [
  { id: 'basic', label: 'בסיסי', description: 'ללא DMRT3', icon: '🐴' },
  { id: 'lateral', label: 'צדדי (Lateral)', description: 'דורש DMRT3', icon: '🧬' },
  { id: 'american', label: 'גייטד אמריקאי', description: 'דורש DMRT3', icon: '🇺🇸' },
] as const;

export const COLOR_MAP: Record<GaitColor, { bg: string; text: string; glow: string; border: string; bgLight: string }> = {
  emerald: { bg: 'hsl(152, 69%, 41%)', text: 'hsl(152, 69%, 80%)', glow: 'hsl(152, 69%, 41%)', border: 'hsl(152, 69%, 41%)', bgLight: 'hsl(152, 69%, 41% / 0.15)' },
  blue: { bg: 'hsl(217, 91%, 60%)', text: 'hsl(217, 91%, 80%)', glow: 'hsl(217, 91%, 60%)', border: 'hsl(217, 91%, 60%)', bgLight: 'hsl(217, 91%, 60% / 0.15)' },
  amber: { bg: 'hsl(38, 92%, 50%)', text: 'hsl(38, 92%, 80%)', glow: 'hsl(38, 92%, 50%)', border: 'hsl(38, 92%, 50%)', bgLight: 'hsl(38, 92%, 50% / 0.15)' },
  purple: { bg: 'hsl(271, 91%, 65%)', text: 'hsl(271, 91%, 80%)', glow: 'hsl(271, 91%, 65%)', border: 'hsl(271, 91%, 65%)', bgLight: 'hsl(271, 91%, 65% / 0.15)' },
  rose: { bg: 'hsl(350, 89%, 60%)', text: 'hsl(350, 89%, 80%)', glow: 'hsl(350, 89%, 60%)', border: 'hsl(350, 89%, 60%)', bgLight: 'hsl(350, 89%, 60% / 0.15)' },
};

export const GAIT_TYPE_LABELS: Record<GaitType, { he: string; en: string; icon: string }> = {
  lateral: { he: 'צדדי', en: 'Lateral', icon: '↔' },
  diagonal: { he: 'אלכסוני', en: 'Diagonal', icon: '⤢' },
  mixed: { he: 'מעורב', en: 'Mixed', icon: '✦' },
};

// ─── Bilingual Support ────────────────────────────────────────────────

const GAIT_NAME_EN: Record<string, string> = {
  walk: 'Walk', trot: 'Trot', canter: 'Canter', pace: 'Pace',
  tolt: 'Tölt', rack: 'Rack / Singlefoot', stepping_pace: 'Stepping Pace',
  saddle_rack: 'Saddle Rack', running_walk: 'Running Walk', fox_trot: 'Fox Trot',
  paso_fino: 'Paso Fino', paso_largo: 'Paso Largo', sobreandando: 'Sobreandando',
};

const GAIT_DESC_EN: Record<string, string> = {
  walk: 'Basic 4-beat gait. Always at least one foot on the ground. The time separation between front and hind legs provides maximum stability.',
  trot: 'Symmetrical diagonal gait — opposite legs move together. Includes a suspension phase with no ground contact. The "bounciest" gait.',
  canter: 'Asymmetrical 3-beat gait with a moment of suspension. A "rolling" motion with a lead leg. The most natural transition to speed.',
  pace: 'Symmetrical lateral gait — legs on the same side move together. Includes suspension. Smooth for the rider but may cause lateral rolling.',
  tolt: '4-beat isochronous gait of the Icelandic horse. No suspension — always at least one foot on the ground. Wide speed range 8-30 km/h. Higher duty cycle than trot.',
  rack: 'High-speed even 4-beat gait — "one foot at a time". Completely stable head. No suspension. The smoothest gait in the gaited horse world.',
  stepping_pace: '4-beat gait with strong lateral bias — legs on the same side nearly together (lateral couplet). "Broken pace". Laterality index ~0.85.',
  saddle_rack: 'Moderate, elegant rack with high leg action (High Action). Preferred in show competitions. Lower cadence than fast rack.',
  running_walk: 'Fast version of the walk with Over-Stride — hind foot passes front footprint. Characteristic head nod. High duty cycle makes it very smooth.',
  fox_trot: '4-beat gait with diagonal tendency. Front legs "walk" and hind legs "trot" (sliding). No suspension — especially smooth on mountainous terrain.',
  paso_fino: 'Extremely rapid short 4-beat gait. Shortest strides of any type — ~50 cm. Tested on a sounding board. Very high cadence.',
  paso_largo: 'The fastest Paso Fino gait — same 4-beat rhythm but with long, fast strides. Lower duty cycle than Paso Fino.',
  sobreandando: '4-beat gait of the Peruvian Paso with Termino — outward circular front leg motion. Unique to this breed. Evaluated by "Brio" — energy and presence.',
};

const GAIT_SPEED_EN: Record<string, string> = {
  walk: '6-8 km/h', trot: '12-20 km/h', canter: '15-25 km/h', pace: '15-25 km/h',
  tolt: '8-30 km/h', rack: '15-32 km/h', stepping_pace: '8-14 km/h', saddle_rack: '10-20 km/h',
  running_walk: '10-16 km/h', fox_trot: '8-13 km/h', paso_fino: '3-6 km/h',
  paso_largo: '14-24 km/h', sobreandando: '10-18 km/h',
};

const GAIT_BREEDS_EN: Record<string, string[]> = {
  walk: ['All breeds'], trot: ['All breeds'], canter: ['All breeds'],
  pace: ['Icelandic', 'Standardbred', 'Peruvian Paso'],
  tolt: ['Icelandic'], rack: ['American Saddlebred', 'Tennessee Walker'],
  stepping_pace: ['Icelandic', 'Peruvian Paso'], saddle_rack: ['American Saddlebred'],
  running_walk: ['Tennessee Walking Horse'], fox_trot: ['Missouri Fox Trotter'],
  paso_fino: ['Paso Fino'], paso_largo: ['Paso Fino'], sobreandando: ['Peruvian Paso'],
};

const STEP_LABEL_EN: Record<string, string> = {
  'אחורית שמאל': 'Left Hind', 'שמאל - חפיפה': 'Left overlap', 'קדמית שמאל': 'Left Front',
  'אחורית ימין': 'Right Hind', 'ימין - חפיפה': 'Right overlap', 'קדמית ימין': 'Right Front',
  'אלכסון שמאל': 'Left diagonal', 'מעוף (Suspension)': 'Suspension', 'אלכסון ימין': 'Right diagonal',
  'אחורית ימין (initiator)': 'Right Hind (initiator)', 'אלכסון (diagonal support)': 'Diagonal support',
  'קדמית שמאל (lead leg)': 'Left Front (lead leg)', 'צד שמאל': 'Left side', 'צד ימין': 'Right side',
  'שמאל — חפיפה': 'Left overlap', 'ימין — חפיפה': 'Right overlap',
  'צד ימין (חפיפה)': 'Right side (overlap)', 'צד שמאל (חפיפה)': 'Left side (overlap)',
  'ימין — חפיפה (High Action)': 'Right overlap (High Action)',
  'קדמית ימין (High Action)': 'Right Front (High Action)',
  'שמאל — חפיפה (High Action)': 'Left overlap (High Action)',
  'קדמית שמאל (High Action)': 'Left Front (High Action)',
  'אחורית שמאל (Over-Stride)': 'Left Hind (Over-Stride)',
  'קדמית שמאל (walk)': 'Left Front (walk)', 'אלכסון — חפיפה': 'Diagonal overlap',
  'אחורית ימין (slide)': 'Right Hind (slide)', 'קדמית ימין (walk)': 'Right Front (walk)',
  'אחורית שמאל (slide)': 'Left Hind (slide)',
  'ימין — חפיפה (rapid)': 'Right overlap (rapid)', 'שמאל — חפיפה (rapid)': 'Left overlap (rapid)',
  'ימין — חפיפה (Termino)': 'Right overlap (Termino)', 'קדמית ימין (Termino)': 'Right Front (Termino)',
  'שמאל — חפיפה (Termino)': 'Left overlap (Termino)', 'קדמית שמאל (Termino)': 'Left Front (Termino)',
};

const CAT_EN: Record<string, { label: string; description: string }> = {
  basic: { label: 'Basic', description: 'No DMRT3' },
  lateral: { label: 'Lateral', description: 'Requires DMRT3' },
  american: { label: 'American Gaited', description: 'Requires DMRT3' },
};

export type Language = 'he' | 'en';

export function localizeGait(gait: GaitInfo, lang: Language): GaitInfo {
  if (lang === 'he') return gait;
  return {
    ...gait,
    name: GAIT_NAME_EN[gait.id] || gait.name,
    description: GAIT_DESC_EN[gait.id] || gait.description,
    speed: GAIT_SPEED_EN[gait.id] || gait.speed,
    breeds: GAIT_BREEDS_EN[gait.id] || gait.breeds,
    sequence: gait.sequence.map(s => ({ ...s, label: STEP_LABEL_EN[s.label] || s.label })),
  };
}

export function localizeCategories(lang: Language) {
  if (lang === 'he') return GAIT_CATEGORIES;
  return GAIT_CATEGORIES.map(c => ({
    ...c,
    label: CAT_EN[c.id]?.label || c.label,
    description: CAT_EN[c.id]?.description || c.description,
  }));
}
