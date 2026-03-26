import { Module, NestModule, forwardRef } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vault } from './vault.entity';
import { EmailModule } from 'src/email/email.module';
import { WorkspaceModule } from 'src/workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vault]),
    forwardRef(() => WorkspaceModule),
    forwardRef(() => EmailModule),
  ],
  controllers: [VaultController],
  providers: [VaultService],
  exports: [VaultService]
})
export class VaultModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(VerifyTokenMiddleware).forRoutes(VaultController);
  }
}
