import { Body, Controller, Get, Post, Request, UseGuards, Response } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RequestCodeDTO, SignUpDTO } from './dtos/signUp.dto';

function filterPublicField(user) {
    return  {
        avatar: user.avatar,
        name: user.name,
        slEmail: user.slEmail,
        _id: user._id
    }
} 

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
            user: filterPublicField(req.user)
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
            user: filterPublicField(req.user)
        }
    }

    @Post('local')
    @UseGuards(AuthGuard("local"))
    async localLogin(@Request() req): Promise<any> {
        const payload = {
            iss: "FollMe",
            sub: req.user._id,
        }
        const token = this.jwtService.sign(payload);
        return {
            token,
            user: filterPublicField(req.user)
        }
    }

    @Post('code')
    async getCertifyCode(@Body() body: RequestCodeDTO): Promise<any> {
        await this.authService.generateCertifyCode(body.email);
        return;
    }

    @Post('sign-up')
    async localSignUp(@Body() body: SignUpDTO): Promise<any> {
        await this.authService.signUp(body);
        return;
    }

    @Get('is-logged-in')
    @UseGuards(AuthGuard("jwt"))
    async checkIsUserLoggedIn(@Request() req, @Response() res): Promise<any> {
        const userInfo = filterPublicField(req.user);
        const userString = Buffer.from(JSON.stringify(userInfo)).toString('base64');
        return res.set({ 'X-User-Info': userString }).json({ isLoggedIn: true });
    }
}
