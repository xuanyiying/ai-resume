import React, { useState } from 'react';
import { StrategistCard } from '../components/StrategistCard';
import { ParsedResumeData } from '../types';
import './agents.css';

export const StrategistPage: React.FC = () => {
    const [resumeData, setResumeData] = useState<ParsedResumeData | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [showForm, setShowForm] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (resumeData && jobDescription.trim()) {
            setShowForm(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Strategist - Interview Question Bank Generator</h1>
                <p>Get a customized question bank tailored to your background and target position</p>
            </div>

            {showForm ? (
                <div className="form-container">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="resume">Resume Data (JSON):</label>
                            <textarea
                                id="resume"
                                value={resumeData ? JSON.stringify(resumeData, null, 2) : ''}
                                onChange={(e) => {
                                    try {
                                        setResumeData(JSON.parse(e.target.value));
                                    } catch {
                                        // Invalid JSON, ignore
                                    }
                                }}
                                placeholder="Paste your parsed resume data as JSON"
                                rows={8}
                                required
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
                    {resumeData && jobDescription && (
                        <StrategistCard
                            resumeData={resumeData}
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

export default StrategistPage;
