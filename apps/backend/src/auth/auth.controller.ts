import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { generateJwtToken } from 'src/helper/generate.token';
import { ConfigService } from '@nestjs/config';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly users: UserService,
    private readonly config: ConfigService,
  ) {}

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() body: { email?: string; name?: string; provider?: string }) {
    const email = body?.email?.trim();
    if (!email) throw new BadRequestException('email required');

    let user = await this.users.findOneByEmail(email);
    if (!user) {
      // Create a minimal user; name/provider optional
      user = await this.users.create({
        name: body.name || email.split('@')[0],
        email,
        // no password for oauth users; ensure entity allows null
      } as any);
    }

    const token = generateJwtToken(
      { id: (user as any).id, email: (user as any).email },
      this.config.get<string>('JWT_SECRET')!,
    );

    return { token };
  }
}
