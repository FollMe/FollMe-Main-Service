import { Controller, Get, Param } from '@nestjs/common';
import { StoriesService } from './stories.service';

@Controller('api')
export class StoriesController {
    constructor(private readonly storiesService: StoriesService) { }

    @Get('/stories')
    async getAllStory() {
        const stories = await this.storiesService.getAll();
        return { stories };
    }

    @Get('stories/:slug')
    async getStory(@Param() params) {
        const slug = params.slug;
        const story = await this.storiesService.getStory(slug);
        return { story };
    }

    @Get('stories/:storySlug/:chapSlug')
    async getChap(@Param() params) {
        const { storySlug, chapSlug } = params;
        const data = await this.storiesService.getChap(storySlug, chapSlug);
        return data;
    }

    @Get('short-stories/:storySlug')
    async getShortStory(@Param() params) {
        const storySlug = params.storySlug;
        const story = await this.storiesService.getShortStory(storySlug);
        return { story }
    }
}
