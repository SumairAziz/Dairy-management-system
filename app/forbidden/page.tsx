"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import { routes } from "@/lib/routes";

export default function ForbiddenPage() {
  return (
    <>
      <Navbar title="Access Denied" subtitle="You do not have permission to view this page" />
      <div className="p-6 max-w-xl">
        <div className="surface border rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-red-400" />
            </div>
            <div>
              <h1 className="font-semibold">Forbidden</h1>
              <p className="text-sm muted mt-1">
                Your account does not have the required permission for this module. Contact an
                administrator if you believe this is a mistake.
              </p>
            </div>
          </div>
          <Link
            href={routes.dashboard}
            className="inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
