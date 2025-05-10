// src/common/filters/global-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
  
  @Catch()
  export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Internal server error';
  
      // Handle known HTTP exceptions
      if (exception instanceof HttpException) {
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || message;
      }
  
      // Handle TypeORM/PostgreSQL errors
      else if (exception instanceof Error && 'code' in exception) {
        const err = exception as any;
  
        switch (err.code) {
          case '23505': // Unique violation
            status = HttpStatus.CONFLICT;
            const detail = err.detail || '';
            const fieldMatch = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
            if (fieldMatch) {
              const [, field, value] = fieldMatch;
              message = `Duplicate entry: "${field}" with value "${value}" already exists.`;
            } else {
              message = 'Duplicate entry violates unique constraint.';
            }
            break;
  
          case '23502': // Not null violation
            status = HttpStatus.BAD_REQUEST;
            message = `Missing required field: ${err.column || 'unknown'}`;
            break;
  
          case '23503': // Foreign key violation
            status = HttpStatus.BAD_REQUEST;
            message = `Invalid reference in relation: ${err.constraint || 'unknown constraint'}`;
            break;
  
          default:
            message = err.message || message;
            break;
        }
      }
  
      // Handle other generic errors
      else if (exception instanceof Error) {
        message = exception.message;
      }
  
      // Log the error
      console.error('[❌ GlobalExceptionFilter]', {
        path: request.url,
        method: request.method,
        status,
        message,
        exception,
      });
  
      // Send JSON response
      response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
  