import { Controller, Request, Post, UseGuards, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlogsService } from './blogs.service';

@Controller('api/blogs')
export class BlogsController {
    constructor(private readonly blogsService: BlogsService) { }

    @Post('/')
    @UseGuards(AuthGuard("jwt"))
    @UseInterceptors(FileInterceptor('thumbnail'))
    async createBlog(
        @Request() req,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
    ) {
        const res = await this.blogsService.createOne(body, file, req.user._id);
        return res;
    }
}
