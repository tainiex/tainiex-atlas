import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class UsersService {
  private storage: Storage;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private configService: ConfigService,
  ) {
    const gsaKeyFile = this.configService.get<string>('GSA_KEY_FILE');
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    const serviceAccountEmail = this.configService.get<string>(
      'GCS_SERVICE_ACCOUNT',
    );

    const storageOptions: any = {
      projectId: projectId,
    };

    if (gsaKeyFile) {
      storageOptions.keyFilename = gsaKeyFile;
    }

    this.storage = new Storage(storageOptions);
    console.log(`[UsersService] Storage initialized for project: ${projectId}`);
  }

  async findOne(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async update(id: string, user: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, user);
    return this.usersRepository.findOne({ where: { id } }) as Promise<User>;
  }

  async delete(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async getSignedUrl(filename: string): Promise<string | null> {
    try {
      const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');

      if (!bucketName || !filename) {
        return filename || null;
      }

      // Already a URL
      if (filename.startsWith('http')) {
        return filename;
      }

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filename);

      // V4 Signing options
      const serviceAccountEmail = this.configService.get<string>(
        'GCS_SERVICE_ACCOUNT',
      );

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000,
        // In Cloud Run, if no key file, we MUST provide the SA email for the IAM signBlob call
        ...(serviceAccountEmail ? { clientEmail: serviceAccountEmail } : {}),
      });

      return url;
    } catch (error) {
      console.error(
        `[UsersService] SignedURL Error for ${filename}:`,
        error.message,
      );
      // Return null so the caller knows it failed, but we should ideally return the path
      // if we want the frontend to at least see something (though it won't load)
      return null;
    }
  }
}
