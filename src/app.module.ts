import { Module } from '@nestjs/common';
import { StoriesModule } from './stories/stories.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [StoriesModule, AuthModule],
})
export class AppModule {}
