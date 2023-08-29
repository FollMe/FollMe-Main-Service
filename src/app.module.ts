import { Module } from '@nestjs/common';
import { StoriesModule } from './modules/stories/stories.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsModule } from './modules/blogs/blogs.module';
import { ProfileModule } from './modules/profiles/profile.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { LogService } from './logs/logs.service';
import { Log, LogSchema } from './logs/schemas/log.schema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.DB_HOST),
    StoriesModule,
    BlogsModule,
    AuthModule,
    ProfileModule,
    MongooseModule.forFeatureAsync([
      {
        name: Log.name,
        useFactory: () => {
          const schema = LogSchema;
          schema.plugin(require('mongoose-slug-updater'));
          return schema;
        },
      }
    ]),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    LogService
  ],
})
export class AppModule { }
