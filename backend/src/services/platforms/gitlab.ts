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
        Authorization: `Bearer ${this.token}`,
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
      const allProjects: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const projects = await this.makeRequest(
          `/projects?membership=true&simple=true&per_page=100&page=${page}`
        );

        if (projects.length === 0) {
          hasMore = false;
          break;
        }

        allProjects.push(...projects);

        // Check if we need to fetch more pages
        if (projects.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return allProjects.map((project: any) => ({
        id: project.id.toString(),
        name: project.name_with_namespace,
        url: project.web_url,
      }));
    } catch (error) {
      console.error('Failed to fetch GitLab projects:', error);
      return [];
    }
  }

  async getMilestones(
    projectId: string
  ): Promise<
    { id: string; title: string; description?: string; type: string; groupName?: string }[]
  > {
    try {
      const milestones: any[] = [];

      // Get project details to find group information
      const project = await this.makeRequest(`/projects/${projectId}`);

      // 1. Get project milestones for the specific project
      try {
        const projectMilestones = await this.makeRequest(
          `/projects/${projectId}/milestones?state=active`
        );
        milestones.push(
          ...projectMilestones.map((milestone: any) => ({
            id: `project_${milestone.id}`,
            title: milestone.title,
            description: milestone.description || '',
            type: 'project',
            groupName: project.name_with_namespace,
          }))
        );
      } catch (error) {
        console.error('Failed to fetch project milestones:', error);
      }

      // 2. If project belongs to a group, get all group-related milestones
      if (project.namespace && project.namespace.kind === 'group') {
        const groupId = project.namespace.id;

        // Find the root group and get comprehensive milestones from the entire hierarchy
        const rootGroup = await this.findRootGroup(groupId);
        await this.getAllGroupMilestones(rootGroup.id, milestones);

        // Also get milestones from the immediate group if it's different from root
        if (rootGroup.id !== groupId) {
          await this.getAllGroupMilestones(groupId, milestones);
        }
      }

      // Remove duplicates based on milestone ID and project/group combination
      const uniqueMilestones = milestones.filter((milestone, index, self) => {
        return (
          index ===
          self.findIndex(m => {
            // For project milestones, compare by milestone ID and project/group name
            if (m.type === 'project' && milestone.type === 'project') {
              // Extract milestone ID from both formats (project_123 or project_123_456)
              const mId = this.extractOriginalMilestoneId(m.id);
              const milestoneId = this.extractOriginalMilestoneId(milestone.id);

              // Compare milestone ID and group name to ensure they're the same milestone
              return mId === milestoneId && m.groupName === milestone.groupName;
            }

            // For group/subgroup milestones, compare by milestone ID and group path
            if (
              (m.type === 'group' || m.type === 'subgroup') &&
              (milestone.type === 'group' || milestone.type === 'subgroup')
            ) {
              const mId = this.extractOriginalMilestoneId(m.id);
              const milestoneId = this.extractOriginalMilestoneId(milestone.id);
              return mId === milestoneId && m.groupName === milestone.groupName;
            }

            // Default comparison by full ID for other types
            return m.id === milestone.id;
          })
        );
      });

      // Sort milestones by type and title
      return uniqueMilestones.sort((a, b) => {
        // First sort by type (project, group, subgroup, parent groups)
        const typeOrder = { project: 0, group: 1, subgroup: 2, parent_group: 3 };
        const aOrder = typeOrder[a.type as keyof typeof typeOrder] || 4;
        const bOrder = typeOrder[b.type as keyof typeof typeOrder] || 4;

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

  private async findRootGroup(groupId: string): Promise<any> {
    try {
      const group = await this.makeRequest(`/groups/${groupId}`);

      // If this group has a parent, recursively find the root
      if (group.parent_id) {
        return await this.findRootGroup(group.parent_id);
      }

      // This is the root group
      return group;
    } catch (error) {
      console.error(`Failed to find root group for ${groupId}:`, error);
      // Fallback to the current group
      return await this.makeRequest(`/groups/${groupId}`);
    }
  }

  private async getAllGroupMilestones(groupId: string, milestones: any[]): Promise<void> {
    try {
      // Get the main group details
      const group = await this.makeRequest(`/groups/${groupId}`);

      // 1. Get direct group milestones
      try {
        const groupMilestones = await this.makeRequest(
          `/groups/${groupId}/milestones?state=active`
        );
        milestones.push(
          ...groupMilestones.map((milestone: any) => ({
            id: `group_${milestone.id}`,
            title: milestone.title,
            description: milestone.description || '',
            type: 'group',
            groupName: group.full_path,
          }))
        );
      } catch (error) {
        console.error(`Failed to fetch milestones for group ${groupId}:`, error);
      }

      // 2. Get all subgroups and their milestones
      try {
        const subgroups = await this.makeRequest(`/groups/${groupId}/subgroups`);
        for (const subgroup of subgroups) {
          try {
            const subgroupMilestones = await this.makeRequest(
              `/groups/${subgroup.id}/milestones?state=active`
            );
            milestones.push(
              ...subgroupMilestones.map((milestone: any) => ({
                id: `subgroup_${milestone.id}`,
                title: milestone.title,
                description: milestone.description || '',
                type: 'subgroup',
                groupName: subgroup.full_path,
              }))
            );

            // Recursively get milestones from nested subgroups
            await this.getAllGroupMilestones(subgroup.id, milestones);
          } catch (error) {
            console.error(`Failed to fetch milestones for subgroup ${subgroup.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch subgroups for group ${groupId}:`, error);
      }

      // 3. Get all projects in this group and their milestones
      try {
        // Get projects with pagination support
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const projects = await this.makeRequest(
            `/groups/${groupId}/projects?per_page=100&page=${page}&include_subgroups=true`
          );

          if (projects.length === 0) {
            hasMore = false;
            break;
          }

          for (const project of projects) {
            try {
              const projectMilestones = await this.makeRequest(
                `/projects/${project.id}/milestones?state=active`
              );
              milestones.push(
                ...projectMilestones.map((milestone: any) => ({
                  id: `project_${milestone.id}_${project.id}`, // Include project ID to avoid conflicts
                  title: milestone.title,
                  description: milestone.description || '',
                  type: 'project',
                  groupName: project.name_with_namespace,
                }))
              );
            } catch (error) {
              console.error(`Failed to fetch milestones for project ${project.id}:`, error);
            }
          }

          // Check if we need to fetch more pages
          if (projects.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch projects for group ${groupId}:`, error);
      }
    } catch (error) {
      console.error(`Failed to fetch group ${groupId}:`, error);
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

  private extractOriginalMilestoneId(milestoneId: string): string {
    // Extract original milestone ID from prefixed ID formats:
    // "project_123" -> "project_123"
    // "project_123_456" -> "project_123"  (remove project ID suffix)
    // "group_123" -> "group_123"
    // "subgroup_123" -> "subgroup_123"
    // "parent_group_123" -> "parent_group_123"

    // Handle project milestones with project ID suffix (project_123_456 -> project_123)
    let match = milestoneId.match(/^project_(\d+)_\d+$/);
    if (match) {
      return `project_${match[1]}`;
    }

    // Handle project milestones without suffix (project_123 -> project_123)
    match = milestoneId.match(/^project_(\d+)$/);
    if (match) {
      return `project_${match[1]}`;
    }

    // Handle all other prefixed formats (group, subgroup, parent_group)
    match = milestoneId.match(/^(group_|subgroup_|parent_group_)(.*)$/);
    if (match) {
      return match[1] + match[2];
    }

    // Fallback for plain numeric IDs
    return milestoneId;
  }

  private extractMilestoneId(milestoneId: string): number | undefined {
    // Extract actual milestone ID from prefixed ID formats:
    // "project_123" -> 123
    // "project_123_456" -> 123 (milestone 123 from project 456)
    // "group_123" -> 123
    // "subgroup_123" -> 123
    // "parent_group_123" -> 123

    // Handle project milestones with project ID suffix
    let match = milestoneId.match(/^project_(\d+)_\d+$/);
    if (match) {
      return parseInt(match[1]);
    }

    // Handle all other prefixed formats
    match = milestoneId.match(/^(project_|group_|subgroup_|parent_group_)(\d+)$/);
    if (match) {
      return parseInt(match[2]);
    }

    // Fallback for plain numeric IDs
    return parseInt(milestoneId);
  }
}
