import { describe,it,expect } from 'vitest';
import { pregnancyProgress,pregnancyMilestones,milestoneState,pregnancySchema,examinationSchema,calendarFile } from '../marePregnancy';
import { format,parseISO } from 'date-fns';
describe('Evidence-based mare pregnancy rules',()=>{
 it('estimates foaling at 340 days without claiming exact birth',()=>{expect(format(pregnancyProgress('2026-01-01',null,parseISO('2026-10-26')).due,'yyyy-MM-dd')).toBe('2026-12-07');});
 it('respects veterinary estimated foaling date',()=>{expect(format(pregnancyProgress('2026-01-01','2026-12-11').due,'yyyy-MM-dd')).toBe('2026-12-11');});
 it('counts calendar days and uses late-gestation educational grouping',()=>{const p=pregnancyProgress('2026-01-01',null,parseISO('2026-10-26'));expect(p.day).toBe(298);expect(p.stageIndex).toBe(4);});
 it('keeps pregnancy and twin check in days 14–18',()=>{const m=pregnancyMilestones('2026-01-01',parseISO('2026-12-07'))[0];expect(format(m.start,'yyyy-MM-dd')).toBe('2026-01-15');expect(format(m.end,'yyyy-MM-dd')).toBe('2026-01-19');});
 it('keeps heartbeat check in days 25–30',()=>{const m=pregnancyMilestones('2026-01-01',parseISO('2026-12-07'))[1];expect(format(m.start,'yyyy-MM-dd')).toBe('2026-01-26');expect(format(m.end,'yyyy-MM-dd')).toBe('2026-01-31');});
 it.each([5,7,9])('uses calendar month %s for EHV rather than 30-day approximations',month=>{const m=pregnancyMilestones('2026-01-01',parseISO('2026-12-07')).find(m=>m.id===`ehv-${month}`);expect(m&&format(m.start,'yyyy-MM-dd')).toBe(`2026-${String(month+1).padStart(2,'0')}-01`);});
 it('places prefoaling vaccinations 4–6 weeks before due date',()=>{const m=pregnancyMilestones('2026-01-01',parseISO('2026-12-07')).at(-1);expect(m&&format(m.start,'yyyy-MM-dd')).toBe('2026-10-26');expect(m&&format(m.end,'yyyy-MM-dd')).toBe('2026-11-09');});
 it('marks overdue windows as past not completed',()=>{expect(milestoneState(parseISO('2026-01-15'),parseISO('2026-01-19'),parseISO('2026-01-20'))).toBe('past');});
 it('rejects future start date',()=>{expect(pregnancySchema.safeParse({breeding_date:'2099-01-01',date_basis:'breeding',expected_foaling_date:null,status:'suspected',veterinarian:'',notes:''}).success).toBe(false);});
 it('rejects due date preceding start',()=>{expect(pregnancySchema.safeParse({breeding_date:'2026-01-01',date_basis:'breeding',expected_foaling_date:'2025-12-01',status:'suspected',veterinarian:'',notes:''}).success).toBe(false);});
 it('rejects followup date preceding examination',()=>{expect(examinationSchema.safeParse({examination_date:'2026-01-10',examination_type:'ultrasound',findings:'Recorded by veterinarian',veterinarian:'',next_check_date:'2026-01-09'}).success).toBe(false);});
 it('exports calendar reminder on stored follow-up date with one-day alarm',()=>{const ics=calendarFile([{id:'exam-1',date:parseISO('2026-11-09'),title:'Mare follow-up'}]);expect(ics).toContain('DTSTART;VALUE=DATE:20261109');expect(ics).toContain('TRIGGER:-P1D');});
});
