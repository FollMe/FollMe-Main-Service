import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CertifyCodeService } from './services/certifyCode.service';
import { UserService } from './services/user.service';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { MailerService } from 'src/sharedServices/mailer.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, UserSchema } from './schemas/user.schema';
import { CertifyCode, CertifyCodeSchema } from './schemas/certifyCode.schema';

@Module({
    controllers: [AuthController],
    providers: [
        AuthService,
        CertifyCodeService,
        MailerService,
        UserService,
        FacebookStrategy,
        GoogleStrategy,
        LocalStrategy,
        JwtStrategy
    ],
    exports: [AuthService, CertifyCodeService, MailerService],
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.DB_HOST),
        MongooseModule.forFeatureAsync([
            {
                name: User.name,
                useFactory: () => {
                    const schema = UserSchema;
                    schema.plugin(require('mongoose-slug-updater'));
                    return schema;
                },
            }
        ]),
        MongooseModule.forFeature([
            {
                name: CertifyCode.name,
                schema: CertifyCodeSchema
            }
        ]),
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '1d' },
        }),
    ],
})
export class AuthModule { }
