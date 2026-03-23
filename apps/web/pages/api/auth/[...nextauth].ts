import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import type { JWT } from 'next-auth/jwt';

// Debug logging
console.log('Environment Variables:');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'Set' : 'Not Set');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set');
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not Set');

// Session/User type augmentation is defined in ./types.d.ts for NextAuth v5

export const authOptions: any = {
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
    async session({ session, token }: { session: any; token: JWT }) {
      if (session?.user) {
        session.user.id = token.sub || '';
        session.user.provider = (token as any).provider as string;
        // Ensure basic profile fields are always present on the session
        session.user.name = session.user.name || (token as any).name || '';
        session.user.email = session.user.email || (token as any).email || '';
        (session.user as any).image = (session.user as any).image || (token as any).picture || (token as any).image || '';
      }
      return session;
    },
    async jwt({ token, account, user }: { token: JWT; account: any; user: any }) {
      // On initial sign-in, persist provider and basic profile on the token so it's available during session hydration
      if (account && user) {
        (token as any).provider = account.provider;
        (token as any).name = user.name;
        (token as any).email = user.email;
        (token as any).picture = (user as any).image || (user as any).picture || '';
      }
      return token;
    },
    async signIn({ user, account }: { user: any; account: any }) {
      console.log('Sign in attempt:', { 
        email: user.email,
        provider: account?.provider,
      });
      
      // Here you can add logic to sync with your backend
      // For now, just allow all sign-ins
      return true;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async error(error: Error) {
      console.error('Auth Error:', error);
    },
    async signIn(message: { user: any; account: any; isNewUser?: boolean }) {
      console.log('Sign in successful:', {
        userId: message.user.id,
        provider: message.account?.provider,
        isNewUser: message.isNewUser
      });
    },
    async signOut({ token }: { token: JWT }) {
      console.log('User signed out:', { userId: token?.sub });
    },
  },
  debug: process.env.NODE_ENV === 'development',
  useSecureCookies: false,
  cookies: {
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  pages: {
    signIn: '/auth',
    signOut: '/auth',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// @ts-ignore - Workaround for NextAuth v4 type issues
const handler = NextAuth(authOptions);

export default handler;
