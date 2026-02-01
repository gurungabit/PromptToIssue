import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { nanoid } from 'nanoid';

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';
const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID;
const GITLAB_REDIRECT_URI = process.env.GITLAB_REDIRECT_URI || 'http://localhost:3000/api/gitlab/callback';

export async function GET() {
  const session = await auth();
  
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (!GITLAB_CLIENT_ID) {
    return new Response('GitLab not configured', { status: 500 });
  }
  
  // Generate state for CSRF protection
  const state = nanoid();
  
  // Store state in cookie for verification
  const response = redirect(
    `${GITLAB_URL}/oauth/authorize?` +
    `client_id=${GITLAB_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(GITLAB_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=api read_api read_user read_repository&` +
    `state=${state}`
  );
  
  return response;
}
