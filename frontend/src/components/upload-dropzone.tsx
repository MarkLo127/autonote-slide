'use client';

import { useRef, useState } from 'react';
import styles from './upload-dropzone.module.css';

interface UploadDropzoneProps {
  onFilesSelected: (files: FileList) => void;
  accept?: string;
}

export function UploadDropzone({ onFilesSelected, accept = '.pdf,.ppt,.pptx,.doc,.docx,.md,.txt' }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onFilesSelected(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files) {
      onFilesSelected(event.dataTransfer.files);
    }
  };

  return (
    <div
      className={styles.dropzone}
      data-drag-active={isDragActive}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.icon}>📤</div>
      <div className={styles.title}>上傳您的檔案</div>
      <div className={styles.description}>
        將檔案拖放到此處，或點擊任何地方瀏覽檔案<br />
        支援格式：PDF、PPT、PPTX、Word、Markdown、TXT
      </div>
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleBrowseClick} type="button">
          選擇檔案
        </button>
        <button className={`${styles.button} ${styles.buttonGhost}`} type="button">
          最多一次上傳 5 個檔案
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={handleInputChange}
      />
    </div>
  );
}
