import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
      authorization: {
        params: {
          scope:
            "openid profile email offline_access Calendars.Read Calendars.ReadWrite",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return true;
      const userId = account.providerAccountId;
      try {
        await prisma.user.upsert({
          where: { id: userId },
          update: {
            name: user.name,
            email: user.email,
            image: user.image,
          },
          create: {
            id: userId,
            name: user.name,
            email: user.email,
            image: user.image,
          },
        });
      } catch (e) {
        console.error("Failed to upsert user:", e);
      }
      return true;
    },
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.id = account.providerAccountId;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
