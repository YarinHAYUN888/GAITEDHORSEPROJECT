import { format, parseISO } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Language } from '@/data/marePregnancy';
export default function PregnancyDatePicker({value,onChange,label,lang,future=false,optional=false}:{value:string;onChange:(v:string)=>void;label:string;lang:Language;future?:boolean;optional?:boolean}) {
 return <div className="flex gap-1"><Popover><PopoverTrigger asChild><Button type="button" variant="outline" aria-label={label} className="min-h-11 w-full justify-start gap-2 font-normal"><CalendarIcon className="h-4 w-4 shrink-0"/>{value ? format(parseISO(value),'dd/MM/yyyy') : label}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={value?parseISO(value):undefined} defaultMonth={value?parseISO(value):new Date()} onSelect={date => onChange(date?format(date,'yyyy-MM-dd'):'')} disabled={future?undefined:{after:new Date()}} locale={lang==='he'?he:enUS} captionLayout="dropdown-buttons" fromYear={2000} toYear={new Date().getFullYear()+3} className="pointer-events-auto"/></PopoverContent></Popover>{optional && value && <Button variant="ghost" type="button" size="icon" className="min-h-11 min-w-11" onClick={()=>onChange('')} aria-label={lang==='he'?'נקה תאריך':'Clear date'}><X className="h-4 w-4"/></Button>}</div>;
}
