import rockyMountainImg from "@/assets/breeds/rocky-mountain.jpg";
import standardbredPacerImg from "@/assets/breeds/standardbred-pacer.jpg";
import standardbredTrotterImg from "@/assets/breeds/standardbred-trotter.jpg";
import saddlebredImg from "@/assets/breeds/saddlebred.jpg";
import pasoFinoImg from "@/assets/breeds/paso-fino.jpg";
import tennesseeWalkerImg from "@/assets/breeds/tennessee-walker.jpg";
import icelandicImg from "@/assets/breeds/icelandic.jpg";
import missouriFoxTrotterImg from "@/assets/breeds/missouri-fox-trotter.jpg";
import peruvianPasoImg from "@/assets/breeds/peruvian-paso.jpg";
import mangalargaMarchadorImg from "@/assets/breeds/mangalarga-marchador.jpg";
import andalusianImg from "@/assets/breeds/andalusian.jpg";

export interface Breed {
  id: string;
  nameHe: string;
  nameEn: string;
  origin: string;
  originEn: string;
  description: string;
  descriptionLong: string;
  gaits: string[];
  gaitType: "singlefoot" | "pace" | "trot" | "lateral" | "diagonal" | "mixed";
  dmrt3: string;
  dmrt3Genotype: "AA" | "CA" | "CC" | "AA/CA";
  temperament: string;
  history: string;
  characteristics: string[];
  image: string;
  color: string;
  category: "core" | "standardbred" | "world";
  heightRange: string;
  weightRange: string;
  lifespan: string;
  primaryGait: string;
  rideComfort: number; // 1-5
  trailSuitability: number; // 1-5
  showSuitability: number; // 1-5
}

