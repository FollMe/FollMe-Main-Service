import { Controller, Get } from '@nestjs/common';
import { StoriesService } from './stories.service';

@Controller('api/stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  async getAllStory() {
    const stories = await this.storiesService.getAll();
    return {stories};
  }
}
