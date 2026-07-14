import { type ReactNode } from "react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  phase?: string;
  children?: ReactNode;
}

export function PagePlaceholder({ title, description, phase, children }: PagePlaceholderProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="surface-card p-8 md:p-10">
        {phase && (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft text-accent-foreground px-3 py-1 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {phase}
          </div>
        )}
        <p className="text-muted-foreground max-w-prose">
          Halaman ini adalah kerangka fondasi. Fungsionalitas lengkap akan dibangun pada fase
          berikutnya sesuai brief.
        </p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
