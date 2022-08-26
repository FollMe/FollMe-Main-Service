import { Injectable, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library"
import { Request } from 'express';
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        super();
    }

    async validate(
        req: Request,
        done: (err: any, user: any, info?: any) => void
    ): Promise<void> {
        try {
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
            const idToken = req.body.idToken;
            if (!idToken) {
                throw new UnauthorizedException();
            }
            const ticket = await client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const profile = ticket.getPayload();
            const user = await this.authService.findOrCreateGGAccount(profile);
            done(null, user);
        } catch (err) {
            console.log(err);
            done(err, null);
        }
    }
}