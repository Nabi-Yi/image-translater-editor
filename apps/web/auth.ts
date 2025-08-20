import NextAuth, { NextAuthConfig, NextAuthResult } from "next-auth";
import { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
// Your own logic for dealing with plaintext password strings; be careful!
// import { signInSchema } from "./lib/zod";
// import { getUser } from "@/serverActions/auth/auth.actions";
// import { ZodError } from "zod";

import { prisma } from "@repo/database";
import { verifyPassword } from "./lib/utils/password";
import { parseBigintJson } from "@repo/utils";

// 커스텀 사용자 타입
interface CustomUser {
  id: string;
  email: string;
  name: string | null;
}

// NextAuth 타입 확장
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  }
}

// JWT 타입 확장
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string | null;
  }
}

export interface NextAuthResultCustom extends Omit<NextAuthResult, "signIn" | "auth"> {
  signIn: (provider: string, options: any, authorizationParams: any) => Promise<void>;
  auth: any;
}

// { handlers, signIn, signOut, auth }
export const { handlers, signIn, signOut, auth }: NextAuthResultCustom = NextAuth({
  providers: [
    Credentials({
      // You can specify which fields should be submitted, by adding keys to the `credentials` object.
      // e.g. domain, username, password, 2FA token, etc.
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("아이디 또는 비밀번호가 없습니다");
            return null;
          }

          const { email, password } = credentials;

          // 사용자 조회
          const user = await prisma.user.findFirst({
            where: {
              email: email as string,
            },
          });

          if (!user) {
            return null;
          }

          // 비밀번호 검증
          const isValid = verifyPassword(password as string, user.password);

          if (!isValid) {
            return null;
          }

          // 사용자 정보 반환
          return parseBigintJson(user);
        } catch (error) {
          console.error("인증 과정에서 오류 발생:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // JWT 토큰에 사용자 정보 추가
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        // 사용자 정보를 토큰에 저장
        const userData = user as unknown as CustomUser;
        token.id = userData.id;
        token.email = userData.email;
        token.name = userData.name;
      }

      return token;
    },
    // 세션에 사용자 정보 추가
    session: async ({ session, token }) => {
      // 세션 사용자 객체를 확장
      session.user = {
        ...(session.user || {}),
        id: token.id as string,
        email: token.email as string,
        name: token.name as string | null,
      };
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  trustHost: true,
});
