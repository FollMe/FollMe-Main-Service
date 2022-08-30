import { Module } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { Story, StorySchema } from './schemas/story.schema';
import { Chap, ChapSchema } from './schemas/chap.schema';
import { StoriesService } from './stories.service';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    controllers: [StoriesController],
    providers: [StoriesService],
    exports: [StoriesService],
    imports: [
        MongooseModule.forFeatureAsync([
            {
                name: Story.name,
                useFactory: () => {
                    const schema = StorySchema;
                    schema.plugin(require('mongoose-slug-updater'));
                    return schema;
                },
            },
            {
                name: Chap.name,
                useFactory: () => {
                    const schema = ChapSchema;
                    schema.plugin(require('mongoose-slug-updater'));
                    return schema;
                },
            }
        ]),
    ]
})
export class StoriesModule { }