export const breeds: Breed[] = [
  /* ═══════════════════════════════════════════
     CORE GAITED BREEDS (Singlefoot / Rack)
     ═══════════════════════════════════════════ */
  {
    id: "rocky-mountain",
    nameHe: "רוקי מאונטן",
    nameEn: "Rocky Mountain Horse",
    origin: "קנטאקי, ארה\"ב",
    originEn: "Kentucky, USA",
    description: "סוס הרים עם Single-foot טבעי מלידה — צעד ארבע פעימות חלק ונוח במיוחד. ידוע בצבע השוקולד עם רעמת פשתן בלונדינית.",
    descriptionLong: "הרוקי מאונטן הוא אחד מסוסי הצעד הנחשקים ביותר בעולם בזכות הצעד הטבעי שלו — Single-foot (סינגלפוט). זהו צעד ארבע פעימות שוות שבו כל פרסה נוחתת בנפרד, מה שמייצר רכיבה חלקה ונוחה במיוחד ללא כל טלטלה. הגזע פותח באזור הרי אפלצ'ים בקנטאקי, שם התנאים ההרריים הקשים דרשו סוס יציב, עמיד ובטוח ברגל. מקורו בסטליון בודד בשם Old Tobe שהגיע לאזור בשנות ה-1890. הצבע השוקולדי האופייני עם רעמת הפשתן הבלונדינית הפך לסימן ההיכר של הגזע.",
    gaits: ["Walk", "Single-foot Gait", "Canter"],
    gaitType: "singlefoot",
    dmrt3: "AA — הומוזיגוטי. הצעד הטבעי (Single-foot) חזק ויציב מלידה. כמעט כל הפרטים בגזע נושאים שני עותקים של המוטציה.",
    dmrt3Genotype: "AA",
    temperament: "רגוע מאוד, ביטחון עצמי, סבלני. מכונה 'הסוס העדין'. מתאים למתחילים ולרוכבים מנוסים כאחד.",
    history: "מקורו בסטליון בודד בשם Old Tobe שהגיע להרי אפלצ'ים בקנטאקי בשנות ה-1890. שימש כסוס עבודה רב-תכליתי בחוות ההרים. הגזע נרשם רשמית ב-1986 ומאז צמח בפופולריות עולמית.",
    characteristics: ["Single-foot טבעי מלידה", "צבע שוקולד + רעמת פשתן", "רגוע ויציב בשטח", "סיבולת הרים מעולה", "מבנה גוף קומפקטי וחזק"],
    image: rockyMountainImg,
    color: "from-amber-800 to-yellow-900",
    category: "core",
    heightRange: "145-160 ס\"מ",
    weightRange: "410-500 ק\"ג",
    lifespan: "25-37 שנה",
    primaryGait: "Single-foot",
    rideComfort: 5,
    trailSuitability: 5,
    showSuitability: 3,
  },
  {
    id: "saddlebred",
    nameHe: "אמריקן סדלברד",
    nameEn: "American Saddlebred",
    origin: "קנטאקי, ארה\"ב",
    originEn: "Kentucky, USA",
    description: "\"הטווס של עולם הסוסים\" — סוס שואני עם Rack מרהיב ו-Slow Gait. בגרסת ה-5-Gaited מציג חמישה צעדים שונים.",
    descriptionLong: "הסדלברד האמריקאי הוא אחד הסוסים הנוכחיים ביותר בזירה. בגרסת ה-Five-Gaited הוא מבצע חמישה צעדים: Walk, Trot, Canter, Slow Gait (סינגלפוט איטי ומבוקר) ו-Rack (סינגלפוט מהיר עם הרמת ברכיים גבוהה ודרמטית). ה-Rack של הסדלברד הוא ייחודי — מהיר, מרהיב, עם action גבוה שמושך עין. המוטציה ב-DMRT3 נפוצה בסדלברדים בעלי 5 צעדים ומאפשרת להם לבצע את הצעדים הנוספים ללא מאמץ.",
    gaits: ["Walk", "Trot", "Canter", "Slow Gait", "Rack"],
    gaitType: "singlefoot",
    dmrt3: "AA/CA — מוטציית DMRT3 נפוצה בסדלברדים 5-Gaited. ההטרוזיגוטים (CA) מסוגלים לביצוע rack אך עם פחות עקביות מ-AA.",
    dmrt3Genotype: "AA/CA",
    temperament: "חיוני, חכם, בעל נוכחות מרשימה. אוהב לעבוד ומרגש לרכיבה. דורש רוכב שמבין את האנרגיה שלו.",
    history: "פותח במאה ה-19 בקנטאקי מתוך שילוב של מורגן, Thoroughbred, Narragansett Pacer וסוסי צעד קנדיים. הוכר רשמית ב-1891. היה סוס הרכיבה המועדף של קציני הצפון במלחמת האזרחים.",
    characteristics: ["Rack מרהיב במהירות גבוהה", "נשיאת ראש וזנב גבוהה", "אלגנטיות ונוכחות בזירה", "5 צעדים בגרסה המלאה", "Action גבוה ומרשים"],
    image: saddlebredImg,
    color: "from-rose-700 to-pink-900",
    category: "core",
    heightRange: "152-165 ס\"מ",
    weightRange: "450-540 ק\"ג",
    lifespan: "25-30 שנה",
    primaryGait: "Rack",
    rideComfort: 4,
    trailSuitability: 3,
    showSuitability: 5,
  },

  /* ═══════════════════════════════════════════
     STANDARDBRED — PACER & TROTTER
     ═══════════════════════════════════════════ */
  {
    id: "standardbred-pacer",
    nameHe: "סטנדרדברד — פייסר",
    nameEn: "Standardbred (Pacer)",
    origin: "ארה\"ב",
    originEn: "USA",
    description: "הפייסר נע בצעד צדי (ימין-ימין, שמאל-שמאל). כאשר 'נשבר' ל-broken pace, מתקבל סינגלפוט מושלם — ארבע פעימות חלקות.",
    descriptionLong: "הסטנדרדברד הפייסר הוא הסוס הדומיננטי במרוצי רתמה בצפון אמריקה — כ-80% מסוסי המרוצים הם פייסרים. הצעד הצדי (Pace) שלו מאופיין בכך ששתי הרגליים מאותו צד נעות יחד: ימין-ימין, שמאל-שמאל. זהו צעד מהיר ויעיל אנרגטית אך עם נדנוד צדי מורגש. הנקודה המרתקת ביותר: כאשר הפייסר 'שובר' את הצעד הצדי (Broken Pace), הפרדת הזמן בין הרגליים באותו צד יוצרת ארבע פעימות נפרדות — Single-foot מושלם. זוהי הבסיס הגנטי של רוב סוסי הצעד בצפון אמריקה.",
    gaits: ["Walk", "Pace", "Broken Pace / Single-foot"],
    gaitType: "pace",
    dmrt3: "AA/CA — נשאי מוטציית DMRT3 שמאפשרת את הצעד הצדי. הומוזיגוטים (AA) מציגים pace טהור, הטרוזיגוטים (CA) עשויים להפגין broken pace.",
    dmrt3Genotype: "AA/CA",
    temperament: "אנרגטי, נחוש, חכם. בעל אתיקת עבודה גבוהה ממרוצים. דורש רוכב מנוסה לאיזון הצעד.",
    history: "מאותו גזע כמו הטרוטר, אך נבחר במשך דורות לצעד צדי (pace). Messenger (1780) נחשב לאב המייסד. Dan Patch (1896) היה הפייסר המפורסם ביותר בהיסטוריה עם שיא מייל ב-1:55¼.",
    characteristics: ["צעד צדי מהיר (pace)", "יכולת broken pace / single-foot", "שטוח ויעיל אנרגטית", "מבנה שרירי ואתלטי", "נדנוד צדי אופייני"],
    image: standardbredPacerImg,
    color: "from-gray-700 to-slate-900",
    category: "standardbred",
    heightRange: "150-165 ס\"מ",
    weightRange: "400-530 ק\"ג",
    lifespan: "25-30 שנה",
    primaryGait: "Pace",
    rideComfort: 3,
    trailSuitability: 4,
    showSuitability: 2,
  },
  {
    id: "standardbred-trotter",
    nameHe: "סטנדרדברד — טרוטר",
    nameEn: "Standardbred (Trotter)",
    origin: "ארה\"ב",
    originEn: "USA",
    description: "הטרוטר נע בטרוט אלכסוני — רגל קדמית ימין + אחורית שמאל בו-זמנית. חזק, יציב ובעל סיבולת גבוהה.",
    descriptionLong: "הטרוטר הוא ה-'קלאסיקן' של עולם הסטנדרדברד. הצעד שלו הוא טרוט אלכסוני טהור — שני זוגות אלכסוניים (קדמית ימין + אחורית שמאל, ולהפך) מתחלפים בקצב דו-פעימתי. בניגוד לפייסר, הטרוטר יציב יותר (ללא נדנוד צדי) אך לרוב איטי יותר. רוב הטרוטרים הם CC (Wild Type) — שני עותקים של הגן הרגיל, מה שמונע מהם לבצע צעדים לטרליים. הסטנדרדברד הוא לא גזע מראה אלא גזע ביצועים — מוגדר לפי יכולת לעמוד ב'סטנדרד' זמן מסוים למייל.",
    gaits: ["Walk", "Trot", "Canter"],
    gaitType: "trot",
    dmrt3: "CC — רוב הטרוטרים הומוזיגוטיים לאלל הרגיל (Wild Type). צעד אלכסוני טהור ללא נטייה לטרלית.",
    dmrt3Genotype: "CC",
    temperament: "חרוץ, חכם, שיתופי. מסתגל היטב לסביבות חדשות לאחר פרישה ממרוצים. מצוין כסוס רכיבה שני.",
    history: "פותח במאה ה-18 בצפון אמריקה לצורך מרוצי רתמה. Hambletonian 10 (1849) הוא אב קדמון של כמעט כל הטרוטרים כיום. המרוץ המפורסם ביותר: Hambletonian Stakes.",
    characteristics: ["טרוט אלכסוני חזק ויציב", "מהירות מרשימה בטרוט", "סיבולת גבוהה", "מבנה שרירי ואתלטי", "ללא נדנוד צדי"],
    image: standardbredTrotterImg,
    color: "from-slate-700 to-zinc-900",
    category: "standardbred",
    heightRange: "150-165 ס\"מ",
    weightRange: "400-530 ק\"ג",
    lifespan: "25-30 שנה",
    primaryGait: "Trot",
    rideComfort: 2,
    trailSuitability: 4,
    showSuitability: 2,
  },

  /* ═══════════════════════════════════════════
     WORLD GAITED BREEDS
     ═══════════════════════════════════════════ */
  {
    id: "tennessee-walker",
    nameHe: "טנסי ווקר",
    nameEn: "Tennessee Walking Horse",
    origin: "טנסי, ארה\"ב",
    originEn: "Tennessee, USA",
    description: "ידוע בצעד ה-Running Walk הייחודי — צעד מהיר וחלק שבו הסוס מנהן בראשו בקצב. צעד מעבר ארוך (overstride).",
    descriptionLong: "הטנסי ווקר הוא אחד הסוסים הפופולריים ביותר בצפון אמריקה לרכיבת פנאי ושטח. הצעד הייחודי שלו — Running Walk — הוא צעד ארבע פעימות מהיר (15-32 קמ\"ש) שבו הרגל האחורית 'עוברת' את טביעת הרגל הקדמית (overstride). הסימן המזהה הבולט ביותר: הנהון ראש קצבי בולט שמסונכרן עם תנועת הרגליים. הצעד חלק כל כך שנהוג לומר שאפשר לשתות כוס קפה בזמן רכיבה ללא שפיכה.",
    gaits: ["Flat Walk", "Running Walk", "Canter"],
    gaitType: "lateral",
    dmrt3: "AA/CA — רוב הסוסים הומוזיגוטיים (AA) עם צעד חזק ויציב. הטרוזיגוטים מצטיינים גם כן אך פחות עקביים.",
    dmrt3Genotype: "AA/CA",
    temperament: "עדין, סבלני, ביטחון עצמי גבוה. מכונה 'סוס הנאה' (Pleasure Horse). מצוין למתחילים.",
    history: "פותח במאה ה-18 בטנסי מתוך שילוב של נרגנסט פייסר, סטנדרדברד ומורגן. שימש כסוס חווה רב-תכליתי. Black Allan (1886) הוא אב המייסד של הגזע המודרני.",
    characteristics: ["Running Walk ייחודי עם overstride", "הנהון ראש קצבי בולט", "אלגנטיות טבעית", "מבנה גוף ארוך ואתלטי", "מתאים לרכיבת שטח ארוכה"],
    image: tennesseeWalkerImg,
    color: "from-stone-600 to-stone-800",
    category: "world",
    heightRange: "152-163 ס\"מ",
    weightRange: "430-540 ק\"ג",
    lifespan: "28-33 שנה",
    primaryGait: "Running Walk",
    rideComfort: 5,
    trailSuitability: 5,
    showSuitability: 4,
  },
  {
    id: "icelandic",
    nameHe: "איסלנדי",
    nameEn: "Icelandic Horse",
    origin: "איסלנד",
    originEn: "Iceland",
    description: "גזע עתיק עם חמישה צעדים טבעיים — כולל ה-Tölt המפורסם ו-Flying Pace. קטן אך חזק ועמיד במיוחד.",
    descriptionLong: "הסוס האיסלנדי הוא פנינה גנטית — גזע שנשמר בבידוד מוחלט במשך למעלה מ-1,000 שנה. מאז שהוויקינגים הביאו את אבותיו לאיסלנד במאה ה-9, לא יובא אף סוס לאי (ומי שיוצא — לא חוזר). התוצאה: גנום טהור עם יכולות מדהימות. הסוס האיסלנדי הוא היחיד בעולם שמציג חמישה צעדים טבעיים: Walk, Trot, Canter, Tölt (ארבע פעימות ללא ריחוף — נוח לרכיבה), ו-Flying Pace (צעד צדי מהיר במיוחד המגיע ל-48 קמ\"ש). מוטציית DMRT3 הכרחית לביצוע Tölt ו-Pace.",
    gaits: ["Walk", "Trot", "Canter", "Tölt", "Flying Pace"],
    gaitType: "lateral",
    dmrt3: "AA — הכרחי לביצוע Tölt ו-Pace. סוסים עם CC מוגבלים ל-3 צעדים בלבד. ההבדל הגנטי קובע את 'רמת' הסוס.",
    dmrt3Genotype: "AA",
    temperament: "חברותי, סקרן, אמיץ. מתמודד מצוין עם תנאי מזג אוויר קשים. עצמאי אך מסור לרוכב.",
    history: "הובא לאיסלנד על ידי הוויקינגים במאה ה-9. חוק מ-982 אוסר יבוא סוסים לאיסלנד — הגזע נשמר בטהרה מוחלטת. כיום כ-80,000 סוסים באיסלנד ועוד 100,000 ברחבי העולם.",
    characteristics: ["5 צעדים טבעיים ייחודיים", "Tölt חלק ונוח", "עמידות יוצאת דופן לקור", "רעמה ארוכה ופראית", "גודל קטן אך כוח מפתיע"],
    image: icelandicImg,
    color: "from-sky-700 to-slate-700",
    category: "world",
    heightRange: "130-145 ס\"מ",
    weightRange: "330-380 ק\"ג",
    lifespan: "25-40 שנה",
    primaryGait: "Tölt",
    rideComfort: 5,
    trailSuitability: 5,
    showSuitability: 4,
  },
  {
    id: "paso-fino",
    nameHe: "פאסו פינו",
    nameEn: "Paso Fino",
    origin: "קולומביה / פורטו ריקו",
    originEn: "Colombia / Puerto Rico",
    description: "סוס עם צעד טבעי מושלם בארבע פעימות שוות. נחשב לאחד הסוסים הנוחים ביותר לרכיבה בעולם.",
    descriptionLong: "שמו אומר הכל — 'פאסו פינו' פירושו 'צעד עדין'. זהו סוס עם שלושה וריאציות של אותו צעד ארבע פעימות: Classic Fino (הקצב הקצר והמדויק ביותר — כמעט לא רואים תנועת גוף), Paso Corto (צעד בינוני לרכיבת שטח), ו-Paso Largo (הצעד המורחב והמהיר ביותר). ה-Classic Fino הוא שיא האמנות — הסוס נע בצעדים כה קטנים וקצביים שנראה כאילו הוא רועד על המקום. במבחן ה-'Fino Board' הסוס צועד על לוח עץ ונשפט לפי הקצב והדיוק של הפרסות.",
    gaits: ["Classic Fino", "Paso Corto", "Paso Largo"],
    gaitType: "singlefoot",
    dmrt3: "AA — הומוזיגוטי. צעד טבעי חזק ויציב מלידה. כמעט 100% מהגזע נושאים שני עותקים.",
    dmrt3Genotype: "AA",
    temperament: "רגוע, חברותי, קל לאימון. מתאים למתחילים ומקצוענים כאחד. מכונה 'los caballos de paso fino'.",
    history: "מקורו בסוסים שהובאו לאמריקה על ידי הספרדים במאה ה-16. שילוב של סוסי ברבר, אנדלוסי וג'נט ספרדי (Spanish Jennet). התפתח במקביל בקולומביה ובפורטו ריקו.",
    characteristics: ["צעד 4 פעימות מושלם", "3 מהירויות של אותו צעד", "נוחות רכיבה יוצאת דופן", "קומפקטי וחזק", "Classic Fino — דיוק מוחלט"],
    image: pasoFinoImg,
    color: "from-amber-600 to-amber-800",
    category: "world",
    heightRange: "135-150 ס\"מ",
    weightRange: "360-450 ק\"ג",
    lifespan: "25-35 שנה",
    primaryGait: "Paso Fino",
    rideComfort: 5,
    trailSuitability: 4,
    showSuitability: 5,
  },
  {
    id: "peruvian-paso",
    nameHe: "פרואני פאסו",
    nameEn: "Peruvian Paso",
    origin: "פרו",
    originEn: "Peru",
    description: "סוס לאומי של פרו עם צעד Paso Llano ותנועת Termino ייחודית — סיבוב כלפי חוץ של הרגליים הקדמיות.",
    descriptionLong: "הפרואני פאסו הוא מוצר של 400 שנות סלקציה קפדנית בפרו. הוא נחשב לסוס הלאומי ומוגן בחוק. שני מאפיינים ייחודיים: 1) ה-Paso Llano — צעד ארבע פעימות שוות עם תחושת 'גלישה' חלקה, ו-2) ה-Termino — תנועה ייחודית של הרגליים הקדמיות שמסתובבות כלפי חוץ בזמן התנופה (כמו שחיין שעושה ברסט). ה-Termino הוא לא 'פגם' אלא תכונה רצויה שמעידה על גמישות כתף יוצאת דופן. סוג נוסף: Sobreandando (מהיר יותר) ו-Huachano (עם נטייה צדית).",
    gaits: ["Paso Llano", "Sobreandando", "Huachano"],
    gaitType: "lateral",
    dmrt3: "AA — גנוטיפ הומוזיגוטי מבטיח צעד יציב ועקבי. הסלקציה ב-400 שנה ייצבה את התכונה.",
    dmrt3Genotype: "AA",
    temperament: "גאה, אצילי, רגוע. ביטחון עצמי גבוה עם רגישות גבוהה לרוכב. נדרשת יד עדינה.",
    history: "מקורו בסוסים ספרדיים שהובאו לפרו במאה ה-16. עבר סלקציה קפדנית של 400 שנה בחסידנוסים הפרואניים. מוכר כ'אוצר לאומי' ומוגן בחוק פרואני.",
    characteristics: ["תנועת Termino ייחודית", "Paso Llano — 4 פעימות שוות", "אצילות ונוכחות מרשימה", "רעמה ארוכה וזורמת", "400 שנות רביה סלקטיבית"],
    image: peruvianPasoImg,
    color: "from-yellow-700 to-amber-900",
    category: "world",
    heightRange: "142-155 ס\"מ",
    weightRange: "380-490 ק\"ג",
    lifespan: "25-30 שנה",
    primaryGait: "Paso Llano",
    rideComfort: 5,
    trailSuitability: 4,
    showSuitability: 5,
  },
  {
    id: "missouri-fox-trotter",
    nameHe: "מיזורי פוקס טרוטר",
    nameEn: "Missouri Fox Trotter",
    origin: "מיזורי, ארה\"ב",
    originEn: "Missouri, USA",
    description: "ידוע בצעד ה-Fox Trot — הרגליים הקדמיות הולכות והאחוריות רצות, מה שיוצר תנועה חלקה עם 'החלקה' בנחיתה.",
    descriptionLong: "המיזורי פוקס טרוטר הוא סוס הרים מאוזארקס שפותח לעבודה בשטח הררי קשה. הצעד הייחודי שלו — Fox Trot — הוא שילוב מרתק: הרגליים הקדמיות 'הולכות' (flat walk) בעוד הרגליים האחוריות 'רצות' (trot-like action). התוצאה: הרגל האחורית 'מחליקה' כשהיא נוחתת (sliding action) במקום להכות בקרקע, מה שמייצר רכיבה חלקה ויציבה במיוחד בשטח לא ישר. זהו לא 4-beat מושלם אלא 'broken diagonal' — שבירה של הטרוט האלכסוני עם השהיה קלה.",
    gaits: ["Flat Walk", "Fox Trot", "Canter"],
    gaitType: "diagonal",
    dmrt3: "CA/AA — הטרוזיגוטיות (CA) מאפשרת את שילוב התנועה הייחודי. חלק מהפרטים הומוזיגוטיים (AA).",
    dmrt3Genotype: "AA/CA",
    temperament: "ידידותי, קל לאימון, מסור. מצוין לרכיבת שטח ארוכה. סוס 'שקט' שמתאים למשפחות.",
    history: "פותח במאה ה-19 על ידי מתיישבים בהרי אוזארק שם הם נזקקו לסוס יציב בשטח הררי. שילוב של ערבי, מורגן, סטנדרדברד וסוסי צעד ספרדיים. הוכר רשמית ב-1948.",
    characteristics: ["Fox Trot ייחודי עם sliding", "יציבות מעולה בשטח הררי", "סיבולת גבוהה", "מזג שקט ומאוזן", "broken diagonal — לא טרוט ולא walk"],
    image: missouriFoxTrotterImg,
    color: "from-orange-700 to-red-900",
    category: "world",
    heightRange: "142-163 ס\"מ",
    weightRange: "400-540 ק\"ג",
    lifespan: "20-30 שנה",
    primaryGait: "Fox Trot",
    rideComfort: 4,
    trailSuitability: 5,
    showSuitability: 3,
  },
  {
    id: "mangalarga-marchador",
    nameHe: "מנגלרגה מרשדור",
    nameEn: "Mangalarga Marchador",
    origin: "ברזיל",
    originEn: "Brazil",
    description: "הגזע הלאומי של ברזיל עם שני סוגי Marcha — Batida (אלכסוני) ו-Picada (לטרלי). אתלטי ועמיד בחום.",
    descriptionLong: "המנגלרגה מרשדור הוא הגזע הלאומי של ברזיל ואחד מגזעי הצעד הגדולים בעולם (מעל 600,000 סוסים רשומים). הייחוד שלו: שני סוגי צעד שונים מאותו גזע. Marcha Batida — צעד עם נטייה אלכסונית (diagonal-biased), רגע קצר של תמיכה אלכסונית. Marcha Picada — צעד עם נטייה לטרלית (lateral-biased), חלק יותר אך פחות יציב. שני הסוגים הם ארבע פעימות ללא ריחוף. הגנטיקה קובעת: סוסים עם AA נוטים ל-Picada, CC ל-Batida, ו-CA יכולים להציג את שניהם.",
    gaits: ["Marcha Batida", "Marcha Picada", "Walk", "Canter"],
    gaitType: "mixed",
    dmrt3: "AA/CA — וריאציות גנטיות שמאפשרות שני סוגי מרשה. AA → Picada, CC → Batida, CA → שניהם.",
    dmrt3Genotype: "AA/CA",
    temperament: "חיוני, חכם, מסור. אתלטי עם יכולת עבודה גבוהה. מותאם לאקלים חם וטרופי.",
    history: "פותח במאה ה-19 מתוך הכלאה בין סוסי Alter Real פורטוגזיים (שמקורם באנדלוסי) לסוסים מקומיים ברזילאיים. הוכר רשמית ב-1949.",
    characteristics: ["שני סוגי Marcha", "סיבולת יוצאת דופן בחום", "התאמה לאקלים טרופי", "מבנה אתלטי וקל", "הגזע הגדול בעולם (600K+)"],
    image: mangalargaMarchadorImg,
    color: "from-emerald-700 to-teal-900",
    category: "world",
    heightRange: "148-157 ס\"מ",
    weightRange: "400-500 ק\"ג",
    lifespan: "25-30 שנה",
    primaryGait: "Marcha",
    rideComfort: 4,
    trailSuitability: 5,
    showSuitability: 3,
  },
  {
    id: "andalusian",
    nameHe: "אנדלוסי (PRE)",
    nameEn: "Andalusian / PRE",
    origin: "ספרד",
    originEn: "Spain",
    description: "סוס ספרדי עתיק עם איסוף טבעי מרשים. חלק מהפרטים מפגינים Paso de Andadura — פייס איטי וחלק.",
    descriptionLong: "האנדלוסי — או בשמו הרשמי Pura Raza Española (PRE) — הוא אחד הגזעים העתיקים והמשפיעים ביותר בהיסטוריה. זהו אב קדמון של רוב גזעי הצעד בעולם: פאסו פינו, פרואני פאסו, מנגלרגה מרשדור ואחרים ירשו ממנו את הגנים לתנועות מיוחדות. למרות שהאנדלוסי המודרני אינו 'סוס צעד' קלאסי (רובם CC), פרטים בודדים נושאים CA ומפגינים Paso de Andadura — צעד צדי איטי וחלק שזכר של תנועות אבותיו. האנדלוסי מצטיין בדרסאז' בזכות האיסוף הטבעי המרשים.",
    gaits: ["Walk", "Trot", "Canter", "Paso de Andadura"],
    gaitType: "mixed",
    dmrt3: "CC/CA — רוב האנדלוסים ללא מוטציה (CC). פרטים בודדים נושאים CA ומפגינים ambling gaits — זכר לגנים שעברו לצאצאי הגזע.",
    dmrt3Genotype: "CC",
    temperament: "אצילי, חכם, רגיש ורב-הבעה. מצטיין בדרסאז' ותנועות אקדמיות. קשר עמוק עם הרוכב.",
    history: "אחד הגזעים העתיקים ביותר, ידוע כבר מהמאה ה-15. סוס המלוכה של ספרד. אב קדמון לגזעים רבים כולל פאסו פינו, פרואני פאסו, ליפיצאנר ולוסיטאנו. Pura Raza Española (PRE) הוא השם הרשמי מ-2011.",
    characteristics: ["איסוף טבעי מרשים", "תנועה מרוממת ואקספרסיבית", "אב קדמון של גזעי צעד רבים", "מבנה קומפקטי וחזק", "רעמה וזנב ארוכים ועבים"],
    image: andalusianImg,
    color: "from-neutral-600 to-stone-800",
    category: "world",
    heightRange: "155-165 ס\"מ",
    weightRange: "400-510 ק\"ג",
    lifespan: "25-35 שנה",
    primaryGait: "Collected Trot",
    rideComfort: 3,
    trailSuitability: 3,
    showSuitability: 5,
  },
];

