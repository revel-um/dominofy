// src/apis/files.api.ts
import { NextRouter } from 'next/router';
import { handleServerError, handleUnauthorizedError } from '../utils/error.handler';
import { config } from '../config/config';

export interface UploadResponse {
  key: string;
  location: string;
  etag: string;
}

export interface DeleteResponse {
  message: string;
}

export class FilesApi {
  /**
   * Uploads a file to GCS (via your backend API).
   * @param file   The File object from an <input type="file" /> or similar
   * @param token  Bearer token for authorization
   * @param router NextRouter for handling redirects on errors
   */
  static async uploadFile(
    file: File,
    token: string,
    router: NextRouter,
    workflowId?: string,
  ) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (workflowId) {
        formData.append('workflowId', workflowId);
      }

      const response = await fetch(
        `${config.backendBaseUrl}/files/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (response.status === 401) {
        handleUnauthorizedError(router);
        return;
      }

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      return (await response.json()) as UploadResponse;
    } catch (err) {
      handleServerError(router, err);
    }
  }

  /**
   * Deletes a file from GCS (via your backend API).
   * @param key    The object key (including any UUID prefix)
   * @param token  Bearer token for authorization
   * @param router NextRouter for handling redirects on errors
   */
  static async deleteFile(
    key: string,
    token: string,
    router: NextRouter,
  ): Promise<DeleteResponse | void> {
    try {
      const encodedKey = encodeURIComponent(key);
      const response = await fetch(
        `${config.backendBaseUrl}/files/${encodedKey}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        handleUnauthorizedError(router);
        return;
      }

      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`);
      }

      return (await response.json()) as DeleteResponse;
    } catch (err) {
      handleServerError(router, err);
    }
  }
}
