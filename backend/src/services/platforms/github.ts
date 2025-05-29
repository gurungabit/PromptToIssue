import { Octokit } from '@octokit/rest';
import type { PlatformClient, PlatformTicket, CreatedTicket } from './types.js';

export class GitHubClient implements PlatformClient {
  name = 'github';
  private client: Octokit;

  constructor(token: string) {
    this.client = new Octokit({ auth: token });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.rest.users.getAuthenticated();
      return true;
    } catch (error) {
      console.error('GitHub connection test failed:', error);
      return false;
    }
  }

  async getProjects(): Promise<{ id: string; name: string; url: string }[]> {
    try {
      const { data: repos } = await this.client.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });

      return repos.map(repo => ({
        id: `${repo.owner.login}/${repo.name}`,
        name: repo.full_name,
        url: repo.html_url,
      }));
    } catch (error) {
      console.error('Failed to fetch GitHub repositories:', error);
      return [];
    }
  }

  async createTicket(projectId: string, ticket: PlatformTicket): Promise<CreatedTicket> {
    const [owner, repo] = projectId.split('/');
    
    const issueData = {
      owner,
      repo,
      title: ticket.title,
      body: ticket.description,
      labels: ticket.labels,
      assignee: ticket.assignee,
      milestone: ticket.milestone ? parseInt(ticket.milestone) : undefined,
    };

    const { data: issue } = await this.client.rest.issues.create(issueData);

    return {
      id: issue.number.toString(),
      url: issue.html_url,
      title: issue.title,
      number: issue.number,
    };
  }

  async updateTicket(
    projectId: string,
    ticketId: string,
    ticket: Partial<PlatformTicket>
  ): Promise<CreatedTicket> {
    const [owner, repo] = projectId.split('/');
    const issue_number = parseInt(ticketId);

    const updateData: any = {
      owner,
      repo,
      issue_number,
    };

    if (ticket.title) updateData.title = ticket.title;
    if (ticket.description) updateData.body = ticket.description;
    if (ticket.labels) updateData.labels = ticket.labels;
    if (ticket.assignee) updateData.assignee = ticket.assignee;
    if (ticket.milestone) updateData.milestone = parseInt(ticket.milestone);

    const { data: issue } = await this.client.rest.issues.update(updateData);

    return {
      id: issue.number.toString(),
      url: issue.html_url,
      title: issue.title,
      number: issue.number,
    };
  }
} 