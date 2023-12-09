import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ConfigModule } from '@nestjs/config';
import { UserSchema, User } from '../auth/schemas/user.schema';
import { CacheService } from 'src/sharedServices/cache.service';

@Module({
  controllers: [UserController],
  providers: [
    ProfileService,
    CacheService,
  ],
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      }
    ]),
  ],
})
export class ProfileModule { }
