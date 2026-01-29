import { Module, Global } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

@Global()
@Module({
    imports: [
        ClsModule.forRoot({
            global: true,
            middleware: { mount: true }, // Automatically mount context for all requests
        }),
    ],
    exports: [ClsModule],
})
export class ContextModule {}
