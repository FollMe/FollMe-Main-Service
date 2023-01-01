import { Module } from '@nestjs/common';
import { StoriesModule } from './modules/stories/stories.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsModule } from './modules/blogs/blogs.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.DB_HOST),
        StoriesModule,
        BlogsModule,
        AuthModule
    ],
})
export class AppModule { }
