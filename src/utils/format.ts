export class FormatUtils {
  private static instance: FormatUtils;

  static getInstance(): FormatUtils {
    if (!FormatUtils.instance) {
      FormatUtils.instance = new FormatUtils();
    }
    return FormatUtils.instance;
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatInboxId(inboxId: string): string {
    if (!inboxId || inboxId.length < 16) return inboxId;
    return `${inboxId.slice(0, 8)}...${inboxId.slice(-6)}`;
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  formatMessageTime(sentAtNs: string): string {
    const timestamp = Number(sentAtNs) / 1000000;
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/i.test(address);
  }

  isValidInboxId(inboxId: string): boolean {
    return inboxId.length >= 6;
  }

  normalizeUsername(username: string): string {
    if (!username) return '';
    const trimmed = username.trim().replace(/^@+/, '');
    return trimmed;
  }

  validateUsername(username: string): { isValid: boolean; error?: string } {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      return { isValid: false, error: 'Username cannot be empty' };
    }
    if (normalized.length < 3 || normalized.length > 32) {
      return { isValid: false, error: 'Username must be between 3 and 32 characters' };
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
      return { isValid: false, error: 'Username can only include letters, numbers, dots, underscores, or hyphens' };
    }
    return { isValid: true };
  }
}
