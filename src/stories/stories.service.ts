import { Injectable } from '@nestjs/common';

@Injectable()
export class StoriesService {
  getHello(): string {
    return 'Hello World nha!';
  }
}
