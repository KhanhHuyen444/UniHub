import { apiRequest } from '../../lib/api';
import {
  parseForumList,
  parseForumPost,
  parseForumCommentResponse,
  parseCommentList,
  type ForumListResponse,
  type ForumPostResponse,
  type ForumCommentResponse,
  type CommentListResponse,
} from './contracts';

export async function getForumPosts(
  query: URLSearchParams,
  signal: AbortSignal,
): Promise<ForumListResponse> {
  const value = await apiRequest<unknown>('/api/forum/posts', {
    query,
    signal,
  });
  return parseForumList(value);
}

export async function createForumPost(
  input: { topic: string; title: string; content: string },
): Promise<ForumPostResponse> {
  const value = await apiRequest<unknown>('/api/forum/posts', {
    method: 'POST',
    body: input,
  });
  return parseForumPost(value);
}

export async function getForumPost(
  id: string,
  signal: AbortSignal,
): Promise<ForumPostResponse> {
  const value = await apiRequest<unknown>(
    `/api/forum/posts/${encodeURIComponent(id)}`,
    { signal },
  );
  return parseForumPost(value);
}

export async function getPostComments(
  postId: string,
  query: URLSearchParams,
  signal: AbortSignal,
): Promise<CommentListResponse> {
  const value = await apiRequest<unknown>(
    `/api/forum/posts/${encodeURIComponent(postId)}/comments`,
    { query, signal },
  );
  return parseCommentList(value);
}

export async function createForumComment(
  postId: string,
  content: string,
): Promise<ForumCommentResponse> {
  const value = await apiRequest<unknown>(
    `/api/forum/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      body: { content },
    },
  );
  return parseForumCommentResponse(value);
}
