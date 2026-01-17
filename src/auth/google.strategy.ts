import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "http://localhost:3001/auth/google/callback", // 🔒 LOCKED
      scope: ["email", "profile"],
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    if (!profile?.emails?.length) {
      return done(
        new UnauthorizedException("Google profile incomplete"),
        false,
      );
    }

    const user = {
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName || "Google User",
      photo: profile.photos?.[0]?.value || null,
    };

    return done(null, user);
  }
}
