import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ResumeUploadDialog from './ResumeUploadDialog';
import * as resumeService from '../services/resumeService';

vi.mock('../services/resumeService');

describe('ResumeUploadDialog Component', () => {
  const mockOnClose = vi.fn();
  const mockOnUploadSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload dialog when visible is true', () => {
    render(
      <ResumeUploadDialog
        visible={true}
        onClose={mockOnClose}
        onUploadSuccess={mockOnUploadSuccess}
      />
    );
    expect(screen.getByText('上传简历')).toBeInTheDocument();
    expect(screen.getByText('点击或拖拽文件到此区域上传')).toBeInTheDocument();
  });

  it('should display file format requirements', () => {
    render(
      <ResumeUploadDialog
        visible={true}
        onClose={mockOnClose}
        onUploadSuccess={mockOnUploadSuccess}
      />
    );
    expect(
      screen.getByText('支持 PDF、Word、TXT 格式，文件大小不超过 10MB')
    ).toBeInTheDocument();
  });

  it('should disable confirm button when no file is uploaded', () => {
    render(
      <ResumeUploadDialog
        visible={true}
        onClose={mockOnClose}
        onUploadSuccess={mockOnUploadSuccess}
      />
    );
    const buttons = screen.getAllByRole('button');
    const confirmButton = buttons.find(
      (btn) => btn.textContent === '确认并继续'
    );
    expect(confirmButton).toBeDisabled();
  });
});
