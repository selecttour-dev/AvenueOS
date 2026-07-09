"use client";

import { useState, useTransition } from "react";
import { Building2, Pencil, Plus, Check, ArrowRight } from "lucide-react";
import { setActiveVenue, createVenue, renameVenue } from "@/lib/actions";

type Venue = { id: number; name: string; capacity: number | null };

export default function VenuePicker({ venues }: { venues: Venue[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgb(109 94 252 / 0.10), transparent), var(--bg)",
      }}
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-white"
        style={{
          background: "linear-gradient(135deg, var(--primary) 0%, #9b8cff 100%)",
          boxShadow: "0 12px 32px -8px rgb(109 94 252 / 0.55)",
        }}
      >
        <Building2 size={30} strokeWidth={2} />
      </span>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">VenueOS</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
        აირჩიე ობიექტი, რომლითაც გინდა მუშაობა
      </p>

      <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {venues.map((v) => (
          <div key={v.id} className="card card-hover relative p-6">
            {editing === v.id ? (
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      startTransition(async () => {
                        await renameVenue(v.id, editName);
                        setEditing(null);
                      });
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
                <button
                  className="btn btn-primary !px-3"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await renameVenue(v.id, editName);
                      setEditing(null);
                    })
                  }
                >
                  <Check size={16} />
                </button>
              </div>
            ) : (
              <>
                <button
                  className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: "var(--text-3)" }}
                  onClick={() => {
                    setEditing(v.id);
                    setEditName(v.name);
                  }}
                  aria-label="სახელის შეცვლა"
                >
                  <Pencil size={15} />
                </button>
                <div className="text-lg font-extrabold">{v.name}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                  {v.capacity ? `${v.capacity} სტუმრამდე` : "დარბაზი"}
                </div>
                <button
                  className="btn btn-primary mt-5 w-full"
                  disabled={pending}
                  onClick={() => startTransition(() => setActiveVenue(v.id))}
                >
                  შესვლა <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        ))}

        {adding ? (
          <div className="card flex flex-col justify-center gap-3 p-6">
            <input
              className="input"
              placeholder="ახალი ობიექტის სახელი"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  startTransition(async () => {
                    await createVenue(newName);
                    setNewName("");
                    setAdding(false);
                  });
                }
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1"
                disabled={pending || !newName.trim()}
                onClick={() =>
                  startTransition(async () => {
                    await createVenue(newName);
                    setNewName("");
                    setAdding(false);
                  })
                }
              >
                დამატება
              </button>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>
                გაუქმება
              </button>
            </div>
          </div>
        ) : (
          <button
            className="card card-hover flex min-h-[172px] flex-col items-center justify-center gap-2 border-dashed p-6"
            style={{ borderStyle: "dashed", color: "var(--text-3)" }}
            onClick={() => setAdding(true)}
          >
            <Plus size={22} />
            <span className="text-sm font-semibold">ახალი ობიექტი</span>
          </button>
        )}
      </div>
    </main>
  );
}
