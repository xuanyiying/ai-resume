import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Space,
    message,
    Modal,
    Form,
    Input,
    Select,
    Tag,
    Tabs,
    Card,
    Typography,
    Tooltip,
    Popconfirm,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    HistoryOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
    promptAdminService,
    PromptTemplate,
    CreatePromptDto,
} from '../services/promptAdminService';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const PromptManagementPage: React.FC = () => {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
    const [form] = Form.useForm();
    const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
    const [selectedScenario, setSelectedScenario] = useState<string | undefined>();

    useEffect(() => {
        loadPrompts();
    }, [selectedLanguage, selectedScenario]);

    const loadPrompts = async () => {
        setLoading(true);
        try {
            const response = await promptAdminService.listPrompts({
                language: selectedLanguage,
                scenario: selectedScenario,
                limit: 100,
            });
            setPrompts(response.data);
        } catch (error) {
            message.error('加载提示词失败');
            console.error('Load prompts error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingPrompt(null);
        form.resetFields();
        form.setFieldsValue({ language: selectedLanguage });
        setModalVisible(true);
    };

    const handleEdit = (prompt: PromptTemplate) => {
        setEditingPrompt(prompt);
        form.setFieldsValue(prompt);
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await promptAdminService.deletePrompt(id);
            message.success('删除成功');
            loadPrompts();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleSubmit = async (values: CreatePromptDto) => {
        try {
            if (editingPrompt) {
                await promptAdminService.updatePrompt(editingPrompt.id, values);
                message.success('更新成功');
            } else {
                await promptAdminService.createPrompt(values);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadPrompts();
        } catch (error) {
            message.error(editingPrompt ? '更新失败' : '创建失败');
        }
    };

    const extractVariables = (template: string): string[] => {
        const matches = template.match(/{([^}]+)}/g);
        if (!matches) return [];
        return [...new Set(matches.map((m) => m.slice(1, -1)))];
    };

    const columns: ColumnsType<PromptTemplate> = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 200,
            fixed: 'left',
        },
        {
            title: '场景',
            dataIndex: 'scenario',
            key: 'scenario',
            width: 180,
            render: (scenario: string) => (
                <Tag color="blue">{scenario.replace(/_/g, ' ')}</Tag>
            ),
        },
        {
            title: '语言',
            dataIndex: 'language',
            key: 'language',
            width: 80,
            render: (lang: string) => (
                <Tag color={lang === 'en' ? 'green' : 'orange'}>
                    {lang === 'en' ? 'EN' : 'CN'}
                </Tag>
            ),
        },
        {
            title: '模板预览',
            dataIndex: 'template',
            key: 'template',
            ellipsis: true,
            render: (template: string) => (
                <Tooltip title={template}>
                    <Text ellipsis>{template.substring(0, 100)}...</Text>
                </Tooltip>
            ),
        },
        {
            title: '变量',
            dataIndex: 'variables',
            key: 'variables',
            width: 150,
            render: (variables: string[]) => (
                <Space size={[0, 4]} wrap>
                    {variables.map((v) => (
                        <Tag key={v} color="purple">
                            {v}
                        </Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: '版本',
            dataIndex: 'version',
            key: 'version',
            width: 80,
            align: 'center',
        },
        {
            title: '状态',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 80,
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? '启用' : '禁用'}
                </Tag>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            width: 150,
            fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="版本历史">
                        <Button
                            type="text"
                            icon={<HistoryOutlined />}
                            onClick={() => message.info('版本历史功能开发中')}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="确定删除此提示词？"
                        onConfirm={() => handleDelete(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Tooltip title="删除">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
            <Card>
                <div style={{ marginBottom: 24 }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <Title level={3} style={{ margin: 0 }}>
                            提示词管理
                        </Title>
                        <Space>
                            <Select
                                placeholder="筛选场景"
                                style={{ width: 200 }}
                                allowClear
                                value={selectedScenario}
                                onChange={setSelectedScenario}
                            >
                                <Select.Option value="resume_parsing">简历解析</Select.Option>
                                <Select.Option value="job_description_parsing">
                                    职位描述解析
                                </Select.Option>
                                <Select.Option value="resume_optimization">
                                    简历优化
                                </Select.Option>
                                <Select.Option value="interview_question_generation">
                                    面试问题生成
                                </Select.Option>
                                <Select.Option value="match_score_calculation">
                                    匹配度计算
                                </Select.Option>
                            </Select>
                            <Button icon={<ReloadOutlined />} onClick={loadPrompts}>
                                刷新
                            </Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                                新建提示词
                            </Button>
                        </Space>
                    </div>

                    <Tabs activeKey={selectedLanguage} onChange={setSelectedLanguage}>
                        <TabPane tab="英文 (EN)" key="en" />
                        <TabPane tab="中文 (CN)" key="zh-CN" />
                    </Tabs>
                </div>

                <Table
                    columns={columns}
                    dataSource={prompts}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                    }}
                />
            </Card>

            <Modal
                title={editingPrompt ? '编辑提示词' : '新建提示词'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                width={800}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ language: 'en', isActive: true }}
                >
                    <Form.Item
                        name="name"
                        label="名称"
                        rules={[{ required: true, message: '请输入名称' }]}
                    >
                        <Input placeholder="例如: resume_parsing_default" />
                    </Form.Item>

                    <Form.Item
                        name="scenario"
                        label="场景"
                        rules={[{ required: true, message: '请选择场景' }]}
                    >
                        <Select placeholder="选择场景">
                            <Select.Option value="resume_parsing">简历解析</Select.Option>
                            <Select.Option value="job_description_parsing">
                                职位描述解析
                            </Select.Option>
                            <Select.Option value="resume_optimization">简历优化</Select.Option>
                            <Select.Option value="interview_question_generation">
                                面试问题生成
                            </Select.Option>
                            <Select.Option value="match_score_calculation">
                                匹配度计算
                            </Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="language"
                        label="语言"
                        rules={[{ required: true, message: '请选择语言' }]}
                    >
                        <Select>
                            <Select.Option value="en">英文 (EN)</Select.Option>
                            <Select.Option value="zh-CN">中文 (CN)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="template"
                        label="模板内容"
                        rules={[{ required: true, message: '请输入模板内容' }]}
                        extra="使用 {variable_name} 格式定义变量"
                    >
                        <TextArea
                            rows={10}
                            placeholder="请输入提示词模板..."
                            onChange={(e) => {
                                const vars = extractVariables(e.target.value);
                                form.setFieldsValue({ variables: vars });
                            }}
                        />
                    </Form.Item>

                    <Form.Item name="variables" label="变量（自动提取）">
                        <Select mode="tags" placeholder="自动从模板中提取" disabled />
                    </Form.Item>

                    <Form.Item name="provider" label="提供商（可选）">
                        <Input placeholder="例如: openai, qwen" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingPrompt ? '更新' : '创建'}
                            </Button>
                            <Button onClick={() => setModalVisible(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PromptManagementPage;
