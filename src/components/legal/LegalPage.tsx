import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="fx-legal">
      <Link to="/welcome">← Back</Link>
      <h1>{title}</h1>
      <p className="fx-legal-note">Last updated October 2026</p>
      {children}
    </main>
  );
}
