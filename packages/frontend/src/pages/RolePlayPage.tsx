import React, { useState } from 'react';
import { RolePlayCard } from '../components/RolePlayCard';
import { ParsedResumeData } from '../types';
import './agents.css';

export const RolePlayPage: React.FC = () => {
    const [resumeData, setResumeData] = useState<ParsedResumeData | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [showForm, setShowForm] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (jobDescription.trim()) {
            setShowForm(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Role-Play - Mock Interview Simulator</h1>
                <p>Practice with an AI interviewer and get real-time feedback</p>
            </div>

            {showForm ? (
                <div className="form-container">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="resume">Resume Data (JSON) - Optional:</label>
                            <textarea
                                id="resume"
                                value={resumeData ? JSON.stringify(resumeData, null, 2) : ''}
                                onChange={(e) => {
                                    try {
                                        if (e.target.value.trim()) {
                                            setResumeData(JSON.parse(e.target.value));
                                        } else {
                                            setResumeData(null);
                                        }
                                    } catch {
                                        // Invalid JSON, ignore
                                    }
                                }}
                                placeholder="Paste your parsed resume data as JSON (optional)"
                                rows={6}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="jd">Job Description:</label>
                            <textarea
                                id="jd"
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the job description"
                                rows={6}
                                required
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-primary">
                                Continue
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="content-container">
                    {jobDescription && (
                        <RolePlayCard
                            resumeData={resumeData || undefined}
                            jobDescription={jobDescription}
                        />
                    )}
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-secondary"
                    >
                        ← Back to Input
                    </button>
                </div>
            )}
        </div>
    );
};

export default RolePlayPage;
