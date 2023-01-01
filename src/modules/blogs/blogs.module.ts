import { Module } from '@nestjs/common';
import { BlogsController } from './blogs.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsService } from './blogs.service';
import { Blog, BlogSchema } from './schemas/blog.schema';
import { CloudinaryService } from 'src/sharedServices/cloudinary.service';

@Module({
    controllers: [BlogsController],
    providers: [BlogsService, CloudinaryService],
    exports: [BlogsService, CloudinaryService],
    imports: [
        MongooseModule.forFeatureAsync([
            {
                name: Blog.name,
                useFactory: () => {
                    const schema = BlogSchema;
                    schema.plugin(require('mongoose-slug-updater'));
                    return schema;
                },
            }
        ]),
    ]
})
export class BlogsModule { }
