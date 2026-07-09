import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { PageHeader, Section } from "@/components/ui";

export default function ModuleStub({
  icon: Icon,
  title,
  subtitle,
  description,
  features,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Section>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <Icon size={30} strokeWidth={2} />
          </span>
          <h2 className="mt-5 text-lg font-extrabold">მოდული მზადდება</h2>
          <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-2)" }}>
            {description}
          </p>
          <div className="mt-8 grid w-full max-w-lg gap-2 text-left">
            {features.map((f) => (
              <div
                key={f}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: "var(--surface-2)" }}
              >
                <CheckCircle2 size={17} style={{ color: "var(--primary)" }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
