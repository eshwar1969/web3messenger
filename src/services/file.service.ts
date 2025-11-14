import { useAppStore } from '../store/useAppStore';

export class FileService {
  private static instance: FileService;

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  async handleFileUpload(file: File): Promise<void> {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      console.log(`Preparing to send file: ${file.name}`);

      // Convert file to base64 for XMTP attachment
      const base64Data = await this.fileToBase64(file);

      // Create attachment content type
      const attachment = {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: base64Data
      };

      // Send as JSON-encoded attachment
      const content = JSON.stringify({
        type: 'attachment',
        attachment: attachment
      });

      const currentConversation = useAppStore.getState().currentConversation;
      if (currentConversation) {
        await currentConversation.send(content);
        console.log('File sent successfully!');
      } else {
        alert('Select a conversation first');
      }

    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failed to send file: ' + (error as Error).message);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  }

  displayAttachment(message: any): boolean {
    try {
      const content = JSON.parse(message.content);
      if (content.type === 'attachment' && content.attachment) {
        const attachment = content.attachment;
        const isSent = message.senderInboxId === useAppStore.getState().xmtpClient?.inboxId;

        const messageEl = document.createElement('div');
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;

        const date = new Date(Number(message.sentAtNs) / 1000000);

        // Create download link
        const downloadUrl = `data:${attachment.mimeType};base64,${attachment.data}`;

        messageEl.innerHTML = `
          <div class="message-header">
            <span>${isSent ? '📤 You' : '📥 ' + message.senderInboxId.slice(0, 8)}</span>
            <span>${date.toLocaleTimeString()}</span>
          </div>
          <div class="message-content">
            <div class="attachment">
              <div class="attachment-info">
                📎 <strong>${this.escapeHtml(attachment.filename)}</strong>
                <br><small>${this.formatFileSize(attachment.data.length * 0.75)}</small>
              </div>
              <a href="${downloadUrl}" download="${attachment.filename}" class="download-btn">Download</a>
            </div>
          </div>
        `;

        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
          messagesDiv.appendChild(messageEl);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        return true;
      }
    } catch (error) {
      // Not an attachment, handle as regular message
      return false;
    }
    return false;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
