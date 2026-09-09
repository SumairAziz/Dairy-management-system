import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getPermissionsForRole } from "@/services/role-permission.service";
import { normalizeRole } from "@/lib/rbac/permissions";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = await prisma.users.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.password_hash) {
          return null;
        }
        if (!user.is_active) {
          return null;
        }
        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) {
          return null;
        }
        const role = normalizeRole(user.role);
        const permissions = await getPermissionsForRole(role);
        return {
          id: String(user.user_id),
          email: user.email,
          name: user.name,
          role,
          permissions,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
        token.role = user.role;
        token.permissions = user.permissions ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as number;
        session.user.role = token.role as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      email: string;
      name: string;
      role: string;
      permissions: string[];
    };
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
    role: string;
    permissions?: string[];
  }
}
