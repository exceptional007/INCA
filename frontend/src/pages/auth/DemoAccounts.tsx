import { useState } from 'react';
import { ArrowUpRight, Check, Copy, GraduationCap, ShieldCheck, Users } from 'lucide-react';

interface DemoAccount { name: string; email: string; password: string }

// Intentionally public, isolated demo credentials. Publication approved by the owner.
const groups = [
  { title: 'Admin / HOD', icon: ShieldCheck, accounts: [
    { name: 'Admin / HOD', email: 'shashank253@bit.ac.in', password: 'Shashank@1234' },
  ] },
  { title: 'Faculty', icon: Users, accounts: [
    { name: 'Shivam Sir', email: 'shivam32@bit.ac.in', password: 'Shivam@12344' },
    { name: 'Krishna Sir', email: 'krishna43@bit.ac.in', password: 'Krishna@1234' },
    { name: 'Ranjeet Sir', email: 'ranjeet12@bit.ac.in', password: 'Password123!' },
  ] },
  { title: 'Students', icon: GraduationCap, accounts: [
    { name: 'Krishna', email: 'bit23ds02@bit.ac.in', password: 'Krishna@1234' },
    { name: 'Shubham', email: 'bit23ds83@bit.ac.in', password: 'Shubham@1234' },
  ] },
];

export function DemoAccounts({ onSelect, disabled }: { onSelect: (account: DemoAccount) => void; disabled: boolean }) {
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState('');
  const copy = async (value: string, id: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id); setStatus(`${label} copied.`);
    } catch {
      setCopied(''); setStatus('Copy is unavailable in this browser. Select the displayed text to copy it.');
    }
  };
  return <section aria-labelledby="demo-accounts-heading" className="mt-7 space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div>
      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">Explore INCA</span>
      <h2 id="demo-accounts-heading" className="mt-3 text-lg font-semibold tracking-tight">Demo accounts</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose an account to explore the different campus roles. These credentials are shared publicly for demo access.</p>
    </div>
    {groups.map(group => <div key={group.title} className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><group.icon className="size-4 text-primary" />{group.title}</h3>
      <div className="space-y-3">{group.accounts.map(account => <article key={account.email} aria-label={`${account.name} demo account`} className="min-w-0 rounded-xl border border-border bg-secondary/25 p-3.5 sm:p-4">
        <h4 className="text-sm font-semibold">{account.name}</h4>
        <dl className="mt-3 space-y-3">{[
          { label: 'Institutional Email', value: account.email, kind: 'email' },
          { label: 'Password', value: account.password, kind: 'password' },
        ].map(field => {
          const id = `${account.email}-${field.kind}`;
          return <div key={field.kind} className="min-w-0">
            <dt className="text-[10px] font-medium text-muted-foreground">{field.label}</dt>
            <dd className="mt-1 flex min-w-0 items-start justify-between gap-2">
              <code className="min-w-0 select-text break-all pt-1.5 text-xs leading-relaxed text-foreground">{field.value}</code>
              <button type="button" onClick={() => void copy(field.value, id, field.label)} aria-label={`Copy ${account.name} ${field.kind}`} className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{copied === id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}</button>
            </dd>
          </div>;
        })}</dl>
        <button type="button" disabled={disabled} onClick={() => { onSelect(account); setStatus(`${account.name} credentials filled. Select Sign In to continue.`); }} aria-label={`Use ${account.name} demo account`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Use this account<ArrowUpRight className="size-3.5" /></button>
      </article>)}</div>
    </div>)}
    <p role="status" className="min-h-8 text-xs leading-relaxed text-muted-foreground">{status || 'Use this account fills the form above. You choose when to sign in.'}</p>
  </section>;
}
