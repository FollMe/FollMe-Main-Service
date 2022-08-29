import { Module } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { Story, StorySchema } from './schemas/story.schema';
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
                    return schema;
                },
            }
        ]),
    ]
})
export class StoriesModule { }
