import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story, StoryDocument } from './schemas/story.schema';

@Injectable()
export class StoriesService {
    constructor(
        @InjectModel(Story.name)
        private storyModel: Model<StoryDocument>,
    ) {}
    async getAll() {
        return await this.storyModel.find({ isDeleted:  { $ne: true }  }).populate('author', 'name');
    }
}
