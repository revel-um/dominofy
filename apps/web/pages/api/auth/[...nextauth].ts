import NextAuth from 'next-auth/next';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Debug logging
console.log('Environment Variables:');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'Set' : 'Not Set');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set');
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not Set');

// Create and export the auth handler
export default NextAuth({
  // @ts-ignore - PrismaAdapter type issue
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }: any) {
      if (session?.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user, account }: any) {
      console.log('Sign in attempt:', { 
        userId: user.id,
        email: user.email,
        provider: account?.provider,
      });
      return true;
    },
    async redirect({ url, baseUrl }: any) {
      const finalUrl = url.startsWith(baseUrl) ? url : baseUrl;
      console.log('Redirecting to:', finalUrl);
      return finalUrl;
    },
  },
  events: {
    // @ts-ignore - Error event is valid but not in types
    async error(error: any) {
      console.error('Auth Error:', error);
    },
    async signIn(message: any) {
      console.log('Sign in successful:', {
        userId: message.user.id,
        provider: message.account?.provider,
        isNewUser: message.isNewUser
      });
    },
    async signOut({ token }: any) {
      console.log('User signed out:', { userId: token?.sub });
    },
  },
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: '/auth',
    error: '/auth',
  },
  secret: process.env.NEXTAUTH_SECRET,
});
