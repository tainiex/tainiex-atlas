import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { InvitationCode } from './../src/invitation/invitation-code.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';

describe('AuthController (e2e)', () => {
    let app: INestApplication;
    let invitationRepo: Repository<InvitationCode>;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.use(cookieParser());
        await app.init();

        invitationRepo = moduleFixture.get<Repository<InvitationCode>>(
            getRepositoryToken(InvitationCode)
        );
    });

    afterAll(async () => {
        await app.close();
    });

    it('should register a new user, login, and access profile', async () => {
        // 1. Get a valid invitation code
        const codeEntity = await invitationRepo.findOne({
            where: { isUsed: false },
        });
        if (!codeEntity) {
            throw new Error(
                'No available invitation code for testing. ensureInvitationCodes failed?'
            );
        }
        const invitationCode = codeEntity.code;
        const testUser = `testuser_${Date.now()}`;
        const testPass = 'Password123!';

        // 2. Register
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await request(app.getHttpServer())
            .post('/auth/signup')
            .send({
                username: testUser,
                password: testPass,
                invitationCode: invitationCode,
                email: `${testUser}@example.com`,
            })
            .expect(201);

        // 3. Login
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const loginResponse = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                username: testUser,
                password: testPass,
            })
            .expect(201);

        // Verify cookies are set
        const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
        expect(cookies).toBeDefined();
        expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);

        // Extract access token cookie
        const accessTokenCookie = cookies.find(c => c.startsWith('access_token='));
        if (!accessTokenCookie) throw new Error('Access token cookie not found');

        // 4. Access Profile using Cookie
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const profileResponse = await request(app.getHttpServer())
            .get('/auth/profile')
            .set('Cookie', [accessTokenCookie])
            .expect(200);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(profileResponse.body.username).toBe(testUser);
    });

    it('should fail to register with invalid code', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await request(app.getHttpServer())
            .post('/auth/signup')
            .send({
                username: 'bad_user',
                password: 'password',
                invitationCode: 'INVALID_CODE_123',
            })
            .expect(401);
    });
});