/** Get breeds by category */
export function getBreedsByCategory(category: Breed["category"]): Breed[] {
  return breeds.filter((b) => b.category === category);
}

/** Category metadata */
export const BREED_CATEGORIES = [
  {
    key: "core" as const,
    labelHe: "גזעי סינגלפוט מובילים",
    labelEn: "Core Singlefoot Breeds",
    descHe: "גזעים עם צעד סינגלפוט / ראק טבעי — הליבה של עולם סוסי הצעד",
    descEn: "Breeds with natural singlefoot/rack gait — the core of gaited horses",
    icon: "⭐",
  },
  {
    key: "standardbred" as const,
    labelHe: "סטנדרדברד — פייסר וטרוטר",
    labelEn: "Standardbred — Pacer & Trotter",
    descHe: "שני תתי-הגזעים של הסטנדרדברד: צעד צדי (פייס) מול צעד אלכסוני (טרוט)",
    descEn: "Two sub-breeds: lateral pace vs diagonal trot",
    icon: "🏇",
  },
  {
    key: "world" as const,
    labelHe: "גזעי צעד מהעולם",
    labelEn: "World Gaited Breeds",
    descHe: "גזעים מכל רחבי העולם עם צעדים ייחודיים — מאיסלנד ועד ברזיל",
    descEn: "Breeds from around the world with unique gaits",
    icon: "🌍",
  },
];
