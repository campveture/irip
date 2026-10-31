import { useState, type FormEvent } from 'react';
import { Sheet } from '../shared/Sheet';
import { label, type Application, type Opportunity } from './types';
import { fieldClass, primaryClass, secondaryClass } from './ProfileForm';

export function ApplicationEditor({ item, application, states, busy, error, onClose, onSave, onRemove }: {
  item: Opportunity; application: Application; states: string[]; busy: boolean; error: string; onClose: () => void;
  onSave: (value: Pick<Application, 'state' | 'personal_deadline' | 'notes'>) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const [state, setState] = useState(application.state);
  const [date, setDate] = useState(application.personal_deadline || '');
  const [notes, setNotes] = useState(application.notes);
  const [removing, setRemoving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onSave({ state, personal_deadline: date || null, notes })) onClose();
  }
  return <Sheet open title="Update tracked application" onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={submit} className="space-y-5">
      <h3 className="text-xl font-semibold text-brand-950">{item.name}</h3>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <p className="text-sm leading-6 text-slate-600">This is your own record. Marking “Submitted” does not send an application. A portal entry may cover multiple programmes; record the exact programme and intake in your notes.</p>
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <label className="block text-sm font-medium">Application status<select className={fieldClass} value={state} onChange={event => setState(event.target.value)}>{states.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="block text-sm font-medium">Personal reminder date<input type="date" min="1900-01-01" max="9999-12-31" className={fieldClass} value={date} onChange={event => setDate(event.target.value)} /><span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Not a provider deadline. No email or push reminder is sent.</span></label>
        <label className="block text-sm font-medium">Planning notes<textarea maxLength={1000} rows={5} className={fieldClass} value={notes} onChange={event => setNotes(event.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">{notes.length}/1,000 · No identity, financial or confidential information.</span></label>
      </fieldset>
      <div className="flex flex-wrap gap-2"><button disabled={busy} type="submit" className={primaryClass}>{busy ? 'Saving…' : 'Save tracker changes'}</button><button disabled={busy} type="button" className={secondaryClass} onClick={onClose}>Cancel</button></div>
      <div className="border-t border-slate-200 pt-4">{removing ? <><p className="mb-3 text-sm text-red-800">Remove this listing and its saved notes from your tracker?</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="min-h-11 text-sm font-semibold text-red-800" onClick={async () => { if (await onRemove()) onClose(); }}>Yes, remove listing</button><button type="button" disabled={busy} className={secondaryClass} onClick={() => setRemoving(false)}>Keep listing</button></div></> : <button type="button" disabled={busy} className="min-h-11 text-sm text-red-800 underline" onClick={() => setRemoving(true)}>Remove from tracker</button>}</div>
    </form>
  </Sheet>;
}
