import type { PlatformClient, PlatformTicket, CreatedTicket } from './types.js';

export class GitLabClient implements PlatformClient {
  name = 'gitlab';
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}/api/v4${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `GitLab API error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        } else if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        } else if (typeof errorData === 'string') {
          errorMessage += ` - ${errorData}`;
        }
      } catch {
        // If we can't parse JSON, fall back to text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        } catch {
          // If all else fails, just use the status
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/user');
      return true;
    } catch (error) {
      console.error('GitLab connection test failed:', error);
      return false;
    }
  }

  async getProjects(): Promise<{ id: string; name: string; url: string }[]> {
    try {
      const projects = await this.makeRequest('/projects?membership=true&simple=true');
      return projects.map((project: any) => ({
        id: project.id.toString(),
        name: project.name_with_namespace,
        url: project.web_url,
      }));
    } catch (error) {
      console.error('Failed to fetch GitLab projects:', error);
      return [];
    }
  }

  async getMilestones(projectId: string): Promise<{ id: string; title: string; description?: string; type: string; groupName?: string }[]> {
    try {
      const milestones: any[] = [];
      
      // Get project details to find group information
      const project = await this.makeRequest(`/projects/${projectId}`);
      
      // 1. Get project milestones
      try {
        const projectMilestones = await this.makeRequest(`/projects/${projectId}/milestones`);
        milestones.push(...projectMilestones.map((milestone: any) => ({
          id: `project_${milestone.id}`,
          title: milestone.title,
          description: milestone.description || '',
          type: 'project',
          groupName: project.name,
        })));
      } catch (error) {
        console.error('Failed to fetch project milestones:', error);
      }
      
      // 2. Get group milestones if project belongs to a group
      if (project.namespace && project.namespace.kind === 'group') {
        const groupId = project.namespace.id;
        
        try {
          const groupMilestones = await this.makeRequest(`/groups/${groupId}/milestones`);
          milestones.push(...groupMilestones.map((milestone: any) => ({
            id: `group_${milestone.id}`,
            title: milestone.title,
            description: milestone.description || '',
            type: 'group',
            groupName: project.namespace.full_path,
          })));
        } catch (error) {
          console.error('Failed to fetch group milestones:', error);
        }
        
        // 3. Get parent group milestones (for nested groups)
        try {
          const group = await this.makeRequest(`/groups/${groupId}`);
          if (group.parent_id) {
            await this.getParentGroupMilestones(group.parent_id, milestones);
          }
        } catch (error) {
          console.error('Failed to fetch parent group info:', error);
        }
      }
      
      // Sort milestones by type and title
      return milestones.sort((a, b) => {
        // First sort by type (project, group, parent groups)
        const typeOrder = { project: 0, group: 1, parent_group: 2 };
        const aOrder = typeOrder[a.type as keyof typeof typeOrder] || 3;
        const bOrder = typeOrder[b.type as keyof typeof typeOrder] || 3;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        // Then sort by title
        return a.title.localeCompare(b.title);
      });
    } catch (error) {
      console.error('Failed to fetch GitLab milestones:', error);
      return [];
    }
  }
  
  private async getParentGroupMilestones(parentGroupId: string, milestones: any[]): Promise<void> {
    try {
      const parentGroup = await this.makeRequest(`/groups/${parentGroupId}`);
      
      // Get milestones for this parent group
      try {
        const parentMilestones = await this.makeRequest(`/groups/${parentGroupId}/milestones`);
        milestones.push(...parentMilestones.map((milestone: any) => ({
          id: `parent_group_${milestone.id}`,
          title: milestone.title,
          description: milestone.description || '',
          type: 'parent_group',
          groupName: parentGroup.full_path,
        })));
      } catch (error) {
        console.error(`Failed to fetch milestones for parent group ${parentGroupId}:`, error);
      }
      
      // Recursively get milestones from even higher parent groups
      if (parentGroup.parent_id) {
        await this.getParentGroupMilestones(parentGroup.parent_id, milestones);
      }
    } catch (error) {
      console.error(`Failed to fetch parent group ${parentGroupId}:`, error);
    }
  }

  async createTicket(projectId: string, ticket: PlatformTicket): Promise<CreatedTicket> {
    const issueData = {
      title: ticket.title,
      description: ticket.description,
      labels: ticket.labels.join(','),
      assignee_id: ticket.assignee ? parseInt(ticket.assignee) : undefined,
      milestone_id: ticket.milestone ? this.extractMilestoneId(ticket.milestone) : undefined,
      due_date: ticket.dueDate ? ticket.dueDate.toISOString().split('T')[0] : undefined,
    };

    const issue = await this.makeRequest(`/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(issueData),
    });

    return {
      id: issue.iid.toString(),
      url: issue.web_url,
      title: issue.title,
      number: issue.iid,
    };
  }

  async updateTicket(
    projectId: string,
    ticketId: string,
    ticket: Partial<PlatformTicket>
  ): Promise<CreatedTicket> {
    const updateData: any = {};
    
    if (ticket.title) updateData.title = ticket.title;
    if (ticket.description) updateData.description = ticket.description;
    if (ticket.labels) updateData.labels = ticket.labels.join(',');
    if (ticket.assignee) updateData.assignee_id = parseInt(ticket.assignee);
    if (ticket.milestone) updateData.milestone_id = this.extractMilestoneId(ticket.milestone);
    if (ticket.dueDate) updateData.due_date = ticket.dueDate.toISOString().split('T')[0];

    const issue = await this.makeRequest(`/projects/${projectId}/issues/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    return {
      id: issue.iid.toString(),
      url: issue.web_url,
      title: issue.title,
      number: issue.iid,
    };
  }

  private extractMilestoneId(milestoneId: string): number | undefined {
    // Extract actual milestone ID from prefixed ID (e.g., "project_123" -> 123)
    const match = milestoneId.match(/^(project_|group_|parent_group_)(\d+)$/);
    return match ? parseInt(match[2]) : parseInt(milestoneId);
  }
} 