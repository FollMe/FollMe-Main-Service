import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
    constructor(private authService: AuthService) {
        super({ usernameField: 'email' });
    }

    async validate(
        email: string,
        password: string,
        done: (err: any, user: any, info?: any) => void
    ): Promise<any> {
        try {
            const user = await this.authService.checkCredential(email, password);

            if (!user) {
                return done(new HttpException('Email hoặc mật khẩu không đúng', HttpStatus.UNAUTHORIZED), null);
            }
            if (user.block) {
                return done(new HttpException('Tài khoản của bạn đang bị khóa', HttpStatus.UNAUTHORIZED), null);
            }

            return done(null, user);
        } catch (err) {
            console.log(err);
            done(err, null);
        }
    }
}