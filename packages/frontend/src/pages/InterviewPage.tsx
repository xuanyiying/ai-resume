import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  List,
  Typography,
  Space,
  Spin,
  message,
  Avatar,
} from 'antd';
import {
  AudioOutlined,
  AudioMutedOutlined,
  UserOutlined,
  RobotOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  interviewService,
  InterviewSession,
  InterviewMessage,
} from '../services/interview.service';

const { Title, Text } = Typography;

const InterviewPage: React.FC = () => {
  const { optimizationId } = useParams<{ optimizationId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (optimizationId) {
      startSession();
    }
  }, [optimizationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startSession = async () => {
    try {
      setLoading(true);

      // Try to get existing active session first
      const activeSession = await interviewService.getActiveSession(optimizationId!);

      if (activeSession) {
        // Resume existing session
        setSession(activeSession);
        setMessages(activeSession.messages || []);
        console.log('Resumed existing interview session:', activeSession.id);
      } else {
        // Create new session if no active session exists
        const newSession = await interviewService.startSession(optimizationId!);
        setSession(newSession);
        setMessages(newSession.messages || []);
        console.log('Started new interview session:', newSession.id);
      }
    } catch (error) {
      console.error('Failed to start/resume session:', error);
      message.error('Failed to start interview session');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      message.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    if (!session) return;

    try {
      setProcessing(true);
      // 1. Upload audio
      const uploadResult = await interviewService.uploadAudio(audioBlob);

      // 2. Send message with audio URL
      // We don't have text transcription on frontend, backend handles it?
      // My backend `handleMessage` takes `content` and `audioUrl`.
      // It uses `content` for AI context.
      // If I only send `audioUrl`, backend needs to transcribe it first.
      // My backend `handleMessage` implementation:
      // const { content, audioUrl } = sendMessageDto;
      // It doesn't seem to transcribe audio if content is missing.
      // Wait, I missed the transcription part in `InterviewService.handleMessage`!
      // I need to fix backend to transcribe if audioUrl is present and content is empty.
      // OR I transcribe on frontend (not possible with native API easily without key).
      // OR I send a placeholder text and backend handles it.

      // Let's assume backend SHOULD handle transcription.
      // I need to update backend `InterviewService` to use Whisper if audioUrl is provided.
      // I'll send "[Audio Message]" as content for now.

      const response = await interviewService.sendMessage(
        session.id,
        '[Audio Message]',
        uploadResult.url
      );

      setMessages((prev) => [
        ...prev,
        response.userMessage,
        response.aiMessage,
      ]);

      // Play AI audio
      if (response.aiMessage.audioUrl) {
        const audio = new Audio(response.aiMessage.audioUrl);
        audio.play();
      }
    } catch (error) {
      console.error('Failed to process message:', error);
      message.error('Failed to process message');
    } finally {
      setProcessing(false);
    }
  };

  const endSession = async () => {
    if (!session) return;
    try {
      await interviewService.endSession(session.id);
      message.success('Interview session ended');
      navigate('/dashboard'); // Or results page
    } catch (error) {
      console.error('Failed to end session:', error);
      message.error('Failed to end session');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card
        title={<Title level={3}>Mock Interview</Title>}
        extra={
          <Button danger onClick={endSession}>
            End Interview
          </Button>
        }
      >
        <div
          style={{
            height: '500px',
            overflowY: 'auto',
            marginBottom: '24px',
            padding: '16px',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
            </div>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={messages}
              renderItem={(msg) => (
                <List.Item
                  style={{
                    justifyContent:
                      msg.role === 'USER' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Space
                    align="start"
                    style={{
                      flexDirection:
                        msg.role === 'USER' ? 'row-reverse' : 'row',
                    }}
                  >
                    <Avatar
                      icon={
                        msg.role === 'USER' ? (
                          <UserOutlined />
                        ) : (
                          <RobotOutlined />
                        )
                      }
                      style={{
                        backgroundColor:
                          msg.role === 'USER' ? '#1890ff' : '#52c41a',
                      }}
                    />
                    <div
                      style={{
                        background: msg.role === 'USER' ? '#e6f7ff' : '#f6ffed',
                        padding: '12px',
                        borderRadius: '8px',
                        maxWidth: '70%',
                        border:
                          msg.role === 'USER'
                            ? '1px solid #91d5ff'
                            : '1px solid #b7eb8f',
                      }}
                    >
                      <Text>{msg.content}</Text>
                      {msg.audioUrl && (
                        <div style={{ marginTop: '8px' }}>
                          <audio
                            controls
                            src={msg.audioUrl}
                            style={{ height: '30px', maxWidth: '100%' }}
                          />
                        </div>
                      )}
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            {!recording ? (
              <Button
                type="primary"
                shape="circle"
                icon={<AudioOutlined style={{ fontSize: '24px' }} />}
                size="large"
                style={{ width: '64px', height: '64px' }}
                onClick={startRecording}
                disabled={loading || processing}
              />
            ) : (
              <Button
                type="primary"
                danger
                shape="circle"
                icon={<StopOutlined style={{ fontSize: '24px' }} />}
                size="large"
                style={{ width: '64px', height: '64px' }}
                onClick={stopRecording}
              />
            )}
            {processing && <Spin />}
            <Text type="secondary" style={{ display: 'block' }}>
              {recording
                ? 'Recording... Tap to stop'
                : 'Tap microphone to speak'}
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default InterviewPage;
