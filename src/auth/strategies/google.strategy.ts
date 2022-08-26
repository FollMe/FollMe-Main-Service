import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-token';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
        });
    }

    async validate(accessToken, refreshToken, profile, done) {
        try {
            const user = await this.authService.findOrCreateGGAccount(profile._json);
            done(null, user);
        } catch (err) {
            console.log(err);
            done(err, false);
        }
    }
}