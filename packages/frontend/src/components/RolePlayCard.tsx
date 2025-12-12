import React, { useState, useRef, useEffect } from 'react';
import { rolePlayService } from '../services';
import { ParsedResumeData } from '../types';
import './RolePlayCard.css';

interface RolePlayCardProps {
    resumeData?: ParsedResumeData;
    jobDescription: string;
}

interface Message {
    role: 'interviewer' | 'user';
    content: string;
    timestamp: Date;
}

interface RealTimeAnalysis {
    keywords: string[];
    sentiment: string;
    suggestions: string[];
    relevanceScore: number;
}

interface InterviewFeedback {
    scores: {
        clarity: number;
        relevance: number;
        depth: number;
        communication: number;
    };
    strengths: string[];
    improvements: string[];
    radarChartData: Array<{ category: string; value: number }>;
}

export const RolePlayCard: React.FC<RolePlayCardProps> = ({
    resumeData,
    jobDescription,
}) => {
    const [interviewerStyle, setInterviewerStyle] = useState<'strict' | 'friendly' | 'stress-test'>('friendly');
    const [focusAreas, setFocusAreas] = useState<string>('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
    const [interviewActive, setInterviewActive] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleStartInterview = async () => {
        try {
            setLoading(true);
            setError(null);

            const focusAreasArray = focusAreas
                .split(',')
                .map((area) => area.trim())
                .filter((area) => area.length > 0);

            const response = await rolePlayService.startInterview(
                jobDescription,
                interviewerStyle,
                focusAreasArray,
                resumeData
            );

            setSessionId(response.sessionId);
            setMessages([
                {
                    role: 'interviewer',
                    content: response.currentQuestion,
                    timestamp: new Date(),
                },
            ]);
            setInterviewActive(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start interview');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitResponse = async () => {
        if (!userInput.trim() || !sessionId) return;

        try {
            setAnalyzing(true);
            setError(null);

            // Add user message
            const userMessage: Message = {
                role: 'user',
                content: userInput,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMessage]);
            setUserInput('');

            // Process response
            const response = await rolePlayService.processResponse(
                sessionId,
                userInput
            );

            // Add interviewer follow-up
            const interviewerMessage: Message = {
                role: 'interviewer',
                content: response.followUpQuestion,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, interviewerMessage]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process response');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleConcludeInterview = async () => {
        if (!sessionId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await rolePlayService.concludeInterview(sessionId);
            setFeedback(response);
            setInterviewActive(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to conclude interview');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSessionId(null);
        setMessages([]);
        setUserInput('');
        setFeedback(null);
        setInterviewActive(false);
        setError(null);
    };

    return (
        <div className="role-play-card">
            <h2>Role-Play - Mock Interview Simulator</h2>

            {!interviewActive && !feedback && (
                <div className="interview-setup">
                    <div className="setup-group">
                        <label htmlFor="style">Interviewer Style:</label>
                        <select
                            id="style"
                            value={interviewerStyle}
                            onChange={(e) => setInterviewerStyle(e.target.value as any)}
                            disabled={loading}
                        >
                            <option value="friendly">Friendly & Supportive</option>
                            <option value="strict">Strict & Formal</option>
                            <option value="stress-test">Stress Test</option>
                        </select>
                    </div>

                    <div className="setup-group">
                        <label htmlFor="focus">Focus Areas (comma-separated):</label>
                        <input
                            id="focus"
                            type="text"
                            value={focusAreas}
                            onChange={(e) => setFocusAreas(e.target.value)}
                            placeholder="e.g., System Design, Leadership, Problem Solving"
                            disabled={loading}
                        />
                    </div>

                    <button
                        onClick={handleStartInterview}
                        disabled={loading}
                        className="btn-primary"
                    >
                        {loading ? 'Starting Interview...' : 'Start Interview'}
                    </button>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {interviewActive && (
                <div className="interview-container">
                    {/* Chat Area */}
                    <div className="chat-area">
                        <div className="messages-container">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`message message-${msg.role}`}>
                                    <div className="message-role">
                                        {msg.role === 'interviewer' ? '👤 Interviewer' : '👤 You'}
                                    </div>
                                    <div className="message-content">{msg.content}</div>
                                    <div className="message-time">
                                        {msg.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="input-area">
                            <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Type your response here..."
                                disabled={analyzing}
                                rows={3}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                        handleSubmitResponse();
                                    }
                                }}
                            />
                            <div className="input-actions">
                                <button
                                    onClick={handleSubmitResponse}
                                    disabled={analyzing || !userInput.trim()}
                                    className="btn-submit"
                                >
                                    {analyzing ? 'Analyzing...' : 'Submit Response'}
                                </button>
                                <button
                                    onClick={handleConcludeInterview}
                                    disabled={analyzing}
                                    className="btn-conclude"
                                >
                                    End Interview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {feedback && (
                <div className="feedback-container">
                    <h3>Interview Feedback</h3>

                    {/* Scores */}
                    <div className="feedback-section scores-section">
                        <h4>Performance Scores</h4>
                        <div className="scores-grid">
                            {feedback.scores &&
                                Object.entries(feedback.scores).map(([key, value]) => (
                                    <div key={key} className="score-item">
                                        <div className="score-label">
                                            {key.charAt(0).toUpperCase() + key.slice(1)}
                                        </div>
                                        <div className="score-bar">
                                            <div
                                                className="score-fill"
                                                style={{ width: `${value}%` }}
                                            />
                                        </div>
                                        <div className="score-value">{value}%</div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Strengths */}
                    {feedback.strengths && feedback.strengths.length > 0 && (
                        <div className="feedback-section">
                            <h4>Strengths</h4>
                            <ul className="feedback-list strengths">
                                {feedback.strengths.map((strength, idx) => (
                                    <li key={idx}>✓ {strength}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Areas for Improvement */}
                    {feedback.improvements && feedback.improvements.length > 0 && (
                        <div className="feedback-section">
                            <h4>Areas for Improvement</h4>
                            <ul className="feedback-list improvements">
                                {feedback.improvements.map((improvement, idx) => (
                                    <li key={idx}>→ {improvement}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Radar Chart Data */}
                    {feedback.radarChartData && feedback.radarChartData.length > 0 && (
                        <div className="feedback-section">
                            <h4>Skill Assessment</h4>
                            <div className="radar-data">
                                {feedback.radarChartData.map((item, idx) => (
                                    <div key={idx} className="radar-item">
                                        <span className="radar-label">{item.category}</span>
                                        <div className="radar-bar">
                                            <div
                                                className="radar-fill"
                                                style={{ width: `${item.value}%` }}
                                            />
                                        </div>
                                        <span className="radar-value">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={handleReset} className="btn-primary">
                        Start New Interview
                    </button>
                </div>
            )}
        </div>
    );
};
