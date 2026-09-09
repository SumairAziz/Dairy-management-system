"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { usePermissions } from "@/hooks/use-permissions";

const ADMIN_LINKS = [
  { href: routes.settingsUsers, label: "Users", permission: "users.view" },
  { href: routes.settingsRoles, label: "Roles & Permissions", permission: "roles.view" },
] as const;

export function SettingsAdminNav() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const links = ADMIN_LINKS.filter((link) => can(link.permission));

  if (links.length === 0) return null;

  return (
    <div className="surface border rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Administration</h2>
        <p className="text-sm muted mt-1">Manage users and role permissions.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              pathname === link.href
                ? "bg-brand-600 text-white border-brand-600"
                : "surface hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
