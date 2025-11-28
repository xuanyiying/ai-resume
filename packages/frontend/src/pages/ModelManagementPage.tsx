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
    Card,
    Typography,
    Tooltip,
    Popconfirm,
    Switch,
    InputNumber,
    Badge,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ApiOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
    modelAdminService,
    ModelConfig,
    CreateModelConfigDto,
} from '../services/modelAdminService';

const { Title, Text } = Typography;

const ModelManagementPage: React.FC = () => {
    const [models, setModels] = useState<ModelConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
    const [form] = Form.useForm();
    const [testingModel, setTestingModel] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<string | undefined>();

    useEffect(() => {
        loadModels();
    }, [selectedProvider]);

    const loadModels = async () => {
        setLoading(true);
        try {
            const response = await modelAdminService.listModels({
                provider: selectedProvider,
                limit: 100,
            });
            setModels(response.data);
        } catch (error) {
            message.error('加载模型配置失败');
            console.error('Load models error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingModel(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (model: ModelConfig) => {
        setEditingModel(model);
        form.setFieldsValue({
            ...model,
            apiKey: '', // Don't show masked API key
        });
        setModalVisible(true);
    };

    const handleDelete = async (name: string) => {
        try {
            await modelAdminService.deleteModel(name);
            message.success('删除成功');
            loadModels();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleToggleActive = async (name: string, isActive: boolean) => {
        try {
            if (isActive) {
                await modelAdminService.enableModel(name);
                message.success('已启用');
            } else {
                await modelAdminService.disableModel(name);
                message.success('已禁用');
            }
            loadModels();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleTestConnection = async (name: string) => {
        setTestingModel(name);
        try {
            const result = await modelAdminService.testModel(name);
            if (result.status === 'valid') {
                message.success(`连接测试成功: ${result.message}`);
            } else {
                message.error(`连接测试失败: ${result.message}`);
            }
        } catch (error) {
            message.error('连接测试失败');
        } finally {
            setTestingModel(null);
        }
    };

    const handleSubmit = async (values: CreateModelConfigDto) => {
        try {
            // If editing and API key is empty, remove it from update
            const submitData = editingModel && !values.apiKey
                ? { ...values, apiKey: undefined }
                : values;

            if (editingModel) {
                await modelAdminService.updateModel(editingModel.name, submitData);
                message.success('更新成功');
            } else {
                await modelAdminService.createModel(values);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadModels();
        } catch (error) {
            message.error(editingModel ? '更新失败' : '创建失败');
        }
    };

    const handleRefreshCache = async () => {
        try {
            await modelAdminService.refreshCache();
            message.success('缓存刷新成功');
        } catch (error) {
            message.error('缓存刷新失败');
        }
    };

    const columns: ColumnsType<ModelConfig> = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 200,
            fixed: 'left',
        },
        {
            title: '提供商',
            dataIndex: 'provider',
            key: 'provider',
            width: 120,
            render: (provider: string) => {
                const colors: Record<string, string> = {
                    openai: 'green',
                    qwen: 'blue',
                    deepseek: 'purple',
                    gemini: 'orange',
                    ollama: 'cyan',
                };
                return <Tag color={colors[provider] || 'default'}>{provider.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'API端点',
            dataIndex: 'endpoint',
            key: 'endpoint',
            ellipsis: true,
            render: (endpoint?: string) => (
                <Text ellipsis>{endpoint || '默认'}</Text>
            ),
        },
        {
            title: 'API密钥',
            dataIndex: 'apiKey',
            key: 'apiKey',
            width: 150,
            render: (apiKey: string) => <Text code>{apiKey}</Text>,
        },
        {
            title: '温度',
            dataIndex: 'defaultTemperature',
            key: 'temperature',
            width: 80,
            align: 'center',
        },
        {
            title: '最大Token',
            dataIndex: 'defaultMaxTokens',
            key: 'maxTokens',
            width: 100,
            align: 'center',
        },
        {
            title: '费用(输入)',
            dataIndex: 'costPerInputToken',
            key: 'costInput',
            width: 100,
            align: 'right',
            render: (cost?: number) => cost ? `$${cost.toFixed(6)}` : '-',
        },
        {
            title: '费用(输出)',
            dataIndex: 'costPerOutputToken',
            key: 'costOutput',
            width: 100,
            align: 'right',
            render: (cost?: number) => cost ? `$${cost.toFixed(6)}` : '-',
        },
        {
            title: '状态',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 100,
            align: 'center',
            render: (isActive: boolean, record) => (
                <Switch
                    checked={isActive}
                    onChange={(checked) => handleToggleActive(record.name, checked)}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                />
            ),
        },
        {
            title: '操作',
            key: 'actions',
            width: 200,
            fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Tooltip title="测试连接">
                        <Button
                            type="text"
                            icon={<ApiOutlined />}
                            loading={testingModel === record.name}
                            onClick={() => handleTestConnection(record.name)}
                        />
                    </Tooltip>
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="确定删除此模型配置？"
                        onConfirm={() => handleDelete(record.name)}
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
                            模型配置管理
                        </Title>
                        <Space>
                            <Select
                                placeholder="筛选提供商"
                                style={{ width: 150 }}
                                allowClear
                                value={selectedProvider}
                                onChange={setSelectedProvider}
                            >
                                <Select.Option value="openai">OpenAI</Select.Option>
                                <Select.Option value="qwen">Qwen</Select.Option>
                                <Select.Option value="deepseek">DeepSeek</Select.Option>
                                <Select.Option value="gemini">Gemini</Select.Option>
                                <Select.Option value="ollama">Ollama</Select.Option>
                            </Select>
                            <Button icon={<ReloadOutlined />} onClick={handleRefreshCache}>
                                刷新缓存
                            </Button>
                            <Button icon={<ReloadOutlined />} onClick={loadModels}>
                                刷新列表
                            </Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                                新建模型
                            </Button>
                        </Space>
                    </div>
                </div>

                <Table
                    columns={columns}
                    dataSource={models}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1400 }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                    }}
                />
            </Card>

            <Modal
                title={editingModel ? '编辑模型配置' : '新建模型配置'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                width={700}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        isActive: true,
                        defaultTemperature: 0.7,
                        defaultMaxTokens: 2000,
                    }}
                >
                    <Form.Item
                        name="name"
                        label="配置名称"
                        rules={[{ required: true, message: '请输入配置名称' }]}
                    >
                        <Input
                            placeholder="例如: gpt-4-turbo"
                            disabled={!!editingModel}
                        />
                    </Form.Item>

                    <Form.Item
                        name="provider"
                        label="提供商"
                        rules={[{ required: true, message: '请选择提供商' }]}
                    >
                        <Select placeholder="选择AI提供商">
                            <Select.Option value="openai">OpenAI</Select.Option>
                            <Select.Option value="qwen">Qwen (通义千问)</Select.Option>
                            <Select.Option value="deepseek">DeepSeek</Select.Option>
                            <Select.Option value="gemini">Google Gemini</Select.Option>
                            <Select.Option value="ollama">Ollama (本地)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="apiKey"
                        label="API密钥"
                        rules={editingModel ? [] : [{ required: true, message: '请输入API密钥' }]}
                        extra={editingModel ? '留空则不更新密钥' : ''}
                    >
                        <Input.Password
                            placeholder={editingModel ? '留空不更新' : '输入API密钥'}
                        />
                    </Form.Item>

                    <Form.Item name="endpoint" label="API端点（可选）">
                        <Input placeholder="留空使用默认端点" />
                    </Form.Item>

                    <Form.Item name="defaultTemperature" label="默认温度">
                        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="defaultMaxTokens" label="默认最大Token数">
                        <InputNumber min={1} max={100000} step={100} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="costPerInputToken" label="输入Token成本（可选）">
                        <InputNumber
                            min={0}
                            step={0.000001}
                            precision={6}
                            style={{ width: '100%' }}
                            addonBefore="$"
                        />
                    </Form.Item>

                    <Form.Item name="costPerOutputToken" label="输出Token成本（可选）">
                        <InputNumber
                            min={0}
                            step={0.000001}
                            precision={6}
                            style={{ width: '100%' }}
                            addonBefore="$"
                        />
                    </Form.Item>

                    <Form.Item name="rateLimitPerMinute" label="每分钟速率限制（可选）">
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="rateLimitPerDay" label="每天速率限制（可选）">
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="isActive" label="启用状态" valuePropName="checked">
                        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingModel ? '更新' : '创建'}
                            </Button>
                            <Button onClick={() => setModalVisible(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ModelManagementPage;
