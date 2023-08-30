import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story, StoryDocument } from './schemas/story.schema';
import { Chap, ChapDocument } from './schemas/chap.schema'
import { STORY_TYPE } from './story.instant';

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name)
    private storyModel: Model<StoryDocument>,
    @InjectModel(Chap.name)
    private chapModel: Model<ChapDocument>,
  ) { }
  async getAll() {
    return await this.storyModel.find({ isDeleted: { $ne: true } })
      .populate('author', 'name')
      .populate('chaps', 'name slug');
  }

  async getStory(slug: string) {
    const story = await this.storyModel.findOne({ slug, isDeleted: { $ne: true } })
      .populate('author', 'name')
      .populate('chaps', 'name slug');

    if (!story) {
      throw new NotFoundException();
    }

    return story;
  }

  async getChap(storySlug: string, chapSlug: string) {
    const story = await this.storyModel.findOne({ slug: storySlug })
      .populate('author', 'name')
      .populate({ path: 'chaps', match: { slug: chapSlug } });

    if (!story || story.chaps.length <= 0) {
      throw new NotFoundException();
    }

    const curId = story.chaps[0]._id;
    const nextChap = await this.chapModel.findOne({
      _id: { $gt: curId }, story: story._id, isDeleted: { $ne: true }
    }).sort({ _id: 1 }).select('slug name');

    const previousChap = await this.chapModel.findOne({
      _id: { $lt: curId }, story: story._id, isDeleted: { $ne: true }
    }).sort({ _id: -1 }).select('slug name');

    return { story, previousChap, nextChap };
  }

  async getShortStory(storySlug: string) {
    const story = await this.storyModel.findOne({
      slug: storySlug,
      type: STORY_TYPE.SHORT,
      isDeleted: { $ne: true }
    })
    .populate('author', 'name')
    .populate({
      path: 'chaps',
      options: { limit: 1 }
    });

    if (!story || story.chaps.length !== 1) {
      throw new NotFoundException();
    }

    return story;
  }
}
