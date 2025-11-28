import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface PromptTemplate {
    id: string;
    name: string;
    scenario: string;
    language: string;
    template: string;
    variables: string[];
    provider?: string;
    isEncrypted: boolean;
    isActive: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePromptDto {
    name: string;
    scenario: string;
    language: string;
    template: string;
    variables?: string[];
    provider?: string;
    isEncrypted?: boolean;
}

export interface PromptListResponse {
    data: PromptTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const promptAdminService = {
    /**
     * List all prompts with optional filters
     */
    async listPrompts(params?: {
        scenario?: string;
        language?: string;
        page?: number;
        limit?: number;
    }): Promise<PromptListResponse> {
        const response = await axios.get(`${API_BASE_URL}/admin/prompts`, { params });
        return response.data;
    },

    /**
     * Get a specific prompt by ID
     */
    async getPrompt(id: string): Promise<PromptTemplate> {
        const response = await axios.get(`${API_BASE_URL}/admin/prompts/${id}`);
        return response.data;
    },

    /**
     * Create a new prompt
     */
    async createPrompt(data: CreatePromptDto): Promise<PromptTemplate> {
        const response = await axios.post(`${API_BASE_URL}/admin/prompts`, data);
        return response.data;
    },

    /**
     * Update an existing prompt
     */
    async updatePrompt(
        id: string,
        data: Partial<CreatePromptDto>
    ): Promise<PromptTemplate> {
        const response = await axios.put(`${API_BASE_URL}/admin/prompts/${id}`, data);
        return response.data;
    },

    /**
     * Delete a prompt
     */
    async deletePrompt(id: string): Promise<void> {
        await axios.delete(`${API_BASE_URL}/admin/prompts/${id}`);
    },

    /**
     * Get version history for a prompt scenario
     */
    async getVersions(scenario: string): Promise<any[]> {
        const response = await axios.get(
            `${API_BASE_URL}/admin/prompts/${scenario}/versions`
        );
        return response.data.versions || [];
    },

    /**
     * Rollback to a specific version
     */
    async rollback(scenario: string, version: number): Promise<PromptTemplate> {
        const response = await axios.post(
            `${API_BASE_URL}/admin/prompts/${scenario}/rollback`,
            { version }
        );
        return response.data.template;
    },

    /**
     * Reload templates from database
     */
    async reloadTemplates(): Promise<void> {
        await axios.post(`${API_BASE_URL}/admin/prompts/reload`);
    },
};
