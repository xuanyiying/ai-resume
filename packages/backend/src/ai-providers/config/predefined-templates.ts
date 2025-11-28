import { PromptScenario } from '../interfaces/prompt-template.interface';

/**
 * Predefined template definitions with multi-language support
 */
export const PREDEFINED_TEMPLATES: Array<{
    name: string;
    scenario: string;
    language: string;
    template: string;
    variables: string[];
    provider?: string;
    isEncrypted: boolean;
}> = [
        // ============ ENGLISH TEMPLATES ============
        {
            name: 'resume_parsing_default',
            scenario: PromptScenario.RESUME_PARSING,
            language: 'en',
            template: `Please parse the following resume and extract the key information in JSON format:

Resume Content:
{resume_content}

Extract the following information:
1. Personal Information (name, email, phone, location)
2. Professional Summary
3. Work Experience (company, position, duration, responsibilities)
4. Education (school, degree, field, graduation date)
5. Skills (technical and soft skills)
6. Certifications and Awards
7. Languages

Return the result as valid JSON.`,
            variables: ['resume_content'],
            isEncrypted: false,
        },
        {
            name: 'job_description_parsing_default',
            scenario: PromptScenario.JOB_DESCRIPTION_PARSING,
            language: 'en',
            template: `Please parse the following job description and extract the key requirements:

Job Description:
{job_description}

Extract the following information:
1. Job Title
2. Company
3. Location
4. Job Type (Full-time, Part-time, Contract, etc.)
5. Salary Range (if available)
6. Required Skills
7. Required Experience
8. Responsibilities
9. Nice-to-have Skills
10. Benefits

Return the result as valid JSON.`,
            variables: ['job_description'],
            isEncrypted: false,
        },
        {
            name: 'resume_optimization_default',
            scenario: PromptScenario.RESUME_OPTIMIZATION,
            language: 'en',
            template: `Based on the following resume and job description, provide specific optimization suggestions:

Resume:
{resume_content}

Job Description:
{job_description}

Please provide:
1. Top 5 specific improvements to make the resume more relevant to this job
2. Keywords from the job description that should be added to the resume
3. Sections that should be reordered or emphasized
4. Specific achievements that should be highlighted
5. Any gaps that need to be addressed

Format each suggestion with a clear explanation of why it matters.`,
            variables: ['resume_content', 'job_description'],
            isEncrypted: false,
        },
        {
            name: 'interview_question_generation_default',
            scenario: PromptScenario.INTERVIEW_QUESTION_GENERATION,
            language: 'en',
            template: `Generate interview questions based on the following resume and job description:

Resume:
{resume_content}

Job Description:
{job_description}

Generate 5 interview questions that:
1. Are relevant to the job position
2. Assess the candidate's experience and skills
3. Include behavioral, technical, and situational questions
4. Are based on specific information from the resume

For each question, provide:
- The question itself
- The type (behavioral, technical, situational, or resume-based)
- A suggested answer framework
- Tips for evaluating the response

Return as JSON array.`,
            variables: ['resume_content', 'job_description'],
            isEncrypted: false,
        },
        {
            name: 'match_score_calculation_default',
            scenario: PromptScenario.MATCH_SCORE_CALCULATION,
            language: 'en',
            template: `Calculate a match score between the resume and job description:

Resume:
{resume_content}

Job Description:
{job_description}

Analyze the match across these dimensions:
1. Required Skills Match (0-100)
2. Experience Level Match (0-100)
3. Education Match (0-100)
4. Industry Experience Match (0-100)
5. Overall Cultural Fit (0-100)

For each dimension, provide:
- Score (0-100)
- Matching elements
- Missing elements
- Improvement suggestions

Calculate an overall match score (0-100) as a weighted average.
Return as JSON with detailed breakdown.`,
            variables: ['resume_content', 'job_description'],
            isEncrypted: false,
        },

        // ============ CHINESE TEMPLATES ============
        {
            name: 'resume_parsing_default',
            scenario: PromptScenario.RESUME_PARSING,
            language: 'zh-CN',
            template: `请解析以下简历并以JSON格式提取关键信息：

简历内容：
{resume_content}

提取以下信息：
1. 个人信息（姓名、邮箱、电话、地址）
2. 职业概述
3. 工作经历（公司、职位、时间、职责）
4. 教育背景（学校、学位、专业、毕业时间）
5. 技能（技术技能和软技能）
6. 证书和奖项
7. 语言能力

返回有效的JSON格式结果。`,
            variables: ['resume_content'],
            isEncrypted: false,
        },
        {
            name: 'job_description_parsing_default',
            scenario: PromptScenario.JOB_DESCRIPTION_PARSING,
            language: 'zh-CN',
            template: `请解析以下职位描述并提取关键要求：

职位描述：
{job_description}

提取以下信息：
1. 职位名称
2. 公司名称
3. 工作地点
4. 工作类型（全职、兼职、合同工等）
5. 薪资范围（如有）
6. 必需技能
7. 工作经验要求
8. 工作职责
9. 优先技能
10. 福利待遇

返回有效的JSON格式结果。`,
            variables: ['job_description'],
            isEncrypted: false,
        },
        {
            name: 'resume_optimization_default',
            scenario: PromptScenario.RESUME_OPTIMIZATION,
            language: 'zh-CN',
            template: `基于以下简历和职位描述，提供具体的优化建议：

简历：
{resume_content}

职位描述：
{job_description}

请提供：
1. 让简历更匹配该职位的5条具体改进建议
2. 应该添加到简历中的职位描述关键词
3. 应该重新排序或强调的章节
4. 应该突出的具体成就
5. 需要解决的任何不足之处

为每条建议提供清晰的解释，说明其重要性。`,
            variables: ['resume_content', 'job_description'],
            isEncrypted: false,
        },
        {
            name: 'interview_question_generation_default',
            scenario: PromptScenario.INTERVIEW_QUESTION_GENERATION,
            language: 'zh-CN',
            template: `基于以下简历和职位描述生成面试问题：

简历：
{resume_content}

职位描述：
{job_description}

生成5个面试问题，要求：
1. 与职位相关
2. 评估候选人的经验和技能
3. 包括行为、技术和情景类问题
4. 基于简历中的具体信息

对每个问题，提供：
- 问题本身
- 问题类型（行为、技术、情景或基于简历）
- 建议的回答框架
- 评估回答的技巧

以JSON数组格式返回。`,
            variables: ['resume_content', 'job_description'],
            isEncrypted: false,
        },
        {
            name: 'match_score_calculation_default',
            scenario: PromptScenario.MATCH_SCORE_CALCULATION,
            language: 'zh-CN',
            template: `计算简历和职位描述的匹配度：

简历：
{resume_content}

职位描述：
{job_description}

分析以下维度的匹配度：
1. 必需技能匹配（0-100）
2. 经验水平匹配（0-100）
3. 教育背景匹配（0-100）
4. 行业经验匹配（0-100）
5. 整体文化契合度（0-100）

对每个维度，提供：
- 分数（0-100）
- 匹配的要素
- 缺失的要素
- 改进建议

计算加权平均后的总体匹配分数（0-100）。
以JSON格式返回详细分解结果。`,
            variables: ['resume_content', 'job_description'],
            isEncrypted: false,
        },
    ];
