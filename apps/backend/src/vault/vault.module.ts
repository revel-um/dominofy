import { Module, NestModule } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vault } from './vault.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vault]),
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
