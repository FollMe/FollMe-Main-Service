import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const connection: any = { readyState: 1, db: { admin: () => ({ ping: jest.fn(async () => ({ ok: 1 })) }) } };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: getConnectionToken(), useValue: connection }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the greeting', () => {
      expect(appController.getHello()).toBe('Hello World nha!');
    });
  });

  describe('health', () => {
    it('is ok while the database answers', async () => {
      connection.readyState = 1;
      await expect(appController.health()).resolves.toEqual({ status: 'ok' });
    });

    it('is unavailable when the database is not connected', async () => {
      connection.readyState = 0;
      await expect(appController.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
