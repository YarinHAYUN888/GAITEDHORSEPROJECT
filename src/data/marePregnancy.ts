import { addDays, addMonths, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';
export type Language = 'he' | 'en';
export const words = (lang: Language, he: string, en: string) => lang === 'he' ? he : en;
export const pregnancySources = [
 { title: 'Merck Veterinary Manual · Pregnancy determination', url: 'https://www.merckvetmanual.com/management-and-nutrition/management-of-reproduction-horses/pregnancy-determination-in-horses' },
 { title: 'University of Georgia · Gestation in the mare', url: 'https://fieldreport.caes.uga.edu/publications/B1461/understanding-gestation-in-the-mare-and-the-potential-for-problems/' },
 { title: 'Colorado State University · Vaccination schedule', url: 'https://vetmedbiosci.colostate.edu/erl/2023/10/02/vaccination-schedule-for-pregnant-mares/' },
 { title: 'AAEP · Vaccination and passive transfer', url: 'https://aaep.org/guidelines-resources/vaccination-guidelines/vaccination-and-passive-transfer/' },
 { title: 'Merck · Perinatal mare and foal care', url: 'https://www.merckvetmanual.com/management-and-nutrition/preventative-health-care-and-husbandry-of-horses/perinatal-mare-and-foal-care' },
 { title: 'CSU · Placentitis', url: 'https://vetmedbiosci.colostate.edu/erl/2025/01/29/placentitis-in-mares/' },
 { title: 'CSU · Red bag emergency', url: 'https://vetmedbiosci.colostate.edu/erl/2025/01/06/red-bag-in-horses/' },
 { title: 'Merck · Retained placenta', url: 'https://www.merckvetmanual.com/horse-owners/reproductive-disorders-of-horses/retained-placenta-in-horses' },
 { title: 'Purdue · Mare gestation (340-day average)', url: 'https://www.extension.purdue.edu/extmedia/VA/VA-26-W.pdf' },
];
const dateString = z.string().refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && isValid(parseISO(v)), 'Invalid date');
export const pregnancySchema = z.object({
 breeding_date: dateString.refine(v => parseISO(v) <= startOfDay(new Date()), 'Start date cannot be in the future'),
 date_basis: z.enum(['breeding','ovulation']),
 expected_foaling_date: dateString.nullable(),
 status: z.enum(['suspected','confirmed','foaled','lost']),
 veterinarian: z.string().max(200), notes: z.string().max(4000),
}).refine(v => !v.expected_foaling_date || v.expected_foaling_date > v.breeding_date, 'Expected foaling must follow start');
export const examinationSchema = z.object({
 examination_date: dateString.refine(v => parseISO(v) <= startOfDay(new Date()), 'Completed examination cannot be in the future'),
 examination_type: z.enum(['ultrasound','vaccination','checkup','other']),
 findings: z.string().trim().min(1).max(4000), veterinarian: z.string().max(200), next_check_date: dateString.nullable(),
}).refine(v => !v.next_check_date || v.next_check_date >= v.examination_date, 'Next check must follow examination');
export const stages = [
 { start: 0, end: 16, image: 0, he: 'תחילת ההריון', en: 'Early pregnancy', detailHe: 'הקונספטוס מגיע לרחם סביב יום 6, נע בתוכו ומתמקם סביב יום 16.', detailEn: 'The conceptus enters the uterus around day 6, moves within it and fixes around day 16.' },
 { start: 17, end: 34, image: 0, he: 'התפתחות העובר', en: 'Embryo development', detailHe: 'דופק ניתן בדרך כלל לזיהוי באולטרסאונד סביב ימים 24–25. רק בדיקה יכולה לאשר זאת.', detailEn: 'A heartbeat can usually be visualized by ultrasound around days 24–25. Only an examination can confirm this.' },
 { start: 35, end: 60, image: 0, he: 'התבססות והתמיינות', en: 'Attachment & differentiation', detailHe: 'סביב ימים 35–40 מתפתחים גביעי רירית הרחם; סביב יום 60 ניתן להבחין במבנים באולטרסאונד.', detailEn: 'Endometrial cups develop around days 35–40; around day 60, anatomical structures can be distinguished on ultrasound.' },
 { start: 61, end: 239, image: 1, he: 'גדילה במהלך ההריון', en: 'Continued growth', detailHe: 'העובר ממשיך להתפתח. הגיל לבדו אינו מאשר בריאות או התפתחות תקינה; ממשיכים במעקב וטרינרי.', detailEn: 'The fetus continues to develop. Age alone does not establish health or normal development; continue veterinary follow-up.' },
 { start: 240, end: 309, image: 2, he: 'גדילה מאוחרת', en: 'Late gestation growth', detailHe: 'בשלושת החודשים האחרונים יש גדילה משמעותית ועלייה בצרכים התזונתיים. הגבול המוצג הוא חלוקה חינוכית משוערת.', detailEn: 'The last three months bring substantial growth and increased nutritional demands. This boundary is an approximate educational grouping.' },
 { start: 310, end: Infinity, image: 2, he: 'לקראת המלטה', en: 'Preparing to foal', detailHe: 'מכינים סביבת המלטה ומעקב צמוד. יום ההריון אינו מוכיח בשלות ואינו מנבא את מועד ההמלטה.', detailEn: 'Prepare the foaling environment and close observation. Gestational age does not prove maturity or predict the day of foaling.' },
];
export function pregnancyProgress(start: string, override?: string | null, today = new Date()) {
 const base = parseISO(start);
 const day = differenceInCalendarDays(today, base);
 const due = override ? parseISO(override) : addDays(base, 340);
 return { day, due, remaining: differenceInCalendarDays(due, today), stageIndex: Math.max(0, stages.findIndex(s => day >= s.start && day <= s.end)) };
}
export function pregnancyMilestones(start: string, due: Date) {
 const base = parseISO(start);
 return [
  { id:'early-scan', start:addDays(base,14), end:addDays(base,18), he:'אולטרסאונד: הריון ותאומים', en:'Ultrasound: pregnancy & twins', source:0 },
  { id:'heartbeat', start:addDays(base,25), end:addDays(base,30), he:'בדיקת דופק והתפתחות', en:'Heartbeat & development check', source:0 },
  { id:'followup', start:addDays(base,40), end:addDays(base,60), he:'בדיקת המשכיות ההריון', en:'Ongoing pregnancy check', source:0 },
  ...[5,7,9].map(month => ({ id:`ehv-${month}`, start:addMonths(base,month), end:addDays(addMonths(base,month),7), he:`חודש ${month}: תיאום חיסון EHV-1`, en:`Month ${month}: discuss EHV-1 vaccination`, source:2 })),
  { id:'prefoaling', start:addDays(due,-42), end:addDays(due,-28), he:'חיסונים לקראת המלטה לפי הווטרינר', en:'Veterinarian-planned prefoaling vaccines', source:3 },
 ];
}
export function milestoneState(start: Date, end: Date, today = new Date()) {
 const now = startOfDay(today);
 return now < startOfDay(start) ? 'upcoming' : now > startOfDay(end) ? 'past' : 'due';
}
export function calendarFile(events: Array<{id:string; date:Date; title:string}>) {
 const escape = (s:string) => s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const stamp = format(new Date(),'yyyyMMdd') + 'T000000Z';
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GaitGenius//Mare pregnancy//EN',...events.flatMap(e => ['BEGIN:VEVENT',`UID:${e.id}@gaitgenius`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${format(e.date,'yyyyMMdd')}`,`DTEND;VALUE=DATE:${format(addDays(e.date,1),'yyyyMMdd')}`,`SUMMARY:${escape(e.title)}`,'DESCRIPTION:Educational reminder. Confirm timing with your veterinarian.','BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Pregnancy follow-up','END:VALARM','END:VEVENT']),'END:VCALENDAR'].join('\r\n');
}
