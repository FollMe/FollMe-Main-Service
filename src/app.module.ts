import { Module } from '@nestjs/common';
import { StoriesModule } from './stories/stories.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        ConfigModule.forRoot(),
        StoriesModule,
        AuthModule
    ],
})
export class AppModule { }
