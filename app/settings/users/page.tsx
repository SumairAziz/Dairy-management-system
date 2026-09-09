"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Shield, UserCog } from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import { Modal, Field, inputCls, ConfirmModal } from "@/app/components/modal";
import { SettingsAdminNav } from "@/app/settings/components/SettingsAdminNav";
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from "@/hooks/use-users";
import { ASSIGNABLE_ROLES } from "@/lib/rbac/permissions";
import { routes } from "@/lib/routes";
import type { Role } from "@/types";

function formatRole(role: Role) {
  return role.replace(/_/g, " ");
}

export default function SettingsUsersPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "FARM_WORKER" as Role,
    is_active: true,
  });
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const { data: users = [], isLoading } = useUsers(search);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const resetMutation = useResetUserPassword();
  const deleteMutation = useDeleteUser();

  const editingUser = useMemo(
    () => users.find((user) => user.user_id === editId) ?? null,
    [users, editId],
  );

  function openCreate() {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "FARM_WORKER",
      is_active: true,
    });
    setMessage(null);
    setCreateOpen(true);
  }

  function openEdit(userId: number) {
    const user = users.find((entry) => entry.user_id === userId);
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
    setMessage(null);
    setEditId(userId);
  }

  async function handleCreate() {
    try {
      await createMutation.mutateAsync({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        is_active: form.is_active,
      });
      setCreateOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create user.");
    }
  }

  async function handleEdit() {
    if (!editId) return;
    try {
      await updateMutation.mutateAsync({
        id: editId,
        data: {
          name: form.name,
          email: form.email,
          role: form.role,
          is_active: form.is_active,
        },
      });
      setEditId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user.");
    }
  }

  async function handleResetPassword() {
    if (!resetId) return;
    try {
      await resetMutation.mutateAsync({ id: resetId, password: resetPassword });
      setResetId(null);
      setResetPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password.");
    }
  }

  return (
    <>
      <Navbar title="User Management" subtitle="Administration · Users" />
      <div className="p-6 space-y-6 max-w-6xl">
        <Link
          href={routes.settings}
          className="inline-flex items-center gap-2 text-sm muted hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        <SettingsAdminNav />

        <div className="surface border rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <UserCog size={16} /> Users
              </h1>
              <p className="text-sm muted mt-1">Create, edit, activate, and assign roles.</p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              <Plus size={14} /> New User
            </button>
          </div>

          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-sm">
              <thead className="border-b bg-black/[0.02] dark:bg-white/[0.03]">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center muted">
                      Loading users…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.user_id} className="border-t border-black/5 dark:border-white/10">
                      <td className="px-3 py-3 font-medium">{user.name}</td>
                      <td className="px-3 py-3">{user.email}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 text-xs">
                          <Shield size={12} />
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {user.is_active ? (
                          <span className="text-emerald-400">Active</span>
                        ) : (
                          <span className="text-red-400">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end flex-wrap gap-2">
                          <button
                            onClick={() => openEdit(user.user_id)}
                            className="px-2.5 py-1.5 rounded-lg border text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setResetPassword("");
                              setResetId(user.user_id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border text-xs"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => setDeleteId(user.user_id)}
                            className="px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create User"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg border">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white"
            >
              {createMutation.isPending ? "Creating…" : "Create User"}
            </button>
          </>
        }
      >
        <UserFormFields form={form} setForm={setForm} includePassword message={message} />
      </Modal>

      <Modal
        open={editId != null}
        onClose={() => setEditId(null)}
        title={`Edit User${editingUser ? `: ${editingUser.name}` : ""}`}
        footer={
          <>
            <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm rounded-lg border">
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white"
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <UserFormFields form={form} setForm={setForm} message={message} />
      </Modal>

      <Modal
        open={resetId != null}
        onClose={() => setResetId(null)}
        title="Reset Password"
        footer={
          <>
            <button onClick={() => setResetId(null)} className="px-4 py-2 text-sm rounded-lg border">
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resetMutation.isPending || resetPassword.length < 6}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white"
            >
              {resetMutation.isPending ? "Saving…" : "Reset Password"}
            </button>
          </>
        }
      >
        <Field label="New Password">
          <input
            type="password"
            className={inputCls}
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
        </Field>
      </Modal>

      <ConfirmModal
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return;
          await deleteMutation.mutateAsync(deleteId);
          setDeleteId(null);
        }}
        title="Delete User"
        message="This will permanently remove the user account."
        confirmLabel="Delete"
        destructive
      />
    </>
  );
}

function UserFormFields({
  form,
  setForm,
  includePassword = false,
  message,
}: {
  form: {
    name: string;
    email: string;
    password: string;
    role: Role;
    is_active: boolean;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      password: string;
      role: Role;
      is_active: boolean;
    }>
  >;
  includePassword?: boolean;
  message?: string | null;
}) {
  return (
    <div className="space-y-4">
      <Field label="Name">
        <input
          className={inputCls}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          className={inputCls}
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
        />
      </Field>
      {includePassword && (
        <Field label="Password">
          <input
            type="password"
            className={inputCls}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
        </Field>
      )}
      <Field label="Role">
        <select
          className={inputCls}
          value={form.role}
          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Role }))}
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
        />
        Active account
      </label>
      {message && <p className="text-sm text-red-500">{message}</p>}
    </div>
  );
}
