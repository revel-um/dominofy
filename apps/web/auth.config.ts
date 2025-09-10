import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authConfig = {
  // @ts-ignore - PrismaAdapter has a type issue with the latest version
  adapter: PrismaAdapter(prisma),
  providers: [],
  pages: {
    signIn: '/auth',
    error: '/auth',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
