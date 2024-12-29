import {
  Controller,
  Request,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseFilePipe,
  Get,
  Param,
  FileTypeValidator,
  Query
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlogsService } from './blogs.service';
import { CreateBlogDTO } from './dtos/createBlog.dto';
import { SearchBlogDTO } from './dtos/searchBlog.dto';
import { parseSearchQuery, ParseSearchQueryOpts } from '../shared/service';

@Controller('api/blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) { }

  @Post('/')
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(FileInterceptor('thumbnail'))
  async createBlog(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new FileTypeValidator({ fileType: 'image/*' }),
        ],
      }),
    ) file: Express.Multer.File,
    @Body() body: CreateBlogDTO,
  ) {
    const res = await this.blogsService.createOne(body, file, req.user._id);
    return res;
  }

  @Get('/')
  async getAllStory(@Query() queries) {
    const searchOpts: ParseSearchQueryOpts = {
      supportedSortBy: ['updatedAt'],
      defaultSort: '-updatedAt'
    }
    const search = parseSearchQuery(queries, SearchBlogDTO, searchOpts);
    const blogs = await this.blogsService.getAll(search);
    return { blogs };
  }

  @Get('/:slug')
  async getBlog(@Param() params) {
    const slug = params.slug;
    const blog = await this.blogsService.getBlog(slug);
    return { blog };
  }
}
