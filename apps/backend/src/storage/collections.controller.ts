import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CollectionsService } from './collections.service';
import {
  CollectionListQueryDto,
  CollectionWorkspaceQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './collections.dto';
import { mapCollectionResponse } from './storage.mapper';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  async create(
    @Body() dto: CreateCollectionDto,
    @Req() req: Request,
    @Query() query: CollectionWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const collection = await this.collectionsService.create(
      userId,
      dto,
      query.workspaceId,
    );

    return mapCollectionResponse(collection);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query() query: CollectionListQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const result = await this.collectionsService.list(userId, query);

    return {
      ...result,
      data: result.data.map(mapCollectionResponse),
    };
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() req: Request,
    @Query() query: CollectionWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const collection = await this.collectionsService.getById(
      id,
      userId,
      query.workspaceId,
    );

    return mapCollectionResponse(collection);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @Req() req: Request,
    @Query() query: CollectionWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const collection = await this.collectionsService.update(
      id,
      userId,
      dto,
      query.workspaceId,
    );

    return mapCollectionResponse(collection);
  }
}
