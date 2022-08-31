import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from './allException.filter';
import { AppModule } from './app.module';
import { TransformInterceptor } from './interceptors/transform.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalInterceptors(new TransformInterceptor());

    const httpAdapter = app.get(HttpAdapterHost);
    app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

    app.enableCors({
        origin: [
            "http://localhost:3002",
            "https://follme.vercel.app"
        ]
    });
    await app.listen(process.env.PORT || 3000);
}
bootstrap();
