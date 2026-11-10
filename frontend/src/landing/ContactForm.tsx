import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mailtoLink } from './projects';

// The 3D modal styles the form via landing.css (vx-*); the 2D page uses Tailwind utilities.
const STYLES = {
  vx: { form: 'vx-form', label: '', input: '', button: 'vx-btn primary' },
  lite: {
    form: 'grid gap-3 rounded-[20px] bg-paper p-5 text-ink sm:p-6',
    label: 'grid gap-1 text-[13px] font-semibold',
    input: 'w-full rounded-[10px] border border-stone-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20',
    button: 'mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-paper transition hover:bg-teal-700',
  },
};

/** No backend: opens the visitor's mail app with the message pre-filled. */
export function ContactForm({ lite = false }: { lite?: boolean }) {
  const [form, setForm] = useState({ name: '', org: '', need: '' });
  const c = lite ? STYLES.lite : STYLES.vx;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = `Halo Vertinova,\n\nNama: ${form.name}\nInstansi/Organisasi: ${form.org}\n\nKebutuhan:\n${form.need}\n`;
    window.location.href = mailtoLink(`Konsultasi project — ${form.org || form.name}`, body);
  };
  return (
    <form className={c.form} onSubmit={submit}>
      <label className={c.label}>
        Nama
        <input className={c.input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
      </label>
      <label className={c.label}>
        Instansi / perusahaan
        <input className={c.input} value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} autoComplete="organization" />
      </label>
      <label className={c.label}>
        Kebutuhan Anda
        <textarea
          className={`${c.input} resize-y`}
          required
          rows={3}
          value={form.need}
          onChange={(e) => setForm({ ...form, need: e.target.value })}
          placeholder="Mis. sistem informasi, aplikasi internal, website & pemesanan online…"
        />
      </label>
      <button className={c.button} type="submit">
        Kirim lewat email <ArrowRight size={16} />
      </button>
    </form>
  );
}
