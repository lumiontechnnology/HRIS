import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@lumion/database';
import { compare } from 'bcryptjs';
import type { DefaultSession } from 'next-auth';

const prisma = new PrismaClient();

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      tenantId: string;
      email: string;
      firstName: string;
      lastName: string;
      roles: string[];
      permissions: string[];
      mfaEnabled: boolean;
    } & DefaultSession['user'];
  }

  interface JWT {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
    mfaEnabled: boolean;
  }
}

export const { handlers, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            roles: {
              include: {
                permissions: true,
              },
            },
            tenant: true,
          },
        });

        if (!user || !user.isActive) {
          throw new Error('User not found or inactive');
        }

        // Verify password
        const passwordMatch = await compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          throw new Error('Invalid password');
        }

        // Extract permissions from roles
        const permissions = user.roles.flatMap((role) =>
          role.permissions.map((perm) => `${perm.resource}:${perm.action}`)
        );

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          tenantId: user.tenantId,
          name: `${user.firstName} ${user.lastName}`,
          image: user.avatar,
          roles: user.roles.map((r) => r.name),
          permissions,
          mfaEnabled: user.mfaEnabled,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // 1 hour
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id;
        token.tenantId = (user as any).tenantId;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.roles = (user as any).roles;
        token.permissions = (user as any).permissions;
        token.mfaEnabled = (user as any).mfaEnabled;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.tenantId = token.tenantId;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.roles = token.roles;
        session.user.permissions = token.permissions;
        session.user.mfaEnabled = token.mfaEnabled;
      }
      return session;
    },
  },
});
