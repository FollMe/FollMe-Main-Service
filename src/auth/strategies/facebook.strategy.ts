import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from 'express';
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { AuthService } from "../auth.service";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
    constructor(private authService: AuthService) {
        super();
    }

    async validate(
        req: Request,
        done: (err: any, user: any, info?: any) => void
    ): Promise<void> {
        try {
            const accessToken: string = req.body.accessToken;
            if (!accessToken) {
                throw new UnauthorizedException();
            }
            const userInfo = await this.authService.getUserFBInfo(accessToken);
            const user = await this.authService.findOrCreateFbAccount(userInfo);
            
            done(null, user);
        } catch(err) {
            console.log(err);
            done(err, null);
        }
    }
}