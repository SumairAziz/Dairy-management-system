"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, KeyRound, LogOut, User, Mail } from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls } from "@/app/components/modal";
import { useTheme } from "@/app/context/theme-context";
import { useAuth, useChangePassword, useLogout } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { SettingsAdminNav } from "@/app/settings/components/SettingsAdminNav";
import { changePasswordSchema } from "@/validators/auth.validator";

function ThemeOption({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-600/20"
          : "surface border hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, isLoading } = useAuth();
  const { role } = usePermissions();
  const logoutMutation = useLogout();
  const changePasswordMutation = useChangePassword();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  function resetPasswordForm() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordErrors({});
    setPasswordMessage(null);
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => router.push("/login"),
    });
  }

  function handleChangePassword() {
    setPasswordErrors({});
    setPasswordMessage(null);

    const parsed = changePasswordSchema.safeParse(passwordForm);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !next[key]) next[key] = issue.message;
      }
      setPasswordErrors(next);
      return;
    }

    changePasswordMutation.mutate(parsed.data, {
      onSuccess: () => {
        setPasswordMessage("Password updated successfully.");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        window.setTimeout(() => {
          setPasswordOpen(false);
          resetPasswordForm();
        }, 1200);
      },
      onError: (err) => {
        setPasswordMessage(err.message || "Unable to change password.");
      },
    });
  }

  return (
    <>
      <Navbar title="Settings" subtitle="Appearance and account preferences" />
      <div className="p-6 max-w-2xl space-y-6">
        {/* Appearance */}
        <section className="surface border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-sm muted mt-1">
              Choose how TerraDairy looks. This uses the same theme as the header toggle.
            </p>
          </div>
          <div className="border-t border-black/5 dark:border-white/10 pt-4 space-y-3">
            <div className="text-xs uppercase tracking-wider muted">Theme</div>
            <div className="flex flex-wrap gap-2">
              <ThemeOption
                active={theme === "dark"}
                label="Dark Mode"
                icon={<Moon size={14} />}
                onClick={() => setTheme("dark")}
              />
              <ThemeOption
                active={theme === "light"}
                label="Light Mode"
                icon={<Sun size={14} />}
                onClick={() => setTheme("light")}
              />
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="surface border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Account</h2>
            <p className="text-sm muted mt-1">Your signed-in user details.</p>
          </div>
          <div className="border-t border-black/5 dark:border-white/10 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider muted">Name</div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User size={14} className="muted shrink-0" />
                  {isLoading ? "Loading…" : (user?.name ?? "—")}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider muted">Email</div>
                <div className="flex items-center gap-2 text-sm font-medium break-all">
                  <Mail size={14} className="muted shrink-0" />
                  {isLoading ? "Loading…" : (user?.email ?? "—")}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <div className="text-xs uppercase tracking-wider muted">Role</div>
                <div className="text-sm font-medium">
                  {isLoading ? "Loading…" : role?.replace(/_/g, " ") ?? "—"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  resetPasswordForm();
                  setPasswordOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
              >
                <KeyRound size={14} />
                Change Password
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-60"
              >
                <LogOut size={14} />
                {logoutMutation.isPending ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>
        </section>

        <SettingsAdminNav />
      </div>

      <Modal
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          resetPasswordForm();
        }}
        title="Change Password"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setPasswordOpen(false);
                resetPasswordForm();
              }}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-black/5 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-60"
            >
              {changePasswordMutation.isPending ? "Saving…" : "Update Password"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Current Password">
            <input
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
              }
            />
            {passwordErrors.currentPassword && (
              <p className="text-xs text-red-500 mt-1">{passwordErrors.currentPassword}</p>
            )}
          </Field>
          <Field label="New Password">
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
              }
            />
            {passwordErrors.newPassword && (
              <p className="text-xs text-red-500 mt-1">{passwordErrors.newPassword}</p>
            )}
          </Field>
          <Field label="Confirm New Password">
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
            />
            {passwordErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{passwordErrors.confirmPassword}</p>
            )}
          </Field>
          {passwordMessage && (
            <p
              className={`text-sm ${
                passwordMessage.includes("successfully")
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500"
              }`}
            >
              {passwordMessage}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
