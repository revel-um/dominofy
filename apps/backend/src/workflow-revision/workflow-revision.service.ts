import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowRevision } from './workflow-revision.entity';
import { Workflow } from '../workflow/workflow.entity';
import { AiGenerateDto, AiGenerateResponseDto } from './workflow-revision.dto';
import * as jsondiffpatch from 'jsondiffpatch';
import * as deepDiff from 'deep-diff';
import axios from 'axios';

@Injectable()
export class WorkflowRevisionService {
  constructor(
    @InjectRepository(WorkflowRevision)
    private readonly revisionRepository: Repository<WorkflowRevision>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  async createRevision(
    workflowId: string,
    userId: string,
    diffJson: unknown,
    aiPrompt: string,
    aiExplanation: string,
  ): Promise<WorkflowRevision> {
    const revision = this.revisionRepository.create({
      workflow: { id: workflowId },
      user: { id: userId },
      diff_json: diffJson,
      ai_prompt: aiPrompt,
      ai_explanation: aiExplanation,
    });

    return await this.revisionRepository.save(revision);
  }

  async getRecentRevisions(
    workflowId: string,
    limit: number = 10,
  ): Promise<WorkflowRevision[]> {
    return await this.revisionRepository.find({
      where: { workflow: { id: workflowId } },
      relations: ['user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getLastNRevisions(workflowId: string, n: number = 3): Promise<WorkflowRevision[]> {
    return await this.getRecentRevisions(workflowId, n);
  }

  async generateAiRevision(
    workflowId: string,
    userId: string,
    aiGenerateDto: AiGenerateDto,
  ): Promise<AiGenerateResponseDto> {
    // Fetch workflow and last 3 revisions
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId },
      relations: ['user'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    if (workflow.user.id !== userId) {
      throw new BadRequestException('Access denied to this workflow');
    }

    const recentRevisions = await this.getLastNRevisions(workflowId, 3);
    const revisionLog = recentRevisions.map(rev => ({
      prompt: rev.ai_prompt,
      explanation: rev.ai_explanation,
      timestamp: rev.created_at,
    }));

    // Prepare payload for AI service
    const aiPayload = {
      text: aiGenerateDto.prompt,
      current_json: workflow.visualJson,
      revision_log: revisionLog,
    };

    try {
      // Call AI service
      const aiResponse = await axios.post(
        'http://ai-service:5005/generate',
        aiPayload,
        {
          timeout: 30000, // 30 second timeout
        }
      );

      const aiResult = aiResponse.data;
      
      // Compute diff between current and new workflow
      const currentJson = workflow.visualJson;
      const newJson = {
        nodes: aiResult.nodes || [],
        edges: aiResult.edges || [],
      };

      // Use jsondiffpatch to compute the diff
      const instance = jsondiffpatch.create({
        arrays: {
          detectMove: false,
          includeValueOnMove: false,
        },
      });

      const diff = instance.diff(currentJson, newJson);

      // Create revision record
      await this.createRevision(
        workflowId,
        userId,
        diff,
        aiGenerateDto.prompt,
        aiResult.explanation || 'AI generated workflow modification',
      );

      // Update workflow with new visualJson
      workflow.visualJson = newJson;
      await this.workflowRepository.save(workflow);

      return {
        nodes: newJson.nodes,
        edges: newJson.edges,
        explanation: aiResult.explanation || 'AI generated workflow modification',
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          `AI service error: ${error.response?.data?.detail || error.message}`,
        );
      }
      throw new BadRequestException(`Failed to generate AI revision: ${error.message}`);
    }
  }

  async computeDiff(oldJson: any, newJson: any): Promise<unknown> {
    // Alternative diff computation using deep-diff
    const diff = deepDiff.diff(oldJson, newJson);
    return diff;
  }
} 