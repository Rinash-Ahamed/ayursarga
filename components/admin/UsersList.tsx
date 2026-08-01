"use client";

import { useEffect, useState } from "react";
import type { UserDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { listUsers } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function UsersList() {
  const [items, setItems] = useState<DocumentRecord<UserDocument>[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listUsers({ pageSize: 20 }).then((page) => setItems(page.documents as DocumentRecord<UserDocument>[])).catch(() => setError("Users could not be loaded.")); }, []);
  return <PortalShell role="admin" title="Users"><p className="portal-empty" style={{ marginBottom: 20 }}>Hospital and admin accounts are provisioned through the controlled Admin SDK script, never public registration.</p><PortalFeedback error={error} empty={!error && items.length === 0 ? "No users are available." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}><div><h3>{item.name}</h3><p>{item.email}{item.hospitalId ? ` · Hospital ${item.hospitalId}` : ""}</p></div><span className="portal-status">{item.role} · {item.status}</span></article>)}</div></PortalShell>;
}
