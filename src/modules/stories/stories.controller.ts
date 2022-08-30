import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoriesService } from './stories.service';

@Controller('api')
export class StoriesController {
    constructor(private readonly storiesService: StoriesService) { }

    @Get('/stories')
    @UseGuards(AuthGuard("jwt"))
    async getAllStory() {
        const stories = await this.storiesService.getAll();
        return { stories };
    }

    @Get('stories/:slug')
    @UseGuards(AuthGuard("jwt"))
    async getStory(@Param() params) {
        const slug = params.slug;
        const story = await this.storiesService.getStory(slug);
        return { story };
    }

    @Get('stories/:storySlug/:chapSlug')
    @UseGuards(AuthGuard("jwt"))
    async getChap(@Param() params) {
        const { storySlug, chapSlug } = params;
        const data = await this.storiesService.getChap(storySlug, chapSlug);
        return data;
    }

    @Get('short-stories/:storySlug')
    @UseGuards(AuthGuard("jwt"))
    async getShortStory(@Param() params) {
        const storySlug = params.storySlug;
        const story = await this.storiesService.getShortStory(storySlug);
        return { story }
    }
}
