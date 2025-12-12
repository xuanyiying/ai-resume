import React, { useState } from 'react';
import { strategistService } from '../services';
import { ParsedResumeData } from '../types';
import './StrategistCard.css';

interface StrategistCardProps {
    resumeData: ParsedResumeData;
    jobDescription: string;
}

interface InterviewQuestion {
    id: string;
    question: string;
    category: 'technical' | 'behavioral' | 'scenario';
    difficulty: 'easy' | 'medium' | 'hard';
    priority: 'must-prepare' | 'important' | 'optional';
    source: 'custom' | 'knowledge-base';
}

interface QuestionBankResult {
    questions: InterviewQuestion[];
    categorization: {
        technical: number;
        behavioral: number;
        scenario: number;
    };
    totalQuestions: number;
    focusAreas: string[];
}

type SortBy = 'priority' | 'difficulty' | 'category';
type FilterCategory = 'all' | 'technical' | 'behavioral' | 'scenario';

export const StrategistCard: React.FC<StrategistCardProps> = ({
    resumeData,
    jobDescription,
}) => {
    const [experienceLevel, setExperienceLevel] = useState<'junior' | 'mid' | 'senior'>('mid');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<QuestionBankResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>('priority');
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

    const handleGenerate = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await strategistService.generateQuestionBank(
                resumeData,
                jobDescription,
                experienceLevel
            );
            setResult(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate question bank');
        } finally {
            setLoading(false);
        }
    };

    const getFilteredAndSortedQuestions = (): InterviewQuestion[] => {
        if (!result) return [];

        let filtered = result.questions;

        // Apply category filter
        if (filterCategory !== 'all') {
            filtered = filtered.filter((q) => q.category === filterCategory);
        }

        // Apply sorting
        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'priority') {
                const priorityOrder = { 'must-prepare': 0, important: 1, optional: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            } else if (sortBy === 'difficulty') {
                const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
                return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
            } else {
                return a.category.localeCompare(b.category);
            }
        });

        return sorted;
    };

    const getPriorityColor = (priority: string): string => {
        switch (priority) {
            case 'must-prepare':
                return '#dc3545';
            case 'important':
                return '#ffc107';
            case 'optional':
                return '#6c757d';
            default:
                return '#999';
        }
    };

    const getDifficultyColor = (difficulty: string): string => {
        switch (difficulty) {
            case 'easy':
                return '#28a745';
            case 'medium':
                return '#ffc107';
            case 'hard':
                return '#dc3545';
            default:
                return '#999';
        }
    };

    const filteredQuestions = getFilteredAndSortedQuestions();

    return (
        <div className="strategist-card">
            <h2>Strategist - Interview Question Bank Generator</h2>

            {/* Configuration Section */}
            <div className="strategist-config">
                <div className="config-group">
                    <label htmlFor="experience">Experience Level:</label>
                    <select
                        id="experience"
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value as any)}
                        disabled={loading}
                    >
                        <option value="junior">Junior (0-2 years)</option>
                        <option value="mid">Mid-level (2-5 years)</option>
                        <option value="senior">Senior (5+ years)</option>
                    </select>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="btn-primary"
                >
                    {loading ? 'Generating...' : 'Generate Question Bank'}
                </button>
            </div>

            {/* Error Display */}
            {error && <div className="error-message">{error}</div>}

            {/* Results Section */}
            {result && (
                <div className="strategist-results">
                    {/* Summary Stats */}
                    <div className="result-section summary-section">
                        <h3>Question Bank Summary</h3>
                        <div className="summary-stats">
                            <div className="stat-card">
                                <div className="stat-number">{result.totalQuestions}</div>
                                <div className="stat-label">Total Questions</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-number">{result.categorization.technical}</div>
                                <div className="stat-label">Technical</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-number">{result.categorization.behavioral}</div>
                                <div className="stat-label">Behavioral</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-number">{result.categorization.scenario}</div>
                                <div className="stat-label">Scenario</div>
                            </div>
                        </div>
                    </div>

                    {/* Focus Areas */}
                    {result.focusAreas && result.focusAreas.length > 0 && (
                        <div className="result-section">
                            <h3>Focus Areas</h3>
                            <div className="focus-areas">
                                {result.focusAreas.map((area, idx) => (
                                    <span key={idx} className="focus-tag">
                                        {area}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filters and Sorting */}
                    <div className="result-section controls-section">
                        <div className="controls">
                            <div className="control-group">
                                <label htmlFor="filter">Filter by Category:</label>
                                <select
                                    id="filter"
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value as any)}
                                >
                                    <option value="all">All Categories</option>
                                    <option value="technical">Technical</option>
                                    <option value="behavioral">Behavioral</option>
                                    <option value="scenario">Scenario</option>
                                </select>
                            </div>

                            <div className="control-group">
                                <label htmlFor="sort">Sort by:</label>
                                <select
                                    id="sort"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                >
                                    <option value="priority">Priority</option>
                                    <option value="difficulty">Difficulty</option>
                                    <option value="category">Category</option>
                                </select>
                            </div>
                        </div>
                        <div className="results-count">
                            Showing {filteredQuestions.length} of {result.totalQuestions} questions
                        </div>
                    </div>

                    {/* Questions List */}
                    <div className="result-section questions-section">
                        <h3>Interview Questions</h3>
                        <div className="questions-list">
                            {filteredQuestions.length > 0 ? (
                                filteredQuestions.map((question, idx) => (
                                    <div key={question.id} className="question-item">
                                        <div className="question-header">
                                            <span className="question-number">{idx + 1}.</span>
                                            <span className="question-text">{question.question}</span>
                                        </div>
                                        <div className="question-meta">
                                            <span
                                                className="badge priority"
                                                style={{ backgroundColor: getPriorityColor(question.priority) }}
                                            >
                                                {question.priority}
                                            </span>
                                            <span
                                                className="badge difficulty"
                                                style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                                            >
                                                {question.difficulty}
                                            </span>
                                            <span className="badge category">
                                                {question.category}
                                            </span>
                                            <span className="badge source">
                                                {question.source === 'knowledge-base' ? 'KB' : 'Custom'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-results">
                                    No questions match the selected filters
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
