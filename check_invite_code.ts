
import * as tsConfigPaths from 'tsconfig-paths';
import * as tsConfig from './tsconfig.json';
tsConfigPaths.register({
    baseUrl: './',
    paths: tsConfig.compilerOptions.paths
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { InvitationService } from './src/invitation/invitation.service';
import { InvitationCode } from './src/invitation/invitation-code.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function checkCode() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const repo = app.get<Repository<InvitationCode>>(getRepositoryToken(InvitationCode));

    const codeToCheck = '41CAD31E';
    console.log(`Checking code: '${codeToCheck}'`);

    const invitation = await repo.findOne({ where: { code: codeToCheck } });

    if (!invitation) {
        console.log('❌ Code NOT FOUND in database.');
        // List a few codes to see what they look like
        const all = await repo.find({ take: 5 });
        console.log('First 5 codes in DB:', all.map(c => c.code));
    } else {
        console.log('✅ Code FOUND.');
        console.log('Details:', invitation);
        console.log('isUsed:', invitation.isUsed);
        console.log('expiresAt:', invitation.expiresAt);
        console.log('Current Time:', new Date());
        console.log('Is Expired?', new Date() > invitation.expiresAt);
    }

    await app.close();
}

checkCode().catch(err => console.error(err));
