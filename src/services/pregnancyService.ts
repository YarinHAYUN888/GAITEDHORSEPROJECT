import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { pregnancySchema, examinationSchema } from '@/data/marePregnancy';
export type Pregnancy = Tables<'mare_pregnancies'>;
export type Examination = Tables<'pregnancy_examinations'>;
export async function loadPregnancies(horseId:string) {
 const {data,error} = await supabase.from('mare_pregnancies').select('*').eq('horse_id',horseId).order('created_at',{ascending:false});
 if(error) throw error; return data ?? [];
}
export async function loadExaminations(pregnancyId:string) {
 const {data,error} = await supabase.from('pregnancy_examinations').select('*').eq('pregnancy_id',pregnancyId).order('examination_date',{ascending:false});
 if(error) throw error; return data ?? [];
}
export async function savePregnancy(horseId:string, values:unknown, id?:string) {
 const parsed = pregnancySchema.parse(values);
 if (!parsed.breeding_date) throw new Error('Pregnancy start required');
 const query = id ? supabase.from('mare_pregnancies').update(parsed).eq('id',id).eq('horse_id',horseId) : supabase.from('mare_pregnancies').insert({...parsed,breeding_date:parsed.breeding_date,horse_id:horseId});
 const {data,error} = await query.select().single(); if(error) throw error; return data;
}
export async function saveExamination(pregnancyId:string, values:unknown, id?:string) {
 const parsed = examinationSchema.parse(values);
 if (!parsed.examination_date || !parsed.examination_type) throw new Error('Examination date and type required');
 const query = id ? supabase.from('pregnancy_examinations').update(parsed).eq('id',id).eq('pregnancy_id',pregnancyId) : supabase.from('pregnancy_examinations').insert({...parsed,examination_date:parsed.examination_date,examination_type:parsed.examination_type,pregnancy_id:pregnancyId});
 const {data,error} = await query.select().single(); if(error) throw error; return data;
}
export async function deleteExamination(id:string) {
 const {error} = await supabase.from('pregnancy_examinations').delete().eq('id',id); if(error) throw error;
}
