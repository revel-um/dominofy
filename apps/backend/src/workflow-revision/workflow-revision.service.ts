import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { WorkflowRevision } from './workflow-revision.entity';
import { Workflow } from '../workflow/workflow.entity';
import { AiGenerateDto, AiGenerateResponseDto } from './workflow-revision.dto';
import * as jsondiffpatch from 'jsondiffpatch';
import * as deepDiff from 'deep-diff';
import axios from 'axios';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class WorkflowRevisionService {
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';

  constructor(
    @InjectRepository(WorkflowRevision)
    private readonly revisionRepository: Repository<WorkflowRevision>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly workflowService: WorkflowService,
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
    const workflow = await this.workflowService.findOneAndVerify(workflowId, userId);

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    const recentRevisions = await this.getLastNRevisions(workflowId, 3);
    // Pass structured diffs so the AI sees exactly what changed in each iteration
    const revisionLog = recentRevisions.map(rev =>
      `User: ${rev.ai_prompt}\nAI: ${rev.ai_explanation}`
    );
    const revisionDiffs = recentRevisions
      .map(rev => rev.diff_json)
      .filter(Boolean);

    // Prefer real-time canvas state from the frontend over the DB snapshot
    const currentJson = aiGenerateDto.current_json ?? workflow.visualJson;

    // Prepare payload for AI service
    const aiPayload = {
      text: aiGenerateDto.prompt,
      current_json: currentJson,
      revision_log: revisionLog,
      revision_diffs: revisionDiffs,
    };

    try {
      // Call AI service
      const aiResponse = await axios.post(
        `${this.aiServiceUrl}/generate`,
        aiPayload,
        {
          timeout: 60000, // 60 second timeout (two-stage generation needs more time)
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
        status: aiResult.status,
        thought_summaries: aiResult.thought_summaries ?? aiResult.chain_of_thought,
        chain_of_thought: aiResult.chain_of_thought,
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

  /** Preview-only generation: validates auth, proxies to AI service, but does NOT
   *  create a revision record or update workflow.visualJson.
   *  The frontend uses this so the user can accept/reject before anything is persisted. */
  async previewAiRevision(
    workflowId: string,
    userId: string,
    aiGenerateDto: AiGenerateDto,
  ): Promise<AiGenerateResponseDto> {
    const workflow = await this.workflowService.findOneAndVerify(workflowId, userId);

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    const recentRevisions = await this.getLastNRevisions(workflowId, 3);
    const revisionLog = recentRevisions.map(rev =>
      `User: ${rev.ai_prompt}\nAI: ${rev.ai_explanation}`
    );
    const revisionDiffs = recentRevisions.map(rev => rev.diff_json).filter(Boolean);

    const currentJson = aiGenerateDto.current_json ?? workflow.visualJson;

    const aiPayload = {
      text: aiGenerateDto.prompt,
      current_json: currentJson,
      revision_log: revisionLog,
      revision_diffs: revisionDiffs,
    };

    console.log('AI generation preview payload:', aiPayload);
    try {
      const aiResponse = await axios.post(
        `${this.aiServiceUrl}/generate`,
        aiPayload
      );

      const aiResult = aiResponse.data;
      return {
        nodes: aiResult.nodes || [],
        edges: aiResult.edges || [],
        explanation: aiResult.explanation || 'AI generated workflow preview',
        status: aiResult.status,
        thought_summaries: aiResult.thought_summaries ?? aiResult.chain_of_thought,
        chain_of_thought: aiResult.chain_of_thought,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          `AI service error: ${error.response?.data?.detail || error.message}`,
        );
      }
      throw new BadRequestException(`Failed to generate AI preview: ${error.message}`);
    }
  }

  async streamPreviewAiRevision(
    workflowId: string,
    userId: string,
    aiGenerateDto: AiGenerateDto,
    res: Response,
  ): Promise<void> {
    const workflow = await this.workflowService.findOneAndVerify(workflowId, userId);

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    const recentRevisions = await this.getLastNRevisions(workflowId, 3);
    const revisionLog = recentRevisions.map(rev =>
      `User: ${rev.ai_prompt}\nAI: ${rev.ai_explanation}`
    );
    const revisionDiffs = recentRevisions.map(rev => rev.diff_json).filter(Boolean);

    const currentJson = aiGenerateDto.current_json ?? workflow.visualJson;
    const aiPayload = {
      text: aiGenerateDto.prompt,
      current_json: currentJson,
      revision_log: revisionLog,
      revision_diffs: revisionDiffs,
    };

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const aiResponse = await axios.post(
        `${this.aiServiceUrl}/generate-stream`,
        aiPayload,
        {
          responseType: 'stream',
          timeout: 60000,
        },
      );

      aiResponse.data.on('error', (error: Error) => {
        if (!res.writableEnded) {
          res.write(`${JSON.stringify({ type: 'error', detail: error.message })}\n`);
          res.end();
        }
      });

      aiResponse.data.pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(400);
      }
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
          ? error.message
          : 'Unknown preview stream error';
      res.write(`${JSON.stringify({ type: 'error', detail: `AI service error: ${detail}` })}\n`);
      res.end();
    }
  }

  async computeDiff(oldJson: any, newJson: any): Promise<unknown> {
    // Alternative diff computation using deep-diff
    const diff = deepDiff.diff(oldJson, newJson);
    return diff;
  }
} 
