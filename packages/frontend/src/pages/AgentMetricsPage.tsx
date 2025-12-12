import React from 'react';
import { AgentMetricsDashboard } from '../components/AgentMetricsDashboard';
import './agents.css';

export const AgentMetricsPage: React.FC = () => {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Agent Metrics & Analytics</h1>
                <p>
                    Monitor token usage, costs, and optimization savings across all agents
                </p>
            </div>

            <div className="content-container">
                <AgentMetricsDashboard />
            </div>
        </div>
    );
};

export default AgentMetricsPage;
