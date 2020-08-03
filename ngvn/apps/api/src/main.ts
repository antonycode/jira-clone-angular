import { HttpStatus, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from '@ngvn/api/common';
import { appConfiguration, arenaConfiguration, redisConfiguration } from '@ngvn/api/config';
import { AppConfig, ArenaConfig, RedisConfig } from '@ngvn/api/types';
import { queueNames } from '@ngvn/background/common';
import mongoose from 'mongoose';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app/app.module';

const Arena = require('bull-arena');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get<AppConfig>(appConfiguration.KEY);
  const redisConfig = app.get<RedisConfig>(redisConfiguration.KEY);
  const arenaConfig = app.get<ArenaConfig>(arenaConfiguration.KEY);

  mongoose.set('debug', true);

  app.use(compression());
  app.use(helmet());
  app.use(cookieParser());

  const arena = new Arena(
    {
      queues: queueNames.map((queueName) => ({
        name: queueName,
        hostId: queueName,
        redis: { host: redisConfig.host, port: redisConfig.port },
        type: 'bull',
      })),
    },
    arenaConfig,
  );
  const arenaEndpoint = `/api/arena`;
  app.use(arenaEndpoint, arena);
  Logger.log(`Arena: ${appConfig.domain}${arenaEndpoint}`, 'NestApplication');

  app.use('/robots.txt', (_, res) => {
    res.send('User-Agent: *\n' + 'Disallow: /');
  });
  app.use('/favicon.ico', (_, res) => {
    res.sendStatus(HttpStatus.NO_CONTENT).end();
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(appConfig.port, () => {
    Logger.log('Listening at ' + appConfig.domain + '/', 'NestApplication');
    if (appConfig.env === 'development') {
      Logger.log('GraphQL Playground at ' + appConfig.domain + '/graphql', 'NestApplication');
    }
  });
}

bootstrap();
