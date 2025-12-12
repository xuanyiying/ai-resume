import React, { useState, useEffect } from 'react';
import { agentMetricsService } from '../services';
import './AgentMetricsDashboard.css';

interface TokenUsageItem {
    key: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    callCount: number;
    averageTokensPerCall: number;
}

interface CostItem {
    key: string;
    cost: number;
    callCount: number;
    inputTokens: number;
    outputTokens: number;
    averageCostPerCall: number;
}

interface SavingsReport {
    totalSavingsFromCaching: number;
    totalSavingsFromCompression: number;
    totalSavingsFromModelRouting: number;
    totalSavings: number;
    savingsPercentage: number;
}

type GroupBy = 'agent-type' | 'workflow-step' | 'model';

export const AgentMetricsDashboard: React.FC = () => {
    const [startDate, setStartDate] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [groupBy, setGroupBy] = useState<GroupBy>('agent-type');
    const [agentType, setAgentType] = useState<string>('');

    const [tokenUsageData, setTokenUsageData] = useState<TokenUsageItem[]>([]);
    const [costData, setCostData] = useState<CostItem[]>([]);
    const [savingsData, setSavingsData] = useState<SavingsReport | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLoadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [tokenUsage, costReport, savings] = await Promise.all([
                agentMetricsService.getTokenUsageReport(
                    startDate,
                    endDate,
                    groupBy,
                    agentType || undefined
                ),
                agentMetricsService.getCostReport(
                    startDate,
                    endDate,
                    groupBy,
                    agentType || undefined
                ),
                agentMetricsService.getOptimizationSavingsReport(
                    startDate,
                    endDate,
                    agentType || undefined
                ),
            ]);

            setTokenUsageData(tokenUsage.items || []);
            setCostData(costReport.items || []);
            setSavingsData(savings);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load metrics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleLoadData();
    }, []);

    const totalTokens = tokenUsageData.reduce((sum, item) => sum + item.totalTokens, 0);
    const totalCost = costData.reduce((sum, item) => sum + item.cost, 0);
    const totalCalls = tokenUsageData.reduce((sum, item) => sum + item.callCount, 0);

    return (
        <div className="agent-metrics-dashboard">
            <h2>Agent Metrics Dashboard</h2>

            {/* Filters */}
            <div className="dashboard-filters">
                <div className="filter-group">
                    <label htmlFor="start-date">Start Date:</label>
                    <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <div className="filter-group">
                    <label htmlFor="end-date">End Date:</label>
                    <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <div className="filter-group">
                    <label htmlFor="group-by">Group By:</label>
                    <select
                        id="group-by"
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as any)}
                        disabled={loading}
                    >
                        <option value="agent-type">Agent Type</option>
                        <option value="workflow-step">Workflow Step</option>
                        <option value="model">Model</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="agent-type">Agent Type (optional):</label>
                    <input
                        id="agent-type"
                        type="text"
                        value={agentType}
                        onChange={(e) => setAgentType(e.target.value)}
                        placeholder="e.g., pitch-perfect"
                        disabled={loading}
                    />
                </div>

                <button
                    onClick={handleLoadData}
                    disabled={loading}
                    className="btn-refresh"
                >
                    {loading ? 'Loading...' : 'Refresh Data'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card">
                    <div className="card-label">Total Tokens</div>
                    <div className="card-value">{totalTokens.toLocaleString()}</div>
                </div>
                <div className="summary-card">
                    <div className="card-label">Total Cost</div>
                    <div className="card-value">${totalCost.toFixed(2)}</div>
                </div>
                <div className="summary-card">
                    <div className="card-label">Total Calls</div>
                    <div className="card-value">{totalCalls.toLocaleString()}</div>
                </div>
                <div className="summary-card">
                    <div className="card-label">Avg Tokens/Call</div>
                    <div className="card-value">
                        {totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0}
                    </div>
                </div>
            </div>

            {/* Token Usage Table */}
            <div className="dashboard-section">
                <h3>Token Usage by {groupBy === 'agent-type' ? 'Agent' : groupBy === 'workflow-step' ? 'Workflow Step' : 'Model'}</h3>
                <div className="table-container">
                    <table className="metrics-table">
                        <thead>
                            <tr>
                                <th>{groupBy === 'agent-type' ? 'Agent' : groupBy === 'workflow-step' ? 'Step' : 'Model'}</th>
                                <th>Total Tokens</th>
                                <th>Input Tokens</th>
                                <th>Output Tokens</th>
                                <th>Calls</th>
                                <th>Avg Tokens/Call</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tokenUsageData.length > 0 ? (
                                tokenUsageData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="key-cell">{item.key}</td>
                                        <td className="number-cell">{item.totalTokens.toLocaleString()}</td>
                                        <td className="number-cell">{item.inputTokens.toLocaleString()}</td>
                                        <td className="number-cell">{item.outputTokens.toLocaleString()}</td>
                                        <td className="number-cell">{item.callCount}</td>
                                        <td className="number-cell">{item.averageTokensPerCall}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="no-data">
                                        No data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cost Table */}
            <div className="dashboard-section">
                <h3>Cost by {groupBy === 'agent-type' ? 'Agent' : groupBy === 'workflow-step' ? 'Workflow Step' : 'Model'}</h3>
                <div className="table-container">
                    <table className="metrics-table">
                        <thead>
                            <tr>
                                <th>{groupBy === 'agent-type' ? 'Agent' : groupBy === 'workflow-step' ? 'Step' : 'Model'}</th>
                                <th>Cost</th>
                                <th>Calls</th>
                                <th>Input Tokens</th>
                                <th>Output Tokens</th>
                                <th>Avg Cost/Call</th>
                            </tr>
                        </thead>
                        <tbody>
                            {costData.length > 0 ? (
                                costData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="key-cell">{item.key}</td>
                                        <td className="number-cell">${item.cost.toFixed(4)}</td>
                                        <td className="number-cell">{item.callCount}</td>
                                        <td className="number-cell">{item.inputTokens.toLocaleString()}</td>
                                        <td className="number-cell">{item.outputTokens.toLocaleString()}</td>
                                        <td className="number-cell">${item.averageCostPerCall.toFixed(4)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="no-data">
                                        No data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Optimization Savings */}
            {savingsData && (
                <div className="dashboard-section">
                    <h3>Optimization Savings</h3>
                    <div className="savings-grid">
                        <div className="savings-card">
                            <div className="savings-label">Caching Savings</div>
                            <div className="savings-value">
                                {savingsData.totalSavingsFromCaching.toLocaleString()} tokens
                            </div>
                        </div>
                        <div className="savings-card">
                            <div className="savings-label">Compression Savings</div>
                            <div className="savings-value">
                                {savingsData.totalSavingsFromCompression.toLocaleString()} tokens
                            </div>
                        </div>
                        <div className="savings-card">
                            <div className="savings-label">Model Routing Savings</div>
                            <div className="savings-value">
                                {savingsData.totalSavingsFromModelRouting.toLocaleString()} tokens
                            </div>
                        </div>
                        <div className="savings-card total">
                            <div className="savings-label">Total Savings</div>
                            <div className="savings-value">
                                {savingsData.totalSavings.toLocaleString()} tokens
                            </div>
                            <div className="savings-percentage">
                                {savingsData.savingsPercentage.toFixed(1)}% reduction
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
