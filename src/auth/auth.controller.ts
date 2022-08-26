import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly jwtService: JwtService
    ) {}

    @Post('facebook')
    @UseGuards(AuthGuard("facebook"))
    async oauthFacebook(@Request() req): Promise<any> {
        const payload = {
            iss: "FollMe",
            sub: req.user._id,
        }
        const token = this.jwtService.sign(payload);
        return {
            token,
            user: req.user
        }
    }

    @Post('google')
    @UseGuards(AuthGuard("google"))
    async oauthGoogle(@Request() req): Promise<any> {
        const payload = {
            iss: "FollMe",
            sub: req.user._id,
        }
        const token = this.jwtService.sign(payload);
        return {
            token,
            user: req.user
        }
    }
}
