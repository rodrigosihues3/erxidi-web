import { Card } from "../../../components/ui/Card";

export default function KpiCard({ title, value, helper, icon: Icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-brand-secondary">{title}</p>
          <p className="mt-2 text-2xl font-black text-brand-primary">{value}</p>
          {helper && <p className="mt-1 text-[11px] text-brand-muted">{helper}</p>}
        </div>
        {Icon && <div className="h-10 w-10 rounded-xl bg-surface-subtle flex items-center justify-center text-brand-primary"><Icon className="h-5 w-5" /></div>}
      </div>
    </Card>
  );
}
