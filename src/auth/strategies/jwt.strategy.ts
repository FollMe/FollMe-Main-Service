import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET,
        });
    }

    async validate(payload: any, done: (err: any, user: any, info?: any) => void) {
        try {
            const userId = payload.sub;
            const user = await this.userModel.findOne({ _id: userId });

            if (!user) {
                throw new HttpException("Vui lòng đăng nhập!", HttpStatus.UNAUTHORIZED);
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
