import { Controller, Get, Param } from '@nestjs/common';
import { StoriesService } from './stories.service';

@Controller('api/stories')
export class StoriesController {
    constructor(private readonly storiesService: StoriesService) { }

    @Get()
    async getAllStory() {
        const stories = await this.storiesService.getAll();
        return { stories };
    }

    @Get('/:slug')
    async getStory(@Param() params) {
        const slug = params.slug;
        const story = await this.storiesService.getStory(slug);
        return { story };
    }

    @Get('/:storySlug/:chapSlug')
    async getChap(@Param() params) {
        const { storySlug, chapSlug } = params;
        const data = await this.storiesService.getChap(storySlug, chapSlug);
        return data;
    }
}
