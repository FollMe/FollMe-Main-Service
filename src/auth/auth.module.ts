import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { User, UserSchema } from './schemas/user.schema';

@Module({
    controllers: [AuthController],
    providers: [AuthService, FacebookStrategy, GoogleStrategy, LocalStrategy],
    exports: [AuthService],
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.DB_HOST),
        MongooseModule.forFeatureAsync([{
            name: User.name,
            useFactory: () => {
                const schema = UserSchema;
                schema.plugin(require('mongoose-slug-updater'));
                return schema;
              },
        }]),
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '1d' },
          }),
    ],
})
export class AuthModule {}
